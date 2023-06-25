#!/usr/bin/env node
import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import * as pddlClient from "@unitn-asa/pddl-client";
import { Environment } from './environment.js';

export class Agent {
  constructor(host, token) {
    try{

      this.client = new DeliverooApi(host,token);
      this.client.onDisconnect(() => console.log("Socket Disconnected!"));
      this.client.onConnect(() => console.log("\n[CONNECTION] Agent Connected to Deliveroo!"));

      this.host = host;
      this.token = token;
      this.parcels = new Map()
      this.otherPlayers = new Map()

      this.client.onYou( ( {id, name, x, y, score} ) => {
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
      })

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
    }
    catch{

      console.log('[INITERROR] Error during agent instantiation. Exiting.')
      return null

    }
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

  async init() {

    return new Promise((resolve) => {

      const firstMove = (data) => {
        try {

          const moveResult = this.client.move('down')
          console.log("[INIT] First move done.");
          return true; // Indicate success

        } catch (error) {

          console.error("[INITERROR] Error during first move call.\nError:\n", error);
          return false; // Indicate failure
        }
      };

      const loadEnvironment = () => {
        try {

          this.environment = new Environment(this.client.map, this.client.config);
          console.log("[INIT] Environment info loaded.");
          return true; // Indicate success

        } catch (error) {
          console.error("[INITERROR] Error during environment loading.\nError:\n", error);
          return false; // Indicate failure
        }
      };

      const logCallbacks = [firstMove, loadEnvironment];

      const executeCallbacksSequentially = async (data) => {

        let overallSuccess = true; // Track the overall success status

        for (const callback of logCallbacks) {

          const success = await callback(data);

          if (!success) {
            overallSuccess = false; // Set overall success to false if any callback fails
            break; // Exit the loop early if a failure occurs
          }
        }

        if (overallSuccess){ console.log('[INIT] Initialization Complete.') }
        resolve(overallSuccess); // Resolve the promise with the overall success status
      };

      this.client.onLog((data) => {

        executeCallbacksSequentially(data).catch((error) => {

            console.error("[INITERROR] Error during initialization.\nError:\n", error);
            resolve(false); // Resolve the promise with false if an error occurs

          });
      });
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
    if (this.parcels.size == 0) {
        console.log(' - No parcels detected.')
    }
    for (let v of this.parcels){
        console.log('-',v)
    }
  }

  show_players(){
    if (this.otherPlayers.size == 0) {
        console.log(' - No players detected.')
    }
    for (let v of this.otherPlayers){
        console.log('-',v)
    }
  }

  async agentLoop() {

    var count = 0
    while (count < 100) {

      await new Promise(resolve => setTimeout(resolve, 1000));
      this.lastDirection = this.randomDirection()
      //console.log('[AGENT][MOVE',(count + 1),'] Start moving', this.lastDirection)

      //let move = this.client.move(this.lastDirection)
      /*await move.then((status) => {

          if (status != false){
          this.x = status.x 
          this.y = status.y
          console.log('[AGENT][MOVE',(count + 1),'] End moving', this.lastDirection)
          console.log('[AGENT][POSITION] Current Position: (' + this.x + ',' + this.y + ')')
          }
          else{
            console.log('[AGENT][MOVE',(count + 1),'] No move done,', this.lastDirection, 'is blocked.')
            console.log('[AGENT][POSITION] Current Position: (' + this.x + ',' + this.y + ')')
          }
      }) */

      console.log('[AGENT][PARCELS] In memory parcels:\n')
      this.show_parcels()
      this.show_players()
      console.log('\n')

      var parcelToPickup = null
      for(let parcel of this.parcels.values()){
          if(parcel.x == this.x && parcel.y == this.y){
              parcelToPickup = parcel;
              break;
            }
      }

      if(parcelToPickup != null){
        var pickUp = this.client.pickup()
        await pickUp.then((parcel) => console.log('[AGENT][PARCELS] Parcel', parcelToPickup,'Taken'))
      }

      if (this.environment.deliveryTiles.has(''+ this.x + '-' + this.y)){
        var putDown = this.client.putdown() 
        await putDown.then((success) => console.log('[AGENT][PARCELS] Parcels dropped ', success))
      }

      count++
    }
  }
}
