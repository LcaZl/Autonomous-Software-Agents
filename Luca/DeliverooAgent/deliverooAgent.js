#!/usr/bin/env node
import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { Environment } from './environment.js';
import { Planner } from './planner.js'

export class DeliverooAgent{

  constructor(host, token) {
    this.client = new DeliverooApi(host,token);
    this.client.onDisconnect(() => console.log("Socket Disconnected!"));

    this.client.onConnect(() => console.log("[INIT] Agent Connected to Deliveroo!"));

    this.client.onYou( ( {id, name, x, y, score} ) => {
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
      })

    this.host = host;
    this.token = token;
    this.parcels = new Map()
    this.otherPlayers = new Map()
  }

  activateSensing(){
      this.client.onParcelsSensing((sensedParcels) => {
        for(let p of sensedParcels){
            var utility = this.parcelUtility(p.reward, p.x, p.y, this.x, this.y)
            this.parcels.set(p.id, {
                'Reward':p.reward,
                'x': p.x,
                'y': p.y,
                'CarriedBy':p.carriedBy,
                'Utility': parseFloat(utility)
            })
          }
      })
  
      this.client.onAgentsSensing( (agents) => {
        for (const a of agents) {
  
          if ( a.x % 1 != 0 || a.y % 1 != 0 ) // skip intermediate values (0.6 or 0.4)
          continue;
  
          console.log('[AGENT] Meet', a.name, '-', a)
          this.otherPlayers.set(a.id, {
            'name':a.name,
            'x': a.x, 
            'y': a.y,
            'score': a.score
          })
        }
      })

      console.log('[INIT] Sensing Activated')
  }

  parcelUtility(reward, px, py, ax, ay){
    var term1 = reward / (this.distance(ax, ay, px, py) + 1)
    var term2 = 0
    for (let a of this.otherPlayers.values()){
      term2 += 1 / (this.distance(a.x, a.y, px, py) + 1)
    }
    return (term1 - term2).toFixed(2)
  }

  info(){

    console.log('[AGENT] Agent info:\n')
    console.log(' - ID: ', this.id)
    console.log(' - Name: ', this.name)
    console.log(' - Score: ', this.score)
    console.log(' - Position: (', this.x,',',this.y, ')')
    console.log(' - Server Deliveroo Connected: ',this.host)
    console.log(' - Token: ',this.token)
    console.log('\n[ENVIRONMENT] Environment Attributes:\n')
    this.environment.printAttributes()
    console.log('\n[ENVIRONMENT] Environment Map:\n')
    this.environment.printMap(' ') // filler is for inactive cell, insert what char o value show for these cells.
  }

  async initialization() {
    
    return new Promise(async (resolve, reject) => {
  
      const initMove = async () => {
        try {
          const moveResult = await this.client.move(this.randomDirection());
          console.log("[INIT] First move done.");
          return true;
        } catch (error) {
          console.error("[INITERROR] Error during first move call.\nError:\n", error);
          return false;
        }
      };

      const initEnvironment = async () => {
        try {
          this.environment = new Environment(this.client.map, this.client.config);
          return true;
        } catch (error) {
          console.error("[INITERROR] Error during environment loading.\nError:\n", error);
          return false;
        }
      };
  
      const initPlanner = async () => {
        this.planner = new Planner()
        let plannerStatus = this.planner.init
        return plannerStatus
      }

      const callbacks = [initMove, initEnvironment, initPlanner];
  
      try {
        for (const callback of callbacks) {
          const success = await callback();
  
          if (!success) {
            reject(new Error("Initialization failed at " + callback.name));
            return;
          }
        }
  
        console.log('[INIT] Initialization Complete.');
        this.activateSensing()
        resolve(true);
      } catch (error) {
        console.error("[INITERROR] Error during initialization.\nError:\n", error);
        reject(error);
      }
    });
  }
  

  distance(x1, y1, x2, y2) {
    const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    return dx + dy;
  }

  randomDirection(){
    var randomValue = Math.floor(Math.random() * 4) + 1;
    var direction = ''
    switch (randomValue) {
      case 1:
        direction = 'right'
      break;
      case 2:
        direction = 'left'
      break;
      case 3:
        direction = 'up'
      break;
      case 4:
        direction = 'down'
      break;
    }
    return direction
  }

  show_parcels(){
    console.log('- PARCELS -')
    if (this.parcels.size == 0) {
        console.log('-- No parcels detected.')
    }
    for (let v of this.parcels){
        console.log('-- ',v)
    }
  }

  show_players(){
    console.log('- PLAYERS')
    if (this.otherPlayers.size == 0) {
        console.log('-- No players detected.')
    }
    for (let v of this.otherPlayers){
        console.log('-- ',v)
    }
  }

}



