const { PaymentStatus } = require('@mollie/api-client');
const mollieClient = require('../config/mollieClient');
const { updateTransactionStatus, generateOrderID, createRefundRecord, getTransactionByMemberAndEventID, updateTransactionRefundStatus } = require('../controller/mollie/functions');
const query = require('../config/database-all');



async function createPayment(req, res) {

    const ticketTypeId = 1;
    // Validate request parameters, e.g. make sure ticketTypeId is provided
    // if (!req.body.ticketTypeId) {
    //     res.status(400).send('Missing ticket type id');
    //     return;
    // }

    try {
        // Query the database to get ticket type details
        // Replace this query if your actual table and column names are different
        const ticketTypeSql = 'SELECT * FROM TicketTypes WHERE TicketTypeID = ?';
        const ticketTypeResult = await query(ticketTypeSql, [ticketTypeId]);

        if (ticketTypeResult.length === 0) {
            res.status(404).send('Ticket type not found');
            return;
        }

        // Extract relevant information from the ticket type
        const ticketType = ticketTypeResult[0];
        const amount = ticketType.Price; // make sure this is in the correct format
        const currency = 'EUR'; // you might need to adjust this based on your requirements
        const description = ticketType.Description;

        // Generate an order ID
        const orderId = await generateOrderID();

        console.log(orderId);


        // Insert a new transaction record into the database with status "Open"
        const insertTransactionSql = `
 INSERT INTO Transactions (TicketTypeID, MemberID, PaymentID, Amount, Currency, Status)
 VALUES (?, ?, ?, ?, ?, 'Open');
`;
        await query(insertTransactionSql, [ticketTypeId, req.user.id, orderId, amount, currency]);


        // Create a payment with Mollie API using the ticket type details
        mollieClient.payments.create({
            amount: { value: amount.toString(), currency },
            description,
            // redirectUrl: `https://localhost:8443/redirect?orderId=${orderId}`,
            // 
            redirectUrl: `https://d507-217-103-53-31.ngrok-free.app/`,
            webhookUrl: `https://d507-217-103-53-31.ngrok-free.app/webhook?orderId=${orderId}`,
            metadata: { orderId, ticketTypeId: ticketTypeId },
        })
            .then(payment => {
                res.redirect(payment.getCheckoutUrl());
            })
            .catch(error => {
                // Handle errors during payment creation
                console.error(error);
                res.status(500).send('Error occurred while creating payment');
            });

    } catch (dbError) {
        // Handle errors during database query
        console.error(dbError);
        res.status(500).send('Error occurred while fetching ticket type from database');
    }
}


function webhookVerification(req, res) {

    // Make sure you validate req.body.id before using it to avoid security risks
    if (!req.body.id) {
        res.status(400).send('Missing payment id');
        return;
    }

    mollieClient.payments.get(req.body.id)
        .then(async payment => {
            // Check if the payment is paid
            if (payment.status == PaymentStatus.paid) {
                // Hooray, you've received a payment! You can start shipping to the consumer.

                // console.log(payment.id);
                // console.log(orderID);
                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ?, MollieID = ? WHERE PaymentID = ?', ['Paid', req.body.id, req.query.orderId]);
                    res.send('Payment is paid and status updated in database');
                } catch (dbError) {
                    console.error(dbError);
                    res.status(500).send('Error occurred while updating payment status in database');
                }
            } else if (payment.status == PaymentStatus.canceled) {
                // Payment is canceled by the customer
                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ?, MollieID = ? WHERE PaymentID = ?', ['Canceled', req.body.id, req.query.orderId]);
                    res.send('Payment is canceled and status updated in database');
                } catch (dbError) {
                    console.error(dbError);
                    res.status(500).send('Error occurred while updating payment status in database');
                }
            } else if (payment.status != PaymentStatus.open) {
                // The payment isn't paid, isn't open, and isn't canceled. We can assume it was aborted or failed.
                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ?, MollieID = ? WHERE PaymentID = ?', ['Failed', req.body.id, req.query.orderId]);
                    res.send('Payment is not open, not paid, not canceled, and status updated in database');
                } catch (dbError) {
                    console.error(dbError);
                    res.status(500).send('Error occurred while updating payment status in database');
                }
            } else {
                // Payment is still open
                // You might want to update the status in the database here as well, depending on your requirements
                res.send('Payment is still open');
            }
        })
        .catch(error => {
            // Do some proper error handling.
            console.error(error);
            res.status(500).send('Error occurred while verifying payment');
        });
}


async function refundTransaction(req, res) {
    try {
        const memberId = req.user.id;

        const eventID = 1;
        // const eventID = req.body.eventID;

        // Step 1: Retrieve transaction and ticket type details in a single query
        const transaction = await getTransactionByMemberAndEventID(memberId, eventID);
        if (!transaction || transaction.Status !== 'Paid') {
            return res.status(404).send('Eligible transaction not found');
        }

        // Step 2: Check CancelableUntil
        const currentDate = new Date();
        if (currentDate > new Date(transaction.CancelableUntil)) {
            return res.status(400).send('Refund request deadline has passed');
        }

        // console.log(transaction.MollieID);

        // Step 3: Proceed with refund if all checks pass
        const refund = await mollieClient.paymentRefunds.create({
            paymentId: transaction.MollieID,
            amount: {
                value: transaction.Amount.toString(),
                currency: 'EUR'  // Ensure correct currency
            }
        });

        // console.log(refund);

        // Step 5: Update records in database if refund is successful
        if (refund && refund.status === 'refunded') {
            await createRefundRecord(transaction.TransactionID, refund.id, refund.amount.value, 'Refunded');
            await updateTransactionRefundStatus(transaction.TransactionID, 'Refunded');
            return res.send('Refund successful');
        } else if (refund && refund.status === 'pending') {
            await createRefundRecord(transaction.TransactionID, refund.id, refund.amount.value, 'Pending');
            await updateTransactionRefundStatus(transaction.TransactionID, 'Pending');
            return res.send('Refund is Pending');
        } else if (refund && refund.status === 'failed') {
            await createRefundRecord(transaction.TransactionID, refund.id, refund.amount.value, 'Failed');
            await updateTransactionRefundStatus(transaction.TransactionID, 'Failed');
            return res.send('Refund is Pending');
        } else {
            return res.status(400).send('Refund failed');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}





module.exports = { createPayment, webhookVerification, refundTransaction };