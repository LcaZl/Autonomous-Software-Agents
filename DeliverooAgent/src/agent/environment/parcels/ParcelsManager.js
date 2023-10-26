
import { Environment } from '../Environment.js';
import { Parcel } from './Parcel.js';
import { Position } from '../../../utils/utils.js';
import { Agent } from '../../agent.js';
import EventEmitter from "events";
import { distance } from "../../../utils/utils.js"

/**
 * The Parcels class manages all parcels in the game.
 */
export class ParcelsManager{

    /**
     * Constructs a new instance of the Parcels class.
     * 
     * @constructor
     * @param {Agent} agent - The agent
    */
    constructor(agent) {

        this.agent = agent
        this.parcels = new Map()
        this.myParcels = new Set()
        this.deletedParcels = new Set()
        this.parcelsTimerStarted = false
        console.log('[INIT] Parcels Manager Initialized.')
    }
    activate(){
        this.agent.eventManager.on('parcels_percept', (parcels) => { this.handleParcelsSensing(parcels) })
        this.agent.eventManager.on('picked_up_parcels', (parcels) => { this.handelParcelsPickUp(parcels) })
        this.agent.eventManager.on('delivered_parcels', (parcels) => { this.handelParcelsDelivery(parcels) })
    }

    getParcels() { return this.parcels }

    carriedParcels(){ return this.myParcels.size }

    deleteParcel(id) {
        this.parcels.delete(id)
        if (this.myParcels.has(id))
            this.myParcels.delete(id)
        this.deletedParcels.add(id)
        this.agent.eventManager.emit('deleted_parcel', id)
    }
    
    getPositions() {
        let positions = []  
        for (let [id, parcel] of this.parcels)
            if (!this.myParcels.has(id))
                positions.push(parcel.position)
        return positions
    }

    getMyParcelsReward() {
        let val = 0
        this.myParcels.forEach(id => val += this.parcels.get(id).reward)
        return val
    }


    handelParcelsDelivery(deliveredParcels){
        for( let p of deliveredParcels)
            this.deleteParcel(p.id)
    }

    handelParcelsPickUp(pickedUpParcels){
        for (let p of pickedUpParcels){
            this.parcels.get(p.id).carriedBy = this.agent.agentID
            this.myParcels.add(p.id)
        }
        this.agent.eventManager.emit('update_parcels_beliefs')
    }
    handleParcelsSensing(sensedParcels){

        let updates = false
        let newParcel = false

        for (const p of sensedParcels){

            if (p.x % 1 == 0 && p.y % 1 == 0){

                if ((p.carriedBy == null || p.carriedBy == this.agent.agentID) && !this.deletedParcels.has(p.id)){
                   
                    let wrapP = null

                    if (!this.parcels.has(p.id)){

                        wrapP = new Parcel(p, this.agent)
                        this.parcels.set(p.id, wrapP)
                        updates = true
                        newParcel = true
                    }
                    else{

                        wrapP = this.parcels.get(p.id)
                        updates = wrapP.update(p)
                    }

                    if (wrapP.isMine() && !this.myParcels.has(wrapP.id)){

                        this.myParcels.add(wrapP.id)
                        updates = true
                    }
                }
            }
        }

        if (updates) this.agent.eventManager.emit('update_parcels_beliefs')

        if (newParcel) this.agent.eventManager.emit('update_options')
    }
}
