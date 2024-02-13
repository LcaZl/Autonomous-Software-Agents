#!/usr/bin/env node
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client"
import { Environment } from "./Environment/environment.js"
import { AgentPercepts } from "./Memory/Percepts.js"
import { ParcelsManager } from "./Environment/Parcels/ParcelsManager.js"
import { PlayersManager } from "./Environment/players/PlayersManager.js"
import { Position } from './utils/Position.js'
import { Planner } from "./memory/reasoning/planning/Planner.js"
import { Beliefs } from "./memory/Reasoning/Beliefs.js"
import EventEmitter from "events"
import { Options } from "./memory/reasoning/options/Options.js"
import { Intentions } from "./memory/reasoning/intentions/Intentions.js"
import { AgentInterface } from "./AgentInterface.js"
import { ProblemGenerator } from "./memory/reasoning/planning/ProblemGenerator.js"
import { TeamManager } from "./multiagent/TeamManager.js"
import { CommunicationWithPDDL } from "./multiagent/CommunicationWithPddl.js"
import { CommunicationWithBFS } from "./multiagent/CommunicationWithBfs.js"

/**
 * Represents an autonomous software agent with capabilities to play a game. It encapsulates all necessary components,
 * configurations, and state information required for the agent's operation within the game environment.
 * 
 * @class
 * @extends AgentInterface
 */
export class Agent extends AgentInterface {

    /**
     * Initializes a new instance of the Agent with specified configurations and connection parameters.
     * Sets up the agent's internal state, including its name, operational parameters, path information,
     * multi-agent system configuration (if applicable) and init the connection to the game server.
     * 
     * @constructor

     * @param {Object|null} singleAgentConfig - Configuration for single-agent. Contains:
     * - host - The hostname or IP address of the game server the agent will connect to.
     * - token - Authentication token used to establish a secure connection with the game server.
     * - name - The name identifier for the agent.
     * - [duration=Infinity] - The operational duration of the agent in seconds. Defaults to Infinity.
     * - moveType - The type of movement strategy the agent will employ. BFS or PDDL
     * - fastPick - Flag indicating whether the agent should use a fast pick-up strategy.
     * - changingRisk - Factor used during the comparison between a new option and the current one. Rapresent the penality on the new one, if changed.
     * - adjMovementCostWindow - Predefined window used to compute the adjustment factor for movement cost.
     * 
     * @param {Object|null} multiagentConfig - Configuration for multi-agent. If null, single agent.
     */
    constructor(host, singleAgentConfig, multiagentConfig) {
        super()

        // Initialize agent configurations and state
        this.name = singleAgentConfig.username
        this.duration = singleAgentConfig.duration ? singleAgentConfig.duration * 1000 : Infinity // Convert duration to milliseconds
        this.moveType = singleAgentConfig.moveType
        this.fastPick = singleAgentConfig.fastPick
        this.changingRisk = singleAgentConfig.changingRisk
        this.adjMovementCostWindow = singleAgentConfig.adjustMovementCostWindow
        this.playerCheckInterval = singleAgentConfig.playerCheckInterval
        this.disappearedPlayerValidity = singleAgentConfig.disappearedPlayerValidity

        // Initialize path and position information
        this.lastPosition = null
        this.currentPosition = null
        this.lastDirection = null

        // Configure multi-agent system if applicable
        this.multiagent = multiagentConfig != null
        this.multiagentConfig = multiagentConfig
        this.team = null // Team information
        this.communication = null // Communication module

        // Establish connection to the game server
        this.connected = false
        this.client = new DeliverooApi(host, singleAgentConfig.token) // Connection

        // Initialize perception and event management components
        this.eventManager = new EventEmitter()
        this.percepts = new AgentPercepts(this) // Percept management
    }

