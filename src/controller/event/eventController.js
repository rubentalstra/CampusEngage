const query = require('../../config/database-all');




exports.getEventsTicketsPage = async (req, res) => {

    const EventID = req.params.EventID;
    const MemberID = req.user.id;

    try {


        const [result, tickets, event, countries, userDetails] = await Promise.all([query(`
        SELECT
        Attendees.MemberID
    FROM
        Attendees
        JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
    WHERE
        Tickets.EventID = ?
        AND Attendees.MemberID = ?
        AND Attendees.GuestName IS NULL
        AND Attendees.Refunded = 0
      `, [EventID, MemberID]),
        query(`SELECT * FROM Tickets WHERE EventID = ?`, [EventID]),
        query(`SELECT * FROM Events WHERE EventID = ?`, [EventID]),
        query('SELECT country_name FROM countries ORDER BY country_name ASC'),
        query(`
        SELECT
            first_name,
            primary_last_name_prefix,
            primary_last_name_main,
            emailadres,
            street_address,
            postal_code,
            city,
            countries.country_name
        FROM
            Members
            LEFT JOIN countries ON Members.country_id = countries.country_id
        WHERE
            Members.id = ?`, [MemberID])
        ]);





        return res.render('evenementen/confirm', { ...res.locals.commonFields, hasTicket: result[0], tickets: tickets, event: event[0], countries: countries, userDetails: userDetails[0] });
        // return result[0];  // return ID of the new record
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }


};
