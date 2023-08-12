
/**
 * The Player class models the information and behavior of a player in the game.
 */
export class Player{

    /**
     * Constructs a new instance of the Player class. This class manage the information abount each
     * enemy player detected. 
     * 
     * @param {Object} player - The initial state of the player.
    */
    constructor(player){
        this.id = player.id
        this.name = player.name
        this.currentPosition = { 'x': player.x, 'y': player.y }
        this.lastPosition = { 'x': player.x, 'y': player.y }
        this.lost = false
        this.score = player.score
        this.positionHistory = new Map()
        this.positionHistory.set(Date.now(), this.currentPosition)
        console.log('[PLAYER][NWPL] ',this.name,' entered in tile',this.currentPosition)
    }

    /**
     * Updates all information about a player, its current and last position and the history of movements.
     * 
     * @param {Object} player - The new state of the player.
     * @returns {boolean} Returns true if the player's position has changed, false otherwise.
    */
    update(player) {

        let updated = false
        if (player.x != this.currentPosition.x || player.y != this.currentPosition.y) {
            let newPosition = {'x':player.x,'y':player.y}
            this.lastPosition = this.currentPosition
            this.currentPosition = newPosition
            const timestamp = Date.now();
            this.positionHistory.set(timestamp, this.currentPosition);
            
            console.log('[PLAYER][UPDT] Player', this.name, ' moved from', this.lastPosition, 'to', this.currentPosition)
            updated = true
        }
        this.score = player.score
        this.lost = false
        return updated
    }

    /**
     * Prints the state of the player.
     * @param {number} i - An index for the player.
    */
       info(i) {
        console.log(i,' - [ID: ',this.id,', Name: ',this.name,', Score: ',this.score,', Position:',this.currentPosition,' Last Position:',this.lastPosition,' Lost:',this.lost,']')
    }

    /**
     * Returns the current position of the player.
     * @returns {Object} The current position of the player.
    */
    getCurrentPosition() {
        return this.currentPosition
    }

    /**
     * Returns the last known position of the player.
     * @returns {Object} The last known position of the player.
    */
    getLastPosition() {
        return this.lastPosition
    }

    /**
     * Returns the current score of the player.
     * @returns {number} The current score of the player.
    */
    getScore() {
        return this.score
    }

    /**
     * Sets the lost status of the player to true.
    */
    setLost() { 
        this.lost = true
    }

    /**
     * Returns the lost status of the player.
     * @returns {boolean} True if the player is lost, false otherwise.
    */
    isLost() { 
        return this.lost
    }
}