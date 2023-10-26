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
        this.idle = new Option('patrolling', null, null)

        console.log('[INIT] Intentions Initialized.')
    }
    
    log ( ...args ) {
        console.log( ...args )
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

        if ( this.intention_queue.has((option.id))){

            console.log('[INTENTIONS] Already have intention',option.id,', updating it ...')
            this.intention_queue.updatePriority(option.id, option.utility)
            return;
        }
        else if (!this.currentIntention || !(this.currentIntention.option.id == option.id)  || this.currentIntention.option.id == 'patrolling'){
            
            console.log('[INTENTIONS] New Option', option.id)

            if (this.currentIntention && option.id != 'patrolling' && this.currentIntention.option.id == 'patrolling'){

                console.log('[INTENTIONS] Current intention is patrolling, I have something new. Stop it.')
                this.stopCurrent()
            }
            else if (this.currentIntention && this.currentIntention.option.utility < option.utility){

                console.log('[INTENTIONS] New option',option.id,'with higher utility than actual one ', this.currentIntention.option.id,'. Stop it.')
                this.stopCurrent()
                this.intention_queue.push(this.currentIntention.option, this.currentIntention.option.utility)
            }

            this.intention_queue.push( option,  option.utility);
        }
    }

    async loop ( ) {
        this.agent.eventManager.on('deleted_parcel', async (id) => {

            const realId = `go_pick_up-${id}`
            console.log('[INTENTIONS] Parcel deleted, checking', realId)

            if (this.currentIntention.option.id == realId)
                this.stopCurrent()
            else if (this.intention_queue.has(realId))
                this.intention_queue.removeById(realId)
        })

        while ( true ) {

            console.log('[INTENTIONS_REVISION] Start revision loop.')

            // Consumes intention_queue if not empty
            if ( this.intention_queue.size() == 0 ) {
                
                this.push( this.idle );
            }
            else {

                console.log( '[INTENTIONS] Intentions queue:', this.intention_queue.values());
            
                // Current intention
                const option = this.intention_queue.pop();
                const intention = this.currentIntention = new Intention( this, option, this.agent );
                
                if ( option.id.startsWith('go_pick_up')) {

                    let id = option.id.split('-')[1]

                    let p = this.agent.parcels.getParcels().get(id)
                    console.log('[INTENTIONS_REVISION] Validating pick up for', option.id, ' - Parcel:', id)

                    if ( p && p.carriedBy ) {
                        console.log( '[INTENTIONS_REVISION] Option', option.id, ' no more valid. (Parcel: ', id,')' );
                        continue;
                    }

                }
                else if (option.id == 'go_deliver') {

                    if ( this.agent.parcels.carriedParcels() == 0) {
                        console.log( '[INTENTIONS_REVISION] Delivery', option.id, ' no sense.' );
                        continue;
                    }

                }

                // Start achieving intention
                await intention.achieve().catch( error => {

                    if ( !intention.stopped )
                        console.error( '[INTENTIONS_REVISION] Error with intention', intention.option.id, 'with error:', error )

                });

            }
            
            console.log('[INTENTIONS_REVISION] End revision loop.')
            await new Promise( res => setImmediate( res ) );
        }
    }
}