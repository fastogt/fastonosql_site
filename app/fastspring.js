var https = require('https');

function FastSpring(login, password) {
    var self = this;

    this._login = login;
    this._password = password;
    this._host = 'api.fastspring.com';

    /**
     * Send request method
     *
     * @param method
     * @param path
     * @param options
     * @returns {Promise}
     * @private
     */
    this._request = function (method, path, options) {
        return new Promise(function (resolve, reject) {
            var request = https.request({
                method: method,
                hostname: self._host,
                path: path,
                auth: self._login + ':' + self._password,
                headers: {
                    'User-Agent': 'My Agent/0.0.1'
                }
            }, function (response) {
                if (response.statusCode !== 200) {
                    reject(new Error('Failed response: ' + response.statusCode));
                }

                var str = '';
                response.on('data', function (chunk) {
                    str += chunk;
                });

                response.on('end', function () {
                    resolve(str);
                });

            }, function (e) {
                reject(e);
            });

            request.end();
        });
    };

    return {
        getOrder: FastSpring.prototype.getOrder.bind(this),
        getSubscription: FastSpring.prototype.getSubscription.bind(this),
        cancelSubscription: FastSpring.prototype.cancelSubscription.bind(this),
        checkSubscriptionState: FastSpring.prototype.checkSubscriptionState.bind(this),
        getActualSubscription: FastSpring.prototype.getActualSubscription.bind(this)
    }
}

/**
 * Get order by id
 *
 * @param {String} id - order Id
 * @returns {Promise}
 */
FastSpring.prototype.getOrder = function (id) {
    var path = '/orders/' + id;

    return this._request('GET', path);
};

/**
 * Get subscriptions by id
 *
 * @param {String} id - subscription id
 * @returns {Promise}
 */
FastSpring.prototype.getSubscription = function (id) {
    var path = '/subscriptions/' + id;

    return this._request('GET', path);
};

/**
 * Delete subscriptions by id
 *
 * @param {String} id - subscription id
 * @returns {Promise}
 */
FastSpring.prototype.cancelSubscription = function (id) {
    var path = '/subscriptions/' + id;

    return this._request('DELETE', path);
};

/**
 * Check subscription state
 *
 * @param state {String} - 'canceled', 'active' & etc.
 * @param id {String} - subscription id
 * @returns {Promise} - result is Boolean
 */
FastSpring.prototype.checkSubscriptionState = function (state, id) {
  return this.getSubscription(id)
      .then(function (data) {
          var subscription = JSON.parse(data);
          return subscription.state === state
      })
};

/**
 * Get current subscription
 *
 * @param state {String} - 'canceled', 'active' & etc.
 * @param id {String} - subscription id
 * @returns {Promise} - result is actual subscription, if subscription not change - false
 */
FastSpring.prototype.getActualSubscription = function (state, id) {
  return this.getSubscription(id)
      .then(function (data) {
          var subscription = JSON.parse(data);
          return subscription.state !== state ? subscription.state : false
      })
};

module.exports = FastSpring;