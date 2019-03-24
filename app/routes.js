// load up the user model
var User = require('./models/user');
var AnonymousStatistic = require('./models/anonymous_statistic');

var fs = require('fs');
var path_module = require('path');
var FastSpring = require('./modules/fastspring');
var scheduler = require('node-schedule');
const {UserType, ApplicationState} = require('./models/user');
// global
var stat = {
    "exec_count": 0,
    "registered_users": 0,
    "active_users": 0,
    "banned_users": 0,
    "supported_users": 0,
    "statistics": {
        "data": [1, 1, 1],
        "labels": ["\"Windows NT\"", "\"Mac OS X\"", "\"Linux\""],
        "colors": ["\"Red\"", "\"Green\"", "\"Blue\""]
    },
    "anonim_power": 0
};

scheduler.scheduleJob('0 * * * *', function () {
    var anonim_power = 0;
    AnonymousStatistic.count({}, function (err, count) {
        if (err) {
            return;
        }
        anonim_power = count;
    });
    User.find({}, function (err, users) {
        var exec_count = 0;
        var active_users = 0;
        var banned_users = 0;
        var registered_users = 0;
        var trial_finished = 0;
        var supported_users = 0;
        var statistics = {"data": [], "labels": [], "colors": []};
        var local_statistics = {};
        var colors = ['Red', 'Green', 'Blue', 'Brown', 'Orange', 'Yellow', 'Gray'];

        if (err) {
            console.error("Statistic error: ", err);
        } else {
            users.forEach(function (user) {
                var app_state = user.application_state;
                if (app_state === ApplicationState.ACTIVE) {
                    active_users += 1;
                } else if (app_state === ApplicationState.BANNED) {
                    banned_users += 1;
                } else if (app_state === ApplicationState.TRIAL_FINISHED) {
                    trial_finished += 1;
                }

                if (user.subscription || user.isPrimary()) {
                    supported_users += 1;
                }
                registered_users += 1;

                // statistics
                for (var i = 0; i < user.statistic.length; ++i) {
                    var stat = user.statistic[i];
                    if (!local_statistics.hasOwnProperty(stat.os.name)) {
                        local_statistics[stat.os.name] = 0;
                    }
                    local_statistics[stat.os.name] += 1;
                    exec_count += 1;
                }
            });
        }


        for (var key in local_statistics) {
            var value = local_statistics[key];
            statistics.data.push(value);
            statistics.labels.push('"' + key + '"');
            statistics.colors.push('"' + colors[statistics.data.length - 1] + '"');
        }

        stat = {
            "exec_count": exec_count,
            "registered_users": registered_users,
            "active_users": active_users,
            "banned_users": banned_users,
            "supported_users": supported_users,
            "statistics": statistics,
            "anonim_power": anonim_power
        };
    });
});

