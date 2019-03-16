// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var FastSpring = require('./../modules/fastspring');
var StatisticSchema = require('./statistic');


const UserType = Object.freeze({
    USER: 'USER',
    SUPPORT: 'SUPPORT',
    OPEN_SOURCE: 'OPEN_SOURCE',
    ENTERPRISE: 'ENTERPRISE',
    PERMANENT: 'PERMANENT'
});

const ApplicationState = Object.freeze({
    ACTIVE: 'ACTIVE',
    BANNED: 'BANNED',
    TRIAL_FINISHED: 'TRIAL_FINISHED'
});

// define the schema for our user model
var UserSchema = mongoose.Schema({
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
        enum: Object.values(UserType),
        default: UserType.USER
    },
    email_subscription: {type: Boolean, default: true},
    exec_count: {type: Number, default: 0},
    application_end_date: {type: Date, default: Date.now},
    application_last_start_date: {type: Date, default: Date.now},
    statistic: {type: [StatisticSchema], default: []},
    application_state: {
        type: String,
        enum: Object.values(ApplicationState),
        default: ApplicationState.ACTIVE
    }
});

Object.assign(UserSchema.statics, {
    UserType, ApplicationState
});

// checking if password is valid
UserSchema.methods.isActive = function () {
    return this.application_state === ApplicationState.ACTIVE;
};

UserSchema.methods.isBanned = function () {
    return this.application_state === ApplicationState.BANNED;
};

// FIX ME
UserSchema.methods.getType = function () {
    if (this.type === UserType.USER) {
        return 0;
    } else if (this.type === UserType.SUPPORT) {
        return 1;
    } else if (this.type === UserType.OPEN_SOURCE) {
        return 2;
    } else if (this.type === UserType.ENTERPRISE) {
        return 3;
    } else if (this.type === UserType.PERMANENT) {
        return 4;
    }
    return 0;
};

// generating a hash
UserSchema.methods.generateHash = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return hash;
};

// checking if hexed password is valid
UserSchema.methods.validHexedPassword = function (hexed_password) {
    return hexed_password === this.password;
};

// checking if password is valid
UserSchema.methods.validPassword = function (password) {
    var hash = crypto.createHash('md5').update(password).digest('hex');
    return this.validHexedPassword(hash);
};

// checking user status
UserSchema.methods.isPrimary = function () {
    return this.type === UserType.SUPPORT || this.type === UserType.OPEN_SOURCE || this.type === UserType.PERMANENT || this.type === UserType.ENTERPRISE;
};

// enable subscription
UserSchema.methods.enableSubscription = function () {
    if (this.isPrimary()) {
        return false;
    }

    return (!this.subscription_state ||
        this.subscription_state === 'canceled' ||
        this.subscription_state === 'deactivated');
};

// get subscription info
UserSchema.methods.getSubscription = function () {
    return this.subscription
        ? JSON.parse(this.subscription)
        : null;
};

// get subscription state
UserSchema.methods.getSubscriptionState = function () {
    return this.subscription_state;
};

// can cancel subscription
UserSchema.methods.canCancelSubscription = function () {
    if (this.isPrimary()) {
        return false;
    }

    return this.subscription_state === 'active';
};


/**
 * Check subscription status by param
 *
 * @param app {Object} - application object
 * @param state {String} - 'canceled', 'active' & etc.
 */
UserSchema.statics.checkSubscriptionStatus = function (app, state) {
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
module.exports = mongoose.model('User', UserSchema);
