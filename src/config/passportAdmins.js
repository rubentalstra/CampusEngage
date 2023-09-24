delete require.cache[require.resolve('passport')];
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connection = require('./database');
const { validPassword } = require('../utilities/crypto');


const passportAdmin = new passport.Passport();

const customFields = {
    usernameField: 'uname',
    passwordField: 'pw',
};

const verifyCallback = (username, password, done) => {

    connection.query('SELECT * FROM admins WHERE username = ? ', [username], function (error, results, fields) {
        if (error) {
            return done(error);
        }

        if (results.length == 0) {
            return done(null, false);
        }
        const isValid = validPassword(password, results[0].hash, results[0].salt);
        const admin = { id: results[0].id, username: results[0].username, hash: results[0].hash, salt: results[0].salt };
        if (isValid) {
            return done(null, admin);
        }
        else {
            return done(null, false);
        }
    });
};

const strategy = new LocalStrategy(customFields, verifyCallback);
passportAdmin.use('local-admin', strategy);

passportAdmin.serializeUser((user, done) => {
    console.log('inside serialize');
    done(null, user.id);
});

passportAdmin.deserializeUser(function (adminId, done) {
    console.log('deserializeUser ' + adminId);
    connection.query('SELECT id, username,  isAdmin, hasFA FROM admins where id = ?', [adminId], function (error, results) {
        if (error) { return console.log(error.sqlMessage); }
        if (results && results.length && results[0]) {
            done(null, results[0]);
        }
    });
});

module.exports = passportAdmin;
