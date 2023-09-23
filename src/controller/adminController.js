const connection = require('../config/database');

exports.getAdminDashboard = (req, res) => {
    connection.query('SELECT * FROM users WHERE status = "pending"', (error, pendingUsers) => {
        if (error) {
            console.error('Error fetching users:', error);
            res.status(500).send('Internal Server Error');
            return;
        }

        res.render('admin/admin-dashboard', { users: pendingUsers });
    });
};