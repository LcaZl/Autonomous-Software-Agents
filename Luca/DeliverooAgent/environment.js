#!/usr/bin/env node

export class Environment {
  constructor(map, config) {
    // Estrai le dimensioni e i tiles dalla mapData
    const { width, height, tiles } = map;

    // Salva le dimensioni come attributi
    this.MAP_WIDTH = width;
    this.MAP_HEIGHT = height;

    // Salva i tiles come attributo structure
    this.AVAILABLE_MAP = tiles;

    // Crea gli attributi dinamici basati su config
    for (const [key, value] of Object.entries(config)) {
      this[key] = value;
    }    
    // Crea una matrice vuota con le dimensioni specificate
    this.FULL_MAP = Array(this.MAP_HEIGHT).fill().map(() => Array(this.MAP_WIDTH).fill(0));

    // Riempila con i dati da structure
    for (const tile of this.AVAILABLE_MAP) {
      const { x, y, delivery, parcelSpawner } = tile;
      if (delivery) this.FULL_MAP[y][x] = 2
      else this.FULL_MAP[y][x] = 1
    }
  }

  printAttributes() {
      const attributes = Object.keys(this).sort();
      for (const attribute of attributes) {
        if (attribute !== 'FULL_MAP' && attribute != 'AVAILABLE_MAP') { console.log(` - ${attribute}: `, this[attribute]) }
      }
  }

  printMap(filler = ' ') {
    for (let y = 0; y < this.MAP_HEIGHT; y++) {
      let row = '';
      for (let x = 0; x < this.MAP_WIDTH; x++) {
        row += this.FULL_MAP[y][x] ? JSON.stringify(this.FULL_MAP[y][x]) : filler;
        row += ' ';
      }
      console.log(row);
    }
  }
}
