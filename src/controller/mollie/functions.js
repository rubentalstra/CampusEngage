const query = require('../../config/database-all');




async function getTransactionByMemberAndEventID(memberId, eventId) {
    try {
        const transactions = await query(
            `SELECT Transactions.*, TicketTypes.CancelableUntil 
             FROM Transactions 
             JOIN TicketTypes ON Transactions.TicketTypeID = TicketTypes.TicketTypeID
             WHERE Transactions.MemberID = ? AND TicketTypes.EventID = ? AND Transactions.Status = 'Paid'`,
            [memberId, eventId]
        );
        return transactions[0];  // return first matching record
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createRefundRecord(transactionID, refundPaymentID, amount) {
    try {
        const result = await query(
            'INSERT INTO Refunds (TransactionID, RefundPaymentID, Amount, RefundStatus) VALUES (?, ?, ?, "Refunded")',
            [transactionID, refundPaymentID, amount]
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

// module.exports = {
//     getTransactionByMemberAndTicketType,
//     getTicketTypeByID,
//     createRefundRecord,
//     updateTransactionStatus
// };


// async function getTicketTypeByID(ticketTypeID) {
//     const sql = 'SELECT * FROM TicketTypes WHERE TicketTypeID = ?';
//     const results = await query(sql, [ticketTypeID]);
//     return results[0];
// }

// async function updateTransactionStatus(transactionID, status) {
//     const sql = 'UPDATE Transactions SET Status = ? WHERE TransactionID = ?';
//     return await query(sql, [status, transactionID]);
// }





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
            SELECT MAX(SUBSTRING(PaymentID, 6)) as maxID
            FROM Transactions
            WHERE PaymentID LIKE ?`;
    const refundsSql = `
            SELECT MAX(SUBSTRING(RefundPaymentID, 6)) as maxID
            FROM Refunds
            WHERE RefundPaymentID LIKE ?`;


    const [transactionsResult, refundsResult] = Promise.all([query(transactionsSql, [`${currentYear}%`]), query(refundsSql, [`${currentYear}%`])]);
    // const transactionsResult = await query(transactionsSql, [`${currentYear}%`]);
    // const refundsResult = await query(refundsSql, [`${currentYear}%`]);

    // Determine the higher of the two maxIDs and increment it
    const maxTransactionID = transactionsResult[0].maxID || 0;
    const maxRefundID = refundsResult[0].maxID || 0;
    const maxID = Math.max(maxTransactionID, maxRefundID);
    const nextID = maxID + 1;


    return nextID;

}



module.exports = { getTransactionByMemberAndEventID, createRefundRecord, updateTransactionStatus, generateOrderID };