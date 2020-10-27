const AWS = require('aws-sdk');

class Client {
  constructor(credentials = {}, region) {
    this.config = {
      credentials: {
        accessKeyId: credentials.AccessKeyID,
        secretAccessKey: credentials.SecretAccessKey,
      },
      apiVersion: 'latest',
      region
    }
  }

  lambda () {
    const lambda = new AWS.Lambda(this.config);
    return lambda;
  }
}

module.exports = Client;
