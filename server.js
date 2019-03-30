function gen_routing_key(platform, arch) {
    return platform + '_' + arch;
}

// load configs
var config_db = require('./config/database.js');
var public_settings_config = require('./config/public_settings.js');
var settings_config = require('./config/settings.js');

const http_port = settings_config.http_server_port;
const app_host = public_settings_config.project.domain; // 'localhost';
const app_port = settings_config.app_port;

var root_abs_path = __dirname;
var public_dir_abs_path = root_abs_path + '/public';
var public_downloads_users_dir_abs_path = public_dir_abs_path + '/users';
// set up ======================================================================
// get all the tools we need
var express = require('express');
var expressip = require('express-ip');
var compression = require('compression');
var app = express();
var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);
var passport = require('passport');
var flash = require('connect-flash');
var amqp = require('amqp');
var mkdirp = require('mkdirp');
var util = require('util');
var json_rpc2 = require('json-rpc2');

var morgan = require('morgan');
var cookie_parser = require('cookie-parser');
var body_parser = require('body-parser');
var session = require('express-session');
var fs = require('fs');

// app_r
/*var http = require('http');
var server = http.createServer(app);*/
var https = require('https');
var server = https.createServer({
    key: fs.readFileSync(settings_config.ssl_key_path),
    cert: fs.readFileSync(settings_config.ssl_cert_path)
}, app);
var io = require('socket.io');
var listener = io.listen(server);

var nodemailer = require('nodemailer');

// settings
app.locals.site = {
    title: public_settings_config.site.name,
    version: public_settings_config.site.version,
    domain: public_settings_config.site.domain,
    keywords: public_settings_config.site.keywords,
    description: public_settings_config.site.description,
    small_description: public_settings_config.site.small_description,
    large_description: public_settings_config.site.large_description,
    public_directory: public_dir_abs_path,
    users_directory: public_downloads_users_dir_abs_path,

    google_analitics_token: public_settings_config.site.google_analitics_token,

    github_link: public_settings_config.site.github_link,
    github_issues_link: public_settings_config.site.github_issues_link,
    github_link_without_host: public_settings_config.site.github_link_without_host,

    support_email_service_host: settings_config.support_email_service_host,
    support_email_service_port: settings_config.support_email_service_port,
    support_email_service_secure: settings_config.support_email_service_secure,
    supported_databases: public_settings_config.site.supported_databases,
    support_email: settings_config.support_email,
    support_email_password: settings_config.support_email_password,
    notify_email: settings_config.notify_email
};
app.locals.project = {
    name: public_settings_config.project.name,
    name_lowercase: public_settings_config.project.name_lowercase,
    version: public_settings_config.project.version,
    domain: public_settings_config.project.domain,
    trial_days: public_settings_config.project.trial_days,
    price_per_month: public_settings_config.project.price_per_month,
    price_per_6_month: public_settings_config.project.price_per_6_month,
    price_per_year: public_settings_config.project.price_per_year,
    price_permanent: public_settings_config.project.price_permanent
};
app.locals.support = {
    name: public_settings_config.support.name,
    contact_email: public_settings_config.support.contact_email
};
app.locals.company = {
    name: public_settings_config.company.name,
    description: public_settings_config.company.description,
    domain: public_settings_config.company.domain,
    copyright: public_settings_config.company.copyright
};

app.locals.back_end = {
    socketio_port: settings_config.socketio_port
};

// fastspring
app.locals.fastspring_config = {
    login: settings_config.fastspring_login,
    password: settings_config.fastspring_password
};

// email
const transport_options = {
    host: app.locals.site.support_email_service_host,
    port: app.locals.site.support_email_service_port,
    secure: app.locals.site.support_email_service_secure, // secure:true for port 465, secure:false for port 587
    auth: {
        user: app.locals.site.support_email,
        pass: app.locals.site.support_email_password
    }, tls: {
        ciphers: 'SSLv3'
    }
};

// rabbitmq
var rabbit_connection = amqp.createConnection({
    host: settings_config.rabbitmq_host,
    login: settings_config.rabbitmq_login,
    password: settings_config.rabbitmq_password
});
rabbit_connection.on('error', function (err) {
    console.error("rabbit_connection.error:", err);
});
// Wait for connection to become established.
rabbit_connection.on('ready', function () {
    console.log("rabbit_connection ready for use!");
});

