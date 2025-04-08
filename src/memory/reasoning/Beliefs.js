#!/usr/bin/env node
import { Beliefset} from "@unitn-asa/pddl-client"
import { Agent } from "../../agent.js"

/**
 * Represents the beliefs of an agent, encapsulating the agent's current knowledge or state.
 * This class extends `Beliefset` to include agent-specific beliefs, such as its position and team member positions.
 */
export class Beliefs extends Beliefset {

  /**
   * Initializes the beliefs associated with a given agent, including its position and, if applicable, its team members' positions.
   * 
   * @param {Agent} agent - The agent whose beliefs are being represented.
   */
  constructor(agent) {
    super()
    this.agent = agent // Reference to the associated agent
    this.positionUpdate = 0 // Counter for position updates

    // Declare initial beliefs about the agent's identity and position
    this.declare(`me a${agent.agentID}`)
    this.declare(`at a${agent.agentID} t${agent.currentPosition.x}_${agent.currentPosition.y}`)
    this.initMap() // Initialize the map representation within the beliefs

    // If the agent is part of a multi-agent system, declare beliefs about team members
    if (agent.multiagent) {
      const playerObj = agent.team.playerObj
      this.declare(`me a${playerObj.id}`)
      this.declare(`at a${playerObj.id} t${playerObj.currentPosition.x}_${playerObj.currentPosition.y}`)
    }

    console.log('[INIT] Agent beliefs initialized.')
  }

  /**
   * Subscribes to various agent events to update beliefs dynamically as the environment or agent state changes.
   */
  activate() {
    // Listen for updates to parcel and player beliefs and deletions of parcels
    this.agent.eventManager.on('update_parcels_beliefs', () => this.updateParcels())
    this.agent.eventManager.on('update_players_beliefs', () => this.updatePlayers())
    this.agent.eventManager.on('deleted_parcel', (id) => this.removeAllObjectReferences(id))
    this.agent.eventManager.on('movement', () => this.updateMyPosition())
  }

  /**
   * Updates the belief about the agent's current position, removing old position facts and declaring the new position.
   */
  updateMyPosition() {
    for (let entry of this.entries){
      if (entry[0].startsWith(`at a${this.agent.agentID}`))
        this.removeFact(entry[0])
    }
    this.declare(`at a${this.agent.agentID} t${this.agent.currentPosition.x}_${this.agent.currentPosition.y}`)
  }

  /**
   * Updates the belief about a teammate's position by removing old beliefs and declaring the new position.
   * 
   * @param {string} id - The identifier of the teammate whose position is being updated.
   * @param {Position} newPos - The new position of the teammate.
   */
  updateTeammatePosition(id, newPos) {
    for (let entry of this.entries){
      if (entry[0].startsWith(`at a${id}`))
        this.removeFact(entry[0])
    }
    this.declare(`at a${id} t${newPos.x}_${newPos.y}`)
  }

  /**
   * Updates beliefs about the positions of other players in the environment.
   * Skips teammates in a multi-agent setting to avoid redundant updates.
   */
  updatePlayers() {
    // Iterate over all players obtained from the agent's player manager
    for (let player of this.agent.players.getPlayers().values()) {
      let playerId = player.id[0] === 'a' ? player.id : 'a'+player.id

      // Skip updating beliefs for teammates in multi-agent scenarios
      if (this.agent.multiagent && player.teammate) continue

      // Construct the belief fact for the player's position
      const fact = `at ${playerId} t${player.getCurrentPosition().x}_${player.getCurrentPosition().y}`

      // If the player is not lost, update the belief with the current position
      if (!player.isLost()) {
        this.removeFact(fact) // Remove the old fact
        this.declare(fact) 
        // If the player is lost, remove the fact representing their last known position
        this.removeFact(fact)
      }
    }
  }

