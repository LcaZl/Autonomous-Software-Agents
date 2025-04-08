import { Position } from "../../../utils/Position.js"
import { Agent } from "../../../Agent.js"
import { Parcel } from "../../../Environment/Parcels/Parcel.js"

/**
 * Represents a generic option or action that an agent can take.
 */
export class Option {
    /**
     * Constructs a new Option instance.
     * 
     * @param {string} id - The unique identifier of the option.
     * @param {Agent} agent - The agent.
     */
    constructor(id, agent) {
        this.id = id // Identifier of the option
        this.startPosition = agent.currentPosition // The starting position for this option
        this.agent = agent // Reference to the agent
        this.utility = 0 // The utility value of the option, used for decision making
    }

    /**
     * Returns a string representation of the option.
     * 
     * @returns {string} String representation of the option.
     */
    toString() {
        return `[ID: ${this.id}, S_POS: ${this.startPosition}]`
    }
}


/**
 * Represents a Breadth-First Search (BFS) based option, extending the generic option with specific BFS strategy attributes.
 */
export class BfsOption extends Option {
    /**
     * Initializes a BFS option with a unique identifier, optional parcel and the agent. 
     * Sets up the option based on the type (delivery, patrolling, or pickup).
     * 
     * @param {String} id - Unique identifier for the option.
     * @param {Parcel} parcel - Associated parcel, if applicable.
     * @param {Agent} agent - Agent instance for accessing environment and utility calculations.
     */
    constructor(id, parcel, agent) {
        super(id, agent)
        this.parcel = this.id !== 'bfs_patrolling' ? parcel : null
        this.parcelId = this.parcel ? parcel.id : null
        this.utilityWithoutObstacles = null
        this.update(agent.currentPosition)
    }

    /**
     * Updates the BFS option's plan based on a new start position, recalculating path, final position and utility.
     * 
     * @param {Position} startPosition - The new starting position for the option.
     */
    update(startPosition) {
        this.startPosition = startPosition
        let result

        switch (this.id) {
            case 'bfs_delivery':
                result = this.agent.options.utilityCalculator.deliveryUtility(startPosition)
                break
            case 'bfs_patrolling':
                this.finalPosition = this.agent.environment.getRandomPosition()
                result = { search: this.agent.environment.getShortestPath(startPosition, this.finalPosition), value: 0 }
                break
            default:
                if (this.id.startsWith('bfs_pickup')) {
                    result = this.agent.options.utilityCalculator.pickUpUtility(startPosition, this.parcel)
                }
                break
        }

        if (result) {
            this.search = result.search
            this.utility = result.value
            this.finalPosition = result.search.finalPosition
        }
    }

    /**
     * Generates a raw data representation of the BFS option for logging or debugging purposes.
     * For multi-agent communication.
     * @returns {Object} The raw data of the BFS option.
     */
    raw() {
        return {
            id: this.id,
            parcelId: this.parcelId,
            startPosition: this.startPosition,
            finalPosition: this.finalPosition,
            search: this.search,
            utility: this.utility,
            utilityNoObs: this.utilityWithoutObstacles
        }
    }

