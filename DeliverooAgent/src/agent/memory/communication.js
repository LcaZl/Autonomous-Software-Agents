import { Agent } from "../Agent.js";

export class Communication{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent

        this.agent.client.onMsg( (msg) => {
            console.log('new msg received:', msg);
        });

    }

    async initialization(){
        const msg = {
            name : this.agent.name,
            id : this.agent.agentID,
            position : this.agent.currentPosition
        }
        await this.agent.client.shout( msg );

    }
}