const express = require('express');
const router = express.Router();
const { getHomePage } = require('../controller/mainController');
const userRouter = require('./userRoutes');
const adminRouter = require('./adminRoutes');




router.get('/', getHomePage);

router.use('/user', userRouter);
router.use('/admin', adminRouter);



router.get('/session-hijacking', (req, res, next) => {
    res.send('Nice try :)');
});




// router.get('/protected-route', isAuth, ensure2fa, (req, res, next) => {

//     res.send('<h1>You are authenticated</h1><p><a href="/logout">Logout and reload</a></p>');
// });


router.get('/notAuthorized', (req, res, next) => {
    console.log('Inside get');
    res.send('<h1>You are not authorized to view the resource </h1><p><a href="/login">Retry Login</a></p>');

});
router.get('/notAuthorizedAdmin', (req, res, next) => {
    console.log('Inside get');
    res.send('<h1>You are not authorized to view the resource as you are not the admin of the page  </h1><p><a href="/login">Retry to Login as admin</a></p>');

});
router.get('/userAlreadyExists', (req, res, next) => {
    console.log('Inside get');
    res.send('<h1>Sorry This username is taken </h1><p><a href="/register">Register with different username</a></p>');

});

// ... (all other routes)

module.exports = router;
