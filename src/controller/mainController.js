const connection = require('../config/database');
const query = require('../config/database-all');

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
    SELECT Events.*, EventCategories.EventCategoryName FROM Events 

    LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID
    
    WHERE EndDateTime > NOW() AND Published = "published" ORDER BY StartDateTime ASC`
    );
    return events;  // return ID of the new record
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
    (SELECT COUNT(*) FROM OrderRows sub WHERE sub.OrderID = OrderRows.OrderID) as 'Tickets'
FROM
    OrderRows
INNER JOIN
    Members ON OrderRows.MemberID = Members.id
LEFT JOIN
    Orders ON OrderRows.OrderID = Orders.OrderID
INNER JOIN
    Transactions ON Transactions.OrderID = Orders.OrderID
WHERE
    Orders.EventID = ?
    AND OrderRows.MemberID IS NOT NULL
    AND (Transactions.RefundStatus IS NULL OR Transactions.RefundStatus NOT IN ('Refunded', 'Processing', 'Queued', 'Pending', 'Failed', 'Canceled'))
GROUP BY
    OrderRows.OrderID, OrderRows.MemberID;`,
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
    OrderRows
LEFT JOIN
    Tickets ON OrderRows.TicketID = Tickets.TicketID
INNER JOIN
    Orders ON OrderRows.OrderID = Orders.OrderID
INNER JOIN
    Transactions ON Transactions.OrderID = Orders.OrderID
WHERE
    Tickets.EventID = ?
    AND OrderRows.MemberID = ?
    AND OrderRows.MemberID IS NOT NULL
    AND Transactions.Status = 'Paid'
    AND (Transactions.RefundStatus IS NULL OR Transactions.RefundStatus NOT IN ('Refunded', 'Processing', 'Queued', 'Pending', 'Failed', 'Canceled'))
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