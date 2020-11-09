const {Component} = require('@serverless-devs/s-core');
const Logger = require('./utils/logger');
const AWSClient = require('./utils/getClient');
const {Function, EventSource} = require('./utils/handlerRequest');
const fs = require('fs');
const yaml = require('js-yaml');

class AWSComponent extends Component {
    constructor() {
        super();
        this.logger = new Logger();
    }

    handlerInput(inputs) {
        if (!(inputs.Credentials.AccessKeyID || inputs.Credentials.SecretAccessKey)) {
            const msg = `Credentials not found. `
            throw new Error(msg)
        }

        const {
            Credentials,
            Properties = {}
        } = inputs;

        if (Properties.Function && Properties.Function.Name) {
            Properties.Function.FunctionName = Properties.Function.Name;
            delete Properties.Function.Name;
        }

        if (Properties.Function && Properties.Function.Environment && Properties.Function.Environment.Variables) {
            const variables = {}
            for (let i = 0; i < Properties.Function.Environment.Variables.length; i++) {
                variables[Properties.Function.Environment.Variables[0].Key] = Properties.Function.Environment.Variables[0].Value
            }
            Properties.Function.Environment.Variables = variables
        }

        if (Properties.Function && Properties.Function.Tags) {
            const tags = {}
            for (let i = 0; i < Properties.Function.Tags.length; i++) {
                tags[Properties.Function.Tags[0].Key] = Properties.Function.Tags[0].Value
            }
            Properties.Function.Tags = tags
        }

        if (Properties.Events) {
            const events = {}
            for (let i = 0; i < Properties.Events.length; i++) {
                events[Properties.Events[0].Name] = {
                    Type: Properties.Events[0].Type,
                    Properties: Properties.Events[0].Properties,
                }
            }
            Properties.Events = events
        }

        const awsClients = new AWSClient(Credentials, Properties.Region)
        return {
            awsClients,
            credentials: Credentials,
            properties: Properties,
            region: Properties.Region
        }
    }

    async deploy(inputs) {
        const {
            properties,
            awsClients,
            region
        } = this.handlerInput(inputs);
        const functionName = properties.Function.FunctionName;
        if (!functionName) {
            throw new Error(`FunctionName is empty.`)
        }

        const resConfig = {};

        const functionClient = new Function(awsClients);
        this.logger.info(`Starting deploy of AWS Lambda "${functionName}" to the AWS region "${region}".`);
        const res = await functionClient.deploy(properties);
        resConfig.Function = {
            Name: res.FunctionName,
            Arn: res.FunctionArn
        };
        this.logger.info(`Successfully deploy AWS Lambda function.`);

        const eventSourceClient = new EventSource(awsClients);
        resConfig.Event = await eventSourceClient.deploy(properties.Events, functionName, res);

        // Role 信息写到文件里
        const configPath = inputs.Path.ConfigPath;
        const projectName = inputs.Project.ProjectName;
        const sourceConfig = yaml.safeLoad(fs.readFileSync(configPath));
        if (!sourceConfig[projectName].Properties.Function.Role) {
            sourceConfig[projectName].Properties.Function.Role = res.Role;
            await fs.writeFileSync(configPath, yaml.dump(sourceConfig));
        }

        return resConfig;
    }

    async remove(inputs) {
        const {
            awsClients,
            properties,
            region
        } = this.handlerInput(inputs);

        const functionName = properties.Function.FunctionName;
        if (!functionName) {
            throw new Error(`FunctionName is empty.`)
        }

        const eventSourceClient = new EventSource(awsClients);
        const eventRes = await eventSourceClient.remove(properties.Events, functionName);

        this.logger.info(`Starting remove of AWS Lambda "${functionName}" to the AWS region "${region}".`)
        const functionClient = new Function(awsClients);
        await functionClient.remove(properties);
        this.logger.info(`Successfully remove AWS Lambda function.`)
        return {
            Region: region,
            FunctionName: {
                Name: functionName
            },
            Event: eventRes
        };
    }
}

module.exports = AWSComponent