listener.on('connection', function (socket) {
    socket.on('publish_rabbitmq', function (msg) {
        var in_json = JSON.parse(msg);
        if (in_json.databases.length === 0) {
            var err = Error('At least one database must be selected!');
            console.error(err);
            socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
            socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
            return;
        }

        var user_package_dir = public_downloads_users_dir_abs_path + '/' + in_json.email;
        mkdirp(user_package_dir, function (err) {
            if (err) {
                console.error(err);
                socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
                socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
                return;
            }

            socket.emit('status_rabbitmq', {
                'email': in_json.email,
                'progress': 0,
                'message': 'Send request to build server'
            }); //

            var rpc = new (require('./app/modules/amqprpc'))(rabbit_connection);
            var branding_variables = '-DPRO_VERSION=ON -DBUILD_STRATEGY:STRING=' + in_json.strategy;
            if (in_json.strategy === 'public' || in_json.strategy === 'private') {
                branding_variables += ' -DUSER_LOGIN:STRING=' + in_json.email;
            }
            if (in_json.strategy === 'private') {
                branding_variables += ' -DUSER_PASSWORD:STRING=' + in_json.password + ' -DUSER_FIRST_NAME:STRING=' + in_json.first_name + ' -DUSER_LAST_NAME:STRING=' + in_json.last_name;
            }
            for (var i = 0; i < app.locals.site.supported_databases.length; ++i) {
                var sup_db = app.locals.site.supported_databases[i];
                var found = false;
                for (var j = 0; j < in_json.databases.length; ++j) {
                    var sel_db = in_json.databases[j];
                    if (sel_db === sup_db.name) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    branding_variables += util.format(' -D%s=ON', sup_db.option);
                } else {
                    branding_variables += util.format(' -D%s=OFF', sup_db.option);
                }
            }
            var request_data_json = {
                'branding_variables': branding_variables,
                'package_type': in_json.package_type,
                'destination': user_package_dir
            };
            var routing_key = gen_routing_key(in_json.platform, in_json.arch);
            console.log("request_data_json", request_data_json);
            console.log("routing_key", routing_key);

            rpc.makeRequest(routing_key, in_json.email, request_data_json, function (err, response) {
                    if (err) {
                        console.error(err);
                        socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
                        return;
                    }

                    console.log("response", response);
                    if (response.hasOwnProperty('error')) {
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'error': response.error});
                    } else {
                        var public_path = response.body.replace(public_dir_abs_path, '');
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'body': public_path});
                    }
                },
                function (response) {
                    socket.emit('status_rabbitmq', {
                        'email': in_json.email,
                        'progress': response.progress,
                        'message': response.status
                    }); //
                });
        });
    });
});

// configuration ===============================================================
mongoose.Promise = global.Promise;
mongoose.connect(config_db.url, {
    useMongoClient:true
});

// NEV configuration =====================
// our persistent user model
var User = require('./app/models/user');
const {UserType, ApplicationState} = require('./app/models/user');
var AnonymousStatistic = require('./app/models/anonymous_statistic');

nev.configure({
    persistentUserModel: User,
    expirationTime: 3600 * 24,

    verificationURL: app.locals.site.domain + '/email-verification/${URL}',
    transportOptions: transport_options,
    verifyMailOptions: {
        from: 'Do Not Reply <' + app.locals.site.support_email + '>',
        subject: 'Confirm your account',
        html: '<p>Please verify your <b>' + app.locals.site.title + '</b> account by clicking <a href="${URL}">this link</a>. If you are unable to do so, copy and paste the following link into your browser:</p><p>${URL}</p>' +
            '<p>We are always here to help if you have any questions or just want some guidance on getting started. <a href=mailto:' + app.locals.support.contact_email + '>Contact us</a><br>If you did not sign up for ' + app.locals.site.title + ', please ignore this email.</p>' +
            '<p><br>--<br><b>BR,</b><br><b>' + app.locals.company.name + ' Team</b></p>' +
            '<p>Our projects:<br><a href="https://fastonosql.com">https://fastonosql.com</a><br><a href="https://fastoredis.com">https://fastoredis.com</a><br><a href="https://fastotv.com">https://fastotv.com</a><br><a href="https://idealtrust.by">https://idealtrust.by</a><br><a href="https://fastogt.com">https://fastogt.com</a></p>',
        text: 'Please verify your account by clicking the following link, or by copying and pasting it into your browser: ${URL}'
    },
    shouldSendConfirmation: true,
    confirmMailOptions: {
        from: 'Do Not Reply <' + app.locals.site.support_email + '>',
        subject: 'Successfully verified!',
        html: '<p>Your <b>' + app.locals.site.title + '</b> account has been successfully verified.</p>' +
            '<p>We are always here to help if you have any questions or just want some guidance on getting started. <a href=mailto:' + app.locals.support.contact_email + '>Contact us</a></p>' +
            '<p><br>--<br><b>BR,</b><br><b>' + app.locals.company.name + ' Team</b></p>' +
            '<p>Our projects:<br><a href="https://fastonosql.com">https://fastonosql.com</a><br><a href="https://fastoredis.com">https://fastoredis.com</a><br><a href="https://fastotv.com">https://fastotv.com</a><br><a href="https://idealtrust.by">https://idealtrust.by</a><br><a href="https://fastogt.com">https://fastogt.com</a></p>',
        text: 'Your account has been successfully verified.'
    },

    emailFieldName: 'email',
    passwordFieldName: 'password'
}, function (err, options) {
    if (err) {
        console.log(err);
        return;
    }

    console.log('email-verification configured: ' + (typeof options === 'object'));
});

