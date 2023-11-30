import { Position } from "../../../utils/Position.js"

/**
 * The Player class models the information and behavior of a player in the game.
 */
export class Player{

    /**
     * Constructs a new instance of the Player class. This class manage the information abount each
     * enemy player detected. 
     * 
     * @param {Object} player - The initial information about a player.
    */
    constructor(agent, player){
        this.agent = agent
        this.id = player.id
        this.name = player.name
        this.currentPosition = new Position(player.x, player.y)
        this.lastPosition = new Position(player.x, player.y)
        this.lost = false
        this.score = player.score
        this.positionHistory = new Map()
        this.positionHistory.set(Date.now(), this.currentPosition)
        this.agent.log('[NEWPLAYER] ' ,this.name, ' entered in tile', this.currentPosition.toString())
    }
    update(player) {

        let positionalUpdates = false
        this.score = player.score
        if (this.lost)
            positionalUpdates = true

        this.lost = false

        if (player.x != this.currentPosition.x || player.y != this.currentPosition.y) {
            let newPosition = new Position(player.x, player.y)
            this.lastPosition = this.currentPosition
            this.currentPosition = newPosition
            this.positionHistory.set(Date.now(), this.currentPosition);
            this.agent.log('[PLAYER ', this.name,' ] Moved from', this.lastPosition, 'to', this.currentPosition)
            positionalUpdates = true
        }

        return positionalUpdates
    }

    getCurrentPosition() { return this.currentPosition }

    getLastPosition() { return this.lastPosition }

    isLost() { return this.lost }

    disappeared() { this.lost = true }

    toString() {
        return `[ID: ${this.id}, Name: ${this.name}, Score: ${this.score}, Position: (${this.currentPosition.toString()}), Last Position: (${this.lastPosition.x}, ${this.lastPosition.y}), Lost: ${this.lost}`
    }
}