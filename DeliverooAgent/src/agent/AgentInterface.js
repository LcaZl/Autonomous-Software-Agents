import { showParcels, showPlayers, showIntentions, printMap, showOptions } from '../utils/utils.js';
import readline from 'readline';
import { Agent } from './agent.js';

/**
 * @class
 */
export class AgentInterface{

  constructor() {
      this.startedAt = new Date().getTime()
  }

  // Console agent info
  agentInfo(agent) {

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
    printMap(this.environment.fullMap)
    console.log('\n - Delivery Tiles',this.environment.deliveryTiles)
  }

  status() {
      console.log('|------------------------------------|')
      console.log('|            Agent status            |')
      console.log('|------------------------------------|')
      console.log('|- Elapsed time:', (new Date().getTime() - this.startedAt), '/', this.duration,'ms')
      console.log('|- Current score:', this.score - this.initialScore)
      console.log('|- Current Position:', this.currentPosition)
      console.log('|- Parcels Carried:', this.parcels.carriedParcels())
      showParcels(this.parcels)
      showPlayers(this.players.getPlayers())
      showOptions(this.options.getOptions())
      console.log('|- Current intention:', this.intentions.currentIntention.option.toString())
      console.log('|------------------------------------|')
      console.log('|                 END                |')
      console.log('|------------------------------------|')
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
    console.log(' - Delivery performed:', this.deliveryActions, '\n')
    console.log(' - Delivered parcels:', this.parcelsDelivered)
    console.log(' - Exploration map:\n')
    printMap(this.environment.exploredTiles)
    console.log(' - Search call', this.environment.searchCall)
    console.log(' - Cache hits', this.environment.cacheHit)
    console.log(' - Chached BFS paths (',this.environment.cache.size,'):\n', this.environment.cache)
  }
}