import { PddlProblem } from "@unitn-asa/pddl-client";
import { Agent } from "../../../agent.js";

/**
 * This class generate PDDL problems upon request by taking the actual info inside the belief set.
 */
export class ProblemGenerator{
    /**
     * 
     * @param {String} type 
     * @param {Object} data 
     * @param {Agent} agent 
     */
    constructor(agent) {
        this.agent = agent
    }
 
    /**
     * Generate an option to go from a tile to another
     * 
     * @param {Object} startTile 
     * @param {Object} endTile 
     * @returns {String}
     */
    go(to) {

        var problem = new PddlProblem(
            `go_to-${to.x}_${to.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            `at ${this.agent.agentID} t${to.x}_${to.y}`
        )
        return problem
    }

    /**
     * Generate a pickup PDDL problem setting the start position to the specified one.
     * As the agent is imagining to be there.
     * Returns the problem to pickup the specified parcel.
     * 
     * @param {Position} from 
     * @param {String} parcelId 
     * @returns 
     */
    pickupFrom(from, parcelId){
        const goal = `carries ${this.agent.agentID} ${parcelId}`

        var problem = new PddlProblem(
            `pickup_from-${from.x}_${from.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            goal
        );

        return problem
    }

    /**
     * Generates a PDDL delivery problem from the spicified position.
     * The problem has as a goal to not carry a parcel, to achive this goal, accordingly to the domain, the plan generated will have
     * a path to the nearest delivery tile, where the agent can drop the parcel.
     * 
     * @param {Position} from 
     * @param {String} parcelId 
     * @returns 
     */
    deliverFrom(from, parcelId){
        const goal = `not (carries ${this.agent.agentID} ${parcelId})`

        var problem = new PddlProblem(
            `deliver_from-${from.x}_${from.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            goal
        );

        return problem
    }
}
