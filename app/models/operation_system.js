// load the things we need
var mongoose = require('mongoose');

var OperationSystemSchema = mongoose.Schema({
    name: String,
    version: String,
    arch: String
});

// create the model for os and expose it to our app
module.exports = OperationSystemSchema;


