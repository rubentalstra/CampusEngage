const express = require('express');
const { Totp } = require('time2fa');
const qrcode = require('qrcode');
const passportUser = require('../config/passportUsers');
const connection = require('../config/database');
const { genPassword } = require('../utilities/crypto');
const { ensureAuthenticatedUser, userEnsure2fa } = require('../middleware/auth');

const path = require('path');
const fs = require('fs');
const upload = require('../utilities/uploadImage');

const userRouter = express.Router();

// const { ensureAuthenticatedUser, userEnsure2fa, isAdmin } = require('../middleware/auth');
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



userRouter.use((req, res, next) => {
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

userRouter.get('/user-dashboard', ensureAuthenticatedUser, userEnsure2fa, (req, res, next) => {
    res.render('user/user-dashboard', { user: req.user });
});

userRouter.get('/login', (req, res, next) => {
    res.render('user/login');
});

// Adjusting the login success route:
userRouter.post('/login', passportUser.authenticate('local', {
    failureRedirect: '/user/login-failure',
    successRedirect: '/user/prompt-2fa'
}), (req, res, next) => {
    req.session.regenerate(function (err) {
        // will have a new session here
        res.redirect('/user/prompt-2fa');
    });
});



userRouter.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

// Logout redirection adjustment:
userRouter.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});


userRouter.get('/register', (req, res, next) => {
    console.log('Inside get');
    res.render('user/register');

});


userRouter.post('/register', (req, res) => {
    const {
        type_name,
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

    connection.query('INSERT INTO users(type_name, status, first_name, initials, primary_last_name_prefix, primary_last_name_main, geslacht, geboortedatum, emailadres, mobiele_telefoon, vaste_telefoon, iban, bic, sepa_machtiging_date, sepa_referentie, studentnummer, lid_sinds) VALUES (?, "pending", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        type_name,
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

        res.redirect('/user/pending-approval');
    });

});

userRouter.get('/pending-approval', (req, res) => {
    res.render('user/pending-approval');
});


userRouter.get('/set-password', (req, res) => {
    const token = req.query.token;
    // Render the password setting form page, passing the token along
    res.render('user/set-password', { token: token });
});


userRouter.post('/set-password', (req, res) => {
    const token = req.body.token;
    const newPassword = req.body.password;

    connection.query('SELECT * FROM users WHERE verification_token = ?', [token], function (error, results) {
        if (error) {
            console.error('Error retrieving user with token:', error);
            return res.status(500).send('Error setting password');
        }

        if (!results.length) {
            return res.status(400).send('Invalid token');
        }

        const user = results[0];
        const now = new Date();

        if (user.token_expiration_date < now) {
            return res.status(400).send('Token has expired');
        }

        // Continue with setting the password
        // Generate the salt and hash for the new password
        const saltHash = genPassword(newPassword);
        const salt = saltHash.salt;
        const hash = saltHash.hash;

        connection.query('UPDATE users SET status = "active", hash = ?, salt = ?, verification_token = NULL, token_expiration_date = NULL WHERE id = ?', [hash, salt, user.id], function (updateError, updateResults) {
            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).send('Error setting password');
            }

            res.redirect('/user/login');  // or wherever you want to direct them after setting their password
        });
    });
});



/**
 * IMAGE SETUP
 */



userRouter.get('/profile', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    const userId = req.user.id;

    connection.query('SELECT `imagePath` FROM `users` WHERE `id` = ?', [userId], function (error, results) {
        if (error) {
            console.error(error);
            res.status(500).send('Server error');
        }

        if (results.length) {
            const user = results[0];
            res.render('user/profile', {
                user: req.user,
                imagePath: user.imagePath
            });
        } else {
            res.status(404).send('User not found!');
        }
    });
});

userRouter.post('/upload', ensureAuthenticatedUser, userEnsure2fa, upload.single('profilePic'), (req, res) => {
    const userId = req.user.id;
    const publicImage = req.body.public ? 1 : 0;

    // Check if the user is the owner
    connection.query('UPDATE `users` SET `imagePath` = ?, `publicImage` = ? WHERE `id` = ?', [req.file.path, publicImage, userId], function (error) {
        if (error) {
            return res.status(500).send('Error updating user profile image');
        }
        res.redirect('/user/profile');
    });

});

