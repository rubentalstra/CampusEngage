const query = require('../config/database-all');
const ics = require('ics');
const stripAndShortenHTML = require('../utilities/stripAndShortenHTML');




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



exports.getEventIcal = async (req, res) => {

    const eventsData = await query(`SELECT * from Events WHERE StartDateTime > CURRENT_TIMESTAMP`);


    const processedEvents = eventsData.map(event => {
        // Apply the stripAndShortenHTML function to the Notes field
        const processedNotes = stripAndShortenHTML(event.Notes || '');

        // Return the event with the processed Notes
        return {
            ...event,
            Notes: processedNotes
        };
    });


    // Convert them to iCal format
    const icalEvents = processedEvents.map(event => {
        const start = new Date(event.StartDateTime);
        const end = new Date(event.EndDateTime);
        return {
            start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
            end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
            title: event.Name,
            description: event.Notes,
            // url: event.url
            url: `/evenementen/${event.EventID}`
        };
    });

    ics.createEvents(icalEvents, (error, value) => {
        if (error) {
            console.log(error);
            res.status(500).send('Error generating iCal file');
        } else {
            res.setHeader('Content-Type', 'text/calendar');
            res.setHeader('Content-Disposition', 'attachment; filename=events.ics');
            res.send(value);
        }
    });

};