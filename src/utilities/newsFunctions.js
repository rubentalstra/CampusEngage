const connection = require('../config/database');
const query = require('../config/database-all');
const stripAndShortenHTML = require('./stripAndShortenHTML');
const timeDifference = require('./timeDifference');



async function fetchArticlesForFooter(req, res) {
    try {
        const articles = await query('SELECT url, title, image_path, date FROM newsArticles ORDER BY date DESC LIMIT 4');

        const processedArticles = articles.map(article => {
            const dateString = timeDifference(article.date);
            return {
                ...article,
                dateString: dateString
            };
        });

        return processedArticles;
    } catch (dbError) {
        console.error(dbError);
        return [];
        // res.status(500).send('Error occurred while updating payment status in database');
    }
}


function sanitizeTitleForUrl(title) {
    return title.trim()
        .replace(/\s+/g, '-')  // replace spaces with hyphens
        .replace(/[^a-zA-Z0-9-]/g, '') // remove special characters except hyphens
        .toLowerCase();
}


function fetchAndRenderArticles(settings, currentPage, req, res) {
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

            res.render('news/index', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user, articles: processedArticles, currentPage, maxPage });
        });
    });
}

function fetchAndRenderArticleDetails(articleUrl, settings, req, res) {
    connection.query('SELECT * FROM newsArticles WHERE url = ?', [articleUrl], (err, results) => {
        if (err) { throw err; }

        if (results.length === 0) {
            // No article found with the given ID
            res.status(404);
            return res.render('errors/404', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user });
        }

        const article = results[0];
        const dateString = timeDifference(article.date);
        article.dateString = dateString;

        res.render('news/details', { settings, footerNews: res.locals.news, nonce: res.locals.cspNonce, user: req.user, article });
    });
}


// 

function urlExistsInDB(url, callback) {
    connection.query('SELECT 1 FROM newsArticles WHERE url = ?', [url], (err, results) => {
        if (err) { throw err; }
        callback(results.length > 0);
    });
}

function getUniqueUrl(originalUrl, callback) {
    urlExistsInDB(originalUrl, exists => {
        if (exists) {
            getHighestCountForUrl(originalUrl, highestCount => {
                const newUrl = `${highestCount + 1}-${originalUrl}`;
                callback(newUrl);
            });
        } else {
            callback(originalUrl);
        }
    });
}

function getHighestCountForUrl(baseURL, callback) {
    // This query tries to find URLs that start with a number followed by our base URL
    const query = `SELECT url FROM newsArticles WHERE url REGEXP ? ORDER BY LENGTH(url) DESC, url DESC LIMIT 1`;
    const regexPattern = `^[0-9]+-${baseURL}$`;  // Matches strings like "123-baseURL"

    connection.query(query, [regexPattern], (err, results) => {
        if (err) { throw err; }

        if (results.length) {
            const matchedURL = results[0].url;
            const numberPart = matchedURL.split('-')[0];  // extract the number part
            callback(parseInt(numberPart, 10));
        } else {
            callback(0);
        }
    });
}






// INSERT
function insertArticle(article, callback) {
    let sanitizedUrl = sanitizeTitleForUrl(article.title);
    getUniqueUrl(sanitizedUrl, uniqueUrl => {
        connection.query('INSERT INTO newsArticles (title, url, image_path, content) VALUES (?, ?, ?, ?)',
            [article.title, uniqueUrl, article.image_path, article.content], (err, results) => {
                if (err) { throw err; }
                callback(results);
            });
    });
}



module.exports = { fetchArticlesForFooter, fetchAndRenderArticles, fetchAndRenderArticleDetails, insertArticle };