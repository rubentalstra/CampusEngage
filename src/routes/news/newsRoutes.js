const express = require('express');
const { fetchAndRenderArticles, fetchAndRenderArticleDetails, insertArticle } = require('../../utilities/newsFunctions');
const newsRoutes = express.Router();


newsRoutes.get('/', (req, res) => {
    const currentPage = 1;
    fetchAndRenderArticles(currentPage, req, res);
});

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

newsRoutes.get('/:url', (req, res) => {
    const articleUrl = req.params.url;
    fetchAndRenderArticleDetails(articleUrl, req, res);
});


newsRoutes.get('/page/:page', (req, res) => {
    const currentPage = parseInt(req.params.page, 10) || 1;
    fetchAndRenderArticles(currentPage, req, res);
});



module.exports = newsRoutes;
