const express = require('express');
const router = express.Router();
const passportUser = require('../config/passportUsers');
const userRouter = require('./profile/userRoutes');
const connection = require('../config/database');
const transporter = require('../utilities/mailer');
const { generateToken } = require('../utilities/crypto');
const { updatePdfFields } = require('../middleware/pdf');
const { convertToMySQLDate } = require('../middleware/utils');
const { v4: uuidv4 } = require('uuid'); // Ensure you have the 'uuid' package installed
const Page = require('../models/page');

const path = require('path');
const { ensureAuthenticatedUser, userEnsure2fa } = require('../middleware/auth');

const eventRouter = require('./event/eventRoutes');
const { getCssStyles } = require('../controller/css');
const isValidRedirectURL = require('../utilities/isValidRedirectURL');
const newsRoutes = require('./news/newsRoutes');
const { fetchArticlesForFooter } = require('../controller/news/newsApi');




// Function to initialize router with settings
function initRouter(settings) {

    const getRedirectURL = (req) => {
        // Default behavior
        let redirectTo = `/${settings.profileRoute}/profiel`;

        // Validate the next URL from query parameter
        if (req.query.next && isValidRedirectURL(req.query.next)) {
            redirectTo = req.query.next;
        }
        return redirectTo;
    };


    router.use(async (req, res, next) => {
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
            // console.log(req.session);
            // console.log(req.user);
            req.session.userType = 'user';
            next(); // Proceed to the next middleware or route handler
        }
    });


    const commonFieldsMiddleware = async (req, res, next) => {

        const footerNews = await fetchArticlesForFooter(req, res);

        res.locals.commonFields = {
            settings: settings,
            footerNews: footerNews,
            nonce: res.locals.cspNonce, // Assuming this is set in another middleware
            user: req.user // Assuming this is set in another middleware
        };
        next();
    };

    router.use(commonFieldsMiddleware);




    router.get('/', async (req, res, next) => {
        res.render('index', res.locals.commonFields);
    });


    router.get('/styles.css', getCssStyles);



    router.get('/sponsors/:imageName', (req, res) => {
        const imageName = req.params.imageName;
        return res.sendFile(path.join(__dirname, '../../uploads/sponsors/', path.basename(imageName)));
    });

    // START EVENTS
    router.use('/evenementen', ensureAuthenticatedUser, userEnsure2fa, eventRouter);
    // END EVENTS

    // START NEWS
    router.use('/nieuws', newsRoutes);
    // END NEWS



    router.get('/contact', (req, res, next) => {
        res.render('contact', {
            ...res.locals.commonFields
        });
    });

    router.use(`/${settings.profileRoute}`, userRouter);

    router.get(`/${settings.profileRoute}`, (req, res) => {
        res.redirect(`/${settings.profileRoute}/profiel`);
    });

    router.get('/lid-worden', (req, res) => {
        connection.query('SELECT countries.country_id, countries.country_phone, countries.country_name FROM countries ORDER BY countries.country_name ASC', (error, countries) => {
            if (error) {
                console.error('Error fetching type counts:', error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            res.render('lid-worden/lid-worden', {
                ...res.locals.commonFields,
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
            res.render('page-create', { ...res.locals.commonFields, parentPages });
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

        res.render('layout', { ...res.locals.commonFields, page, pages });
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
            // const generatedUUID = uuidv4();

            connection.query('INSERT INTO Members (initials, first_name, primary_last_name_prefix, primary_last_name_main, geslacht, geboortedatum, emailadres, studentnummer, vaste_telefoon, street_address, postal_code, city, iban, bic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [initials, firstName, lastNamePrefix, lastNameMain, gender, dateOfBirth, email, studentNumber, phoneHome, address, zip, city, country, iban, bic], (error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Server error while inserting member');
                }

                res.json({ success: true });
            });

        });
    });


    router.get('/login', (req, res, next) => {
        // If the user doesn't have 2FA or has already verified it, proceed to the intended path or default
        if (req.user && (!req.user.hasFA || req.session.is2faVerified)) {
            return res.redirect(getRedirectURL(req));
        }

        // If none of the above conditions met, Go to Login Page
        res.render('login', { ...res.locals.commonFields, next: req.query.next });
    });


    router.post('/login', passportUser.authenticate('local-user', {
        failureRedirect: '/login-failure',
        failureFlash: true
    }), (req, res, next) => {
        // Redirect to /login-success with the next parameter if authentication was successful
        if (req.isAuthenticated()) {
            return res.redirect(`/login-success?next=${encodeURIComponent(req.query.next || '')}`);
        }
        // If not authenticated, handle accordingly (e.g., send a failure message or redirect)
        res.redirect('/login-failure');
    });

    router.get('/login-success', ensureAuthenticatedUser, (req, res, next) => {

        // If the user doesn't have 2FA or has already verified it, proceed to the intended path or default
        if (!req.user.hasFA || req.session.is2faVerified) {
            return res.redirect(getRedirectURL(req));
        }

        // If none of the above conditions met, prompt for 2FA
        res.redirect(`/${settings.profileRoute}/prompt-2fa`);
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
        res.render('reset-password', { ...res.locals.commonFields });
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
                    text: `Dear ${user.first_name}, please click on the link to set up your password: ${process.env.MOLLIE_URL}/${settings.profileRoute}/set-password?token=${token}`
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
        res.render('register', { ...res.locals.commonFields });

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

            res.redirect(`/${settings.profileRoute}/pending-approval`);
        });

    });

    router.get('/pending-approval', (req, res) => {
        res.render(`my-profile/pending-approval`, { ...res.locals.commonFields });
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

    router.use((err, req, res, next) => {
        console.error(err.stack);  // log the error stack in your server console
        res.status(500).send(err.stack);
    });


    return router;
}

// ... (all other routes)

module.exports = initRouter;
