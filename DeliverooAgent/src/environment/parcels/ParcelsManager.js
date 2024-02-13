import { Position } from '../../utils/Position.js'
import { Parcel } from './Parcel.js'

/**
 * Manages all parcels within the game, including tracking, updates and coordination among agents.
 */
export class ParcelsManager {
    /**
     * Initializes the parcels manager for an agent, setting up containers for tracking parcels.
     * 
     * @param {Agent} agent - The agent.
     */
    constructor(agent) {
        this.agent = agent
        this.parcels = new Map() // Tracks all parcels by their ID
        this.myParcels = new Set() // Parcels currently being carried by the agent
        this.deletedParcels = new Set() // Parcels that are no longer available
        console.log('[INIT] Parcels Manager Initialized.')
    }

    /**
     * Sets up event listeners for parcel-related events to manage parcel tracking and state updates.
     */
    activate() {
        // Listen for parcel perceptions and update local tracking accordingly
        this.agent.eventManager.on('parcels_percept', parcels => this.handleParcelsSensing(parcels))

        // Update parcel tracking when parcels are picked up, lefted or delivered
        this.agent.eventManager.on('picked_up_parcels', parcels => this.handleParcelsPickUp(parcels))
        this.agent.eventManager.on('delivered_parcels', parcels => this.handleParcelsDelivery(parcels))
        this.agent.eventManager.on('left_parcels', parcels => this.handleParcelsLeft(parcels))

        // In multi-agent setups, listen for parcel perceptions shared by team members
        if (this.agent.multiagent) {
            this.agent.eventManager.on('parcels_percept_from_team', parcels => this.handleParcelsSensing(parcels, true))
        }
    }

    /**
     * Clears all parcels currently marked as carried by the agent.
     */
    handleParcelsLeft() {
        this.myParcels.forEach(id => {
            this.parcels.get(id).carriedBy = null
            this.myParcels.delete(id)
        })

        if (this.agent.moveType === 'PDDL') {
            this.agent.eventManager.emit('update_parcels_beliefs')
        }
    }

    /**
     * Processes the delivery of specified parcels, removing them from tracking.
     * 
     * @param {string[]} parcelIds - IDs of parcels that have been delivered.
     */
    handleParcelsDelivery(parcelIds) {
        parcelIds.forEach(id => this.deleteParcel(id))

        if (this.agent.moveType === 'PDDL') {
            this.agent.eventManager.emit('update_parcels_beliefs')
        }
        this.agent.eventManager.emit('update_options')
    }

    /**
     * Updates parcel ownership when a teammate picks up parcels.
     * 
     * @param {string} agentId - The ID of the agent picking up the parcels.
     * @param {string[]} ids - The IDs of the parcels picked up.
     */
    handleTeammatePickup(agentId, ids) {
        ids.forEach(id => {
            if (this.parcels.has(id)) {
                this.parcels.get(id).carriedBy = agentId
            }
        })

        if (this.agent.moveType === 'PDDL') {
            this.agent.eventManager.emit('update_parcels_beliefs')
        }
        this.agent.eventManager.emit('update_options')
    }

    /**
     * Marks specified parcels as picked up by the agent and updates their carried status.
     * 
     * @param {string[]} parcelIds - IDs of parcels that have been picked up.
     */
    handleParcelsPickUp(parcelIds) {
        parcelIds.forEach(id => {
            if (!this.deletedParcels.has(id)) {
                this.parcels.get(id).carriedBy = this.agent.agentID
                this.myParcels.add(id)
            }
        })

        if (this.agent.moveType === 'PDDL') {
            this.agent.eventManager.emit('update_parcels_beliefs')
        }
    }

    /**
     * Removes a parcel from management, marking it as deleted.
     * 
     * @param {string} id - The ID of the parcel to remove.
     */
    deleteParcel(id) {
        this.parcels.delete(id)
        this.myParcels.delete(id)
        this.deletedParcels.add(id)
        this.agent.eventManager.emit('deleted_parcel', id)
    }

