var STATUS = {
  OK: 1,
  FAIL: 0
};

// status off command
function is_failed_command(msgObj) {
  return msgObj.status === STATUS.FAIL;
}

function is_succsess_command(msgObj) {
  return msgObj.status === STATUS.OK;
}

