const { PaymentStatus } = require('@mollie/api-client');
const mollieClient = require('../config/mollieClient');
const { getEligibleAttendeesForRefund, markAttendeeAsRefunded, createRefundRecord, getUserIdToAttendeeIdMapping, generateOrderID } = require('../controller/mollie/functions');
const query = require('../config/database-all');

async function updateTransactionStatus(status, mollieId, orderId, res) {
    try {
        await query('UPDATE Transactions SET Status = ?, MollieID = ? WHERE OrderID = ?', [status, mollieId, orderId]);
        return;
    } catch (dbError) {
        console.error(dbError);
        res.status(500).send('Error occurred while updating payment status in database');
    }
}

async function updateRefundStatus() {
    try {
        const refunds = await query(`SELECT * from Refunds where RefundStatus IN ('Queued','Pending','Processing')`);

        if (!refunds || refunds.length === 0) {
            // console.log('No refunds to update');
            return;
        }

        // Using Promise.all to process refunds concurrently
        const updatePromises = refunds.map(async refund => {
            try {
                const mollieResponse = await mollieClient.paymentRefunds.get(refund.MollieID, { paymentId: refund.TransactionMollieID });
                console.log(mollieResponse);

                if (mollieResponse) {
                    await query('UPDATE Refunds SET RefundStatus = ? WHERE RefundID = ?', [mollieResponse.status, refund.RefundID]);
                }
            } catch (error) {
                // Log specific refund error without stopping the entire process
                console.error(`Error updating refund with ID: ${refund.RefundID}. Error: ${error.message}`);
            }
        });

        // Wait for all updates to complete
        await Promise.all(updatePromises);
    } catch (dbError) {
        // Handle database error
        console.error(`Database error: ${dbError.message}`);
    }
}


async function updateMollieID(mollieId, orderId, res) {
    try {
        await query('UPDATE Attendees SET MollieID = ? WHERE OrderID = ?', [mollieId, orderId]);
        return;
    } catch (dbError) {
        console.error(dbError);
        res.status(500).send('Error occurred while updating payment status in database');
    }
}

function createMolliePayment(order, amount, req, res) {
    if (!order || !amount || !order.Currency || !order.Description || !order.OrderID) {
        return res.status(400).send('Invalid order or amount');
    }

    const paymentData = {
        amount: { currency: order.Currency, value: amount.toString() },
        description: order.Description,
        redirectUrl: `${process.env.MOLLIE_URL}/`,
        webhookUrl: `${process.env.MOLLIE_URL}/webhook?orderId=${order.OrderID}`,
        metadata: { orderId: order.OrderID },
    };

    mollieClient.payments.create(paymentData)
        .then(payment => {
            res.redirect(payment.getCheckoutUrl());
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Error occurred while creating payment');
        });
}

function webhookVerification(req, res) {
    if (!req.body.id) {
        return res.status(400).send('Missing payment id');
    }

    mollieClient.payments.get(req.body.id)
        .then(async payment => {

            console.log(payment);

            switch (payment.status) {
                case PaymentStatus.paid: {
                    await updateTransactionStatus('Paid', req.body.id, req.query.orderId, res);
                    await updateMollieID(req.body.id, req.query.orderId, res);
                    return res.status(200);
                }
                case PaymentStatus.canceled: {
                    await updateTransactionStatus('Canceled', req.body.id, req.query.orderId, res);
                    await updateMollieID(req.body.id, req.query.orderId, res);
                    return res.status(200);
                }
                default:
                    if (payment.status != PaymentStatus.open) {
                        await updateTransactionStatus('Failed', req.body.id, req.query.orderId, res);
                        await updateMollieID(req.body.id, req.query.orderId, res);
                        return res.status(200);
                    }
                    res.send('Payment is still open');
            }
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Error occurred while verifying payment');
        });
}


async function createRefundPayment(req, res) {

    const userId = req.user.id;
    const EventID = req.params.EventID;
    const attendeeIds = req.body.attendeeIds;

    try {

        let attendeesToRefund;

        // Step 1: Retrieve eligible attendees for refund
        const eligibleAttendees = await getEligibleAttendeesForRefund(EventID, userId);

        // Ensure attendeeIds is an array and convert all elements to strings for consistent comparison
        let attendeeIdsArray = Array.isArray(attendeeIds) ? attendeeIds.map(String) : [String(attendeeIds)];

        // Retrieve the AttendeeID corresponding to the userId (you need to implement getUserIdToAttendeeIdMapping)
        const buyerAttendeeId = await getUserIdToAttendeeIdMapping(EventID, userId); // This function needs to be defined

        // Convert buyerAttendeeId to string for consistent comparison
        const buyerAttendeeIdStr = String(buyerAttendeeId);

        // If buyerAttendeeId is included in attendeeIdsArray, refund all eligible attendees
        if (attendeeIdsArray.includes(buyerAttendeeIdStr)) {
            attendeesToRefund = eligibleAttendees; // Refund all eligible attendees
        } else {
            // Step 2: Filter the eligible attendees based on the provided attendeeIds
            attendeesToRefund = eligibleAttendees.filter(attendee => attendeeIdsArray.includes(String(attendee.AttendeeID)));
        }


        // Check if there are attendees to refund
        if (attendeesToRefund.length === 0) {
            throw new Error('No eligible attendees to refund.');
        }

        // Step 3: Calculate total refund amount
        const totalRefundAmount = attendeesToRefund.reduce((total, attendee) => {
            return total + parseFloat(attendee.Price);
        }, 0).toFixed(2);



        console.log(totalRefundAmount.toString());

        const orderId = await generateOrderID();


        // Step 4: Initiate refund via payment provider API
        const refundResponse = await mollieClient.payments_refunds.create({
            paymentId: eligibleAttendees[0].MollieID, // Assuming all attendees in the order have the same PaymentID
            amount: {
                value: totalRefundAmount.toString(), // Convert total amount to string
                currency: eligibleAttendees[0].Currency // Assuming all attendees use the same currency
            },
        });

        // Step 5: Check refund response status and mark attendees as refunded
        if (refundResponse && refundResponse.status && !['Failed', 'Canceled'].includes(refundResponse.status)) {
            const RefundID = await createRefundRecord(eligibleAttendees[0].MollieID, eligibleAttendees[0].OrderID, orderId, refundResponse.id, refundResponse.amount.value, refundResponse.status);

            for (const attendee of attendeesToRefund) {
                await markAttendeeAsRefunded(attendee.AttendeeID, RefundID);
            }
        } else {
            console.error(`Refund failed for order ID: ${EventID}`);
        }

        res.status(200).send(`Refund ${refundResponse.status}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating refund payment.');
    }
}






module.exports = { createMolliePayment, webhookVerification, createRefundPayment, updateRefundStatus };
