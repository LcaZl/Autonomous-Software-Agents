import { PddlExecutor } from "@unitn-asa/pddl-client"
import { Agent } from "../../agent.js"
import { Intention } from "./intentions/Intention.js"
import { BfsExecutor } from "../../utils/BfsExecutor.js"
import { BfsOption, PddlOption } from "./options/Option.js"
import { MessageType } from "../../multiagent/Communication.js"

/**
 * Manages the movement plans for an agent, including execution of sub-intentions and monitoring path availability.
 */
export class Move {
    #parent 
    #stopped = false // Flag to indicate whether the plan has been stopped.
    #sub_intentions = []

    /**
     * Constructs a Move instance associated with a specific agent and parent context.
     * 
     * @param {*} parent - The parent context or object that initiated this move.
     * @param {Agent} agent - The agent that will execute this move.
     */
    constructor(parent, agent) {
        this.#parent = parent
        this.agent = agent 
        this.index = null // Used to track the current position in the movement plan.

        this.positions = [] // Array of positions that form the path of the move.
        this.actions = [] // Corresponding actions to be taken at each position in the path.
        this.plan = null // The overall plan.
    }

    /**
     * Checks if the move has been stopped.
     * 
     * @returns {boolean} True if the move has been stopped, false otherwise.
     */
    get stopped() {
        return this.#stopped
    }

    /**
     * Stops the move and all associated sub-intentions.
     */
    stop() {
        this.#stopped = true
        this.#sub_intentions.forEach(subIntention => subIntention.stop())
    }

    /**
     * Initiates a sub-intention based on a given option, adding it to the list of sub-intentions.
     * 
     * @param {*} option - The option associated with the sub-intention.
     * @returns {Promise<any>} The result of achieving the sub-intention.
     */
    async subIntention(option) {
        const subIntention = new Intention(this, option, this.agent)
        this.#sub_intentions.push(subIntention)
        return subIntention.achieve()
    }

    /**
     * Checks if the remaining path from a given index is free from other players.
     * 
     * @param {number} idx - The index in the positions array from which to start the check.
     * @returns {boolean} True if the path from the given index is free from other players, false otherwise.
     */
    isPathFree(idx) {
        const remainingPositions = idx === -1 ? this.positions : this.positions.slice(idx)
        const currentPositions = this.agent.players.getCurrentPositions()

        return remainingPositions.every(tile => !currentPositions.some(pos => pos.isEqual(tile)))
    }
}


export class Patrolling extends Move {

    /**
     * @param {Object} option - The option to evaluate for applicability.
     * @returns {boolean} True if the option corresponds to patrolling, false otherwise.
     */
    static isApplicableTo(option) {
        return option.id === 'patrolling'
    }

    /**
     * Executes the patrolling action based on the agent's current movement type.
     * 
     * @param {Object} option - The patrolling option to execute.
     * @returns {boolean} Resolves to true if the action is successfully initiated.
     * @throws {Array} An array containing the string 'stopped' if the action was halted.
     */
    async execute(option) {
        if (this.stopped) throw ['stopped'] // Check if the action has been stopped and exit if so.

        let patrolling

        if (this.agent.moveType === 'BFS') {
            patrolling = new BfsOption('bfs_patrolling', null, this.agent)
        } else if (this.agent.moveType === 'PDDL' || this.agent.moveType === 'PDDL_1') {
            patrolling = new PddlOption('pddl_patrolling', null, this.agent)
        }

        // Initiate the sub-intention for patrolling, awaiting its completion.
        return await this.subIntention(patrolling)
    }
}


export class BreadthFirstSearchMove extends Move {
    /** 
     * @param {Object} option - The option to evaluate for applicability.
     * @returns {boolean} True if the option is compatible with BFS movement, false otherwise.
     */
    static isApplicableTo(option) {
        return option.id.startsWith('bfs_pickup-') || option.id === 'bfs_patrolling' || option.id === 'bfs_delivery'
    }

