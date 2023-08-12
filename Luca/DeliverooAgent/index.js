
import { Agent } from './src/Agent/agent.js';
import { default as config } from "./config.js";

// Destructuring `host` and `token` from `config`
const { host, token } = config;

/**
 * Main function to start the agent.
 */
async function main() {

    // Creating a new instance of Agent
    const agent = new Agent(host, token);
    
    // Initializing the agent and waiting for the response
    let initialized = await agent.init()

    // If the agent initialize correctly, start the agent loop
    if (initialized)
        await agent.agentLoop()
}

// Run the main function, handling successful responses and errors
main().then(() => {
    console.log('[EXIT] Execution ended successfully.\n')
    process.exit(0);
}).catch((error) => {
    console.error("[EXIT] Exit with error:", error);
    process.exit(1);
});
