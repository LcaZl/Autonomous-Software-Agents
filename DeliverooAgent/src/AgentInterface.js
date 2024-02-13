import readline from 'readline'
import { Agent } from './agent.js'
import fs from 'fs'

/**
 * This class manage the output for an agent. 
 * There are methods for:
 * - print the initial status of the agent when initialized
 * - print the final status when finalized
 * - print the status of the agent at any moment
 * - print parcels, intentions, option and player
 * - print the map
 */
export class AgentInterface {
  constructor() {
    this.pickUpActions = 0
    this.deliveryActions = 0
    this.parcelsDelivered = 0
    this.parcelsPickedUp = 0
    this.initialScore = 0
    this.effectiveMovement = 0 // Total number of effective movements performed by the agent
    this.movementAttempts = 0 // Total number of movement attempts
    this.failMovement = 0 // Failed movement attempts
    this.score = 0 // Current score of the agent
    this.fastPickMoves = 0 // Movements made under the 'fast pick' strategy
    this.cacheHit = 0 // Cache hits for optimized computations
    this.searchCalls = 0 // BFS searches
    this.onlineSolverCalls = 0 // Calls to online solver
  }

  /**
   * Logs initialization information of the agent including basic configuration and the initial state.
   */
  info() {
    console.log('[INIT] Agent info:\n')
    console.log(' - ID:', this.agentID)
    console.log(' - Name:', this.name)
    console.log(' - Score:', this.score)
    console.log(' - Initial Position: (', this.lastPosition.x, ',', this.lastPosition.y, ')')
    console.log(' - Server Deliveroo Connected:', this.client.id != null)
    console.log(' - Token:', this.client.token)
    console.log(' - Environment Configuration:')
    console.log(' - PARCEL_DECADING_INTERVAL:', this.PARCEL_DECADING_INTERVAL)
    Object.entries(this.client.config).forEach(([key, value]) => console.log(' --', key, ':', value))
    console.log(' - Environment Map (\'-\': Inactive cells, 1: Active spawner cells, 2: active delivery cells)\n')
    this.printMap(this.environment.fullMap) // Print the map of the environment
    console.log('\n - Delivery Tiles', this.environment.deliveryTiles)
  }

  /**
   * Logs the current status of the agent including time elapsed, score, position, parcels carried, and intentions.
   */
  status() {
    console.log('|------------------------------------|')
    console.log('|            Agent status            |')
    console.log('|------------------------------------|')
    console.log('|- Elapsed time:', (new Date().getTime() - this.startedAt), 'ms')
    console.log('|- Current score:', this.score - this.initialScore)
    console.log('|- Current Position:', this.currentPosition)
    console.log('|- Parcels Carried:', this.parcels.carriedParcels())
    this.showParcels(this.parcels) // Display parcels details
    this.showPlayers(this.players.getPlayers()) // Display encountered players
    console.log('|- Current intention:', this.intentions.currentIntention.option.toString())
    this.showIntentions(Array.from(this.intentions.option_queue.values())) // Display the queue of intentions
    // Uncomment the following line to display PDDL representation of beliefs
    //if (this.moveType === 'PDDL' || this.moveType === 'PDDL_1') console.log(this.beliefs.toPddlString())
    console.log('|------------------------------------|')
    console.log('|                 END                |')
    console.log('|------------------------------------|')
  }


  /**
   * Logs final performance metrics of the agent and saves them to a file.
   */
  async finalMetrics() {
    this.finishAt = new Date().getTime()
    const diff = this.finishAt - this.startedAt
    console.log(`\n\nAgent ${this.name} (${this.agentID}) performance:`)
    
    // Construct performance data
    const performanceData = {
      map: this.client.config.MAP_FILE,
      multiagent: this.multiagent,
      moveType: this.moveType,
      fastPick: this.fastPick,
      changingRisk: this.changingRisk,
      adjMovementCostWindow: this.adjMovementCostWindow,
      agentName: this.name,
      agentID: this.agentID,
      activityTime: `${Math.floor(diff / 60000).toString().padStart(2, '0')}:${((diff % 60000) / 1000).toFixed(0).padStart(2, '0')} (${diff} ms)`,
      averageTimePerMove: diff / this.movementAttempts,
      initialScore: this.initialScore,
      finalScore: this.score,
      effectiveScore: this.score - this.initialScore,
      effectiveMovement: this.effectiveMovement,
      failedMovements: this.failMovement,
      pickUpActions: this.pickUpActions,
      deliveryActions: this.deliveryActions,
      parcelsDelivered: this.parcelsDelivered,
      searchCalls: this.searchCalls,
      cacheHits: this.cacheHit,
      onlineSolverCalls: this.onlineSolverCalls
    }

    // Add multiagent specific data if applicable
    if (this.multiagent) {
      performanceData.teamId = this.team.teamId
      performanceData.master = this.team.imMaster
    }

    console.log(performanceData)
    if (this.multiagent && this.team.imMaster) await new Promise(resolve => setTimeout(resolve, 3000))
    this.saveFinalMetrics(performanceData) // Save the metrics
  }