nev.generateTempUserModel(User, function (err, tempUserModel) {
    if (err) {
        console.log(err);
        return;
    }

    console.log('generated temp user model: ' + (typeof tempUserModel === 'function'));
});

require('./config/passport')(nev, passport); // pass passport for configuration

// set up our express application
app.use(compression());
app.use(express.static(public_dir_abs_path));
app.use(expressip().getIpInfoMiddleware);
app.use(morgan('dev')); // log every request to the console
app.use(cookie_parser()); // read cookies (needed for auth)
app.use(body_parser.json()); // get information from html forms
app.use(body_parser.urlencoded({extended: true}));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: app.locals.project.name_lowercase,
    resave: true,
    saveUninitialized: true
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session
app.use(function (req, res, next) {
    res.locals.success_messages = req.flash('success');
    res.locals.error_messages = req.flash('error');
    next();
});

// routes ======================================================================
require('./app/routes.js')(app, passport, nev); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(http_port);
console.log('Http server ready for requests');
server.listen(app.locals.back_end.socketio_port);

var json_rpc2_server = json_rpc2.Server.$create();
json_rpc2_server.on('error', function (err) {
    console.log(err);
});

function version(args, opt, callback) {
    callback(null, app.locals.project.version);
}

function statistic(args, opt, callback) {
    if (!args || !args.hasOwnProperty('os') || !args.hasOwnProperty('project') || !args.hasOwnProperty("email")) {
        callback('invalid arguments', null);
        return;
    }

    var os = {
        name: args.os.name,
        version: args.os.version,
        arch: args.os.arch
    };
    var proj = {
        name: args.project.name,
        build_strategy: args.project.build_strategy,
        version: args.project.version,
        arch: args.project.arch
    };

    User.findOne({'email': args.email}, function (err, user) {
        if (err) {
            console.error('failed to find user for statistic: ', err);
            return;
        }

        if (!user) {
            console.error('User for statistic not found');
            return;
        }

        var new_stat = {create_date: Date(), os: os, project: proj};
        user.statistic.push(new_stat);
        user.save(function (err) {
            if (err) {
                console.error('failed to save statistic request: ', err);
            }
        });
    });
    callback(null, 'OK');
}

function anonymous_statistic(args, opt, callback) {
    if (!args || !args.hasOwnProperty('os') || !args.hasOwnProperty('project')) {
        callback('invalid arguments', null);
        return;
    }

    var os = {
        name: args.os.name,
        version: args.os.version,
        arch: args.os.arch
    };
    var proj = {
        name: args.project.name,
        version: args.project.version,
        arch: args.project.arch
    };

    var new_stat = new AnonymousStatistic({os: os, project: proj});
    new_stat.save(function (err) {
        if (err) {
            console.error('failed to save anonymous_statistic request: ', err);
        }
    });
    callback(null, 'OK');
}

