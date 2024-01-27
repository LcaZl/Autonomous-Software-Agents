#!/usr/bin/env node
import { Beliefset} from "@unitn-asa/pddl-client";
import { Agent } from "../../agent.js";
/**
 * The Beliefs class represents the beliefs of an agent.
 * It inherits from the Beliefset class.
 */
let positionUpdate = 0; 

export class Beliefs extends Beliefset {

  /**
  * @param {Agent} agent - The agent that this Beliefs object is associated with
  */
  constructor(agent) {
    super()
    this.agent = agent
    this.declareAgent(this.agent.agentID, this.agent.currentPosition)
    this.initMap()
    console.log('[INIT] Agent beliefs initialized.')
  }

  /**
   * Activate the managment of the notification
   */
  activate(){
    this.agent.eventManager.on('update_parcels_beliefs', () => this.updateParcels())
    this.agent.eventManager.on('update_players_beliefs', () => this.updatePlayers())
    this.agent.eventManager.on('deleted_parcel', (id) => this.deleteParcel(id))
    this.agent.eventManager.on('movement', () => this.updateMyPosition())
  }

  /**
   * Declare the belief about the agent.
  */
  declareAgent(agentID, position) {
    this.removeObject(`${agentID}`)
    this.addObject(`${agentID}`)
    this.declare(`me ${agentID}`)
    this.declare(`at ${agentID} t${position.x}_${position.y}`)
  }

  /**
   * Updates belief of agent position
  */
  updateMyPosition() {
    positionUpdate += 1; 
    //this.agent.log('[BELIEFSET] My position updated.')
    this.declareAgent(this.agent.agentID, this.agent.currentPosition)
    if(this.agent.multiagent){ 
      if(positionUpdate % 5 === 0){
        if(!this.agent.team.MASTER){
          this.agent.communication.positionUpdate(this.agent.currentPosition)
        } else {
          let id = this.agent.communication.standardizeId(this.agent.agentID)
          this.agent.communication.updateAgentPosition(id, this.agent.currentPosition)
        }
      } 
    }
  }

 /**
   * Removes a parcel from the belief set.
   * 
   * @param {string} id - The ID of the parcel to be removed.
   */
 deleteParcel(id) {
  this.removeObject(id);
}

  /**
   * Updates beliefs about other players
  */
  updatePlayers() {
    //this.agent.log('[BELIEFSET] Players informations updated.')
    for (let player of this.agent.players.getPlayers().values()) {
      if (!player.isLost()) {
        this.addObject(`${player.id}`)
        this.removeFact(`at ${player.id} t${player.getLastPosition().x}_${player.getLastPosition().y}`)
        this.declare(`at ${player.id} t${player.getCurrentPosition().x}_${player.getCurrentPosition().y}`);
        
        let fact = `at ${player.id} t${player.getCurrentPosition().x}_${player.getCurrentPosition().y}`
        if(this.agent.multiagent)
          this.agent.communication.updatePlayerBeliefSet(player.id, fact, "add")
      }
      else {
        this.removeObject(`${player.id}`)
        // I'm not removing player from shared-belief-set because i'm likely
        // interfering with other players beliefs.
       }
    }
  }

  /**
   * Updates beliefs about parcels.
  */
  updateParcels() {
    //this.agent.log('[BELIEFSET] Parcels information updated.')
    for (let [id, parcel] of this.agent.parcels.getParcels()) {
      if (parcel.isMine()) {
        this.removeFact(`at ${parcel.id} t${parcel.x}_${parcel.y}`)
        if(this.agent.multiagent)
          this.agent.communication.updateParcelBeliefSet(parcel.id, `at ${parcel.id} t${parcel.x}_${parcel.y}`, "remove")
      
        this.declare(`carries ${this.agent.agentID} ${parcel.id}`)
        // send fact to Master 
        let fact = `carries ${this.agent.agentID} ${parcel.id}` 
        if(this.agent.multiagent)
          this.agent.communication.updateParcelBeliefSet(parcel.id, fact, "add")
        
      }
      else if (parcel.isTaken()) {
        this.removeObject(parcel.id)
        if(this.agent.multiagent)
          this.agent.communication.updateParcelBeliefSet(parcel.id, "fact", "remove")      
      }
      else if (!this.objects.includes(parcel.id)) {
        this.addObject(`${parcel.id}`);
        this.declare(`at ${parcel.id} t${parcel.position.x}_${parcel.position.y}`);

        // send fact to Master 
        let fact = `at ${parcel.id} t${parcel.position.x}_${parcel.position.y}` 
        if(this.agent.multiagent)
          this.agent.communication.updateParcelBeliefSet(parcel.id, fact, "add")
      }
    }
  }

  /**
   * Dynamically builds the PDDL problem, returning each object with its corresponding type.
   * 
   * @returns {string} A string representation of objects with their types.
   */
  getObjectsWithType() {
    let objCopy = [];
    for (let obj of this.objects) {
      let type = 'unknown';
      if (obj === this.agent.agentID) {
        type = 'agent';
      } else {
        switch (obj[0]) {
          case 'a': type = 'agent'; break;
          case 'p': type = 'parcel'; break;
          case 't': type = 'tile'; break;
          default: 
            console.log(obj)
            console.log(this.toPddlString())
            process.exit(0)
        }
      }
      objCopy.push(`${obj} - ${type}`);
    }
    return objCopy.join(' ');
  }

  /**
   * Initializes the map in the belief set. 
   * This function is used to generate the PDDL constraint that depend on the map.
   * It consider the type and available movement for each tile of the map.
   * Here is not considered the presence of other players.
  */
  initMap() {
    let map = this.agent.environment.fullMap
    for (let i = 0; i < this.agent.environment.mapHeight; i++) {
      for (let j = 0; j < this.agent.environment.mapWidth; j++) {
        const cell = map[i][j]
        if (cell != 0) {
          this.addObject(`t${i}_${j}`)
          this.declare(`active t${i}_${j}`);
          if (cell == 2) {
            this.declare(`deliveryTile t${i}_${j}`);
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
            this.declare(`down t${i}_${j} t${i}_${j - 1}`);
            this.declare(`up t${i}_${j - 1} t${i}_${j}`); // Inverse
          }
          if ((j < this.agent.environment.mapHeight - 1) && map[i][j + 1] != 0) {
            this.declare(`up t${i}_${j} t${i}_${j + 1}`);
            this.declare(`down t${i}_${j + 1} t${i}_${j}`); // Inverse
          }
          if (i > 0 && map[i - 1][j] != 0) {
            this.declare(`left t${i}_${j} t${i - 1}_${j}`);
            this.declare(`right t${i - 1}_${j} t${i}_${j}`); // Inverse
          }
          if ((i < this.agent.environment.mapWidth - 1) && map[i + 1][j] != 0) {
            this.declare(`right t${i}_${j} t${i + 1}_${j}`);
            this.declare(`left t${i + 1}_${j} t${i}_${j}`); // Inverse
          }
        }
      }
    }
  }


}