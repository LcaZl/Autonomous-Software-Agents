import { PddlProblem } from "@unitn-asa/pddl-client";
import { Agent } from "../../agent.js";
import { Parcel } from "../../Environment/Parcels/Parcel.js";

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
     * 
     * @param {String} type 
     * @param {Parcel} data 
     * @returns 
     */
    getProblem(type, arg){ // arg can be a single position or an array of positions
        this.type = type

        switch (type) {
            case 'go_pick_up':
            case 'deliver':
            case 'goto':
                return this.gotoOption(arg)
        }
    }
 
    /**
     * Generate an option to go from a tile to another
     * 
     * @param {Object} startTile 
     * @param {Object} endTile 
     * @returns {String}
     */
    gotoOption(destination) {       
        var problem = new PddlProblem(
            `${this.agent.currentPosition.x}_${this.agent.currentPosition.y}-${destination.x}_${destination.y}`,
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            `at ${this.agent.agentID} t${destination.x}_${destination.y}`
        )
        return problem
    }
}