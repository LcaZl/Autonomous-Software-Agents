import { PriorityQueue } from "../../../utils/PriorityQueue.js";
import { Agent } from "../../Agent.js";
import { Parcel } from "../../Environment/Parcels/Parcel.js";
import { BatchOption, Option } from "./Option.js";
import { ProblemGenerator } from "./ProblemGenerator.js";
import { UtilityCalcolator } from "./UtilityCalcolator.js";

/**
 * Manages the options available to an agent.
 */
export class Options {
    /**
     * Constructs a new instance of the Options class.
     * 
     * @param {Agent} agent - The agent associated with these options.
     */
    constructor(agent) {
        this.agent = agent;
        this.lastPushedOptions = null;
        this.problemGenerator = new ProblemGenerator(agent)
        this.utilityCalcolator = new UtilityCalcolator(agent)
    }

    /**
     * Retrieves the last set of pushed options.
     * 
     * @returns {Array<Option>} The last pushed options.
     */
    getOptions() { 
        return this.lastPushedOptions;
    }

    /**
     * Activates the option manager to listen for relevant events.
     */
    activate() {
        this.agent.eventManager.on('update_options', () => {
            if (this.agent.moveType === 'BFS') this.updateOptionsForBfs()
            else this.updateOptionsForPddl()});
        this.agent.eventManager.on('picked_up_parcels', () => {
            if (this.agent.moveType === 'BFS') this.updateOptionsForBfs()
            else this.updateOptionsForPddl()});
        this.agent.eventManager.on('delivered_parcels', () => {
            if (this.agent.moveType === 'BFS') this.updateOptionsForBfs()
            else this.updateOptionsForPddl()});
    }

    /**
     * Updates the options based on the current state of the agent and environment.
     */
    async updateOptionsForBfs(){

        let options = []

        if (this.agent.parcels.carriedParcels() > 0){
            let [utility, search] = this.utilityCalcolator.deliveryUtility()
            options.push(new Option('bfs_delivery', search.startPosition, search.finalPosition, utility, search, null)) 
        }

        for(let [_, parcel] of this.agent.parcels.getParcels()){

            if ( parcel.isFree() ){
                let [utility, search] = this.utilityCalcolator.pickUpUtility(parcel, this.agent.currentPosition)
                this.agent.log(search)
                if (utility >= 0) 
                    options.push(new Option(`bfs_pickup-${parcel.id}`, search.startPosition, search.finalPosition, utility, search, parcel))
            }
        }


        if (options.length > 1){
            let previousOption = null
            let lastPosition = null
            if (this.agent.intentions.currentIntention.option.id !== 'patrolling'){
                lastPosition = this.agent.intentions.currentIntention.option.finalPosition

            }

            if (this.agent.intentions.currentIntention.option.id !== 'patrolling')
                previousOption = this.agent.intentions.currentIntention.option

            let updated = 0
            for (let opt of options){
                if (previousOption != null && updated < this.agent.lookAhead){
                    opt = await this.agent.options.luckyUpdateOption(opt, previousOption.finalPosition)
                    updated++
                }
                previousOption = opt
            }
        }

        options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
        this.lastPushedOptions = options

        if (options.length > 0) this.agent.intentions.push( options )

    }

        /**
     * Updates the options based on the current state of the agent and environment.
     */
        updateOptionsForPddl(){

            let parcelsToTake = []
            let deliveryOption = null
            if (this.agent.parcels.carriedParcels() > 0){
                let deliveryPosition = this.agent.environment.getEstimatedNearestDeliveryTile(this.agent.currentPosition)
                let utility = this.utilityCalcolator.simplifiedDeliveryUtility(this.agent.currentPosition, deliveryPosition)
                deliveryOption = new Option('pddl_delivery', this.agent.currentPosition, deliveryPosition, utility, null, null)
            }
    
            for(let [_, parcel] of this.agent.parcels.getParcels())
                if ( parcel.isFree() && parcel.reward > 1)                    
                    parcelsToTake.push(parcel)

            let options = []
            if (parcelsToTake.length > 1 && this.agent.batchSize > 1){
                console.log('0 - Batching ...')
                options = this.createBatchOptions(parcelsToTake)
            }
            else{
                options = this.singlePddlOption(parcelsToTake)
            }

            if (deliveryOption != null)
                options.push(deliveryOption)

            console.log('1 - Current intention id:',  this.agent.intentions.currentIntention.option.id)
            let lastPosition = null
            if (this.agent.intentions.currentIntention.option.id !== 'patrolling'){
                console.log('2 - Current intention pos:',  this.agent.intentions.currentIntention.option.finalPosition)
                lastPosition = this.agent.intentions.currentIntention.option.finalPosition
            }

            let updated = 0
            for (let opt of options){
                console.log('3 - Option:',  opt.toString())
                console.log('3.1 - lastPosition', lastPosition)
                if (lastPosition != null && updated < this.agent.lookAhead){
                    opt = this.agent.options.luckyUpdateOption(opt, lastPosition)
                    updated++
                }
                lastPosition = opt.position
            }

            this.lastPushedOptions = options
            options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
            if (options.length > 0) this.agent.intentions.push( options )
            
        }

