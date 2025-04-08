import { Player } from "../Environment/players/player.js"
import { Position } from "../utils/Position.js"
import { MessageType } from "./Communication.js"

/**
 * 
 * This class is used to support the communication between the agent.
 */
export class TeamManager {
  /**
   * Constructs a TeamManager instance
   * 
   * @param {Agent} agent 
   * @param {Object} config - Configuration object for the team.
   */
  constructor(agent, config) {
      this.agent = agent // The agent associated with this team manager.
      const rnd = Math.floor(Math.random() * 10000) + 1 // Generate a random number for unique team ID.
      this.teamId = `${config.teamName}_${rnd}` // Construct a unique team ID using team name and random number.
      this.names = config.teamNames // Set of team member names.
      this.size = config.teamSize // Size of the team.
      this.synchronized = false // Flag to indicate whether the team is synchronized.
      this.parcelsDeliveredByTeam = new Set() // Set to track parcels delivered by the team.
      this.teammate = null // Object to hold teammate information.
      this.master = null // ID of the team master or leader.
      this.imMaster = false // Flag to indicate whether the current agent is the team master.
  }

  /**
   * Adds a member to the team based on provided information.
   * 
   * @param {string} name - The name of the team member.
   * @param {string} id - The ID of the team member.
   * @param {Position} position - The initial position of the team member.
   */
  addMember(name, id, position) {
      // Create a new Player object for the team member with the specified information.
      this.playerObj = new Player(this.agent, {
          id: id,
          name: name,
          x: position.x,
          y: position.y,
          score: 0
      }, true) // The 'true' flag indicates that this player is a teammate at PlayersManager.

      // Set up the teammate object with relevant information.
      this.teammate = {
          id: id,
          carriedParcels: new Set(), // Set to track parcels currently carried by the teammate.
          deliveredParcels: new Set(), // Set to track parcels delivered by the teammate.
          intention: null // Current intention or goal of the teammate.
      }

      console.log('[TEAM] Adding member:', this.teammate)
  }

  /**
   * Sets the master (leader) of the team and marks the team as synchronized.
   * 
   * @param {string} id - The ID of the agent to be set as the team master.
   */
  setMaster(id) {
      this.master = id // Set the master ID.
      this.synchronized = true // Mark the team as synchronized.
      this.imMaster = this.master === this.agent.agentID // Check if the current agent is the master.
  }


  /**
   * Validates the intention of a team member to ensure it aligns with the team's goals and current actions.
   * 
   * @param {Object} opt - The intention option submitted for validation.
   * @returns {Object} A message object indicating whether the intention is confirmed or declined.
   */
  validateTeamMemberIntention(opt) {
    // Patrolling and delivery intentions are generally confirmed without conflict.
    if (opt.id === 'patrolling' || opt.id.endsWith('delivery')) return {type: MessageType.INTENTION_CONFIRMED}

    const myIntention = this.agent.intentions.currentIntention.option.id

    // Decline if the intention matches the agent's current intention.
    if (opt.id === myIntention) return {type: MessageType.INTENTION_DECLINED}

    const pId = opt.parcelId

    // Decline if the parcel is already delivered by the team or is currently carried by the agent.
    if (this.parcelsDeliveredByTeam.has(pId) || this.agent.parcels.myParcels.has(pId)) {
        return {type: MessageType.INTENTION_DECLINED}
    }

    // Otherwise, confirm the intention and update the teammate's intention.
    this.teammate.intention = opt.id
    return {type: MessageType.INTENTION_CONFIRMED}
}


/**
 * Validates the master agent's intention, ensuring it does not conflict with the team's current state.
 * 
 * @param {Object} opt - The master's intention option to be validated.
 * @returns {boolean} True if the intention is valid, false otherwise.
 */
validateMasterIntention(opt) {
  // Automatically validate patrolling or delivery intentions.
  if (opt.id === 'patrolling' || opt.id.endsWith('delivery')) return true

  // Not validate the intention if it matches the teammate's current intention.
  if (this.teammate.intention === opt.id) return false

  const pId = opt.parcelId

  // Invalidate the intention if the parcel has been delivered or is carried by the teammate.
  if (this.parcelsDeliveredByTeam.has(pId) || this.teammate.carriedParcels.has(pId)) return false

  // Confirm the intention as valid.
  return true
}



/**
 * Logs a summary of the team's current state.
 */
toString() {
  console.log(' - Team id:', this.teamId)
  console.log(' - Team master:', this.master)
  console.log(' - Team imMaster:', this.imMaster)
  console.log(' - Team sincro:', this.synchronized)
  console.log(' - Teammate:', this.teammate)
}


/**
 * Determines whether the agent can assist a teammate with delivering a parcel based on utility comparison and meeting point feasibility.
 * 
 * @param {Object} opt - The delivery option needing assistance.
 * @returns {Object|null} A message object with the meeting point if assistance is possible, null otherwise.
 */
deliverForTeammate(opt) {
  const currentUtility = this.agent.intentions.currentIntention.option.utility

  // Decline to help if the current action's utility is higher than the potential utility from helping.
  if (currentUtility > opt.utilityWithoutObstacles) return null

  const teammatePosition = this.agent.players.getPlayers().get(this.teammate.id).currentPosition
  const myPosition = this.agent.currentPosition

  // Calculate a meeting point between the agent and the teammate.
  const midPosition = this.agent.environment.findMidpointBidirectional(myPosition, teammatePosition)

  // If no feasible meeting point is found, decline to help.
  if (midPosition == null) return null

  // Return the meeting point information if the agent can assist.
  return { type: MessageType.DELIVERFORYOU_0, position: midPosition.position }
}

}