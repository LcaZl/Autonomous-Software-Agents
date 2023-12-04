import { Agent } from './agent/agent.js'
import { config_1 } from './config.js'

const duration  = 100 // seconds
const moveType = 'BFS' // BFS or PDDL
const batchSize = 1 // Only for PDDL configuration // 1 - No batching
// Number of option to calculate the path from the end of the previous, based on actual utility order.
const lookAhead = 1 // For both PDDL and BFS
const fastPick = true // Only for BFS, for now
const {host, token, name} = config_1;

const agent = new Agent(
    host, 
    token, 
    name, 
    duration, 
    moveType, 
    fastPick, 
    lookAhead, 
    batchSize );

process.on('SIGINT', () => {
    agent.finalMetrics()
    process.exit(0)
});

await agent.start()





