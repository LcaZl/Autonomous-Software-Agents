import readline from 'readline';
import { Agent } from './agent.js';
import fs from 'fs';
/**
 * This class manage the output for an agent. 
 * There are methods for:
 * - print the initial status of the agent when initialized
 * - print the final status when finalized
 * - print the status of the agent at any moment;
 * - print parcels, intentions, option and player;
 * - print the map;
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

  /**
   * Print the initialization info
   */
  info() {
      console.log('[INIT] Agent info:\n')
      console.log(' - ID: ', this.agentID)
      console.log(' - Name: ', this.name)
      console.log(' - Score: ', this.score)
      console.log(' - Initial Position: (', this.lastPosition.x, ',', this.lastPosition.y, ')')
      console.log(' - Server Deliveroo Connected: ', this.client.id != null)
      console.log(' - Token: ', this.client.token)
      console.log(' - Environment Configuration:')
      console.log(' - PARCEL_DECADING_INTERVAL:', this.PARCEL_DECADING_INTERVAL)
      for (const key in this.client.config) {
        if (this.client.config.hasOwnProperty(key)) {
          const value = this.client.config[key];
          console.log(' -- ',key, ': ', value);
        }
      }
      console.log(' - Environment Map (\'-\': Inactive cells, 1: Active spawner cells, 2: active delivery cells)\n')
      this.printMap(this.environment.fullMap)
      console.log('\n - Delivery Tiles',this.environment.deliveryTiles)
  }

  /**
   * Print info at any time
   */
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

  /**
   * Print final metrics
   */
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

    console.log(' - Search call', this.environment.searchCalls)
    console.log(' - Cache hits', this.cacheHit)
    console.log(' - Look ahead hits:', this.lookAheadHits)
    console.log(' - Fast pick moves:', this.fastPickMoves)
    console.log(' - Online solver calls:', this.onlineSolverCalls)
    if (this.multiagent){
      console.log(' - Team score: ', this.teamScore + this.score)
    }
    this.saveFinalMetrics()
    //console.log(' - Chached BFS paths (',this.environment.cache.size,'):\n', this.environment.cache)
  }


  saveFinalMetrics() {
      this.finishAt = new Date().getTime();
      let diff = this.finishAt - this.startedAt;

      // Creazione di un oggetto con le metriche
      const performanceData = {
          map: this.client.config.MAP_FILE,
          moveType : this.moveType,
          fastPick : this.fastPick,
          lookAHead : this.lookAhead,
          changingRisk : this.changingRisk,
          adjMovementCostWindow : this.adjMovementCostWindow,
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
          searchCalls: this.environment.searchCalls,
          cacheHits: this.cacheHit,
          lookAheadHits: this.lookAheadHits,
          fastPickMoves: this.fastPickMoves,
          onlineSolverCalls: this.onlineSolverCalls,
          teamScore: this.multiagent ? this.teamScore + this.score : undefined
      };

      const jsonData = JSON.stringify(performanceData, null, 2);
      const filePath = `./agentPerformance_${this.client.config.MAP_FILE}.json`;

      try {
          // Leggere il contenuto corrente del file
          let fileContent = fs.readFileSync(filePath, 'utf8');

          // Verifica se il file è vuoto e prepara il contenuto
          if (fileContent.trim() === '') {
              fileContent = '[' + jsonData; // Inizia un nuovo array
          } else {
              fileContent = fileContent.trim().slice(0, -1) + ',' + jsonData; // Rimuovi la parentesi quadra finale e aggiungi il nuovo oggetto
          }

          // Scrivere i dati aggiornati nel file
          fs.writeFileSync(filePath, fileContent + ']\n'); // Chiude l'array
      } catch (error) {
          // Gestisce errori di lettura/scrittura, ad es. se il file non esiste lo crea
          fs.writeFileSync(filePath, '[' + jsonData + ']\n');
      }
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