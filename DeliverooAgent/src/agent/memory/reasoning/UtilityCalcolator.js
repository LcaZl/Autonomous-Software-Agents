import { Agent } from "../../Agent.js";

export class UtilityCalcolator{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent

        this.movementPenality = this.agent.PARCEL_DECADING_INTERVAL === Infinity ? 1 : (this.agent.MOVEMENT_DURATION * 3) / this.agent.PARCEL_DECADING_INTERVAL;
        this.previousTime = this.agent.startedAt
        this.previousMovAttempts = 0

        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity){
            this.updateMovementFactor = setInterval(() => {

                const now = new Date().getTime()
                const diff = now - this.previousTime;
                this.previousTime = now
                
                const movementAttempts = this.agent.movementAttempts - this.previousMovAttempts
                this.previousMovAttempts = this.agent.movementAttempts

                const avgMoveTime = Math.round(diff / Math.max(movementAttempts, 1))
                const prev = this.movementPenality
                this.movementPenality = avgMoveTime / this.agent.PARCEL_DECADING_INTERVAL;
                //console.log('[UPDATEDMVPEN] From', prev, 'to', this.movementPenality)
            }, this.agent.adjMovementCostWindow);
        }
    }

    pickUpUtility(startPosition, parcel) {
        
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()
        //const carriedParcelsPenality = 1 - (1 / (carriedParcels + 1))

        let search = this.agent.environment.getShortestPath(startPosition, parcel.position)
        if (search.length === 0) return {value:0, search:search}
        const pickupDistance = search.length
        const pickupCost = pickupDistance * this.movementPenality;
        const deliveryDistance = parcel.pathToDelivery.length 
        const deliveryCost = deliveryDistance * this.movementPenality;
        const cost = pickupCost + deliveryCost;
        const utility = ((actualReward) + parcel.reward) - (cost * (carriedParcels + 1))

        return {value:utility, search:search}
    }
    
    deliveryUtility(startPosition) {
        let search = this.agent.environment.getNearestDeliveryTile(startPosition)
        
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const deliveryDistance = search.length;
        const deliveryCost = deliveryDistance * this.movementPenality;
        //console.log(this.agent.duration, elapsedTime, (this.agent.duration - elapsedTime), (deliveryCost * this.agent.MOVEMENT_DURATION),deliveryDistance, this.movementPenality)
        if ((this.agent.duration - elapsedTime) < (deliveryCost * this.agent.MOVEMENT_DURATION * 2)) { 
            return {value:Infinity, search:search} }
        
        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.agent.MAX_PARCELS) { 
            return {value:Infinity, search:search} }

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return {value:1, search:search} }

        const cost = deliveryCost
        const actualReward = this.agent.parcels.getMyParcelsReward()

        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)

        const utility = (actualReward * carriedParcelsFactor) - (cost * (carriedParcels));
        
        return {value:utility, search:search}
    }

    /**
     * 
     * @param {Position} startPosition 
     * @param {Position} endPosition 
     */
    simplifiedPickUpUtility(startPosition, parcel){
        const endPosition = parcel.position
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()

        const pickupDistance = startPosition.distanceTo(endPosition)
        const pickupCost = pickupDistance * this.movementPenality
        
        const deliverySearch = this.agent.environment.getEstimatedNearestDeliveryTile(parcel.position)
        const deliveryCost = deliverySearch.distance * this.movementPenality;  

        const cost = pickupCost + deliveryCost;

        const utility = (actualReward + parcel.reward) - cost * (carriedParcels + 1)

        return utility
    }

    simplifiedDeliveryUtility(startPosition, endPosition){
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const deliveryDistance = startPosition.distanceTo(endPosition)
        const deliveryCost = deliveryDistance * this.movementPenality

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) {  return Infinity }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.agent.MAX_PARCELS) { return Infinity }

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return 1 }

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)

        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * (carriedParcels));

        return utility
    }
}