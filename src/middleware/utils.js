const connection = require('../config/database');

function userExists(req, res, next) {
    connection.query('Select id, username from admin where username=? ', [req.body.uname], function (error, results, fields) {
        if (error) {
            console.log('Error');
        }
        else if (results.length > 0) {
            res.redirect('/userAlreadyExists');
        }
        else {
            next();
        }

    });
}

module.exports = { userExists };
