const connection = require('../../config/database');

exports.getMembersNotActiveAPI = (req, res) => {
    connection.query('SELECT * FROM Members WHERE status = "pending"', (error, pendingUsers) => {
        if (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(pendingUsers);
    });
};


// 

exports.getMemberTypeCounts = (req, res) => {
    connection.query('SELECT member_type_id, COUNT(*) as count FROM Members GROUP BY member_type_id', (error, counts) => {
        if (error) {
            console.error('Error fetching type counts:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(counts);
    });
};

exports.getMembersByTypeId = (req, res) => {
    let typeId = req.params.typeId;

    connection.query('SELECT * FROM Members WHERE member_type_id = ?', [typeId], (error, members) => {
        if (error) {
            console.error('Error fetching users by type:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(members);
    });
};


