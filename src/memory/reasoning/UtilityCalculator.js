import { Agent } from "../../Agent.js"


export class UtilityCalculator {
    /**
     * Initializes a utility calculator
     * 
     * @param {Agent} agent The agent instance for which utilities are calculated.
     */
    constructor(agent) {
        this.agent = agent
        // Movement penalty based on parcel decay interval and movement duration.
        this.movementPenality = this.agent.PARCEL_DECADING_INTERVAL === Infinity 
            ? 1 
            : (this.agent.MOVEMENT_DURATION * 3) / this.agent.PARCEL_DECADING_INTERVAL
        this.previousMovementsAttempts = 0

        // Update movement penalty at intervals if parcel decay is considered.
        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity) {
            this.updateMovementFactor = setInterval(() => {
                const movementAttempts = this.agent.movementAttempts - this.previousMovementsAttempts
                this.previousMovementsAttempts = this.agent.movementAttempts
                const avgMoveTime = Math.round(this.agent.adjMovementCostWindow / Math.max(movementAttempts, 1))
                this.movementPenality = avgMoveTime / this.agent.PARCEL_DECADING_INTERVAL
            }, this.agent.adjMovementCostWindow)
        }
    }

    /**
     * Calculates the utility of picking up a parcel considering the distance, movement penalty, and parcel rewards.
     * 
     * @param {Position} startPosition The starting position for calculating the pickup utility.
     * @param {Parcel} parcel The parcel for which to calculate the pickup utility.
     * @returns {Object} Utility value and the search result for reaching the parcel.
     */
    pickUpUtility(startPosition, parcel) {
        let search = this.agent.environment.getShortestPath(startPosition, parcel.position)
        if (search.length === 0) return { value: 0, search }

        const pickupDistance = search.length
        const pickupCost = pickupDistance * this.movementPenality
        let utility

        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity) {
            const actualReward = this.agent.parcels.getMyParcelsReward()
            const carriedParcels = this.agent.parcels.carriedParcels()
            const deliveryDistance = parcel.pathToDelivery.length
            const deliveryCost = deliveryDistance * this.movementPenality
            const cost = pickupCost + deliveryCost
            utility = (actualReward + parcel.reward) - (cost * (carriedParcels + 1))
        } else {
            utility = 1 + (1.0 / pickupDistance)
        }

        return { value: Math.max(0, utility), search }
    }
    
    /**
     * Calculates the utility of delivering parcels based on the current position and the nearest delivery tile.
     * 
     * @param {Position} startPosition - The starting position for the delivery utility calculation.
     * @param {boolean} [noObs=false] - Flag indicating whether to consider obstacles in the pathfinding.
     * @returns {Object} An object containing the utility value and the search result
     */
    deliveryUtility(startPosition, noObs = false) {
        let search = this.agent.environment.getNearestDeliveryTile(startPosition, noObs)
        if (search.length === 0) return { value: 0, search }

        const elapsedTime = new Date().getTime() - this.agent.startedAt
        const deliveryCost = search.length * this.movementPenality
        const carriedParcels = this.agent.parcels.carriedParcels()

        // Assign infinite utility if conditions for immediate delivery are met
        if (carriedParcels > 0 && (this.agent.duration - elapsedTime) < (search.length * (this.movementTime * 2.5)) 
            || carriedParcels === this.agent.MAX_PARCELS) {
            return { value: Infinity, search }
        }

        // If there's no decay interval, return a fixed utility
        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) return { value: 1, search }

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * carriedParcels)

        return { value: Math.max(utility, 0), search }
    }

    /**
     * Simplified utility calculation for picking up a parcel, optionally providing pickup distance to avoid recalculating.
     * 
     * @param {Position} startPosition The starting position for the utility calculation.
     * @param {Parcel} parcel The parcel for which to calculate the pickup utility.
     * @param {number|null} pickupDistance The precomputed distance to the parcel, if available.
     * @returns {number} The calculated utility value for picking up the parcel.
     */
    simplifiedPickUpUtility(startPosition, parcel, pickupDistance = null) {
        let utility

        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity) {
            if (pickupDistance === null) {
                pickupDistance = startPosition.distanceTo(parcel.position)
            }
            const pickupCost = pickupDistance * this.movementPenality
            const deliverySearch = this.agent.environment.getEstimatedNearestDeliveryTile(parcel.position)
            const deliveryCost = deliverySearch.distance * this.movementPenality
            const cost = pickupCost + deliveryCost
            const actualReward = this.agent.parcels.getMyParcelsReward()
            const carriedParcels = this.agent.parcels.carriedParcels()
            utility = (actualReward + parcel.reward) - cost * (carriedParcels + 1)
        } else {
            pickupDistance = pickupDistance ?? startPosition.distanceTo(parcel.position)
            utility = 1 + (1.0 / pickupDistance)
        }

        return Math.max(0, utility)
    }

    /**
     * Simplified utility calculation for delivering parcels, optionally providing delivery distance to avoid recalculating.
     * 
     * @param {Position} startPosition - The starting position for the utility calculation.
     * @param {Position} endPosition - The delivery position.
     * @param {number|null} deliveryDistance - The precomputed distance to the delivery point, if available.
     * @returns {number} The calculated utility value for delivering parcels.
     */
    simplifiedDeliveryUtility(startPosition, endPosition, deliveryDistance = null) {
        const elapsedTime = new Date().getTime() - this.agent.startedAt
        deliveryDistance = deliveryDistance ?? startPosition.distanceTo(endPosition)
        const deliveryCost = deliveryDistance * this.movementPenality
        const carriedParcels = this.agent.parcels.carriedParcels()

        // Assign infinite utility if conditions for immediate delivery are met
        if (carriedParcels > 0 && (this.agent.duration - elapsedTime) < (deliveryDistance * (this.movementTime * 2.5)) 
            || carriedParcels === this.agent.MAX_PARCELS) {
            return Infinity
        }

        // If there's no decay interval, return a fixed utility
        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) return 1

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * carriedParcels)

        return Math.max(0, utility)
    }

}