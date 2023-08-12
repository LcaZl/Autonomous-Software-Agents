#!/usr/bin/env node
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Environment } from './Environment/environment.js';
import { Brain } from "./Memory/brain.js";

/**
 * @class
 * 
 * Class that contains all components needed by the agent. 
 * This class manage different aspect of the agent:
 * - Environment initialization and update.
 * - Agent Sensing initialization
 * - Brain object, which manage the belief set and the planning aspects.
 * - Parcels and enemy agents sensing
 * - Agent own sensing
 * - Foundamentals parameters for the agent (e.g. the number of carried parcels, the score, the position, ...)
 */
export class DeliverooAgent{

    /**
     * Create a new DeliverooAgent.
     * @constructor
     * @param {string} host - The host for the agent.
     * @param {string} token - The token for the agent.
     */
    constructor(host, token) {

        // Initialize the agent
        this.host = host
        this.token = token 
        this.myParcels = 0
        this.carriedParcels = new Set()
        this.client = new DeliverooApi(this.host, this.token);

        this.client.onDisconnect(() => console.log("[INIT][CONN] Socket Disconnected!"));
        this.client.onConnect(() => console.log("[INIT][CONN] Agent Connected to Deliveroo!"));

        this.infoLoaded = false
        
        this.client.onYou(async (info) => {
            if (!this.infoLoaded) { 
                let position = {'x':info.x, 'y':info.y}
                this.id = info.id
                this.name = info.name
                this.score = info.score
                this.lastPosition = position
                this.currentPosition = position
                this.infoLoaded = true
            }
            else
                await this.handelOnYouSensing(info)
        })
        console.log('[INIT][AGNT] Agent Instantiated.')
    }

    /**
     * Initialize the agent.
     * 
     * @async
     * @return {Promise<boolean>} - The promise to be fulfilled with a boolean, true if initialization was successful, false otherwise.
     */
    async initialization() {

        await new Promise(resolve => setTimeout(resolve, 500));

        let success = false

        try {
            this.environment = new Environment(this.client.map, this.client.config, this)
            // MAX_PARCELS rapresents the maximum number of parcels that can be carried
            this.MAX_PARCELS = this.getEnvironment().getConfig().PARCELS_MAX
            if (this.MAX_PARCELS === 'infinite')
                this.MAX_PARCELS = 50

            this.brain = new Brain(this)
            success = await this.brain.initPlanner()

            console.log('[INIT][AGNT] Initialization Complete [Planner status:',success,'].');

        } catch (error) {
            console.error("[INITERROR][AGNT] Error during initialization.\nError:\n", error);
            success = false
        }
        return success
    }

    /**
     * Activate the agent's sensing capabilities.
     * Here are defined the function to be executed to manage the percels and agents sensing events.
     * This function is used in the extension of this class to activate the sensing for the agent.
     * 
     * @async
     * @return {Promise<boolean>} - The promise to be fulfilled with a boolean, true if sensing activation was successful, false otherwise.
     */
    async activateSensing() {

        let success = false
        try {
            this.getEnvironment().getParcels().startRewardTimer()
            this.client.onParcelsSensing(async (sensedParcels) => {
                await this.handleParcelsSensing(sensedParcels);
            });
        
            this.client.onAgentsSensing(async (players) => {
                await this.handleAgentsSensing(players);
            });

            console.log('[INIT][AGNT] Sensing Activated');
            success = true
        }
        catch (error) { 
            console.error("[INITERROR][AGENT] Error during sensing activation.\nError:\n", error);
            success = false
        }

        //this.startBeliefUpdate()
        return success
    }
      
    /**
     * Handle parcels sensing.
     * @async
     * @param {Array} sensedParcels - An array of sensed parcels.
     */
    async handleParcelsSensing(sensedParcels) {

        let updates = this.environment.getParcels().updateParcels(sensedParcels)
        if (updates)
            this.brain.update('belief_parcels')
    }
     
    /**
     * Handle agents sensing.
     * @async
     * @param {Array} players - An array of sensed players/agents.
     */
    async handleAgentsSensing(players) {
        
        let modified = this.environment.getPlayers().addPlayers(players)
        if (modified) {
            this.brain.update('belief_player')
        }
    }
    
    /**
     * Handle agent's own sensing.
     * 
     * @async
     * @param {Object} info - Information about the agent itself.
    */
    async handelOnYouSensing(info) {

        if (info.x % 1 == 0 && info.y % 1 == 0) {

            let position = { 'x': info.x, 'y': info.y }
            this.score = info.score
            this.lastPosition = this.currentPosition
            this.currentPosition = position
        }
     }

    /**
     * Perform a move with the agent. This function manage the move of the agent. 
     * The function take the direction and perform the movement, then update the agent internal beliefs.
     *
     * @async
     * @param {string} direction - The direction for the agent to move.
     * @return {Promise<boolean>} - The promise to be fulfilled with a boolean, true if the move was successful, false otherwise.
    */
    async agentMoving(direction) {
         
        let updated = false
        let moveResult = await this.client.move(direction);
        if (moveResult != false){
            this.lastPosition = this.currentPosition
            this.currentPosition = moveResult
            updated = true
        }
        else console.log('[AGENT] Not Moved', direction, '-  Position',this.currentPosition,' - From', this.lastPosition)
        return updated
    }

    /**
     * Update the agent's beliefs.
     * Thi function is used to update the belief set managed by the brain object of the agent.
     * 
     * @method
    */
    startBeliefUpdate() {
        
        let timerSpeed = this.getEnvironment().getConfig().CLOCK

        this.timer = setInterval(() => {
            this.brain.update('all_belief')
        }, timerSpeed);

        console.log('[AGENT][BLFTM] Timer Started - Clock: ', timerSpeed, 'ms')
    }

    /**
     * Get the agent's environment.
     * 
     * @method
     * @return {Environment} - The agent's environment.
    */
    getEnvironment(){
        return this.environment
    }

    /**
     * Get the agent's current position.
     * 
     * @method
     * @return {Object} - The agent's current position.
    */
    getCurrentPosition() { 
        return this.currentPosition
    }
}



