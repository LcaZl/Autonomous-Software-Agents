import { Agent } from './agent/agent.js'
import { config_1, config_2 } from './config.js'

const duration  = 100 // seconds
const moveType = 'BFS' // BFS, PDDL, PDDL_BATCH
// Number of option to calculate the path from the end of the previous, based on actual utility order.
const lookAhead = 2 // For both PDDL and BFS
const fastPick = true // Only for BFS, for now
const changingRisk = 0.5 // Percentage penality in new option utility, if the actual is stopped for the new one.
const adjustMovementCostWindow = 3000 // ms
const multiagent = true

const configuration = process.argv[2] == '1' ? config_1 : config_2
const {host, token, name} = configuration;

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
    multiagent
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