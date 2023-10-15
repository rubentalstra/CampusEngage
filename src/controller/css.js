const path = require('path');
const fs = require('fs');

let cssCache = null;  // Cache to store the modified CSS

exports.getCssStyles = async (req, res) => {
    let css = cssCache;
    if (!css) {
        const cssPath = path.join(__dirname, '../../public/css/zmefuq_main.css');
        css = await fs.promises.readFile(cssPath, 'utf8');  // Asynchronous file reading

        const settings = res.locals.commonFields.settings;

        const palette = settings.colorPalette.normal;
        css = css.replace(/#e50045/g, palette.normal);
        css = css.replace(/#cc003d/g, palette.dark);
        css = css.replace(/#b20036/g, palette.darker);

        const borderPalette = settings.colorPalette.border;
        css = css.replace(/#cc003d/g, borderPalette.normal);
        css = css.replace(/#8e002b/g, borderPalette.dark);
        css = css.replace(/#99002e/g, borderPalette.darker);

        css = css.replace(/logo-placehorder.png/g, settings.siteLogo);

        cssCache = css;  // Store the modified CSS in cache
    }

    res.type('text/css');
    return res.send(css);
};
