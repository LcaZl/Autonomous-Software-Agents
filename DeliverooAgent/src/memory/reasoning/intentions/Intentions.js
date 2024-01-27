import { PriorityQueue } from "../../../utils/PriorityQueue.js";
import { Agent } from "../../../agent.js";
import { Intention } from "./Intention.js";
import { Option } from "../options/Option.js";

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
        this.pushing = false

        console.log('[INIT] Intentions initialized.');
    }

    /**
     * Stops the current intention if exists.
     */
    stopCurrent() {
        if (this.currentIntention) {
            this.currentIntention.stop();
        }
    }

    /**
     * Adds a new option to the intentions queue or manage it if it already exists.
     * 
     * @param {Option} option - The option to be added or updated.
    */
    push(options) {

        for (let option of options){

            if (this.intention_queue.has(option.id)) {
                this.intention_queue.removeById(option.id);
            }
            
            if (this.currentIntention.option.id != option.id){

                this.intention_queue.push(option, option.utility);

                if (this.currentIntention.option.id === 'patrolling' || 
                this.currentIntention.option.utility < (option.utility * this.agent.changingRisk) ||
                (option.id.endsWith('delivery') && option.utility > this.currentIntention.option.utility)) {
                    this.stopCurrent()
                }
            }
        }
    }

    updateQueueForBfs(){
        let queue = new PriorityQueue()
        
        for (let el of this.intention_queue.valuesWithPriority()){
            if (el.data.id != 'patrolling'){
                el.data.update(this.agent.currentPosition)
                queue.push(el.data, el.data.utility)
            }
            else{
                queue.push(el.data, el.data.utility)
                break;
            }
        }

        this.intention_queue = queue
    }

    /**
     * Continuously processes the intention queue, executing intentions.
     * Listens for events that might impact current intentions.
     */
    async loop ( ) {

        this.agent.eventManager.on('deleted_parcel', async (id) => {

            let realId = null
            if (this.agent.moveType === 'BFS')
                realId = `bfs_pickup-${id}`
            else
                realId = `pddl_pickup-${id}`

            if (this.currentIntention.option.id === realId)
                this.stopCurrent()
            if (this.intention_queue.has(realId))
                this.intention_queue.removeById(realId)
        })

        while ( true ) {
            // If empty intentions queue -> patrolling
            if ( this.intention_queue.size() == 0 ) {

                let idle = new Option('patrolling', this.agent);
                this.intention_queue.push( idle );
            }
            else { // Consumes intention_queue if not empty

                if (this.agent.moveType === 'BFS')
                    this.updateQueueForBfs()

                let option = this.intention_queue.pop();
                const intention = this.currentIntention = new Intention( this, option, this.agent );

                if ( option.id.startsWith('bfs_pickup-') || option.id.startsWith('pddl_pickup-')){

                    if ( !this.agent.parcels.isValidPickUp(option.parcel.id) ) 
                        continue;
                }

                if (option.id === 'bfs_delivery' || option.id === 'pddl_delivery')
                    if (this.agent.parcels.carriedParcels() === 0){
                        console.log( '[INTENTIONS_REVISION] Delivery option', option.id, ' no more valid.' );
                        continue;
                    }

                // Start achieving intention
                //console.log('[INTENTIONS] Started : ', this.currentIntention.option.id, this.intention_queue.size())
                //this.agent.eventManager.emit('new_intention', intention.option) // For the communication
                await intention.achieve().catch( msg => {

                    if ( !intention.stopped ){
                        console.log( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', msg )
                        process.exit(0)
                    }
                    //console.log('Current intention stopped, message -> ', msg)
                });
                //console.log('[INTENTIONS] Ended   : ', this.currentIntention.option.id)

            }
            
            await new Promise( res => setImmediate( res ) );

        }
    }
}