function isAuth(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    }
    else {
        res.redirect('/notAuthorized');
    }
}

function ensureAuthenticatedUser(req, res, next) {
    if (req.isAuthenticated() && req.session.userType === 'user') {
        return next();
    }
    res.redirect('/user/login');
}

function ensureAuthenticatedAdmin(req, res, next) {

    // console.log(req.session.name);
    if (req.isAuthenticated() && req.session.userType === 'admin') {
        return next();
    }
    res.redirect('/admin/login');
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
function userEnsure2fa(req, res, next) {
    if (req.user.hasFA) { // If the user has 2FA set up.
        if (req.session.is2faVerified && req.session.userType === 'user') {
            // If user has set up 2FA and is verified, allow access.
            return next();
        }
        // Otherwise, redirect for 2FA token prompt.
        res.redirect('/user/prompt-2fa');
    } else {
        // If the user hasn't set up 2FA, allow access.
        next();
    }
}

// Middleware to ensure 2FA is verified before accessing protected routes
function adminEnsure2fa(req, res, next) {
    console.log(req.session.userType);
    if (req.user.hasFA) { // If the user has 2FA set up.
        if (req.session.is2faVerified && req.session.userType === 'admin') {
            // If user has set up 2FA and is verified, allow access.
            return next();
        }
        // Otherwise, redirect for 2FA token prompt.
        res.redirect('/admin/prompt-2fa');
    } else {
        // If the user hasn't set up 2FA, allow access.
        next();
    }
}

module.exports = { isAuth, isAdmin, ensureAuthenticatedUser, ensureAuthenticatedAdmin, userEnsure2fa, adminEnsure2fa };
