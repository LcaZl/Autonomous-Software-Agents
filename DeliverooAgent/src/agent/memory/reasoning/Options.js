import { PriorityQueue } from "../../../utils/PriorityQueue.js";
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
            options.push(new Option('go_deliver', null, utility, search, null)) 
        }

        for(let [_, parcel] of this.agent.parcels.getParcels()){

            if ( parcel.isFree() ){

                let [utility, search] = this.pickUpUtility(parcel, this.agent.currentPosition)
                if (utility > 1)
                    options.push(new Option(`go_pick_up-${parcel.id}`, parcel.position, utility, search, parcel))
            }
        }
        options.sort( (opt1, opt2) => opt1.utility - opt2.utility )
        this.lastPushedOptions = options
        
        this.agent.log('[OPTIONS] Option pushing:')
        for( let opt of options){
            this.agent.log(' - ', opt.toString())
        }
        if (options.length > 0)
            this.agent.intentions.push( options )

    }

    pickUpUtility(p, agentPosition) {
        const movementPenality = (this.agent.MOVEMENT_DURATION) / this.agent.PARCEL_DECADING_INTERVAL;
        const actualReward = this.agent.parcels.getMyParcelsReward()

        if (this.agent.PARCEL_DECADING_INTERVAL === 'infinite') {
            return [(actualReward + p.reward), null];
        }
    
        let search = this.agent.environment.getShortestPath(agentPosition, p.position)
        
        const pickupDistance = search.length
        const pickupCost = pickupDistance * movementPenality;

        const deliveryDistance = p.pathToDelivery.length 
        const deliveryCost = deliveryDistance * movementPenality;

        const cost = pickupCost + deliveryCost;
        const carriedParcels = this.agent.parcels.carriedParcels()
        const carriedParcelsPenality = (1 / (carriedParcels + 1))
        const utility = (((actualReward) * carriedParcelsPenality) + p.reward) - (cost * (carriedParcels + 1))
        /*
        this.agent.log({
            movement_duration: this.agent.MOVEMENT_DURATION,
            decading_interval: this.agent.PARCEL_DECADING_INTERVAL,
            movementPenality,
            actualReward,
            pickupDistance,
            pickupCost,
            deliveryDistance,
            deliveryCost,
            cost,
            carriedParcels,
            utility
        });
        */
        return [utility, search]
    }
    
    deliveryUtility() {
        const elapsedTime = new Date().getTime() - this.agent.startedAt;
        let search = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition)
        const deliveryDistance = search.length;
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

        const carriedParcelsFactor = 1 + (carriedParcels / this.agent.MAX_PARCELS)
        const incentiveFactor = 2 + (1 / (1 + deliveryDistance))

        const utility = (actualReward * carriedParcelsFactor) - (cost * (carriedParcels));
    
        /*
        this.agent.log({
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
    
    generateCombinations(options, minLength, maxLength) {
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
     
}
