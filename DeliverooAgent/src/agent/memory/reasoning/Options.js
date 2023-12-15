import { PriorityQueue } from "../../../utils/PriorityQueue.js";
import { Parcel } from "../../Environment/Parcels/Parcel.js";
import { BfsOption, PddlOption} from "./Option.js";
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
        this.problemGenerator = new ProblemGenerator(agent)
        this.utilityCalcolator = new UtilityCalcolator(agent)
        this.pddlNearEnd = false
        console.log('[INIT] Options initialized.')
    }


    /**
     * Activates the option manager to listen for relevant events.
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
        this.agent.eventManager.on('pddl_near_end', () => {

            const currentOption = this.agent.intentions.currentIntention.option
            const futurePosition = currentOption.finalPosition

            let search = this.agent.environment.getEstimatedNearestDeliveryTile(futurePosition)
            const utility = this.utilityCalcolator.simplifiedDeliveryUtility(futurePosition, search.position)
            const deliveryOption = new PddlOption('pddl_delivery', utility, futurePosition, search.position, this.agent, currentOption.parcel)
            this.agent.intentions.push( [deliveryOption] )
        })
    }

    /**
     * Updates the options based on the current state of the agent and environment.
     */
    updateOptionsForBfs(){

        const currentOptionId = this.agent.intentions.currentIntention.option.id
        let options = []

        const predictOptionsPaths = () => {
            const futurePosition = this.agent.intentions.currentIntention.option.finalPosition
            let updated = 0
            for (let option of options){
                if (updated < this.agent.lookAhead){

                    // Update utility and search path for non-PDDL movement
                    let utility = null;
    
                    if (option.id === 'bfs_delivery') {
                        utility = this.utilityCalcolator.deliveryUtility(futurePosition);
                        option.finalPosition = utility.search.finalPosition
                    } else if (option.id.startsWith('bfs_pickup-')) {
                        utility = this.utilityCalcolator.pickUpUtility(option.parcel, futurePosition);
                    }
    
                    option.startPosition = futurePosition
                    option.bfs = utility.search;                
                    updated++
                }
            }
        }


        if (this.agent.parcels.carriedParcels() > 0 && currentOptionId !== 'pddl_delivery'){
            let utility = this.utilityCalcolator.deliveryUtility(this.agent.currentPosition)
            options.push(new BfsOption('bfs_delivery', utility.search.startPosition, utility.search.finalPosition, utility.value, utility.search, this.agent.parcels.myParcels)) 
        }


        for(let [_, parcel] of this.agent.parcels.getParcels()){
            const id = `bfs_pickup-${parcel.id}`
            if ( parcel.isFree() && currentOptionId !== id){
                let utility = this.utilityCalcolator.pickUpUtility(parcel, this.agent.currentPosition)
                if (utility.value > 1) 
                    options.push(new BfsOption(id, utility.search.startPosition, utility.search.finalPosition, utility.value, utility.search, parcel))
            }
        }

        if (options.length > 1)
            predictOptionsPaths()

        if (options.length > 0) {
            options.sort( (opt1, opt2) => opt2.utility - opt1.utility )
            this.agent.intentions.push( options )
        }
    }

    /**
     * Updates the options based on the current state of the agent and environment.
     */
    async updateOptionsForPddl(){

        let options = []
        const currentOption = this.agent.intentions.currentIntention.option

        const predictOptionsPaths = async () => {
            const futurePosition = this.agent.intentions.currentIntention.option.finalPosition
            let updated = 0

            for (let option of options){
                if (updated < this.agent.lookAhead){
                    await option.updatePlan(futurePosition)
                    updated++
                }
            }
        
        }

        // Elaborate multiple pickup PDDL plan
        let parcelsToTake = this.agent.parcels.getFreeParcels()
        if (parcelsToTake.length > 0){
            //const search = this.utilityCalcolator.pddlUtilityWithAll(parcelsToTake)
            
            for (const parcel of parcelsToTake){
                const utility = this.utilityCalcolator.simplifiedPickUpUtility(this.agent.currentPosition, parcel)
                if (currentOption.id !== `pddl_pickup-${parcel.id}` && utility > 1){
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
        }

        if (this.agent.parcels.carriedParcels() > 0 && currentOption.id !== 'pddl_delivery'){
            const parcel = this.agent.parcels.getOneOfMyParcels()
            let search = this.agent.environment.getEstimatedNearestDeliveryTile(this.agent.currentPosition)
            const utility = this.utilityCalcolator.simplifiedDeliveryUtility(this.agent.currentPosition, search.position)
            const deliveryOption = new PddlOption('pddl_delivery', utility, this.agent.currentPosition, search.position, this.agent, parcel)
            options.push(deliveryOption)
        }


        if (options.length > 0) {
            options.sort( (opt1, opt2) => opt1.utility - opt2.utility )
            
            if (currentOption.id != 'patrolling')
                await predictOptionsPaths()

            options.filter(opt => opt.utility <= 0)
            await this.agent.intentions.push( options )

        }
    }
}