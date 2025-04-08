import { TeamManager } from "../../multiagent/TeamManager.js"
import { Player } from "./player.js"

/**
 * Manages enemy and randomly moving players in the game, maintaining a list of players, tracking their positions
 * and managing status such as whether they are in the game or have been marked as lost.
 */
export class PlayersManager {
    /**
     * Initializes the manager with the associated agent and sets up player tracking structures.
     * 
     * @param {Agent} agent - The agent associated with this manager.
     */
    constructor(agent, playerCheckInterval, disappearedPlayerValidity) {
        this.agent = agent
        this.inGamePlayers = 0 // Counter for the number of players currently in the game
        this.playersList = new Map() // Stores player objects with their IDs as keys
        this.ids = new Set() // Tracks the IDs of all players for quick lookup
        this.disappearedPlayerValidity = disappearedPlayerValidity
        // If part of a multi-agent system, include the agent's teammate in the players list
        if (agent.multiagent) {
            this.myTeammate = agent.team.playerObj // Reference to the agent's teammate
            this.playersList.set(this.myTeammate.id, this.myTeammate)
            this.ids.add(this.myTeammate.id)
            this.inGamePlayers++ // Increment the count of players in the game
        }

        setInterval(() => {
            this.checkPlayersDisappearance()
        }, playerCheckInterval)

        console.log('[INIT] Players Manager Initialized')
    }

    /**
     * Sets up event listeners to process player perceptions, including those from team communications in multi-agent setups.
     */
    activate() {
        // Handle direct perceptions of players
        this.agent.eventManager.on('players_percept', sensedPlayers => this.handlePlayersSensing(sensedPlayers))

        // Handle perceptions of players communicated by teammates
        if (this.agent.multiagent) {
            this.agent.eventManager.on('players_percept_from_team', sensedPlayers => this.handlePlayersSensing(sensedPlayers, true))
        }
    }

    /**
     * Returns a map of all tracked players.
     * 
     * @returns {Map} A map of player IDs to Player objects.
     */
    getPlayers() {
        return this.playersList
    }

    /**
     * Retrieves the current positions of all visible (non-lost) players.
     * 
     * @returns {Position[]} An array of current positions for all visible players.
     */
    getCurrentPositions() {
        return Array.from(this.playersList.values())
            .filter(player => !player.isLost()) // Exclude lost players
            .map(player => player.getCurrentPosition()) // Map to current positions
    }

    /**
     * Returns a raw data array of all players except the agent's teammate.
     * 
     * @returns {Object[]} Array containing raw data of each player.
    */
    getRawPlayers() {
        return Array.from(this.playersList.values())
            .filter(p => !p.teammate)
            .map(p => p.raw())
    }
    
    /**
     * Processes sensed player data to update existing player records or add new ones. It also marks players as lost if they are no longer visible.
     * 
     * @param {Object[]} players - An array of sensed player data.
     */
    handlePlayersSensing(players, fromCommunication = false) {
        let updates = false

        players.forEach(player => {
            if (player.x % 1 === 0 && player.y % 1 === 0) { // Validate player positions
                if (this.ids.has(player.id)) {
                    // Update existing player
                    updates = this.playersList.get(player.id).update(player)
                } else {
                    // Add new player
                    this.inGamePlayers++
                    this.ids.add(player.id)
                    this.playersList.set(player.id, new Player(this.agent, player))
                    updates = true
                }
            }
        })

        // Emit relevant events if there were any updates
        if (updates) {
            if (this.agent.moveType === 'PDDL') {
                this.agent.eventManager.emit('update_players_beliefs')
            }
            if (this.agent.multiagent && !fromCommunication) {
                this.agent.eventManager.emit('new_players_info')
            }
            this.agent.eventManager.emit('update_options')
        } else {
            this.playerInView = false // Flag to indicate no players in view
        }
    }
    
    checkPlayersDisappearance() {
        const currentTime = Date.now()
        this.playersList.forEach(player => {
            if (currentTime - player.lastUpdateTime > this.disappearedPlayerValidity) { // 5 secondi sono trascorsi
                player.disappeared() // Marca il giocatore come scomparso
            }
        })
    }
    /**
     * Updates the position of the teammate based on new input.
     * 
     * @param {string} agentId - The ID of the teammate.
     * @param {Position} newPos - The new position of the teammate.
     */
    updateTeammatePosition(agentId, newPos) {
        const player = this.playersList.get(agentId)
        if (player && player.updatePosition(newPos)) {
            if (this.agent.beliefs) {
                this.agent.beliefs.updateTeammatePosition(agentId, newPos)
            }
        }
    }

}
