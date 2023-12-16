import { Agent } from './agent/agent.js'
import { configurations } from './config.js'

const duration  = 100 // seconds
const moveType = 'BFS' // BFS, PDDL, PDDL_BATCH
// Number of option to calculate the path from the end of the previous, based on actual utility order.
const lookAhead = 2 // For both PDDL and BFS
const fastPick = false // Only for BFS, for now
const changingRisk = 0.5 // Percentage penality in new option utility, if the actual is stopped for the new one.
const adjustMovementCostWindow = 3000 // ms
const multiagent = true
const teamSize = 3

const currentConfiguration = process.argv[2] - 1
let teamNames = new Set()
for (const [index, configuration] of configurations.entries()){
    if (index !== currentConfiguration && teamNames.size < (teamSize - 1))
        teamNames.add(configuration.username)
}
const {host, token, name} = configurations[currentConfiguration];
console.log(teamNames)
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