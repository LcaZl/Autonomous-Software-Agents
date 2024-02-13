import { PriorityQueue } from "../../../utils/PriorityQueue.js"
import { Agent } from "../../../agent.js"
import { Intention } from "./Intention.js"
import { Option, PddlOption } from "../options/Option.js"
import { MessageType } from "../../../multiagent/Communication.js"

/**
 * Manages the intentions of the agent. During the invoked loop the options are revised and the best one is chosen as intention.
 */
export class Intentions {
    /**
     * Constructs a new instance of the Intentions class, initializing the priority queue for options
     * and setting an idle (default) intention.
     * 
     * @param {Agent} agent - The agent
     */
    constructor(agent) {
        this.agent = agent
        this.option_queue = new PriorityQueue()
        this.idle = new Option('patrolling', this.agent) // Default idle option
        this.option_queue.push(this.idle) // Add idle option to the queue
        this.currentIntention = null // Initially, there's no current intention
        console.log('[INIT] Intentions initialized.')
    }

    /**
     * Stops the current intention if one is currently active.
     */
    stopCurrent() {
        if (this.currentIntention) {
            this.currentIntention.stop() // Invoke the stop method on the current intention
        }
    }

    /**
     * Adds new options to the intentions queue, updating existing ones and if some option has higher utility than
     * the current one, stop the current one after pushing the new best one.
     * 
     * @param {Array<Option>} options - The options to be added or updated in the queue.
     */
    push(options) {
        options.forEach(option => {
            // Remove the option from the queue if it already exists to update it
            if (this.option_queue.has(option.id)) {
                this.option_queue.removeById(option.id)
            }

            // Add the option to the queue if it's not the current intention
            if (this.currentIntention.option.id !== option.id) {
                this.option_queue.push(option, option.utility)

                // Change the current intention based on utility and risk assessment
                if (this.currentIntention.option.id === 'patrolling' || 
                    this.currentIntention.option.utility < (option.utility * this.agent.changingRisk) ||
                    (option.id.endsWith('delivery') && option.utility > this.currentIntention.option.utility)) {
                    this.stopCurrent() // Stop the current intention if a better option is found
                }
            }
        })
    }

    updateQueue(){
        let queue = new PriorityQueue()
    
        for (let el of this.option_queue.valuesWithPriority()){
            if (el.data.id != 'patrolling' && el.data.id != 'parcels_sharing'){
                if (this.agent.moveType === 'BFS')
                    el.data.update(this.agent.currentPosition)
                else
                    el.data.simplifiedUpdate(this.agent.currentPosition)

                queue.push(el.data, el.data.utility)
            }
            else{
                queue.push(el.data, el.data.utility)
                break
            }
        }
        this.option_queue = queue
    }

    /**
     * Generates a raw representation of the current option queue.
     * Used for multi-agent communication.
     * The 'patrolling' option is excluded from this representation, and 'pddl_delivery' options are annotated
     * to reflect the agent's role within its team (either 'master' or 'slave').
     * 
     * @returns {Array<Object>} An array of filtered raw options.
     */
        rawOptionQueue() {
            let output = [] // Initialize an empty array to hold the raw options
    
            // Iterate through the options in the queue
            for (const option of this.option_queue.values()) {
                if (option.id !== 'patrolling') { // Exclude 'patrolling'
                    if (option.id === 'pddl_delivery') {
                        // Modify 'pddl_delivery' id based on the agent's role in the team
                        option.id = this.agent.team.imMaster ? 'pddl_delivery_master' : 'pddl_delivery_slave'
                    }
                    output.push(option.raw())
                }
            }
    
            return output
        }

