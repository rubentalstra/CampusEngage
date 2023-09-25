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


exports.renderMemberPage = (req, res) => {
    connection.query(`SELECT MemberTypes.id, MemberTypes.type_name, MemberTypes.category, COALESCE(COUNT(Members.id), 0) as count FROM MemberTypes LEFT JOIN Members ON MemberTypes.id = Members.member_type_id GROUP BY MemberTypes.id, MemberTypes.type_name, MemberTypes.category`, (error, memberTypeCounts) => {
        if (error) {
            console.error('Error fetching member type counts:', error);
            res.status(500).send('Internal Server Error');
            return;
        }

        // Group by category
        let categorizedTypes = {};
        memberTypeCounts.forEach(type => {
            if (!categorizedTypes[type.category]) {
                categorizedTypes[type.category] = [];
            }
            categorizedTypes[type.category].push(type);
        });

        res.render('admin/administration/members/index', {
            user: req.user,
            categorizedTypes: categorizedTypes
        });
    });
};




// exports.getMembersNotActive = (req, res) => {
//     connection.query('SELECT * FROM Members WHERE status = "pending"', (error, pendingUsers) => {
//         if (error) {
//             console.error('Error fetching users:', error);
//             res.status(500).send('Internal Server Error');
//             return;
//         }

//         res.render('admin/administration/members/index', { user: req.user, users: pendingUsers });
//     });
// };