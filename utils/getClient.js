const AWS = require('aws-sdk');
const https = require('https');

const agent = new https.Agent({
  keepAlive: true
})

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
    // this.aws = new AWS.Config(this.config)
  }

  lambda () {
    const lambda = new AWS.Lambda(this.config);
    // lambda.config.update(this.config)
    return lambda;
  }
}

module.exports = Client;
