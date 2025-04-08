import { Position } from '../utils/Position.js'
import { Agent } from '../agent.js'

/**
 * Manages the game environment, including map information, pathfinding and position validations
 */
export class Environment {

  constructor(agent) {
    this.agent = agent
    let { width, height, tiles } = this.agent.client.map
    this.mapWidth = width
    this.mapHeight = height
    this.tiles = tiles
    this.deliveryTiles = new Set() // Tracks delivery tile positions
    
    // Initialize full map representation and delivery tiles
    this.fullMap = Array.from({ length: this.mapHeight }, () => Array(this.mapWidth).fill(0))
    tiles.forEach(tile => {
      this.fullMap[tile.x][tile.y] = tile.delivery ? 2 : 1
      if (tile.delivery) this.deliveryTiles.add(new Position(tile.x, tile.y))
    })

    this.exploredTiles = [...this.fullMap] // Clone of fullMap to track explored areas
    this.cache = new Map() // Caching for pathfinding or other computed data

    console.log("[INIT] Environment initialized with map size and tiles.")
  }

  /**
   * Determines if the agent is currently positioned on a delivery tile.
   * 
   * @returns {boolean} True if on a delivery tile, false otherwise.
   */
  onDeliveryTile() {
    return this.deliveryTiles.has(this.agent.currentPosition)
  }

  /**
   * Determines if a given position is a delivery tile.
   * 
   * @param {Position} pos - The position to check.
   * @returns {boolean} True if the position is a delivery tile, false otherwise.
   */
  isDeliveryPosition(pos) {
    return [...this.deliveryTiles].some(deliveryPos => deliveryPos.isEqual(pos))
  }