    /**
     * The main loop for processing intentions for BFS and PDDL strategy within a single agent configuration.
     * It listens for relevant events and manages the execution of intentions based on the current priority queue.
     */
    async loop ( ) {

        // Listen for the 'deleted_parcel' event to remove related intentions
        this.agent.eventManager.on('deleted_parcel', async (id) => {
            const realId = this.agent.moveType === 'BFS' ? `bfs_pickup-${id}` : `pddl_pickup-${id}`
            if (this.currentIntention && this.currentIntention.option.id === realId) {
                this.stopCurrent()
            }
            this.option_queue.removeById(realId)
        })

        while ( true ) {
                // If empty intentions queue -> patrolling
                if (this.option_queue.isEmpty()) {
                    this.option_queue.push(this.idle)
                } else {
                    // Update the queue based on current context and pop the top priority option
                    this.updateQueue()
                    const option = this.option_queue.pop()
                    const intention = this.currentIntention = new Intention(this, option, this.agent)
                                
                    // Validate the option before proceeding
                    if (option.id.startsWith('bfs_pickup-') || option.id.startsWith('pddl_pickup-')) {
                        if (!this.agent.parcels.isValidPickUp(option.parcel.id)) continue
                    }
                    if ((option.id === 'bfs_delivery' || option.id === 'pddl_delivery') && this.agent.parcels.carriedParcels() === 0) {
                        continue // Skip delivery options if no parcels are carried
                    }
                    // Start achieving intention
                    //console.log('[INTENTIONS] Started : ', this.currentIntention.option.id)
                    await intention.achieve().catch( msg => {

                        if ( !intention.stopped ){
                            console.log( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', msg )
                            process.exit(0)
                        }
                        //console.log('Current intention stopped, message -> ', msg)
                    })
                    //console.log('[INTENTIONS] Ended   : ', this.currentIntention.option.id)

                await new Promise( res => setImmediate( res ) )
            }
        }
    }

    /**
     * The main loop for processing intentions for BFS and PDDL strategy within a multiagent configuration.
     * Similar to the above loop but with some mechanism specific for the multiagent configuration. 
    */
    async multiagentLoop ( ) {

        this.agent.eventManager.on('deleted_parcel', async (id) => {

            let realId = null
            if (this.agent.moveType === 'BFS')
                realId = `bfs_pickup-${id}`
            else
                realId = `pddl_pickup-${id}`

            if (this.currentIntention.option.id === realId)
                this.stopCurrent()
            if (this.option_queue.has(realId)){
                this.option_queue.removeById(realId)

            }
        })

        while ( true ) {
                if ( this.option_queue.size() == 0 ) {
                    this.option_queue.push( this.idle )
                }
                else {

                    this.updateQueue()
                    const option = this.option_queue.pop()
                    let intention = this.currentIntention = new Intention( this, option, this.agent )

                    // Team validation - Check that we are not going to do the same thing
                    if (option.id !== 'patrolling' && option.id !== 'parcels_sharing'){
                        const validated = await this.agent.communication.validateIntention(option)
                        if (!validated)
                            continue
                    }

                    // Usual option validation steps
                    if ( option.id.startsWith('bfs_pickup-') || option.id.startsWith('pddl_pickup-'))
                        if ( !this.agent.parcels.isValidPickUp(option.parcel.id) ) continue
                    
                    if (option.id === 'bfs_delivery' || option.id === 'pddl_delivery')
                        if (this.agent.parcels.carriedParcels() === 0) continue

                    // Start achieving intention
                    //console.log('[INTENTIONS] Started : ', this.currentIntention.option.id, this.option_queue.size())
                    await intention.achieve().catch( async msg => {

                        if ( !intention.stopped ){
                            console.log( '[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', msg )
                            process.exit(0)
                        }
                        //console.log('Current intention stopped, message -> ', msg)

                        // Parcel sharing for delivery start handshaking
                        if (msg[0] == 'target_not_reachable' && intention.option.id.endsWith('delivery')){
                            const specialOption = await this.agent.communication.requestDeliverySharing(intention.option.raw())
                            if (specialOption !== null) // My teammate option
                                this.option_queue.push(specialOption)
                        }

                        if (intention.option.id === 'parcels_sharing'){
                            this.agent.communication.parcelSharingInterrupted()
                        }

                    })
                    //console.log('[INTENTIONS] Ended   : ', this.currentIntention.option.id)

                }
                await new Promise( res => setImmediate( res ) )
        }
    }


/**
 * Continuously evaluates and executes the best available options for the agent in a multi-agent system using PDDL_1.
 */
async multiagentPddlLoop() {
    this.executingMultiagentPlan = false // Flag to track the execution of a multiagent plan.

    while (true) {
        this.updateQueue() // Update the priority queue with available options.
        if (this.option_queue.size() === 0) {
            this.option_queue.push(this.idle) // Push idle option if the queue is empty.
        }

        let multiagentAnswer = null
        let option = this.option_queue.peek() // Peek at the top option without removing it from the queue.
        let intention = this.currentIntention = new Intention(this, option, this.agent) // Create a new intention based on the peeked option.

        // Handling for the master agent in a multi-agent system.
        if (this.agent.team.imMaster && this.agent.communication.multiagentOption === null) {
            multiagentAnswer = await this.agent.communication.multiagentPlanForMaster()
                .catch(error => {
                    console.log(error)
                    process.exit(0) 
                })
        }
        // Handling for slave agents in a multi-agent system.
        else if (!this.agent.team.imMaster && this.agent.communication.multiagentOption !== null) {
            multiagentAnswer = await this.agent.communication.multiagentPlanForSlave()
                .catch(error => {
                    console.log(error)
                    process.exit(0) 
                })
        }

        // If a multiagent plan is successfully received and confirmed, create a new PddlOption and Intention for it.
        if (multiagentAnswer !== null && multiagentAnswer.status) {
            const optionId = `multiagent_${multiagentAnswer.option.id}`
            option = new PddlOption(optionId, multiagentAnswer.option.parcel, this.agent, true, multiagentAnswer.option)
            this.executingMultiagentPlan = true // Set flag to true indicating a multiagent plan is being executed.
        } else {
            option = this.option_queue.pop() // Pop the next option from the queue if no multiagent plan is available.
        }

        intention = this.currentIntention = new Intention(this, option, this.agent)

        // Validate the intention unless it's a patrolling or parcels sharing intention.
        if (!['patrolling', 'parcels_sharing'].includes(option.id) && !option.id.startsWith('multiagent_')) {
            const validated = await this.agent.communication.validateIntention(option)
            if (!validated) continue // Skip to the next iteration if the intention is not validated.
        }

        // Begin achieving the current intention.
        //console.log('[INTENTIONS] Started : ', this.currentIntention.option.id, this.option_queue.size())
        await intention.achieve().catch( async msg => {
            if (!intention.stopped) {
                console.log('[INTENTIONS_REVISION] Error with intention', intention.option.id, '- Error:', msg)
                process.exit(0) // Consider more robust error handling instead of exiting.
            }
            //console.log('Current intention stopped, message -> ', msg)

        })

        this.executingMultiagentPlan = false // Reset the flag after the intention is achieved or stopped.

        //console.log('[INTENTIONS] Ended   : ', this.currentIntention.option.id)

        // Additional steps for slave agents after completing a multiagent plan.
        // Communicate it to the master
        if (!this.agent.team.imMaster && option.id.startsWith('multiagent_')) {
            await this.agent.communication.slaveEndsMultiagentPlan()
        }

        this.agent.eventManager.emit('new_parcels_info')
        this.option_queue = new PriorityQueue() // Reinitialize the option queue.
        await this.agent.options.updateOptionsForPddl() // Update options based on the latest PDDL plan.
        this.agent.beliefs.updateParcels() // Update the agent's beliefs about parcels.

        await new Promise(res => setImmediate(res)) // Yield execution to allow other asynchronous operations to complete.
    }
}

}