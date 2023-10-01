const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connection = require('./database');
const { validPassword } = require('../utilities/crypto');



const passportUser = new passport.Passport();

const customFields = {
    usernameField: 'email',
    passwordField: 'pw',
};

const verifyCallback = (emailadres, password, done) => {

    connection.query('SELECT * FROM Members WHERE emailadres = ? ', [emailadres], function (error, results, fields) {
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
passportUser.use('local-user', strategy);

passportUser.serializeUser((user, done) => {
    // console.log('inside serialize');
    done(null, user.id);
});

passportUser.deserializeUser(function (userId, done) {
    // console.log('deserializeUser ' + userId);
    connection.query('SELECT id, first_name, primary_last_name_main, emailadres, hasFA FROM Members where id = ?', [userId], function (error, results) {
        if (error) { return console.log(error.sqlMessage); }
        if (results && results.length && results[0]) {
            done(null, results[0]);
        }
    });
});

module.exports = passportUser;
