import { Agent } from './Agent/agent.js';
import { config_1, config_2, agent_parameters } from './config.js'

let duration  = 300 // seconds
let move_type = 'PDDL'
const {host, token, name} = config_1;
const agent = new Agent(host, token, name, duration, move_type);
process.on('SIGINT', () => {
    agent.finalMetrics()
    process.exit(0)
});

await agent.start()





