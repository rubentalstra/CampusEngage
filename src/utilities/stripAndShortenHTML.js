
function stripAndShortenHTML(html) {
    const strippedText = html.replace(/<[^>]*>?/gm, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/(\r?\n|\r)+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // const lowerText = strippedText.toLowerCase();
    return strippedText.length <= 293 ? strippedText : strippedText.substring(0, 290) + '...';
}

module.exports = stripAndShortenHTML;