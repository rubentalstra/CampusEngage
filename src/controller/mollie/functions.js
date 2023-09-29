const query = require('../../config/database-all');





async function getTransactionByMemberAndEventID(memberId, eventId) {
    try {
        const transactions = await query(
            `SELECT t.CancelableUntil, tr.TransactionID, tr.Status, tr.Amount, tr.MollieID
            FROM Tickets t
            JOIN OrderRows orr ON t.TicketID = orr.TicketID
            JOIN Orders o ON orr.OrderID = o.OrderID
            JOIN Transactions tr ON o.OrderID = tr.OrderID AND o.MemberID = tr.MemberID
            WHERE o.MemberID = 'd25bff46-5b13-11ee-89e1-4ac5fc9f2af2'
            AND t.EventID = 1
            AND tr.Status = 'Paid'
            AND orr.MemberID IS NOT NULL`,
            [memberId, eventId]
        );
        return transactions[0];  // return first matching record
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createRefundRecord(transactionID, refundPaymentID, amount, RefundStatus) {
    try {

        const orderId = await generateOrderID();


        const result = await query(
            'INSERT INTO Refunds (TransactionID, RefundPaymentID, MollieID, Amount, RefundStatus) VALUES (?, ?, ?, ?, ?)',
            [transactionID, orderId, refundPaymentID, amount, RefundStatus]
        );
        return result.insertId;  // return ID of the new record
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function updateTransactionStatus(transactionID, status) {
    try {
        const result = await query(
            'UPDATE Transactions SET Status = ?, UpdatedAt = NOW() WHERE TransactionID = ?',
            [status, transactionID]
        );
        return result.affectedRows > 0;  // return true if at least one record was updated
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function updateTransactionRefundStatus(transactionID, RefundStatus) {
    try {
        const result = await query(
            'UPDATE Transactions SET RefundStatus = ?, UpdatedAt = NOW() WHERE TransactionID = ?',
            [RefundStatus, transactionID]
        );
        return result.affectedRows > 0;  // return true if at least one record was updated
    } catch (error) {
        console.error(error);
        return false;
    }
}


async function generateOrderID() {
    const currentYear = new Date().getFullYear().toString();

    // Fetch and update the last order number atomically
    const lastOrderNumber = await fetchAndUpdateLastOrderNumberFromDB(currentYear);

    // Zero-pad the order number to ensure it has at least 6 digits
    const orderNumberPadded = lastOrderNumber.toString().padStart(6, '0');

    // Combine the year and the zero-padded order number
    const orderID = `${currentYear}-${orderNumberPadded}`;

    return orderID;
}



async function fetchAndUpdateLastOrderNumberFromDB(currentYear) {

    // Fetch the maximum PaymentID for the current year from both tables
    const transactionsSql = `
            SELECT MAX(SUBSTRING(OrderID, 6)) as maxID
            FROM Orders
            WHERE OrderID LIKE ?`;
    const refundsSql = `
            SELECT MAX(SUBSTRING(RefundPaymentID, 6)) as maxID
            FROM Refunds
            WHERE RefundPaymentID LIKE ?`;


    // const [transactionsResult, refundsResult] = Promise.all([query(transactionsSql, [`${currentYear}%`]), query(refundsSql, [`${currentYear}%`])]);

    const [transactionsResult, refundsResult] = await Promise.all([
        query(transactionsSql, [`${currentYear}%`]),
        query(refundsSql, [`${currentYear}%`])
    ]);

    // const transactionsResult = await query(transactionsSql, [`${currentYear}%`]);
    // const refundsResult = await query(refundsSql, [`${currentYear}%`]);

    // Determine the higher of the two maxIDs and increment it
    const maxTransactionID = transactionsResult[0].maxID || 0;
    const maxRefundID = refundsResult[0].maxID || 0;
    const maxID = Math.max(maxTransactionID, maxRefundID);
    const nextID = maxID + 1;


    return nextID;

}



module.exports = { getTransactionByMemberAndEventID, createRefundRecord, updateTransactionStatus, updateTransactionRefundStatus, generateOrderID };