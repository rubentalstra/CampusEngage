const express = require('express');
const connection = require('../config/database');
const transporter = require('../utilities/mailer');
const { getAdminDashboard } = require('../controller/adminController');
const { generateToken } = require('../utilities/crypto');
const adminRouter = express.Router();

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


adminRouter.get('/admin-route', (req, res, next) => {
    res.send('<h1>You are admin</h1><p><a href="/logout">Logout and reload</a></p>');
});

adminRouter.get('/admin-dashboard', getAdminDashboard);




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
        connection.query('SELECT emailadres FROM users WHERE id = ?', [userId], async function (error, results) {
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
                text: `Dear User, please click on the link to set up your password: https://localhost:8443/user/set-password?token=${token}`
            };

            const info = await transporter.sendMail(mailOptions);

            console.log('Message sent: %s', info.messageId);
            res.status(200).send('Password setup email sent successfully');

            // transporter.send(mailOptions, function (mailError, info) {
            //     if (mailError) {
            //         console.error('Error sending email:', mailError);
            //         return res.status(500).send('Error sending password setup email');
            //     }
            //     res.status(200).send('Password setup email sent successfully');
            // });
        });
    });
});


module.exports = adminRouter;