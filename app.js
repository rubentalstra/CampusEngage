require('dotenv').config({ path: `./env/.env` });
const express = require('express');
const helmet = require('helmet');

const https = require('https');
const rateLimit = require('express-rate-limit');


const fs = require('fs');
const path = require('path');
const getRoutes = require('./router/router');
const mainController = require('./controllers/controller');

const app = express();

app.use(
    helmet({
        frameguard: {
            action: 'deny',
        },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                'script-src': ["'self'"],
                'connect-src': ["'self'"],
            },
        },
    })
);

app.get('/favicon.ico', (req, res) => {
    return res.sendFile(path.join(__dirname + '/public/icon/favicon.png'));
});

// View engine
app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

// Static files and other configurations
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));

app.use('/css', express.static(path.join(__dirname, 'node_modules/datatables.net-bs5/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/datatables.net-bs5/js')));

app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

app.use('/js', express.static(path.join(__dirname, 'node_modules/@popperjs/core/dist/umd')));
app.use('/fontawesome', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
// END

app.use(express.urlencoded({ extended: false }));
app.use('/', express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

// set up routes with authentication
app.use(getRoutes(mainController, express.Router()));

// https
const options = {
    key: fs.readFileSync(`./cert/${process.env.NODE_ENV}/server.key`),
    cert: fs.readFileSync(`./cert/${process.env.NODE_ENV}/server.crt`),
};

const server = https.createServer(options, app);
server.listen(process.env.API_PORT || 80, () => {
    console.log(`Msal Node Auth Code Sample app listening on port ${process.env.API_PORT || 80}!`);
});
