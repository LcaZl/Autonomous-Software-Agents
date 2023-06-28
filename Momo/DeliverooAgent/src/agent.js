#!/usr/bin/env node
import { DeliverooAgent } from "./deliverooAgent.js";
import { randomDirection, showParcels, showPlayers } from './utils.js';

export class Agent extends DeliverooAgent{


  constructor(host, token) {
    super(host, token)
    console.log('[INIT] Agent Instantiated.')
  }

  async agentLoop() {

    var count = 0
    while (count < 100) {

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.lastDirection = randomDirection()
      //console.log('[AGENT][MOVE',(count + 1),'] Start moving', this.lastDirection)

      let move = this.client.move(this.lastDirection)
      console.log('[CONTROL] This.x0 = ', this.x[0], ' this.y0 = ', this.y[0],  'This.x1 = ', this.x[1], ' this.y1 = ', this.y[1])

      await move.then((status) => {
          if (status != false &&  status.x % 1 != 0 || status.y % 1 != 0 ){
            this.x[1] = this.x[0]
            this.y[1] = this.y[0] 
            this.x[0] = Math.ceil(status.x)
            this.y[0] = Math.ceil(status.y)
            this.beliefs.updateMyPosition(this.x[0], this.y[0])
            console.log('[AGENT] Beliefs updated.\n', this.beliefs.toPddlString())
            console.log('[AGENT][MOVE',(count + 1),'] End moving', this.lastDirection)
            console.log('[AGENT] Current Position: (' + this.x[1] + ',' + this.y[1] + ') -> (' + this.x[0] + ',' + this.y[0] + ')')
          }
          else{
            console.log('[AGENT][MOVE',(count + 1),'] No move done,', this.lastDirection, 'is blocked.')
          }
      }) 

      console.log('[AGENT] Memory Status:')
      //showParcels(this.parcels)
      //showPlayers(this.otherPlayers)
      var parcelToPickup = null
      for(let parcel of this.parcels.values()){
        if(parcel.x == this.x && parcel.y == this.y){
            parcelToPickup = parcel;
            break;
        }
      }

      if(parcelToPickup != null){
        var pickUp = this.client.pickup()
        await pickUp.then(() => {
          console.log('[AGENT][PARCELS] Parcel', parcelToPickup,'Taken')
          this.MyParcels += 1
        })
      }

      if (this.myParcels > 0 && this.environment.deliveryTiles.has(''+ this.x + '-' + this.y)){
        var putDown = this.client.putdown() 
        await putDown.then((success) => console.log('[AGENT][PARCELS] Parcels dropped ', success))
        this.myParcels = 0
      }

      count++
    }
  }

}
