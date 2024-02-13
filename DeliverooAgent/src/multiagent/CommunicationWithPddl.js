import { MultiAgentOption, ShareParcelsOption } from "../memory/reasoning/options/Option.js"
import { Position } from "../utils/Position.js"
import { Communication, MessageType } from "./Communication.js"

export class CommunicationWithPDDL extends Communication{
    /**
     * Constructs a specific communication handler for the agent, when using PPDL and PDDL_1 strategy.
     * 
     * @param {Agent} agent - The agent 
     */
    constructor(agent){
        super(agent)
        this.multiagentOption = null
    }

    /**
     * Filters and processes incoming messages based on their type, taking appropriate actions for each message.
     * 
     * @param {Object} packet - The received message packet containing the message type and content.
     */
    async filterMessage(packet) {
        
        let currentOpt = this.agent.intentions.currentIntention.option

        switch (packet.message.type) {
            case MessageType.UPDATE_PARCELS:
                // Emit event to handle updated parcel information from a team member.
                this.agent.eventManager.emit('parcels_percept_from_team', packet.message.content)
                break

            case MessageType.UPDATE_PLAYERS:
                // Emit event to handle updated player information from a team member.
                this.agent.eventManager.emit('players_percept_from_team', packet.message.content)
                break

            case MessageType.UPDATE_POSITION:
                // Update the position of the teammate based on received information.
                const newPos = new Position(packet.message.content.x, packet.message.content.y)
                this.agent.players.updateTeammatePosition(packet.id, newPos)
                break

            case MessageType.DELIVERY:
                // Update the list of parcels delivered by the team.
                packet.message.content.forEach(pId => this.team.parcelsDeliveredByTeam.add(pId))
                // Reset carried parcels for the teammate and handle parcel delivery.
                this.team.teammate.carriedParcels = new Set()
                this.agent.parcels.handleParcelsDelivery(packet.message.content)
                break

            case MessageType.NEWINTENTION:
                // Handle new intention validation, invoked only by the master.
                const answer = this.team.validateTeamMemberIntention(packet.message.content)
                packet.reply(answer)
                break

            case MessageType.PICKUP:
                // Handle parcel pickup by a teammate.
                this.agent.parcels.handleTeammatePickup(packet.id, packet.message.content)
                break

            case MessageType.IMPOSSIBLE_DELIVERY:
                // Handle the case where a teammate cannot deliver parcels and is asking for help.
                const option = packet.message.content // The delivery option in question.
                const msg = this.team.deliverForTeammate(option)
                if (msg === null) {
                    await packet.reply({ type: MessageType.ICANTDELIVERFORYOU })
                } else {
                    // If the agent can help with the delivery, initiate a parcel sharing option.
                    const sharingOption = new ShareParcelsOption('parcels_sharing', msg.position, Infinity, this.agent, 'take')
                    await packet.reply(msg) // Send back the option to the teammate.
                    this.agent.intentions.push([sharingOption]) // Push the sharing option to the agent's intentions.
                    this.agent.intentions.stopCurrent() // Stop the current intention to prioritize the sharing option.
                }
                break

            case MessageType.ALIGNMENT_1: // Parcel sharing, teammate is adjacent to me.
                if (currentOpt.id === 'parcels_sharing'){
                    currentOpt.teammateReady = true
                    //console.log('Received first alignment', currentOpt.weAreAligned)
                }
                
                break
            case MessageType.PARCELS_LEFT: // Parcels sharing, teammate has dropped parcels and free the tile.
                //console.log('received al2:', packet, currentOpt.id)
                if (currentOpt.id === 'parcels_sharing'){
                    currentOpt.parcelsState = 'left'
                    //console.log('received second alignment', currentOpt.parcelsState)
                }
                break

            case MessageType.SHARINGCOMPLETE: // My teammate has taken the parcels that I left
                if (currentOpt.id === 'parcels_sharing'){
                    currentOpt.parcelsState = 'shared'
                    //console.log('received sharing complete', currentOpt.parcelsState)

                }
                break
            case MessageType.PARCELSHARINGINTERRUPTED: 
                
                if (currentOpt.id === 'parcels_sharing') {
                    //console.log('received sharing interrupted')
                    this.agent.intentions.stopCurrent()
                }
                break



            // USED WITH MOVE TYPE PDDL_1, NOT PDDL standard.

            /**
             * Handles a message indicating readiness for a multi-agent plan.
             * This message is used to coordinate the start of a multi-agent planning process between agents.
             */
            case MessageType.READYFORMULTIAGENTPLAN:
                // The agent checks if it is currently executing a multi-agent plan.
                if (this.agent.intentions.executingMultiagentPlan) {
                    // If currently executing a multiagent plan, respond with a negative acknowledgment.
                    await packet.reply({ type: MessageType.NOACK })
                } else {
                    if (this.team.imMaster) {
                        // For the master agent: Prepare a multi-agent option and stop the current intention to check for multiagent.
                        this.multiagentOption = new MultiAgentOption('multi', this.agent, this.team, 'master')
                        // If the current intention is 'patrolling', it is stopped to allow evaluation of the multi-agent plan.
                        //if (this.agent.intentions.currentIntention.option.id === 'patrolling') {
                            this.agent.intentions.stopCurrent()
                        //}
                    } else {
                        // For the slave agent: Check for sufficient options to proceed with multi-agent planning.
                        let masterOptionIds = packet.message.content // Options from the master.
                        let myOptionIds = Array.from(this.agent.intentions.rawOptionQueue().map(opt => opt.id)) // Slave's options.
                        let ids = new Set([...myOptionIds, ...masterOptionIds]) // Combine and deduplicate options.

                        // If the combined set of options from master and slave has 2 or more unique options, proceed.
                        if (ids.size >= 2) {
                            this.multiagentOption = new MultiAgentOption('multi', this.agent, this.team, 'slave')
                            this.multiagentOption.reply_masterConfirmation = packet.reply // Prepare to confirm ready to the master.
                            this.agent.intentions.stopCurrent() // Stop the current intention to evaluate the multi-agent plan and handshake with master.
                        } else {
                            // Insufficient options to proceed, respond with a negative acknowledgment.
                            await packet.reply({ type: MessageType.NOACK })
                        }
                    }
                }
                break

            /**
             * Handles a message from the slave to the master and store the reply anon function to send the new plan, when ready.
             */
            case MessageType.SENDNEWOPTIONHERE:
                // If a multi-agent option is set and awaiting a new option from the slave, save the reply object for response.
                if (this.multiagentOption && this.multiagentOption.reply_slaveNewOption === null) {
                    this.multiagentOption.reply_slaveNewOption = packet.reply
                }
                break

            /**
             * Handles a message indicating the end of the slave's part in the multi-agent plan.
             * This message allows the master to be informed when the slave has completed its actions, enabling the master to proceed accordingly.
             */
            case MessageType.ENDMULTIAGENTPLAN:
                // Reset the multiagent option to null. This indicate the slava availability for a new plan, but master may still executing it.
                // But in this way, when master ends current intention, immediately knows about slave availability.
                this.multiagentOption = null
                // If the master is not currently executing a multi-agent plan, stop the current intention to evaluate potential new plans.
                if (!this.agent.intentions.executingMultiagentPlan) {
                    this.agent.intentions.stopCurrent()
                }
                break
            default:
                console.log('Error. Packet not recognized. Message:\n', packet)
                process.exit(0)
        }
    }
  
