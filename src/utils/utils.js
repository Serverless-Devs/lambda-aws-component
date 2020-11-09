function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomStr () {
  return ('0'.repeat(8) + parseInt(Math.pow(2, 40) * Math.random()).toString(32)).slice(-8);
}

module.exports = {
  sleep,
  randomStr,
}