    /**
     * Returns a string representation of the BFS option.
     * 
     * @returns {string} String representation of the BFS option.
     */
    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_id: ${this.parcelId}, Search: ${this.search ? this.search.length : 'N/A'}]`
    }
}

/**
 * Represents an option for PDDL strategy.
 * This option extends the generic option with PDDL-specific attributes and methods for planning.
 */
export class PddlOption extends Option {
    /**
     * Initializes a PDDL option, optionally loading from raw data in multi-agent configuration. When not loading from raw data,
     * it sets up the option with a parcel if applicable and initializes planning attributes.
     * 
     * @param {String} id - Unique identifier for the option.
     * @param {Parcel} parcel - Associated parcel, if applicable.
     * @param {Agent} agent - Agent instance for accessing environment and utility calculations.
     * @param {boolean} fromRaw - Flag indicating whether to initialize from raw data.
     * @param {Object} rawOption - Raw data to initialize the option from, if applicable.
     */
    constructor(id, parcel, agent, fromRaw = false, rawOption = null) {
        super(id, agent)
        if (!fromRaw) {
            this.parcel = this.id !== 'pddl_patrolling' ? parcel : null
            this.parcelId = this.parcel ? parcel.id : null
            this.plan = null
            this.finalPosition = null
            this.simplifiedUpdate(agent.currentPosition)
        } else {
            this.loadFromRaw(rawOption)
        }
    }

    /**
     * Generates a raw data representation of the PDDL option for logging, debugging, or storage purposes.
     * 
     * @returns {Object} The raw data of the PDDL option.
     */
    raw(){
        return {
            id : this.id,
            parcel : {
                id : this.parcelId,
                reward : this.parcel ? this.parcel.reward : 0,
                position : this.parcel ? this.parcel.position : null
            },
            startPosition: this.startPosition,
            finalPosition : this.finalPosition,
            plan : this.plan,
            utility : this.utility
        }
    }

    /**
     * Loads option data from a raw object, reconstructing complex objects like positions and adjusting attributes as necessary.
     * 
     * @param {Object} rawOption - The raw option data to load from.
     */
    loadFromRaw(rawOption){
        if (rawOption.id.startsWith('pddl_delivery'))
        rawOption.id = 'pddl_delivery'
        this.parcel = rawOption.parcel
        this.parcelId = rawOption.parcel.id
        this.plan = rawOption.plan
        this.plan.startPosition = new Position(this.plan.startPosition.x, this.plan.startPosition.y)
        this.plan.finalPosition = new Position(this.plan.finalPosition.x, this.plan.finalPosition.y)
        this.finalPosition = new Position(rawOption.finalPosition.x, rawOption.finalPosition.y)
        this.startPosition = new Position(rawOption.startPosition.x, rawOption.startPosition.y)
        let newPlanPositions = []
        for (const p of this.plan.positions)
            newPlanPositions = new Position(p.x, p.y)
        this.plan.positions = newPlanPositions
        this.utility = rawOption.utility
    }

    /**
     * Updates the option's utility and final position based on a simplified model, 
     * suitable for scenarios where quick estimations are preferred over detailed planning.
     * 
     * @param {Position} startPosition - The current starting position for the option's execution.
     */
    simplifiedUpdate(startPosition) {
        this.startPosition = startPosition
        if (this.id === 'pddl_delivery') {
            const search = this.agent.environment.getEstimatedNearestDeliveryTile(startPosition)
            this.utility = this.agent.options.utilityCalculator.simplifiedDeliveryUtility(startPosition, search.position, search.distance)
            this.finalPosition = search.position
        } else if (this.id.startsWith('pddl_pickup')) {
            if (!this.agent.parcels.getFreeParcels().map(p => p.id).includes(this.parcelId)) {
                this.agent.eventManager.emit('delete_parcel', this.parcelId)
            }
            this.utility = this.agent.options.utilityCalculator.simplifiedPickUpUtility(startPosition, this.parcel)
            this.finalPosition = this.parcel.position
        } else if (this.id === 'pddl_patrolling') {
            this.finalPosition = this.agent.environment.getRandomPosition()
            this.utility = 0
        }
    }

    /**
     * Asynchronously updates the plan, final position and utility based on the provided start position.
     * It logs the time taken to compute the plan.
     * 
     * @async
     * @param {Position} startPosition - The starting position to update the plan from.
     */
    async update(startPosition) {
        this.startPosition = startPosition
        const startTime = performance.now()

        if (this.id === 'pddl_patrolling') {
            // For patrolling, generates a random final position and sets utility to 0
            this.finalPosition = this.agent.environment.getRandomPosition()
            this.plan = await this.agent.planner.getPlanFromTo(this.startPosition, this.finalPosition)
            this.utility = 0
        } else if (this.id === 'pddl_delivery' || this.id.startsWith('multiagent_pddl_delivery')) {
            // For delivery, calculates a delivery plan and its utility
            this.plan = await this.agent.planner.getDeliveryPlan(this.startPosition, this.parcelId)
            if (this.plan != null) {
                this.finalPosition = this.plan.finalPosition
                this.utility = this.agent.options.utilityCalculator.simplifiedDeliveryUtility(this.plan.startPosition, this.plan.finalPosition, this.plan.length)
            }
        } else if (this.id.startsWith('pddl_pickup-') || this.id.startsWith('multiagent_pddl_pickup-')) {
            // For pickup, calculates a pickup plan and its utility
            this.plan = await this.agent.planner.getPickupPlan(this.startPosition, this.parcel)
            if (this.plan != null) {
                this.finalPosition = this.plan.finalPosition
                this.utility = this.agent.options.utilityCalculator.simplifiedPickUpUtility(this.startPosition, this.parcel, this.plan.length)
            }
        } else {
            // Throws an error if invalid option IDs detected.
            throw ['Option_id_not_valid', 'a']
        }

        // Sets utility to 0 if no plan was found
        if (this.plan == null) this.utility = 0
        

        const endTime = performance.now()
        // Logs the time taken to compute the plan
        //console.log(`[${Math.round(startTime / 1000)}/${this.agent.duration/1000}][${this.id}] plan from ${this.startPosition} to ${this.finalPosition} in ${endTime - startTime}ms`)
    }


    /**
     * Returns a string representation of the PDDL option.
     * 
     * @returns {string} String representation of the PDDL option.
     */
    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_id: ${this.parcelId}]`
    }
}