    /**
     * Executes the BFS movement strategy based on the provided option.
     * 
     * @param {Object} option - The movement option to execute, containing the search path and actions.
     * @returns {Promise<boolean>} Resolves to true if the movement is successfully executed.
     * @throws {Array} An array containing a string error code if the movement cannot be executed.
     */
    async execute(option) {

        const patrolling = option.id === 'bfs_patrolling'

        // Updates the current plan based on the agent's position and the option's search path
        const updatePlan = () => {
            option.update(this.agent.currentPosition)
            this.plan = option.search
            if (this.plan.length === 0) throw ['target_not_reachable']
            this.positions = option.search.path.positions
            this.actions = option.search.path.actions
        }

        // Handles individual movement commands in the BFS execution sequence
        const movementHandle = async (direction, index) => {
            const tileCheckStatus = await this.agent.actualTileCheck(this.positions[index])
            if (this.stopped) throw ['stopped']

            if (!tileCheckStatus) {
                const moveStatus = await this.agent.move(direction)
                if (!moveStatus) throw ['movement_fail']
            }

            if (!patrolling) {
                const freePath = this.isPathFree(index)
                if (!freePath) throw ['path_not_free']
            }

            if (this.stopped) throw ['stopped']
        }

        // Executor for BFS actions, defining movement directions labels and handlers
        const bfsExecutor = new BfsExecutor(
            { name: 'right', executor: (idx) => movementHandle('right', idx) },
            { name: 'left', executor: (idx) => movementHandle('left', idx) },
            { name: 'up', executor: (idx) => movementHandle('up', idx) },
            { name: 'down', executor: (idx) => movementHandle('down', idx) }
        )

        // Initialize or update the movement plan based on the current agent position and the option's availability of the path
        if (option.startPosition.isEqual(this.agent.currentPosition) && option.search.length !== 0) {
            this.positions = option.search.path.positions
            this.actions = option.search.path.actions
        } else {
            updatePlan()
        }

        // Execute the BFS plan, handling potential errors and re-planning if necessary
        let pathError = false
        let movementFailures = 0
        do {
            pathError = false
            this.agent.client.socket.emit("path", this.positions)
            await bfsExecutor.exec(this.actions).catch((error) => {
                if (error[0] === 'movement_fail') {
                    updatePlan()
                    movementFailures++
                    if (movementFailures === 10) throw error
                } else if (error[0] === 'path_not_free') {
                    updatePlan()
                    pathError = true
                } else {
                    throw error
                }
            })
        } while (pathError)

        // Finalize the move by executing pickup or delivery actions if applicable
        if (!this.stopped) {
            if (option.id.startsWith('bfs_pickup-')) await this.agent.pickup()
            if (option.id === 'bfs_delivery' && this.agent.environment.isDeliveryPosition(this.agent.currentPosition)) await this.agent.deliver()
        }

        return true // Indicate successful execution of the BFS movement strategy
    }
}



export class PddlMove extends Move {
    /**    
     * @param {Object} option - The option to evaluate for applicability.
     * @returns {boolean} True if the option is compatible with PDDL movement, false otherwise.
     */
    static isApplicableTo(option) {
        return option.id.startsWith('pddl_pickup') || option.id.startsWith('pddl_delivery') || option.id === 'pddl_patrolling'
    }

