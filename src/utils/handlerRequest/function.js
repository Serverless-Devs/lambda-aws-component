const { packTo } = require('@serverless-devs/s-zip');
const Logger = require('../logger');
const path = require('path');
const fs = require('fs');
const { sleep, randomStr } = require('../utils')

const trustPolicyDocument = `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["sts:AssumeRole"],
    "Principal": {
      "Service": ["lambda.amazonaws.com"]
    }
  }]
}`;

class Function {
  constructor(aws) {
    // super();
    this.logger = new Logger();
    const lambda = aws.lambda();
    const iam = aws.iam();
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
    this.iam = async (functionKey, inputs) => {
      return await new Promise((resolve, reject) => {
        iam[functionKey](inputs, (e, data) => {
          if (e) {
            reject(e);
          }
          resolve(data);
        });
      })
    }
  }
  
  async prepareCode (inputs) {
    let codeUri = inputs.Code;
  
    const artifactConfigured = (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war'))
    if (!artifactConfigured) {
      const outputFileName = `${inputs.FunctionName}.zip`;
      const packToParame = {
        codeUri,
        outputFileName
      };
      const test = await packTo(packToParame);
      if (!test.count) {
        throw new Error('Zip file error')
      }
      codeUri = path.join(process.cwd(), './.s/.cache', outputFileName);
    }
  
    const data = await fs.readFileSync(codeUri);
    return {
      ZipFile: data
    };
  }

  async createRole (functionName) {
    this.logger.warn(`The configuration does not have role information, and the component generates the role automatically.`);
    const roleName = `s-${functionName}-role-${randomStr()}`;
    this.logger.info(`Start generating roleName: ${roleName}`);
    this.logger.info(trustPolicyDocument)
    const { Role } = await this.iam('createRole', {
      RoleName: roleName,
      AssumeRolePolicyDocument: trustPolicyDocument,
      Description: 's auto generate role.'
    })
    this.logger.info('Successfully generated role.');
    return Role.Arn;
  }

  /**
   * 
   * @param {*} functionInput 参数
   * @param {*} retry 重试次数
   * @param {*} times 第几次重试
   */
  async createFunction (functionInput, retry = 1, times = 1) {
    const functionName = functionInput.FunctionName;
    if (!functionInput.Role) {
      retry = 5;
      functionInput.Role = await this.createRole(functionName);
      this.logger.warn('Start trying to create functions after 6 seconds of sleep.');
      await sleep(6000);
    }

    try {
      return await this.lambda('createFunction', functionInput);
    } catch (e) {
      if (times < retry && e.message === 'The role defined for the function cannot be assumed by Lambda.') {
        this.logger.error(`Create Failure: ${e.message}`);
        this.logger.info(`Retry ${times} times`);
        await sleep(1500);
        return await this.createFunction(functionInput, retry, times + 1);
      }
      throw new Error(e.message)
    }
  }

  async deploy (properties) {
    const functionInput = JSON.parse(JSON.stringify(properties.Function));
    const functionName = functionInput.FunctionName;
    this.logger.info('Start compressing code.');
    const code = await this.prepareCode(functionInput);
    this.logger.info('Successful compression code.');

    try {
      await this.lambda('getFunction', { FunctionName: functionName });
      await this.lambda('updateFunctionCode', {
        FunctionName: functionName,
        ZipFile: code.ZipFile
      });
      delete functionInput.Code;
      return await this.lambda('updateFunctionConfiguration', functionInput);
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        functionInput.Code = code;
        return await this.createFunction(functionInput);
      }
      throw new Error(e.message)
    }
  }
  
  async remove (properties) {
    const functionName = properties.Function.FunctionName;

    return await this.lambda('deleteFunction', { FunctionName: functionName });
  }
}

module.exports = Function;