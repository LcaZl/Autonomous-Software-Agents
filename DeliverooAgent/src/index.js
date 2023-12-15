import { Agent } from './agent/agent.js'
import { config_1 } from './config.js'

const duration  = 100 // seconds
const moveType = 'PDDL' // BFS, PDDL, PDDL_BATCH
const batchSize = 3 // Only for PDDL_BATCH configuration
// Number of option to calculate the path from the end of the previous, based on actual utility order.
const lookAhead = 0 // For both PDDL and BFS
const fastPick = false // Only for BFS, for now
const changingRisk = 0.5 // Percentage penality in new option utility, if the actual is stopped for the new one.
const adjustMovementCostWindow = 10000 // ms
const {host, token, name} = config_1;

const agent = new Agent(
    host, 
    token, 
    name, 
    duration, 
    moveType, 
    fastPick, 
    lookAhead, 
    batchSize,
    changingRisk,
    adjustMovementCostWindow
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