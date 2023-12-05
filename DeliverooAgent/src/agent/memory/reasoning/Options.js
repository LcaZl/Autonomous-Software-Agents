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
        this.lastPushedOptions = [];
        this.problemGenerator = new ProblemGenerator(agent)
        this.utilityCalcolator = new UtilityCalcolator(agent)
        console.log('[INIT] Options initialized.')
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
    updateOptionsForBfs(){

        let options = []

        if (this.agent.parcels.carriedParcels() > 0){
            let [utility, search] = this.utilityCalcolator.deliveryUtility()
            options.push(new Option('bfs_delivery', search.startPosition, search.finalPosition, utility, search, null)) 
        }

        for(let [_, parcel] of this.agent.parcels.getParcels()){

            if ( parcel.isFree() ){
                let [utility, search] = this.utilityCalcolator.pickUpUtility(parcel, this.agent.currentPosition)
                if (utility > 0) 
                    options.push(new Option(`bfs_pickup-${parcel.id}`, search.startPosition, search.finalPosition, utility, search, parcel))
            }
        }


        if (options.length > 1){
            let lastPosition = this.agent.intentions.currentIntention.option.finalPosition

            let updated = 0
            for (let opt of options){
                if (updated < this.agent.lookAhead){
                    opt = this.agent.options.updateBfsOption(opt, lastPosition)
                    updated++
                }
                lastPosition = opt.finalPosition
            }
        }

        options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
        this.lastPushedOptions = options

        if (options.length > 0) this.agent.intentions.push( options )

    }

        /**
     * Updates the options based on the current state of the agent and environment.
     */
        async updateOptionsForPddl(){

            let parcelsToTake = []
            let deliveryOption = null
            let options = []

            // Delivery option only if needed
            if (this.agent.parcels.carriedParcels() > 0){
                let deliveryPosition = this.agent.environment.getEstimatedNearestDeliveryTile(this.agent.currentPosition)
                let utility = this.utilityCalcolator.simplifiedDeliveryUtility(this.agent.currentPosition, deliveryPosition)
                deliveryOption = new Option('pddl_delivery', this.agent.currentPosition, deliveryPosition, utility, null, null)
            }
            
            // Parcels available
            for(let [_, parcel] of this.agent.parcels.getParcels())
                if ( parcel.isFree() && parcel.reward > 1)                    
                    parcelsToTake.push(parcel)

            if (parcelsToTake.length > 1 && this.agent.batchSize > 1)
                options = this.createBatchOptions(parcelsToTake) // PDDL for batch pickup/delivery
            else
                options = this.singlePddlOption(parcelsToTake) // PDDL for single pickup/delivery
        

            if (deliveryOption != null)
                options.push(deliveryOption)

            // Use the final position of the current intention to set the start of the future path
            let actualLastPosition = this.agent.intentions.currentIntention.option.finalPosition
            
            let updated = 0

            for (let opt of options){

                if (updated < this.agent.lookAhead){
                    // Update the option for the future
                    opt = await this.agent.options.updatePddlOption(opt, actualLastPosition)
                    updated++
                }
            }


            if (options.length > 0) 
            {
                options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
                this.agent.intentions.push( options )
            }
            this.lastPushedOptions = options
            
        }

    singlePddlOption(parcels){
        let options = []
        for (let parcel of parcels){
            let utility = this.utilityCalcolator.simplifiedPickUpUtility(this.agent.currentPosition, parcel)
            const id = `pddl_pickup-${parcel.id}`
            if (utility > 0) 
                options.push(new Option(id, this.agent.currentPosition, parcel.position, utility, null, parcel))
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
    updateBfsOption(option, probPosition) {
        // Update utility and search path for non-PDDL movement
        let utility = null;
        let search = null;
        //console.log(option.toString(), '\n', probPosition)
        if (option.id === 'bfs_delivery') {
            const output = this.utilityCalcolator.deliveryUtility(probPosition);
            utility = output[0]
            search = output[1]
            option.finalPosition = search.finalPosition
        } else if (option.id.startsWith('bfs_pickup-')) {
            const output = this.utilityCalcolator.pickUpUtility(option.parcel, probPosition);
            utility = output[0]
            search = output[1]
        }

        option.startPosition = probPosition
        option.bfsSearch = search;
        //option.utility = utility;

        return option;
    }

       /**
     * Updates the given option's utility and search path based on a probability position.
     * 
     * @param {Option} option - The option to update.
     * @param {Position} probPosition - The probability position used for the update.
     * @returns {Option} The updated option.
     */
    async updatePddlOption(option, probPosition) {

        option.pddlPlan = await this.agent.planner.getPlan(this.problemGenerator.goFromTo(probPosition, option.finalPosition));
        
        let utility  = null

        if (option.id === 'pddl_delivery') 
            utility = this.utilityCalcolator.simplifiedDeliveryUtility(probPosition, option.finalPosition);
        else
            utility = this.utilityCalcolator.simplifiedPickUpUtility(probPosition, option.parcel);

        option.utility = utility

        if (option.id !== 'pddl_delivery')
            option.startPosition = probPosition

        return option;
    }4
}
