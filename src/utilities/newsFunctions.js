const connection = require('../config/database');



function sanitizeTitleForUrl(title) {
    return title.trim()
        .replace(/\s+/g, '-')  // replace spaces with hyphens
        .replace(/[^a-zA-Z0-9-]/g, '') // remove special characters except hyphens
        .toLowerCase();
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



module.exports = { insertArticle };