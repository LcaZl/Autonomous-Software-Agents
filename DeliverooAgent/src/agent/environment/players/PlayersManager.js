import { Player } from "./player.js";

/**
 * Manages enemy and randomly moving players in the game, tracking their positions and statuses.
 */
export class PlayersManager {
    /**
     * Constructs a new instance of PlayersManager.
     * 
     * @param {Agent} agent - The agent associated with this manager.
     */
    constructor(agent) {
        this.agent = agent;
        this.inGamePlayers = 0;
        this.playersList = new Map();
        this.ids = new Set();
        this.agent.log('[INIT] Enemy Agents Manager Initialized');
    }

    /**
     * Retrieves the list of all players.
     * 
     * @returns {Map} A map of all players.
     */
    getPlayers() { return this.playersList; }

    /**
     * Activates the players manager by setting up event listeners.
     */
    activate() {
        this.agent.eventManager.on('players_percept', (sensedPlayers) => this.handlePlayersSensing(sensedPlayers));
    }

    /**
     * Retrieves the current positions of all visible players.
     * 
     * @returns {Position[]} An array of positions of the players.
     */
    getCurrentPositions() {
        let positions = [];
        for (let player of this.playersList.values()) {
            if (!player.isLost()) {
                positions.push(player.getCurrentPosition());
            }
        }
        return positions;
    }

    /**
     * Handles the sensing of players, updating the manager's state accordingly.
     * 
     * @param {Object[]} players - An array of sensed player objects.
     */
    handlePlayersSensing(players) {
        let updates = false;

        // Update or add new players
        for (let player of players) {
            if (player.x % 1 === 0 && player.y % 1 === 0) {
                if (this.ids.has(player.id)) {
                    let updated = this.playersList.get(player.id).update(player);
                    updates = updates || updated;
                } else {
                    this.inGamePlayers++;
                    this.ids.add(player.id);
                    let newPlayer = new Player(this.agent, player);
                    this.playersList.set(player.id, newPlayer);
                    updates = true;
                }
            }
        }

        // Check and mark players no longer visible
        this.playersList.forEach((player, id) => {
            if (!players.some(p => p.id === id)) {
                player.disappeared();
                updates = true;
            }
        });

        if (updates){
            this.agent.eventManager.emit('update_players_beliefs')
            this.agent.eventManager.emit('update_options')
        }
    }
}
