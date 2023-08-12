#!/usr/bin/env node

import { DeliverooAgent } from "./deliverooAgent.js";
import { showParcels, showPlayers, agentInfo } from '../utils.js';

/**
 * @class
 * @extends {DeliverooAgent}
 * Class representing a specific type of agent. Extend the class DeliverooAgent.
 * The extended class contains basic functions for the agent. 
 * This class is intended to be used as "main agent".
 * This class is initialized, then the sensing is enabled and the is possible to activate the 
 * main reasoning loop.
 */

export class Agent extends DeliverooAgent{

  /**
   * Create a new Agent using DeliverooAgent functionalities.
   * 
   * @constructor
   * @param {string} host - The host for the agent.
   * @param {string} token - The token for the agent.
   */
  constructor(host, token) {
    super(host, token)
  }

  /**
   * Initialize the agent.
   * @async
   * @return {Promise<boolean>} - The promise to be fulfilled with boolean, true if initialized, false otherwise.
   */
  async init() { 
    // Perform superclass initialization
    const init1 = await super.initialization()

    // If successful, show agent info
    if (init1) agentInfo(this)

    // Activate sensing on agent and store result
    let init2 = await this.activateSensing()
    
    // Return true only if both initialization and sensing activation are successful
    return init1 && init2
  }

  /**
   * Start the agent loop.
   * @async
   */
  async agentLoop() {
    // Initialize the count and parcelToPickup variables
    var count = 1
    var parcelToPickup = null

    while (count < 5) {
      // Get available directions and choose a random direction
      let directions = await this.getEnvironment().getAvailbleDirections()
      let random = Math.floor(Math.random() * directions.length)
      let direction = directions.at(random)
      
      // Log the move attempt
      console.log('\n[AGENT][MOVE',count,'][', direction, '][Carried Parcels:', this.myParcels,'][Score; ',this.score,']')

      // Attempt to move the agent in the selected direction
      let move = await this.agentMoving(direction)

      this.brain.update('all_beliefs')
      console.log(this.brain.beliefs.toPddlString())
      console.log(this.brain.beliefs.objects)

      // If the move was successful, log the new position or the blocked direction
      if (move != false ){
        console.log('[AGENT][MOVE',count,'] Moved', direction, '- New Position', this.currentPosition, ' - From', this.lastPosition)
      }
      else {
        console.log('[AGENT][MOVE', count, '] Not Moved,', this.lastDirection, '(blocked)')
      }

      // Display memory status
      console.log('[AGENT] Memory Status:')
      showParcels(this.getEnvironment().getParcels())
      showPlayers(this.getEnvironment().getPlayers())

      for (let parcel of this.getEnvironment().getParcels().getValues()) {
        if (!this.carriedParcels.has(parcel.id) && parcel.position.x == this.currentPosition.x && parcel.position.y == this.currentPosition.y) {          console.log('[PARCEL] On parcel')
          await this.client.pickup().then(() => {

            this.myParcels += 1
            this.carriedParcels.add(parcel.id)
            console.log('[AGENT][PARCEL] Picked Up Parcel', parcelToPickup, 'Taken - Parcel on my head: ', this.myParcels)
          })
        }
      }

      if (this.myParcels > 0 && this.getEnvironment().onDeliveryTile()){
        var putDown = this.client.putdown() 
        await putDown.then((droppedParcels) => console.log('[AGENT][PARCEL] Dropped Parcels ', this.carriedParcels))
        this.myParcels = 0
        this.carriedParcels = new Set()
      }
      console.log('[AGENT][ END MOVE',count,']')
      count++
    }
  }
}
