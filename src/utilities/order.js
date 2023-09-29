const query = require('../config/database-all');
const { generateOrderID } = require('../controller/mollie/functions');
const { createMolliePayment } = require('./mollie');


async function createOrder(req, res) {
    try {
        const EventID = req.params.EventID;

        if (!EventID) {
            return res.status(400).send('EventID is required');
        }

        const orderId = await generateOrderID();
        const description = await getEventDescription(EventID);

        if (!description) {
            return res.status(404).send('Event not found');
        }

        const order = {
            OrderID: orderId,
            MemberID: req.user.id,
            EventID: EventID,
            Description: description,
            Currency: 'EUR',
            OrderRows: [
                // Dummy data, replace with actual order rows
                { Index: 1, TicketID: 1, MemberID: req.user.id, GuestName: null },
                { Index: 2, TicketID: 2, MemberID: null, GuestName: 'Test' },
                { Index: 3, TicketID: 2, MemberID: null, GuestName: 'Test' },
            ]
        };

        await createOrderRecord(order);
        await createOrderRows(order, res);
        const amount = await getTotalSumFromOrderRows(order);

        if (amount == null) {
            // If the amount is 0 then we send a email for entering a free event.
            return res.status(500).send('Error calculating total order amount');
        }

        await createTransaction(order, amount);
        return createMolliePayment(order, amount, req, res);
    } catch (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
    }
}

async function createOrderRecord(order) {
    try {
        await query(
            'INSERT INTO Orders (OrderID, EventID, MemberID) VALUES (?, ?, ?)',
            [order.OrderID, order.EventID, order.MemberID]
        );
        return;
    } catch (error) {
        console.error(error);
        return null;
    }
}



async function createOrderRows(order, res) {
    try {
        for (const [index, element] of order.OrderRows.entries()) {
            // Insert OrderRow into the database
            const insertSql = 'INSERT INTO OrderRows (OrderRows.OrderID, OrderRows.Index, OrderRows.TicketID, OrderRows.MemberID, OrderRows.GuestName) VALUES (?, ?, ?, ?, ?)';
            await query(insertSql, [order.OrderID, index, element.TicketID, element.MemberID, element.GuestName]);
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
        console.error(error);
        return;
    }
}



async function getTotalSumFromOrderRows(order) {
    try {
        const totalSum = await query(`
        SELECT SUM(Tickets.Price) AS 'amount' FROM OrderRows 
        LEFT JOIN Tickets ON OrderRows.TicketID = Tickets.TicketID
        WHERE OrderID = ?`, [order.OrderID]);
        return totalSum[0].amount;  // return event data
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createTransaction(order, amount) {
    try {
        await query(`INSERT INTO Transactions (OrderID, MemberID, Amount, Currency, Status) VALUES (?, ?, ?, ?, 'Open')`,
            [order.OrderID, order.MemberID, amount, order.Currency]
        );
        return;  // return ID of the new record
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function getEventDescription(EventID) {
    try {
        const result = await query(`SELECT Events.Name AS 'Description' from Events where Events.EventID = ?`, [EventID]);
        return result[0].Description;  // return event data
    } catch (error) {
        console.error(error);
        return null;
    }
}


module.exports = { createOrder };