  /**
   * Updates beliefs about the status and positions of parcels in the environment.
   * This includes parcels that are not yet taken, parcels currently carried by an agent,
   * and parcels that are owned by the agent itself.
   */
  updateParcels() {
    // Iterate over all parcels obtained from the agent's parcel manager
    for (let [id, parcel] of this.agent.parcels.getParcels()) {
      this.addObject(parcel.id) // Ensure the parcel is added to the belief set

      const positionFact = `at ${parcel.id} t${parcel.position.x}_${parcel.position.y}`

      if (parcel.isMine()) {
        // If the parcel is owned by the agent, update the belief to reflect that the agent is carrying the parcel
        this.removeFact(positionFact) // Remove the fact representing the parcel's position
        const carriesFact = `carries a${this.agent.agentID} ${parcel.id}`
        this.declare(carriesFact) // Declare the new fact that the agent carries the parcel
      } else if (parcel.isTaken()) {
        // If the parcel is taken (by any agent), update the belief to reflect who is carrying it
        let carriedBy = parcel.carriedBy.startsWith('a') ? parcel.carriedBy : 'a' + parcel.carriedBy
        this.removeFact(positionFact) // Remove the fact representing the parcel's position
        const carriesFact = `carries ${carriedBy} ${parcel.id}`
        this.declare(carriesFact) // Declare the new fact that some agent carries the parcel
      } else {
        // If the parcel is not taken, simply declare its position
        this.declare(positionFact) // Declare the fact representing the parcel's current position
      }
    }
  }

  /**
   * Constructs a PDDL representation of all objects in the belief set, assigning each object a type.
   * Agents are marked as 'agent', parcels as 'parcel' and tiles as 'tile'. Defaults to 'unknown' if no type matches.
   * 
   * @returns {string} A string containing all objects with their associated PDDL types, separated by spaces.
   */
  getObjectsWithType() {
    return this.objects.map(obj => {
      let type
      // Determine the type based on the object identifier
      if (obj.startsWith('a')) {
        type = 'agent'
      } else if (obj.startsWith('p')) {
        type = 'parcel'
      } else if (obj.startsWith('t')) {
        type = 'tile'
      } else {
        type = 'unknown'
      }
      return `${obj} - ${type}`
    }).join(' ')
  }

/**
 * Initializes the map representation in the belief set for PDDL planning, marking active tiles and deliveries.
 * Also, it establishes adjacent relations between accessible tiles to define possible movements.
 */
  initMap() {
    let map = this.agent.environment.fullMap
    for (let i = 0; i < this.agent.environment.mapHeight; i++) {
      for (let j = 0; j < this.agent.environment.mapWidth; j++) {
        const cell = map[i][j]
        if (cell != 0) {
          this.addObject(`t${i}_${j}`)
          this.declare(`active t${i}_${j}`)
          if (cell == 2) {
            this.declare(`deliveryTile t${i}_${j}`)
          }
        }
      }
    }

    for (let i = 0; i < this.agent.environment.mapHeight; i++) {
      for (let j = 0; j < this.agent.environment.mapWidth; j++) {
        const cell = map[i][j]
        if (cell != 0) {
          // declare relations between cells
          if (j > 0 && map[i][j - 1] != 0) {
            this.declare(`down t${i}_${j} t${i}_${j - 1}`)
            this.declare(`up t${i}_${j - 1} t${i}_${j}`) // Inverse
          }
          if ((j < this.agent.environment.mapHeight - 1) && map[i][j + 1] != 0) {
            this.declare(`up t${i}_${j} t${i}_${j + 1}`)
            this.declare(`down t${i}_${j + 1} t${i}_${j}`) // Inverse
          }
          if (i > 0 && map[i - 1][j] != 0) {
            this.declare(`left t${i}_${j} t${i - 1}_${j}`)
            this.declare(`right t${i - 1}_${j} t${i}_${j}`)// Inverse
          }
          if ((i < this.agent.environment.mapWidth - 1) && map[i + 1][j] != 0) {
            this.declare(`right t${i}_${j} t${i + 1}_${j}`)
            this.declare(`left t${i + 1}_${j} t${i}_${j}`) // Inverse
          }
        }
      }
    }
  }
}