    /**
     * Executes the PDDL movement strategy based on the provided option, which may includes a plan derived from PDDL planning.
     * 
     * @param {PddlOption} option - The PDDL movement option to execute
     * @returns {Promise<boolean>} Resolves to true if the movement is successfully executed.
     * @throws {Array} An array containing a string error code if the movement cannot be executed.
     */
    async execute(option) {

        const patrolling = option.id === 'pddl_patrolling'

        // Updates the current plan based on the agent's position and the option's PDDL plan
        const updatePlan = async () => {
            await option.update(this.agent.currentPosition)
            if (!option.plan || option.plan.length === 0) throw ['target_not_reachable']
            this.plan = option.plan.steps
            this.positions = option.plan.positions
        }

        // Handles individual movement commands in the PDDL execution sequence
        const movementHandle = async (direction, index) => {
            const tileCheckStatus = await this.agent.actualTileCheck(this.positions[index] === (this.positions.length - 1) ? null : this.positions[index])
            if (this.stopped) throw ['stopped']

            if (!tileCheckStatus) {
                const moveStatus = await this.agent.move(direction)
                if (!moveStatus) throw ['movement_fail']
            }

            // Verify path is free from other players update beliefs and plan if not
            if (!this.agent.multiagent && !patrolling){
                const freePath = this.isPathFree(index)
                if (!freePath) {
                    await updatePlan()
                    throw ['path_not_free']
                }
            }
        }

        // Executor for PDDL actions, defining movement and interaction actions with handlers
        const pddlExecutor = new PddlExecutor(
            { name: 'move_right', executor: (idx) => movementHandle('right', idx) },
            { name: 'move_left', executor: (idx) => movementHandle('left', idx) },
            { name: 'move_up', executor: (idx) => movementHandle('up', idx) },
            { name: 'move_down', executor: (idx) => movementHandle('down', idx) },
            { name: 'deliver', executor: (idx) => this.agent.deliver() },
            { name: 'pickup', executor: (idx) => this.agent.pickup() }
        )

        // Initialize or update the movement plan based on the current agent position and the PDDL plan
        if (option.plan && option.startPosition.isEqual(this.agent.currentPosition)) {
            this.plan = option.plan.steps
            this.positions = option.plan.positions
        } else {
            await updatePlan()
        }

        // Execute the PDDL plan, handling potential path and movement errors
        let pathError = false
        let movementFailures = 0
        do {
            pathError = false
            this.agent.client.socket.emit("path", this.positions)

            await pddlExecutor.exec(this.plan).catch((error) => {
                if (['path_not_free', 'movement_fail'].includes(error[0])) {
                    pathError = true
                    movementFailures += error[0] === 'movement_fail' ? 1 : 0
                    if (movementFailures > 1) throw error
                } else {
                    throw error
                }
            })

            if (this.stopped) throw ['stopped']
        } while (pathError)

        return true
    }
}


/**
 * Handles the movement and actions involved in sharing parcels between agents.
 * This class is part of a multi-agent configuration where agents can share parcels to complete a delivery.
 */
export class ParcelsSharingMovement extends Move {
    /**
     * @param {Object} option - The option to be evaluated.
     * @returns {boolean} True if the option is for parcel sharing, false otherwise.
     */
    static isApplicableTo(option) {
        // The movement strategy is applicable only to options specifically marked for parcel sharing.
        return option.id === 'parcels_sharing'
    }

    /**
     * Executes the parcel sharing strategy.
     * 
     * @param {Object} option - The parcel sharing option.
     * @returns {Promise<boolean>} A promise that resolves to true upon successful execution of the sharing strategy.
     */
    async execute(option) {
        // Mapping of directions to their opposites, used for reversing movements
        const oppositeMap = {
            'left': 'right',
            'right': 'left',
            'up': 'down',
            'down': 'up'
        }

        /**
         * Updates the movement plan based on the agent's current position and the sharing option.
         */
        const updatePlan = () => {
            option.update(this.agent.currentPosition) // Update the option with the current position.
            this.plan = option.search

            // Fallback to the agent's current position if no plan is available.
            // It means that the agent is adjacent to the teammate, if not is managed as an error.
            if (this.plan.length === 0) {
                this.positions = [this.agent.currentPosition]
                this.actions = []
            } else {
                this.positions = option.search.path.positions
                this.actions = option.search.path.actions
            }
        }

        /**
         * @param {string} direction - The direction in which to move the agent.
         * @param {number} index - The index of the action within the plan.
         */
        const movementHandle = async (direction) => {
            const status = await this.agent.move(direction) // Attempt to move the agent in the specified direction.
            if (!status) throw ['movement_fail'] // Throw an error if the movement fails.
        }

        // Initialize a BfsExecutor with actions for each direction, using the movementHandle function.
        const bfsExecutor = new BfsExecutor(
            { name: 'right', executor: (idx) => movementHandle('right', idx) },
            { name: 'left', executor: (idx) => movementHandle('left', idx) },
            { name: 'up', executor: (idx) => movementHandle('up', idx) },
            { name: 'down', executor: (idx) => movementHandle('down', idx) },
        )

        // Update the plan if the agent's current position does not match the final position in the option
        if (!this.agent.currentPosition.isEqual(option.finalPosition)) {
            updatePlan()
        } else {
            // Use the agent's current position as the base plan.
            this.positions = [this.agent.currentPosition]
            this.actions = []
        }

        let pathError
        do {
            pathError = false
            this.agent.client.socket.emit("path", this.positions)
            await bfsExecutor.exec(this.actions).catch((error) => {
                const myTeammateIsNextToMe = this.agent.environment.isNextToMe(this.agent.team.teammate.id) // Check if the teammate is adjacent.
                if (myTeammateIsNextToMe) {
                    pathError = false // Ignore path errors if the teammate is next to the agent.
                } else if (error[0] === 'movement_fail') {
                    updatePlan() // Update the plan if a movement fails.
                    pathError = true // Indicate a path error to retry with the updated plan
                } else {
                    throw error
                }
            })
        } while (pathError)

        // Proceed with the parcel sharing process, coordinating with the teammate for alignment and parcel transfer.
        option.imReady = true // Mark this agent as ready for the sharing process.
        this.agent.communication.firstAlignment() // Initiate the first alignment phase.
        while (!(option.imReady && option.teammateReady)) {
            // Wait until both agents are aligned and ready for parcel transfer.
            this.agent.communication.firstAlignment() // Re-initiate alignment to be sure the other agent is notified.
            await new Promise(resolve => setTimeout(resolve, 5))
        }

        // Execute the role-specific actions for parcel transfer.
        if (option.role === 'leave') {
            // The 'leave' role involves leaving parcels at the designated location and moving away.
            await this.agent.leaveParcels() // Execute the parcel leaving action.
            await this.agent.move(oppositeMap[this.agent.lastDirection]) // Move in the opposite direction of the last movement.
            this.agent.communication.secondAlignment(option) // notify the teammate that the parcels can be taken (LEFT)
            while (option.parcelsState !== 'shared') {
                // Wait until the parcels have been successfully shared.
                await new Promise(resolve => setTimeout(resolve, 1))
            }
        } else {
            // The other role involves waiting for parcels to be left before picking them up (LEFT)
            while (option.parcelsState !== 'left') {
                await new Promise(resolve => setTimeout(resolve, 1))
            }

            await this.agent.move(this.agent.lastDirection) // Move towards the parcels.
            await this.agent.pickup() 
            this.agent.communication.sharingComplete() 
        }

        return true // Indicate successful execution of the parcel sharing strategy.
    }
}


