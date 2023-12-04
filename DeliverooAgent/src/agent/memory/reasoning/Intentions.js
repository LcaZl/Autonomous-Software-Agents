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
        this.idle = new Option('patrolling', this.agent.currentPosition, null, 0, null, null);
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

        for (let option of options){
            if (this.intention_queue.has(option.id)) {
                this.agent.log('[INTENTIONS] Removing intention', option.id);
                this.intention_queue.removeById(option.id);
            }

            let changingRisk = option.utility * 0.35;
            if (this.currentIntention.option.id === 'patrolling' || this.currentIntention.option.utility < (option.utility - changingRisk)) 
                this.stopCurrent()

            this.intention_queue.push(option, option.utility);
            previousOption = option
        }

        this.intention_queue.removeById('patrolling')
    }

    /**
     * Continuously processes the intention queue, executing intentions.
     * Listens for events that might impact current intentions.
     */
    async loop ( ) {
        this.agent.eventManager.on('deleted_parcel', async (id) => {

            let realId = null
            let batchId = null
            if (this.agent.moveType == 'BFS')
                realId = `bfs_pickup-${id}`
            else{
                realId = `pddl_pickup-${id}`
                batchId = `${id}`
            }

            if ((this.currentIntention.option.id == realId))
                this.stopCurrent()
            else if (this.intention_queue.has(realId))
                this.intention_queue.removeById(realId)
            else {
                let realBatchIds = this.intention_queue.searchByIdSubstring(batchId)
                realBatchIds.forEach(id => this.intention_queue.removeById(id))
            }
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

                const intention = this.currentIntention = new Intention( this, option, this.agent );

                if ( option.id.startsWith('bfs_pickup-') || option.id.startsWith('pddl_pickup-') ){

                    let id = option.parcel.id
                    this.agent.log('[INTENTIONS_REVISION] Validating pick up for', option.id, ' - Parcel:', id)

                    
                    if ( !this.agent.parcels.isValidPickUp(id) ) {
                        this.agent.log( '[INTENTIONS_REVISION] Option', option.id, ' no more valid. (Parcel: ', id,')' );
                        continue;
                    }
                }

                // Start achieving intention
                await intention.achieve().catch( error => {

                    if ( !intention.stopped ){
                        console.error( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', error )
                        this.intention_queue.push(this.currentIntention.option, this.currentIntention.utility)
                    }
                
                });
            }
            
            this.agent.log('[INTENTIONS_REVISION] End revision loop.')
            await new Promise( res => setImmediate( res ) );
        }
    }
}