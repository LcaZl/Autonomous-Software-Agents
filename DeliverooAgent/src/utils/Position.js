/**
 * Represents a point in a 2D space with x and y coordinates.
 */
export class Position {
  /**
   * Constructs a new Position instance.
   * 
   * @param {number} x - The x-coordinate of the position.
   * @param {number} y - The y-coordinate of the position.
   */
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  /**
   * Checks if this position is equal to another position.
   * 
   * @param {Position} pos - The position to compare with.
   * @returns {boolean} True if the positions are equal, false otherwise.
   */
  isEqual(pos) {
    return this.x === pos.x && this.y === pos.y
  }

  /**
   * Calculates the Manhattan distance to another position.
   * 
   * @param {Position} pos - The position to calculate the distance to.
   * @returns {number} The Manhattan distance to the given position.
   */
  distanceTo(pos) {
    const dx = Math.abs(this.x - pos.x)
    const dy = Math.abs(this.y - pos.y)
    return dx + dy
  }

  /**
   * Returns a string representation of the position.
   * 
   * @returns {string} The string representation of the position.
   */
  toString() {
    return `[X:${this.x}, Y:${this.y}]`
  }
}
