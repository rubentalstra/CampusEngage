const express = require('express');
const https = require('https');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const passportUser = require('./src/config/passportUsers');
const passportAdmins = require('./src/config/passportAdmins');
const { validPassword } = require('./src/utilities/crypto');
const adminRouter = require('./src/routes/adminRoutes');

const MySQLStore = require('express-mysql-session')(session);


require('dotenv').config({ path: `./env/.env` });

const app = express();


const settingsPath = path.join(__dirname, 'settings.json');
let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));


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
    name: 'adminSession',
    key: process.env.ADMIN_SESSION_KEY,
    secret: process.env.ADMIN_SESSION_SECRET,
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
app.use(passportAdmins.initialize());
app.use(passportAdmins.session());






const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiting middleware to all requests
app.use(limiter);
const router = adminRouter(settings);
app.use('/admin', router);

// HTTPS server setup
const options = {
    key: fs.readFileSync(`./cert/server.key`),
    cert: fs.readFileSync(`./cert/server.crt`),
};

const server = https.createServer(options, app);
server.listen(8444, () => {
    console.log(`App listening on port 8444!`);
});
