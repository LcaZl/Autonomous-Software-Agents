import { Position } from "../../utils/Position.js"
import { Agent } from "../../agent.js"

/**
 * Represents a single parcel within the game environment, encapsulating its properties and behaviors.
 * It includes parcel identification, position, reward value and tracking of the agent carrying it.
 * Additionally, it may calculate a path to delivery based on the agent's movement type and apply a
 * decay to the parcel's reward over time accordingly to the environment decading interval.
 */
export class Parcel {
    /**
     * Initializes a new parcel instance with specified properties.
     * 
     * @param {Object} parcel - The initial data for the parcel perceived from server (ID, position and reward).
     * @param {Agent} agent - The agent.
     */
    constructor(parcel, agent) {
        this.agent = agent
        this.id = parcel.id
        this.position = new Position(parcel.x, parcel.y) 
        this.reward = parcel.reward 
        this.carriedBy = parcel.carriedBy 

        // Calculate path to the nearest delivery tile if using BFS strategy
        if (this.agent.moveType === 'BFS') {
            this.pathToDelivery = this.agent.environment.getNearestDeliveryTile(this.position)
        }

        // Set up reward decay over time if applicable
        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity) {
            this.decayInterval = setInterval(() => this.decayReward(), this.agent.PARCEL_DECADING_INTERVAL)
        }
    }

    /**
     * Provides the raw data of the parcel, including its ID, position, carrier and reward.
     * For multi-agent communication.
     * 
     * @returns {Object} The raw parcel data.
     */
    raw() {
        return {
            id: this.id,
            x: this.position.x,
            y: this.position.y,
            carriedBy: this.carriedBy,
            reward: this.reward
        }
    }

    /**
     * Periodically decreases the parcel's reward over time. If the reward drops below a threshold,
     * the parcel is removed forever.
     */
    decayReward() {
        this.reward -= (this.agent.PARCEL_DECADING_INTERVAL / 1000) // Decrease reward based on decay interval
        if (this.reward < 1) {
            clearInterval(this.decayInterval) // Stop decay process
            this.agent.parcels.deleteParcel(this.id) // Remove parcel from agent's tracking
        }
    }

    /**
     * Updates the parcel with new information.
     * 
     * @param {Object} parcelInfo - The new parcel information from server.
     * @returns {boolean} True if the parcel's state has been updated, false otherwise.
     */
    update(parcelInfo) {
        this.reward = parcelInfo.reward
        let updates = false
        const newPos = new Position(parcelInfo.x, parcelInfo.y)
        if (!this.position.isEqual(newPos)) {
            this.position = newPos

            if (this.agent.multiagent && this.agent.team.teammate.id === parcelInfo.carriedBy) {
                // Update state based on whether the parcel is carried by a teammate
                updates = this.carriedBy == null ? true : false
            } else {
                updates = !this.isMine()
            }
        }

        if (this.carriedBy !== parcelInfo.carriedBy) updates = true

        this.carriedBy = parcelInfo.carriedBy
        return updates
    }

    /**
     * Checks if the parcel is carried by me.
     * 
     * @returns {Boolean} True if the parcel is carried by me, false otherwise.
     */
    isMine() {
        return this.carriedBy === this.agent.agentID
    }
        
    /**
     * Checks if the parcel is taken by another agent.
     * 
     * @returns {boolean} True if the parcel is carried by another agent, false otherwise.
     */
    isTaken() {
        return this.carriedBy !== null && this.carriedBy !== this.agent.agentID
    }

    /**
     * Checks if the parcel is free (not carried by any agent).
     * 
     * @returns {boolean} True if the parcel is not carried by any agent, false otherwise.
     */
    isFree() {
        return this.carriedBy === null
    }

    /**
     * Checks if the parcel tile is occupied by another player. This may happen with random moving agents.
     * 
     * @returns {boolean} True if the parcel is accessible, false otherwise.
     */
    isAccessible() {
        for (let p of this.agent.players.getCurrentPositions()) {
            if (p.isEqual(this.position)) return false
        }
        return true
    }

    /**
     * Generates a string representation of the parcel's current state.
     * 
     * @returns {string} The string representation of the parcel.
     */
    toString() {
        return `Parcel ID: ${this.id} (Mine:${this.isMine()}), Position: (${this.position.toString()}), Reward: ${this.reward}, CarriedBy: ${this.carriedBy}`
    }
}
