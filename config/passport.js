// load all the things we need
var LocalStrategy = require('passport-local').Strategy;

// load up the user model
var User = require('../app/models/user');

// load the auth variables
var configAuth = require('./auth'); // use this one for testing
var KickBox = require('../app/modules/kickbox'); // use this one for testing

var fs = require('fs');

function validateEmailInput(email) {
    var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function validateEmail(email, done) {
    var kickBox = new KickBox();
    var is_valid = validateEmailInput(email);

    if (!is_valid) {
        done('Invalid email input.');
        return;
    }

    var domain = email.split('@')[1];

    const dns = require('dns');
    dns.resolve(domain, 'MX', function (err, addresses) {
        if (err) {
            done(err);
            return
        }

        if (addresses && addresses.length > 0) {
            kickBox.verifyEmail(email)
                .then(function () {
                    done(null);
                }).catch(function (err) {
                done(err);
            });
            return
        }
        done('Can\'t resolve domain.');
    });
}

module.exports = function (nev, passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    }, function (req, email, password, done) {
        if (!email) {
            return done(null, false, req.flash('loginMessage', 'Invalid input.'));
        }

        email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
        var is_valid = validateEmailInput(email);
        if (!is_valid) {
            return done(null, false, req.flash('loginMessage', 'Invalid email: ' + email + '.'));
        }

        User.findOne({'email': email}, function (err, user) {
            // if there are any errors, return the error
            if (err) {
                return done(err);
            }

            // if no user is found, return the message
            if (!user) {
                return done(null, false, req.flash('loginMessage', 'Not found user with email: ' + email + '.'));
            }

            if (!user.validPassword(password)) {
                return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.'));
            }

            return done(null, user);
        });
    }));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
    }, function (req, email, password, done) {
        if (!email) {
            return done(null, false, req.flash('signupMessage', 'Invalid input.'));
        }
        email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
        validateEmail(email, function (err) {
            if (err) {
                return done(null, false, req.flash('signupMessage', 'Invalid email: ' + email + '.'));
            }

            var new_user = new User();
            new_user.email = email;
            new_user.password = new_user.generateHash(password);
            new_user.first_name = req.body.firstName.trim();
            new_user.last_name = req.body.lastName.trim();
            new_user.email_subscription = req.body.mailSubscribe;
            nev.createTempUser(new_user, function (err, existingPersistentUser, newTempUser) {
                // some sort of error
                if (err) {
                    return done(null, false, req.flash('signupMessage', err));
                }

                // user already exists in persistent collection...
                if (existingPersistentUser) {
                    return done(null, false, req.flash('signupMessage', 'User with email:' + email + ' already exists.'));
                }
                // a new user
                if (newTempUser) {
                    var URL = newTempUser[nev.options.URLFieldName];
                    nev.sendVerificationEmail(email, URL, function (err, info) {
                        console.log("verify email message sended to: " + email + ", error: " + err);
                        if (err) {
                            return done(err);
                        }

                        // Note: create folder
                        var dir = './public/users/' + email;
                        if (!fs.existsSync(dir)){
                            fs.mkdirSync(dir);
                        }

                        return done(null, false, req.flash('signupMessage', 'Please check ' + email + ' to verify your account.'));
                    });
                    // user already exists in temporary collection...
                } else {
                     return done(null, false, req.flash('signupMessage', 'You have already signed up. Please check your email to verify your account.'));
                    // flash message of failure...
                }
            });
        });
    }));
};
