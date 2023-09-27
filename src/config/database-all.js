const mysql = require('mysql2');
require('dotenv').config({ path: `./env/.env` });


const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQL_SERVER,
    port: process.env.MYSQL_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME3,
    insecureAuth: true,
});

function query(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
}

module.exports = query;
