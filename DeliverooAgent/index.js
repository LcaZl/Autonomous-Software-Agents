import { Agent } from './src/Agent.js'
import { singleAgentConfigurations, host, multiagent, multiagentConfiguration } from './config.js'

// With multi agent an index must be specified within node index.js command.
const currentConfigurationIndex = multiagent ? process.argv[2] - 1 : 0
if (currentConfigurationIndex != 0 && currentConfigurationIndex != 1){
    console.error('The agent configuration id must be specified with multiagent True. Use -> node index.js [ConfigurationIndex]\n Available agents: 1 and 2.')
    process.exit(1)}

const singleAgentConfig = singleAgentConfigurations[currentConfigurationIndex]
const multiagentConfig = multiagent ? multiagentConfiguration : null

// Initialize agent
console.log('\n\n[INIT] Agent configuration:\n', singleAgentConfig)
const agent = new Agent(host, singleAgentConfig, multiagentConfig)

process.on('SIGINT', async () => { // When CTRL+C is pressed to terminate the agent.
    await agent.finalMetrics()
    process.exit(0)
})

// Start the agent
agent.start()
.catch( error => {
    console.log('Error while agent is executing. Stopped. Error:\n', error)
})