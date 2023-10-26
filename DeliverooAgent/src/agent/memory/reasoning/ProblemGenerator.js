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
    getProblem(type, position){
        this.type = type

        switch (type) {
            case 'go_pick_up':
            case 'deliver':
            case 'goto':
                return this.gotoOption(position)
            case 'gotoM':
                return this.goToMultipleOption(this.agent.parcels.getParcels(), this.agent.environment.deliveryTiles)
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
            'BestParcel',
            this.agent.beliefs.getObjectsWithType(),
            this.agent.beliefs.toPddlString(),
            `at ${this.agent.agentID} t${destination.x}_${destination.y}`
        )
        return problem.toPddlString()
    }

    goToMultipleOption(parcels, deliveryTiles){
        let goal = ``
        for (let p of parcels){
            goal += `carries ${this.agent.agentID} ${p.id} `
        }
        goal += `(or`
        for (let d of deliveryTiles){
            goal += `( at ${this.agent.agentID} t${p.position.x}_${p.position.y})`
        }
        goal += `)`
    }
}