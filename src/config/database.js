const mysql = require('mysql2');
require('dotenv').config({ path: `./env/.env` });

const connection = mysql.createConnection({
    host: process.env.MYSQL_SERVER,
    port: process.env.MYSQL_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME3,
    insecureAuth: true,
    multipleStatements: false
});

connection.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    console.log('connected as id ' + connection.threadId);
});



module.exports = connection;
