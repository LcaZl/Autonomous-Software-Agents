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

        const moveResult = this.client.move('up');
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
        if (this.environment == null) {

          console.log("[INITERROR] Error while loading environment.");
          return false; // Indicate failure
        
        } 
        else {

          console.log("[INIT] Environment info loaded.");
          return true; // Indicate success

        }

      } catch (error) {

        console.error("[INITERROR] Error during environment loading.\nError:\n", error);
        return false; // Indicate failure

      }
    };

    const logCallbacks = [firstMove, loadEnvironment];

    const executeCallback = (callback, data) => {
      
      return new Promise((resolve) => {
        
        const success = callback(data);
        resolve(success); // Resolve with the success status of the callback

      });
    };

    const executeCallbacksSequentially = async (data) => {

      let overallSuccess = true; // Track the overall success status

      for (const callback of logCallbacks) {

        const success = await executeCallback(callback, data);
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


  showBelief(list) {
    if (list.size == 0) {
      console.log('Map is empty');
    }
    for (let v of list) {
      console.log(v);
    }
  }

  async agentLoop() {
    const parcelList = new Map();
    var deliverTiles = new Map();
    var myself = {
      x: 0,
      y: 0
    };
    var randomValue;
    var count = 0;


    while (count < 200) {
      randomValue = Math.floor(Math.random() * 4) + 1;
      console.log('\nMove ' + count + ' -> ' + randomValue);
      switch (randomValue) {
        case 1:
          let down = this.client.move('down');
          await down.then((status) => {
            myself.x = status.x;
            myself.y = status.y;
          });
          break;

        case 2:
          let up = this.client.move('up');
          await up.then((status) => {
            myself.x = status.x;
            myself.y = status.y;
          });
          break;

        case 3:
          let right = this.client.move('right');
          await right.then((status) => {
            myself.x = status.x;
            myself.y = status.y;
          });
          break;

        case 4:
          let left = this.client.move('left');
          await left.then((status) => {
            myself.x = status.x;
            myself.y = status.y;
          });
          break;
      }

      this.client.onParcelsSensing((parcels) => {
        for (let p of parcels) {
          parcelList.set(p.id, {
            'Reward': p.reward,
            'x': p.x,
            'y': p.y,
            'CarriedBy': p.carriedBy
          });
        }
      });
      console.log('Current position -> (' + myself.x + ',' + myself.y + ')');
      this.showBelief(parcelList);

      let parcelToPickup = null;
      for (let parcel of parcelList.values()) {
        if (parcel.x == myself.x && parcel.y == myself.y) {
          parcelToPickup = parcel;
          break;
        }
      }
      if (parcelToPickup != null) {
        var pickup = this.client.pickup();
        await pickup.then((parcel) => console.log('Parcel Taken!'));
      }

      if (deliverTiles.has('' + myself.x + '-' + myself.y)) {
        await this.client.putdown();
      }

      count++;
    }
  }
}
