#!/usr/bin/env node
import { onlineSolver, PddlExecutor, PddlProblem, Beliefset, PddlDomain, PddlAction } from "@unitn-asa/pddl-client";

export class Beliefs extends Beliefset{

  #goals = []

  constructor() {
    super()
    console.log('[INIT] Agent Beliefs initialized.')
  }

  updateMyPosition(x,y){
    this.declare(`at a1 t${x}_${y}`)
  }

  async init(agent){
    // process map
    this.declare('me a1')
    this.declare(`at a1 t${agent.x[0]}_${agent.y[0]}`)
/*
    for (let i = 0; i < map.length; i++) {
      for (let j = 0; j < map[i].length; j++) {
        const cell = map[i][j];

        // declare cell type
        if (cell == 1 || cell == 2) {
          this.declare(`at t${i}_${j}`);
        }

        // declare delivery cells
        if (cell == 2) {
          this.declare(`delivery t${i}_${j}`);
        }

        // declare relations between cells
        if (i > 0 && map[i-1][j] != 0) {
          this.declare(`up t${i}_${j} t${i-1}_${j}`);
          this.declare(`down t${i-1}_${j} t${i}_${j}`);
        }
        if (j > 0 && map[i][j-1] != 0) {
          this.declare(`left t${i}_${j} t${i}_${j-1}`);
          this.declare(`right t${i}_${j-1} t${i}_${j}`);
        }
      }
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
    console.log('[INIT] Belief Set Initialized. INIT:\n')
    console.log(this.toPddlString())*/
  }
}

