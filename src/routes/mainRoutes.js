const express = require('express');
const router = express.Router();
const { getHomePage } = require('../controller/mainController');
const passportUser = require('../config/passportUsers');
const userRouter = require('./userRoutes');
const connection = require('../config/database');
const transporter = require('../utilities/mailer');
const { generateToken } = require('../utilities/crypto');


router.use((req, res, next) => {
    if (!req.session.userAgent) {
        req.session.userAgent = req.headers['user-agent'];
    }

    if (req.session.userAgent !== req.headers['user-agent']) {
        // Possible session hijacking, take appropriate action
        req.logout(function (err) {
            if (err) { return next(err); }
            req.session.destroy(function (err) {
                if (err) { return next(err); }
                res.redirect('/session-hijacking');
            });
            return;  // This is crucial, as you don't want any code after this block to run if a session is hijacked
        });
    } else {
        console.log(req.session);
        console.log(req.user);
        req.session.userType = 'user';
        next(); // Proceed to the next middleware or route handler
    }
});



router.get('/', (req, res, next) => {
    res.render('index', { user: req.user });
});

router.get('/contact', (req, res, next) => {
    res.render('contact', { user: req.user });
});

router.use('/mijn-realtime', userRouter);

router.get('/mijn-realtime', (req, res) => {
    res.redirect('/mijn-realtime/profiel');
});



router.get('/login', (req, res, next) => {
    res.render('login', { user: undefined });
});

// Adjusting the login success route:
router.post('/login', passportUser.authenticate('local-user', {
    failureRedirect: '/login-failure',
    successRedirect: '/mijn-realtime/prompt-2fa',
    failureFlash: true
}), (req, res, next) => {
    req.session.regenerate(function (err) {
        // will have a new session here
        res.redirect('/mijn-realtime/prompt-2fa');
    });
});



router.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

// Logout redirection adjustment:
router.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        req.session.is2faVerified = false;
        res.redirect('/');
    });
});

router.get('/password/forgot', (req, res) => {
    res.render('reset-password', { user: undefined });
});

router.post('/password/forgot', (req, res) => {
    const email = req.body.email;

    // Check if the user is active and fetch the email address
    connection.query('SELECT first_name, emailadres, status FROM Members WHERE emailadres = ?', [email], async function (error, results) {
        if (error || results.length === 0) {
            console.error('Error fetching user data:', error);
            return res.status(500).send('Error sending password setup email');
        }

        const user = results[0];

        if (user.status !== 'active') {
            return res.status(400).send('User is not active');
        }

        // Step 1: Generate a token
        const token = generateToken();
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 1);  // Token expires in 1 hour

        // Step 2: Save the token in the database with the user
        connection.query('UPDATE users SET verification_token = ?, token_expiration_date = ? WHERE emailadres = ?', [token, expirationDate, user.emailadres], async function (error) {
            if (error) {
                console.error('Error storing token:', error);
                return res.status(500).send('Error sending password setup email');
            }

            // Step 3: Send the email to the user
            const mailOptions = {
                from: 'rubentalstra1211@outlook.com',
                to: user.emailadres,
                subject: 'Reset Your Password',
                text: `Dear ${user.first_name}, please click on the link to set up your password: https://localhost:8443/mijn-realtime/set-password?token=${token}`
            };

            try {
                const info = await transporter.sendMail(mailOptions);
                console.log('Message sent: %s', info.messageId);
                res.status(200).send('Password setup email sent successfully');
            } catch (mailError) {
                console.error('Error sending email:', mailError);
                res.status(500).send('Error sending password setup email');
            }
        });
    });
});



router.get('/register', (req, res, next) => {
    console.log('Inside get');
    res.render('register');

});


router.post('/register', (req, res) => {
    const {
        member_type_id,
        first_name,
        initials,
        primary_last_name_prefix,
        primary_last_name_main,
        geslacht,
        geboortedatum,
        emailadres,
        mobiele_telefoon,
        vaste_telefoon,
        iban,
        bic,
        sepa_machtiging_date,
        sepa_referentie,
        studentnummer
    } = req.body;

    const now = new Date();

    connection.query('INSERT INTO users(member_type_id, status, first_name, initials, primary_last_name_prefix, primary_last_name_main, geslacht, geboortedatum, emailadres, mobiele_telefoon, vaste_telefoon, iban, bic, sepa_machtiging_date, sepa_referentie, studentnummer, lid_sinds) VALUES (?, "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        member_type_id,
        first_name,
        initials,
        primary_last_name_prefix,
        primary_last_name_main,
        geslacht,
        geboortedatum,
        emailadres,
        mobiele_telefoon,
        vaste_telefoon,
        iban,
        bic,
        sepa_machtiging_date,
        sepa_referentie,
        studentnummer,
        now
    ], function (error, results) {
        if (error) {
            console.error('Error occurred:', error);
            return res.status(500).send('Registration failed');
        }

        res.redirect('/mijn-realtime/pending-approval');
    });

});

router.get('/pending-approval', (req, res) => {
    res.render('mijn-realtime/pending-approval');
});



router.get('/session-hijacking', (req, res, next) => {
    res.send('Nice try :)');
});





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
