const moment = require('moment');

function timeDifference(date) {
    const now = moment();
    const articleDate = moment(date);

    const yearsDiff = now.diff(articleDate, 'years');
    if (yearsDiff >= 1) {
        return `${yearsDiff} jaar geleden`;
    }

    const monthsDiff = now.diff(articleDate, 'months');
    if (monthsDiff >= 1) {
        return `${monthsDiff} maand${monthsDiff > 1 ? 'en' : ''} geleden`;
    }

    const weeksDiff = now.diff(articleDate, 'weeks');
    if (weeksDiff >= 1) {
        return `${weeksDiff} week${weeksDiff > 1 ? 'en' : ''} geleden`;
    }

    const daysDiff = now.diff(articleDate, 'days');
    if (daysDiff >= 1) {
        return `${daysDiff} dag${daysDiff > 1 ? 'en' : ''} geleden`;
    }

    const hoursDiff = now.diff(articleDate, 'hours');
    if (hoursDiff >= 1) {
        return `${hoursDiff} uur geleden`;
    }

    const minutesDiff = now.diff(articleDate, 'minutes');
    if (minutesDiff >= 1) {
        return `${minutesDiff} minuut${minutesDiff > 1 ? 'en' : ''} geleden`;
    }

    return 'zojuist';
}

module.exports = timeDifference;

// Then use this function to calculate the difference for each article's date.
// For instance:
// const dateString = timeDifference(article.date);
