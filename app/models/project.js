// load the things we need
var mongoose = require('mongoose');

var ProjectSchema = mongoose.Schema({
    name: String,
    build_strategy: String,
    version: String,
    arch: String
});

// create the model for project and expose it to our app
module.exports = ProjectSchema;


