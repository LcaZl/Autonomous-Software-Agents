import { ShareParcelsOption } from "../memory/reasoning/options/Option.js"
import { Position } from "../utils/Position.js"
import { Communication, MessageType } from "./Communication.js"

export class CommunicationWithBFS extends Communication {
    /**
     * Constructs a specific communication handler for the agent, when using BFS strategy.
     * 
     * @param {Agent} agent - The agent
     */
    constructor(agent) {
        super(agent)
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
                    await packet.reply(msg) // Send back the option position to the teammate.
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

            default:
                // Log an error for message error.
                console.log('Error. Packet not recognized. Message:\n', packet)
                process.exit(0)
        }
    }

}

