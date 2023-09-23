
exports.getHomePage = (req, res) => {
    if (req.isAuthenticated()) {
        // If they are authenticated, redirect to user-dashboard
        return res.redirect('/user-dashboard');
    }

    // If not authenticated, show the home page
    return res.send('<h1>Home</h1><p>Please <a href="/register">register</a></p>');
};
