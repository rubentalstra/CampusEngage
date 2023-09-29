-- SELECT * FROM Events WHERE EndDateTime > NOW() AND Published = 'published' ORDER BY StartDateTime ASC


-- select *, Transactions.* from TicketTypes


-- left join Transactions ON TicketTypes.TicketTypeID = Transactions.TicketTypeID


-- where TicketTypes.EventID = 1
-- AND (Transactions.Status = 'Paid' AND Transactions.RefundStatus IS NULL)



-- SELECT *, Transactions.* FROM Events 

--  left JOIN TicketTypes ON TicketTypes.EventID = Events.EventID
--  left join Transactions ON TicketTypes.TicketTypeID = Transactions.TicketTypeID AND (Transactions.Status = 'Paid' AND Transactions.RefundStatus IS NULL)

-- WHERE Events.EventID = 1


-- SELECT * from Events where Events.EventID = ?

-- UPDATE Orders SET TransactionID = ? WHERE OrderID = ?



-- SELECT SUM(Tickets.Price) FROM OrderRows 
-- LEFT JOIN Tickets ON OrderRows.TicketID = Tickets.TicketID
-- WHERE OrderID = '2023-000001'


-- SELECT SUM(Tickets.Price) AS 'amount' FROM OrderRows 
--         LEFT JOIN Tickets ON OrderRows.TicketID = Tickets.TicketID
--         WHERE OrderID = '2023-000001'


-- Working type
-- SELECT COALESCE(CONCAT(Members.initials, ' (' ,Members.first_name, ') ', Members.primary_last_name_prefix , Members.primary_last_name_main ), CONCAT(GuestName, ' (Guest)'))  AS 'Name',  FROM OrderRows


-- LEFT JOIN Members ON OrderRows.MemberID = Members.id
-- left JOIN Orders ON OrderRows.OrderID = Orders.OrderID

-- WHERE Orders.EventID = 1



-- SELECT
--   CONCAT(Members.initials, ' (', Members.first_name, ') ', Members.primary_last_name_prefix, Members.primary_last_name_main) AS 'Member',
--   (SELECT COUNT(*) FROM OrderRows sub WHERE sub.OrderID = OrderRows.OrderID) as 'Number of Tickets'
-- FROM
--   OrderRows
-- INNER JOIN
--   Members ON OrderRows.MemberID = Members.id
-- LEFT JOIN
--   Orders ON OrderRows.OrderID = Orders.OrderID
-- WHERE
--   Orders.EventID = 1
--   AND OrderRows.MemberID IS NOT NULL
-- GROUP BY
--   OrderRows.OrderID, OrderRows.MemberID;






SET lc_time_names = 'nl_NL';
  SELECT
    DATE_FORMAT(Tickets.CancelableUntil, '%e %b. %Y %H:%i:%s') as CancelableUntil
  FROM
    OrderRows
    LEFT JOIN Tickets ON OrderRows.TicketID = Tickets.TicketID
  WHERE
	Tickets.EventID = 1
	AND OrderRows.MemberID = 'd25bff46-5b13-11ee-89e1-4ac5fc9f2af2'



SELECT t.CancelableUntil, tr.TransactionID, tr.Status, tr.Amount
            FROM Tickets t
            JOIN OrderRows orr ON t.TicketID = orr.TicketID
            JOIN Orders o ON orr.OrderID = o.OrderID
            JOIN Transactions tr ON o.OrderID = tr.OrderID AND o.MemberID = tr.MemberID
            WHERE o.MemberID = 'd25bff46-5b13-11ee-89e1-4ac5fc9f2af2'
            AND t.EventID = 1
            AND tr.Status = 'Paid'
            AND orr.MemberID IS NOT NULL




-- SELECT Events.*, EventCategories.EventCategoryName FROM Events 

-- LEFT JOIN EventCategories ON Events.EventCategoryID = EventCategories.EventCategoryID

-- WHERE EndDateTime > NOW() AND Published = "published" ORDER BY StartDateTime ASC
 