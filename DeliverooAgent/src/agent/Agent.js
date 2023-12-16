#!/usr/bin/env node
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Environment } from "./Environment/environment.js";
import { AgentPercepts } from "./Memory/Percepts.js";
import { ParcelsManager } from "./Environment/Parcels/ParcelsManager.js";
import { PlayersManager } from "./Environment/players/PlayersManager.js";
import { Position } from '../utils/Position.js';
import { Planner } from "./memory/Reasoning/planner.js"
import { Beliefs } from "./memory/Reasoning/Beliefs.js"
import EventEmitter from "events";
import { Options } from "./memory/reasoning/Options.js";
import { Intentions } from "./memory/reasoning/Intentions.js";
import { AgentInterface } from "./AgentInterface.js";
import { Intention } from "./memory/Reasoning/Intention.js";
import { ProblemGenerator } from "./memory/Reasoning/ProblemGenerator.js";
import { goToOption } from "./memory/reasoning/Option.js";
import { Communication, TeamManager } from "./memory/communication.js";
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
export class Agent extends AgentInterface{

    /**
     * Create a new DeliverooAgent.
     * @constructor
     * @param {string} host - The host for the agent.
     * @param {string} token - The token for the agent.
     */

    constructor(host, token, name, duration, moveType, fastPick, lookAhead, changingRisk, adjMovementCostWindow, multiagent, teamNames, teamSize) {
        super()

        this.duration = duration ? duration * 1000 : Infinity;
        this.moveType = moveType
        this.fastPick = fastPick
        this.lookAhead = lookAhead
        this.changingRisk = changingRisk
        this.adjMovementCostWindow = adjMovementCostWindow

        // Multiagent configuration
        this.multiagent = multiagent
        this.teamNames = teamNames
        this.teamScore = 0
        this.teamSize = teamSize

        // Path info
        this.lastPosition = null
        this.currentPosition = null
        this.lastDirection = null

        this.connected = false 
        this.client = new DeliverooApi(host, token) // Class to establish a connection to the target server

        // Perception and components interaction
        this.eventManager = new EventEmitter()
        this.percepts = new AgentPercepts(this) // Class that will manage all different kind of percepts
    }

    /**
     * Initialize the agent.
     * 
     * @async
     * @return {Promise<boolean>} - The promise to be fulfilled with a boolean, true if initialization was successful, false otherwise.
     */
    async start() {

        // Ensuring connection and first sensing
        while (!this.percepts.firstSense || !this.connected) { await new Promise(resolve => setTimeout(resolve, 5)) }

        // Basic information
        this.agentID = this.client.id
        this.name = this.client.name
        this.active = true
        this.MAX_PARCELS = this.client.config.PARCELS_MAX == 'infinite' ? 100000 : this.client.config.PARCELS_MAX - 1
        this.MOVEMENT_DURATION = this.client.config.MOVEMENT_DURATION
        this.PARCEL_DECADING_INTERVAL = this.client.config.PARCEL_DECADING_INTERVAL == '1s' ? 1000 : Infinity
        this.RANDOM_AGENT_SPEED = parseInt(this.client.config.RANDOM_AGENT_SPEED)
        this.RANDOMLY_MOVING_AGENTS = this.client.config.RANDOMLY_MOVING_AGENTS
        this.AGENTS_OBSERVATION_DISTANCE = this.client.config.AGENTS_OBSERVATION_DISTANCE

        this.environment = new Environment(this)

        // Timer for agent operation duration
        if (this.duration != Infinity){
            setTimeout(() => {
                this.finalMetrics()
                process.exit() 
            }, this.duration);

            // To update the options when the time is expiring.
            // If the agent is carring parcels, when this timer expires the best option will be the delivery.
            setTimeout(() =>{
                this.eventManager.emit('update_options')
            }, this.duration - (this.MOVEMENT_DURATION * this.environment.mapHeight))
        }

        // Initialize agent components and load PDDL domain
        this.parcels = new ParcelsManager(this)
        this.players = new PlayersManager(this)
        this.beliefs = new Beliefs(this)
        this.planner = new Planner(this)
        this.options = new Options(this)
        this.problemGenerator = new ProblemGenerator(this)
        this.intentions = new Intentions(this)
        this.teamManager = new TeamManager(this)
        this.communication = new Communication(this)
        
        await this.planner.loadDomain()
        
        if (this.multiagent)
            while (!this.teamManager.sincronized) { await new Promise(resolve => setTimeout(resolve, 5)) }

        console.log(this.teamManager.master)
        console.log(this.teamManager.team)
        process.exit(0)
        // Activate the managment of the events
        this.parcels.activate()
        this.players.activate()
        this.beliefs.activate()
        this.options.activate()

        this.info()
        this.log('[INIT] Initialization Ended Succesfully.\n\n')

        // Start effectively the agent
        await this.intentions.loop()
    }

