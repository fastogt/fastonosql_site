// load the things we need
var mongoose = require('mongoose');
var crypto = require('crypto');
var FastSpring = require('fastspring-fastogt-nodejs');
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

var SubscriptionSchema = mongoose.Schema({
    reference: String,
    subscription_id: String
});

// define the schema for our user model
var UserSchema = mongoose.Schema({
    email: String,
    password: String,
    first_name: String,
    last_name: String,
    country: String,
    created_date: {type: Date, default: Date.now},
    last_login_date: {type: Date, default: Date.now},
    subscription: SubscriptionSchema,
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

// async
UserSchema.methods.updateSubscription = function (billing_service_creds, order_id, callback) {
    var fastSpring = new FastSpring(billing_service_creds.login, billing_service_creds.password);
    var self = this;
    return fastSpring.getOrder(order_id, function (err, order) {
        if (err) {
            return callback(err);
        }

        if (!order.items.length) {
            return callback('Order invalid length items.');
        }

        self.application_state = ApplicationState.ACTIVE;
        self.subscription = {
            reference: order.reference,
            subscription_id: order.items[0].subscription
        };
        self.save(function (err) {
            if (err) {
                return callback(err);
            }
        });
    });
};

UserSchema.methods.getSubscriptionState = function (billing_service_creds, callback) {
    if (!this.subscription) {
        return callback(null, undefined);
    }

    var fastSpring = new FastSpring(billing_service_creds.login, billing_service_creds.password);
    return fastSpring.getSubscriptionState(this.subscription.subscription_id, callback);
};

UserSchema.methods.cancelSubscription = function (billing_service_creds, callback) {
    var subscr = this.subscription;
    if (!this.subscription) {
        return callback('Not subscribed.');
    }

    var fastSpring = new FastSpring(billing_service_creds.login, billing_service_creds.password);
    return fastSpring.cancelSubscription(this.subscription.subscription_id, callback);
};


// checking if password is valid
UserSchema.methods.isActive = function () {
    return this.application_state === ApplicationState.ACTIVE;
};

UserSchema.methods.isBanned = function () {
    return this.application_state === ApplicationState.BANNED;
};

// FIXME
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
    return crypto.createHash('md5').update(password).digest('hex');
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

UserSchema.statics.isSubscribed = function (state) {
    return state === 'active' || state === 'canceled';
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', UserSchema);
