// createEventSourceMapping

const Logger = require('../logger');
const uuid = require('uuid');

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

  async handlerApi (apiName, functionArn) {
    const { Items } = await this.apigatewayv2('getApis');
    for (const item of Items) {
      if (item.Name === apiName) {
        return item;
      }
    }

    return await this.apigatewayv2('createApi', {
      Name: apiName,
      ProtocolType: 'HTTP',
      Description: `s 自动创建。`,
      DisableExecuteApiEndpoint: true,
      Target: functionArn
    })
  }

  async handlerIntegration({ ApiId }, properties, functionArn) {
    const {
      Method = 'post',
      PayloadFormatVersion,
      TimeoutInMillis,
    } = properties;
    const { Items } = await this.apigatewayv2('getIntegrations', { ApiId });
    for (const item of Items) {
      if (item.IntegrationUri === functionArn) {
        return await this.apigatewayv2('updateIntegration', {
          ApiId,
          IntegrationId: item.IntegrationId,
          IntegrationMethod: Method,
          PayloadFormatVersion,
          TimeoutInMillis
        })
      }
    }
    return await this.apigatewayv2('createIntegration', {
      ApiId,
      ConnectionType: 'INTERNET',
      Description: 's 自动创建。',
      IntegrationMethod: Method,
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: functionArn,
      PayloadFormatVersion: PayloadFormatVersion || '2.0',
      TimeoutInMillis: TimeoutInMillis || 30000,
    })
  }

  async handlerRoute({ ApiId }, properties, integrationId) {
    const { Items } = await this.apigatewayv2('getRoutes', { ApiId });
    const routeKey = `${properties.Method.toLocaleUpperCase()} ${properties.Path}`;
    for (const item of Items) {
      if (item.RouteKey === routeKey) {
        return item;
      }
    }

    return await this.apigatewayv2('createRoute', {
      ApiId,
      RouteKey: routeKey,
      AuthorizationType: 'NONE',
      Target: `integrations/${integrationId}`
    })
  }

  async addApiTrigger (functionName, eventName, functionArn, properties) {
    const apiRes = await this.handlerApi(eventName, functionArn);
    const integrationRes = await this.handlerIntegration(apiRes, properties, functionArn);
    await this.handlerRoute(apiRes, properties, integrationRes.IntegrationId)

    const arns = functionArn.split(':');
    return await this.lambda('addPermission', {
      FunctionName: functionName,
      StatementId: uuid.v4(),
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
      SourceArn: `arn:aws:execute-api:${arns[3]}:${arns[4]}:${apiRes.ApiId}/*/*${properties.Path}`
    });
  }

  async deploy (events, functionName, functionConfig) {
    if (!(events && functionName)) {
      return;
    }
    const resConfig = {};
    const functionArn = functionConfig.FunctionArn;

    for (const eventName in events) {
      if (events[eventName].Type !== 'Api') {
        const mes = `${events[eventName].Type} is not supported, so skip this configuration`;
        this.logger.warn(mes);
        resConfig[eventName] = { Message: mes };
        continue;
      }
      this.logger.info(`Start deploying ${eventName}.`);
      const properties = events[eventName].Properties;
      resConfig[eventName] = await this.addApiTrigger(functionName, eventName, functionArn, properties);
      this.logger.info(`Successfully deploy Amazon API Gateway.`);
    }
    return resConfig;
  }

  async get () {
    
  }
}

module.exports = EventSource