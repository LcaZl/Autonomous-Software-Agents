import { Position } from "../../../utils/Position.js";

/**
 * Represents a player in the game, managing information and tracking movement.
 */
export class Player {
    /**
     * Constructs a new Player instance.
     * 
     * @param {Agent} agent - The agent controlling this player.
     * @param {Object} player - Initial information about the player.
     */
    constructor(agent, player) {
        this.agent = agent;
        this.id = player.id;
        this.name = player.name;
        this.currentPosition = new Position(player.x, player.y);
        this.lastPosition = new Position(player.x, player.y);
        this.lost = false;
        this.score = player.score;
        this.positionHistory = new Map();
        this.positionHistory.set(Date.now(), this.currentPosition);
        console.log('[AGENT][NEW_PLAYER] ', this.name, ' entered in tile', this.currentPosition.toString());
    }

    /**
     * Updates the player's state with new information.
     * 
     * @param {Object} player - The latest information about the player.
     * @returns {boolean} True if the player's position has changed, otherwise false.
     */
    update(player) {
        let positionalUpdates = false;
        this.score = player.score;

        if (this.lost) {
            positionalUpdates = true;
        }

        this.lost = false;

        if (player.x !== this.currentPosition.x || player.y !== this.currentPosition.y) {
            let newPosition = new Position(player.x, player.y);
            this.lastPosition = this.currentPosition;
            this.currentPosition = newPosition;
            this.positionHistory.set(Date.now(), this.currentPosition);
            //console.log('[AGENT][PLAYER ', this.name, '] Moved from', this.lastPosition, 'to', this.currentPosition);
            positionalUpdates = true;
        }

        return positionalUpdates;
    }

    /**
     * Gets the current position of the player.
     * 
     * @returns {Position} The current position.
     */
    getCurrentPosition() {
        return this.currentPosition;
    }

    /**
     * Gets the last known position of the player.
     * 
     * @returns {Position} The last position.
     */
    getLastPosition() {
        return this.lastPosition;
    }

    /**
     * Checks if the player is lost.
     * 
     * @returns {boolean} True if lost, otherwise false.
     */
    isLost() {
        return this.lost;
    }

    /**
     * Marks the player as lost.
     */
    disappeared() {
        this.lost = true;
    }

    toString() {
        return `[ID: ${this.id}, Name: ${this.name}, Score: ${this.score}, Position: (${this.currentPosition.toString()}), Last Position: (${this.lastPosition.x}, ${this.lastPosition.y}), Lost: ${this.lost}]`;
    }
}
