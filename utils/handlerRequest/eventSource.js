// createEventSourceMapping

const Logger = require('../logger');

class EventSource {
  constructor (aws) {
    this.logger = new Logger();
    const lambda = aws.lambda();
    const apigatewayv2 = aws.apigatewayv2();

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
    this.apigatewayv2 = async (functionKey, inputs) => {
      return await new Promise((resolve, reject) => {
        apigatewayv2[functionKey](inputs, (e, data) => {
          if (e) {
            reject(e);
          }
          resolve(data);
        });
      })
    }
  }

  async deploy (inputs) {
    const {
      Events,
      FunctionName
    } = inputs.Function;
    console.log(FunctionName, "????");
    // const res = await this.apigatewayv2('createIntegration', {
    // // const res = await this.lambda('updateIntegration', {
    //   ApiId: 'rcfv0wusdj',
    //   ConnectionType: 'INTERNET',
    //   Description: '炸了呀',
    //   IntegrationMethod: 'POST',
    //   IntegrationType: 'AWS_PROXY',
    //   IntegrationUri: 'arn:aws:lambda:ap-southeast-1:530095495025:function:test-s',
    //   PayloadFormatVersion: '1.0',
    //   TimeoutInMillis: 30000,
    // })

    // const res = await this.apigatewayv2('updateRoute', {
    //   ApiId: 'rcfv0wusdj',
    //   RouteId: 'rxv8cy0',
    //   Target: 'integrations/h50h7u9'
    // })

    const res = await this.lambda('addPermission', {
      FunctionName: FunctionName,
      StatementId: '01c45c21-9295-501f-838c-a13486906452',
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: "arn:aws:execute-api:ap-southeast-1:530095495025:rcfv0wusdj/*/*/test-s"
    })

    console.log(res);
  }

  async get (properties) {
    // data: "{"enabled":true,"identifier":"api-gateway/rcfv0wusdj/*/*/test-s","apiType":"http","stage":"default","security":"NONE"}"
    // operation: "createRelation"
    // source: "api-gateway/rcfv0wusdj/*/*/test-s"
    // target: "arn:aws:lambda:ap-southeast-1:530095495025:function:test-s"
    // type: "trigger"
    const functionName = properties.Function.FunctionName;
    const res = await this.lambda('getFunctionEventInvokeConfig', {
      FunctionName: functionName
    })
    console.log(res);
    // createApi
  }
}

module.exports = EventSource