    /**
     * Initializes the agent involves waiting for the initial connection and sensory data, 
     * configuring agent and environment properties, initializing agent strategy components
     * and setting timers for agent operation duration and decision-making updates. If the agent operates in a
     * multi-agent environment or uses specific movement strategies like PDDL, additional initialization steps are taken.
     * Finally, the agent enters its operational loop, executing its intentions based on the configured components.
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
            this.MAX_PARCELS = this.client.config.PARCELS_MAX == 'infinite' ? 100000 : this.client.config.PARCELS_MAX
            this.MOVEMENT_DURATION = this.client.config.MOVEMENT_DURATION
            this.PARCEL_DECADING_INTERVAL = this.client.config.PARCEL_DECADING_INTERVAL == '1s' ? 1000 : Infinity
            this.RANDOM_AGENT_SPEED = parseInt(this.client.config.RANDOM_AGENT_SPEED)
            this.RANDOMLY_MOVING_AGENTS = this.client.config.RANDOMLY_MOVING_AGENTS
            this.AGENTS_OBSERVATION_DISTANCE = this.client.config.AGENTS_OBSERVATION_DISTANCE

            this.environment = new Environment(this)

            if (this.multiagent) 
                await this.initMultiagent()
            
            // Initialize agent components
            this.parcels = new ParcelsManager(this)
            this.players = new PlayersManager(this, this.playerCheckInterval, this.disappearedPlayerValidity)
            this.planner = new Planner(this)

            if (this.moveType.startsWith('PDDL')){
                this.beliefs = new Beliefs(this)
                this.problemGenerator = new ProblemGenerator(this)
                await this.planner.loadDomain()
            }

            this.options = new Options(this)
            this.intentions = new Intentions(this)

            // Activate the managment of the events
            if (this.moveType.startsWith('PDDL')) this.beliefs.activate()

            this.options.activate()
            this.parcels.activate()
            this.players.activate()
            if (this.multiagent) this.communication.activate()
            

            // Timer for agent duration, id specified
            this.startedAt = new Date().getTime()
            if (this.duration != Infinity){
                setTimeout(async () => {
                    await this.finalMetrics()
                    process.exit(0) 
                }, this.duration)

                // To update the options when the time is expiring.
                // If the agent is carring parcels, when this timer expires the best option will be the delivery, if appropriate.
                setTimeout(() =>{
                    this.eventManager.emit('update_options')
                    console.log('[AGENT] Time is almost ended.')
                }, this.duration - (this.MOVEMENT_DURATION * (this.environment.mapHeight * 2)))
            }
            this.info()
            console.log('[INIT] Initialization Ended Succesfully.\n\n')
            
            // Start the agent
            try {
                if (this.multiagent){
                    if (this.moveType === 'PDDL_1'){
                        this.intentions.multiagentPddlLoop()
                    }
                    else
                        this.intentions.multiagentLoop()
                }
                else
                    this.intentions.loop()
            }
            catch(error){
                console.log('Error while executing.\nError:\n',error)
                return
            }
    }

    /**
     * Initializes the multi-agent capabilities of the agent, including setting up team configuration,
     * establishing communication strategies based on the team's chosen movement strategy and ensuring synchronization
     * before proceeding. It waits for team synchronization
     * before completing, ensuring that all team members are ready to operate in a coordinated manner.
     *
     * @async
     */
    async initMultiagent(){
        console.log('[INIT] Initializing team. Configuration:\n', this.multiagentConfig)
        console.log('[INIT] Trying to connect to team members ...')

        this.moveType = this.multiagentConfig.teamStrategy
        this.team = new TeamManager(this, this.multiagentConfig)
        
        if (this.moveType === 'PDDL' || this.moveType === 'PDDL_1')
            this.communication = new CommunicationWithPDDL(this)
        else
            this.communication = new CommunicationWithBFS(this)
        
        while (!this.team.synchronized) { await new Promise(resolve => setTimeout(resolve, 5)) }
        
        console.log('\nTeam synchronized, info:\n')
        this.team.toString()
    }

    /**
     * Moves the agent in a given direction and updates its position on success.
     * 
     * @async
     * @param {string} direction - The direction to move.
     * @returns {Promise<boolean>} True if the move was successful, false otherwise.
     */
    async move(direction) {
        this.lastDirection = direction
        this.movementAttempts++ // Track attempt count

        // Attempt to move and update position on success
        let moveResult = await this.client.move(direction)
        if (moveResult !== false) {
            this.lastDirection = direction
            this.effectiveMovement++ // Increment successful moves
            this.lastPosition = this.currentPosition // Update position tracking
            this.currentPosition = new Position(moveResult.x, moveResult.y)
            this.eventManager.emit('movement') // Notify movement event
        } else {
            this.failMovement++ // Increment failed moves
        }

        //this.status()
        return moveResult !== false
    }