  /**
   * Validates whether a specified position is within the game bounds and not blocked.
   * 
   * @param {number} x - The x-coordinate of the position to validate.
   * @param {number} y - The y-coordinate of the position to validate.
   * @param {boolean} [noObs=false] - Flag to ignore obstacle check (e.g., for teammates positions).
   * @returns {boolean} True if the position is valid and accessible, false otherwise.
   */
  isValidPosition(x, y, noObs = false) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight && 
          this.fullMap[x][y] !== 0 && (noObs || !this.isEnemyPosition(new Position(x, y)))
  }

  /**
   * Checks if a given position is occupied by an enemy player.
   * 
   * @param {Position} checkPos - The position to check for an enemy presence.
   * @returns {boolean} True if an enemy is at the position, false otherwise.
   */
  isEnemyPosition(checkPos) {
    return this.agent.players.getCurrentPositions().some(pos => pos.isEqual(checkPos))
  }

  /**
   * Helper method to get adjacent positions around a given location.
   * 
   * @param {Position} pos - The central position to find adjacent positions for.
   * @returns {Position[]} An array of positions adjacent to the given location.
   */
  getAdjacentPositions(pos) {
    return [
      new Position(pos.x, pos.y + 1),
      new Position(pos.x, pos.y - 1),
      new Position(pos.x - 1, pos.y),
      new Position(pos.x + 1, pos.y)
    ]
  }

  /**
   * Verifies if an agent is adjacent to the current agent's position.
   * 
   * @param {string} agentId - The ID of the agent to check proximity for.
   * @returns {boolean} True if the specified agent is adjacent, false otherwise.
   */
  isNextToMe(agentId) {
    if (!this.agent.players.playersList.has(agentId)) return false
    const agentPosition = this.agent.players.playersList.get(agentId).currentPosition
    return this.getAdjacentPositions(this.agent.currentPosition).some(pos => pos.isEqual(agentPosition))
  }

  /**
   * Checks if a specified path is clear of enemies.
   * 
   * @param {Position[]} path - The sequence of positions forming the path to verify.
   * @returns {boolean} True if the path is free from enemies, false otherwise.
   */
  isPathSafe(path) {
    return !path.some(position => this.isEnemyPosition(position))
  }

  /**
   * Generates and returns a random position within the game environment that is not the agent's current position.
   * 
   * @returns {Position} A valid random position within the game map.
   */
  getRandomPosition() {
    let position
    do {
      const x = this.agent.client.config.MAP_FILE === 'challenge_32' ? this.agent.currentPosition.x : Math.floor(Math.random() * this.mapWidth)
      const y = Math.floor(Math.random() * this.mapHeight)
      const key = `${x}_${y}`

      if (this.fullMap[x][y] !== 0) {
        position = new Position(x, y)
      }
    } while (!position || position.isEqual(this.agent.currentPosition))

    return position
  }

  /**
   * Generates a unique key for caching paths based on start and end positions, supporting delivery destinations.
   * 
   * @param {Position} startPosition - The starting position.
   * @param {Position} endPosition - The ending position or null for delivery tiles.
   * @returns {string} A unique key for the given positions.
   */
  positionKey(startPosition, endPosition) {
    return endPosition
      ? `${startPosition.x},${startPosition.y}-${endPosition.x},${endPosition.y}`
      : `${startPosition.x},${startPosition.y}-Delivery`
  }

  /**
   * Finds the shortest path from a start to an end position using Breadth-First Search (BFS).
   * 
   * @param {Position} startPosition - The starting position.
   * @param {Position} endPosition - The ending position.
   * @returns {Object} The shortest path and associated actions.
   */
  getShortestPath(startPosition, endPosition, noObs = false) {
    return this.BFS(startPosition, endPosition, "path", noObs)
  }

  /**
   * Finds the nearest delivery tile from a given position using Breadth-First Search (BFS).
   * 
   * @param {Position} startPosition - The starting position.
   * @param {boolean} [noObs=false] - Flag to consider paths ignoring obstacles.
   * @returns {Object} The nearest delivery tile information.
   */
  getNearestDeliveryTile(startPosition, noObs = false) {
    return this.BFS(startPosition, null, "delivery", noObs)
  }

  /**
   * Estimates the nearest delivery tile from the current position based on Manhattan distance.
   * 
   * @param {Position} currentPosition - The current position to start from.
   * @returns {Object|null} The nearest delivery tile and its distance if found, null otherwise.
   */
  getEstimatedNearestDeliveryTile(currentPosition) {
    let closestDelivery = null
    let bestDistance = Infinity

    for (let position of this.deliveryTiles) {
      if (this.isValidPosition(position.x, position.y)) {
        let dist = currentPosition.distanceTo(position)
        if (dist < bestDistance) {
          bestDistance = dist
          closestDelivery = position
        }
      }
    }

    return closestDelivery ? { position: closestDelivery, distance: bestDistance } : null
  }


  // SEARCH


  /**
   * Breadth-first search algorithm for finding paths in the environment. It can be used to find
   * the shortest path between two points or to find the nearest delivery tile.
   * 
   * @param {Position} startPosition - The starting position for the search.
   * @param {Position} endPosition - The target end position for the search can be null for nearest delivery tile searches.
   * @param {string} mode - The search mode, either 'path' for specific endPosition or 'delivery' for nearest delivery tile.
   * @param {boolean} [noObs=false] - Optional flag to indicate whether obstacles should be ignored in the search.
   * @returns {Object} The path information, including positions and actions, or the nearest delivery tile information.
   */
  BFS(startPosition, endPosition, mode, noObs = false) {
    // Generate a unique cache key based on start and end positions
    const cacheKey = this.positionKey(startPosition, endPosition)
    this.agent.searchCalls += 1 // Increment search call count for diagnostics or performance tracking

    // Check if a path is already cached and if it's safe to use
    if (this.cache.has(cacheKey) && this.isPathSafe(this.cache.get(cacheKey).path.positions)) {
      const cachedPath = this.cache.get(cacheKey)
      // Check if the cached path has been used more than once
      if (cachedPath.uses > 1) {
        // Remove overly used paths to prevent stale data
        this.cache.delete(cacheKey)
      } else {
        // Cache hit, use the cached path
        this.agent.cacheHit += 1 // Track cache hits for performance optimization
        cachedPath.uses += 1 // Increment usage count for the cached path
        return cachedPath // Return the cached path
      }
    }

    // Initialize BFS structures
    const visited = new Set() // Track visited positions to prevent revisiting
    const queue = [{ finalPosition: startPosition, startPosition: startPosition, uses: 0, path: { positions: [], actions: [] } }]

    while (queue.length > 0) {
      const current = queue.shift() // Dequeue the next node

      const x = current.finalPosition.x
      const y = current.finalPosition.y

      // Skip already visited positions
      if (visited.has(`${x},${y}`)) continue
      visited.add(`${x},${y}`) // Mark the current position as visited

      // Define possible directions to move
      const directions = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'up'], [0, -1, 'down']]
      for (const [dx, dy, action] of directions) {
        const newPos = new Position(x + dx, y + dy) // Calculate new position based on direction

        // Check if the new position is valid and not visited
        if (this.isValidPosition(newPos.x, newPos.y, noObs) && !visited.has(`${newPos.x},${newPos.y}`)) {
          let node = {
            finalPosition: newPos,
            startPosition: startPosition,
            length: current.path.actions.length + 1,
            uses: 0,
            path: {
              positions: [...current.path.positions, newPos],
              actions: [...current.path.actions, action]
            }
          }
          queue.push(node) // Add the new node to the queue for further exploration

          // Check for goal condition based on the mode
          if ((mode === 'path' && newPos.isEqual(endPosition)) || (mode === 'delivery' && this.isDeliveryPosition(newPos))) {
            if (!noObs) {
              // Cache the found path for future use
              this.cache.set(cacheKey || this.positionKey(startPosition, current.finalPosition), node)
            }
            return node // Return the found path
          }
        }
      }
    }

    // If no path is found, return an indication of failure
    return { startPosition: startPosition, finalPosition: startPosition, length: 0 }
  }


  /**
   * Finds a meeting point between two positions using a bidirectional search strategy.
   * 
   * @param {Position} startPosition - The start position for the first search direction.
   * @param {Position} endPosition - The target position for the second search direction.
   * @returns {Object|null} The meeting point and combined path if found, null otherwise.
   */
  findMidpointBidirectional(startPosition, endPosition) {
    let queueStart = [{ position: startPosition, path: [startPosition] }]
    let queueEnd = [{ position: endPosition, path: [endPosition] }]
    let visitedStart = new Map([[`${startPosition.x},${startPosition.y}`, queueStart[0]]])
    let visitedEnd = new Map([[`${endPosition.x},${endPosition.y}`, queueEnd[0]]])

    while (queueStart.length > 0 && queueEnd.length > 0) {
      let meetPoint = this.expandBidirectional(queueStart, visitedStart, visitedEnd)
      if (meetPoint) return meetPoint // Meeting point found from the start direction

      meetPoint = this.expandBidirectional(queueEnd, visitedEnd, visitedStart)
      if (meetPoint) return meetPoint // Meeting point found from the end direction
    }

    return null // No path found
  }

  /**
   * Expands one step in the bidirectional search from a given queue, checking for meeting points.
   * 
   * @param {Array} queue - The current queue of positions to expand.
   * @param {Map} visitedThis - The map of visited positions for this search direction.
   * @param {Map} visitedOther - The map of visited positions for the opposite search direction.
   * @returns {Object|null} The meeting point and combined path if found, null otherwise.
   */
  expandBidirectional(queue, visitedThis, visitedOther) {
    if (queue.length === 0) return null

    let current = queue.shift()
    let directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] // Directions: right, left, up, down

    for (let [dx, dy] of directions) {
      let newPos = new Position(current.position.x + dx, current.position.y + dy)

      if (!this.isValidPosition(newPos.x, newPos.y)) continue // Skip invalid positions

      let key = `${newPos.x},${newPos.y}`
      if (visitedOther.has(key)) {
        // Meeting point found, combine paths
        let pathFromStart = current.path
        let pathFromEnd = visitedOther.get(key).path
        pathFromEnd.pop() // Remove the last element from the end path as it's the meeting point
        let fullPath = pathFromStart.concat(pathFromEnd.reverse())
        return { position: newPos, path: fullPath } // Return the meeting point and full path
      }

      if (!visitedThis.has(key)) {
        visitedThis.set(key, { position: newPos, path: [...current.path, newPos] })
        queue.push(visitedThis.get(key))
      }
    }

    return null // No meeting point found in this step
  }
}
