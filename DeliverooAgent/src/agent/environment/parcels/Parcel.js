import { Position } from "../../../utils/Position.js"
import { Agent } from "../../agent.js"

export class Parcel{

    /** 
    * Constructor for a single parcel wrapper object.
    * 
    * @param {Object} parcel - parcel information from percept
    * @param {Agent} agent - parcels manager
    */
    constructor(parcel, agent) {
        this.agent = agent
        this.id = parcel.id
        this.position = new Position(parcel.x, parcel.y)
        this.reward = parcel.reward
        this.carriedBy = parcel.carriedBy
        this.deliveryDistance = this.agent.environment.getNearestDeliveryTile(this.position).path.actions.length;

        if(this.agent.PARCEL_DECADING_INTERVAL != 'infinite'){
            setInterval(() => {
                this.reward -= (this.agent.PARCEL_DECADING_INTERVAL / 1000)
                if (this.reward == 0)
                    this.agent.parcels.deleteParcel(this.id)
                
            }, this.agent.PARCEL_DECADING_INTERVAL)
        }
    }

    update(parcelInfo) {
        this.reward = parcelInfo.reward
        this.carriedBy = parcelInfo.carriedBy
        this.position = new Position(parcelInfo.x, parcelInfo.y)
    }

    isMine() {
        return this.carriedBy == this.agent.agentID
    }
    
    isTaken() {
        return this.carriedBy != null && this.carriedBy != this.agent.agentID
    }

    isFree(){
        return this.carriedBy == null
    }

    
    toString() {
        return `Parcel ID: ${this.id} (Mine:${this.isMine()}), Position: (${this.position.toString()}), Reward: ${this.reward}, CarriedBy: ${this.carriedBy}`;
    }
}