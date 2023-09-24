const express = require('express');
const https = require('https');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const passportUser = require('./src/config/passportUsers');
const router = require('./src/routes/mainRoutes');
const MySQLStore = require('express-mysql-session')(session);


require('dotenv').config({ path: `./env/.env` });

const app = express();


// app.use(
//     helmet({
//         frameguard: {
//             action: 'deny',
//         },
//         contentSecurityPolicy: {
//             directives: {
//                 ...helmet.contentSecurityPolicy.getDefaultDirectives(),
//                 'script-src': ["'self'"],
//                 'connect-src': ["'self'"],
//             },
//         },
//     })
// );



// Static files
app.use(express.static('public'));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', 'views');

// Static files and other configurations
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Body parser middleware to handle form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Initialize Passport and session
// Separate session and passport middleware for Users
app.use(session({
    name: 'userSession',
    key: process.env.USER_SESSION_KEY,
    secret: process.env.USER_SESSION_SECRET,
    store: new MySQLStore({
        host: process.env.MYSQL_SERVER,
        port: process.env.MYSQL_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME1
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        session: true,
    }
}));
app.use(passportUser.initialize());
app.use(passportUser.session());





const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// Use the mainRoutes for handling routes
app.use('/', router);
// app.use('/admin', adminRouter);

// HTTPS server setup
const options = {
    key: fs.readFileSync(`./cert/server.key`),
    cert: fs.readFileSync(`./cert/server.crt`),
};

const server = https.createServer(options, app);
server.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}!`);
});
