
// Generale purpose utility functions
import fs from 'fs';
import { Intentions } from '../Agent/Memory/Reasoning/Intentions.js';
import { ParcelsManager } from '../Agent/Environment/Parcels/ParcelsManager.js';
import { Player } from '../Agent/Environment/players/player.js';
import { Environment } from '../Agent/Environment/Environment.js';
import { Beliefs } from '../Agent/Memory/Reasoning/Beliefs.js';

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
}

/**
 * Calculates distance between two points
 * @param {Position} p1 - The first point with x and y coordinates.
 * @param {Position} p2 - The second point with x and y coordinates.
 * @return {number} The calculated distance.
*/
export function distance(p1, p2) {
    const dx = Math.abs( Math.round(p1.x) - Math.round(p2.x) )
    const dy = Math.abs( Math.round(p1.y) - Math.round(p2.y) )
    return dx + dy;
}

/**
 * Reads a file and returns its content.
 * 
 * @param {string} path - The path to the file.
 * @returns {Promise<string>} A promise that resolves to the content of the file.
*/
export function readFile ( path ) {

  return new Promise( (res, rej) => {

      fs.readFile( path, 'utf8', (err, data) => {
          if (err) rej(err)
          else res(data)
      })

  })
}
  


export function extend(target, source) {
  for (let key of Object.getOwnPropertyNames(source.prototype)) {
      target.prototype[key] = source.prototype[key];
  }
}

export function objectsAreEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
      return false;
  }

  for (let key of keys1) {
      if (obj1[key] !== obj2[key]) {
          return false;
      }
  }

  return true;
}

/**
 * Displays parcels in the console.
 * 
 * @param {ParcelsManager} parcels - The parcels object to be displayed.
 */
export function showParcels(parcels) {
  console.log('|- Parcels detected: ', parcels.getParcels().size)
  
  if (parcels.getParcels().size > 0){
    let i = 1
    for (let [id, parcel] of parcels.getParcels()){
      console.log('|-- ',i,'-', parcel.toString())
      i++
    }
  }

  console.log('|-- My parcels:', parcels.myParcels.size == 0 ? 0 : [...parcels.myParcels].join(', '));
  console.log('|-- Deleted parcels:', parcels.deletedParcels.size == 0 ? 0 : [...parcels.deletedParcels].join(', '));
  
}

/**
 * 
 * @param {Array} options 
 */
export function showOptions(options){
  console.log('|- Last pushed options: ', options ? options.length : 0)
  if (options && options.length > 0){
    let i = 1
    for (let opt of options){
      console.log('|-- ',i,'-', opt.toString())
      i++
    }
  }
}

/**
 * 
 * @param {Intentions} intentions 
 */
export function showIntentions(intentions){
  console.log('|- Intentions: ', intentions.length)
  if (intentions.length > 0){
    let i = 1

    for (let o of intentions) {
      console.log('|--',i, '-', o.toString())
      i++
    }
  }
}


/**
 * Displays players in the console.
 * 
 * @param {Array<Player>} players - The players object to be displayed.
*/
export function showPlayers(players) {
  console.log('|- Player encountered: ', players.size)
  if(players.size > 0){
    let i = 1
    for (let p of players) {
      let str = p.toString()
      console.log('|--',i, '-', p.toString())
      i++
    }
  }
}

/**
 * Prints the map of the environment.
 * @param {Environment} environment - The environment object.
 * @param {string} [filler='-'] - The filler character for the map printout.
*/
export function printMap(map, filler = '-') {
  for (let y = map.length - 1; y >= 0; y--) {
    let row = '';
    for (let x = 0; x < map.length; x++) {
      row += map[x][y] ? JSON.stringify(map[x][y]) : filler;
      row += ' ';
    }
    console.log('         ',row);
  }
}

/**
 * Shows all beliefs in the belief set.
 * 
 * @param {Beliefs}
*/
export function showBeliefs(beliefs){
  let count = 1
  let string = ''
  for (let v of beliefs.entries){
    if (count % 11 == 0){
      console.log(string)
      string = ''
    }
    string += '\t['+v+']'
    count++
  }
}
  
