import { Agent } from "../Agent.js"
import { ShareParcelsOption } from "../memory/reasoning/options/Option.js"

export const MessageType = {

    // Approval answers
    ACK : 'ok',
    NOACK : 'no_ok',

    // For synchronization
    SINCRO_0 : 'Sincronization_0',
    SINCRO_1 : 'Sincronization_1',
    SINCRO_2 : 'Sincronization_2',
    SET_MASTER : 'Im_the_master',

    // Information exchange
    UPDATE_PLAYERS: 'i_see_these_players',
    UPDATE_PARCELS: 'i_see_these_parcels',
    UPDATE_POSITION : 'my_new_position',
    PICKUP : 'pickedup_parcels',
    DELIVERY : 'delivered_parcels',

    // Parcel sharing
    IMPOSSIBLE_DELIVERY: 'i_cant_deliver',
    ICANTDELIVERFORYOU : 'i_cannot_deliver_too',
    ALIGNMENT_1 : 'im_in_position',
    PARCELS_LEFT : 'im_in_psition',
    PARCELSHARINGINTERRUPTED : 'parcels_sharing_interrupted',

    // Intention validation
    NEWINTENTION : 'my_new_intention',
    INTENTION_CONFIRMED : 'validated_intention',
    INTENTION_DECLINED : 'not_validated_intention',

    // Multiagent planning
    READYFORMULTIAGENTPLAN : 'im_ready_to_cooperate_if_necessary',
    MULTIAGENTPLAN_READY : 'here_the_new_plan',
    SENDNEWOPTIONHERE : 'slave_access_point',
    ENDMULTIAGENTPLAN : 'finished_assigned_plan',
    SHARINGCOMPLETE : 'sharing_completed_succesfully'
}

/**
 * Manages communication for an agent, handling message reception and synchronization within a teammate.
 */
export class Communication {
    /**
     * Initializes the communication system for an agent.
     * 
     * @param {Agent} agent - The agent
     */
    constructor(agent) {
        this.agent = agent
        this.team = this.agent.team // Reference to the agent's team
        this.sincroRequest = 0 // Counter for synchronization requests, used for master

        // Listen for messages and process them
        this.agent.client.onMsg(async (id, name, msg, reply) => {
            const packet = { id, name, message: msg, reply }

            // Filter or process the message based on team synchronization status
            if (this.team.synchronized) {
                this.filterMessage(packet) // Process message if the team is synchronized
            } else {
                this.synchronization(packet) // Handle synchronization process if not yet synchronized
            }
        })

        // Initiate synchronization process by broadcasting a sync message
        const msg = { type: MessageType.SINCRO_0 }
        this.agent.client.shout(msg)
    }

    /**
     * Handles the synchronization process with other agents in the team, based on received messages.
     * 
     * @param {Object} packet - The message packet received from another agent.
     */
    async synchronization(packet) {
        switch (packet.message.type) {
            case MessageType.SINCRO_0:
                // Handle initial synchronization message
                if (this.team.names.has(packet.name)) {
                    const msg = {
                        type: MessageType.SINCRO_1,
                        position: this.agent.currentPosition, // Sending current position for synchronization
                    }

                    // Request confirmation from the sender
                    const reply = await this.agent.client.ask(packet.id, msg)

                    if (reply.type === MessageType.SINCRO_2) {
                        // Confirmation received, add member to the team
                        this.team.addMember(reply.name, reply.id, reply.position)
                        this.sincroRequest += 1

                        // If all team members are synchronized, set the current agent as the master
                        if (this.sincroRequest === (this.team.size - 1)) {
                            this.team.setMaster(this.agent.agentID)
                            const masterMsg = {
                                type: MessageType.SET_MASTER,
                                teamId: this.team.teamId,
                            }
                            this.agent.client.say(this.team.teammate.id, masterMsg) // Inform the teammate
                        }
                    }
                    else throw new Error('Error with sincro_1 answer.')
                }
                break

            case MessageType.SINCRO_1:
                // Handle synchronization step 1 message
                if (this.team.names.has(packet.name)) {
                    // Add sender as a team member
                    this.team.addMember(packet.name, packet.id, packet.message.position)

                    // Reply with confirmation
                    const msg = {
                        type: MessageType.SINCRO_2,
                        id: this.agent.agentID,
                        name: this.agent.name,
                        position: this.agent.currentPosition,
                    }
                    packet.reply(msg)
                }
                break

            case MessageType.SET_MASTER:
                // Handle message to set the master agent in the team
                this.team.setMaster(packet.id)
                this.team.teamId = packet.message.teamId // Update team ID with the one provided by master
                break
        }
    }

