const express = require('express');
const { Totp } = require('time2fa');
const qrcode = require('qrcode');
const passportAdmins = require('../config/passportAdmins');
const connection = require('../config/database');
const { generateToken, genPassword } = require('../utilities/crypto');
const { isAuth, ensureAuthenticatedAdmin, adminEnsure2fa } = require('../middleware/auth');

const transporter = require('../utilities/mailer');
const { getAdminDashboard, getMembersNotActive } = require('../controller/adminController');
const { userExists } = require('../middleware/utils');
const adminRouter = express.Router();

// const { isAuth, ensure2fa } = require('../middleware/auth');
// const { userExists } = require('../middleware/utils');
// const { Totp } = require('time2fa');
// const qrcode = require('qrcode');
// const passport = require('../config/passport');
// const connection = require('../config/database');
// const { genPassword } = require('../utilities/crypto');
// const { getHomePage } = require('../controller/mainController');
// const path = require('path');
// const fs = require('fs');
// const upload = require('../utilities/uploadImage');





adminRouter.use((req, res, next) => {
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
        req.session.userType = 'admin';
        next(); // Proceed to the next middleware or route handler
    }
});

adminRouter.get('/session-hijacking', (req, res, next) => {
    res.send('Nice try :)');
});

// Adjusting the login success route:

adminRouter.get('/login', (req, res, next) => {
    res.render('admin/login');
});

adminRouter.post('/login', passportAdmins.authenticate('local-admin', {
    failureRedirect: '/admin/login-failure',
    successRedirect: '/admin/prompt-2fa',
    failureFlash: true
}), (req, res, next) => {
    req.session.regenerate(function (err) {
        // will have a new session here
        res.redirect('/admin/prompt-2fa');
    });
});

adminRouter.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

// Logout redirection adjustment:
adminRouter.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/admin/login');
    });
});

adminRouter.get('/register', (req, res, next) => {
    console.log('Inside get');
    res.render('admin/register');

});


adminRouter.post('/register', userExists, (req, res, next) => {
    console.log('Inside post');
    console.log(req.body.pw);
    const saltHash = genPassword(req.body.pw);
    console.log(saltHash);
    const salt = saltHash.salt;
    const hash = saltHash.hash;

    connection.query('Insert into admins(username,hash,salt,isAdmin) values(?,?,?,0) ', [req.body.uname, hash, salt], function (error, results, fields) {
        if (error) {
            console.log('Error');
        }
        else {
            console.log('Successfully Entered');
        }

    });

    res.redirect('/admin/login');
});



adminRouter.get('/admin-route', ensureAuthenticatedAdmin, adminEnsure2fa, (req, res, next) => {
    res.send('<h1>You are admin</h1><p><a href="/logout">Logout and reload</a></p>');
});

adminRouter.get('/admin-dashboard', ensureAuthenticatedAdmin, adminEnsure2fa, getAdminDashboard);


adminRouter.get('/administration/members', ensureAuthenticatedAdmin, adminEnsure2fa, getMembersNotActive);

adminRouter.get('/managment/events', ensureAuthenticatedAdmin, adminEnsure2fa, (req, res) => {
    res.render('admin/managment/events/index', { user: req.user });  // This should be a view where the user inputs their current 2FA code to remove it
});


// Endpoint for admin to send password setup email
adminRouter.post('/send-password-setup', (req, res) => {
    const userId = req.body.userId;

    // Step 1: Generate a token
    const token = generateToken();
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1);  // Token expires in 1 hour

    // Step 2: Save the token in the database with the user
    connection.query('UPDATE users SET status = "verified", verification_token = ?, token_expiration_date = ? WHERE id = ?', [token, expirationDate, userId], function (error, results) {
        if (error) {
            console.error('Error storing token:', error);
            return res.status(500).send('Error sending password setup email');
        }

        // Fetch the user's email address
        connection.query('SELECT emailadres FROM Members WHERE id = ?', [userId], async function (error, results) {
            if (error || results.length === 0) {
                console.error('Error fetching user email:', error);
                return res.status(500).send('Error sending password setup email');
            }

            const userEmailAddress = results[0].emailadres;

            // Step 3: Send the email to the user
            const mailOptions = {
                from: 'rubentalstra1211@outlook.com',
                to: userEmailAddress,
                subject: 'Set Up Your Password',
                text: `Dear User, please click on the link to set up your password: https://localhost:8443/mijn-realtime/set-password?token=${token}`
            };

            const info = await transporter.sendMail(mailOptions);

            console.log('Message sent: %s', info.messageId);
            res.status(200).send('Password setup email sent successfully');
        });
    });
});



/**
 * 2FA SETUP
 */


// Endpoint to setup 2FA for a user
adminRouter.get('/setup-2fa', ensureAuthenticatedAdmin, (req, res) => {
    // Generate a new 2FA secret for the user
    const key = Totp.generateKey({ issuer: 'SV-REALTIME-ADMIN', user: req.user.username });

    req.session.temp2fa = key.secret;  // Store it temporarily until confirmed

    // console.log(key);

    qrcode.toDataURL(key.url, (err, dataUrl) => {
        if (err) { return res.render('admin/2fa/setup-2fa', { qrCode: dataUrl, secret: null, error: 'Some error message here' }); }
        res.render('admin/2fa/setup-2fa', { qrCode: dataUrl, secret: key.secret });
    });
});

// Endpoint to verify 2FA token
adminRouter.post('/verify-2fa', ensureAuthenticatedAdmin, (req, res) => {
    const token = req.body.token;

    if (Totp.validate({ passcode: token, secret: req.session.temp2fa })) {
        // Save the 2FA secret in database (make sure it's encrypted or securely stored)
        connection.query('UPDATE admins SET twoFA_secret = ?, hasFA = ? WHERE id = ?', [req.session.temp2fa, 1, req.user.id], function (error) {
            if (error) {
                return res.status(500).send('Error saving 2FA secret');
            }
            req.session.is2faVerified = true;
            delete req.session.temp2fa;
            res.send('2FA setup successfully');
        });
    } else {
        res.status(400).send('Invalid token');
    }
});

// check 2FA
adminRouter.get('/prompt-2fa', ensureAuthenticatedAdmin, (req, res, next) => {
    // if (req.session.is2faVerified) { return res.redirect('/admin/admin-dashboard'); }
    return res.render('admin/2fa/prompt-2fa');
});


// Better error handling for 2FA verification:
adminRouter.post('/check-2fa', ensureAuthenticatedAdmin, (req, res) => {
    const token = req.body.token;

    connection.query('SELECT twoFA_secret FROM admins WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }
        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            req.session.is2faVerified = true;
            res.redirect('/admin/admin-dashboard');
        } else {
            res.render('admin/2fa/prompt-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
});


// remove 2FA

adminRouter.get('/remove-2fa', ensureAuthenticatedAdmin, (req, res) => {
    res.render('admin/2fa/prompt-remove-2fa');  // This should be a view where the user inputs their current 2FA code to remove it
});


adminRouter.post('/confirm-remove-2fa', ensureAuthenticatedAdmin, (req, res) => {
    const token = req.body.token;  // Get the 2FA token from the form

    connection.query('SELECT twoFA_secret FROM admins WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }

        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            // Valid token, remove 2FA setup
            connection.query('UPDATE admins SET twoFA_secret = NULL, hasFA = 0 WHERE id = ?', [req.user.id], function (error) {
                if (error) {
                    return res.status(500).send('Error removing 2FA setup');
                }
                res.send('2FA removed successfully');
            });
        } else {
            res.render('admin/2fa/prompt-remove-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
});




module.exports = adminRouter;