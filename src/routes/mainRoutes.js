const express = require('express');
const router = express.Router();
const { getHomePage, getLidWordenCountriesInformation } = require('../controller/mainController');
const passportUser = require('../config/passportUsers');
const userRouter = require('./userRoutes');
const connection = require('../config/database');
const transporter = require('../utilities/mailer');
const { generateToken } = require('../utilities/crypto');
const { updatePdfFields } = require('../middleware/pdf');
const { convertToMySQLDate } = require('../middleware/utils');
const { v4: uuidv4 } = require('uuid'); // Ensure you have the 'uuid' package installed
const Page = require('../models/page');
const sequelize = require('../config/database-pages');
const { ensureAuthenticatedUser, userEnsure2fa } = require('../middleware/auth');
const { webhookVerification, createPayment, refundTransaction } = require('../utilities/mollie');



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



router.get('/create-payment', ensureAuthenticatedUser, userEnsure2fa, createPayment);
router.get('/refund', refundTransaction);
router.post('/webhook', webhookVerification);
// router.post('/redirect', ensureAuthenticatedUser, userEnsure2fa, webhookVerification);



router.get('/contact', (req, res, next) => {
    res.render('contact', { user: req.user });
});

router.use('/mijn-realtime', userRouter);

router.get('/mijn-realtime', (req, res) => {
    res.redirect('/mijn-realtime/profiel');
});

router.get('/lid-worden', (req, res) => {
    connection.query('SELECT countries.country_id, countries.country_phone, countries.country_name FROM countries ORDER BY countries.country_name ASC', (error, countries) => {
        if (error) {
            console.error('Error fetching type counts:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.render('lid-worden/lid-worden', {
            user: undefined,
            countries: countries
        });
    });
});

// TEST create pages.

router.get('/create', async (req, res) => {
    try {
        // Fetch all potential parent pages
        const parentPages = await Page.findAll();

        // Render the form
        res.render('page-create', { parentPages });
    } catch (error) {
        console.error('Error fetching parent pages:', error);
        res.status(500).send('Server error');
    }
});



router.post('/create', async (req, res) => {
    try {
        const { title, content, parentId } = req.body;

        let pageData = {
            title: title,
            content: content
        };

        // Check if parentId was provided and is not an empty string
        if (parentId && parentId.trim() !== '') {
            pageData.parentId = parseInt(parentId, 10);  // Convert string parentId to integer
        }

        await Page.create(pageData);

        res.redirect('/create');
    } catch (err) {
        console.error('Error creating page:', err);
        res.status(500).send('Server Error');
    }
});



// sequelize.sync();

router.get('/page/*', async (req, res) => {
    const slugs = req.params[0].split('/');
    const slug = slugs[slugs.length - 1];

    const page = await Page.findOne({ where: { slug: slug } });
    const pages = await Page.findAll();  // fetch all pages for the navbar

    if (!page) {
        return res.status(404).send('Page not found');
    }

    res.render('layout', { page, pages });
});

// END test create pages

router.post('/lid-worden/direct-debit/download', async (req, res) => {
    const { fullName, iban, bic } = req.body;

    try {
        const updatedPdfBytes = await updatePdfFields({ fullName, iban, bic });

        res.setHeader('Content-Disposition', 'attachment; filename=updated.pdf');
        res.setHeader('Content-Type', 'application/pdf');
        res.end(Buffer.from(updatedPdfBytes));
    } catch (err) {
        res.status(500).send('Error generating PDF: ' + err.message);
    }
});

router.post('/lid-worden/personalia', (req, res) => {
    let { email, studentNumber, gender, dateOfBirth, initials, firstName, lastNamePrefix, lastNameMain, phoneHome, address, zip, city, country, iban, bic } = req.body;

    // Convert dateOfBirth to MySQL format
    dateOfBirth = convertToMySQLDate(dateOfBirth);

    // Check if email is already in use
    connection.query('SELECT * FROM Members WHERE emailadres = ?', [email], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Server error');
        }

        if (results.length) {
            return res.json({ emailInUse: true });
        }


        // Generate a UUID in Node.js
        const generatedUUID = uuidv4();

        // Insert into address_info table first

        connection.query('INSERT INTO address_info (id, street_address, postal_code, city, country_id) VALUES (?, ?, ?, ?, ?)', [generatedUUID, address, zip, city, country], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).send('Server error while inserting address');
            }

            // Now insert into Members table using the generatedUUID as address_id
            connection.query('INSERT INTO Members (initials, first_name, primary_last_name_prefix, primary_last_name_main, geslacht, geboortedatum, emailadres, studentnummer, vaste_telefoon, address_id, iban, bic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [initials, firstName, lastNamePrefix, lastNameMain, gender, dateOfBirth, email, studentNumber, phoneHome, generatedUUID, iban, bic], (error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Server error while inserting member');
                }

                res.json({ success: true });
            });
        });

    });
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
        req.session.destroy();
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
        connection.query('UPDATE `Members` SET verification_token = ?, token_expiration_date = ? WHERE emailadres = ?', [token, expirationDate, user.emailadres], async function (error) {
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
