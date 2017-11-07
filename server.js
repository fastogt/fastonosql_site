// server.js

function gen_routing_key(platform, arch) {
    return platform + '_' + arch;
}

// load configs
var config_db = require('./config/database.js');
var public_settings_config = require('./config/public_settings.js');
var settings_config = require('./config/settings.js');
var auth_config = require('./config/auth.js');

var root_abs_path = __dirname;
var public_dir_abs_path = root_abs_path + '/public';
var public_downloads_dir_abs_path = public_dir_abs_path + '/downloads';
var public_downloads_users_dir_abs_path = public_downloads_dir_abs_path + '/users';
// set up ======================================================================
// get all the tools we need
var express = require('express');
var app = express();
var port = settings_config.http_server_port;
var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);
var passport = require('passport');
var flash = require('connect-flash');
var amqp = require('amqp');
var mkdirp = require('mkdirp');
const util = require('util');


var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var fs = require('fs');

// app_r

var https = require('https');
var server = https.createServer({
  key: fs.readFileSync(settings_config.ssl_key_path),
  cert: fs.readFileSync(settings_config.ssl_cert_path)
}, app);
var io = require('socket.io');
var listener = io.listen(server);

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

    google_analitics_token: public_settings_config.google_analitics_token,

    github_link: public_settings_config.site.github_link,
    github_issues_link: public_settings_config.site.github_issues_link,
    github_link_without_host: public_settings_config.site.github_link_without_host,

    twitter_name: public_settings_config.site.twitter_name,
    twitter_link: public_settings_config.site.twitter_link,

    support_email_service_host: settings_config.support_email_service_host,
    support_email_service_port: settings_config.support_email_service_port,
    support_email_service_secure: settings_config.support_email_service_secure,
    support_email: settings_config.support_email,
    support_email_password: settings_config.support_email_password,

    supported_databases: public_settings_config.site.supported_databases
};
app.locals.project = {
    name: public_settings_config.project.name,
    name_lowercase: public_settings_config.project.name_lowercase,
    version: public_settings_config.project.version,
    version_type: public_settings_config.project.version_type
};
app.locals.author = {
    name: public_settings_config.support.name,
    contact: public_settings_config.support.contact
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

// rabbitmq
var rabbit_connection = amqp.createConnection({
    host: settings_config.rabbitmq_host,
    login: settings_config.rabbitmq_login,
    password: settings_config.rabbitmq_password
});
rabbit_connection.on('error', function (err) {
    console.error("rabbit_connection.on:", err);
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

            var rpc = new (require('./app/amqprpc'))(rabbit_connection);
            var branding_variables = '-DIS_PUBLIC_BUILD=OFF -DUSER_SPECIFIC_ID=' + in_json.id + ' -DUSER_SPECIFIC_LOGIN=' + in_json.email + ' -DUSER_SPECIFIC_PASSWORD=' + in_json.password;
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

            rpc.makeRequest(routing_key, in_json.email, request_data_json, function response(err, response) {
                    if (err) {
                        console.error(err);
                        socket.emit('status_rabbitmq', {'email': in_json.email, 'progress': 100, 'message': err.message}); //
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'error': err.message});
                        return;
                    }

                    var response_json = response;
                    console.log("response", response_json);
                    if (response.hasOwnProperty('error')) {
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'error': response.error});
                    } else {
                        var public_path = response.body.replace(public_dir_abs_path, '');
                        socket.emit('message_rabbitmq', {'email': in_json.email, 'body': public_path});
                    }
                },
                function status(response) {
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
mongoose.connect(config_db.url); // connect to our database

// NEV configuration =====================
// our persistent user model
var User = require('./app/models/user');

nev.configure({
    persistentUserModel: User,
    expirationTime: 3600 * 24, // 10 minutes

    verificationURL: app.locals.site.domain + '/email-verification/${URL}',
    transportOptions: {
        host: app.locals.site.support_email_service_host,
        port: app.locals.site.support_email_service_port,
        secure: app.locals.site.support_email_service_secure, // secure:true for port 465, secure:false for port 587
        auth: {
            user: app.locals.site.support_email,
            pass: app.locals.site.support_email_password
        }
    },
    verifyMailOptions: {
        from: 'Do Not Reply <' + app.locals.site.support_email + '>',
        subject: 'Please confirm account',
        html: 'Click the following link to confirm your account:</p><p>${URL}</p>',
        text: 'Please confirm your account by clicking the following link: ${URL}'
    },

  emailFieldName: 'email',
  passwordFieldName: 'password'
}, function (err, options) {
  if (err) {
    console.log(err);
    return;
  }

  console.log('configured: ' + (typeof options === 'object'));
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
app.use(express.static(public_dir_abs_path));
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({extended: true}));

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

// routes ======================================================================
require('./app/routes.js')(app, passport, nev); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('Http server ready for requests');
server.listen(app.locals.back_end.socketio_port);
