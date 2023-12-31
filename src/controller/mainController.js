const connection = require('../config/database');
const query = require('../config/database-all');
const stripAndShortenHTML = require('../utilities/stripAndShortenHTML');

exports.getHomePage = (req, res) => {
  // if (req.isAuthenticated()) {
  //     // If they are authenticated, redirect to user-dashboard
  //     return res.redirect('/user/user-dashboard');
  // }

  // If not authenticated, show the home page
  return res.send('<h1>Home</h1><p>Please <a href="/user/register">register</a></p>');
};


exports.getLidWordenCountriesInformation = (req, res) => {
  connection.query('SELECT countries.country_id, countries.country_phone, countries.country_name FROM countries ORDER BY countries.country_name ASC', (error, countries) => {
    if (error) {
      console.error('Error fetching type counts:', error);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    return countries;
  });
};


exports.getEvents = async (req, res) => {
  try {
    const events = await query(`
  SELECT
    Events.*,
    EventCategories.EventCategoryName,
    COUNT(Attendees.AttendeeID) AS 'Attendees'
  FROM
    Events
    LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID
    LEFT JOIN Tickets ON Events.EventID = Tickets.EventID
    LEFT JOIN Attendees ON Tickets.TicketID = Attendees.TicketID AND Attendees.Refunded = 0
  WHERE
    EndDateTime > NOW()
    AND Published = "published"
  GROUP BY
    EventID
  ORDER BY
    StartDateTime ASC
    `);
    // Process each event's Notes field
    const processedEvents = events.map(event => {
      // Apply the stripAndShortenHTML function to the Notes field
      const processedNotes = stripAndShortenHTML(event.Notes || '');

      // Return the event with the processed Notes
      return {
        ...event,
        Notes: processedNotes
      };
    });

    // Send the processed events as the response
    return processedEvents;
  } catch (error) {
    console.error('Error fetching Events:', error);
    res.status(500).json({ error: 'Internal Server Error' });
    return;
  }
};


exports.getEventDetails = async (req, res) => {

  const EventID = req.params.EventID;

  try {
    const result = await query(`
    SELECT Events.*, EventCategories.EventCategoryName FROM Events 

LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID

WHERE EventID = ?`,
      [EventID]
    );
    return result[0];  // return ID of the new record
  } catch (error) {
    console.error(error);
    return null;
  }
};

exports.getEventDetails = async (req, res) => {

  const EventID = req.params.EventID;

  try {
    const result = await query(`
    SELECT Events.*, EventCategories.EventCategoryName FROM Events 

LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID

WHERE EventID = ?`,
      [EventID]
    );
    return result[0];  // return ID of the new record
  } catch (error) {
    console.error(error);
    return null;
  }
};


exports.getAttendanceForEvent = async (req, res) => {

  const EventID = req.params.EventID;

  try {
    const result = await query(`
    SELECT
    CONCAT(Members.initials, ' (', Members.first_name, ') ', Members.primary_last_name_prefix, Members.primary_last_name_main) AS 'Member',
    COUNT(Attendees.AttendeeID) as 'Tickets'
FROM
    Attendees
INNER JOIN
    Members ON Attendees.MemberID = Members.id
LEFT JOIN
    Orders ON Attendees.OrderID = Orders.OrderID
LEFT JOIN
    Transactions ON Transactions.OrderID = Orders.OrderID
WHERE
    Orders.EventID = ?
    AND Attendees.MemberID IS NOT NULL
    AND (Transactions.RefundStatus IS NULL OR Transactions.RefundStatus NOT IN ('Refunded', 'Processing', 'Queued', 'Pending', 'Failed', 'Canceled'))
    AND Attendees.Refunded = 0
GROUP BY
    Attendees.OrderID, Attendees.MemberID;`,
      [EventID]
    );
    return result;  // return ID of the new record
  } catch (error) {
    console.error(error);
    return null;
  }
};

exports.getIfUserHasBoughtTicket = async (req, res) => {
  try {
    const result = await query(`
    SELECT
    DATE_FORMAT(Tickets.CancelableUntil, '%e %b. %Y %H:%i:%s') as CancelableUntil
FROM
    Attendees
LEFT JOIN
    Tickets ON Attendees.TicketID = Tickets.TicketID
INNER JOIN
    Orders ON Attendees.OrderID = Orders.OrderID
INNER JOIN
    Transactions ON Transactions.OrderID = Orders.OrderID
WHERE
    Tickets.EventID = ?
    AND Attendees.MemberID = ?
    AND Attendees.MemberID IS NOT NULL
    AND Transactions.Status = 'Paid'
    AND (Transactions.RefundStatus IS NULL OR Transactions.RefundStatus NOT IN ('Refunded', 'Processing', 'Queued', 'Pending', 'Failed', 'Canceled'))
    AND Attendees.Refunded = 0
LIMIT 1;

`,
      [req.params.EventID, req.user.id]
    );
    return result[0];  // return ID of the new record
  } catch (error) {
    console.error(error);
    return null;
  }
};


exports.getMyTicketsForEvent = async (req, res) => {

  const EventID = req.params.EventID;

  try {
    const result = await query(`
    SELECT
        Attendees.*, CONCAT(Members.initials, ' (', Members.first_name, ') ', Members.primary_last_name_prefix, Members.primary_last_name_main) AS 'Member'
    FROM
        Attendees
        LEFT JOIN Tickets ON Attendees.TicketID = Tickets.TicketID
        INNER JOIN Members ON Attendees.MemberID = Members.id
    WHERE
        EventID = ?
        AND MemberID = ?
        AND Refunded = 0`,
      [EventID, req.user.id]
    );
    return result;  // return ID of the new record
  } catch (error) {
    console.error(error);
    return null;
  }
};