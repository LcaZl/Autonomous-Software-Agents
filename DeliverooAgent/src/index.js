import { Agent } from './agent/agent.js'
import { configurations } from './config.js'

// PARAMETERS

// Duration of the agent, if not Infinity the value will be used by the agent.
const duration  = 100 // seconds

// Two option: BFS or PDDL.
const moveType = 'BFS'

// Number of option to calculate the path from the end of the previous, based on actual utility order.
const lookAhead = 2 // For both PDDL and BFS.

const fastPick = false //  For both PDDL and BFS.

// Percentage penality in new option utility, if the actual is stopped for the new one.
const changingRisk = 0.5 

// Time window to adjust the movemnt penality, used to calcul,ate the utility of each option.
const adjustMovementCostWindow = 3000 //ms

// Multiagent settings
const multiagent = true // Enable the multiagent functionalities
const teamSize = 3 // Size of the team

// The agent configuration id must be specified with 'node index.js [ConfigurationIndex]'
const currentConfigurationIndex = process.argv[2] - 1

// The other configurations in config.js are the one used by other agents
// Use them to get the team member names
let teamNames = new Set()
for (const [index, configuration] of configurations.entries()){
    if (index !== currentConfigurationIndex && teamNames.size < (teamSize - 1))
        teamNames.add(configuration.username)
}

// Current agent configuration
const {host, token, name} = configurations[currentConfigurationIndex];

const agent = new Agent(
    host, 
    token, 
    name, 
    duration, 
    moveType, 
    fastPick, 
    lookAhead, 
    changingRisk,
    adjustMovementCostWindow,
    multiagent,
    teamNames,
    teamSize
);

process.on('SIGINT', () => {
    agent.finalMetrics()
    process.exit(0)
});

await agent.start()





/*
 C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src\utils\PddlTester
C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src
C:\Users\lucaz\Desktop\asa\Deliveroo Server\Deliveroo.js
*/