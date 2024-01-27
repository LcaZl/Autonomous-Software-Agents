import { Agent } from './src/Agent.js'
import { agents_configuration, host, multiagent, teamSize } from './config.js'

// Initialize multi-agent, if set.
let currentConfigurationIndex = 0 // 0 if multiagent false, else use command argv
let teamNames = new Set()

if (multiagent){
    currentConfigurationIndex = process.argv[2] - 1
    if (!currentConfigurationIndex)
        console.error('The agent configuration id must be specified with multiagent True. Use -> node index.js [ConfigurationIndex]')
    
    // The other configurations in config.js are the one used by other agents
    // Use them to get the team member names
    for (const [index, configuration] of agents_configuration.entries()){
        if (index !== currentConfigurationIndex && teamNames.size < (teamSize - 1))
            teamNames.add(configuration.username)
    }
}

// Initialize agent
const config = agents_configuration[currentConfigurationIndex];
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

process.on('SIGINT', () => {
    agent.finalMetrics()
    process.exit(0)
});

try{
    // Start
    await agent.start().catch(error =>
        console.log(error))
}
catch( error ){
    console.log(error)
}




/*
 C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src\utils\PddlTester
C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src
C:\Users\lucaz\Desktop\asa\Deliveroo Server\Deliveroo.js
*/