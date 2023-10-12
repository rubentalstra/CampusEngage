const path = require('path');
const fs = require('fs');

exports.getCssStyles = (req, res) => {
    const cssPath = path.join(__dirname, '../../public/css/zmefuq_main.css');
    let css = fs.readFileSync(cssPath, 'utf8');
    // Replace the old color with the new one from settings
    // Replace colors with those from settings
    const palette = res.locals.settings.colorPalette.normal;
    css = css.replace(/#e50045/g, palette.normal);
    css = css.replace(/#cc003d/g, palette.dark);
    css = css.replace(/#b20036/g, palette.darker);

    const borderPalette = res.locals.settings.colorPalette.border;
    css = css.replace(/#cc003d/g, borderPalette.normal);
    css = css.replace(/#8e002b/g, borderPalette.dark);
    css = css.replace(/#99002e/g, borderPalette.darker);

    css = css.replace(/logo-placehorder.png/g, res.locals.settings.siteLogo);


    res.type('text/css');
    return res.send(css);
};
