var https = require('https');

function MailerLite() {
    var self = this;

    this._apiKey = '920723118e0098ed64823db4e9a29690';
    this._host = 'api.mailerlite.com';

    /**
     * Send request method
     *
     * @param method
     * @param path
     * @param data
     * @returns {Promise}
     * @private
     */
    this._request = function (method, path, data) {
        return new Promise(function (resolve, reject) {
            var request = https.request({
                method: method,
                hostname: self._host,
                path: path,
                headers: {
                    'content-type': 'application/json',
                    'x-mailerlite-apikey': self._apiKey,
                    'cache-control': 'no-cache'
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

            request.on('error', function (e) {
                console.error('problem with request: ${e.message}', e);
                reject(e);
            });

            data && request.write(data);

            request.end();
        });
    };

    return {
        addNewSubscriber: MailerLite.prototype.addNewSubscriber.bind(this),
        addNewSubscriberToGroup: MailerLite.prototype.addNewSubscriberToGroup.bind(this),
        updateSubscriber: MailerLite.prototype.updateSubscriber.bind(this)
    }
}

/**
 * Add new single subscriber to specified group
 *
 * @param {String} groupId - group Id
 * @param {Object} params
 * @returns {Promise}
 */
MailerLite.prototype.addNewSubscriberToGroup = function (groupId, params) {
    var path = '/api/v2/groups/' + groupId + '/subscribers';
    var data = JSON.stringify(params);

    return this._request('POST', path, data);
};

/**
 * Add new single subscriber
 *
 * @param {Object} params
 * @returns {Promise}
 */
MailerLite.prototype.addNewSubscriber = function (params) {
    var path = '/api/v2/subscribers';
    var data = JSON.stringify(params);

    return this._request('POST', path, data);
};

/**
 * Update single subscriber
 *
 * @param {Object} id/email
 * @param {Object} params - {"type": "unsubscribed", "fields": {"name": "Demo", "company": "MailerLite"}}
 * @returns {Promise}
 */
MailerLite.prototype.updateSubscriber = function (id, params) {
    var path = '/api/v2/subscribers/' + id;
    var data = JSON.stringify(params);

    return this._request('PUT', path, data);
};

module.exports = MailerLite;