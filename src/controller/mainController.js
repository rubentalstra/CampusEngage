const connection = require('../config/database');

exports.getHomePage = (req, res) => {
    // if (req.isAuthenticated()) {
    //     // If they are authenticated, redirect to user-dashboard
    //     return res.redirect('/user/user-dashboard');
    // }

    // If not authenticated, show the home page
    return res.send('<h1>Home</h1><p>Please <a href="/user/register">register</a></p>');
};


exports.getLidWordenCountriesInformation = (req, res) => {
    connection.query('SELECT countries.country_id, countries.country_phone, countries.country_name FROM countries ORDER BY countries.country_name ASC', (error, countries) => {
        if (error) {
            console.error('Error fetching type counts:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        return countries;
    });
};