     /**
     * Activates the communication handler by setting up event listeners for various internal events
     * that trigger comunications.
     */
     activate() {
        // Listen for new parcel information and communicate updates to the teammate
        this.agent.eventManager.on('new_parcels_info', () => {
            const parcels = this.agent.parcels.getRawParcels()
            if (parcels.length > 0) {
                const msg = {
                    type: MessageType.UPDATE_PARCELS,
                    content: parcels
                }
                this.agent.client.say(this.team.teammate.id, msg)
            }
        })

        // Listen for new player information and communicate updates to the teammate
        this.agent.eventManager.on('new_players_info', () => {
            const players = this.agent.players.getRawPlayers()
            if (players.length > 0) {
                const msg = {
                    type: MessageType.UPDATE_PLAYERS,
                    content: players
                }
                this.agent.client.say(this.team.teammate.id, msg)
            }
        })

        // Communicate parcel pickups to the teammate
        this.agent.eventManager.on('communicate_pickup', (ids) => {
            if (ids.length > 0) {
                const msg = {
                    type: MessageType.PICKUP,
                    content: ids
                }
                this.agent.client.say(this.team.teammate.id, msg)
            }
        })

        // Communicate parcel deliveries to the teammate
        this.agent.eventManager.on('communicate_delivery', (parcelIds) => {
            const msg = {
                type: MessageType.DELIVERY,
                content: parcelIds
            }
            parcelIds.forEach(id => this.team.parcelsDeliveredByTeam.add(id)) // Track parcels delivered by the team
            this.agent.client.say(this.team.teammate.id, msg)
        })

        // Communicate position updates to the teammate
        this.agent.eventManager.on('movement', () => {
            const msg = {
                type: MessageType.UPDATE_POSITION,
                content: this.agent.currentPosition
            }
            this.agent.client.say(this.team.teammate.id, msg)
        })
    }

    /**
     * Intention validation in team
     */
    async validateIntention(opt){
        if (!this.team.imMaster){

            const msg = {
                type : MessageType.NEWINTENTION,
                content : opt.raw()
            }

            const reply = await this.agent.client.ask(this.team.teammate.id, msg)
            if (reply.type === MessageType.INTENTION_CONFIRMED)
                return true
            return false
        }
        else{
            const status = this.team.validateMasterIntention(opt.raw())
            return status
        }
    }

    // PARCELS SHARING
    /**
     * Requests assistance from a teammate for completing a delivery when the agent is unable to reach a delivery tile.
     * 
     * @param {Object} opt - The delivery option that the agent is unable to complete on its own.
     * @returns {ShareParcelsOption|null} A new option for parcel sharing if the teammate agrees to assist, otherwise null.
     */
    async requestDeliverySharing(opt) {
        // Calculate utility ignoring obstacles to ensure to find the nearest delivery and related utility.
        opt.utilityWithoutObstacles = this.agent.options.utilityCalculator.deliveryUtility(opt.startPosition, true).value;

        // Prepare and send a message to the teammate to request assistance.
        const msg = { type: MessageType.IMPOSSIBLE_DELIVERY, content: opt };
        const reply = await this.agent.client.ask(this.team.teammate.id, msg);

        // If the teammate cannot assist, return null to indicate no cooperative option is available.
        if (reply.type === MessageType.ICANTDELIVERFORYOU) return null;

        // If the teammate can assist, create and return a new parcel sharing option.
        return new ShareParcelsOption('parcels_sharing', reply.position, Infinity, this.agent, 'leave');
    }


    /**
     * Initiates the first phase of alignment between the agent and its teammate, signaling readiness for parcel sharing movements.
     */
    firstAlignment() {
        // Send a message to the teammate to start the alignment process.
        const msg = { type: MessageType.ALIGNMENT_1 };
        this.agent.client.say(this.team.teammate.id, msg);
    }


    /**
     * Signals the completion of the parcel leaving phase in the sharing process, initiating the second phase of alignment.
     * This function is typically called by the agent in the 'leave' role after leaving the parcels for the 'take' role agent.
     * 
     * @param {Object} option - The parcel sharing option being executed, which will be updated to reflect the state change.
     */
    secondAlignment(option) {
        // Send a message to the teammate indicating that parcels have been left.
        const msg = { type: MessageType.PARCELS_LEFT };
        this.agent.client.say(this.team.teammate.id, msg);

        // Update the option state to 'left' to indicate parcels are ready for pickup by the teammate.
        option.parcelsState = 'left';
    }


    /**
     * Notifies the teammate that the parcel sharing process has been successfully completed.
     * This function is typically called by the agent in the 'take' role after picking up the shared parcels.
     */
    sharingComplete() {
        // Send a message to the teammate to signal the completion of the sharing process.
        const msg = { type: MessageType.SHARINGCOMPLETE };
        this.agent.client.say(this.team.teammate.id, msg);
    }

    
    /**
     * Notifies the teammate that the parcel sharing process has been interrupted or cannot proceed as planned.
     * This function is used to inform the teammate of any disruptions that may affect the coordinated sharing effort.
     */
    parcelSharingInterrupted() {
        // Send a message to the teammate to indicate an interruption in the sharing process.
        const msg = { type: MessageType.PARCELSHARINGINTERRUPTED };
        this.agent.client.say(this.team.teammate.id, msg);
    }

}
