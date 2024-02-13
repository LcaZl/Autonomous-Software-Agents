import { Position } from "../../utils/Position.js"

/**
 * Represents a player in the game, encapsulating player details and movement history.
 */
export class Player {
    /**
     * Initializes a new Player instance with initial data and associates it with an agent.
     * 
     * @param {Agent} agent - The agent instance controlling this player.
     * @param {Object} player - Initial data about the player including ID, name, score, and position.
     * @param {boolean} [teamMate=false] - Flag indicating whether the player is a teammate.
     */
    constructor(agent, player, teamMate = false) {
        this.agent = agent
        this.teammate = teamMate
        this.id = player.id
        this.name = player.name
        this.lastUpdateTime = Date.now() // To track if disappear
        this.currentPosition = new Position(player.x, player.y)
        this.lastPosition = this.currentPosition // Initially, last and current positions are the same
        this.lost = false // Flag to indicate if the player is lost
        this.score = player.score
        this.positionHistory = new Map([[Date.now(), this.currentPosition]]) // Tracks position over time
        //console.log('[AGENT][NEW_PLAYER]', this.name, ' entered in tile', this.currentPosition)
    }

    /**
     * Provides a simplified representation of the player's current state.
     * 
     * @returns {Object} The raw data of the player.
     */
    raw() {
        return { 
            id: this.id, 
            x: this.currentPosition.x, 
            y: this.currentPosition.y, 
            name: this.name, 
            score: this.score
        }
    }

    /**
     * Updates the player's state based on new data, tracking positional changes.
     * 
     * @param {Object} player - New data for the player.
     * @returns {boolean} Indicates if the player's position has changed.
     */
    update(player) {
        this.score = player.score
        let newPos = new Position(player.x, player.y)
        this.lost = false
        this.lastUpdateTime = Date.now()

        if (!newPos.isEqual(this.currentPosition)) {
            this.lastPosition = this.currentPosition
            this.currentPosition = newPos
            this.positionHistory.set(Date.now(), newPos)
            return true // Position has changed
        }

        return false // No positional change
    }

    /**
     * Directly updates the player's position if different from the current one.
     * 
     * @param {Position} newPos - The new position to update to.
     * @returns {boolean} True if the position was updated, false otherwise.
     */
    updatePosition(newPos) {
        if (!newPos.isEqual(this.currentPosition)) {
            this.lastPosition = this.currentPosition
            this.currentPosition = newPos
            return true // Position updated
        }
        return false // No update made
    }

    /**
     * Change player state when its no more visible for more than 1 second.
     * Send notification.
     */
    disappeared() { 
        this.lost = true
        this.agent.eventManager.emit('update_options')
    }

    // Getter methods for current and last positions, lost status and a toString method for logging
    getCurrentPosition() { return this.currentPosition }
    getLastPosition() { return this.lastPosition }
    isLost() { return this.lost }

    toString() {
        return `[ID: ${this.id}, Teammate: ${this.teammate}, Name: ${this.name}, Score: ${this.score}, Position: ${this.currentPosition}, Last Position: ${this.lastPosition}, Lost: ${this.lost}]`
    }
}