    /**
     * Perform a move with the agent. This function manage the move of the agent. 
     * The function take the direction and perform the movement, then update the agent internal beliefs.
     * @async
     * @param {string} direction - The direction for the agent to move.
     * @return {Promise<boolean>} - The promise to be fulfilled with a boolean, true if the move was successful, false otherwise.
    */
    async move(direction) {

        this.lastDirection = direction
        this.movementAttempts += 1 // Increase number of movement attempts
        let moveResult = await this.client.move(direction) // false if move fail, new position otherwise
        
        if (moveResult != false) {

            this.effectiveMovement += 1
            this.lastPosition = this.currentPosition
            this.currentPosition = new Position(moveResult.x, moveResult.y)
            //console.log('[MOVE',this.movementAttempts,'] Moved:', direction, '- New Position', this.currentPosition, ' - From', this.lastPosition)
            this.eventManager.emit('movement')
        }
        else{
            this.failMovement += 1
            //console.log('[MOVE',this.movementAttempts,'] Moved:', moveResult, '- Fail - Position', this.currentPosition)
        }

        await this.actualTileCheck()
        //this.status()

        return moveResult != false
    }

    /**
     * @async
     * Manage the pick up action performed by the agent
     */
    async pickup() { 

        this.pickUpActions += 1
        let pickedUpParcels = await this.client.pickup()

        if (pickedUpParcels && pickedUpParcels.length > 0) {

            this.parcelsPickedUp += pickedUpParcels.length
            console.log('[AGENT] Picked up', pickedUpParcels.length,'parcel(s):')
            
            this.eventManager.emit('picked_up_parcels', pickedUpParcels)     
            this.communication.pickedUpParcels(pickedUpParcels)       
        }
    }

    /**
     * @async
     * Manage the delivery action performed by the agent
    */
    async deliver() {

        this.deliveryActions += 1
        let deliveredParcels = await this.client.putdown() 

        if (deliveredParcels && deliveredParcels.length > 0){

            const reward = this.parcels.getMyParcelsReward()
            this.parcelsDelivered += deliveredParcels.length
            this.score += reward
            console.log('[AGENT][Time:', (new Date().getTime() - this.startedAt) / 1000, '/', this.duration / 1000,'s','] Score: ',this.score - this.initialScore,' - Delivered', deliveredParcels.length ,'parcel(s) - Reward: ', this.parcels.getMyParcelsReward())

            this.eventManager.emit('delivered_parcels', deliveredParcels)
            this.communication.deliveredParcels(deliveredParcels, reward)
        }
    }

    /**
     * Check the tile around the agent and the actual one.
     */
    async actualTileCheck() {

        const OnDelivery = this.environment.onDeliveryTile()
        if (OnDelivery && this.parcels.carriedParcels() > 0)
            await this.deliver()
        else if (this.parcels.getParcels().size > 0){
            for(let parcel of this.parcels.getParcels().values()){
                if (this.intentions.currentIntention.option.id !== parcel.id && parcel.position.isEqual(this.currentPosition)){
                    await this.pickup()
                    break;
                }
            }
        }
        
        const currentOption = this.intentions.currentIntention.option
        if (this.fastPick && currentOption.id != 'patrolling'){
            const directions = [
                { pos: new Position(this.currentPosition.x, this.currentPosition.y + 1), name: 'up', opposite: 'down' },
                { pos: new Position(this.currentPosition.x, this.currentPosition.y - 1), name: 'down', opposite: 'up' },
                { pos: new Position(this.currentPosition.x - 1, this.currentPosition.y), name: 'left', opposite: 'right' },
                { pos: new Position(this.currentPosition.x + 1, this.currentPosition.y), name: 'right', opposite: 'left' },
            ];

            for (const parcel of this.parcels.getFreeParcels().values()) {


                if (parcel && parcel.id != currentOption.parcelId){

                    const direction = directions.find(dir => parcel.position.isEqual(dir.pos));
                    
                    if (direction) {

                        this.intentions.intention_queue.push(
                            new goToOption('go_to', this.currentPosition, direction.pos, Infinity, [direction.name, direction.opposite]), 
                            Infinity
                        );
                        this.intentions.stopCurrent();
                        this.eventManager.emit('update_options')
                    }
                }
            }
        }
      }
}