    singlePddlOption(parcels){
        let options = []
        for (let parcel of parcels){
            let utility = this.utilityCalcolator.simplifiedPickUpUtility(this.agent.currentPosition, parcel)
            if (utility > 0) 
                options.push(new Option(`pddl_pickup-${parcel.id}`, this.agent.currentPosition, parcel.position, utility, null, parcel))
        }
        return options
    }
    createBatchOptions(parcelsToTake){
        let newOptions = []
        let batchParcels = []
        let id = 'pddl_batch-'
        let utility = null
        let totalReward = 0
        let lastPosition = this.agent.currentPosition
        
        for (let i = 0; i < parcelsToTake.length; i++){
            batchParcels.push(parcelsToTake[i])
            totalReward += parcelsToTake[i].reward

            if (utility === null){
                utility = this.utilityCalcolator.simplifiedPickUpUtility(this.agent.currentPosition, parcelsToTake[i])
            }
            else{
                console.log('Options positions:',parcelsToTake[i - 1].position, parcelsToTake[i].position, ' - Distance:',parcelsToTake[i - 1].position.distanceTo(parcelsToTake[i].position))
                utility += parcelsToTake[i - 1].position.distanceTo(parcelsToTake[i].position)
            }
            id += parcelsToTake[i].id;

            // Close the batch always with a delivery. If no delivery exists, group by batch size
            if (batchParcels.length % this.agent.batchSize == 0){
                utility = this.utilityCalcolator.updateBatchUtility(utility, totalReward)
                newOptions.push(new BatchOption(id, utility, batchParcels, this.agent))
                // Reset batch information
                batchParcels = []
                id = 'pddl_batch-'
                utility = totalReward = 0
            }
            lastPosition = parcelsToTake[i].position
        }

        // Create last batch only with remaining options
        if (batchParcels.length > 0)
            newOptions.push(new BatchOption(id, utility, batchParcels, this.agent))
    
        return newOptions
    }

    /**
     * Updates the given option's utility and search path based on a probability position.
     * 
     * @param {Option} option - The option to update.
     * @param {Position} probPosition - The probability position used for the update.
     * @returns {Option} The updated option.
     */
    async luckyUpdateOption(option, probPosition) {
        // If using PDDL for movement, generate a PDDL plan
        if (this.agent.moveType === 'PDDL') {
            //console.log('3.2 - probPosition', probPosition)
            //console.log('3.2 - option.position', option.position)
            //console.log('3.2 - option.toString()', option.toString())
            //console.log('3.2 - Problem', this.problemGenerator.goFromTo(probPosition, option.position))
            //console.log('3.2 - option.pddlPlan', option.pddlPlan)

            //console.log(probPosition, option.position, option.toString())
            option.pddlPlan = await this.agent.planner.getPlan(this.problemGenerator.goFromTo(probPosition, option.finalPosition));
            return option;
        }
        // Update utility and search path for non-PDDL movement
        let utility = null;
        let search = null;
        //console.log(option.toString(), '\n', probPosition)
        if (option.id === 'bfs_delivery') {
            const output = this.utilityCalcolator.deliveryUtility(probPosition);
            utility = output[0]
            search = output[1]
        } else if (option.id.startsWith('bfs_pickup-')) {
            const output = this.utilityCalcolator.pickUpUtility(option.parcel, probPosition);
            utility = output[0]
            search = output[1]
        }

        option.firstSearch = search;
        option.utility = utility;
        return option;
    }

   
}
