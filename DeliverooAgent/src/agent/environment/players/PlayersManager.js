import { Position } from "../../../utils/Position.js"
import { Agent } from "../../agent.js"
import { Player } from "./player.js"

/**
 * The Players class manages all enemy and random moving players in the game.
 */
export class PlayersManager{

    /**
     * Constructs a new instance of the Players class.
     * 
     * @param {Agent} agent
    */
    constructor(agent) {
        this.agent = agent
        this.inGamePlayers = 0;
        this.playersList = new Map()
        this.ids = new Set()
        this.agent.log('[INIT] Enemy Agents Manager Initialized')
    }

    getPlayers() { return this.playersList }

    activate(){
        this.agent.eventManager.on('players_percept', ((sensedPlayers) => this.handlePlayersSensing(sensedPlayers)))
    }

    getCurrentPositions() {
        let positions = []
        for (let player of this.playersList.values()) {
            if (!player.lost)
                positions.push(player.getCurrentPosition())
        }
        return positions
    }
    
    handlePlayersSensing(players) {

        let updates = false
        for (let player of players){

            if (player.x % 1 == 0 && player.y % 1 == 0) {

                if (this.ids.has(player.id)) {

                    let updated = this.playersList.get(player.id).update(player)
                    if (!updates)
                        updates = updated

                } else {

                    this.inGamePlayers += 1;
                    this.ids.add(player.id);
                    let newPlayer = new Player(this.agent, player)
                    this.playersList.set(player.id, newPlayer);
                    updates = true
                }
            }
        }

        // Check if there are player no more visible
        for (let playerId of this.playersList.keys()) {
            if (!players.some((player) => player.id == playerId)) {
              this.playersList.get(playerId).disappeared()
              updates = true
            }
        }

        if (updates)
            this.agent.eventManager.emit('update_players_beliefs')
    }
} 
