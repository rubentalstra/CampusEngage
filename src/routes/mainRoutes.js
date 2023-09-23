const express = require('express');
const router = express.Router();
const { isAuth, ensure2fa, isAdmin } = require('../middleware/auth');
const { userExists } = require('../middleware/utils');
const { Totp } = require('time2fa');
const qrcode = require('qrcode');
const passport = require('../config/passport');
const connection = require('../config/database');
const { genPassword } = require('../utilities/crypto');
const { getHomePage } = require('../controller/mainController');
const path = require('path');
const fs = require('fs');
const upload = require('../utilities/uploadImage');
const userRouter = require('./userRoutes');
const adminRouter = require('./adminRoutes');


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
        next(); // Proceed to the next middleware or route handler
    }
});


router.get('/', getHomePage);



router.use('/user', userRouter);
router.use('/admin', isAdmin, adminRouter);



router.get('/login', (req, res, next) => {
    res.render('admin/login');
});


router.get('/user-dashboard', isAuth, ensure2fa, (req, res, next) => {
    res.render('user-dashboard', { user: req.user });
});




router.get('/login-failure', (req, res, next) => {
    res.send('You entered the wrong password.');
});

router.get('/session-hijacking', (req, res, next) => {
    res.send('Nice try :)');
});


router.get('/register', (req, res, next) => {
    console.log('Inside get');
    res.render('register');

});

router.get('/profile', isAuth, ensure2fa, (req, res) => {
    const userId = req.user.id;

    connection.query('SELECT `imagePath` FROM `admins` WHERE `id` = ?', [userId], function (error, results) {
        if (error) {
            console.error(error);
            res.status(500).send('Server error');
        }

        if (results.length) {
            const user = results[0];
            res.render('profile', {
                user: req.user,
                imagePath: user.imagePath
            });
        } else {
            res.status(404).send('User not found!');
        }
    });
});

router.post('/upload', isAuth, ensure2fa, upload.single('profilePic'), (req, res) => {
    const userId = req.user.id;
    const publicImage = req.body.public ? 1 : 0;

    // Check if the user is the owner
    connection.query('UPDATE `admins` SET `imagePath` = ?, `publicImage` = ? WHERE `id` = ?', [req.file.path, publicImage, userId], function (error) {
        if (error) {
            return res.status(500).send('Error updating user profile image');
        }
        res.redirect('/profile');
    });

});

router.get('/view/:userId', isAuth, ensure2fa, (req, res) => {
    const userId = req.params.userId;

    connection.query(
        'SELECT `imagePath`, `publicImage` FROM `admins` WHERE `id` = ?', [userId],
        function (error, rows) {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: 'Error fetching user profile image' });
            }

            if (rows.length) {
                const user = rows[0];

                if (user.publicImage == 1 || req.user.id == userId) {
                    // User can see the profile picture
                    res.sendFile(path.join(__dirname, '../../uploads/', path.basename(user.imagePath)));

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



router.post('/delete/:userId', isAuth, ensure2fa, (req, res) => {
    const userId = req.params.userId;

    // Check if the user is the owner or if the user is an admin
    if (req.user.id != userId && !req.user.isAdmin) {
        return res.status(403).send('You are not allowed to delete this image.');
    }

    // Fetch imagePath from database to delete it from filesystem
    connection.query('SELECT `imagePath` FROM `admins` WHERE `id` = ?', [userId], (error, results) => {
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
                connection.query('UPDATE `admins` SET `imagePath` = NULL, `publicImage` = 0 WHERE `id` = ?', [userId], (dbError) => {
                    if (dbError) {
                        console.error(dbError);
                        return res.status(500).send('Error updating database');
                    }

                    res.redirect('/profile');
                });
            });
        } else {
            res.status(404).send('User not found');
        }
    });
});




// Endpoint to setup 2FA for a user
router.get('/setup-2fa', isAuth, (req, res) => {
    // Generate a new 2FA secret for the user
    const key = Totp.generateKey({ issuer: 'YourAppName', user: req.user.username });

    req.session.temp2fa = key.secret;  // Store it temporarily until confirmed

    console.log(key);

    // Totp.generateKey({ issuer: "N0C", user: "johndoe@n0c.com" });
    // Generate a QR Code for the user to scan

    qrcode.toDataURL(key.url, (err, dataUrl) => {
        if (err) { return res.render('setup-2fa', { qrCode: dataUrl, secret: null, error: 'Some error message here' }); }
        res.render('setup-2fa', { qrCode: dataUrl, secret: key.secret });
    });
});

// Endpoint to verify 2FA token
router.post('/verify-2fa', isAuth, (req, res) => {
    const token = req.body.token;

    if (Totp.validate({ passcode: token, secret: req.session.temp2fa })) {
        // Save the 2FA secret in database (make sure it's encrypted or securely stored)
        connection.query('UPDATE admins SET twoFA_secret = ?, hasFA = ? WHERE id = ?', [req.session.temp2fa, 1, req.user.id], function (error) {
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

// Endpoint to prompt for 2FA token
// router.get('/prompt-2fa', isAuth, (req, res) => {
//     res.render('prompt-2fa');
// });
router.get('/prompt-2fa', isAuth, (req, res, next) => {
    if (!req.user.hasFA) { return res.redirect('/user-dashboard'); }
    return res.render('prompt-2fa');
});




// Better error handling for 2FA verification:
router.post('/check-2fa', isAuth, (req, res) => {
    const token = req.body.token;

    connection.query('SELECT twoFA_secret FROM admins WHERE id = ?', [req.user.id], function (error, results) {
        if (error || results.length === 0) {
            return res.status(500).send('Error fetching 2FA secret');
        }
        if (Totp.validate({ passcode: token, secret: results[0].twoFA_secret })) {
            req.session.is2faVerified = true;
            res.redirect('/user-dashboard');
        } else {
            res.render('prompt-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
});

router.post('/register', userExists, (req, res, next) => {
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

    res.redirect('/login');
});

// Adjusting the login success route:
router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login-failure',
    successRedirect: '/prompt-2fa'
}), (req, res, next) => {
    req.session.regenerate(function (err) {
        // will have a new session here
        res.redirect('/prompt-2fa');
    });
});

// Logout redirection adjustment:
router.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});


router.get('/protected-route', isAuth, ensure2fa, (req, res, next) => {

    res.send('<h1>You are authenticated</h1><p><a href="/logout">Logout and reload</a></p>');
});


// remove 2FA

router.get('/remove-2fa', isAuth, (req, res) => {
    res.render('prompt-remove-2fa');  // This should be a view where the user inputs their current 2FA code to remove it
});


router.post('/confirm-remove-2fa', isAuth, (req, res) => {
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
            res.render('prompt-remove-2fa', { error: 'Invalid token. Please try again.' });
        }
    });
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
