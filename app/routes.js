// load up the user model
var User = require('../app/models/user');

var fs = require('fs');
var path = require('path');
var FastSpring = require('./fastspring');

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

function checkIsValidDomain(domain) {
    var re = new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/);
    return domain.match(re);
}

module.exports = function (app, passport, nev) {
    var fastSpring = new FastSpring(app.locals.fastspring_config.login, app.locals.fastspring_config.password);

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function (req, res) {
        res.render('index.ejs');
    });

    app.get('/help', function (req, res) {
        res.render('help.ejs');
    });

    app.get('/private_policy', function (req, res) {
        res.render('private_policy.ejs');
    });

    app.get('/term_of_use', function (req, res) {
        res.render('term_of_use.ejs');
    });

    app.get('/anonim_users_downloads', function (req, res) {
        res.render('anonim_users_downloads.ejs');
        //res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    app.get('/registered_users_downloads', isLoggedIn, function (req, res) {
        res.render('registered_users_downloads.ejs');
    });

    app.get('/subscribed_users_downloads', function (req, res, next) {
        var subscr = req.user.getSubscription();
        if (!subscr) {
            res.redirect('/profile');
        }

        fastSpring.checkSubscriptionState('active', subscr.subscriptionId)
            .then(function (result) {
                if (result) {
                    return next();
                }

                res.redirect('/profile');
            }).catch(function (error) {
                res.redirect('/profile');
            });
    }, function (req, res) {
        res.render('subscribed_users_downloads.ejs');
    });

    app.get('/build_installer_request', User.checkSubscriptionStatus(app, 'active'), function (req, res) {
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
                        if (err) {
                            return done(err, []);
                        }

                        if (stat && stat.isDirectory()) {
                            walk(file, function (err, res) {
                                results = results.concat(res);
                                if (!--pending) {
                                    done(null, results);
                                }
                            });
                        } else {
                            var path = file.replace(app.locals.site.public_directory, '');
                            results.push({
                                'path': app.locals.site.domain + path,
                                'file_name': file_name,
                                'size': parseInt(stat.size / 1024)
                            });
                            if (!--pending) {
                                done(null, results);
                            }
                        }
                    });
                });
            });
        };

        walk(app.locals.site.users_directory + '/' + user.email, function (err, results) {
            if (err) {
                console.error(err);
            }

            res.render('build_installer_request.ejs', {
                user: user,
                builded_packages: results
            });
        });
    });

    // CLEAR user packages
    app.post('/clear_packages', User.checkSubscriptionStatus(app, 'active'), function (req, res) {
        var user = req.user;
        deleteFolderRecursive(app.locals.site.users_directory + '/' + user.email);
        res.render('build_installer_request.ejs', {
            user: user,
            builded_packages: []
        });
    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function (req, res) {
        var subscr = req.user.getSubscription();

        if (subscr) {
            fastSpring.getSubscription(subscr.subscriptionId)
                .then(function (data) {
                    var subscription = JSON.parse(data);

                    req.user.set({subscription_state: subscription.state});
                    req.user.save(function (err) {
                        if (err) {
                            console.error('getSubscription: ', err);
                        }
                    });

                    console.log('Success. Set subscription.');
                    res.render('profile.ejs', {
                        user: req.user,
                        message: req.flash('statusProfileMessage')
                    });
                }).catch(function (error) {
                    console.error('getSubscription: ', error);
                });
        } else {
            console.error('Not found `subscr`.', subscr);
            res.render('profile.ejs', {
                user: req.user,
                message: req.flash('statusProfileMessage')
            });
        }
    });

    // SUBSCRIPTION =============================
    app.post('/subscription', isLoggedIn, function (req, res) {
        var user = req.user;
        if (user.enableSubscription()) {
            var body = JSON.parse(req.body.data);

            if (body.hasOwnProperty('id') && body.hasOwnProperty('reference')) {
                // ===== fastSpring.getOrder
                fastSpring.getOrder(body.id)
                    .then(function (data) {
                        var order = JSON.parse(data);

                        if (order.hasOwnProperty('error')) {
                            return res.status(500).send('ERROR: Subscription was failed!');
                        }

                        if (!order.items.length) {
                            return res.status(500).send('ERROR: Subscription was failed!');
                        }

                        user.set({
                            subscription: JSON.stringify(Object.assign(body, {subscriptionId: order.items[0].subscription}))
                        });
                        user.save(function (err) {
                            if (err) {
                                return res.status(500).send('ERROR: Subscription was failed!');
                            }
                        });

                        res.status(200).send('SUCCESS: Subscription success!');
                    }).catch(function (error) {
                    console.error('getOrder: ', error);
                    return res.status(500).send('ERROR: Subscription was failed!');
                });
                // =====
            } else {
                return res.status(400).send('ERROR: Invalid data!');
            }
        } else {
            return res.status(500).send('ERROR: Subscription is already exist!');
        }
    })

    // CANCEL_SUBSCRIPTION ==============================
    app.post('/cancel_subscription', User.checkSubscriptionStatus(app, 'active'), function (req, res) {
        var user = req.user;
        var subscr = user.getSubscription();
        fastSpring.cancelSubscription(subscr.subscriptionId)
            .then(function (data) {
                var answer = JSON.parse(data);

                if (answer.result === 'error') {
                    throw new Error('Cancel subscription was failed.');
                }
                res.redirect('/profile');
            }).catch(function (error) {
            console.log('cancelSubscription: ', error);
        });
    })

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
            if (err) {
                return res.status(404).send('ERROR: sending confirmation email FAILED');
            }

            if (!user) {
                return res.status(404).send('ERROR: confirming temp user FAILED');
            }

            var email = user.email;
            console.log("confirm message sended to: " + email + ", error: " + err);
            res.render('after_confirm.ejs');
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

// Note: will be deleted
function isSubscribed(req, res, next) {
    if (req.user.getSubscriptionState() === 'active') {
        return next();
    }

    res.redirect('/profile');
}
