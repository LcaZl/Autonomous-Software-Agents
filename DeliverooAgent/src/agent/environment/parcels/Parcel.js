import { Position } from "../../../utils/Position.js";
import { Agent } from "../../agent.js";

/**
 * Represents a single parcel with associated data and behaviors.
 */
export class Parcel {
    /**
     * Creates an instance of Parcel.
     * 
     * @param {Object} parcel - The initial data of the parcel.
     * @param {Agent} agent - The managing agent for this parcel.
     */
    constructor(parcel, agent) {
        this.agent = agent;
        this.id = parcel.id;
        this.position = new Position(parcel.x, parcel.y);
        this.reward = parcel.reward;
        this.carriedBy = parcel.carriedBy;
        this.pathToDelivery = this.agent.environment.getNearestDeliveryTile(this.position);

        if (this.agent.PARCEL_DECADING_INTERVAL !== Infinity) {
            this.decayInterval = setInterval(() => this.decayReward(), this.agent.PARCEL_DECADING_INTERVAL);
        }
    }

    /**
     * Decays the reward of the parcel over time.
     */
    decayReward() {
        this.reward -= (this.agent.PARCEL_DECADING_INTERVAL / 1000);
        if (this.reward < 1) {
            clearInterval(this.decayInterval);
            this.agent.parcels.deleteParcel(this.id);
        }
    }

    /**
     * Updates the parcel with new information.
     * 
     * @param {Object} parcelInfo - The new parcel information.
     */
    update(parcelInfo) {
        this.reward = parcelInfo.reward;
        this.carriedBy = parcelInfo.carriedBy;
        this.position = new Position(parcelInfo.x, parcelInfo.y);
    }

    /**
     * Checks if the parcel is carried by the current agent.
     * 
     * @returns {boolean} True if the parcel is carried by the agent, false otherwise.
     */
    isMine() {
        return this.carriedBy === this.agent.agentID;
    }
    
    /**
     * Checks if the parcel is taken by another agent.
     * 
     * @returns {boolean} True if the parcel is carried by another agent, false otherwise.
     */
    isTaken() {
        return this.carriedBy !== null && this.carriedBy !== this.agent.agentID;
    }

    /**
     * Checks if the parcel is free (not carried by any agent).
     * 
     * @returns {boolean} True if the parcel is not carried by any agent, false otherwise.
     */
    isFree() {
        return this.carriedBy === null;
    }

    toString() {
        return `Parcel ID: ${this.id} (Mine:${this.isMine()}), Position: (${this.position.toString()}), Reward: ${this.reward}, CarriedBy: ${this.carriedBy}`;
    }
}
