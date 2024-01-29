import { Agent } from './src/Agent.js'
import { configurations, host, multiagent, teamSize } from './config.js'

// Retrieving the correct configuration
// With multi agent an index must be specified within node index.js command.
let currentConfigurationIndex = 0
let teamNames = new Set()

if (multiagent){
    currentConfigurationIndex = process.argv[2] - 1
    console.log(currentConfigurationIndex)
    if (currentConfigurationIndex != 0 && currentConfigurationIndex != 1 && currentConfigurationIndex != 2){
        console.error('The agent configuration id must be specified with multiagent True. Use -> node index.js [ConfigurationIndex]\n Available agents: 1,2 and 3.')
        process.exit(1)}
    // The other configurations in config.js are the one used by other agents
    // Use them to get the team member names
    for (const [index, configuration] of configurations.entries()){
        if (index !== currentConfigurationIndex && teamNames.size < (teamSize - 1))
            teamNames.add(configuration.username)
    }
}

const config = configurations[currentConfigurationIndex]

// Initialize agent
console.log('Agent configuration:\n', config, '\n\n')
const agent = new Agent(

    host, 
    config.token, 
    config.username, 
    config.duration, 
    config.moveType, 
    config.fastPick, 
    config.changingRisk,
    config.adjustMovementCostWindow,
    multiagent,
    teamNames,
    teamSize
);

process.on('SIGINT', () => { // When CTRL+C is pressed to terminate the agent.
    agent.finalMetrics()
    process.exit(0)
});

// Start the agent
try{ await agent.start() }
catch( error ){
    console.log('Error while agent is executing. Stopped. Error:\n', error)
}




/*
 C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src\utils\PddlTester
C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src
C:\Users\lucaz\Desktop\asa\Deliveroo Server\Deliveroo.js
*/