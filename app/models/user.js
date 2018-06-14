// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var FastSpring = require('./../modules/fastspring');
var user_constants = require('./user_constants');
var StatisticSchema = require('./statistic');

var UserType = {
    USER: 'USER',
    SUPPORT: 'SUPPORT',
    OPEN_SOURCE: 'OPEN_SOURCE',
    ENTERPRISE: 'ENTERPRISE'
};

// define the schema for our user model
var userSchema = mongoose.Schema({
    email: String,
    password: String,
    first_name: String,
    last_name: String,
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
        enum: [UserType.USER, UserType.SUPPORT, UserType.OPEN_SOURCE, UserType.ENTERPRISE],
        default: UserType.USER
    },
    email_subscription: Boolean,
    exec_count: {type: Number, default: 0},
    application_end_date: {type: Date, default: Date.now},
    application_last_start_date: {type: Date, default: Date.now},
    statistic: {type: [StatisticSchema], default: []},
    application_state: {
        type: String,
        enum: [user_constants.ACTIVE, user_constants.BANNED, user_constants.TRIAL_FINISHED],
        default: user_constants.ACTIVE
    }
});

// checking if password is valid
userSchema.methods.isActive = function () {
    return this.application_state === user_constants.ACTIVE;
};

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
    return (!this.subscription_state ||
        this.subscription_state === 'canceled' ||
        this.subscription_state === 'deactivated');
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
 * Check subscription status by param
 *
 * @param app {Object} - application object
 * @param state {String} - 'canceled', 'active' & etc.
 */
userSchema.statics.checkSubscriptionStatus = function (app, state) {
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
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
