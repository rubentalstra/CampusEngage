const ics = require('ics');
const query = require('../../config/database-all');
const stripAndShortenHTML = require('../../utilities/stripAndShortenHTML');


exports.fetchEventsForFooter = async (req, res) => {
    try {
        const articles = await query('SELECT url, title, image_path, date FROM newsArticles ORDER BY date DESC LIMIT 4');


        return articles;
    } catch (dbError) {
        console.error(dbError);
        return [];
        // res.status(500).send('Error occurred while updating payment status in database');
    }
};



exports.getCalendarJson = async (req, res) => {

    try {
        const startDate = req.query.start;
        const endDate = req.query.end;

        // Your SQL query with a WHERE condition to filter events by date
        const sql = `
            SELECT Events.*, EventCategories.EventCategoryName 
            FROM Events 
            LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID
            WHERE Published = "published" 
            AND StartDateTime BETWEEN ? AND ?
            ORDER BY StartDateTime ASC`;

        const results = await query(sql, [startDate, endDate]);
        // Format the data as needed
        const formattedResults = results.map(event => ({
            allDay: event.AllDay,
            color: '#e50045',
            end: event.EndDateTime,
            start: event.StartDateTime,
            textColor: '#ffffff',
            title: event.Name,
            url: `/evenementen/${event.EventID}` // Adjust the URL as needed
        }));

        // Send the formatted data as a JSON response
        res.json(formattedResults);


    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



exports.getEventIcal = async (req, res) => {

    const eventsData = await query(`SELECT * from Events WHERE EndDateTime < CURRENT_TIMESTAMP`);

    if (!eventsData) { return; }


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
            url: `https://localhost/evenementen/${event.EventID}`
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