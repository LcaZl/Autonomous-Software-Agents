import { Position } from "../../../../utils/Position.js";
import { Agent } from "../../../Agent.js";
import { Parcel } from "../../../Environment/Parcels/Parcel.js";

export class Option{
    
    /**
     * @param {String} id - The identifier of the option.
     * @param {Position} position - The position associated with this option.
     * @param {Number} utility - The utility value of the option.
     * @param {Boolean} search - Contains information of the first search.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     */
        constructor(id, startPosition, finalPosition, utility) {
            this.id = id
            this.startPosition = startPosition
            this.finalPosition = finalPosition
            this.utility = utility;
        }
}

export class goToOption extends Option{

    /**
     * 
     * @param {String} id 
     * @param {Position} startPosition 
     * @param {Position} finalPosition 
     * @param {Number} utility 
     * @param {Array} actions 
     */
    constructor(id, startPosition, finalPosition, utility, actions){
        super(id, startPosition, finalPosition, utility)
        this.actions = actions
    }
}

/**
 * Option for BFS configuration.
 */
export class BfsOption extends Option{

    /**
     * @param {String} id - The identifier of the option.
     * @param {Position} position - The position associated with this option.
     * @param {Number} utility - The utility value of the option.
     * @param {Boolean} search - Contains information of the first search.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     */
    constructor(id, startPosition, finalPosition, utility, search, parcel, agent) {
        super(id, startPosition, finalPosition, utility)
        this.agent = agent
        this.search = search
        this.parcel = null
        this.parcelId = null
        if (id !== 'bfs_patrolling'){
            this.parcel = parcel
            this.parcelId = parcel.id
        }
    }

    /**
     * Update the option plan
     */
    update(startPosition){

        this.startPosition = startPosition

        if (this.id === 'bfs_delivery'){
            this.search = this.agent.environment.getNearestDeliveryTile(startPosition);
            this.finalPosition = this.search.finalPosition
        }
        else{
            if (this.id === 'bfs_patrolling'){
                this.finalPosition = this.agent.environment.getRandomPosition()
            }
            this.search = this.agent.environment.getShortestPath(startPosition, this.finalPosition);
        }
    }
    
    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_id: ${this.parcel ? this.parcel.id : ''}, Search: ${this.search ? this.search.firstPosition : ''}]`;
    }
}

/**
 * Option for PDDL configuration.
 */
export class PddlOption extends Option{

    /**
     * @param {String} id 
     * @param {Position} startPosition 
     * @param {Position} finalPosition 
     * @param {Number} utility 
     * @param {Agent} agent 
     * @param {Parcel} parcel 
     */
    constructor(id, utility, startPosition, finalPosition, agent, parcel){
        super(id, startPosition, finalPosition, utility)
        this.parcel = null
        this.parcelId = null
        this.agent = agent
        if (this.id === 'pddl_delivery' || this.id.startsWith('pddl_pickup-')){
            this.parcel = parcel
            this.parcelId = parcel.id
        }

        this.plan = null
        this.updatePlan(this.agent.currentPosition)
    }

    /**
     * Update the plan based on input start position.
     * 
     * @param {Position} startPosition 
     */
    async updatePlan(startPosition){
        //console.log('updating single plan for ', this.id)

        this.startPosition = startPosition

        if (this.id === 'pddl_patrolling'){
            this.finalPosition = this.agent.environment.getRandomPosition()
            this.plan = await this.agent.planner.getPlanFromTo(this.finalPosition)
        }
        else if (this.id === 'pddl_delivery')
            this.plan = await this.agent.planner.getDeliveryPlan(this.startPosition, this.parcelId)

        else if (this.id.startsWith('pddl_pickup-'))
            this.plan = await this.agent.planner.getPickupPlan(this.startPosition, this.parcel)

        else throw ['Option_id_not_valid', this.id]

        if (this.plan != null){
            this.finalPosition = this.plan.finalPosition
            //this.updateUtility()
        }
    }

    updateUtility(){

        let distance = (this.plan.steps.length - 1)
        let reward = this.agent.parcels.getMyParcelsReward()

        if (this.id.startsWith('pddl_pickup-')){
            distance = (this.plan.steps.length - 1) + this.parcel.pathToDelivery.length
            reward = this.parcel.reward
        }   

        let cost = distance * this.agent.options.utilityCalcolator.movementPenality
        if (this.startPosition.isEqual(this.agent.currentPosition))
            cost += this.startPosition.distanceTo(this.agent.currentPosition)
        
        this.utility = reward - cost
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_ids: ${this.parcelId}`
    }
}
