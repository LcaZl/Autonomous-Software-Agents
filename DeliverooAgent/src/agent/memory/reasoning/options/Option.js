import { Position } from "../../../utils/Position.js";
import { Agent } from "../../../Agent.js";
import { Parcel } from "../../../Environment/Parcels/Parcel.js";

export class Option{
    
    /**
     * @param {String} id - The identifier of the option.
     * @param {Agent} agent - Agent instance
     */
        constructor(id, agent) {
            this.id = id
            this.startPosition = agent.currentPosition
            this.agent = agent
        }
}

/**
 * Option for BFS configuration.
 */
export class BfsOption extends Option{

    /**
     * @param {String} id - The identifier of the option.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     * @param {Agent} agent - Agent instance
     */
    constructor(id, parcel, agent) {
        super(id, agent)

        this.parcel = null
        this.parcelId = null
        if (this.id !== 'bfs_patrolling'){
            this.parcel = parcel
            this.parcelId = parcel.id
        }

        this.update(agent.currentPosition)
    }

    /**
     * Update the option plan
     * 
     * @param {Position} startPosition 
     */
    update(startPosition){

        this.startPosition = startPosition

        let result = null
        if (this.id === 'bfs_delivery'){
            //this.search = this.agent.environment.getNearestDeliveryTile(startPosition);
            result = this.agent.options.utilityCalcolator.deliveryUtility(this.startPosition)
            this.search = result.search
            this.utility = result.value
            this.finalPosition = this.search.finalPosition

        }
        else{
            if (this.id === 'bfs_patrolling'){
                this.finalPosition = this.agent.environment.getRandomPosition()
                this.search = this.agent.environment.getShortestPath(startPosition, this.finalPosition);
                this.utility = 0.1
            }
            else if (this.id.startsWith('bfs_pickup')){
                result = this.agent.options.utilityCalcolator.pickUpUtility(this.startPosition, this.parcel)
                this.search = result.search
                this.utility = result.value
                this.finalPosition = this.search.finalPosition
            }
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
     * @param {Parcel} parcel 
     * @param {Agent} agent 
     */
    constructor(id, parcel, agent){
        super(id, agent)
        this.parcel = null
        this.parcelId = null
        this.plan = null
        this.finalPosition = null
        this.startPosition = agent.currentPosition

        if (this.id !== 'pddl_patrolling'){
            this.parcel = parcel
            this.parcelId = parcel.id
            if (this.id === 'pddl_delivery'){
                search = this.agent.environment.getEstimatedNearestDeliveryTile(this.startPosition)
                this.utility = this.agent.options.utilityCalcolator.simplifiedDeliveryUtility(this.startPosition, search.position, search.distance)
            }
            else{
                this.utility = this.agent.options.utilityCalcolator.simplifiedPickUpUtility(this.startPosition, this.parcel)
            }
        }
        else
            this.utility = 0.1

        this.updates = 0
        try{
            this.update(this.agent.currentPosition)
        }
        catch{
            
        }
    }

    /**
     * Update the plan based on input start position.
     * 
     * @param {Position} startPosition 
     */
    async update(startPosition){
        //console.log('updating single plan for ', this.id)

        this.startPosition = startPosition

        if (this.id === 'pddl_patrolling'){
            this.finalPosition = this.agent.environment.getRandomPosition()
            this.plan = await this.agent.planner.getPlanFromTo(this.finalPosition)
            this.utility = 0.1
        }
        else if (this.id === 'pddl_delivery'){
            this.plan = await this.agent.planner.getDeliveryPlan(this.startPosition, this.parcelId)
            if (this.plan != null){
                this.finalPosition = this.plan.finalPosition
                this.utility = this.agent.options.utilityCalcolator.simplifiedDeliveryUtility(this.plan.startPosition, this.plan.finalPosition, this.plan.length)
            }
        }
        else if (this.id.startsWith('pddl_pickup-')){
            this.plan = await this.agent.planner.getPickupPlan(this.startPosition, this.parcel)
            if (this.plan != null){
                this.finalPosition = this.plan.finalPosition
                this.utility = this.agent.options.utilityCalcolator.simplifiedPickUpUtility(this.startPosition, this.parcel, this.plan.length)
            }
        }
        else throw ['Option_id_not_valid', this.id]

        if (this.plan == null){
            this.utility = 0
        }

        this.updates += 1
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_ids: ${this.parcelId}`
    }
}
