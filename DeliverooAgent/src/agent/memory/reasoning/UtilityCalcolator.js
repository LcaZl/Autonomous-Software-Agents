export class UtilityCalcolator{

    constructor(agent){
        this.agent = agent
        this.movementPenality = this.agent.PARCEL_DECADING_INTERVAL === Infinity ? 0 : (this.agent.MOVEMENT_DURATION) / this.agent.PARCEL_DECADING_INTERVAL;
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
        
        const deliveryDistance = parcel.pathToDelivery.length 
        const deliveryCost = deliveryDistance * this.movementPenality;  

        const cost = pickupCost + deliveryCost;

        const utility = (actualReward + parcel.reward) - cost * (carriedParcels + 1)
        
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

        return utility
    }

    simplifiedDeliveryUtility(startPosition, endPosition){

        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return 1 }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.MAX_PARCELS) { return Infinity }
        
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        
        const deliveryDistance = startPosition.distanceTo(endPosition)
        const deliveryCost = deliveryDistance * this.movementPenality

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) {  return Infinity }

        const utility = (actualReward * carriedParcelsFactor) - (deliveryCost * (carriedParcels));

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

        return utility
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

        const cost = pickupCost //+ deliveryCost;

        const utility = (((actualReward) * carriedParcelsPenality) + p.reward) - (cost * (carriedParcels + 1))

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

        return [utility, search]
    }
    
    deliveryUtility() {
        if (this.agent.PARCEL_DECADING_INTERVAL === Infinity) { return [1, search] }

        const carriedParcels = this.agent.parcels.carriedParcels()

        if (carriedParcels === this.MAX_PARCELS) { return [Infinity, search] }

        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)

        let search = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition)

        const deliveryDistance = search.length;
        const deliveryCost = deliveryDistance * this.movementPenality;

        if ((this.agent.duration - elapsedTime) < (deliveryCost * 3)) { return [Infinity, search] }

        const cost = deliveryCost

        const incentiveFactor = 2 + (1 / (1 + deliveryDistance))
        const utility = (actualReward * carriedParcelsFactor) - (cost * (carriedParcels));
    
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

        return [utility, search]
    }

    
    updateBatchUtility(totalDistance, totalReward){
        const cost = totalDistance * this.movementPenality

        const actualReward = this.agent.parcels.getMyParcelsReward()
        const carriedParcels = this.agent.parcels.carriedParcels()
        const utility = (actualReward + totalReward) - cost * (carriedParcels + 1)
        
        console.log('Batch Utility:')
        console.log(' - movementPenality:', this.movementPenality)
        console.log(' - totalDistance:', totalDistance)
        console.log(' - totalReward:', totalReward)
        console.log(' - cost:', cost)
        console.log(' - actualReward:', actualReward)
        console.log(' - carriedParcels:', carriedParcels)
        console.log(' - utility:', utility)
        
        this.agent.log({
            carriedParcels,
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.agent.PARCEL_DECADING_INTERVAL,
            totalDistance,
            totalReward,
            cost,
            actualReward,
            carriedParcels,
            utility
        });

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


 */