/**
 * Represents an option for sharing parcels between agents, extending the generic option functionality.
 * This option is specialized for scenarios where agents collaborate, sharing parcels at a midpoint.
 */
export class ShareParcelsOption extends Option {
    /**
     * Initializes a new instance of the ShareParcelsOption with specific attributes for parcel sharing.
     * 
     * @param {string} id - The unique identifier of the option.
     * @param {Position} midPosition - The designated midpoint for sharing parcels.
     * @param {number} utility - The utility value associated with this sharing option.
     * @param {Agent} agent - The agent instance associated with this option.
     * @param {string} role - The role of the agent in the sharing process.
     */
    constructor(id, midPosition, utility, agent, role) {
        super(id, agent)
        this.startPosition = null // Initially null, will be set when updating the option
        this.finalPosition = midPosition // The designated meeting point for parcel exchange
        this.utility = utility // Utility value for choosing this option (delivery utility)
        this.search = null // Path search result, initialized when updating the option
        this.role = role // Agent's role in the sharing process
        this.weAreAligned = 0 // Alignment status indicator
        this.parcelsState = 'taken' // Initial state of the parcels
        this.imReady = false
        this.teammateReady = false
    }

    /**
     * Generates a raw data representation of the sharing option for logging or debugging.
     * 
     * @returns {Object} The raw data of the sharing option.
     */
    raw() {
        return {
            id: this.id,
            utility: this.utility,
            position: this.finalPosition
        }
    }

    /**
     * Updates the option with a new start position and calculates the path to the final position.
     * 
     * @param {Position} startPosition - The new starting position for the option.
     */
    update(startPosition) {
        this.startPosition = startPosition
        this.search = this.agent.environment.getShortestPath(startPosition, this.finalPosition, true)
    }
}


/**
 * Represents an option within a multi-agent system, extending the generic option functionality to support team-based decision making.
 * This class incorporates mechanisms for master-slave coordination, alignment checks, and plan execution statuses.
 */
export class MultiAgentOption extends Option {
    /**
     * Initializes a new instance of MultiAgentOption with team, role, and coordination-related properties.
     * 
     * @param {string} id - The unique identifier of the option.
     * @param {Agent} agent - The agent instance associated with this option.
     * @param {Array} team - The team of agents involved in this option.
     * @param {string} role - The role of this agent within the multi-agent option, typically 'master' or 'slave'.
     */
    constructor(id, agent, team, role) {
        super(id, agent)

        this.team = team // Team manager object
        this.role = role // Role of this agent in the multi-agent coordination

        this.masterOptions = [] // Queue of options for the master agent
        this.slaveOptions = [] // List of options for slave agents

        // Variables used to store reply anonymous function obtained from ask incoming message
        this.reply_masterConfirmation = null // where the slave must send the confirmation if he accept to cooperate
        this.reply_slaveNewOption = null // where the master must send the plan assigned to slave

        this.plans = null // Plans associated with this option
    }

