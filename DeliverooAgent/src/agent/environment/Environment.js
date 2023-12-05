import { Position } from '../../utils/Position.js';
import { Agent } from '../agent.js';

/**
 * Represents the game environment, handling map information, pathfinding, and position validation.
 */
export class Environment {
  /**
   * Constructs a new instance of the Environment class.
   * 
   * @param {Agent} agent - The agent associated with the environment.
   */
  constructor(agent) {
    this.agent = agent;
    let { width, height, tiles } = this.agent.client.map;
    this.tiles = tiles;
    this.mapWidth = width;
    this.mapHeight = height;
    this.searchCalls = 0;
    this.cacheHit = 0;
    this.fullMap = Array(this.mapHeight).fill().map(() => Array(this.mapWidth).fill(0));
    tiles.forEach(tile => this.fullMap[tile.x][tile.y] = tile.delivery ? 2 : 1);

    this.deliveryTiles = new Set(tiles.filter(tile => tile.delivery).map(tile => new Position(tile.x, tile.y)));
    this.exploredTiles = Array.from(this.fullMap);
    this.cache = new Map();

    console.log("[INIT] Environment information initialized.");
  }

  /**
   * Checks if the agent is on a delivery tile.
   * 
   * @returns {boolean} True if the agent is on a delivery tile, otherwise false.
   */
  onDeliveryTile() {
    return [...this.deliveryTiles].some(pos => pos.isEqual(this.agent.currentPosition));
  }
  

  /**
   * Validates if a given position is within the game boundaries and not an enemy position.
   * 
   * @param {number} x - The x-coordinate of the position.
   * @param {number} y - The y-coordinate of the position.
   * @returns {boolean} True if the position is valid, otherwise false.
   */
  isValidPosition(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight &&
           this.fullMap[x][y] !== 0 && !this.isEnemyPosition(new Position(x, y));
  }

  /**
   * Checks if a given position is occupied by an enemy.
   * 
   * @param {Position} checkPos - The position to check.
   * @returns {boolean} True if an enemy occupies the position, otherwise false.
   */
  isEnemyPosition(checkPos) {
    const enemyPlayersPositions = this.agent.players.getCurrentPositions();
    return enemyPlayersPositions.some(pos => pos.isEqual(checkPos));
  }

  /**
   * Determines if a given path is safe from enemies.
   * 
   * @param {Position[]} path - The path to check.
   * @returns {boolean} True if the path is safe, otherwise false.
   */
  isPathSafe(path) {
    return !path.some(position => this.isEnemyPosition(position));
  }

  /**
   * Generates a random position within the game environment that is not the agent's current position.
   * 
   * @returns {Position} A random valid position.
   */
  getRandomPosition() {
    let position;
    do {
      let idx = Math.round(Math.random() * (this.tiles.length - 1));
      let tile = this.tiles[idx];
      position = new Position(tile.x, tile.y);
    } while (position.isEqual(this.agent.currentPosition));

    //this.agent.log('[ENVIRONMENT] Random position:', position);
    return position;
  }

  /**
   * Generates a key for caching based on start and end positions.
   * 
   * @param {Position} startPosition - The starting position.
   * @param {Position} endPosition - The ending position, can be null for delivery.
   * @returns {string} A unique key for the given positions.
   */
  positionKey(startPosition, endPosition) {
    return endPosition === null
      ? `${startPosition.x},${startPosition.y}-Delivery`
      : `${startPosition.x},${startPosition.y}-${endPosition.x},${endPosition.y}`;
  }

  /**
   * Finds the shortest path from a start to an end position.
   * 
   * @param {Position} startPosition - The starting position.
   * @param {Position} endPosition - The ending position.
   * @returns {Object} The shortest path and associated actions.
   */
  getShortestPath(startPosition, endPosition) {
    return this.bfsSearch(startPosition, endPosition, "path");
  }

