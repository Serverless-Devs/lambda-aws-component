// createEventSourceMapping

const Logger = require('../logger');

class EventSource {
  constructor (lambda) {
    this.logger = new Logger();
    this.lambda = async (functionKey, inputs) => {
      return await new Promise((resolve, reject) => {
        lambda[functionKey](inputs, (e, data) => {
          if (e) {
            reject(e);
          }
          resolve(data);
        });
      })
    }
  }

  deploy (inputs) {
    console.log(inputs);
  }
}

module.exports = EventSource