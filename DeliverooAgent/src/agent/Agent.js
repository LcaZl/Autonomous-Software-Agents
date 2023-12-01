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
import { Option } from "./memory/reasoning/Option.js";
import { Intentions } from "./memory/reasoning/Intentions.js";
import { AgentInterface } from "./AgentInterface.js";
import { Intention } from "./memory/Reasoning/Intention.js";
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

    constructor(host, token, name, duration, moveType) {
        super()

        this.duration = duration ? duration * 1000 : Infinity;
        this.moveType = moveType
        this.fastPick = false

        // Performance information
        this.lastPosition = null
        this.currentPosition = null
        this.lastDirection = null

        // For multi-agent
        this.master = false

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
        this.intentions = new Intentions(this)
        await this.planner.loadDomain()

        // Activate the managment of the events
        this.parcels.activate()
        this.players.activate()
        this.beliefs.activate()
        this.options.activate()

        this.agentInfo(this)
        this.log('[INIT] Initialization Ended Succesfully.\n\n')

        // Start effectively the agent
        console.log('\n[',this.agentID,']Agent', this.name, 'Started!\n')
        await this.intentions.loop()
    }

    async actualTileCheck() {

        const haveParcels = this.parcels.carriedParcels() > 0;
        const OnDelivery = this.environment.onDeliveryTile()
      
        if (haveParcels && OnDelivery) {
          await this.deliver()
        }
      
        if (this.parcels.getPositions().some(pos => pos.isEqual(this.currentPosition))){
            await this.pickup()
        }

        if (!OnDelivery){


            if (this.fastPick && this.intentions.currentIntention.option.id != 'patrolling'){
                let up = [new Position(this.currentPosition.x, this.currentPosition.y + 1), 'up']
                let down = [new Position(this.currentPosition.x, this.currentPosition.y - 1), 'down']
                let left = [new Position(this.currentPosition.x - 1, this.currentPosition.y), 'left']
                let right = [new Position(this.currentPosition.x + 1, this.currentPosition.y), 'right']
                
                let ref_id = ''
                if (this.intentions.currentIntention && this.intentions.currentIntention.option && this.intentions.currentIntention.option.parcel)
                    ref_id = this.intentions.currentIntention.option.parcel.id

                console.log('\nFastCheck:\nPositions:',up, down, left, right)
                for (let p of this.parcels.getParcels().values()){
                    if (!this.parcels.myParcels.has(p.id) && p.id != ref_id)
                        console.log('PArcel position', p.id, p.position)
                        if (p.position.isEqual(up[0])){
                            await this.client.move(up[1])
                            await this.pickup()
                            await this.client.move(down[1])
                            console.log('UpCompleted.')
                            return
                        }
                            //this.intentions.push([new Option(`fastPickup_${up[1]}`, up, Infinity, [up[1], down[1]], p)])
                        else if (p.position.isEqual(down[0])){
                            await this.client.move(down[1])
                            await this.pickup()
                            await this.client.move(up[1])
                            console.log('DownCompleted.')
                            return
                        }
                            //this.intentions.push([new Option(`fastPickup_${down[1]}`, down, Infinity, [down[1], up[1]], p)])
                        else if (p.position.isEqual(left[0])){
                            await this.client.move(left[1])
                            await this.pickup()
                            await this.client.move(right[1])
                            console.log('LeftCompleted.')

                            return;
                        }
                            //this.intentions.push([new Option(`fastPickup_${left[1]}`, left, Infinity, [left[1], right[1]], p)])
                        else if (p.position.isEqual(right[0])){
                            await this.client.move(right[1])
                            await this.pickup()
                            await this.client.move(left[1])
                            console.log('RightCompleted.')
                            return;
                        }
                            //this.intentions.push([new Option(`fastPickup_${right[1]}`, right, Infinity, [right[1], left[1]], p)])
                }
            }
        }
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
            this.environment.increaseTemperature()
            this.lastPosition = this.currentPosition
            this.currentPosition = new Position(moveResult.x, moveResult.y)
            this.log('[MOVE',this.movementAttempts,'] Moved:', direction, '- New Position', this.currentPosition, ' - From', this.lastPosition)

            this.eventManager.emit('movement')
        }
        else{
            this.failMovement += 1
            this.log('[MOVE',this.movementAttempts,'] Moved:', moveResult, '- Fail - Position', this.currentPosition)
        }

        await this.actualTileCheck()
        this.status()

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
            this.log('[AGENT] Picked up', pickedUpParcels.length,'parcel(s):')
            
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

            this.parcelsDelivered += deliveredParcels.length
            this.score += this.parcels.getMyParcelsReward()
            console.log('[AGENT][Time:', (new Date().getTime() - this.startedAt) / 1000, '/', this.duration / 1000,'s','] Score: ',this.score - this.initialScore,' - Delivered', deliveredParcels.length ,'parcel(s) - Reward: ', this.parcels.getMyParcelsReward())

            this.eventManager.emit('delivered_parcels', deliveredParcels)

        }
    }
}


