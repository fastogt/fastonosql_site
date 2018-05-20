var mongoose = require('mongoose');

var userBackupSchema = mongoose.Schema({
    email: String,
    first_name: String,
    last_name: String,
    email_subscription: Boolean
});

// create the model for users and expose it to our app
module.exports = mongoose.model('UserBackups', userBackupSchema);
