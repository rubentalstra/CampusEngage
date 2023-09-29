const query = require('../config/database-all');
const { generateOrderID } = require('../controller/mollie/functions');
const { createMolliePayment } = require('./mollie');




async function createOrder(req, res) {
    const EventID = req.params.EventID;
    // const EventID = 1;


    const orderId = await generateOrderID();
    const description = await getEventDescription(EventID);


    // Create the JSON Template here.
    const order = {
        OrderID: orderId,
        MemberID: req.user.id,
        EventID: EventID,
        Description: description,
        Currency: 'EUR',
        OrderRows: [
            { Index: 1, TicketID: 1, MemberID: req.user.id, GuestName: null },
            { Index: 2, TicketID: 2, MemberID: null, GuestName: 'Test' },
            { Index: 3, TicketID: 2, MemberID: null, GuestName: 'Test' },
        ]
    };

    // First Create the Main Order
    await createOrderRecord(order);

    // after the creation of the Order we can create the Order Rows
    await createOrderRows(res, order);

    const amount = await getTotalSumFromOrderRows(order);

    await createTransation(order, amount);

    return createMolliePayment(req, res, order, amount);
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



async function createOrderRows(res, order) {
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


async function createTransation(order, amount) {
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