export class PddlMultiagentMove extends Move {
    /**
     * This move type is applicable to options that are prefixed with 'multiagent_' indicating multi-agent coordination.
     *
     * @param {Object} option - The option to evaluate for applicability.
     * @returns {boolean} True if the option is related to multi-agent coordination, false otherwise.
     */
    static isApplicableTo(option) {
        return option.id.startsWith('multiagent_')
    }

    /**
     * Executes the multi-agent plan associated with the given PDDL option.
     * 
     * @param {PddlOption} option - The multi-agent PDDL option to execute.
     * @returns {Promise<boolean>} A promise that resolves to true upon successful execution of the plan.
     */
    async execute(option) {
        // Function to update the plan based on the agent's current position.
        const updatePlan = async () => {
            await option.update(this.agent.currentPosition) // Update the option with the current position.
            if (!option.plan || option.plan.length === 0) {
                throw ['target_not_reachable'] // Throw an error if no plan is available or the plan is empty.
            }
            this.plan = option.plan.steps // Assign the plan steps to this instance for execution.
            this.positions = option.plan.positions // Assign the planned positions to this instance.
        }

        const movementHandle = async (direction, index) => {
            const status = await this.agent.move(direction)
            if (!status) throw ['movement_fail'] 
        }

        const pddlExecutor = new PddlExecutor(
            { name: 'move_right', executor: (idx) => movementHandle('right', idx) },
            { name: 'move_left', executor: (idx) => movementHandle('left', idx) },
            { name: 'move_up', executor: (idx) => movementHandle('up', idx) },
            { name: 'move_down', executor: (idx) => movementHandle('down', idx) },
            { name: 'deliver', executor: (idx) => this.agent.deliver() }, // Handler for delivery action.
            { name: 'pickup', executor: (idx) => this.agent.pickup() } // Handler for pickup action.
        )

        // Check if the agent's current position matches the start position of the plan.
        if (!option.startPosition.isEqual(this.agent.currentPosition)) {
            await updatePlan() // Update the plan if the current position doesn't match the start position.
        } else {
            this.plan = option.plan.steps
            this.positions = option.plan.positions
        }

        this.agent.client.socket.emit("path", this.positions)

        await pddlExecutor.exec(this.plan).catch((error) => {
            throw error 
        })

        return true
    }
}
