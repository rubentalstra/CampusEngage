const { URL } = require('url');

function isValidRedirectURL(redirectURL) {
    let parsedUrl;

    try {
        parsedUrl = new URL(redirectURL);
    } catch (e) {
        return false;
    }

    // Check the protocol
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
    }

    // Ensure the hostname matches a trusted domain
    if (!['localhost'].includes(parsedUrl.hostname)) {
        return false;
    }

    // Disallow URLs that have user info
    if (parsedUrl.username || parsedUrl.password) {
        return false;
    }

    return true;
}


module.exports = isValidRedirectURL;