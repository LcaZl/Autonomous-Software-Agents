// index.js

import { Agent } from './agent.js';
import { default as config } from "./config.js";

const { host, token } = config;

async function main() {

    // Agent object instantiation
    const agent = new Agent(host, token);

    // Agent initialization
    const success = await agent.init();
    if (success) {
    agent.info();
    // Continua con il resto del codice se tutte le callback sono state completate con successo
    } else {
    console.error("Initialization failed.");
    process.exit(1);
    // Gestisci il caso in cui una o più callback abbiano generato un errore
    }

    // Agent active e with belief loaded
    return 1
}

main().then(() => {
    console.log('\n[EXIT] Execution ended successfully.\n')
    process.exit(0); // termina il processo con successo
}).catch((error) => {
    console.error("An error occurred:", error);
    process.exit(1); // termina il processo con un codice di errore
});
