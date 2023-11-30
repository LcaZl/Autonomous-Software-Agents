import { Position } from "../../utils/Position.js";
import { Agent } from "../agent.js";

export class AgentPercepts{

    /** 
    * @param {Agent} agent
    */
    constructor(agent) { 

        this.agent = agent
        this.firstSense = false // False until first onYou event

        this.agent.client.onDisconnect(() => {
            this.agent.log("[CONN] Socket Disconnected!")
        });

        this.agent.client.onConnect(() => {
            this.agent.log("[CONN] Agent Connected to Deliveroo!")
            this.agent.connected = true
        });

        this.agent.client.onParcelsSensing((sensedParcels) => {
            if (sensedParcels.length > 0) {
                this.agent.eventManager.emit('parcels_percept', sensedParcels)
            }
        });
    
        this.agent.client.onAgentsSensing((sensedPlayers) => {
            if(sensedPlayers.length > 0){
                this.agent.eventManager.emit('players_percept', sensedPlayers)
            }
        });

        this.agent.client.onYou((info) => {
            if (info.x % 1 == 0 && info.y % 1 == 0) {
                this.agent.log('[PERCEPT] On you received.')
                if (!this.firstSense) { // First sincro
                    this.firstSense = true
                    this.agent.initialScore = info.score
                    let position = new Position(info.x, info.y)
                    this.agent.lastPosition = position
                    this.agent.currentPosition = position
                }
                else {
                    let position = new Position(info.x, info.y)
                    this.agent.lastPosition = this.agent.currentPosition
                    this.agent.currentPosition = position
                }
            }
            this.agent.score = info.score
        });
        this.agent.log('[INIT] Sensing Activated')
    }
}