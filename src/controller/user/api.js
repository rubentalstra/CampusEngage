const query = require('../../config/database-all');

exports.getCalendarJson = async (req, res) => {

    try {

        // Insert OrderRow into the database
        const sql = `SELECT Events.*, EventCategories.EventCategoryName FROM Events 

        LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID
        
        WHERE Published = "published" ORDER BY StartDateTime ASC`;
        const results = await query(sql);

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