  /**
   * Finds the nearest delivery tile from a given position.
   * 
   * @param {Position} position - The starting position.
   * @returns {Object} The nearest delivery tile information.
   */
  getNearestDeliveryTile(startPosition) {
    let endPosition = this.getEstimatedNearestDeliveryTile(startPosition)
    return this.bfsSearch(startPosition, endPosition, "delivery");
  }
  
  /**
   * Breadth-first search algorithm for finding paths in the environment.
   * 
   * @param {Position} startPosition - The starting position.
   * @param {Position} endPosition - The ending position.
   * @param {string} mode - The search mode ('path' or 'delivery').
   * @returns {Object} The path information including positions and actions.
   */
  bfsSearch(startPosition, endPosition, mode) {
    const cacheKey = this.positionKey(startPosition, endPosition)
    this.searchCalls += 1

    if (this.cache.has(cacheKey) && this.isPathSafe(this.cache.get(cacheKey).path.positions)) {
        this.cacheHit += 1
        this.cache.get(cacheKey).uses++
        if(this.cache.get(cacheKey).uses >= 2)
          this.cache.delete(cacheKey)
        else
          return this.cache.get(cacheKey);
    }

    const visited = new Set();
    const queue = [{ finalPosition: startPosition, startPosition: startPosition, uses:0, path: { positions: [], actions: [] } }];

    while (queue.length > 0) {
        const current = queue.shift();

        const x = current.finalPosition.x;
        const y = current.finalPosition.y;

        if (visited.has(`${x},${y}`)) continue;
        visited.add(`${x},${y}`);

        const directions = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']];
        for (const [dx, dy, action] of directions) {
            const newPos = new Position(x + dx, y + dy);

            if (this.isValidPosition(newPos.x, newPos.y) && !visited.has(`${newPos.x},${newPos.y}`)) {
              let node = {
                finalPosition: newPos,
                startPosition: startPosition,
                length : [...current.path.actions, action].length,
                uses : 0,
                path: {
                    positions: [...current.path.positions, newPos],
                    actions: [...current.path.actions, action]
                }
              }
              queue.push(node);

              // Add subpaths
              const subPathKey = this.positionKey(startPosition, node.finalPosition);
              if (!this.cache.get(subPathKey)) {
                this.cache.set(subPathKey, node);
              }

              if (newPos.isEqual(endPosition)) {
                //console.log('[ENVIRONMENT][BFS_success] BFS for ',mode,' from', node.startPosition, ' to ', node.finalPosition);
                this.cache.set((cacheKey || this.positionKey(startPosition, current.finalPosition)), node);
                return node;
              }
            }
        }
    }
    //console.log('[ENVIRONMENT][BFS_FAILED] BFS for ',mode,' from', startPosition, 'failed (endPosition:', endPosition,')');
    return {startPosition : startPosition, finalPosition: startPosition, length : 0}
  }

  getEstimatedNearestDeliveryTile(currentPosition) { 
    let closestDelivery = null;
    let bestDistance = Infinity; // Imposta una distanza massima iniziale

    for (let position of this.deliveryTiles) {
      if (!this.isEnemyPosition(position)){
        let dist = position.distanceTo(currentPosition)
        if (dist < bestDistance) {
            bestDistance = dist;
            closestDelivery = position;
        }
      }
    }

    return closestDelivery ? closestDelivery : null
  }
}


/**
 *   

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
  
      //this.agent.log('[ENVIRONMENT] Random movement - Exploration map:\n')
      this.agent.printMap(this.exploredTiles)
      return direction;
    }

  // Increases the temperature of the agent's current position, indicating recent visitation.
  increaseTemperature() {
    const position = this.agent.currentPosition;
    const obs = this.agent.AGENTS_OBSERVATION_DISTANCE * 2;
    this.exploredTiles[position.x][position.y] += obs;
  }

  // Decreases the temperature of all tiles, indicating a decrease in recent visitation.
  decreaseTemperature() {
    for (let i = 0; i < this.exploredTiles.length; i++) {
      for (let j = 0; j < this.exploredTiles[i].length; j++) {
        this.exploredTiles[i][j] = Math.max(0, this.exploredTiles[i][j] - 1);
      }
    }
  }

 */