    /**
     * Notifies the master that the slave has completed its part of the multi-agent plan.
     */
    async slaveEndsMultiagentPlan() {
        this.multiagentOption = null // Clear the current multi-agent option to indicate completion.
        const msg = { type: MessageType.ENDMULTIAGENTPLAN } // Prepare the message to signal plan completion.
        await this.agent.client.say(this.team.teammate.id, msg) // Send the completion message to the master.
    }


    /**
     * This function manage the slave's participation in the multi-agent planning process by sending its available options
     * to the master and awaiting the master's decision on the plan to execute.
     * 
     * @returns {Object} An object indicating the status of the plan reception and the plan details if successful.
     */
    async multiagentPlanForSlave() {
        const msg1 = {
            type: MessageType.ACK,
            content: this.agent.intentions.rawOptionQueue(), // Send the slave's current options for consideration.
            myPosition: this.agent.currentPosition // Include the slave's current position for spatial coordination.
        }
        const msg2 = { type: MessageType.SENDNEWOPTIONHERE } // Prepare to receive new plan details from the master.

        // Send the slave's options and position to the master and await the new plan assignment.
        this.multiagentOption.reply_masterConfirmation(msg1)
        const slaveTask = await this.agent.client.ask(this.team.teammate.id, msg2)

        // Check the master's response to determine if a viable plan was received.
        if (!slaveTask.status) {
            this.multiagentOption = null // Reset the multi-agent option on failure.
            return { status: false, option: null } // Indicate unsuccessful plan reception.
        }

        //console.log('Plan received:', slaveTask.option.plan.startPosition, slaveTask.option.startPosition, this.agent.currentPosition)
        return { status: true, option: slaveTask.option } // Return the successful plan details.
    }


