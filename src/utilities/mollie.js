const { PaymentStatus } = require('@mollie/api-client');
const mollieClient = require('../config/mollieClient');
const { updateTransactionStatus, generateOrderID, createRefundRecord, getTransactionByMemberAndEventID } = require('../controller/mollie/functions');
const query = require('../config/database-all');



async function createPayment(req, res) {
    // Validate request parameters, e.g. make sure ticketTypeId is provided
    if (!req.body.ticketTypeId) {
        res.status(400).send('Missing ticket type id');
        return;
    }

    try {
        // Query the database to get ticket type details
        // Replace this query if your actual table and column names are different
        const ticketTypeSql = 'SELECT * FROM TicketTypes WHERE TicketTypeID = ?';
        const ticketTypeResult = await query(ticketTypeSql, [req.body.ticketTypeId]);

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

        // Create a payment with Mollie API using the ticket type details
        mollieClient.payments.create({
            amount: { value: amount.toString(), currency },
            description,
            // redirectUrl: `https://localhost:8443/redirect?orderId=${orderId}`,
            redirectUrl: `https://localhost:8443/`,
            webhookUrl: `https://localhost:8443/webhook?orderId=${orderId}`,
            metadata: { orderId, ticketTypeId: req.body.ticketTypeId },
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

                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ? WHERE PaymentID = ?', ['Paid', payment.id]);
                    res.send('Payment is paid and status updated in database');
                } catch (dbError) {
                    console.error(dbError);
                    res.status(500).send('Error occurred while updating payment status in database');
                }
            } else if (payment.status == PaymentStatus.canceled) {
                // Payment is canceled by the customer
                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ? WHERE PaymentID = ?', ['Canceled', payment.id]);
                    res.send('Payment is canceled and status updated in database');
                } catch (dbError) {
                    console.error(dbError);
                    res.status(500).send('Error occurred while updating payment status in database');
                }
            } else if (payment.status != PaymentStatus.open) {
                // The payment isn't paid, isn't open, and isn't canceled. We can assume it was aborted or failed.
                // Update status in database
                try {
                    await query('UPDATE Transactions SET Status = ? WHERE PaymentID = ?', ['Failed', payment.id]);
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
        const eventID = req.body.eventID;

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

        // Step 3: Proceed with refund if all checks pass
        const refund = await mollieClient.payments_refunds.create({
            paymentId: transaction.PaymentID,
            amount: {
                value: transaction.Amount.toString(),
                currency: 'EUR'  // Ensure correct currency
            }
        });

        // Step 5: Update records in database if refund is successful
        if (refund && refund.status === 'refunded') {
            await createRefundRecord(transaction.TransactionID, refund.id, refund.amount.value);
            await updateTransactionStatus(transaction.TransactionID, 'Refunded');
            return res.send('Refund successful');
        } else {
            return res.status(400).send('Refund failed');
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}





module.exports = { createPayment, webhookVerification, refundTransaction };