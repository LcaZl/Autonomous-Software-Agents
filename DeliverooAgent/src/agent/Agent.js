#!/usr/bin/env node
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import { Environment } from "./Environment/environment.js";
import { AgentPercepts } from "./Memory/Percepts.js";
import { ParcelsManager } from "./Environment/Parcels/ParcelsManager.js";
import { PlayersManager } from "./Environment/players/PlayersManager.js";
import { Position } from './utils/Position.js';
import { Planner } from "./memory/reasoning/planning/Planner.js"
import { Beliefs } from "./memory/Reasoning/Beliefs.js"
import EventEmitter from "events";
import { Options } from "./memory/reasoning/options/Options.js";
import { Intentions } from "./memory/reasoning/intentions/Intentions.js";
import { AgentInterface } from "./AgentInterface.js";
import { Intention } from "./memory/reasoning/intentions/Intention.js";
import { ProblemGenerator } from "./memory/reasoning/planning/ProblemGenerator.js";
import { Communication, TeamManager } from "./memory/Communication.js";
/**
 * 
 * Class that contains all components needed by the agent. 
 * @class
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

        // Configuration
        this.duration = duration ? duration * 1000 : Infinity;
        this.moveType = moveType
        this.fastPick = fastPick
        this.lookAhead = lookAhead
        this.changingRisk = changingRisk
        this.adjMovementCostWindow = adjMovementCostWindow
        this.nextTile = null
        // Path info
        this.lastPosition = null
        this.currentPosition = null
        this.lastDirection = null

        // Multiagent configuration
        this.multiagent = multiagent
        this.teamNames = teamNames
        this.teamScore = 0
        this.teamSize = teamSize

        // Connection
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
     */
    async start() {
            // Ensuring connection and first sensing before procede
            while (!this.percepts.firstSense || !this.connected) { await new Promise(resolve => setTimeout(resolve, 5)) }

            // Basic agent and environment information
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

            // Timer for agent duration, id specified
            if (this.duration != Infinity){
                setTimeout(() => {
                    this.finalMetrics()
                    process.exit(0); 
                }, this.duration);

                // To update the options when the time is expiring.
                // If the agent is carring parcels, when this timer expires the best option will be the delivery, if appropriate.
                setTimeout(() =>{
                    this.eventManager.emit('update_options')
                    console.log('[AGENT] Time is almost ended.')
                }, this.duration - (this.MOVEMENT_DURATION * this.environment.mapHeight))
            }

            // Initialize agent components
            this.parcels = new ParcelsManager(this)
            this.players = new PlayersManager(this)

            if (this.moveType == 'PDDL')
                this.beliefs = new Beliefs(this)
                this.problemGenerator = new ProblemGenerator(this)
                this.planner = new Planner(this)
                await this.planner.loadDomain()

            this.options = new Options(this)
            this.intentions = new Intentions(this)

            // Multiagente components initialization
            if (this.multiagent){
                this.teamManager = new TeamManager(this)
                this.communication = new Communication(this)
                this.communication.activate()

                while (!this.teamManager.sincronized) { await new Promise(resolve => setTimeout(resolve, 5)) }
        
                console.log(this.teamManager.master)
                console.log(this.teamManager.team)
            }

            //this.communication.activate()

            // Activate the managment of the events
            this.parcels.activate()
            this.players.activate()
            if (this.moveType === 'PDDL')
                this.beliefs.activate()
            this.options.activate()

            this.info()
            console.log('[INIT] Initialization Ended Succesfully.\n\n')

            // Start the agent
            await this.intentions.loop()
    }

    /**
     * This function manage the move of the agent. 
     * The function take the direction and perform the movement, then update the agent internal state.
     * 
     * @async
     * @param {string} direction - The direction for the agent to move.
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
        //this.status()

        // Check of actual tile and the nearby ones
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
            console.log('[AGENT][Time:', (new Date().getTime() - this.startedAt) / 1000, '/', this.duration / 1000,'s','] Picked up', pickedUpParcels.length, 'parcel')
            
            this.eventManager.emit('picked_up_parcels', pickedUpParcels)  
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
            console.log('[AGENT][Time:', (new Date().getTime() - this.startedAt) / 1000, '/', this.duration / 1000,'s','] Delivered', deliveredParcels.length ,'parcel(s) for ', this.parcels.getMyParcelsReward(), 'points - Total score: ', this.score - this.initialScore)

            this.eventManager.emit('delivered_parcels', deliveredParcels)
        }
    }

    /**
     * Check the tile around the agent and the actual one.
     */
    async actualTileCheck(nextPosition) {

        // If i'm on a delivery with parcels, deliver them.
        const OnDelivery = this.environment.onDeliveryTile()
        if (OnDelivery && this.parcels.carriedParcels() > 0)
            await this.deliver()
        else if (this.parcels.getParcels().size > 0){ 
            for(let parcel of this.parcels.getParcels().values()){

                if (this.intentions.currentIntention.option.parcelId !== parcel.id && 
                    parcel.position.isEqual(this.currentPosition)){
                    await this.pickup()
                    break;
                }
                
            }
        }
        
        // If fast pick is enabled, check the nearby tiles for parcels and take them.
        const currentOption = this.intentions.currentIntention.option
        if (this.fastPick && currentOption.id != 'patrolling'){
            const directions = [
                { pos: new Position(this.currentPosition.x, this.currentPosition.y + 1), name: 'up', opposite: 'down' },
                { pos: new Position(this.currentPosition.x, this.currentPosition.y - 1), name: 'down', opposite: 'up' },
                { pos: new Position(this.currentPosition.x - 1, this.currentPosition.y), name: 'left', opposite: 'right' },
                { pos: new Position(this.currentPosition.x + 1, this.currentPosition.y), name: 'right', opposite: 'left' },
            ];

            for (const parcel of this.parcels.getFreeParcels().values()) {

                if (parcel && parcel.id != currentOption.parcelId){ // If the parcel is not the current intention target

                    const direction = directions.find(dir => parcel.position.isEqual(dir.pos));
                    
                    if (direction) {
                        await this.client.move( direction.name )
                        await this.pickup()
                        if (!nextPosition.isEqual(direction.pos)){
                            await this.client.move( direction.opposite )
                            return false
                        }
                        return true
                    }
                }
            }
        }
    }
}


