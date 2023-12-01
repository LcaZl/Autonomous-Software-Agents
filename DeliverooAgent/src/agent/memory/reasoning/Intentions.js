import { PriorityQueue } from "../../../utils/PriorityQueue.js"
import { Agent } from "../../agent.js"
import { Intention } from "./Intention.js"
import { Option } from "./Option.js"
/**
 * The Options class represents the options of an agent.
 */
export class Intentions { 

    /**
     * Constructs a new instance of the Options class.
     * @param {Agent} agent
     * @param {Brain} brain
     */

    constructor(agent) { 

        this.agent = agent
        this.intention_queue = new PriorityQueue()
        this.currentIntention = null
        this.idle = new Option('patrolling', null, null, null, null)

        this.agent.log('[INIT] Intentions Initialized.')
    }
    
    log ( ...args ) {
        this.agent.log( ...args )
    }

    stopCurrent () {
        if ( this.currentIntention )
            this.currentIntention.stop();
    }

    /**
     * 
     * @param {Array} options 
     * @returns 
    */
    async push ( option ) {

        if (this.intention_queue.has(option.id)) {
            this.agent.log('[INTENTIONS] Updating intention', option.id);
            this.intention_queue.updatePriority(option.id, option.utility)
        }
        else{
            this.intention_queue.push(option, option.utility);
            this.agent.log('[INTENTIONS] New intention', option.id);
        }

        // Check for special conditions to stop the current intention
        let chanchingRisk = option.utility * 0.5
        if (this.currentIntention && (this.currentIntention.option.id === 'patrolling' || this.currentIntention.option.utility < (option.utility - chanchingRisk))) 
            this.stopCurrent();
    }

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
                for (let intention of this.intention_queue.valuesWithPriority()){
                    this.agent.log(' - ', intention.data.toString(), intention.priority )
                }
            
                // Current intention
                const option = this.intention_queue.pop();
                //option.setSideOptions(this.intention_queue.values())
                const intention = this.currentIntention = new Intention( this, option, this.agent );
                
                if ( option.id.startsWith('go_pick_up')){//} && !option.batch) {

                    let id = option.parcel.id
                    this.agent.log('[INTENTIONS_REVISION] Validating pick up for', option.id, ' - Parcel:', id)

                    
                    if ( !this.agent.parcels.isValidPickUp(id) ) {
                        this.agent.log( '[INTENTIONS_REVISION] Option', option.id, ' no more valid. (Parcel: ', id,')' );
                        continue;
                    }

                }
                else if (option.id == 'go_deliver') {

                    if ( this.agent.parcels.carriedParcels() == 0) {
                        this.agent.log( '[INTENTIONS_REVISION] Delivery', option.id, ' no sense.' );
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