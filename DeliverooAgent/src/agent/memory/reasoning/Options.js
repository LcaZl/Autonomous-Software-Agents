import { PriorityQueue } from "../../../utils/PriorityQueue.js";
import { distance } from "../../../utils/utils.js";
import { Agent } from "../../Agent.js";
import { Parcel } from "../../Environment/Parcels/Parcel.js";
import { Option } from "./Option.js";

export class Options{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent
        this.lastPushedOptions = null
    }

    getOptions(){ return this.lastPushedOptions }

    activate(){
        this.agent.eventManager.on('update_options', () => this.updateOptions())
        this.agent.eventManager.on('picked_up_parcels', () => this.updateOptions())
        this.agent.eventManager.on('delivered_parcels', () => this.updateOptions())
    }

    updateOptions(){

        let options = []

        if (this.agent.parcels.carriedParcels() > 0){
            let [utility, search] = this.deliveryUtility()
            options.push(new Option('go_deliver', null, utility, search)) 
        }
        for(let [_, parcel] of this.agent.parcels.getParcels()){

            if ( parcel.isFree() ){

                let [utility, search] = this.pickUpUtility(parcel)
                if (utility > 1)
                    options.push(new Option(`go_pick_up-${parcel.id}`, parcel.position, utility, search))
            }
        }

        options.sort( (opt1, opt2) => opt1.utility - opt2.utility )
        this.lastPushedOptions = options
        
        console.log('[OPTIONS] Option pushing:')
        for( let opt of options){
            console.log(' - ', opt.toString())
            this.agent.intentions.push( opt )
        }
    }

    pickUpUtility(p) {
        const movementPenality = 1 // 1 None
        const movementPenalty = (this.agent.MOVEMENT_DURATION * movementPenality) / this.agent.PARCEL_DECADING_INTERVAL;
        const actualReward = this.agent.parcels.getMyParcelsReward()

        if (this.agent.PARCEL_DECADING_INTERVAL === 'infinite') {
            return [(actualReward + p.reward), null];
        }
    
        let search = this.agent.environment.getShortestPath(this.agent.currentPosition, p.position)
        const pickupDistance = search.path.actions.length
        const pickupCost = pickupDistance * movementPenalty;

        const deliveryDistance = p.deliveryDistance 
        const deliveryCost = deliveryDistance * movementPenalty;

    
        const cost = pickupCost + deliveryCost;
        const carriedParcels = this.agent.parcels.carriedParcels()
        const utility = actualReward + p.reward - (cost * (carriedParcels + 1))

        /*
        console.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.agent.PARCEL_DECADING_INTERVAL,
            movementPenalty,
            actualReward,
            pickupDistance,
            pickupCost,
            deliveryDistance,
            deliveryCost,
            cost,
            carriedParcels,
            utility
        });*/

        return [utility, search]
    }
    
    deliveryUtility() {
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        let search = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition)
        const deliveryDistance = search.path.actions.length;
        const deliveryTime = deliveryDistance * this.agent.MOVEMENT_DURATION;

        if (this.agent.parcels.carriedParcels() === this.MAX_PARCELS) {
            return [Infinity, search];
        }
        else if ((this.agent.duration - elapsedTime) < (deliveryTime * 3)) {
            return [Infinity, search];
        }
        else if (this.agent.PARCEL_DECADING_INTERVAL === 'infinite') {
            return [1, search];
        }
    
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const movementPenalty = this.agent.MOVEMENT_DURATION / this.agent.PARCEL_DECADING_INTERVAL;
        

        const deliveryCost = deliveryDistance * movementPenalty;

        const cost = deliveryCost
        const carriedParcels = this.agent.parcels.carriedParcels()

        const carriedParcelsFactor = carriedParcels / this.agent.MAX_PARCELS
        const incentiveFactor = 2 + (1 / (1 + deliveryDistance))

        const utility = [(actualReward + carriedParcelsFactor) - (cost * (carriedParcels))] * incentiveFactor;
    
        /*
        console.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.agent.PARCEL_DECADING_INTERVAL,
            elapsedTime,
            deliveryDistance,
            deliveryTime,
            actualReward,
            movementPenalty,
            deliveryCost,
            cost,
            carriedParcelsFactor,
            incentiveFactor,
            carriedParcels,
            utility
        });*/

        return [utility, search]
    }
    
    
}