function is_subscribed(args, opt, callback) {
    const UNSUBSCRIBED_USER = 0;
    const SUBSCRIBED_USER = 1;

    if (!args || !args.hasOwnProperty('email') || !args.hasOwnProperty('password')) {
        callback('invalid arguments', null);
        return;
    }

    User.findOne({'email': args.email}, function (err, user) {
        // if there are any errors, return the error
        if (err) {
            return callback(err, null);
        }

        // if no user is found, return the message
        if (!user) {
            return callback('User not found.', null);
        }

        if (!user.validHexedPassword(args.password)) {
            return callback('Wrong password.', null);
        }

        var cur_date = new Date();
        if (user.exec_count === 0) {
            var d = new Date();
            d.setDate(cur_date.getDate() + app.locals.project.trial_days);
            user.application_end_date = d;
        }

        if (user.type === UserType.USER) {
            if (user.application_state === ApplicationState.ACTIVE && !user.subscription) {
                if (user.application_end_date < cur_date) {
                    user.application_state = ApplicationState.TRIAL_FINISHED;
                    var transporter = nodemailer.createTransport(transport_options);
                    const mailOptions = {
                        from: app.locals.site.support_email,
                        to: app.locals.site.notify_email,
                        subject: app.locals.site.title + ' trial finished',
                        html: '<p>' +
                            'First name: ' + user.first_name + '<br>' +
                            'Last name: ' + user.last_name + '<br>' +
                            'Email: ' + user.email +
                            '</p>'
                    };
                    transporter.sendMail(mailOptions, function (err, info) {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            }
        }

        user.exec_count = user.exec_count + 1;
        user.application_last_start_date = cur_date;
        user.save(function (err) {
            if (err) {
                console.error('failed to save user application data: ', err);
            }
        });

        function generate_response(state) {
            var type = user.getType();
            return {
                'first_name': user.first_name,
                'last_name': user.last_name,
                "id": user._id,
                "subscription_state": state,
                "type": type,
                "exec_count": user.exec_count,
                "expire_time": Math.floor(user.application_end_date.getTime() / 1000)
            };
        }

        if (user.isPrimary()) {
            return callback(null, generate_response(SUBSCRIBED_USER));
        }

        user.getSubscriptionState(app.locals.fastspring_config, function (err, state) {
            if (err) {
                console.error(err);
                return callback('Failed to check subscripton state, please try to login again.', null);
            }

            if (User.isSubscribed(state)) {
                return callback(null, generate_response(SUBSCRIBED_USER));
            }

            if (user.application_state === ApplicationState.BANNED) {  // if banned
                return callback('You banned, please write to <a href="mailto:' + app.locals.support.contact_email + '">' + app.locals.support.contact_email + '</a> to unban, or <a href="' + app.locals.site.domain + '/login"><b>subscribe</b></a>.', null);
            }
            return callback(null, generate_response(UNSUBSCRIBED_USER));
        });
    });
}

function ban_user(args, opt, callback) {
    if (!args || !args.hasOwnProperty('email') || !args.hasOwnProperty('collision_id')) {
        callback('invalid arguments.', null);
        return;
    }

    console.log("ban_user:", args);
    User.findOne({'email': args.email}, function (err, user) {
        // if there are any errors, return the error
        if (err) {
            console.error('Failed to find user: ', err);
            return;
        }

        // if no user is found, return the message
        if (!user) {
            //console.error('User not found');
            return;
        }

        user.application_state = ApplicationState.BANNED;
        var first_name = user.first_name;
        var last_name = user.last_name;
        var email = user.email;
        var collision_id = args.collision_id;

        var transporter = nodemailer.createTransport(transport_options);
        const mailOptions = {
            from: app.locals.site.support_email,
            to: app.locals.site.notify_email,
            subject: app.locals.site.title + ' banned user',
            html: '<p>' +
                'First name: ' + first_name + '<br>' +
                'Last name: ' + last_name + '<br>' +
                'Email: ' + email + '<br>' +
                'Collision id:' + collision_id +
                '</p>'
        };
        transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
                console.error(err);
            }
        });
        user.save(function (err) {
            if (err) {
                console.error('Failed to save user application state: ', err);
            }
        });
    });

    User.findById(args.collision_id, function (err, user) {
        // if there are any errors, return the error
        if (err) {
            console.error('Failed to find user: ', err);
            return;
        }

        // if no user is found, return the message
        if (!user) {
            // console.error('User not found');
            return;
        }

        user.application_state = ApplicationState.BANNED;
        user.save(function (err) {
            if (err) {
                console.error('Failed to save user application state: ', err);
            }
        });
    });
    callback(null, 'OK');
}


// handlers
json_rpc2_server.expose('version', version);
json_rpc2_server.expose('statistic', statistic);
json_rpc2_server.expose('anonymous_statistic', anonymous_statistic);
json_rpc2_server.expose('is_subscribed', is_subscribed);
json_rpc2_server.expose('ban_user', ban_user);

// listen creates an tcp server on localhost only
json_rpc2_server.listenRaw(app_port, app_host);
