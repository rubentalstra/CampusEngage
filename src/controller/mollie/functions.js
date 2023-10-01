const query = require('../../config/database-all');





// 


async function getUserIdToAttendeeIdMapping(EventID, BuyerID) {
    try {
        const sql = `
        SELECT
        Attendees.AttendeeID
    FROM
        Attendees
        LEFT JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
    WHERE
        EventID = ?
        AND BuyerID = ?
        AND GuestName IS NULL
        AND Refunded = 0
        `;
        const result = await query(sql, [EventID, BuyerID]);
        return result[0].AttendeeID;
    } catch (error) {
        console.error(error);
        throw new Error('Error retrieving eligible attendees for refund.');
    }
}


async function getEligibleAttendeesForRefund(EventID, BuyerID) {
    try {
        // Query your database to get attendees that are eligible for refund.
        // Replace the SQL query with your actual query.
        const sql = `
    SELECT
    Attendees.*, Tickets.Price, Tickets.Currency
    FROM
        Attendees
        LEFT JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
    WHERE
        EventID = ?
        AND BuyerID = ?
        AND Refunded = 0
        `;
        const result = await query(sql, [EventID, BuyerID]);
        return result;
    } catch (error) {
        console.error(error);
        throw new Error('Error retrieving eligible attendees for refund.');
    }
}


async function markAttendeeAsRefunded(attendeeId, RefundID) {
    try {
        // Update the attendee's refund status in your database.
        // Replace the SQL query with your actual query.
        const sql = `
            UPDATE Attendees 
            SET Refunded = 1, RefundID = ?
            WHERE AttendeeID = ?
        `;
        await query(sql, [RefundID, attendeeId]);
    } catch (error) {
        console.error(error);
        throw new Error('Error marking attendee as refunded.');
    }
}


// 


// async function getTransactionByMemberAndEventID(memberId, eventId) {
//     try {
//         const transactions = await query(
//             `SELECT t.CancelableUntil, tr.TransactionID, tr.Status, tr.Amount, tr.MollieID
//             FROM Tickets t
//             JOIN OrderRows orr ON t.TicketID = orr.TicketID
//             JOIN Orders o ON orr.OrderID = o.OrderID
//             JOIN Transactions tr ON o.OrderID = tr.OrderID AND o.MemberID = tr.MemberID
//             WHERE o.MemberID = 'd25bff46-5b13-11ee-89e1-4ac5fc9f2af2'
//             AND t.EventID = 1
//             AND tr.Status = 'Paid'
//             AND orr.MemberID IS NOT NULL`,
//             [memberId, eventId]
//         );
//         return transactions[0];  // return first matching record
//     } catch (error) {
//         console.error(error);
//         return null;
//     }
// }


async function createRefundRecord(TransactionMollieID, OrderID, RefundPaymentID, MollieID, amount, RefundStatus) {
    try {
        const result = await query(
            'INSERT INTO Refunds (OrderID, RefundPaymentID, TransactionMollieID, MollieID, Amount, RefundStatus) VALUES (?, ?,  ?, ?, ?, ?)',
            [OrderID, RefundPaymentID, TransactionMollieID, MollieID, amount, RefundStatus]
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

// async function updateTransactionRefundStatus(transactionID, RefundStatus) {
//     try {
//         const result = await query(
//             'UPDATE Transactions SET RefundStatus = ?, UpdatedAt = NOW() WHERE TransactionID = ?',
//             [RefundStatus, transactionID]
//         );
//         return result.affectedRows > 0;  // return true if at least one record was updated
//     } catch (error) {
//         console.error(error);
//         return false;
//     }
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



module.exports = { getUserIdToAttendeeIdMapping, getEligibleAttendeesForRefund, createRefundRecord, updateTransactionStatus, markAttendeeAsRefunded, generateOrderID };