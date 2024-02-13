import { PddlProblem } from "@unitn-asa/pddl-client"
import { Agent } from "../../../agent.js"

/**
 * Generates PDDL problem instances based on the agent's current beliefs and desired actions.
 */
export class ProblemGenerator {
    /**
     * Initializes the problem generator
     * @param {Agent} agent - The agent
     */
    constructor(agent) {
        this.agent = agent
    }

    /**
     * Generates a PDDL problem for moving the agent from one tile to another.
     * 
     * @param {Position} from - The starting position of the movement.
     * @param {Position} to - The final position of the movement.
     * @returns {PddlProblem} A PDDL problem instance for the move action.
     */
    go(from, to) {
        // Create a new PDDL problem with a unique name based on the start and end positions
        const problemName = `go_fromTo-${from.x}_${from.y}-${to.x}_${to.y}`
        const objectsWithType = this.agent.beliefs.getObjectsWithType() // Get objects and their types from the agent's beliefs
        const initialState = this.agent.beliefs.toPddlString() // Get the initial state in PDDL format from the agent's beliefs
        const goal = `at a${this.agent.agentID} t${to.x}_${to.y}`

        return new PddlProblem(problemName, objectsWithType, initialState, goal)
    }

    /**
     * Generates a PDDL problem for picking up a specified parcel from a given position.
     * 
     * @param {Position} from - The position from which the agent start the movement that end with picking up the parcel.
     * @param {String} parcelId - The identifier of the parcel to pick up.
     * @returns {PddlProblem} A PDDL problem instance for the pickup action.
     */
    pickupFrom(from, parcelId) {
        // Define the goal state for the pickup action
        const goal = `carries a${this.agent.agentID} ${parcelId}`

        // Create a new PDDL problem with a unique name based on the pickup position
        const problemName = `pickup_from-${from.x}_${from.y}`
        const objectsWithType = this.agent.beliefs.getObjectsWithType() // Get objects and their types from the agent's beliefs
        const initialState = this.agent.beliefs.toPddlString() // Get the initial state in PDDL format from the agent's beliefs

        // Construct and return the PDDL problem instance
        return new PddlProblem(problemName, objectsWithType, initialState, goal)
    }

    /**
     * Generates a PDDL problem for delivering a parcel.
     * 
     * @param {Position} from - Starting position for delivery.
     * @param {String} parcelId - ID of the parcel to be delivered.
     * @returns {PddlProblem} Generated PDDL problem for delivery.
     */
    deliverFrom(from, parcelId) {
        const goal = `not (carries a${this.agent.agentID} ${parcelId})`
        return new PddlProblem(
            `deliver_from-${from.x}_${from.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            goal
        )
    }

    /**
     * Generates PDDL problems for both master and slave agents combining their objectives into a single multi-agent problem.
     * Used with multi-agent configuration
     * 
     * @param {Object} masterOption - The raw option for the master agent.
     * @param {Object} slaveOption - The raw option for the slave agent.
     * @returns {Object} An object containing the combined multi-agent problem and individual problems for master and slave.
     */
    multiagentProblem(masterOption, slaveOption) {
        const teammateId = this.agent.team.teammate.id
        
        // Master agent's goal and problem
        const masterGoal = masterOption.id === 'pddl_delivery_master' ?
            `not (carries a${this.agent.agentID} ${masterOption.parcel.id})` :
            `carries a${this.agent.agentID} ${masterOption.parcel.id}`
        const masterProblem = new PddlProblem(
            `${masterOption.startPosition.x}_${masterOption.startPosition.y}-${masterOption.id.includes('delivery') ? 'delivery' : masterOption.finalPosition.x + '_' + masterOption.finalPosition.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            masterGoal
        )

        // Slave agent's goal and problem
        const slaveGoal = slaveOption.id === 'pddl_delivery_slave' ?
            `not (carries a${teammateId} ${slaveOption.parcel.id})` :
            `carries a${teammateId} ${slaveOption.parcel.id}`
        const slaveProblem = new PddlProblem(
            `${slaveOption.startPosition.x}_${slaveOption.startPosition.y}-${slaveOption.id.includes('delivery') ? 'delivery' : slaveOption.finalPosition.x + '_' + slaveOption.finalPosition.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            slaveGoal
        )

        // Combined multi-agent goal
        const combinedGoal = `and (${masterGoal}) (${slaveGoal})`
        const multiagentProblem = new PddlProblem(
            `multiagent`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            combinedGoal
        )

        //console.log('Master option goal', masterGoal)
        //console.log('Slave option goal', slaveGoal)
        //console.log('Master option problem', masterProblem.toPddlString())
        //console.log('Slave option problem', slaveProblem.toPddlString())

        return { total: multiagentProblem, master: masterProblem, slave: slaveProblem }
    }
}
