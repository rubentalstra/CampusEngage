const express = require('express');
const { fetchAndRenderArticleDetails, fetchAndRenderArticles } = require('../../controller/news/newsController');
const { insertArticle } = require('../../utilities/newsFunctions');

const newsRoutes = express.Router();


// the main index route.
newsRoutes.get('/', fetchAndRenderArticles);

newsRoutes.get('/create', (req, res) => {
    const newArticle = {
        title: 'Your Article Title',
        image_path: '/uploads/news/463e37fa67d54963af77d2ba1ed6b850.jpg',
        content: 'Your article content here'
    };

    insertArticle(newArticle, results => {
        console.log('Article inserted with ID:', results.insertId);
    });
});

// Valid URL from the server. with the details information.
newsRoutes.get('/:url', fetchAndRenderArticleDetails);
// Going to a next age for a other page from the server.
newsRoutes.get('/page/:page', fetchAndRenderArticles);



module.exports = newsRoutes;
