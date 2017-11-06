// load up the user model
var User = require('../app/models/user');

var fs = require('fs');
var path = require('path');

function checkIsValidDomain(domain) {
    var re = new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/);
    return domain.match(re);
}

module.exports = function (app, passport, nev) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function (req, res) {
        res.render('index.ejs');
    });

    app.get('/download', function (req, res) {
        res.render('download.ejs');
    });

    app.get('/help', function (req, res) {
        res.render('help.ejs');
    });

    app.get('/download_p', function (req, res) {
        res.render('download_p.ejs');
    });

    app.get('/build_installer_request', function (req, res) {
        var user = req.user;
        var walk = function (dir, done) {
            console.log('scan folder: ', dir);
            var results = [];
            fs.readdir(dir, function (err, list) {
                if (err) {
                    return done(err, []);
                }
                var pending = list.length;
                if (!pending) {
                    return done(null, results);
                }
                list.forEach(function (file) {
                    var file_name = file;
                    file = path.resolve(dir, file);
                    fs.stat(file, function (err, stat) {
                        if (stat && stat.isDirectory()) {
                        } else {
                            var path = file.replace(app.locals.site.public_directory, '');
                            results.push({'path': path, 'file_name': file_name});
                            if (!--pending) {
                                done(null, results);
                            }
                        }
                    });
                });
            });
        };

        walk(app.locals.site.users_directory + '/' + user.local.email, function (err, results) {
            if (err) {
                console.error(err);
            }

            res.render('build_installer_request.ejs', {
                user: user,
                builded_packages: results
            });
        });

    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function (req, res) {
        res.render('profile.ejs', {
            user: req.user,
            message: req.flash('statusProfileMessage')
        });
    });

    // LOGOUT ==============================
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
    // LOGIN ===============================
    // show the login form
    app.get('/login', function (req, res) {
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/login', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    // SIGNUP =================================
    // show the signup form
    app.get('/signup', function (req, res) {
        res.render('signup.ejs', {message: req.flash('signupMessage')});
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/signup', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));


    // user accesses the link that is sent
    app.get('/email-verification/:URL', function (req, res) {
        var url = req.params.URL;
        nev.confirmTempUser(url, function (err, user) {
            if (user) {
                var email = user.email;
                nev.sendConfirmationEmail(email, function (err, info) {
                    console.log("confirm message sended to: " + email + ", error: " + err);
                    if (err) {
                        return res.status(404).send('ERROR: sending confirmation email FAILED');
                    }

                    updateRedisUser(user, function (err, user) {
                        if (err) {
                            return res.status(404).send('ERROR: save into cache');
                        }
                        res.render('after_confirm.ejs');
                    });
                });
            } else {
                return res.status(404).send('ERROR: confirming temp user FAILED');
            }
        });
    });

    app.get('/after_confirm', function (req, res) {
        res.render('after_confirm.ejs');
    });

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
    app.get('/connect/local', function (req, res) {
        res.render('connect_local.ejs', {message: req.flash('loginMessage')});
    });
    app.post('/connect/local', passport.authenticate('local-signup', {
        successRedirect: '/profile', // redirect to the secure profile section
        failureRedirect: '/connect/local', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}
