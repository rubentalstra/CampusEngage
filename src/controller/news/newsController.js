const connection = require('../../config/database');
const stripAndShortenHTML = require('../../utilities/stripAndShortenHTML');
const timeDifference = require('../../utilities/timeDifference');

exports.fetchAndRenderArticles = (req, res) => {
    const currentPage = parseInt(req.params?.page ?? 1, 10) || 1;
    const articlesPerPage = 10; // or whatever value you choose

    connection.query('SELECT COUNT(*) as totalCount FROM newsArticles', (err, result) => {
        if (err) { throw err; }

        const totalArticles = result[0].totalCount;
        const maxPage = Math.ceil(totalArticles / articlesPerPage);

        const offset = (currentPage - 1) * articlesPerPage;
        connection.query('SELECT * FROM newsArticles ORDER BY date DESC LIMIT ?,?', [offset, articlesPerPage], (err, articles) => {
            if (err) { throw err; }

            const processedArticles = articles.map(article => {
                const processedContent = stripAndShortenHTML(article.content || '');
                const dateString = timeDifference(article.date);
                return {
                    ...article,
                    content: processedContent,
                    dateString: dateString
                };
            });

            // console.log(processedArticles);

            res.render('news/index', { ...res.locals.commonFields, articles: processedArticles, currentPage, maxPage });
        });
    });
};

exports.fetchAndRenderArticleDetails = (req, res) => {
    const articleUrl = req.params.url;

    connection.query('SELECT * FROM newsArticles WHERE url = ?', [articleUrl], (err, results) => {
        if (err) { throw err; }

        if (results.length === 0) {
            // No article found with the given ID
            res.status(404);
            return res.render('errors/404', { ...res.locals.commonFields, });
        }

        const article = results[0];
        const dateString = timeDifference(article.date);
        article.dateString = dateString;

        res.render('news/details', { ...res.locals.commonFields, article });
    });
};