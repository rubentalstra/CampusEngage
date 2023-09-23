const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connection = require('./database');
const { validPassword } = require('../utilities/crypto');


const customFields = {
    usernameField: 'uname',
    passwordField: 'pw',
};

const verifyCallback = (emailadres, password, done) => {

    connection.query('SELECT * FROM users WHERE emailadres = ? ', [emailadres], function (error, results, fields) {
        if (error) {
            return done(error);
        }

        if (results.length == 0) {
            return done(null, false);
        }
        const isValid = validPassword(password, results[0].hash, results[0].salt);
        const user = { id: results[0].id, emailadres: results[0].emailadres, hash: results[0].hash, salt: results[0].salt };
        if (isValid) {
            return done(null, user);
        }
        else {
            return done(null, false);
        }
    });
};

const strategy = new LocalStrategy(customFields, verifyCallback);
passport.use(strategy);

passport.serializeUser((user, done) => {
    console.log('inside serialize');
    done(null, user.id);
});

passport.deserializeUser(function (userId, done) {
    console.log('deserializeUser ' + userId);
    connection.query('SELECT id, emailadres, hasFA FROM users where id = ?', [userId], function (error, results) {
        if (error) { return console.log(error.sqlMessage); }
        if (results && results.length && results[0]) {
            done(null, results[0]);
        }
    });
});

module.exports = passport;
