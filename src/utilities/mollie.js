const { PaymentStatus } = require('@mollie/api-client');
const mollieClient = require('../config/mollieClient');
const { createRefundRecord, getTransactionByMemberAndEventID, updateTransactionRefundStatus } = require('../controller/mollie/functions');
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

function createMolliePayment(order, amount, req, res) {
    mollieClient.payments.create({
        amount: { currency: order.Currency, value: amount.toString() },
        description: order.Description,
        redirectUrl: `${process.env.MOLLIE_URL}/`,
        webhookUrl: `${process.env.MOLLIE_URL}/webhook?orderId=${order.OrderID}`,
        metadata: { orderId: order.OrderID },
    })
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
            switch (payment.status) {
                case PaymentStatus.paid:
                    return updateTransactionStatus('Paid', req.body.id, req.query.orderId, res);
                case PaymentStatus.canceled:
                    return updateTransactionStatus('Canceled', req.body.id, req.query.orderId, res);
                default:
                    if (payment.status != PaymentStatus.open) {
                        return updateTransactionStatus('Failed', req.body.id, req.query.orderId, res);
                    }
                    res.send('Payment is still open');
            }
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Error occurred while verifying payment');
        });
}

async function refundTransaction(req, res) {
    try {
        const transaction = await getTransactionByMemberAndEventID(req.user.id, req.params.OrderID);

        console.log(transaction);
        if (!transaction || new Date() > new Date(transaction.CancelableUntil)) {
            return res.status(400).send('Eligible transaction not found or refund request deadline has passed');
        }

        const refund = await mollieClient.paymentRefunds.create({
            paymentId: transaction.MollieID,
            amount: { value: transaction.Amount.toString(), currency: 'EUR' }
        });

        if (refund) {
            await createRefundRecord(transaction.TransactionID, refund.id, refund.amount.value, refund.status);
            await updateTransactionRefundStatus(transaction.TransactionID, refund.status);
            return res.send(`Refund ${refund.status}`);
        }

        res.status(400).send('Refund failed');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = { createMolliePayment, webhookVerification, refundTransaction };