    /**
     * Manages the multi-agent plan creation and distribution from master.
     * This function MANAGE the multi-agent planning process by collecting options from both master and slave,
     * computing a multiagent plan and distributing the respective parts of the plan to each agent.
     * 
     * @returns {Object} An object indicating the status of the plan computation and the master's part of the plan if successful.
     */
    async multiagentPlanForMaster() {
        this.multiagentOption = new MultiAgentOption('multi', this.agent, this.team, 'master') // Initialize the multi-agent option for the master.
    
        // Collect the master's current options for inclusion in the multi-agent planning process.
        const myOptions = this.agent.intentions.rawOptionQueue()
        const myOptionIds = new Set(myOptions.map(opt => opt.id))
    
        // Notify the slave that the master is ready for multi-agent planning and send the master's options.
        const msg1 = { type: MessageType.READYFORMULTIAGENTPLAN, content: Array.from(myOptionIds) }
        const reply1 = await this.agent.client.ask(this.team.teammate.id, msg1)
    
        // Handle the case where there are insufficient options to proceed with multi-agent planning.
        if (reply1.type === MessageType.NOACK) {
            this.multiagentOption = null // Reset the multi-agent option on failure.
            return { status: false, option: null } // Indicate unsuccessful plan creation.
        }
    
        // Update the slave's position based on the information received from the slave agent.
        const newPos = new Position(reply1.myPosition.x, reply1.myPosition.y)
        this.agent.players.updateTeammatePosition(this.team.teammate.id, newPos)
    
        // Collect the slave's options sent by the slave agent.
        const slaveOptions = reply1.content // Options received from the slave.
    
        // Await the slave's readiness to receive the computed part of the multi-agent plan.
        while (this.multiagentOption.reply_slaveNewOption === null) {
            await new Promise(resolve => setTimeout(resolve, 5))
        }
    
        // Compute the multi-agent plan using both master's and slave's options.
        const status = await this.multiagentOption.computeMultiagentPlan(myOptions, slaveOptions)
        if (!status) {
            // If the plan computation fails, notify the slave and reset the multi-agent option.
            await this.multiagentOption.reply_slaveNewOption({ status: false, option: null })
            this.multiagentOption = null
            return { status: false, option: null }
        }
    
        // Extract and log the computed plans for both master and slave.
        const slaveTask = { status: true, option: this.multiagentOption.newOptions.forSlave } // Slave's part of the plan.
        const masterTask = { status: true, option: this.multiagentOption.newOptions.forMaster } // Master's part of the plan.
        //console.log('Multiagent plan computed')
        //console.log('Master plan:', masterTask.option.id)
        //console.log('Slave plan:', slaveTask.option.id)
    
        // Distribute the slave's part of the plan and return the master's part for execution.
        await this.multiagentOption.reply_slaveNewOption(slaveTask)
        return masterTask
    }
}
