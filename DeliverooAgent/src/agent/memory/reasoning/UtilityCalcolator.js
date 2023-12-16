import { Agent } from "../../Agent.js";

export class UtilityCalcolator{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent

        this.movementPenality = this.agent.PARCEL_DECADING_INTERVAL === Infinity ? 0 : (this.agent.MOVEMENT_DURATION * 3) / this.agent.PARCEL_DECADING_INTERVAL;
        this.previousTime = this.agent.startedAt
        this.previousMovAttempts = 0

        if (this.movementPenality !== 0){
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

    
    pddlUtilityWithAll(parcels){
        let bestSequence = [];
        let bestUtility = 0;

        const areAllDeliverable = (sequence, currentDistance) => {
            const distanceIfDeliveryNow = currentDistance + sequence[sequence.length - 1].pathToDelivery.length
            const costIfDeliveryNow = distanceIfDeliveryNow * this.movementPenality
            for (const p of sequence)
                if ((p.reward - costIfDeliveryNow) <= 0) // This parcel won't be delivered 
                    return false
            return true
        }
        const search = (currentPosition, parcels, currentUtility, currentDistance, currentReward, sequence) => {
            const seq = sequence.map(el => el.id)
            const ps = parcels.map(el => el.id)
            
            //console.log('Search step:\n P- ', currentPosition, '\n R- ', currentUtility, '\n S- ', seq, '\n Pr- ', ps)

            if (sequence.length > 0){

            
                if (!areAllDeliverable(sequence, currentDistance)) return;
                let currentUtilityIfDelivery = (this.agent.parcels.getMyParcelsReward() + currentUtility) - (sequence[ sequence.length - 1].pathToDelivery.length * this.movementPenality)
                if (currentUtilityIfDelivery > bestUtility) {
                    bestUtility = currentUtilityIfDelivery;
                    bestSequence = [...sequence];
                }
                if (parcels.length === 0) {
                    return;
                }
            }
            for (let i = 0; i < parcels.length; i++) {
                const parcel = parcels[i];
                const distance = currentDistance + currentPosition.distanceTo(parcel.position)
                const cost = distance * this.movementPenality
                const reward = currentReward + parcel.reward 
                const utility = reward - cost
                if ((utility - (parcel.pathToDelivery.length * this.movementPenality)) <= 0) continue;
                const remainingParcels = parcels.slice(0, i).concat(parcels.slice(i + 1));
                search(parcel.position, remainingParcels, utility, distance, reward, sequence.concat(parcel));
            }
        };

        parcels.sort((p1, p2) => p1.reward - p2.reward)
        search(this.agent.currentPosition, parcels, 0, 0, 0, []);
        return {sequence : bestSequence, utility : bestUtility}
    }

    pickUpUtility(p, agentPosition) {
        
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()
        const carriedParcelsPenality = 1 - (1 / (carriedParcels + 1))

        let search = this.agent.environment.getShortestPath(agentPosition, p.position)

        const pickupDistance = search.length
        const pickupCost = pickupDistance * this.movementPenality;

        const deliveryDistance = p.pathToDelivery.length 
        const deliveryCost = deliveryDistance * this.movementPenality;

        const cost = pickupCost + deliveryCost;

        const utility = ((actualReward * carriedParcelsPenality) + p.reward) - (cost * (carriedParcels + 1))
        
        /*
        this.agent.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.movementPenality,
            actualReward,
            carriedParcels,
            carriedParcelsPenality,
            pickupDistance,
            pickupCost,
            deliveryDistance,
            deliveryCost,
            cost,
            utility
        });
        */

        return {value:utility, search:search}
    }
    
    deliveryUtility(from) {
        let search = this.agent.environment.getNearestDeliveryTile(from)

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return {value:1, search:search} }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.MAX_PARCELS) { return {value:Infinity, search:search} }

        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)

        const deliveryDistance = search.length;
        const deliveryCost = deliveryDistance * this.movementPenality;

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) { return {value:Infinity, search:search} }

        const cost = deliveryCost

        const utility = (actualReward * carriedParcelsFactor) - (cost * (carriedParcels));
    
        /*
        this.agent.log({
            carriedParcels,
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.agent.PARCEL_DECADING_INTERVAL,
            elapsedTime,
            actualReward,
            carriedParcelsFactor,
            deliveryDistance,
            deliveryCost,
            cost,
            incentiveFactor,
            utility
        });
        */
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
        /*
        this.agent.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.movementPenality,
            endPosition,
            actualReward,
            carriedParcels,
            pickupDistance,
            pickupCost,
            deliveryDistance,
            deliveryCost,
            cost,
            utility
        });
        */
        return utility
    }

    simplifiedDeliveryUtility(startPosition, endPosition){

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return 1 }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.agent.MAX_PARCELS) { return Infinity }
        
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        
        const deliveryDistance = startPosition.distanceTo(endPosition)
        const deliveryCost = deliveryDistance * this.movementPenality

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) {  return Infinity }

        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * (carriedParcels));
        /*
        this.agent.log({
            carriedParcels,
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.movementPenality,
            elapsedTime,
            actualReward,
            carriedParcelsFactor,
            deliveryDistance,
            deliveryCost,
            utility
        });
        */

        return utility
    }
}


