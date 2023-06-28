// index.js

import { Agent } from './agent.js';
import { default as config } from "./config.js";

const { host, token } = config;

async function main() {

    // Agent object instantiation
    const agent = new Agent(host, token);

    // Agent initialization
    const init1 = await agent.initialization();
    if (init1) agent.info()
    //await agent.agentLoop()
    return 1
}

main().then(() => {
    console.log('\n[EXIT] Execution ended successfully.\n')
    process.exit(0);
}).catch((error) => {
    console.error("An error occurred:", error);
    process.exit(1);
});