    /**
     * Generates a raw data representation of the multi-agent option for logging or debugging purposes.
     * 
     * @returns {Object} The raw data of the multi-agent option, including its ID, role, and the last coordination packet.
     */
    raw() {
        return {
            id: this.id,
            lastPacket: this.lastPacket, // Assumes there's a mechanism to track the last coordination packet
            role: this.role
        }
    }

  
    /**
    * Preprocesses and adjusts the options for both master and slave agents to ensure consistency in data structure and during
    * multi-agent plan calcuilation.
    */
    preprocessOptions(){

        const teammatePosition = this.agent.players.getPlayers().get(this.agent.team.teammate.id).currentPosition
        this.masterOptions = this.agent.intentions.rawOptionQueue()

        for (let opt of this.masterOptions){

            opt.startPosition = new Position(opt.startPosition.x, opt.startPosition.y)
            opt.finalPosition = new Position(opt.finalPosition.x, opt.finalPosition.y)
            opt.parcel.position = new Position(opt.parcel.position.x, opt.parcel.position.y)
            opt.master = true
            opt.masterUtility = opt.utility
            if (opt.id.startsWith('pddl_delivery')){
                opt.id = 'pddl_delivery_master'
                opt.slaveUtility = 0
            }
            else               
                opt.slaveUtility = this.agent.options.utilityCalculator.simplifiedPickUpUtility(teammatePosition, opt.parcel)

        }

        for (let opt of this.slaveOptions){
            opt.startPosition = new Position(teammatePosition.x, teammatePosition.y)
            opt.finalPosition = new Position(opt.finalPosition.x, opt.finalPosition.y)
            opt.parcel.position = new Position(opt.parcel.position.x, opt.parcel.position.y)
            opt.master = false
            opt.slaveUtility = opt.utility
            if (opt.id.startsWith('pddl_delivery')){
                opt.id = 'pddl_delivery_slave'
                opt.masterUtility = 0
            }
            else
                opt.masterUtility = this.agent.options.utilityCalculator.simplifiedPickUpUtility(this.agent.currentPosition, opt.parcel)

        }
    }   
    
    async computeMultiagentPlan(masterOptions, slaveOptions) {

        // Set the actual available options
        this.masterOptions = masterOptions
        this.slaveOptions = slaveOptions
        this.preprocessOptions()

        //console.log(' - Options from slave:', this.slaveOptions)
        //console.log(' - My options:', this.masterOptions)        
        let masterOption = null
        let slaveOption = null

        // Concatenate all options available from both agent and slave.
        const concatenatedOptions = this.masterOptions.concat(this.slaveOptions)
        const freeParcels = new Set(this.agent.parcels.getFreeParcels().map(p => p.id))
        let allOptions = []
        let allIds = new Set()
        //console.log(concatenatedOptions)
        //console.log(freeParcels)

        // Filter this concatenated options to align them to master state (which include information of the slave).
        for (const p of concatenatedOptions){
            if (p.id.startsWith('pddl_delivery') || freeParcels.has(p.parcel.id))
                allOptions.push(p)
                allIds.add(p.id)
        }

        // If after filtering there aren't enough options, no multiagent plan.
        if (allOptions.length < 2 || allIds.size < 2) return false

        // Sort them by the maximum utility for the slave or the master
        // In this way, the option with higher utility will be first in the list, without regarding if the option came from master or slave.
        allOptions.sort((a, b) => Math.max(b.slaveUtility, b.masterUtility) - Math.max(a.slaveUtility, a.masterUtility))

        // Assign one option to master and one to slave in order to achive the maximum utility.
        if (allOptions.length === 2){
            if (allOptions[0].masterUtility >= allOptions[0].slaveUtility)
                masterOption = allOptions[0]
            else
                slaveOption = allOptions[0]
            
            if (masterOption === null)
                masterOption = allOptions[1]
            if (slaveOption === null)
                slaveOption = allOptions[1]
        }
        else{
            for (const opt of allOptions){

                if( masterOption === null && slaveOption === null){
                    if (opt.masterUtility >= opt.slaveUtility)
                        masterOption = opt
                    else
                        slaveOption = opt
                }
                else if (masterOption === null && opt.id !== slaveOption.id){
                    masterOption = opt
                }
                else if (slaveOption === null && opt.id !== masterOption.id){
                    slaveOption = opt
                }
                if (slaveOption !== null && masterOption !== null)
                    break
            }
        }

        // Ensure alignment of the selected options with actual agent positions.
        if (!masterOption.master) masterOption.startPosition = this.agent.currentPosition
        if (slaveOption.master) slaveOption.startPosition = this.agent.players.getPlayers().get(this.agent.team.teammate.id).currentPosition

        // Retrieve multiagent plan and extract the options for master and slave
        const startTime = performance.now()
        const plans = await this.agent.planner.getMultiagentPlan(masterOption, slaveOption)
        const endTime = performance.now()
        //console.log(`[${Math.round(startTime / 1000)}/${this.agent.duration/1000}][${this.id}] Multiagent plan for ${masterOption.id} and ${slaveOption.id} in ${endTime - startTime}ms`)
        if (plans === null) return false // No plan available

        masterOption.plan = plans.master
        slaveOption.plan = plans.slave
        this.newOptions = { forMaster : masterOption, forSlave : slaveOption}
        return true
    }
    
    
}
