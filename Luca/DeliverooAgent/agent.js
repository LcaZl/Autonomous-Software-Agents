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
      this.client.onYou( ( {id, name, x, y, score} ) => {
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
      } )
      this.host = host;
      this.token = token;
      this.deliverTiles = new Map()
      this.parcels = new Map()
      this.otherPlayers = new Map()

    }
    catch{

      console.log('[INITERROR] Error during agent instantiation. Exiting.')
      return null

    }
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

      const loadDeliveryTiles = () => {
        for (let el of this.environment.AVAILABLE_MAP){
          if (el.delivery == true){
              deliverTiles.set('' + el.x + '-' + el.y, null)
          }
        }
      }

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

  distance( {x:x1, y:y1}, {x:x2, y:y2}) {
    const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    return dx + dy;
  }

  async makeMove(direction){
        let move = await this.client.move(direction);
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

  async agentLoop() {

    var count = 0
    while (count < 1000) {

      
      this.lastDirection = this.randomDirection()
      console.log('[AGENT][MOVE',(count + 1),'] Start moving', this.lastDirection)

      let move =  this.client.move(this.lastDirection)
      await move.then((status) => {

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
      }) 

      this.client.onParcelsSensing((sensedParcels) => {
        for(let p of sensedParcels){
            this.parcels.set(p.id, {
                'Reward':p.reward,
                'x': p.x,
                'y': p.y,
                'CarriedBy':p.carriedBy
            })
        }
      })

      for(let parcel of this.parcels.values()){
          if(parcel.x == this.x && parcel.y == this.y){
              var parcelToPickup = parcel;
              break;
            }
      }

      if(parcelToPickup != null){
        var pickUp = this.client.pickup()
        await pickUp.then((parcel) => console.log('[AGENT][PARCEL] Parcel taken ', parcel))
      }

      if (this.environment.deliveryTiles.has(''+ this.x + '-' + this.y)){
        var putDown = this.client.putdown() 
        await putDown.then((success) => console.log('[AGENT][PARCEL] Parcel dropped ', success))
      }

      count++
    }
  }
}
