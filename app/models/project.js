// load the things we need
var mongoose = require('mongoose');

var ProjectSchema = mongoose.Schema({
    name: String,
    version: String,
    arch: String,
    exec_count: Number
});

// create the model for project and expose it to our app
module.exports = ProjectSchema;


