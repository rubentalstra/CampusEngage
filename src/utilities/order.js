const query = require('../config/database-all');
const { generateOrderID } = require('../controller/mollie/functions');
const { createMolliePayment } = require('./mollie');


async function createOrder(req, res) {

    console.log('test');
    try {
        const EventID = req.params.EventID;
        const MemberID = req.user.id;

        console.log(MemberID);

        if (!EventID) {
            return res.status(400).send('EventID is required');
        }

        const orderId = await generateOrderID();
        const description = await getEventDescription(EventID);

        if (!description) {
            return res.status(404).send('Event not found');
        }

        console.log(req.body);

        // If you're expecting JSON data in the attendees field:
        const attendees = JSON.parse(req.body.attendees || '[]');
        console.log(attendees);

        /**
        * Represents an order for tickets.
        * @typedef {Object} order
        * 
        * @property {number} OrderID - The unique identifier for the order.
        * @property {number} MemberID - The unique identifier for the member placing the order.
        * @property {number} EventID - The unique identifier for the event for which the tickets are being ordered.
        * @property {string} Description - A description of the order.
        * @property {string} addressee - The name of the person to whom the order is addressed.
        * @property {string} email - The email address of the addressee.
        * @property {string} address_address - The address of the addressee.
        * @property {string} address_zip - The postal code of the addressee's address.
        * @property {string} address_city - The city of the addressee's address.
        * @property {string} address_country - The country of the addressee's address.
        * @property {?string} invoice_reference - Reference for the invoice, e.g., PO-number or cost center (optional).
        * @property {string} Currency - The currency in which the order is placed. Should be 'EUR'.
        * @property {Array.<Attendee>} Attendees - An array of objects representing the attendees.
        * 
        * @typedef {Object} Attendee
        * @property {number} TicketID - The unique identifier for the ticket.
        * @property {?string} GuestName - The name of the guest attending (if applicable, otherwise null).
        */
        const order = {
            OrderID: orderId,
            MemberID: MemberID,
            EventID: EventID,
            Description: description,
            addressee: req.body.addressee,
            email: req.body.email,
            address_address: req.body.address_address,
            address_zip: req.body.address_zip,
            address_city: req.body.address_city,
            address_country: req.body.address_country,
            invoice_reference: req.body.invoice_reference ?? null,
            Currency: 'EUR',
            Attendees: attendees
        };

        console.log(order);
        // const order = {
        //     OrderID: orderId,
        //     MemberID: MemberID,
        //     EventID: EventID,
        //     Description: description,
        //     Currency: 'EUR',
        //     Attendees: [
        //         { TicketID: 1, GuestName: null },
        //         { TicketID: 2, GuestName: 'Test' },
        //         { TicketID: 2, GuestName: 'Test' },
        //     ]
        // };


        await createOrderRecord(order);
        await createAttendees(order, res);
        const amount = await getTotalSumFromAttendees(order);

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
            'INSERT INTO Orders (OrderID, EventID, MemberID, addressee, email, address_address, address_zip, address_city, address_country, invoice_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [order.OrderID, order.EventID, order.MemberID, order.addressee, order.email, order.address_address, order.address_zip, order.address_city, order.address_country, order.invoice_reference]
        );
        return;
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createAttendees(order, res) {
    try {
        for (const attendee of order.Attendees) {
            const insertSql = 'INSERT INTO Attendees (OrderID, TicketID, MemberID, GuestName) VALUES (?, ?, ?, ?)';
            await query(insertSql, [order.OrderID, attendee.TicketID, order.MemberID, attendee.GuestName]);
        }
    } catch (error) {
        res.status(500).send('Internal Server Error');
        console.error(error);
        return;
    }
}


async function getTotalSumFromAttendees(order) {
    try {
        const totalSum = await query(`
        SELECT SUM(Tickets.Price) AS 'amount' FROM Attendees 
        LEFT JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
        WHERE OrderID = ?`, [order.OrderID]);
        return totalSum[0].amount;
    } catch (error) {
        console.error(error);
        return null;
    }
}


async function createTransaction(order, amount) {
    try {
        await query(`INSERT INTO Transactions (OrderID, Amount, Currency, Status) VALUES (?, ?, ?, 'Open')`,
            [order.OrderID, amount, order.Currency]
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