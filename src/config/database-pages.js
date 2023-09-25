const { Sequelize } = require('sequelize');
require('dotenv').config({ path: `./env/.env` });

const sequelize = new Sequelize({
    host: 'localhost',
    database: process.env.DB_NAME4,
    username: process.env.DB_USER,
    dialect: 'mysql',
    logging: true // Optional: set to false if you don't want sequelize logging to console

});

module.exports = sequelize;
