// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var FastSpring = require('./../fastspring');


// define the schema for our user model
var userSchema = mongoose.Schema({
    email: String,
    password: String,
    created_date: {type: Date, default: Date.now},
    subscription: {
        type: String,
        default: ''
    },
    subscription_state: { // "active", "overdue", "canceled", "deactivated", "trial"
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['USER', 'FOUNDER', 'SUPPORT'],
        default: 'USER'
    }
});

// generating a hash
userSchema.methods.generateHash = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash;
};

// checking if hexed password is valid
userSchema.methods.validHexedPassword = function (hexed_password) {
    return hexed_password === this.password;
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return this.validHexedPassword(hash);
};

// enable subscription
userSchema.methods.enableSubscription = function () {
    return (!this.subscription_state || this.subscription_state === 'canceled');
};

// get subscription info
userSchema.methods.getSubscription = function () {
    return this.subscription
        ? JSON.parse(this.subscription)
        : null;
};

// get subscription state
userSchema.methods.getSubscriptionState = function () {
    return this.subscription_state;
};

/**
 *
 * @param app {Object} - application object
 * @param state {String} - 'canceled', 'active' & etc.
 */
userSchema.statics.isSubscribed = function (app, state) {
    var fastSpring = new FastSpring(app.locals.fastspring_config.login, app.locals.fastspring_config.password);

    return function (req, res, next) {
        var subscr = req.user.getSubscription();

        if (subscr) {
            fastSpring.getSubscription(subscr.subscriptionId)
                .then(function (data) {
                    var subscription = JSON.parse(data);
                    if (subscription.state === state) {
                        return next();
                    }
                    res.redirect('/profile');
                }).catch(function (error) {
                console.error(error);
                res.redirect('/profile');
            })
        } else {
            res.redirect('/profile');
        }
    }
}

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
