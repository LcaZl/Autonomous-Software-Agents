import { Position } from "../utils/Position.js";
import { Agent } from "../agent.js";

/**
 * Manages the percepts for an agent.
 */
export class AgentPercepts {
    /**
     * Initializes the AgentPercepts instance with event listeners for various sensory inputs.
     * 
     * @param {Agent} agent - The agent associated with these percepts.
     */
    constructor(agent) {
        this.agent = agent; // The agent to which these percepts belong
        this.firstSense = false; // Flag to indicate if the agent's initial state has been perceived

        // Setup event listeners for the agent's client
        this.setupEventListeners();
        console.log('[INIT] Sensing Activated');
    }

    /**
     * Sets up the event listeners for handling connection events, sensing parcels, agents
     * and updates to the agent state.
     */
    setupEventListeners() {

        // Handle disconnection events
        this.agent.client.onDisconnect(() => {
            console.log("[INIT] Socket Disconnected!");
        });

        // Handle connection events
        this.agent.client.onConnect(() => {
            console.log("[INIT] Agent Connected to Deliveroo!");
            this.agent.connected = true; // Mark the agent as connected
        });

        // Handle sensing parcels in the environment
        this.agent.client.onParcelsSensing((sensedParcels) => {
            if (sensedParcels.length > 0) {
                this.agent.eventManager.emit('parcels_percept', sensedParcels);
            }
        });

        // Handle sensing other agents in the environment
        this.agent.client.onAgentsSensing((sensedPlayers) => {
            if (sensedPlayers.length > 0) {
                this.agent.eventManager.emit('players_percept', sensedPlayers);
            }
        });

        // Handle updates to the agent's own state
        this.agent.client.onYou((info) => {
            if (info.x % 1 === 0 && info.y % 1 === 0) { // Ensure valid position
                let position = new Position(info.x, info.y);
                if (!this.firstSense) {
                    this.firstSense = true; // Mark the first sense event
                    this.agent.initialScore = info.score;
                    this.agent.lastPosition = position; // Initialize positions
                } else {
                    this.agent.lastPosition = this.agent.currentPosition;
                }
                this.agent.currentPosition = position; // Update current position
            }
            this.agent.score = info.score; // Update score
        });
    }
}
