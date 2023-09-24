const connection = require('../config/database');

exports.getAdminDashboard = (req, res) => {
    connection.query('SELECT * FROM Members WHERE status = "pending"', (error, pendingUsers) => {
        if (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Internal Server Error');
            return;
        }

        res.render('admin/admin-dashboard', { users: pendingUsers });
    });
};


exports.getMembersNotActive = (req, res) => {
    connection.query('SELECT * FROM Members WHERE status = "pending"', (error, pendingUsers) => {
        if (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Internal Server Error');
            return;
        }

        res.render('admin/administration/members/index', { user: req.user, users: pendingUsers });
    });
};