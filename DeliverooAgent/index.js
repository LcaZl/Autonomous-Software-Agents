import { Agent } from './src/agent/Agent.js'
import { configurations } from './config.js'

// ------------------------------------------------------- Parameters --------------------------------------------------------
// Server address
const host = "http://localhost:8080" // or https://deliveroojs.onrender.com"

// SINGLE AGENT CONFIGURATION --------------------------------------------------------------------
const duration  = 300 // (s) Duration of the agent, if not Infinity the value will be used by the agent.
const moveType = 'BFS' // BFS or PDDL.

// Number of option to calculate the path from the end of the current, based on actual utility order.
const lookAhead = 0 // ONLY for PDDL.

// Do a fast movement to an adiacent tile to take a parcel.
const fastPick = false //  For both PDDL and BFS.

// Percentage penality in new option utility, if the actual is stopped for the new one.
const changingRisk = 0.0 // current_option_utility < (new_option_utility * 0.8)

// Time window to adjust the movemnt penality, used to calcul,ate the utility of each option.
const adjustMovementCostWindow = 5000 // (ms)

// // ----------------------------------------------- Multi-agent parameters ----------------------------------------------------

const multiagent = false // Enable the multiagent functionalities
const teamSize = 2 // Size of the team

// ------------------------------------------------------- End Parameters -------------------------------------------------------

let currentConfigurationIndex = 0
let teamNames = new Set()

if (multiagent){
    // The agent configuration id must be specified with 'node index.js [ConfigurationIndex]'
    currentConfigurationIndex = process.argv[2] - 1

    // The other configurations in config.js are the one used by other agents
    // Use them to get the team member names
    for (const [index, configuration] of configurations.entries()){
        if (index !== currentConfigurationIndex && teamNames.size < (teamSize - 1))
            teamNames.add(configuration.username)
    }
}

// Initialize agent

const {token, name} = configurations[currentConfigurationIndex];
console.log(configurations[currentConfigurationIndex])
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

// Start
await agent.start()





/*
 C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src\utils\PddlTester
C:\Users\lucaz\Desktop\asa\Github\DeliverooAgent\src
C:\Users\lucaz\Desktop\asa\Deliveroo Server\Deliveroo.js
*/