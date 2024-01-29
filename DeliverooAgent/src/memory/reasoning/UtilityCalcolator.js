import { Agent } from "../../Agent.js";

export class UtilityCalcolator{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent

        this.movementPenality = this.agent.PARCEL_DECADING_INTERVAL === Infinity ? 1 : (this.agent.MOVEMENT_DURATION * 3) / this.agent.PARCEL_DECADING_INTERVAL;
        this.previousMovAttempts = 0

        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity){

            this.updateMovementFactor = setInterval(() => {
                
                const movementAttempts = this.agent.movementAttempts - this.previousMovAttempts
                this.previousMovAttempts = this.agent.movementAttempts

                const avgMoveTime = Math.round(this.agent.adjMovementCostWindow / Math.max(movementAttempts, 1))
                this.movementTime = avgMoveTime
                this.movementPenality = avgMoveTime / this.agent.PARCEL_DECADING_INTERVAL;

            }, this.agent.adjMovementCostWindow);
        }
    }

    pickUpUtility(startPosition, parcel) {
        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity){

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
            //console.log(`actualReward: ${actualReward}, carriedParcels: ${carriedParcels}, 
            //pickupDistance: ${pickupDistance}, pickupCost: ${pickupCost},
            //deliveryDistance: ${deliveryDistance}, deliveryCost: ${deliveryCost},
            //totalCost: ${cost}, utility: ${utility}`);
            return {value:utility, search:search}
        }
        else{
            let search = this.agent.environment.getShortestPath(startPosition, parcel.position)
            if (search.length === 0) return {value:0, search:search}
            const pickupDistance = search.length
            const utility = 1 + (1.0 / pickupDistance)
            return {value:utility, search:search}
        }
    }
    
    /**
     * @param {Position} startPosition 
     * @param {Position} endPosition 
     */
    simplifiedPickUpUtility(startPosition, parcel, pickupDistance = null){
    
        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity){
            const endPosition = parcel.position
            const actualReward = this.agent.parcels.getMyParcelsReward()
            const carriedParcels = this.agent.parcels.carriedParcels()
    
    
            if (pickupDistance === null)
                pickupDistance = startPosition.distanceTo(endPosition)
    
            const pickupCost = pickupDistance * this.movementPenality
    
    
            const deliverySearch = this.agent.environment.getEstimatedNearestDeliveryTile(parcel.position)
            const deliveryCost = deliverySearch.distance * this.movementPenality;  
    
    
            const cost = pickupCost + deliveryCost;
    
            const utility = (actualReward + parcel.reward) - cost * (carriedParcels + 1)
    
    
            return utility
        }
        else{
    
            const pickupDistance = startPosition.distanceTo(parcel.position)
            const utility = 1 + (1.0 / pickupDistance)
    
    
            return utility
        }
    }
    

    deliveryUtility(startPosition) {
        let search = this.agent.environment.getNearestDeliveryTile(startPosition)
        if (search.length === 0) return {value:0, search:search}

        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const deliveryDistance = search.length;
        const deliveryCost = deliveryDistance * this.movementPenality;
        //console.log(this.agent.duration, elapsedTime, (this.agent.duration - elapsedTime), (deliveryCost * this.agent.MOVEMENT_DURATION),deliveryDistance, this.movementPenality)

        if ((this.agent.duration - elapsedTime) < (deliveryDistance * (this.movementTime * 2.5))) { 
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

    simplifiedDeliveryUtility(startPosition, endPosition, deliveryDistance = null){
        const elapsedTime = new Date().getTime() - this.agent.startedAt;

        if (deliveryDistance === null)
            deliveryDistance = startPosition.distanceTo(endPosition)

        const deliveryCost = deliveryDistance * this.movementPenality

        if ((this.agent.duration - elapsedTime) < (deliveryDistance * (this.movementTime * 2.5))) {  return Infinity }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.agent.MAX_PARCELS) { return Infinity }

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return 1 }

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)

        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * (carriedParcels));

        return utility
    }

    computeDistance(startPosition, endPosition) {
        return Math.abs(startPosition.X - endPosition.X) + Math.abs(startPosition.Y - endPosition.Y);
    }
    
    simplifiedPickUpUtilityMas(parcelId, parcelReward, startPosition, finalPosition){
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()

        // temporarily use a manhattan distance , TO FIX. 
        //console.log("START POSITION : ") 
        //console.log(startPosition)
        //console.log("FINAL POSITION : ")
        //console.log(finalPosition)
        const pickupDistance = this.computeDistance(startPosition, finalPosition)
        const pickupCost = pickupDistance * this.movementPenality
        
        const deliverySearch = this.agent.environment.getEstimatedNearestDeliveryTile(new Position(finalPosition.X, finalPosition.Y))
        const deliveryCost = deliverySearch.distance * this.movementPenality;  

        const cost = pickupCost + deliveryCost;

        const utility = (actualReward + parcelReward) - cost * (carriedParcels + 1)

        return utility
    }

}