const express = require('express');
const https = require('https');
const rateLimit = require('express-rate-limit');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const passportUser = require('./src/config/passportUsers');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');

const { CronJob } = require('cron');
const { updateRefundStatus, webhookVerification } = require('./src/utilities/mollie');
const initRouter = require('./src/routes/mainRoutes');
const MySQLStore = require('express-mysql-session')(session);

require('dotenv').config({ path: `./env/.env` });



const app = express();


// Load settings from file
const settingsPath = path.join(__dirname, 'settings.json');
let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));


// Set view engine and disable x-powered-by header
app.set('view engine', 'ejs');
app.set('views', 'views');
app.disable('x-powered-by');
app.set('trust proxy', 1);


// Static files
app.use(express.static('public'));
app.use('/js', express.static(path.join(__dirname, 'node_modules/@fullcalendar')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery')));
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
// app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/sponsors', express.static(path.join(__dirname, 'uploads/sponsors')));



// Security configurations
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('hex');
    next();
});

app.use(helmet({
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
            'connect-src': ["'self'", 'https://www.mollie.com']
        }
    }
}));


// Body parser middleware to handle form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Session and authentication
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
        secure: process.env.NODE_ENV === 'ngrok' ? false : true,
        session: true,
    }
}));
app.use(passportUser.initialize());
app.use(passportUser.session());


// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Define the Mollie webhook route before the CSRF middleware
app.post('/evenementen/webhook', webhookVerification);

// Set up cookie parser and use it before csurf
app.use(cookieParser(process.env.CSRF));

const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF,
    cookieName: process.env.CSRF_COOKIE_NAME,
    cookieOptions: {
        sameSite: 'Strict',
        path: '/',
        secure: true, // Set to false if you are running on http during development
    },
    getTokenFromRequest: (req) => req.body._csrf, // Extract the token from the body

});


// Make CSRF token available to templates
app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req, res);
    next();
});

app.use(doubleCsrfProtection);


// Initialize router
const router = initRouter(settings);
app.use('/', router);


// Error-handling middleware
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') { // CSRF token validation failed
        // Render your error page with a CSRF error
        res.status(403);
        return res.render('errors/csrf-error', { error: 'CSRF token invalid' });
    }

    // // Handle other errors differently
    // res.status(500);
    // res.render('errors/error', { error: 'Internal Server Error' });
});

// HTTPS server setup
const options = {
    key: fs.readFileSync(`./cert/server.key`),
    cert: fs.readFileSync(`./cert/server.crt`),
};

const server = process.env.NODE_ENV !== 'ngrok' ?
    https.createServer(options, app) :
    app;

server.listen(process.env.NODE_ENV !== 'ngrok' ? process.env.PORT : process.env.PORT_NGROK, () => {
    console.log(`App listening on port ${process.env.PORT}!`);
});


const job = new CronJob('0 */1 * * * *', async function () {
    await updateRefundStatus();
});
job.start();