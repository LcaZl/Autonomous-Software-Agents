import { PriorityQueue } from "../../../../utils/PriorityQueue.js";
import { Parcel } from "../../../Environment/Parcels/Parcel.js";
import { BfsOption, PddlOption} from "./Option.js";
import { ProblemGenerator } from "../planning/ProblemGenerator.js";
import { UtilityCalcolator } from "../UtilityCalcolator.js";

/**
 * Manages the options available to an agent.
 */
export class Options {

    /**
     * @param {Agent} agent - The agent associated with these options.
     */
    constructor(agent) {
        this.agent = agent;
        this.problemGenerator = new ProblemGenerator(agent)
        this.utilityCalcolator = new UtilityCalcolator(agent)
        this.pddlNearEnd = false
        console.log('[INIT] Options initialized.')
    }


    /**
     * Activates the event manager to listen for relevant events.
     */
    activate() {

        const notification = () => {
            switch(this.agent.moveType){
                case 'BFS':
                    this.updateOptionsForBfs()
                    break;
                case 'PDDL':
                    this.updateOptionsForPddl()
                    break;
            }
        }

        this.agent.eventManager.on('update_options', () => notification())
        this.agent.eventManager.on('picked_up_parcels', () => notification());
        this.agent.eventManager.on('delivered_parcels', () => notification());
        this.agent.eventManager.on('movement', () => notification());

    }

    /**
     * Updates the options based on the current state of the agent and environment.
     * This function is specifi for BFS configuration
     */
    updateOptionsForBfs(){

        const currentOptionId = this.agent.intentions.currentIntention.option.id
        let options = []

        const predictOptionsPaths = () => { // To calculate future path based on current intention final position
            const futurePosition = this.agent.intentions.currentIntention.option.finalPosition
            let updated = 0
            for (let option of options){
                if (updated < this.agent.lookAhead){ // Calculate the future path only for the first lookAhead options.

                   option.update(futurePosition)
                }
            }
        }

        // If the agent is carrying some parcel, evaluate a delivery option
        if (this.agent.parcels.carriedParcels() > 0){
            let utility = this.utilityCalcolator.deliveryUtility(this.agent.currentPosition)
            if (utility.value > 0)
                options.push(new BfsOption('bfs_delivery', 
                    utility.search.startPosition, 
                    utility.search.finalPosition, 
                    utility.value, 
                    utility.search, 
                    this.agent.parcels.getOneOfMyParcels(),
                    this.agent)) 
        }

        // For each parcel that can be take, elaborate a plan.
        for(let [_, parcel] of this.agent.parcels.getParcels()){
            const id = `bfs_pickup-${parcel.id}`
            if ( parcel.isFree() && currentOptionId !== id){
                let utility = this.utilityCalcolator.pickUpUtility(parcel, this.agent.currentPosition)
                if (utility.value > 1) 
                    options.push(new BfsOption(id, utility.search.startPosition, utility.search.finalPosition, utility.value, utility.search, parcel, this.agent))
            }
        }

        if (options.length > 0) {

            if (options.length > 1)
                predictOptionsPaths()

            // Pushing option into intentions
            options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
            this.agent.intentions.push( options )
        }
    }

    /**
     * Updates the options based on the current state of the agent and environment.
     * Specific for PDDL configuration.
     */
    async updateOptionsForPddl(){

        let options = []
        const currentOption = this.agent.intentions.currentIntention.option

        // Elaborate future options
        const predictOptionsPaths = async () => {
            const futurePosition = this.agent.intentions.currentIntention.option.finalPosition
            let updated = 0

            for (let option of options){
                if (updated < this.agent.lookAhead){
                    option.updatePlan(futurePosition)
                    updated++
                }
            }
        
        }

        // Elaborate delivery option
        if (this.agent.parcels.carriedParcels() > 0 && currentOption.id !== 'pddl_delivery'){
            const parcel = this.agent.parcels.getOneOfMyParcels()
            let search = this.agent.environment.getEstimatedNearestDeliveryTile(this.agent.currentPosition)
            const utility = this.utilityCalcolator.simplifiedDeliveryUtility(this.agent.currentPosition, search.position)
            if (utility > 0){
                const deliveryOption = new PddlOption('pddl_delivery', utility, this.agent.currentPosition, search.position, this.agent, parcel)
                options.push(deliveryOption)
            }
        }

        // Elaborate pick up options
        let parcelsToTake = this.agent.parcels.getFreeParcels()
        for (const parcel of parcelsToTake){
            const utility = this.utilityCalcolator.simplifiedPickUpUtility(this.agent.currentPosition, parcel)
            if (currentOption.id !== `pddl_pickup-${parcel.id}` && utility > 0.5){
                const option = new PddlOption(
                    `pddl_pickup-${parcel.id}`,
                    utility,
                    this.agent.currentPosition,
                    parcel.position,
                    this.agent,
                    parcel
                )
                options.push(option)
            }
        }


        if (options.length > 0) {
            options.sort( (opt1, opt2) => opt1.utility - opt2.utility )
            
            if (currentOption.id != 'patrolling')
                await predictOptionsPaths()

            
            await this.agent.intentions.push( options )

        }
    }
}