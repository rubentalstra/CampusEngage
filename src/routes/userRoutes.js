const express = require('express');
const connection = require('../config/database');
const { genPassword } = require('../utilities/crypto');
const userRouter = express.Router();

// const { isAuth, ensure2fa, isAdmin } = require('../middleware/auth');
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
        studentnummer,
        lid_sinds
    } = req.body;


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
        lid_sinds
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

            res.redirect('/login');  // or wherever you want to direct them after setting their password
        });
    });
});



module.exports = userRouter;