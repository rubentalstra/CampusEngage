const query = require('../../config/database-all');
const timeDifference = require('../../utilities/timeDifference');



exports.fetchArticlesForFooter = async (req, res) => {
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
};