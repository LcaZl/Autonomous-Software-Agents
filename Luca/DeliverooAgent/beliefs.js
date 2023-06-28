#!/usr/bin/env node
import { onlineSolver, PddlExecutor, PddlProblem, Beliefset, PddlDomain, PddlAction } from "@unitn-asa/pddl-client";

export class Beliefs extends Beliefset{

  constructor() {
    super()
    console.log('[INIT] Agent Beliefs initialized.')
  }

  async init(map, parcels, players){
    // process map
    this.declare('me a1')
    }

    let deliveryCells = map.filter(cell => cell.delivery === true);

    for (let cell of deliveryCells) {
      let tile = 't' + cell.x + '_' + cell.y;
      this.declare(`delivery ${tile}`);
    }

    // process parcels
    for (const parcel of parcels) {
      // assuming parcel has properties 'id', 'x', 'y'
      this.declare(`at p${parcel.id} t${parcel.x}_${parcel.y}`);
    }

    // process players
    for (const player of players) {
      // assuming player has properties 'id', 'x', 'y'
      this.declare(`me a${player.id}`);
      this.declare(`at a${player.id} t${player.x}_${player.y}`);
    }
    console.log('[INIT] Belief Set Initialized.')
  }
}

