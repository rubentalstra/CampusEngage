function isAuth(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    }
    else {
        res.redirect('/notAuthorized');
    }
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin == 1) {
        next();
    }
    else {
        res.redirect('/notAuthorizedAdmin');
    }
}

// Middleware to ensure 2FA is verified before accessing protected routes
function ensure2fa(req, res, next) {
    if (req.user.hasFA) { // If the user has 2FA set up.
        if (req.session.is2faVerified) {
            // If user has set up 2FA and is verified, allow access.
            return next();
        }
        // Otherwise, redirect for 2FA token prompt.
        res.redirect('/prompt-2fa');
    } else {
        // If the user hasn't set up 2FA, allow access.
        next();
    }
}

module.exports = { isAuth, isAdmin, ensure2fa };
