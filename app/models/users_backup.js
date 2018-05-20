var mongoose = require('mongoose');

var usersBackupSchema = mongoose.Schema({
    email: String,
    first_name: String,
    last_name: String,
    email_subscription: Boolean,
    created_date: Date
});

// create the model for users and expose it to our app
module.exports = mongoose.model('UsersBackup', usersBackupSchema);
