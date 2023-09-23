const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({

    host: 'smtp-mail.outlook.com', // hostname
    secureConnection: false, // TLS requires secureConnection to be false
    port: 587, // port for secure SMTP
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PW,
    },
    tls: {
        ciphers: 'SSLv3'
    }

});

module.exports = transporter;
