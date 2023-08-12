#!/usr/bin/env node
import { distance } from '../../utils.js';
import { Parcels } from "./Parcels/parcels.js";
import { Players } from "./EnemyPlayers/Players.js";

/**
 * The Environment class represents the game environment.
 * This class store, manage and update the information of the enviroment in which the agent is deployed.
 */
export class Environment {
  
  /**
   * Constructs a new instance of the Environment class.
   * 
   * @param {Object} map - The map of the game.
   * @param {Object} config - The game configuration.
   * @param {Object} me - The agent in the environment.
  */
  constructor(map, config, me) {

    this.config = config
    const { width, height, tiles } = map;
    this.mapWidth = width;
    this.mapHeight = height;
    this.availableMap = tiles;
    this.agent = me

    this.fullMap = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0));

    // fullMap is a matrix which rapresents the game environment
    for (const tile of this.availableMap) {
      const { x, y, delivery, parcelSpawner } = tile;
      if (delivery) this.fullMap[x][y] = 2
      else this.fullMap[x][y] = 1
    }

    // Store only the delivery tiles
    this.deliveryTiles = new Map()
    for (let el of this.availableMap){
      if (el.delivery == true) {
        let tilePosition = { 'x': el.x, 'y': el.y}
        this.deliveryTiles.set(tilePosition , distance(tilePosition, this.agent.getCurrentPosition()))
      }
    }

    this.players = new Players(this)
    this.parcels = new Parcels(this)
    console.log("[INIT][ENV ] Environment Instantiated.");
    return this
  }

  /**
   * Updates the distances of delivery tiles from the agent actual position.
  */
  updateDeliveryTilesDistance() { 
    for (let {pos, distance} of this.deliveryTiles) {
      distance = distance(pos, this.agent.getCurrentPosition())
    }
  }

  /**
   * Checks if the agent is on a delivery tile.
   * 
   * @returns {boolean} Returns true if the agent is on a delivery tile, false otherwise.
  */
  onDeliveryTile() {
    const tilePosition = { 'x': this.agent.getCurrentPosition().x, 'y': this.agent.getCurrentPosition().y };    
    for (const [key, value] of this.deliveryTiles) {
      if (key.x === tilePosition.x && key.y === tilePosition.y) {
        return true;
      }
    } 
    return false;
  }

  /**
   * Gets the available directions for the agent.
   * 
   * @returns {Array} Returns an array of available directions.
  */
  async getAvailbleDirections() { 
    let right = 0
    let left = 0
    let up = 0
    let down = 0
    if(this.agent.getCurrentPosition().x < 9)
      right = this.fullMap[this.agent.getCurrentPosition().x + 1][this.agent.getCurrentPosition().y]
    if(this.agent.getCurrentPosition().x > 0)
      left = this.fullMap[this.agent.getCurrentPosition().x - 1][this.agent.getCurrentPosition().y]
    if(this.agent.getCurrentPosition().y < 9)
      up = this.fullMap[this.agent.getCurrentPosition().x][this.agent.getCurrentPosition().y + 1]
    if(this.agent.getCurrentPosition().y > 0)
      down = this.fullMap[this.agent.getCurrentPosition().x][this.agent.getCurrentPosition().y - 1]
    let availableDirection = []
    if (right == 1 || right == 2)
      availableDirection.push('right')
    if (left == 1 || left == 2)
      availableDirection.push('left')
    if (up == 1 || up == 2)
      availableDirection.push('up')
    if (down == 1 || down == 2)
      availableDirection.push('down')
    return availableDirection
  }
  
  /**
   * Returns the enemy players in the environment.
   * 
   * @returns {Players} The players in the environment.
  */
  getPlayers() {
      return this.players
  }

  /**
   * Returns the parcels in the environment.
   * 
   * @returns {Parcels} The parcels in the environment.
  */
  getParcels() {
      return this.parcels
  }

  /**
   * Returns the delivery tiles in the environment.
   * 
   * @returns {Map} The delivery tiles in the environment.
  */
  getDeliveryTiles(){
    return this.deliveryTiles
  }

  /**
   * Returns the game configuration.
   * 
   * @returns {Object} The game configuration.
  */
  getConfig() { 
    return this.config
  }

  /**
   * Returns the full map (matrix) of the environment.
   * 
   * @returns {Array} The full map of the environment.
  */
  getFullMap(){
    return this.fullMap
  }
}

