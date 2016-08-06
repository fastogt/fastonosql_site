// load up the user model
var User = require('../app/models/user');

var fs = require('fs');
var path = require('path');

function checkIsValidDomain(domain) { 
    var re = new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/); 
    return domain.match(re);
} 

module.exports = function(app, passport) {

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
        res.render('index.ejs');
    });

    app.get('/templates', function(req, res) {
        app.redis_connection.hgetall('templates', function(err, result) {
            if (err) {
                console.error(err);
            } else {
                var templates = [];
                for (var i in result) {
                    templates.push(JSON.parse(result[i]));
                }
                res.render('templates.ejs', {
                    templates: templates
                }); 
            }
        }); 
    });
    
    app.post('/server_details', function(req, res) {
        var user = req.user;        
        var domain_name = req.body.domain_name;
        
        res.render('server_details.ejs', {
            user : user,
            domain_name: domain_name
        });
    });
    
    app.get('/servers_status', function(req, res){
        User.find({"domains": { $exists: true, $ne: [] }} , function(err, all_users) {
            if (err) {
                console.error(err);
            } else {
                var domains = [];
                for (var i = 0; i < all_users.length; i++) {
                    var user_domains = all_users[i].domains;
                    for(var j = 0; j < user_domains.length; ++j){
                        domains.push({name : user_domains[j].name, created_date : user_domains[j].created_date} );
                    }
                }
    
                res.render('servers_status.ejs', {
                    domains: domains
                });
            }
        } ); 
    });
    
    // ADD DOMAIN 
    app.post('/add_domain', function(req, res) {
        var user = req.user;        
        var stable_domain = req.body.domain_name.replace(/^www\./ig, '');
        var new_domain = stable_domain.toLowerCase();
        
        if (!checkIsValidDomain(new_domain)) {
            req.flash('statusProfileMessage', new_domain + ' not valid domain name.');
            res.redirect('/profile');
            return;
        }
        
        User.findOne({'domains.name': new_domain}, function(err, fuser) {
            if (err) {
                req.flash('statusProfileMessage', err);
                res.redirect('/profile');
                return;
            }
            
            if (fuser) {
                req.flash('statusProfileMessage', 'Sorry, ' + new_domain + ' isn’t available.');
                res.redirect('/profile');
                return;
            }
            
            user.domains.push({name : new_domain, created_date : Date() });
            user.save(function(err) {
                if (err) {
                    req.flash('statusProfileMessage', err);
                } else {
                    var redis_hosts = []; // Create a new empty array.
                    for (var i = 0; i < user.domains.length; i++) {
                        redis_hosts[i] = user.domains[i].name;
                    }
                    var needed_val = { name : user.local.email, password : user.local.password, hosts : redis_hosts};
                    var needed_val_str = JSON.stringify(needed_val);
                    app.redis_connection.hset("users", user.local.email, needed_val_str);
                }
                res.redirect('/profile');
            });
        });
    });
    
    app.post('/build_server_request', function(req, res) {
        var user = req.user;        
        var domain_name = req.body.domain_name;        
        var walk = function(dir, done) {  
          console.log('scan folder: ', dir);
          var results = [];
          fs.readdir(dir, function(err, list) {
            if (err) return done(err);
            var pending = list.length;
            if (!pending) return done(null, results);
            list.forEach(function(file) {
              var file_name = file;
              file = path.resolve(dir, file);
              fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                } else {
                  var path = file.replace(app.locals.site.public_directory, '');
                  results.push({ 'path' : path, 'file_name' : file_name});
                  if (!--pending) done(null, results);
                }
              });
            });
          });
        };
        
        walk(app.locals.site.users_directory + '/' + user.local.email, function(err, results) {
          if (err) 
            console.error(err);
          
          res.render('build_server_request.ejs', {
            user : user,
            domain_name : domain_name,
            builded_packages : results
          });
        });
        
    });
    
    // REMOVE DOMAIN 
    app.post('/remove_domain', function(req, res) {
        var user = req.user;        
        var remove_domain_id = req.body.domain_id;   
        
        user.domains.pull({_id : remove_domain_id });
        user.save(function(err) {
            if (err) {
                req.flash('statusProfileMessage', err);
            } else {
                var redis_hosts = []; // Create a new empty array.
                for (var i = 0; i < user.domains.length; i++) {
                    redis_hosts[i] = user.domains[i].name;
                }
                var needed_val = { name : user.local.email, password : user.local.password, hosts : redis_hosts};
                var needed_val_str = JSON.stringify(needed_val);
                app.redis_connection.hset("users", user.local.email, needed_val_str);   
            }
            res.redirect('/profile');
        });
    });
    
    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function(req, res) {
        res.render('profile.ejs', {
            user : req.user,
            message: req.flash('statusProfileMessage')
        });
    });

    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
            res.render('login.ejs', { message: req.flash('loginMessage') });
        });

        // process the login form
        app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

        // SIGNUP =================================
        // show the signup form
        app.get('/signup', function(req, res) {
            res.render('signup.ejs', { message: req.flash('signupMessage') });
        });

        // process the signup form
        app.post('/signup', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/signup', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

        // handle the callback after facebook has authenticated the user
        app.get('/auth/facebook/callback',
            passport.authenticate('facebook', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

        // handle the callback after twitter has authenticated the user
        app.get('/auth/twitter/callback',
            passport.authenticate('twitter', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        // send to google to do the authentication
        app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

        // the callback after google has authenticated the user
        app.get('/auth/google/callback',
            passport.authenticate('google', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
        app.get('/connect/local', function(req, res) {
            res.render('connect-local.ejs', { message: req.flash('loginMessage') });
        });
        app.post('/connect/local', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));

    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

        // handle the callback after facebook has authorized the user
        app.get('/connect/facebook/callback',
            passport.authorize('facebook', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

        // handle the callback after twitter has authorized the user
        app.get('/connect/twitter/callback',
            passport.authorize('twitter', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        // send to google to do the authentication
        app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

        // the callback after google has authorized the user
        app.get('/connect/google/callback',
            passport.authorize('google', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        
        user.save(function(err) {
            if (err) {
                console.error(err);
            }
            res.redirect('/profile');
        });
    });

    // facebook -------------------------------
    app.get('/unlink/facebook', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.facebook.token = undefined;
        
        user.save(function(err) {
            if (err) {
                console.error(err);
            }
            res.redirect('/profile');
        });
    });

    // twitter --------------------------------
    app.get('/unlink/twitter', isLoggedIn, function(req, res) {
        var user           = req.user;
        user.twitter.token = undefined;
        
        user.save(function(err) {
            if (err) {
                console.error(err);
            }
            res.redirect('/profile');
        });
    });

    // google ---------------------------------
    app.get('/unlink/google', isLoggedIn, function(req, res) {
        var user          = req.user;
        user.google.token = undefined;
        
        user.save(function(err) {
            if (err) {
                console.error(err);
            }
            res.redirect('/profile');
        });
    });
};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/');
}
