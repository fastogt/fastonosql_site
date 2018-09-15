// load the things we need
var mongoose = require('mongoose');

// os: { name: 'Windows NT', version: '10.0', arch: 'x86_64' },
// project: { name: 'FastoNoSQL', version: '1.16.2.0', arch: 'x86_64', owner: '123',  exec_count: 187 }

var AnonProjectSchema = mongoose.Schema({
    name: String,
    version: String,
    arch: String
});
var OperationSystemSchema = require('./operation_system');

// define the schema for our programme model
var AnonymousStatisticSchema = mongoose.Schema({
    created_date: {type: Date, default: Date.now},
    os: OperationSystemSchema,
    project: AnonProjectSchema
});

// create the model for statistics and expose it to our app
module.exports = mongoose.model('AnonymousStatistic', AnonymousStatisticSchema);