// server.js

function gen_routing_key(platform, arch) {
  return platform + '_' + arch;
}

// load configs
var configDB = require('./config/database.js');
var settings_config = require('./config/settings.js');
var root_abs_path = __dirname; 
var public_dir_abs_path = root_abs_path + '/public';
var public_downloads_dir_abs_path = public_dir_abs_path + '/downloads';
var public_downloads_users_dir_abs_path = public_downloads_dir_abs_path + '/users';
// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || settings_config.http_server_port;
var mongoose = require('mongoose');
var redis = require('redis');
var passport = require('passport');
var flash    = require('connect-flash');
var amqp = require('amqp');
var mkdirp = require('mkdirp');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

app.redis_connection = redis.createClient();
app.redis_connection.on("error", function (err) {
    console.error(err);
});

// app_r

var http = require('http');
var io = require('socket.io');
var server = http.createServer(app);
var listener = io.listen(server);

// settings
app.locals.site = {
    title: 'Site on your device',
    domain: 'http://fastonosql.com',
    description: 'Site on your device - solution which connects your device with internet.',
    public_directory: public_dir_abs_path,
    users_directory: public_downloads_users_dir_abs_path
};
app.locals.project = {
    project_name: 'FastoNoSQL',
    project_name_lowercase: 'fastonosql',
    github_link: 'https://github.com/fastogt/fastonosql',
    github_issues_link: 'https://github.com/fastogt/fastonosql/issues'
};
app.locals.back_end = {
    version : settings_config.client_version,
    type : settings_config.client_version_type,
    socketio_port : settings_config.socketio_port,
    pub_sub_channel_in : settings_config.pub_sub_channel_in,
    pub_sub_channel_out : settings_config.pub_sub_channel_out,
    pub_sub_channel_client_state : settings_config.pub_sub_channel_client_state
};
app.locals.author = {
    name: 'Topilski Alexandr',
    contact: 'atopilski@fastogt.com'
};
app.locals.company = {
    name: 'FastoGT',
    description: 'Fasto Great Technology',
    domain: 'http://fastogt.com',
    copyright: 'Copyright © 2014-2016 FastoGT. All rights reserved.'
};

// rabbitmq
var rabbit_connection = amqp.createConnection({ host: settings_config.rabbitmq_host });
rabbit_connection.on('error', function (err) {
    console.error(err);
});

listener.on('connection', function (socket) {
    socket.on('subscribe_redis', function (data) {
        console.log('subscribe_redis', data.channel);
        socket.join(data.channel);
    });

    socket.on('publish_redis', function (msg) {
        redis_pub.publish(app.locals.back_end.pub_sub_channel_in, msg);
    });
    
    socket.on('publish_rabbitmq', function (msg) {
        var in_json = JSON.parse(msg);
        var user_package_dir = public_downloads_users_dir_abs_path + '/' + in_json.email;
        mkdirp(user_package_dir, function(err) {
          if (err) {
            console.error(err);
            socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 100, 'message': err.message } ); //
            socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': err.message });
            return;
          }
          
          socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 0, 'message': 'Send request to build server' } ); //
          
          var rpc = new (require('./app/amqprpc'))(rabbit_connection);
          var branding_variables = '-DUSER_SPECIFIC_DEFAULT_LOGIN=' + in_json.email + ' -DUSER_SPECIFIC_DEFAULT_PASSWORD=' + in_json.password
          + ' -DUSER_SPECIFIC_DEFAULT_LOCAL_DOMAIN=' + in_json.domain_host + ' -DUSER_SPECIFIC_CONTENT_PATH=' + in_json.content_path
          + ' -DUSER_SPECIFIC_DEFAULT_EXTERNAL_DOMAIN=' + in_json.external_host + ' -DUSER_SPECIFIC_DEFAULT_PRIVATE_SITE=' + in_json.private_site
          + ' -DUSER_SPECIFIC_SERVER_TYPE=' + in_json.server_type;
          
          var request_data_json = {
              'branding_variables': branding_variables,
              'platform': in_json.platform,
              'arch': in_json.arch,
              'package_type' : in_json.package_type,
              'destination' : user_package_dir
          };
          var routing_key = gen_routing_key(in_json.platform, in_json.arch);
          console.log("request_data_json", request_data_json);
          console.log("routing_key", routing_key);
          
          rpc.makeRequest(routing_key, in_json.email, request_data_json, function response(err, response) {
              if (err) {
                console.error(err);
                socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': 100, 'message': err.message } ); //
                socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': err.message });
                return;
              }
              
              var responce_json = response;
              console.log("response", responce_json);
              if(response.hasOwnProperty('error')){
                socket.emit('message_rabbitmq', { 'email': in_json.email, 'error': response.error });
              } else {
                var public_path = response.body.replace(public_dir_abs_path, '');
                socket.emit('message_rabbitmq', { 'email': in_json.email, 'body': public_path } );
              }
          }, 
          function status(response) {
            socket.emit('status_rabbitmq', { 'email': in_json.email, 'progress': response.progress, 'message': response.status } ); //
          } );
        });
    });
});

var redis_sub = redis.createClient();
var redis_pub = redis.createClient();

redis_sub.on('error', function (err) {
    console.error(err);
});

redis_pub.on('error', function (err) {
    console.error(err);
});

redis_sub.on('ready', function() {
    redis_sub.subscribe(app.locals.back_end.pub_sub_channel_out, app.locals.back_end.pub_sub_channel_client_state);
});

redis_sub.on('message', function(channel, message){
    var resp = {'text': message, 'channel':channel};
    listener.in(channel).emit('message', resp);
});

// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(express.static(public_dir_abs_path));
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({ secret: app.locals.project.project_name_lowercase })); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('Http server ready for requests');
server.listen(app.locals.back_end.socketio_port);
