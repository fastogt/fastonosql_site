// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');

// define the schema for our user model
var userSchema = mongoose.Schema({
    email: String,
    password: String,
    created_date: Date,
    subscription: {
        type: String,
        default: ''
    }
});

// generating a hash
userSchema.methods.generateHash = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash;
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash === this.password;
};

// check subscription
userSchema.methods.isSubscribe = function() {
    return this.subscription;
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
