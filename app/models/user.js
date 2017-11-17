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
    },
    subscriptionState: { // "active", "overdue", "canceled", "deactivated", "trial"
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

// enable subscription
userSchema.methods.enableSubscription = function() {
    return (!this.subscriptionState || this.subscriptionState === 'canceled') && !this.subscription;
};

// get subscription info
userSchema.methods.getSubscription = function () {
    return this.subscription
        ? JSON.parse(this.subscription)
        : null;
}

// get subscription state
userSchema.methods.getSubscriptionState = function () {
    return this.subscriptionState;
}

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
