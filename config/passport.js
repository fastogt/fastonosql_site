// load all the things we need
var LocalStrategy = require('passport-local').Strategy;

// https://php-academy.kiev.ua/uk/blog/site-authentication-in-nodejs-user-signup

// load up the user model
var User = require('../app/models/user');
var validate_email = require('../app/modules/validate_email'); // use this one for testing

module.exports = function (nev, passport, banned_domains) {

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
            req.flash('error', 'Invalid input.');
            return done(null, false);
        }

        email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching
        var is_valid = validate_email.validateEmailInput(email);
        if (!is_valid) {
            req.flash('error', 'Invalid email: ' + email + '.');
            return done(null, false);
        }


        User.findOne({'email': email}, function (err, user) {
            // if there are any errors, return the error
            if (err) {
                req.flash('error', err);
                return done(err);
            }

            // if no user is found, return the message
            if (!user) {
                req.flash('error', 'Not found user with email: ' + email + '.');
                return done(null, false);
            }

            if (!user.validPassword(password)) {
                req.flash('error', 'Oops! Wrong password.');
                return done(null, false);
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
            req.flash('error', 'Invalid input.');
            return done(null, false);
        }


        for (i = 0; i < banned_domains.length; ++i) {
            if (email.endsWith('@' + banned_domains[i])) {
                req.flash('error', 'Banned domain, please go to manager and ask him to buy licenses.');
                return done(null, false);
            }
        }

        validate_email.validateEmail(email, function (err) {
            if (err) {
                req.flash('error', 'Invalid email: ' + email + ', (error: ' + err + ').');
                return done(null, false);
            }

            var new_user = new User();
            new_user.email = email;
            new_user.password = new_user.generateHash(password);
            new_user.first_name = req.body.first_name.trim();
            new_user.last_name = req.body.last_name.trim();
            new_user.country = req.body.country;
            var email_subscription = false;
            if (req.body.hasOwnProperty('mail_subscribe')) {
                email_subscription = true;
            }
            new_user.email_subscription = email_subscription;

            nev.createTempUser(new_user, function (err, existingPersistentUser, newTempUser) {
                // some sort of error
                if (err) {
                    req.flash('error', err);
                    return done(null, false);
                }

                // user already exists in persistent collection...
                if (existingPersistentUser) {
                    req.flash('error', 'User with email:' + email + ' already exists.');
                    return done(null, false);
                }
                // a new user
                if (newTempUser) {
                    var URL = newTempUser[nev.options.URLFieldName];
                    nev.sendVerificationEmail(email, URL, function (err, info) {
                        console.log("verify email message sent to: " + email + ", error: " + err);
                        if (err) {
                            return done(err);
                        }

                        req.flash('success', 'Please check ' + email + ' to verify your account (can be in spam folder).');
                        return done(null, false);
                    });
                    // user already exists in temporary collection...
                } else {
                    req.flash('error', 'You have already signed up. Please check your email to verify your account.');
                    return done(null, false);
                    // flash message of failure...
                }
            });
        });
    }));
};
