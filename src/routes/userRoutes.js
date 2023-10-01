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




userRouter.get('/user-dashboard', ensureAuthenticatedUser, userEnsure2fa, (req, res, next) => {
    res.render('mijn-realtime/user-dashboard', { nonce: res.locals.cspNonce, user: req.user });
});




userRouter.get('/set-password', (req, res) => {
    const token = req.query.token;
    // Render the password setting form page, passing the token along
    res.render('mijn-realtime/set-password', { nonce: res.locals.cspNonce, token: token });
});




userRouter.post('/set-password', (req, res) => {
    const token = req.body.token;
    const newPassword = req.body.password;

    connection.query('SELECT * FROM Members WHERE verification_token = ?', [token], function (error, results) {
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

        connection.query('UPDATE `Members` SET status = "active", hash = ?, salt = ?, verification_token = NULL, token_expiration_date = NULL WHERE id = ?', [hash, salt, user.id], function (updateError, updateResults) {
            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).send('Error setting password');
            }

            res.redirect('/login');  // or wherever you want to direct them after setting their password
        });
    });
});

userRouter.get('/profiel/2fa', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    res.render('mijn-realtime/2fa', {
        nonce: res.locals.cspNonce,
        user: req.user,
    });
});

userRouter.get('/uitschrijven', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    res.render('mijn-realtime/uitschrijven', {
        nonce: res.locals.cspNonce,
        user: req.user,
    });
});

userRouter.get('/agenda', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    res.render('mijn-realtime/agenda', {
        nonce: res.locals.cspNonce,
        user: req.user,
    });
});





/**
 * IMAGE SETUP
 */



userRouter.get('/profiel', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    const userId = req.user.id;

    connection.query('SELECT `imagePath` FROM `Members` WHERE `id` = ?', [userId], function (error, results) {
        if (error) {
            console.error(error);
            res.status(500).send('Server error');
        }

        if (results.length) {
            const user = results[0];
            res.render('mijn-realtime/profiel', {
                nonce: res.locals.cspNonce,
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
    connection.query('UPDATE `Members` SET `imagePath` = ?, `publicImage` = ? WHERE `id` = ?', [req.file.path, publicImage, userId], function (error) {
        if (error) {
            return res.status(500).send('Error updating user profile image');
        }
        res.redirect('/mijn-realtime/profiel');
    });

});

userRouter.get('/view/:userId', ensureAuthenticatedUser, userEnsure2fa, (req, res) => {
    const userId = req.params.userId;

    connection.query(
        'SELECT `imagePath`, `publicImage` FROM `Members` WHERE `id` = ?', [userId],
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
    connection.query('SELECT `imagePath` FROM `Members` WHERE `id` = ?', [userId], (error, results) => {
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
                connection.query('UPDATE `Members` SET `imagePath` = NULL, `publicImage` = 0 WHERE `id` = ?', [userId], (dbError) => {
                    if (dbError) {
                        console.error(dbError);
                        return res.status(500).send('Error updating database');
                    }

                    res.redirect('/mijn-realtime/profiel');
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
    const key = Totp.generateKey({ issuer: 'SV-REALTIME', user: req.user.emailadres });

    req.session.temp2fa = key.secret;  // Store it temporarily until confirmed

    console.log(key);

    // Totp.generateKey({ issuer: "N0C", user: "johndoe@n0c.com" });
    // Generate a QR Code for the user to scan

    qrcode.toDataURL(key.url, (err, dataUrl) => {
        if (err) { return res.render('mijn-realtime/2fa/setup-2fa', { nonce: res.locals.cspNonce, user: req.user, qrCode: dataUrl, secret: null, error: 'Some error message here' }); }
        res.render('mijn-realtime/2fa/setup-2fa', { nonce: res.locals.cspNonce, user: req.user, qrCode: dataUrl, secret: key.secret });
    });
});

// Endpoint to verify 2FA token
userRouter.post('/verify-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;

    if (Totp.validate({ passcode: token, secret: req.session.temp2fa })) {
        // Save the 2FA secret in database (make sure it's encrypted or securely stored)
        connection.query('UPDATE `Members` SET twoFA_secret = ?, hasFA = ? WHERE id = ?', [req.session.temp2fa, 1, req.user.id], function (error) {
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
userRouter.get('/prompt-2fa', ensureAuthenticatedUser, (req, res, next) => {
    if (!req.user.hasFA) { return res.redirect('/mijn-realtime/profiel'); }
    if (req.session.is2faVerified) { return res.redirect('/mijn-realtime/profiel'); }
    return res.render('mijn-realtime/2fa/prompt-2fa', { nonce: res.locals.cspNonce, user: undefined });
});



// Better error handling for 2FA verification:
userRouter.post('/check-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;

    connection.query('SELECT twoFA_secret FROM Members WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }

        try {
            if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
                req.session.is2faVerified = true;
                return res.redirect('/mijn-realtime/profiel');
            }

            res.render('mijn-realtime/2fa/prompt-2fa', { nonce: res.locals.cspNonce, user: undefined, error: 'Invalid token. Please try again.' });
        } catch (error) {
            res.render('mijn-realtime/2fa/prompt-2fa', { nonce: res.locals.cspNonce, user: undefined, error: 'Invalid token. Please try again.' });
        }
    });
});


// remove 2FA

userRouter.get('/remove-2fa', ensureAuthenticatedUser, (req, res) => {
    res.render('mijn-realtime/2fa/prompt-remove-2fa', { nonce: res.locals.cspNonce });  // This should be a view where the user inputs their current 2FA code to remove it
});


userRouter.post('/confirm-remove-2fa', ensureAuthenticatedUser, (req, res) => {
    const token = req.body.token;  // Get the 2FA token from the form

    connection.query('SELECT twoFA_secret FROM Members WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }

        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            // Valid token, remove 2FA setup
            connection.query('UPDATE `Members` SET twoFA_secret = NULL, hasFA = 0 WHERE id = ?', [req.user.id], function (error) {
                if (error) {
                    return res.status(500).send('Error removing 2FA setup');
                }
                res.send('2FA removed successfully');
            });
        } else {
            res.render('mijn-realtime/2fa/prompt-remove-2fa', { nonce: res.locals.cspNonce, error: 'Invalid token. Please try again.' });
        }
    });
});




module.exports = userRouter;