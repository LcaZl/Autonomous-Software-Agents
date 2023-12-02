import { PriorityQueue } from "../../../utils/PriorityQueue.js";
import { Agent } from "../../agent.js";
import { Intention } from "./Intention.js";
import { BatchOption, Option } from "./Option.js";

/**
 * Manages the intentions of an agent, handling the decision-making process.
 */
export class Intentions {
    /**
     * Constructs a new instance of the Intentions class.
     * 
     * @param {Agent} agent - The agent associated with these intentions.
     */
    constructor(agent) {
        this.agent = agent;
        this.intention_queue = new PriorityQueue();
        this.currentIntention = null;
        this.idle = new Option('patrolling', null, 0, null, null);

        this.agent.log('[INIT] Intentions Initialized.');
    }

    log(...args) {
        this.agent.log(...args);
    }

    /**
     * Stops the current intention if it exists.
     */
    stopCurrent() {
        if (this.currentIntention) {
            this.currentIntention.stop();
        }
    }

    /**
         * Adds a new option to the intentions queue or updates it if it already exists.
         * 
         * @param {Option} option - The option to be added or updated.
         */
    async push(options) {
        let previousOption = null
        let updated = 0
        let maxUpdate = this.agent.lookAhead

        for (let option of options){
            if (this.intention_queue.has(option.id)) {
                this.agent.log('[INTENTIONS] Updating intention', option.id);
                this.intention_queue.removeById(option.id);
            }

            let changingRisk = option.utility * 0.2;
            if (this.currentIntention.option.id === 'patrolling' || this.currentIntention.option.utility < (option.utility - changingRisk)) 
                this.stopCurrent()

            if (this.agent.moveType != 'PDDL' && previousOption != null && updated < maxUpdate ){
                option = await this.agent.options.luckyUpdateOption(option, previousOption.position)
                updated++
            }
            this.intention_queue.push(option, option.utility);
            previousOption = option
        }
    }

    /**
     * Continuously processes the intention queue, executing intentions.
     * Listens for events that might impact current intentions.
     */
    async loop ( ) {
        this.agent.eventManager.on('deleted_parcel', async (id) => {

            const realId = `go_pick_up-${id}`

            if (this.currentIntention.option.id == realId)
                this.stopCurrent()
            else if (this.intention_queue.has(realId))
                this.intention_queue.removeById(realId)
        })

        while ( true ) {

            this.agent.log('[INTENTIONS_REVISION] Start revision loop.')

            // Consumes intention_queue if not empty
            if ( this.intention_queue.size() == 0 ) {
                
                this.intention_queue.push( this.idle );
            }
            else {
                this.agent.log( '[INTENTIONS] Intentions queue:');
                let option = this.intention_queue.pop();
                if (this.agent.moveType == 'PDDL' && this.intention_queue.size() > 1){
                    option = new BatchOption(option, this.intention_queue.valuesWithPriority(), this.agent)
                    this.intention_queue.flush()
                    //await option.init()
                    //process.exit(0)
                }
                const intention = this.currentIntention = new Intention( this, option, this.agent );

                if ( option.id.startsWith('go_pick_up')){

                    let id = option.parcel.id
                    this.agent.log('[INTENTIONS_REVISION] Validating pick up for', option.id, ' - Parcel:', id)

                    
                    if ( !this.agent.parcels.isValidPickUp(id) ) {
                        this.agent.log( '[INTENTIONS_REVISION] Option', option.id, ' no more valid. (Parcel: ', id,')' );
                        continue;
                    }
                }

                // Start achieving intention
                await intention.achieve().catch( error => {

                    if ( !intention.stopped )
                        console.error( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', error )
                    
                });
            }
            
            this.agent.log('[INTENTIONS_REVISION] End revision loop.')
            await new Promise( res => setImmediate( res ) );
        }
    }
}