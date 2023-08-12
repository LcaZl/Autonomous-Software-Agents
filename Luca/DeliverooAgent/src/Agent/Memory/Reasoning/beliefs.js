#!/usr/bin/env node
import { onlineSolver, PddlExecutor, PddlProblem, Beliefset, PddlDomain, PddlAction } from "@unitn-asa/pddl-client";
import { showBeliefs } from "../../../utils.js";

/**
 * The Beliefs class represents the beliefs of an agent.
 * It inherits from the Beliefset class.
 */
export class Beliefs extends Beliefset{

  #goals = []
  #me = 'aMEn'

  /**
   * Constructs a new instance of the Beliefs class.
   * 
   * @param {Object} agent - The agent that this Beliefs object is associated with
  */
  constructor(agent) {
    super()
    this.agent = agent
    this.declare(`me ${this.#me}`)
    this.declare(`at ${this.#me} t${agent.getCurrentPosition().x}_${agent.getCurrentPosition().y}`)
    this.initMap()
    console.log('[INIT][BLF ] Agent Beliefs initialized.')
  }
  
  /**
   * Updates the entire belief set of an agent.
   *
   * @param {Object} agent - The agent whose beliefs are to be updated
  */
  updateBeliefSet(agent) {
    console.log('[BELIEF] LastPos/Curr:',agent.lastPosition, agent.currentPosition)
    this.updateMyPosition(agent.lastPosition, agent.currentPosition)
    this.updatePlayers(agent)
    this.updateParcels(agent)
    console.log('[AGENT][BELIEF] Belief Set Updated.')
  }

  /**
   * Updates the agent's belief about its position.
   *
   * @param {Object} previous - The previous position of the agent
   * @param {Object} current - The current position of the agent
  */
  updateMyPosition(previous, current){
    this.declare(`at ${this.#me} t${current.x}_${current.y}`)
    this.undeclare(`at ${this.#me} t${previous.x}_${previous.y}`)
    console.log('[AGENT][BELIEF] Update Belief: in', current, 'from', previous)
  }

  /**
   * Updates the agent's beliefs about other players.
   *
   * @param {Object} agent - The agent whose beliefs are to be updated
  */
  updatePlayers(agent) { 
    for (const player of agent.getEnvironment().getPlayers().getValues()) {
      this.declare(`agent ${player.id}`)
      this.declare(`at ${player.id} t${player.getCurrentPosition().x}_${player.getCurrentPosition().y}`);
      if (player.getCurrentPosition().x != player.getLastPosition().x || player.getCurrentPosition().y != player.getLastPosition().y)
        this.undeclare(`at ${player.id} t${player.getLastPosition().x}_${player.getLastPosition().y}`);
    }
  }

  /**
   * Updates the agent's beliefs about parcels.
   *
   * @param {Object} agent - The agent whose beliefs are to be updated
  */
  updateParcels(agent) { 
    for (let parcel of agent.getEnvironment().getParcels().getValues()) {
      this.declare(`parcel ${parcel.id}`);
      this.declare(`at ${parcel.id} t${parcel.position.x}_${parcel.position.y}`);
    }
  }

  /**
   * Initializes the map in the belief set. This function is used to generate the pddl constraint that depend on the map.
   * Is consider the type and available movement for each tile of the map (without considering the presence of other players).
   *
   * @returns {Boolean} - Whether the map initialization is successful
  */
  initMap(){
    let map = this.agent.getEnvironment().getFullMap()
    for (let i = 0; i < this.agent.getEnvironment().mapHeight; i++) {
      for (let j = 0; j < this.agent.getEnvironment().mapWidth; j++) {
        const cell = map[i][j]
        if (cell != 0) {
          this.declare(`tile t${i}_${j}`);
          if (cell == 2) {
            this.declare(`deliveryTile t${i}_${j}`);
          }

          // declare relations between cells
          if (j > 0 && map[i][j - 1] != 0) {
            this.declare(`down t${i}_${j} t${i}_${j - 1}`);
            this.declare(`up t${i}_${j - 1} t${i}_${j}`); // Inverse
          }
          if ((j < this.agent.getEnvironment().mapHeight - 1) && map[i][j + 1] != 0) {
            this.declare(`up t${i}_${j} t${i}_${j + 1}`);
            this.declare(`down t${i}_${j + 1} t${i}_${j}`); // Inverse
          }
          if (i > 0 && map[i - 1][j] != 0) {
            this.declare(`left t${i}_${j} t${i - 1}_${j}`);
            this.declare(`right t${i - 1}_${j} t${i}_${j}`); // Inverse
          }
          if ((i < this.agent.getEnvironment().mapWidth - 1) && map[i + 1][j] != 0) {
            this.declare(`right t${i}_${j} t${i + 1}_${j}`);
            this.declare(`left t${i + 1}_${j} t${i}_${j}`); // Inverse
          }
        }
      }
    }
    return true
  }
}

