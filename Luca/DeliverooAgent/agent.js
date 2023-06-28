#!/usr/bin/env node
import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import * as pddlClient from "@unitn-asa/pddl-client";
import { Environment } from './environment.js';
import { DeliverooAgent } from "./deliverooAgent.js";

export class Agent extends DeliverooAgent{
  constructor(host, token) {
      super(host, token)
      console.log('[INIT] Agent Instantiated.')
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

      console.log('[AGENT] Memory Status:')
      this.show_parcels()
      this.show_players()

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
