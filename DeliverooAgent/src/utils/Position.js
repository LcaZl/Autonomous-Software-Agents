export class Position{

  constructor(x, y) {
      this.x = x
      this.y = y
  }

  isEqual(pos) {
      return ((pos.x === this.x) && (pos.y === this.y))
  }

  toString() {
    return `[X:${this.x}, Y:${this.y}]`
  }

  /**
   * Calculates distance between two points
   * @param {Position} p1 - The first point with x and y coordinates.
   * @param {Position} p2 - The second point with x and y coordinates.
   * @return {number} The calculated distance.
  */
  distanceTo(pos) {
    const dx = Math.abs( Math.round(this.x) - Math.round(pos.x) )
    const dy = Math.abs( Math.round(this.y) - Math.round(pos.y) )
    return dx + dy;
  }
}




  
