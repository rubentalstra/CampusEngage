const express = require('express');
const { ensureAuthenticatedUser, userEnsure2fa } = require('../../middleware/auth');
const { getCalendarJson } = require('../../controller/user/api');
const { createOrder } = require('../../utilities/order');
const { getMyTicketsForEvent, getEventDetails, getAttendanceForEvent, getIfUserHasBoughtTicket, getEvents } = require('../../controller/mainController');
const { createRefundPayment } = require('../../utilities/mollie');
const { getEventsTicketsPage, getEventIcal } = require('../../controller/eventController');
const eventRouter = express.Router();


// function eventRouter(settings) {

eventRouter.get('/', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
    const events = await getEvents(req, res);
    res.render('evenementen/index', { ...res.locals.commonFields, events: events });
});


eventRouter.get('/calendar', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
    res.render('evenementen/calendar', { ...res.locals.commonFields });
});
eventRouter.get('/calendar/json', ensureAuthenticatedUser, userEnsure2fa, getCalendarJson);

eventRouter.get('/calendar/ics', ensureAuthenticatedUser, userEnsure2fa, getEventIcal);



eventRouter.get('/:EventID', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
    const [eventDetails, attendance, CancelableUntil] = await Promise.all([getEventDetails(req, res), getAttendanceForEvent(req, res), getIfUserHasBoughtTicket(req, res)]);
    res.render('evenementen/details', { ...res.locals.commonFields, eventDetails: eventDetails, attendance: attendance, cancelDate: CancelableUntil });
});



eventRouter.get('/:EventID/tickets', ensureAuthenticatedUser, userEnsure2fa, getEventsTicketsPage);
eventRouter.post('/:EventID/sign-up', ensureAuthenticatedUser, userEnsure2fa, createOrder);



eventRouter.get('/:EventID/participation/cancel', async (req, res) => {
    const [eventDetails, attendees] = await Promise.all([getEventDetails(req, res), getMyTicketsForEvent(req, res)]);
    res.render('evenementen/tickets', { ...res.locals.commonFields, attendees: attendees, eventDetails: eventDetails });
});
eventRouter.post('/:EventID/participation/cancel', ensureAuthenticatedUser, userEnsure2fa, createRefundPayment);


// router.get('/createOrder', ensureAuthenticatedUser, userEnsure2fa, createOrder);
// router.get('/create-payment', ensureAuthenticatedUser, userEnsure2fa, createPayment);
// router.get('/refund', createRefundPayment);
// router.post('/redirect', ensureAuthenticatedUser, userEnsure2fa, webhookVerification);




// ... (all other routes)

//     return router;
// }

module.exports = eventRouter;
