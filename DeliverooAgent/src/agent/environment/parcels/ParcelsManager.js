import { Position } from '../../utils/Position.js';
import { Parcel } from './Parcel.js';

/**
 * Manages all parcels within the game, handling their creation, updates, and deletion.
 */
export class ParcelsManager {
    /**
     * Constructs a new instance of ParcelsManager.
     * 
     * @param {Agent} agent - The agent managing the parcels.
     */
    constructor(agent) {
        this.agent = agent;
        this.parcels = new Map(); // All available parcels
        this.myParcels = new Set(); // Parcel that the agent is carring
        this.deletedParcels = new Set(); // Parcel no more available or not reachable 
        console.log('[INIT] Parcels Manager Initialized.');
    }

    /**
     * Activates the parcel manager by setting up event listeners.
     */
    activate() {
        this.agent.eventManager.on('parcels_percept', (parcels) => { this.handleParcelsSensing(parcels); });
        this.agent.eventManager.on('picked_up_parcels', (parcels) => { this.handleParcelsPickUp(parcels); });
        this.agent.eventManager.on('delivered_parcels', (parcels) => { this.handleParcelsDelivery(parcels); });
    }

    /**
     * Retrieves all parcels.
     * 
     * @returns {Map} A map of all parcels.
     */
    getParcels() { return this.parcels; }

    /**
     * Retrieves all parcels.
     * 
     * @returns {Map} A map of all parcels.
     */
    getMyParcels() { 
        let myParcels = []
        this.parcels.forEach(p => {
            if(this.myParcels.has(p.id))
                myParcels.push(p)
        }); 
        return myParcels
    }

    /**
     * Counts the number of parcels currently carried by the agent.
     * 
     * @returns {Number} The count of carried parcels.
     */
    carriedParcels() { return this.myParcels.size; }

    /**
     * Validates if a parcel can be picked up.
     * 
     * @param {String} id - The parcel's identifier.
     * @returns {Boolean} True if the parcel can be picked up, otherwise false.
     */
    isValidPickUp(id) {
        return this.parcels.has(id) && !this.deletedParcels.has(id) && !this.myParcels.has(id);
    }

    /**
     * Returns the parcle object associated with the first parcel id of my parcels.
     * 
     * @returns {Parcel} - One of my parcel
     */
    getOneOfMyParcels(){
        let p = this.parcels.get(this.myParcels.values().next().value)
        if (p) 
            return p
        p = this.agent.intentions.currentIntention.option.parcelId
        return p
    }
    /**
     * Validates if a parcel can be picked up.
     * 
     * @returns {Array} - Available parcels
     */
    getFreeParcels(){
        let freeParcels = []
        this.parcels.forEach(p => {
            if (p.isFree() && p.isAccessible())
                freeParcels.push(p)
        })
        return freeParcels
    }
    /**
     * Deletes a parcel from the manager.
     * 
     * @param {String} id - The identifier of the parcel to delete.
     */
    deleteParcel(id) {
        this.parcels.delete(id);
        if (this.myParcels.has(id)) {
            this.myParcels.delete(id);
        }
        this.deletedParcels.add(id);
        this.agent.eventManager.emit('deleted_parcel', id);
    }

    /**
     * Retrieves the positions of all non-carried parcels.
     * 
     * @returns {Position[]} An array of positions.
     */
    getPositions() {
        let positions = [];
        for (let [id, parcel] of this.parcels) {
            if (!this.myParcels.has(id)) {
                positions.push(parcel.position);
            }
        }
        return positions;
    }

    /**
     * Calculates the total reward of parcels carried by the agent.
     * 
     * @returns {Number} Total reward.
     */
    getMyParcelsReward() {
        let val = 0;
        this.myParcels.forEach(id => val += this.parcels.get(id).reward);
        return val;
    }


    /**
     * Handles the delivery of parcels.
     * 
     * @param {Object[]} deliveredParcels - An array of parcels that have been delivered.
     */
    handleParcelsDelivery(deliveredParcels) {
        for (let p of deliveredParcels) {
            this.deleteParcel(p.id);
        }
    }

    /**
     * Handles the pick-up of parcels.
     * 
     * @param {Object[]} pickedUpParcels - An array of parcels that have been picked up.
     */
    handleParcelsPickUp(pickedUpParcels) {
        for (let p of pickedUpParcels) {
            if (!this.deletedParcels.has(p.id)) {
                this.parcels.get(p.id).carriedBy = this.agent.agentID;
                this.myParcels.add(p.id);
            }
        }
        if (this.agent.moveType == 'PDDL')
            this.agent.eventManager.emit('update_parcels_beliefs');
    }
    
    /**
     * Handles the sensing of parcels in the environment.
     * 
     * @param {Object[]} sensedParcels - An array of parcels detected in the environment.
     * @returns {Boolean} True if there were updates to the parcels, false otherwise.
     */
    handleParcelsSensing(sensedParcels) {
        let updates = false;
    
        // A set to track the IDs of sensed parcels for this iteration
        let sensedIds = new Set();

        for (const p of sensedParcels) {
            if (p.x % 1 === 0 && p.y % 1 === 0) {
                sensedIds.add(p.id);
                let wrapP;

                // Check if the parcel is already known
                if (this.parcels.has(p.id)) {
                    wrapP = this.parcels.get(p.id);
    
                    // Check if there's a significant change (reward, carrier, or position)
                    if (wrapP.carriedBy !== p.carriedBy || !wrapP.position.isEqual(new Position(p.x,p.y))) {
                        wrapP.update(p);
                        updates = true;
                        if (!wrapP.isAccessible())
                            this.parcels.delete(wrapP.id)
                    }
    
                } else {
                    // New parcel detected -> Create new instance
                    wrapP = new Parcel(p, this.agent);
                    if (wrapP.isAccessible()){
                        this.parcels.set(wrapP.id, wrapP);
                        updates = true;
                    }
                }
    
                if (wrapP.isMine() && !this.myParcels.has(wrapP.id)) {
                    this.myParcels.add(wrapP.id);
                } else if (!wrapP.isMine() && this.myParcels.has(wrapP.id)) {
                    this.myParcels.delete(wrapP.id);
                }

            }
        }
    
        // Send update notification if there are significant changes
        if (this.agent.moveType == 'PDDL')
            this.agent.eventManager.emit('update_parcels_beliefs');
        if (updates) {
            this.agent.eventManager.emit('update_options');
        }
    }

}
