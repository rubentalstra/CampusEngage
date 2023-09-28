const query = require('../config/database-all');
const { generateOrderID } = require('../controller/mollie/functions');








async function createOrder(req, res) {


    const orderId = await generateOrderID();


    const order = {
        OrderID: orderId,
        MemberID: req.user.id,
        EventID: 1,
        OrderRows: [
            { Index: 1, TicketID: 1, MemberID: req.user.id, GuestName: null },
            { Index: 2, TicketID: 2, MemberID: null, GuestName: 'Test' },
            { Index: 3, TicketID: 2, MemberID: null, GuestName: 'Test' },
        ]
    };

    // First Create the Main Order
    await createOrderRecord(order);

    // after the creation of the Order we can create the Order Rows
    await createOrderRows(order);

    // After this we can we can prepair the payment to be send the the mollie functions. 
    // TODO when the payment is created the transationID needs to be in the OrderRecord (it's an INT)


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



async function createOrderRows(order) {
    try {
        for (let index = 0; index < order.OrderRows.length; index++) {
            const element = order.OrderRows[index];

            await query(
                'INSERT INTO OrderRows (OrderID, EventID, Index, TicketID, MemberID, GuestName) VALUES (?, ?, ?, ?, ?, ?)',
                [element.OrderID, element.EventID, index, element.TicketID, element.MemberID, element.GuestName]
            );
            continue;
        }
        return;
    } catch (error) {
        console.error(error);
        return null;
    }
}




async function createTransation(transactionID, refundPaymentID, amount, RefundStatus) {
    try {


        // Extract relevant information from the ticket type
        const ticketType = ticketTypeResult[0];
        const amount = ticketType.Price; // make sure this is in the correct format
        const currency = 'EUR'; // you might need to adjust this based on your requirements
        const description = ticketType.Description;


        const result = await query(`INSERT INTO Transactions (TicketID, MemberID, OrderID, Amount, Currency, Status) VALUES (?, ?, ?, ?, ?, 'Open')`,
            [transactionID, orderId, refundPaymentID, amount, RefundStatus]
        );
        return result.insertId;  // return ID of the new record
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createTransation(order) {
    try {


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
         INSERT INTO Transactions (TicketID, MemberID, OrderID, Amount, Currency, Status)
         VALUES (?, ?, ?, ?, ?, 'Open');
        `;
        await query(insertTransactionSql, [ticketTypeId, req.user.id, orderId, amount, currency]);



        for (let index = 0; index < order.OrderRows.length; index++) {
            const element = order.OrderRows[index];

            await query(
                'INSERT INTO OrderRows (OrderID, EventID, Index, TicketID, MemberID, GuestName) VALUES (?, ?, ?, ?, ?, ?)',
                [element.OrderID, element.EventID, index, element.TicketID, element.MemberID, element.GuestName]
            );
            continue;
        }
        return;
    } catch (error) {
        console.error(error);
        return null;
    }
}