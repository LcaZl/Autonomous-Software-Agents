import { Agent } from './src/agent/Agent.js'
import { configurations } from './config.js'

function cartesianProduct(...arrays) {
    return arrays.reduce((a, b) =>
        a.flatMap(d => b.map(e => [d, e].flat()))
    );
}

// ------------------------------------------------------- Parameters --------------------------------------------------------
// Server address
const host = "http://localhost:8080" // or https://deliveroojs.onrender.com"
const {token, name} = configurations[0];
const duration  = 10 // (s) Duration of the agent, if not Infinity the value will be used by the agent.

// SINGLE AGENT TEST CONFIGURATIONS --------------------------------------------------------------------
const moveType = ['BFS'] // BFS or PDDL.
const lookAhead = [0, 1] // ONLY for PDDL.
const fastPick = [true, false] //  For both PDDL and BFS.
const changingRisk = [0.5] // current_option_utility < (new_option_utility * 0.8)
const adjustMovementCostWindow = [5000] // (ms)

const allConfigurations = cartesianProduct(moveType, lookAhead, fastPick, changingRisk, adjustMovementCostWindow);
const agentConfigurations = allConfigurations.map(config => ({
    moveType: config[0],
    lookAhead: config[1],
    fastPick: config[2],
    changingRisk: config[3],
    adjustMovementCostWindow: config[4],
}));

console.log('Configurations to test:', agentConfigurations.length)

// Ciclo principale per eseguire l'agente con tutte le configurazioni
let t = 0
for (const config of agentConfigurations) {
    console.log('\n\n\n\n ------------------------------------------------------- TEST', t, '-------------------------------------------------------\n - Configuration:\n', config,'\n\n')
    const agent = new Agent(
        host, 
        token, 
        name, 
        duration,
        
        // Variable parameters
        config.moveType, 
        config.fastPick, 
        config.lookAhead, 
        config.changingRisk,
        config.adjustMovementCostWindow,

        // No multi-agent
        false, //Multi-agent
        new Set(), // team names
        1 // Team size
    );

    await agent.start();    
    t += 1

    console.log('\n\n\nENDED\n\n\n')
}