  /**
   * Saves the final performance metrics to a JSON file, creating or appending to existing files as necessary.
   * 
   * @param {Object} performanceData - The performance data to be saved.
   */
  saveFinalMetrics(performanceData) {
    const jsonData = JSON.stringify(performanceData, null, 2)
    const filePath = this.multiagent ? `./test/performance/multiagent/agentPerformance_${this.client.config.MAP_FILE}.json` : `./test/performance/agentPerformance_${this.client.config.MAP_FILE}.json`
    console.log('saving metrics')
    try {
      let fileContent = fs.readFileSync(filePath, 'utf8')
      fileContent = fileContent.trim() === '' ? '[' + jsonData : fileContent.trim().slice(0, -1) + ',' + jsonData
      fs.writeFileSync(filePath, fileContent + ']\n') // Close the JSON array
    } catch (error) {
      fs.writeFileSync(filePath, '[' + jsonData + ']\n')
    }
  }

  /**
   * Prints the environment map to the console with optional custom filler for empty cells.
   * 
   * @param {Array<Array>} map - The 2D array representing the environment map.
   * @param {string} [filler='-'] - Character used to fill empty spaces in the map.
   */
  printMap(map, filler = '-') {
    for (let y = map.length - 1; y >= 0; y--) {
      let row = ''
      for (let x = 0; x < map[y].length; x++) { // Ensure correct iteration over x-axis
        row += map[x][y] ? JSON.stringify(map[x][y]) : filler
        row += ' '
      }
      console.log('         ', row) // Consistent indentation
    }
  }


  /**
   * Logs the details of detected parcels to the console, including general count, individual parcel details,
   * owned parcels, and deleted parcels.
   * 
   * @param {ParcelsManager} parcels - The parcels manager containing parcels information.
   */
  showParcels(parcels) {
      console.log('|- Parcels detected:', parcels.getParcels().size)

      // Log details of each parcel if any
      if (parcels.getParcels().size > 0) {
          Array.from(parcels.getParcels(), ([id, parcel], index) => console.log('|--', index + 1, '-', parcel.toString()))
      }

      // Log owned and deleted parcels
      console.log('|-- My parcels:', parcels.myParcels.size === 0 ? 0 : [...parcels.myParcels].join(', '))
      console.log('|-- Deleted parcels:', parcels.deletedParcels.size === 0 ? 0 : [...parcels.deletedParcels].join(', '))
  }

  /**
   * Logs the last pushed options to the console.
   * 
   * @param {Array} options - The list of options to be displayed.
   */
  showOptions(options) {
      console.log('|- Last pushed options:', options ? options.length : 0)

      // Log details of each option if any
      if (options && options.length > 0) {
          options.forEach((opt, index) => console.log('|--', index + 1, '-', opt.toString()))
      }
  }

  /**
   * Logs the current intentions of the agent to the console.
   * 
   * @param {Intentions} intentions - The intentions object containing the agent's current intentions.
   */
  showIntentions(intentions) {
      console.log('|- Intentions:', intentions.length)

      // Log details of each intention if any
      intentions.forEach((intention, index) => console.log('|--', index + 1, '-', intention.toString()))
  }

  /**
   * Logs the encountered players to the console.
   * 
   * @param {Set<Player>} players - The set of players to be displayed.
   */
  showPlayers(players) {
      console.log('|- Player encountered:', players.size)

      // Log details of each player if any
      Array.from(players).forEach((player, index) => console.log('|--', index + 1, '-', player.toString()))
  }

  /**
   * Logs the agent's beliefs to the console, formatted for readability.
   * 
   * @param {Beliefs} beliefs - The beliefs object containing the agent's current beliefs.
   */
  showBeliefs(beliefs) {
      beliefs.entries.forEach((entry, index) => {
          // Start a new line every 10 beliefs for readability
          if (index % 10 === 0) {
              if (index > 0) console.log(string) // Print the accumulated line before resetting
              string = ''
          }
          string += `\t[${entry}]`
      })
      if (string) console.log(string) // Print any remaining beliefs
  }

}