import { distance } from '../../../utils.js';

/**
 * The Parcels class manages all parcels in the game.
 */
export class Parcels{

    /**
     * Constructs a new instance of the Parcels class.
     * 
     * @constructor
     * @param {Object} environment - The environment in which the game is played.
    */
    constructor(environment){
        this.environment = environment
        this.parcelsList = new Map()
        this.ids = new Set()
        // updateInProgress is initialized and the used to avoid concurrent access to parcelsList.
        this.updateInProgress = false
        console.log('[INIT][PRCS] Parcels Manager Instantiated.')
    }

    /**
     * Updates all information of each encountered parcel with the new available information.
     * The reward is updated accordingly to an internal clock.
     * 
     * @param {Array} parcels - An array of updated parcels.
     * @returns {boolean} Returns true if the list of parcels has been modified, false otherwise.
    */
    async updateParcels(parcels) {
        let modified = false
        if (!this.updateInProgress) {
            this.updateInProgress = true
            for (let parcel of parcels) {
                if (this.ids.has(parcel.id)) {
                    if (this.parcelsList.get(parcel.id).carriedBy != parcel.carriedBy || this.parcelsList.get(parcel.id).reward != parcel.reward) {
                        this.parcelsList.get(parcel.id).carriedBy = parcel.carriedBy
                        this.parcelsList.get(parcel.id).reward = parcel.reward
                        modified = true
                    }
                }
                else {
                    let newParcel = {
                        'id': parcel.id,
                        'position': { 'x': parcel.x, 'y': parcel.y },
                        'reward': parcel.reward,
                        'carriedBy': parcel.carriedBy
                    }
                            
                    let utility = this.parcelUtility(newParcel)
                    newParcel['utility'] = utility
                    this.parcelsList.set(parcel.id, newParcel)
                    this.ids.add(parcel.id)
                    modified = true
                }
            }
            this.updateInProgress = false
        }
        return modified
    }

    /**
     * Computes the utility of a parcel.
     * 
     * @param {Object} parcel - A parcel for which to compute the utility.
     * @returns {number} The utility of the parcel.
    */
    parcelUtility(parcel) {
        let term1 = 0
        let term2 = 0

        if ((distance(this.environment.agent.getCurrentPosition(), parcel.position)) == 0)
            term1 = parcel.reward / 0.000001
        else
            term1 = parcel.reward / (distance(this.environment.agent.getCurrentPosition(), parcel.position))
        
        for (let a of this.environment.getPlayers().getValues()) {
            if (!a.isLost())
                term2 += 1 / (distance(a.getCurrentPosition(), parcel.position) + 1)
        }

        return (term1 - term2).toFixed(3)
    }

    
    /**
     * Timer to update parcels' rewards.
    */
    startRewardTimer(){
        let timerSpeed = this.environment.getConfig().PARCEL_DECADING_INTERVAL[0] * 1000

        this.timer = setInterval(async () => {
            if(!this.updateInProgress){
                this.updateInProgress = true
                this.updateParcelsReward()
                this.updateInProgress = false
            }
        }, timerSpeed);

        console.log('[INIT][PRCS] Timer Started - Clock: ', timerSpeed, 'ms')
    }

    /**
     * Updates the rewards for each parcel. Used inside startRewardTimer.
    */
    async updateParcelsReward() {
        for (let parcel of this.getValues()) {
            parcel.reward--;
            if (parcel.reward <= 1) {
                this.parcelsList.delete(parcel.id);
                this.ids.delete(parcel.id)
            } else {
                parcel.utility = this.parcelUtility(parcel);
            }
        }
    }
    

    /**
     * Returns all the parcels in the game.
     * 
     * @returns {IterableIterator} An iterable iterator of the parcels.
    */
    getValues() {
        return this.parcelsList.values()
    }

    /**
     * Returns the number of parcels in the game.
     * 
     * @returns {number} The number of parcels in the game.
    */
    getParcelsCount() {
        return this.ids.size
    }
}
