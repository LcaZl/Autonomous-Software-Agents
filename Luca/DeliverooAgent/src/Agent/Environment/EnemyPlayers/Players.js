import { Player } from "./player.js"

/**
 * The Players class manages all enemy and random moving players in the game.
 */
export class Players{

    /**
     * Constructs a new instance of the Players class.
     * 
     * @param {Object} environment - The environment in which the game is played.
    */
    constructor(environment){
        this.environment = environment
        // Get info about any random moving agent deployed by the server in the environment.
        this.haAgentsSpeed = parseInt(this.environment.getConfig().RANDOM_AGENT_SPEED) * 1000
        this.haAgents = this.environment.getConfig().RANDOMLY_MOVING_AGENTS

        this.playersList = new Map()
        this.ids = new Set()
        console.log('[INIT][PLYS] Players Manager Instantieted. Randomly moving agents:', this.haAgents, '(Speed: ', this.haAgentsSpeed,')')
    }

    /**
     * Adds or updates players information.
     * 
     * @param {Array} players - An array of new or updated players (from a percept)
     * @returns {boolean} Returns true if the list of players has been modified, false otherwise.
    */
    addPlayers(players) {
        let modified = false
        for (let player of players){
            if (player.x % 1 == 0 && player.y % 1 == 0) {
                if (this.playersList.has(player.id)) {
                    modified = this.playersList.get(player.id).update(player)
                } else {
                    this.inGamePlayers += 1;
                    this.ids.add(player.id);
                    const newPlayer = new Player(player)
                    this.playersList.set(player.id, newPlayer);
                    modified = true
                }
            }
        }

        for (let playerId of this.playersList.keys()) {
            if (!players.some((player) => player.id == playerId)) {
              this.playersList.get(playerId).setLost()
            }
          }
        return modified
    }

    /**
     * Returns all the players in the game.
     * @returns {IterableIterator} An iterable iterator of the players.
    */
    getValues() {
        return this.playersList.values()    
    }

    /**
     * Returns the number of players in the game.
     * @returns {number} The number of players in the game.
    */
    getPlayersCount() {
        return this.ids.size
    }
}
