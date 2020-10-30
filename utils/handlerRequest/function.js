const { packTo } = require('@serverless-devs/s-zip');
const Logger = require('../logger');
const path = require('path');
const fs = require('fs');

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
    const randomStr = ('0'.repeat(8) + parseInt(Math.pow(2, 40) * Math.random()).toString(32)).slice(-8);
    const RoleName = `s-${functionName}-role-${randomStr}`;
    this.logger.info(`Start generating role: ${RoleName}`);
    this.logger.info(trustPolicyDocument)
    const { Role } = await this.iam('createRole', {
      RoleName: `s-${functionName}-role-${randomStr}`,
      AssumeRolePolicyDocument: trustPolicyDocument,
      Description: 's auto generate role.'
    })
    return Role.Arn;
  }

  async deploy (properties) {
    const functionInput = JSON.parse(JSON.stringify(properties.Function));
    const functionName = functionInput.FunctionName;
    const code = await this.prepareCode(functionInput);
    if (!functionInput.Role) {
      functionInput.Role = await this.createRole(functionName);
    }
    try {
      return await this.lambda('createFunction', { ...functionInput, Code: code });
    } catch (e) {
      if (!e.message.includes('Function already exist:')) {
        throw new Error(e.message)
      }
    }
    await this.lambda('updateFunctionCode', {
      FunctionName: functionName,
      ZipFile: code.ZipFile
    });
    delete functionInput.Code;
    return await this.lambda('updateFunctionConfiguration', functionInput);
  }
  
  async remove (properties) {
    const functionName = properties.Function.FunctionName;

    return await this.lambda('deleteFunction', { FunctionName: functionName });
  }

  async get (functionName) {
    return await this.lambda('getFunction', { FunctionName: functionName });
  }
}

module.exports = Function;