/**
 * 
 *     generateCombinations(options, minLength, maxLength) {
        let batchOptions = [];
        let seenCombinations = new Set();
        const helper = (start, path) => {
            if (path.length >= minLength) {
                // Order current combo by utility
                let sortedPath = [...path]//.sort((a, b) => b.utility - a.utility);
    
                // Create the combo id
                let options = []
                let batchKey = 'go_pick_up-p';
                for (let opt of sortedPath){
                    batchKey += opt.id.split('-')[1].split('p')[1];
                    options.push(opt)
                }
    
                //this.agent.log('idposition', idPosition.keys(), total_utility)
                let utility = this.batchUtility(options, batchKey)
                let batchOption = new BatchOption(new String(batchKey), options, utility)
                //this.agent.log(batchOption.toString())
    
                // Veriify combination
                if (!seenCombinations.has(batchKey)) {
                    seenCombinations.add(batchKey);
                    batchOptions.push(batchOption);
                }
            }
    
            if (path.length === maxLength) {
                return;
            }
    
            for (let i = start; i < options.length; i++) {
                helper(i + 1, path.concat(options[i]), options, minLength, maxLength);
            }
        }
        helper(0, [])
        return batchOptions;
    }

    batchUtility(options, key){
        //this.agent.log('Batchutility for ', options.length, ' Options')

        let total_reward = options[0].parcel.reward
        let total_distance = options[0].firstSearch.path.actions.length
        let total_utility = options[0].utility
        let positions = [options[0].position]
        //this.agent.log('init_ total_reward', total_reward)
        //this.agent.log('init_ total_distance', total_distance)
        //this.agent.log('optionslen', options.length)
        
        for (let i = 0; i < options.length - 1; i++){
            total_reward += options[i+1].parcel.reward
            let search = this.agent.environment.getShortestPath(options[i].position, options[i+1].position)
            let distance = search == null ? Infinity : search.path.actions.length
            //this.agent.log('Distance between:', options[i].position, options[i+1].position, ' = ', distance)
            //this.agent.log('TotDistance + currDistance = ', total_distance , ' + ', distance)
            total_distance += distance
            total_utility += options[i+1].utility
            positions.push(options[i+1].position)
            //this.agent.log('Opt',i,total_distance,options[i].utility,total_utility)
        }

        const movementPenality = (this.agent.MOVEMENT_DURATION) / this.agent.PARCEL_DECADING_INTERVAL;

        const deliveryDistance = options[options.length-1].parcel.deliveryDistance 
        const deliveryCost = deliveryDistance * movementPenality;

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const pathCost = movementPenality * total_distance

        const cost = pathCost + deliveryCost
        const carriedParcels = this.agent.parcels.carriedParcels()
        const utility = actualReward + total_reward - (cost * (carriedParcels + 1))
        
        this.agent.log('\n - Batch Option ', key)
        this.agent.log(' - Total distance',total_distance)
        this.agent.log(' - Options:',options.toString())
        this.agent.log(' - movementPenality:',movementPenality)
        this.agent.log(' - actualReward:',actualReward)
        this.agent.log(' - pathCost:',pathCost)
        this.agent.log(' - carriedParcels:',carriedParcels)
        this.agent.log(' - utility:',utility)
        this.agent.log(' - total_utility:',total_utility)
        this.agent.log(' - total_reward', total_reward)
        this.agent.log(' - total_distance', total_distance)
        return utility
    }
     * 
     * @param {Position} startPosition 
     * @param {Position} endPosition 
     
     simplifiedPickUpUtilityWithDistance(pickupDistance, parcel){
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()
        const carriedParcelsPenality = 1 - (1 / (carriedParcels + 1))

        const pickupCost = pickupDistance * this.movementPenality
        
        const deliveryDistance = parcel.pathToDelivery.length 
        const deliveryCost = deliveryDistance * this.movementPenality;  

        const cost = pickupCost + deliveryCost;

        const utility = ((actualReward * carriedParcelsPenality) + parcel.reward) - cost * (carriedParcels + 1)

        return utility
    }

     * 
     * @param {Position} startPosition 
     * @param {Position} endPosition 
     
     pddlPickUpUtility(plan){

        //console.log(startPosition, parcel.toString(), plan)
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()
        const carriedParcelsPenality = 1 - (1 / (carriedParcels + 1))

        const pickupDistance = plan.length
        const pickupCost = pickupDistance * this.movementPenality
        
        //const parcelsToTake = plan.parcels.length
        //const deliveryDistance = plan.parcels[plan.parcels - 1].pathToDelivery.length 
        //const deliveryCost = deliveryDistance * this.movementPenality;  

        const cost = pickupCost// + deliveryCost;

        const utility = ((actualReward * carriedParcelsPenality) + plan.reward) - cost * (carriedParcels + 1)
        
        this.agent.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.movementPenality,
            actualReward,
            carriedParcels,
            pickupDistance,
            pickupCost,
            cost,
            utility
        });
        
        return utility
    }

    pddlDeliveryUtility(plan){

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return {value:1, plan:plan} }

        const deliveryDistance = plan.length
        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.MAX_PARCELS) { return {value:Infinity, plan:plan} }
        
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        
        const deliveryCost = deliveryDistance * this.movementPenality

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) { return {value:Infinity, plan:plan} }

        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * (carriedParcels));

        console.log({
            carriedParcels,
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.movementPenality,
            elapsedTime,
            actualReward,
            carriedParcelsFactor,
            deliveryDistance,
            deliveryCost,
            utility
        });

        return utility
    }

 */
