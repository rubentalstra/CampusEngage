const { DataTypes } = require('sequelize');
const sequelize = require('../config/database-pages.js');
const slugify = require('slugify');


const Page = sequelize.define('Page', {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING,
        unique: true
    },
    firstRoute: {
        type: DataTypes.STRING,
        allowNull: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'pages',
            key: 'id'
        }
    }
});

Page.beforeCreate((page) => {
    page.slug = slugify(page.title, {
        lower: true,
        strict: true
    });
    page.firstRoute = page.slug.split('/')[0];  // Extract the first route segment
});

module.exports = Page;
