export function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        next();
    } else {
        req.session.returnUrl = req.originalUrl;
        res.redirect('/account/signin');
    }
}
export function isSeller(req, res, next) {
    if (req.session.authUser.role === "seller") {
        next();
    } else {
        res.render('403');

    }
}
export function isAdmin(req, res, next) {
    if (req.session.authUser.role === "admin") {
        next();
    } else {
        res.render('403');
    }
}