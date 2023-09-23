const multer = require('multer');

const storage = multer.diskStorage({
    destination: './uploads/user-profile/',
    filename: (req, file, cb) => {
        cb(null, `${req.user.id}.png`);
    }
});

const upload = multer({ storage: storage });


module.exports = upload;