    /**
     * Handles the sensing of parcels in the environment, updating or adding parcels as necessary.
     * Flags updates to parcel data and triggers relevant events for significant changes.
     * 
     * @param {Object[]} sensedParcels - An array of parcels detected in the environment.
     * @param {Boolean} fromCommunication - Indicates if sensing is from communication in a multi-agent setup.
     * @returns {Boolean} True if there were updates to the parcels, false otherwise.
     */
    handleParcelsSensing(sensedParcels, fromCommunication = false) {
        let updates = false

        for (const p of sensedParcels) {
            // Validate parcel position and check if it's not deleted or excluded based on specific game config
            if (p.x % 1 === 0 && p.y % 1 === 0 && !this.deletedParcels.has(p.id) &&
                !(this.agent.client.config.MAP_FILE === 'challenge_32' && p.x !== this.agent.currentPosition.x)) {
                let parcel

                if (this.parcels.has(p.id)) {
                    parcel = this.parcels.get(p.id)
                    // Update existing parcel and check for changes
                    updates = parcel.update(p) || updates
                } else {
                    // Create and track a new parcel instance
                    parcel = new Parcel(p, this.agent)
                    this.parcels.set(parcel.id, parcel)
                    updates = true
                }

                // If the agent carries this parcel and it's not already tracked, add it
                if (parcel.isMine() && !this.myParcels.has(parcel.id)) {
                    this.myParcels.add(parcel.id)
                    updates = true
                }
            }
        }

        // Trigger update events if any significant changes occurred
        if (updates) {
            if (this.agent.moveType === 'PDDL') {
                this.agent.eventManager.emit('update_parcels_beliefs')
            }
            this.agent.eventManager.emit('update_options')
            if (!fromCommunication) {
                this.agent.eventManager.emit('new_parcels_info')
            }
        }

        return updates
    }
    /**
     * Extracts and returns raw data of all managed parcels.
     * For multi-agent communication.
     * 
     * @returns {Array} Array of parcels' raw data.
     */
    getRawParcels() {
        return Array.from(this.parcels.values()).map(p => p.raw())
    }

    /**
     * Return the map of all parcels managed by the agent.
     * 
     * @returns {Map} Map of all parcels.
     */
    getParcels() {
        return this.parcels
    }

    /**
     * Retrieves all parcels currently carried by the agent.
     * 
     * @returns {Array} Array of parcels carried by the agent.
     */
    getMyParcels() {
        return Array.from(this.myParcels).map(id => this.parcels.get(id))
    }

    /**
     * Counts the parcels currently being carried by the agent.
     * 
     * @returns {number} Count of carried parcels.
     */
    carriedParcels() {
        return this.myParcels.size
    }

    /**
     * Checks if a parcel is available for pickup.
     * 
     * @param {string} id - The ID of the parcel to check.
     * @returns {boolean} True if the parcel is available for pickup, false otherwise.
     */
    isValidPickUp(id) {
        return this.parcels.has(id) && !this.deletedParcels.has(id) && !this.myParcels.has(id)
    }

    /**
     * Retrieves one of the parcels currently carried by the agent.
     * 
     * @returns {Parcel|null} A parcel carried by the agent or null if none are carried.
     */
    getOneOfMyParcels() {
        const firstParcelId = this.myParcels.values().next().value
        return firstParcelId ? this.parcels.get(firstParcelId) : null
    }

    /**
     * Filters and returns all free and accessible parcels.
     * 
     * @returns {Array} Array of free and accessible parcels.
     */
    getFreeParcels() {
        return Array.from(this.parcels.values()).filter(p => p.isFree() && p.isAccessible())
    }

    /**
     * Retrieves positions of all free parcels.
     * 
     * @returns {Position[]} Array of positions for free parcels.
     */
    getPositions() {
        return Array.from(this.parcels.values()).filter(p => p.isFree()).map(p => p.position)
    }

    /**
     * Summarizes the total reward of all parcels currently carried by the agent.
     * 
     * @returns {number} The sum of rewards for carried parcels.
     */
    getMyParcelsReward() {
        return Array.from(this.myParcels)
            .reduce((total, id) => total + this.parcels.get(id).reward, 0)
    }
}