    /**
     * Attempts to pick up parcels and updates the agent state on success.
     * 
     * @async
     */
    async pickup() {
        let pickedUpParcels = await this.client.pickup() // Attempt parcel pickup

        // Update agent state and emit events on success
        if (pickedUpParcels && pickedUpParcels.length > 0) {
            this.pickUpActions++
            this.parcelsPickedUp += pickedUpParcels.length
            //console.log('[AGENT] Picked up', pickedUpParcels.length, 'parcel(s)')
            this.eventManager.emit('picked_up_parcels', pickedUpParcels.map(p => p.id)) // Notify parcel pickup
            if (this.multiagent) this.eventManager.emit('communicate_pickup', pickedUpParcels.map(p => p.id)) // Multi-agent communication
        }
    }

    /**
     * Attempts to deliver carried parcels and updates the agent state on success.
     * 
     * @async
     */
    async deliver() {
        let deliveredParcels = await this.client.putdown() // parcel delivery

        // Update agent state and emit events 
        if (deliveredParcels && deliveredParcels.length > 0) {
            this.deliveryActions++
            this.parcelsDelivered += deliveredParcels.length
            //console.log('[AGENT] Delivered', deliveredParcels.length, 'parcel(s)')
            this.eventManager.emit('delivered_parcels', deliveredParcels.map(p => p.id)) // Notify parcel delivery
            if (this.multiagent) this.eventManager.emit('communicate_delivery', deliveredParcels.map(p => p.id)) // Multi-agent communication
        }
    }

    /**
     * Drops all parcels currently held by the agent. Used in multi-agent setups for parcel sharing.
     * 
     * @async
     */
    async leaveParcels() {
        await this.client.putdown(this.parcels.myParcels) // Drop held parcels
        //console.log('[AGENT] Left', this.parcels.myParcels.size, 'parcel(s)')
        this.eventManager.emit('left_parcels') // Notify of parcel drop
    }

    /**
     * Evaluates the agent's current and adjacent tiles for actions like delivery or pickup based on conditions such as
     * being on a delivery tile, presence of free parcels and if fast pick is enabled, checks adjacent tiles for quick pickup.
     * 
     * @async
     * @param {Position|null} nextPosition - The next position the agent plans to move to.
     * @returns {Promise<boolean>} True if the fast pickup is enabled and the move performed for pick up brings 
     * the agent on the next position of the current plan. Otherwise, false
     */
    async actualTileCheck(nextPosition) {

        // If i'm on a delivery with parcels, deliver them.
        const OnDelivery = this.environment.onDeliveryTile()
        const currentOption = this.intentions.currentIntention.option
        const freeParcels = this.parcels.getFreeParcels()

        if (OnDelivery && this.parcels.carriedParcels() > 0)
            await this.deliver()
        else {
            if (freeParcels.length > 0){ 
                for(let parcel of freeParcels.values()){

                    if (currentOption.parcelId !== parcel.id && 
                        parcel.position.isEqual(this.currentPosition)){
                        await this.pickup()
                        break; // One pick up ona tile takes all parcels.
                    }
                    
                }
            }
        }
    
        // If fast pick is enabled, check the nearby tiles for parcels and take them.
        if (this.fastPick){
            
            const directions = [
                { pos: new Position(this.currentPosition.x, this.currentPosition.y + 1), name: 'up', opposite: 'down' },
                { pos: new Position(this.currentPosition.x, this.currentPosition.y - 1), name: 'down', opposite: 'up' },
                { pos: new Position(this.currentPosition.x - 1, this.currentPosition.y), name: 'left', opposite: 'right' },
                { pos: new Position(this.currentPosition.x + 1, this.currentPosition.y), name: 'right', opposite: 'left' },
            ]
            let toDoAtTheEnd = null
            for (const parcel of freeParcels.values()) {

                if (parcel && parcel.id != currentOption.parcelId){ // If the parcel is not the current intention target

                    const direction = directions.find(dir => parcel.position.isEqual(dir.pos))
                    if (direction){
                        if (nextPosition !== null && nextPosition.isEqual(direction.pos))
                            toDoAtTheEnd = direction.name
                        else{
                            this.fastPickMoves += 1
                            await this.client.move( direction.name )
                            await this.pickup()
                            await this.client.move( direction.opposite )
                        }
                    }

                }
            }
            if (toDoAtTheEnd !== null){
                this.fastPickMoves += 1
                await this.client.move( toDoAtTheEnd )
                await this.pickup()
                return true
            }
        }

        return false
    }
}


