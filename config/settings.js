// config/settings.js
module.exports = {
    http_server_port : 8080,
    redis_pub_sub_port : 3000,
    pub_sub_channel_in : 'COMMANDS_IN',
    pub_sub_channel_out : 'COMMANDS_OUT',
    pub_sub_channel_client_state : 'CLIENTS_STATE',
    client_version : '0.0.2',
    client_version_type : '-beta8-'
};
