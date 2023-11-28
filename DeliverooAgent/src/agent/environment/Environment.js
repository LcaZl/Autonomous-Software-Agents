#!/usr/bin/env node
import { PriorityQueue } from '../../utils/PriorityQueue.js';
import { Position } from '../../utils/Position.js';
import { Agent } from '../agent.js';
/**
 * The Environment class represents the game environment.
 */
export class Environment {
  
  /**
   * Constructs a new instance of the Environment class.
   * 
   * @param {Agent} agent
  */
  constructor(agent) {
    
    this.agent = agent
    let { width, height, tiles } = this.agent.client.map;
    this.mapWidth = width;
    this.mapHeight = height;
    this.searchCalls = 0
    this.cacheHit = 0
    this.fullMap = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0))
    tiles.forEach(tile => tile.delivery ? this.fullMap[tile.x][tile.y] = 2 : this.fullMap[tile.x][tile.y] = 1)
    
    // Filter and store only delivery tile
    this.deliveryTiles = new Set();
    tiles.forEach(tile => tile.delivery ? this.deliveryTiles.add(new Position(tile.x, tile.y)) : null)

    this.exploredTiles = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0));
    setInterval(() => this.decreaseTemperature(), this.agent.MOVEMENT_DURATION * (this.agent.AGENTS_OBSERVATION_DISTANCE + 1))

    this.cache = new Map();
    
    console.log("[INIT] Environment Information Initialized.");
    return this
  }

  onDeliveryTile() {
    for (let pos of this.deliveryTiles) 
      if (pos.isEqual(this.agent.currentPosition)) 
        return true
    return false
  }

  isValidPosition(x, y) {
    if (x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight)
      if (this.fullMap[x][y] != 0 && !this.isEnemyPosition(new Position(x, y)))
        return true
    return false
  }

  isEnemyPosition(checkPos){
    let enemyPlayersPositions = this.agent.players.getCurrentPositions();
    if (enemyPlayersPositions.length == 0)
      return false
    return enemyPlayersPositions.some(pos => pos.isEqual(checkPos));
  }



  /**
   * Gets the available directions for the agent.
   * 
   * @returns {Array<Object>} - Returns an array of available destination positions.
   */
  getAvailableDirections() {
    const currPos = this.agent.currentPosition;
    let direction = 'right';
    let bestScore = Infinity;

    // Definizione delle direzioni possibili e delle loro modifiche alle coordinate
    const directions = [
        {name: 'right', dx: 1, dy: 0, boundCheck: currPos.x < this.mapWidth},
        {name: 'left', dx: -1, dy: 0, boundCheck: currPos.x > 0},
        {name: 'up', dx: 0, dy: 1, boundCheck: currPos.y < this.mapHeight},
        {name: 'down', dx: 0, dy: -1, boundCheck: currPos.y > 0}
    ];

    // Iterazione sulle direzioni
    let scores = []
    for (const dir of directions) {
        if (dir.boundCheck) {
            const pos = new Position(currPos.x + dir.dx, currPos.y + dir.dy);
            if (this.isValidPosition(pos.x, pos.y)) {
                scores.push(this.exploredTiles[pos.x][pos.y])
                if (this.exploredTiles[pos.x][pos.y] < bestScore){
                  bestScore = this.exploredTiles[pos.x][pos.y];
                  direction = dir.name;
                }
            }
        }
    }

    console.log('[ENVIRONMENT] Random movement - Exploration map:\n')
    this.agent.printMap(this.exploredTiles)
    return direction;
  }

  /**
   * Given a tile, returns the nearest delivery tile.
   * 
   * @returns {Object} - The coordinates of the nearest delivery tile (nearest to the input tile).
   */
  getEstimatedNearestDeliveryTile() { 
    let closestDelivery = null;
    let bestDistance = Infinity; // Imposta una distanza massima iniziale

    for (let position of this.deliveryTiles) {
      if (!this.isEnemyPosition(position)){
        let dist = position.distanceTo(this.agent.currentPosition)
        if (dist < bestDistance) {
            bestDistance = dist;
            closestDelivery = position;
        }
      }
    }

    return closestDelivery ? closestDelivery : null
  }

  increaseTemperature() {
    let position = this.agent.currentPosition;
    let obs = this.agent.AGENTS_OBSERVATION_DISTANCE * 2;
    this.exploredTiles[position.x][position.y] += obs;
  }


  decreaseTemperature(){
    for (let i = 0; i < this.exploredTiles.length; i++) 
      for (let j = 0; j < this.exploredTiles[i].length; j++)
          this.exploredTiles[i][j] = Math.max(0, this.exploredTiles[i][j] - 1);
  }

  isPathSafe(path) {
    for (const position of path) {
        if (this.isEnemyPosition(position)) {
            return false;
        }
    }
    return true;
  }

  positionKey(startPosition, endPosition) {
    return `${startPosition.x},${startPosition.y}-${endPosition.x},${endPosition.y}`;
  }

  
  getShortestPath(startPosition, endPosition) {
    return this.bfsSearch(startPosition, endPosition, "path");
  }

  /**
   * 
   * @param {*} position 
   * @returns {Array}
   */
  getNearestDeliveryTile(position) {
      return this.bfsSearch(position, null, "delivery");
  }

  bfsSearch(startPosition, endPosition = null, mode = "path") {
    const cacheKey = endPosition ? this.positionKey(startPosition, endPosition) : null;
    this.searchCalls += 1

    if (mode === "path" && this.cache.get(cacheKey) && this.isPathSafe(this.cache.get(cacheKey).path.positions)) {
        this.cacheHit += 1
        return this.cache.get(cacheKey);
    }

    const visited = new Set();
    const queue = [{ position: startPosition, path: { positions: [], actions: [] } }];

    while (queue.length > 0) {
        const current = queue.shift();

        const x = current.position.x;
        const y = current.position.y;

        if (visited.has(`${x},${y}`)) continue;
        visited.add(`${x},${y}`);

        const directions = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']];
        for (const [dx, dy, action] of directions) {
            const newPos = new Position(x + dx, y + dy);

            if (this.isValidPosition(newPos.x, newPos.y) && !visited.has(`${newPos.x},${newPos.y}`)) {
              let node = {
                position: newPos,
                path: {
                    positions: [...current.path.positions, newPos],
                    actions: [...current.path.actions, action]
                }
              }
              queue.push(node);

              // Add subpaths
              const subPathKey = this.positionKey(startPosition, node.position);
              if (!this.cache.get(subPathKey)) {
                this.cache.set(subPathKey, node);
              }

              if ((mode == "delivery" && this.fullMap[newPos.x][newPos.y] == 2) || (mode == "path" && newPos.isEqual(endPosition))) {
                console.log('[ENVIRONMENT][BFS_SUCCESS] BFS for', mode, 'from', startPosition, 'to', node.position);
                this.cache.set((cacheKey || this.positionKey(startPosition, current.position)), node);
                return node;
              }
            }
        }
    }
    console.log('[ENVIRONMENT][BFS_FAILED] BFS for ',mode,' from', startPosition, 'failed (endPosition:', endPosition,')');
    return null
  }
}
