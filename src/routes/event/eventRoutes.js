const express = require('express');
const { ensureAuthenticatedUser, userEnsure2fa } = require('../../middleware/auth');
const { getCalendarJson } = require('../../controller/user/api');
const { createOrder } = require('../../utilities/order');
const { getMyTicketsForEvent, getEventDetails, getAttendanceForEvent, getIfUserHasBoughtTicket, getEvents } = require('../../controller/mainController');
const { createRefundPayment } = require('../../utilities/mollie');
const { getEventsTicketsPage } = require('../../controller/eventController');
const router = express.Router();


function eventRouter(settings) {

    router.get('/', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
        const events = await getEvents(req, res);
        res.render('evenementen', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user ?? undefined, events: events });
    });


    router.get('/calendar', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
        res.render('evenementen/calendar', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user ?? undefined });
    });
    router.get('/calendar/json', ensureAuthenticatedUser, userEnsure2fa, getCalendarJson);



    router.get('/:EventID', ensureAuthenticatedUser, userEnsure2fa, async (req, res) => {
        const [eventDetails, attendance, CancelableUntil] = await Promise.all([getEventDetails(req, res), getAttendanceForEvent(req, res), getIfUserHasBoughtTicket(req, res)]);
        res.render('evenementen/details', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user ?? undefined, eventDetails: eventDetails, attendance: attendance, cancelDate: CancelableUntil });
    });



    router.get('/:EventID/tickets', ensureAuthenticatedUser, userEnsure2fa, getEventsTicketsPage);
    // router.get('/:EventID/sign-up', ensureAuthenticatedUser, userEnsure2fa, createOrder);
    router.post('/:EventID/sign-up', ensureAuthenticatedUser, userEnsure2fa, createOrder);



    router.get('/:EventID/participation/cancel', async (req, res) => {
        const attendees = await getMyTicketsForEvent(req, res);
        res.render('evenementen/tickets', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user ?? undefined, attendees: attendees, EventID: req.params.EventID });
    });
    router.post('/:EventID/participation/cancel', ensureAuthenticatedUser, userEnsure2fa, createRefundPayment);


    // router.get('/createOrder', ensureAuthenticatedUser, userEnsure2fa, createOrder);
    // router.get('/create-payment', ensureAuthenticatedUser, userEnsure2fa, createPayment);
    // router.get('/refund', createRefundPayment);
    // router.post('/redirect', ensureAuthenticatedUser, userEnsure2fa, webhookVerification);




    // ... (all other routes)

    return router;
}

module.exports = eventRouter;
