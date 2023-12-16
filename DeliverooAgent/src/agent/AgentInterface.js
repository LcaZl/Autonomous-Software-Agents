import readline from 'readline';
import { Agent } from './agent.js';

/**
 * @class
 */
export class AgentInterface{

  constructor() {
      this.startedAt = new Date().getTime()
      this.pickUpActions = 0
      this.deliveryActions = 0
      this.parcelsDelivered = 0
      this.parcelsPickedUp = 0
      this.initialScore = 0
      this.effectiveMovement = 0 // total number of effective movement performed by the agent
      this.movementAttempts = 0 // Total number of movement attempts
      this.failMovement = 0
      this.score = 0
      this.lookAheadHits = 0
      this.fastPickMoves = 0
      this.cacheHit = 0
      this.onlineSolverCalls = 0
      this.consoleActivated = false

  }

  log(message){
    if (this.consoleActivated)
      console.log(message)
  }
  /**
   * Prints the map of the environment.
   * @param {Environment} environment - The environment object.
   * @param {string} [filler='-'] - The filler character for the map printout.
  */
  printMap(map, filler = '-') {
    for (let y = map.length - 1; y >= 0; y--) {
      let row = '';
      for (let x = 0; x < map.length; x++) {
        row += map[x][y] ? JSON.stringify(map[x][y]) : filler;
        row += ' ';
      }
      console.log('         ',row);
    }
  }

  // Console agent info
  info() {
      console.log('[INIT] Agent info:\n')
      console.log(' - ID: ', this.agentID)
      console.log(' - Name: ', this.name)
      console.log(' - Score: ', this.score)
      console.log(' - Initial Position: (', this.lastPosition.x, ',', this.lastPosition.y, ')')
      console.log(' - Server Deliveroo Connected: ', this.client.id != null)
      console.log(' - Token: ', this.client.token)
      console.log(' - Environment Configuration:')
      for (const key in this.client.config) {
        if (this.client.config.hasOwnProperty(key)) {
          const value = this.client.config[key];
          console.log(' -- ',key, ': ', value);
        }
      }
      console.log(' - Environment Map (\'-\': Inactive cells, 1: Active spawner cells, 2: active delivery cells)\n')
      this.printMap(this.environment.fullMap)
      console.log('\n - Delivery Tiles',this.environment.deliveryTiles)
      console.log(' - PARCEL_DECADING_INTERVAL:', this.PARCEL_DECADING_INTERVAL)
  }

  status() {
    if(this.consoleActivated){
      console.log('|------------------------------------|')
      console.log('|            Agent status            |')
      console.log('|------------------------------------|')
      console.log('|- Elapsed time:', (new Date().getTime() - this.startedAt), '/', this.duration,'ms')
      console.log('|- Current score:', this.score - this.initialScore)
      console.log('|- Current Position:', this.currentPosition)
      console.log('|- Parcels Carried:', this.parcels.carriedParcels())
      this.showParcels(this.parcels)
      this.showPlayers(this.players.getPlayers())
      this.showOptions(this.options.getOptions())
      console.log('|- Current intention:', this.intentions.currentIntention.option.toString())
      this.showIntentions(this.intentions.intention_queue.valuesWithPriority())
      console.log('|------------------------------------|')
      console.log('|                 END                |')
      console.log('|------------------------------------|')
  }
}

  finalMetrics() {
    this.finishAt = new Date().getTime()
    let diff = this.finishAt - this.startedAt;
    console.log('\n\nAgent',this.name,' (', this.agentID,') performance:')
    console.log(` - Activity time: ${Math.floor(diff / 60000).toString().padStart(2, '0')}:${((diff % 60000) / 1000).toFixed(0).padStart(2, '0')} (${diff} ms)`);        
    console.log(' - Average Time/Move: ', diff / this.movementAttempts)
    console.log(' - Initial score:', this.initialScore)
    console.log(' - Final score:',this.score)
    console.log(' - Effective Score:', this.score - this.initialScore)
    console.log(' - Moves effectively performed:', this.effectiveMovement)
    console.log(' - Failed movements:', this.failMovement)
    console.log(' - Pick up performed:', this.pickUpActions)
    console.log(' - Delivery performed:', this.deliveryActions)
    console.log(' - Delivered parcels:', this.parcelsDelivered)
    console.log(' - Exploration map:\n')
    this.printMap(this.environment.exploredTiles)
    console.log(' - Search call', this.environment.searchCalls)
    console.log(' - Cache hits', this.cacheHit)
    console.log(' - Look ahead hits:', this.lookAheadHits)
    console.log(' - Fast pick moves:', this.fastPickMoves)
    console.log(' - Online solver calls:', this.onlineSolverCalls)
    console.log(' - Team score: ', this.teamScore + this.score)
    //console.log(' - Chached BFS paths (',this.environment.cache.size,'):\n', this.environment.cache)
  }

    /**
   * @param {ParcelsManager} parcels - The parcels object to be displayed.
   */
  showParcels(parcels) {
      console.log('|- Parcels detected: ', parcels.getParcels().size)
      
      if (parcels.getParcels().size > 0){
        let i = 1
        for (let [id, parcel] of parcels.getParcels()){
          console.log('|-- ',i,'-', parcel.toString())
          i++
        }
      }

      console.log('|-- My parcels:', parcels.myParcels.size == 0 ? 0 : [...parcels.myParcels].join(', '));
      console.log('|-- Deleted parcels:', parcels.deletedParcels.size == 0 ? 0 : [...parcels.deletedParcels].join(', '));
  }

  /**
   * @param {Array} options 
   */
  showOptions(options){
      console.log('|- Last pushed options: ', options ? options.length : 0)
      if (options && options.length > 0){
        let i = 1
        for (let opt of options){
          console.log('|-- ',i,'-', opt.toString())
          i++
        }
      }
  }

  /**
   * @param {Intentions} intentions 
   */
  showIntentions(intentions){
      console.log('|- Intentions: ', intentions.length)
      if (intentions.length > 0){
        let i = 1

        for (let o of intentions) {
          console.log('|--',i, '- ',o.priority,' -', o.data.toString())
          i++
        }
      }
    
  }


  /**  
   * @param {Array<Player>} players - The players object to be displayed.
  */
  showPlayers(players) {
      console.log('|- Player encountered: ', players.size)
      if(players.size > 0){
        let i = 1
        for (let p of players) {
          let str = p.toString()
          console.log('|--',i, '-', p.toString())
          i++
        }
      }
  }


  /**
   * @param {Beliefs}
  */
 showBeliefs(beliefs){
      let count = 1
      let string = ''
      for (let v of beliefs.entries){
        if (count % 11 == 0){
          console.log(string)
          string = ''
        }
        string += '\t['+v+']'
        count++
      }
    }
}