function deleteFolderRecursive(path) {
    if (!fs.existsSync(path)) {
        return;
    }

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

module.exports = function (app, passport, nev) {
    var fastSpring = new FastSpring(app.locals.fastspring_config.login, app.locals.fastspring_config.password);

    function walk(dir, done) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

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
                file = path_module.resolve(dir, file);
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
    }

    // Note: remove user
    function removeUser(user, res) {
        deleteFolderRecursive(app.locals.site.users_directory + '/' + user.email);
        user.remove(function (err) {
            if (!err) {
                res.redirect('/logout');
            } else {
                res.redirect('/profile');
            }
        })
    }

    // normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function (req, res) {
        res.render('index.ejs', {statistics: stat});
    });

    app.get('/help', function (req, res) {
        res.render('help.ejs');
    });

    app.get('/community_about_us', function (req, res) {
        res.render('community_about_us.ejs');
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

    app.get('/pro_users_downloads', function (req, res) {
        res.render('pro_users_downloads.ejs');
        //res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    app.get('/registered_users_downloads', isLoggedIn, function (req, res) {
        res.render('registered_users_downloads.ejs');
    });

    app.get('/build_installer_request', isLoggedIn, function (req, res) {
        var user = req.user;
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
    app.post('/clear_packages', isLoggedIn, function (req, res) {
        var user = req.user;
        deleteFolderRecursive(app.locals.site.users_directory + '/' + user.email);
        res.render('build_installer_request.ejs', {
            user: user,
            builded_packages: []
        });
    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function (req, res) {
        var user = req.user;
        if (user.country === '') {
            var ip_info = req.ipInfo;
            user.country = ip_info.country;
        }

        var user_dir_path = app.locals.site.users_directory + '/' + user.email;
        walk(user_dir_path, function (err, results) {
            if (err) {
                console.error(err);
            }

            var subscr = user.getSubscription();
            if (subscr) {
                fastSpring.getSubscription(subscr.subscriptionId)
                    .then(function (data) {
                        var subscription = JSON.parse(data);
                        user.subscription_state = subscription.state;
                        user.last_login_date = new Date();
                        user.save(function (err) {
                            if (err) {
                                console.error('save user subscription state error: ', err);
                            }
                        });

                        res.render('profile.ejs', {
                            user: user,
                            packages: results
                        });
                    }).catch(function (error) {
                    console.error('getSubscription: ', error);
                });
            } else {
                user.last_login_date = new Date();
                user.save(function (err) {
                    if (err) {
                        console.error('save last_login_date error: ', err);
                    }
                });
                res.render('profile.ejs', {
                    user: user,
                    packages: results
                });
            }
        });
    });

    app.post('/updateProfile', isLoggedIn, function (req, res) {
        var user = req.user;

        // Note: manage password.
        if (req.body.currentPassword) {
            if (!user.validPassword(req.body.currentPassword)) {
                req.flash('error', 'Invalid password!');
                res.redirect('/profile');
                return;
            }

            if (req.body.newPassword && req.body.newPassword !== req.body.repeatPassword) {
                req.flash('error', 'The passwords are different!');
                res.redirect('/profile');
                return;
            }

            user.set({
                password: user.generateHash(req.body.newPassword)
            });
        }

        user.set({
            first_name: req.body.first_name.trim(),
            last_name: req.body.last_name.trim()
        });

        user.save(function (err) {
            if (err) {
                req.flash('error', err);
                res.redirect('/profile');
                return;
            }

            req.flash('success', 'Information was successfully saved');
            res.redirect('/profile');
        });
    });

    app.get('/deleteProfile', isLoggedIn, function (req, res) {
        var user = req.user;
        removeUser(user, res);
    });

    // PRODUCT =============================
    app.post('/product', isLoggedIn, function (req, res) {
        var user = req.user;
        var body = JSON.parse(req.body.data);
        if (body.hasOwnProperty('id') && body.hasOwnProperty('reference')) {
            user.type = UserType.PERMANENT;
            user.save(function (err) {
                if (err) {
                    return res.status(500).send('ERROR: Buy product was failed!');
                }
            });

            return res.status(200).send('SUCCESS: Buy product success!');
        } else {
            return res.status(400).send('ERROR: Invalid data!');
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
                        console.log('***Subscription order: ', order);
                        if (order.hasOwnProperty('error')) {
                            console.error('Order error: ', order.error);
                            return res.status(500).send('ERROR: Subscription was failed!');
                        }

                        if (!order.items.length) {
                            console.error('Order invalid length items.');
                            return res.status(500).send('ERROR: Subscription was failed!');
                        }

                        user.set({
                            application_state: ApplicationState.ACTIVE,
                            subscription: JSON.stringify(Object.assign(body, {subscriptionId: order.items[0].subscription}))
                        });
                        user.save(function (err) {
                            if (err) {
                                console.error('Save subscription error: ', err);
                                return res.status(500).send('ERROR: Subscription was failed!');
                            }
                        });

                        console.log('***Subscription SUCCESS!');
                        res.status(200).send('SUCCESS: Subscription success!');
                    }).catch(function (error) {
                    console.error('subscription catch: ', error);
                    return res.status(500).send('ERROR: Subscription was failed!');
                });
                // =====
            } else {
                console.error('Body invalid data');
                return res.status(400).send('ERROR: Invalid data!');
            }
        } else {
            console.error('Subscription is already exist!');
            return res.status(500).send('ERROR: Subscription is already exist!');
        }
    });

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
                setTimeout(function () { // Note: redirect with timeout. Profile page not render with new data from fastspring...
                    res.redirect('/profile');
                }, 5000);
            }).catch(function (error) {
            console.log('cancelSubscription: ', error);
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
        res.render('login.ejs');
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
        var ip_info = req.ipInfo;
        var countries = {
            'AF': 'Afghanistan',
            'AX': 'Åland Islands',
            'AL': 'Albania',
            'DZ': 'Algeria',
            'AS': 'American Samoa',
            'AD': 'Andorra',
            'AO': 'Angola',
            'AI': 'Anguilla',
            'AQ': 'Antarctica',
            'AG': 'Antigua and Barbuda',
            'AR': 'Argentina',
            'AM': 'Armenia',
            'AW': 'Aruba',
            'AU': 'Australia',
            'AT': 'Austria',
            'AZ': 'Azerbaijan',
            'BS': 'Bahamas',
            'BH': 'Bahrain',
            'BD': 'Bangladesh',
            'BB': 'Barbados',
            'BY': 'Belarus',
            'BE': 'Belgium',
            'BZ': 'Belize',
            'BJ': 'Benin',
            'BM': 'Bermuda',
            'BT': 'Bhutan',
            'BO': 'Bolivia, Plurinational State of',
            'BQ': 'Bonaire, Sint Eustatius and Saba',
            'BA': 'Bosnia and Herzegovina',
            'BW': 'Botswana',
            'BV': 'Bouvet Island',
            'BR': 'Brazil',
            'IO': 'British Indian Ocean Territory',
            'BN': 'Brunei Darussalam',
            'BG': 'Bulgaria',
            'BF': 'Burkina Faso',
            'BI': 'Burundi',
            'KH': 'Cambodia',
            'CM': 'Cameroon',
            'CA': 'Canada',
            'CV': 'Cape Verde',
            'KY': 'Cayman Islands',
            'CF': 'Central African Republic',
            'TD': 'Chad',
            'CL': 'Chile',
            'CN': 'China',
            'CX': 'Christmas Island',
            'CC': 'Cocos (Keeling) Islands',
            'CO': 'Colombia',
            'KM': 'Comoros',
            'CG': 'Congo',
            'CD': 'Congo, the Democratic Republic of the',
            'CK': 'Cook Islands',
            'CR': 'Costa Rica',
            'CI': 'Côte d\'Ivoire',
            'HR': 'Croatia',
            'CU': 'Cuba',
            'CW': 'Curaçao',
            'CY': 'Cyprus',
            'CZ': 'Czech Republic',
            'DK': 'Denmark',
            'DJ': 'Djibouti',
            'DM': 'Dominica',
            'DO': 'Dominican Republic',
            'EC': 'Ecuador',
            'EG': 'Egypt',
            'SV': 'El Salvador',
            'GQ': 'Equatorial Guinea',
            'ER': 'Eritrea',
            'EE': 'Estonia',
            'ET': 'Ethiopia',
            'FK': 'Falkland Islands (Malvinas)',
            'FO': 'Faroe Islands',
            'FJ': 'Fiji',
            'FI': 'Finland',
            'FR': 'France',
            'GF': 'French Guiana',
            'PF': 'French Polynesia',
            'TF': 'French Southern Territories',
            'GA': 'Gabon',
            'GM': 'Gambia',
            'GE': 'Georgia',
            'DE': 'Germany',
            'GH': 'Ghana',
            'GI': 'Gibraltar',
            'GR': 'Greece',
            'GL': 'Greenland',
            'GD': 'Grenada',
            'GP': 'Guadeloupe',
            'GU': 'Guam',
            'GT': 'Guatemala',
            'GG': 'Guernsey',
            'GN': 'Guinea',
            'GW': 'Guinea-Bissau',
            'GY': 'Guyana',
            'HT': 'Haiti',
            'HM': 'Heard Island and McDonald Islands',
            'VA': 'Holy See (Vatican City State)',
            'HN': 'Honduras',
            'HK': 'Hong Kong',
            'HU': 'Hungary',
            'IS': 'Iceland',
            'IN': 'India',
            'ID': 'Indonesia',
            'IR': 'Iran, Islamic Republic of',
            'IQ': 'Iraq',
            'IE': 'Ireland',
            'IM': 'Isle of Man',
            'IL': 'Israel',
            'IT': 'Italy',
            'JM': 'Jamaica',
            'JP': 'Japan',
            'JE': 'Jersey',
            'JO': 'Jordan',
            'KZ': 'Kazakhstan',
            'KE': 'Kenya',
            'KI': 'Kiribati',
            'KP': 'Korea, Democratic People\'s Republic of',
            'KR': 'Korea, Republic of',
            'KW': 'Kuwait',
            'KG': 'Kyrgyzstan',
            'LA': 'Lao People\'s Democratic Republic',
            'LV': 'Latvia',
            'LB': 'Lebanon',
            'LS': 'Lesotho',
            'LR': 'Liberia',
            'LY': 'Libya',
            'LI': 'Liechtenstein',
            'LT': 'Lithuania',
            'LU': 'Luxembourg',
            'MO': 'Macao',
            'MK': 'Macedonia, the former Yugoslav Republic of',
            'MG': 'Madagascar',
            'MW': 'Malawi',
            'MY': 'Malaysia',
            'MV': 'Maldives',
            'ML': 'Mali',
            'MT': 'Malta',
            'MH': 'Marshall Islands',
            'MQ': 'Martinique',
            'MR': 'Mauritania',
            'MU': 'Mauritius',
            'YT': 'Mayotte',
            'MX': 'Mexico',
            'FM': 'Micronesia, Federated States of',
            'MD': 'Moldova, Republic of',
            'MC': 'Monaco',
            'MN': 'Mongolia',
            'ME': 'Montenegro',
            'MS': 'Montserrat',
            'MA': 'Morocco',
            'MZ': 'Mozambique',
            'MM': 'Myanmar',
            'NA': 'Namibia',
            'NR': 'Nauru',
            'NP': 'Nepal',
            'NL': 'Netherlands',
            'NC': 'New Caledonia',
            'NZ': 'New Zealand',
            'NI': 'Nicaragua',
            'NE': 'Niger',
            'NG': 'Nigeria',
            'NU': 'Niue',
            'NF': 'Norfolk Island',
            'MP': 'Northern Mariana Islands',
            'NO': 'Norway',
            'OM': 'Oman',
            'PK': 'Pakistan',
            'PW': 'Palau',
            'PS': 'Palestinian Territory, Occupied',
            'PA': 'Panama',
            'PG': 'Papua New Guinea',
            'PY': 'Paraguay',
            'PE': 'Peru',
            'PH': 'Philippines',
            'PN': 'Pitcairn',
            'PL': 'Poland',
            'PT': 'Portugal',
            'PR': 'Puerto Rico',
            'QA': 'Qatar',
            'RE': 'Réunion',
            'RO': 'Romania',
            'RU': 'Russian Federation',
            'RW': 'Rwanda',
            'BL': 'Saint Barthélemy',
            'SH': 'Saint Helena, Ascension and Tristan da Cunha',
            'KN': 'Saint Kitts and Nevis',
            'LC': 'Saint Lucia',
            'MF': 'Saint Martin (French part)',
            'PM': 'Saint Pierre and Miquelon',
            'VC': 'Saint Vincent and the Grenadines',
            'WS': 'Samoa',
            'SM': 'San Marino',
            'ST': 'Sao Tome and Principe',
            'SA': 'Saudi Arabia',
            'SN': 'Senegal',
            'RS': 'Serbia',
            'SC': 'Seychelles',
            'SL': 'Sierra Leone',
            'SG': 'Singapore',
            'SX': 'Sint Maarten (Dutch part)',
            'SK': 'Slovakia',
            'SI': 'Slovenia',
            'SB': 'Solomon Islands',
            'SO': 'Somalia',
            'ZA': 'South Africa',
            'GS': 'South Georgia and the South Sandwich Islands',
            'SS': 'South Sudan',
            'ES': 'Spain',
            'LK': 'Sri Lanka',
            'SD': 'Sudan',
            'SR': 'Suriname',
            'SJ': 'Svalbard and Jan Mayen',
            'SZ': 'Swaziland',
            'SE': 'Sweden',
            'CH': 'Switzerland',
            'SY': 'Syrian Arab Republic',
            'TW': 'Taiwan, Province of China',
            'TJ': 'Tajikistan',
            'TZ': 'Tanzania, United Republic of',
            'TH': 'Thailand',
            'TL': 'Timor-Leste',
            'TG': 'Togo',
            'TK': 'Tokelau',
            'TO': 'Tonga',
            'TT': 'Trinidad and Tobago',
            'TN': 'Tunisia',
            'TR': 'Turkey',
            'TM': 'Turkmenistan',
            'TC': 'Turks and Caicos Islands',
            'TV': 'Tuvalu',
            'UG': 'Uganda',
            'UA': 'Ukraine',
            'AE': 'United Arab Emirates',
            'GB': 'United Kingdom',
            'US': 'United States',
            'UM': 'United States Minor Outlying Islands',
            'UY': 'Uruguay',
            'UZ': 'Uzbekistan',
            'VU': 'Vanuatu',
            'VE': 'Venezuela, Bolivarian Republic of',
            'VN': 'Viet Nam',
            'VG': 'Virgin Islands, British',
            'VI': 'Virgin Islands, U.S.',
            'WF': 'Wallis and Futuna',
            'EH': 'Western Sahara',
            'YE': 'Yemen',
            'ZM': 'Zambia',
            'ZW': 'Zimbabwe'
        };
        res.render('signup.ejs', {country: ip_info.country, countries: countries});
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
                console.error(err);
                return res.status(404).send('ERROR: sending confirmation email FAILED');
            }

            if (!user) {
                return res.status(404).send('ERROR: confirming temp user FAILED');
            }

            var email = user.email;

            // user folder
            var dir = app.locals.site.users_directory + '/' + user.email;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            console.log("confirm message sent to: " + email);
            res.render('after_confirm.ejs');
        });
    });

    app.get('/after_confirm', function (req, res) {
        res.render('after_confirm.ejs');
    });

    app.get('/welcome_callback', function (req, res) {
        res.render('welcome/welcome_callback.ejs');
    });

    app.get('/welcome_pro_callback', function (req, res) {
        res.render('welcome/welcome_pro_callback.ejs');
    });

    app.get('/welcome_enterprise_callback', function (req, res) {
        res.render('welcome/welcome_enterprise_callback.ejs');
    });

    app.get('/refresh_subscriptions', isLoggedInAndSupport, function (req, res) {
        User.find({}, function (err, users) {
            if (err) {
                res.status(200).send({error: err});
                return;
            }

            var emails = [];
            users.forEach(function (user) {
                var subscr = user.getSubscription();
                if (subscr) {
                    fastSpring.getSubscription(subscr.subscriptionId)
                        .then(function (data) {
                            var subscription = JSON.parse(data);
                            if (user.subscription_state !== subscription.state) {
                                user.subscription_state = subscription.state;
                                user.save(function (err) {
                                    if (err) {
                                        console.error('save user subscription state error: ', err);
                                    }
                                });
                            }
                            emails.push(user.email);
                            console.log(user.email);
                        }).catch(function (error) {
                            console.error('getSubscription: ', error);
                        }
                    );
                }
            });
            res.status(200).send({emails: emails});
        });
    });

    app.get('/fix_exec_0', isLoggedInAndSupport, function (req, res) {
        User.find({}, function (err, users) {
            if (err) {
                res.status(200).send({error: err});
                return;
            }

            var emails = [];
            users.forEach(function (user) {
                if (user.exec_count === 0 && user.statistic.length !== 0) {
                    user.exec_count = user.statistic.length;
                    user.save(function (err) {
                        if (err) {
                            console.error('save user exec_count state error: ', err);
                        }
                    });
                    emails.push(user.email);
                }
            });
            res.status(200).send({emails: emails});
        });
    });

    function not_found(res) {
        res.status(404).render('custom_404.ejs');
    }

    // seo 404
    app.get('/custom_404', function (req, res) {
        not_found(res);
    });

    app.get('*', function (req, res) {
        not_found(res)
    });
};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }

    res.redirect('/');
}

function isLoggedInAndSupport(req, res, next) {
    if (req.isAuthenticated()) {
        var user = req.user;
        if (user.type === UserType.SUPPORT) {
            return next();
        } else {
            res.redirect('/profile');
            return;
        }
    }

    res.redirect('/');
}