import { PriorityQueue } from "../../../../utils/PriorityQueue.js";
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
    async push(options) {
        this.pushing = true
        //console.log('\n\n|--Curr- ',this.currentIntention.option.utility,' -', this.currentIntention.option.id)
        //this.agent.showIntentions(this.intention_queue.valuesWithPriority())
        
        let newBest = false
        for (let option of options){
            //console.log('IN -> ', option.toString() )

            if (this.intention_queue.has(option.id)) {
                //console.log('[INTENTIONS]Same in Queue -> ', this.intention_queue.getById(option.id).toString())                
                this.intention_queue.removeById(option.id);
                if(this.agent.multiagent){
                    if(this.agent.team.MASTER){
                        //console.log("[OPTIONS/INTENTIONS - P.util] - ")
                        let optionDel = this.agent.communication.sharedIntentionQueue.convertToJSON(option.toString())
                        this.agent.communication.sharedIntentionQueue.deleteOption(this.agent.agentID, optionDel)
                    } else {
                        //console.log("[OPTIONS/INTENTIONS - P.util] - ")
                        this.agent.communication.deleteOptionToMasQueue(option.toString(), option.utility)
                    }
                }
            }
            
            if (this.currentIntention.option.id != option.id){
                this.intention_queue.push(option, option.utility);
                if(this.agent.multiagent){
                    if(this.agent.team.MASTER){
                        //sharedIntentionQueue direct
                        let optionAdd = this.agent.communication.sharedIntentionQueue.convertToJSON(option.toString())
                        this.agent.communication.sharedIntentionQueue.addOrUpdateOption(this.agent.agentID, optionAdd)
                    } else {
                        this.agent.communication.pushOptionToMasQueue(option.toString(), option.utility)                        
                    }
                }

                if (this.currentIntention.option.id === 'patrolling' || 
                this.currentIntention.option.utility < (option.utility * this.agent.changingRisk)) {
                    
                    //console.log('[INTENTIONS] Cause stop -> ', option.toString() )
                    newBest = true
                }
            }
        }
        if (newBest)
            this.stopCurrent()
        this.pushing = false
    }

    /**
     * Continuously processes the intention queue, executing intentions.
     * Listens for events that might impact current intentions.
     */
    async loop ( ) {

        this.agent.eventManager.on('picked_up_parcels', async (ids) => {

            for (const id of ids){
                let realId = null
                if (this.agent.moveType === 'BFS')
                    realId = `bfs_pickup-${id}`
                else
                    realId = `pddl_pickup-${id}`

                if (this.currentIntention.option.id === realId)
                    this.stopCurrent()
                if (this.intention_queue.has(realId))
                    this.intention_queue.removeById(realId)
            }
        })


        // !not-deliberating
        //  this.stopCurrent()
        while ( true ) {
            if ( !this.pushing ){
                // If empty intentions queue -> patrolling
                if ( this.intention_queue.size() == 0 ) {
                    let rndPosition = this.agent.environment.getRandomPosition()
                    console.log()
                    let idle = new Option('patrolling', this.agent.currentPosition, rndPosition, 0);
                    this.intention_queue.push( idle );
                }
                else { // Consumes intention_queue if not empty
                    //console.log( '[INTENTIONS] Intentions queue:');
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
                    this.agent.eventManager.emit('new_intention', intention.option) // For the communication
                    await intention.achieve().catch( error => {

                        if ( !intention.stopped ){
                            console.log( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', error )
                            process.exit(0)
                        }
                    });
                    //console.log('[INTENTIONS] Ended   : ', this.currentIntention.option.id)

                }
                
                //console.log('[INTENTIONS_REVISION] End revision loop.')
                await new Promise( res => setImmediate( res ) );
            }
        }
    }
}