userRouter.get('/view/:userId', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    const userId = req.params.userId;

    connection.query(
        'SELECT `imagePath`, `publicImage` FROM `users` WHERE `id` = ?', [userId],
        function (error, rows) {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: 'Error fetching user profile image' });
            }

            if (rows.length) {
                const user = rows[0];

                if (user.publicImage == 1 || req.user.id == userId) {
                    // User can see the profile picture
                    res.sendFile(path.join(__dirname, '../../uploads/user-profile/', path.basename(user.imagePath)));

                } else {
                    // Display the black dummy picture
                    res.sendFile(path.join(__dirname, '../../uploads/dummy.png'));
                }
            } else {
                res.status(404).json({ message: 'User not found!' });
            }
        }
    );
});



userRouter.post('/delete/:userId', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    const userId = req.params.userId;

    // Check if the user is the owner or if the user is an admin
    if (req.user.id != userId && !req.user.isAdmin) {
        return res.status(403).send('You are not allowed to delete this image.');
    }

    // Fetch imagePath from database to delete it from filesystem
    connection.query('SELECT `imagePath` FROM `users` WHERE `id` = ?', [userId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length) {
            const imagePath = results[0].imagePath;

            // Remove file
            fs.unlink(path.join(__dirname, '../../', imagePath), (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error deleting file from server');
                }

                // Update database after file deletion
                connection.query('UPDATE `users` SET `imagePath` = NULL, `publicImage` = 0 WHERE `id` = ?', [userId], (dbError) => {
                    if (dbError) {
                        console.error(dbError);
                        return res.status(500).send('Error updating database');
                    }

                    res.redirect('/user/profile');
                });
            });
        } else {
            res.status(404).send('User not found');
        }
    });
});



/**
 * 2FA SETUP
 */


// Endpoint to setup 2FA for a user
userRouter.get('/setup-2fa', ensureAuthenticatedUser, (req, res) => {
    // Generate a new 2FA secret for the user
    const key = Totp.generateKey({ issuer: 'YourAppName', user: req.user.emailadres });

    req.session.temp2fa = key.secret;  // Store it temporarily until confirmed

    console.log(key);

    // Totp.generateKey({ issuer: "N0C", user: "johndoe@n0c.com" });
    // Generate a QR Code for the user to scan

    qrcode.toDataURL(key.url, (err, dataUrl) => {
        if (err) { return res.render('user/2fa/setup-2fa', { qrCode: dataUrl, secret: null, error: 'Some error message here' }); }
        res.render('user/2fa/setup-2fa', { qrCode: dataUrl, secret: key.secret });
    });
});

// Endpoint to verify 2FA token
userRouter.post('/verify-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;

    if (Totp.validate({ passcode: token, secret: req.session.temp2fa })) {
        // Save the 2FA secret in database (make sure it's encrypted or securely stored)
        connection.query('UPDATE users SET twoFA_secret = ?, hasFA = ? WHERE id = ?', [req.session.temp2fa, 1, req.user.id], function (error) {
            if (error) {
                return res.status(500).send('Error saving 2FA secret');
            }
            delete req.session.temp2fa;
            res.send('2FA setup successfully');
        });
    } else {
        res.status(400).send('Invalid token');
    }
});

// check 2FA
userRouter.get('/prompt-2fa', ensureAuthenticatedUser, (req, res, next) => {
    if (!req.user.hasFA) { return res.redirect('/user/user-dashboard'); }
    return res.render('user/2fa/prompt-2fa');
});


// Better error handling for 2FA verification:
userRouter.post('/check-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;

    connection.query('SELECT twoFA_secret FROM users WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }
        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            req.session.is2faVerified = true;
            res.redirect('user/user-dashboard');
        } else {
            res.render('user/2fa/prompt-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
});


// remove 2FA

userRouter.get('/remove-2fa', ensureAuthenticatedUser, (req, res) => {
    res.render('user/2fa/prompt-remove-2fa');  // This should be a view where the user inputs their current 2FA code to remove it
});


userRouter.post('/confirm-remove-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;  // Get the 2FA token from the form

    connection.query('SELECT twoFA_secret FROM users WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }

        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            // Valid token, remove 2FA setup
            connection.query('UPDATE users SET twoFA_secret = NULL, hasFA = 0 WHERE id = ?', [req.user.id], function (error) {
                if (error) {
                    return res.status(500).send('Error removing 2FA setup');
                }
                res.send('2FA removed successfully');
            });
        } else {
            res.render('user/2fa/prompt-remove-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
});



userRouter.get('/session-hijacking', (req, res, next) => {
    res.send('Nice try :)');
});


module.exports = userRouter;