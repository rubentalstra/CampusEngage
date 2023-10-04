const query = require('../config/database-all');




exports.getEventsTicketsPage = async (req, res) => {

    const EventID = req.params.EventID;
    const BuyerID = req.user.id;

    try {
        const result = await query(`
        SELECT
        Attendees.BuyerID
    FROM
        Attendees
        JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
    WHERE
        Tickets.EventID = ?
        AND Attendees.BuyerID = ?
        AND Attendees.GuestName IS NULL
        AND Attendees.Refunded = 0
      `,
            [EventID, BuyerID]
        );

        return res.render('evenementen/confirm', { hasTicket: result[0] ?? null, nonce: res.locals.cspNonce });
        // return result[0];  // return ID of the new record
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }


};