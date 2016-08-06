var STATUS = { 
  OK : 1,
  FAIL : 0
};

var CONNECTED_STATUS = { 
  CONNECTED : 1,
  DISCONNECTED : 0
};

var COMMANDS = {
  PING : "ping", //+
  INFO : "plz_system_info", //+
  CONFIG : "plz_config",
  SET_CONFIG : "plz_set_config"
};

// state parse
function parse_state_msg(msg) {
  var msg_host_state = msg.split(" ");
  if(msg_host_state.length === 2){
    return {host : msg_host_state[0], status : msg_host_state[1] == "connected" ? CONNECTED_STATUS.CONNECTED : CONNECTED_STATUS.DISCONNECTED };
  }
  
  return undefined;
}

// is_commands
function is_ping_command(msgObj) {
  return msgObj.command === COMMANDS.PING;    
}
function is_info_command(msgObj) {
  return msgObj.command === COMMANDS.INFO;    
}
function is_config_command(msgObj) {
  return msgObj.command === COMMANDS.CONFIG;    
}
function is_set_config_command(msgObj) {
  return msgObj.command === COMMANDS.SET_CONFIG;    
}
// status off command
function is_failed_command(msgObj) {
  return msgObj.status === STATUS.FAIL;    
}

function is_succsess_command(msgObj) {
  return msgObj.status === STATUS.OK;    
}
// parse string to msgObj

function parse_command_out(msg) {
  var msg_length = msg.length;
  var pos = 0;
  var data = "";
  
  var id = 0;
  var status = STATUS.FAIL;
  var command = "";
  
  for (var i = 0; i < msg_length; i++) {
    var c = msg[i];
    if (c === ' ') {
      if(pos === 0){
        //id = parseInt(data, 10);
        id = data;
      } else if(pos === 1) {
        if (data === "ok") {
          status = STATUS.OK;
        } else if(data === "fail") {
          status = STATUS.FAIL;
        } else {
          break;
        }
      } else if(pos === 2) {
        command = data;
        return {
          id: id,
          status: status,
          command: command,
          args : msg.substr(i, msg_length - i)
               };
      }
        pos++;
        data = "";
      } else {
        data += c;
      }
  }
  
  return undefined;
}

// server functions
function ping_server(id, name, socket) {
  if(name === undefined){
    return;
  }
    
  var msg = name + " " + id + " " + COMMANDS.PING;
  socket.emit('publish_redis', msg);
}

function server_info(id, name, socket) {
  if(name === undefined){
    return;
  }
    
  var msg = name + " " + id + " " + COMMANDS.INFO;
  socket.emit('publish_redis', msg);
}

function sync_server_config(id, name, socket) {
  if(name === undefined){
    return;
  }
    
  var msg = name + " " + id + " " + COMMANDS.CONFIG;
  socket.emit('publish_redis', msg);
}

function set_server_config(id, name, config, socket) {
  if(name === undefined){
    return;
  } 
  
  var msg = name + " " + id + " " + COMMANDS.SET_CONFIG + " " + config;
  socket.emit('publish_redis', msg);
}

//// server_details constant
const SERVER_DEFAULT_LABEL = "Unknown";
const SERVER_CPU_DEFAULT_LABEL = "Unknown";
const SERVER_OS_DEFAULT_LABEL = "Unknown";
const SERVER_RAM_DEFAULT_LABEL = "Unknown";
var SERVER_STATUS = { 
  ONLINE : "online",
  OFFLINE : "offline"
};

var SERVER_STATUS_IMG = { 
  ONLINE : "images/online.png",
  OFFLINE : "images/offline.png"
};