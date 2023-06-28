import { default as commands } from "../commands.js";


export function distance(x1, y1, x2, y2) {
    const dx = Math.abs( Math.round(x1) - Math.round(x2) )
    const dy = Math.abs( Math.round(y1) - Math.round(y2) )
    return dx + dy;
  }
  
  export function randomDirection() {
    var randomValue = Math.floor(Math.random() * 4) + 1;
    var direction = ''
    switch (randomValue) {
      case 1:
        direction = 'right'
      break;
      case 2:
        direction = 'left'
      break;
      case 3:
        direction = 'up'
      break;
      case 4:
        direction = 'down'
      break;
    }
    return direction
  }
  

  export function showParcels(parcels) {
    if(commands.silence_parcels===false){
      console.log('-PARCELS-')
      if (parcels.size == 0 || parcels == null) {
          console.log('--No parcels detected.')
      }
      for (let v of parcels){
          console.log('--',v)
      }
    }
  }
  
  export function showPlayers(otherPlayers) {
    if(commands.silence_player==false){
      console.log('-PLAYERS')
      if (otherPlayers.size == 0 || otherPlayers == null) {
          console.log('--No players detected.')
      }
      for (let v of otherPlayers){
          console.log('--',v)
      }
    }
  }

  export function printAttributes(environment) {
    const attributes = Object.keys(environment).sort();
    for (const attribute of attributes) {
      if (attribute != 'FULL_MAP')
        console.log(` - ${attribute}: `, environment[attribute])
        if (attribute == 'AVAILABLE_MAP'){
          printMap(environment, ' ')
          console.log('\n')
        }
    }
}

  export function printMap(environment, filler = ' ') {
    for (let y = 0; y < environment.MAP_HEIGHT; y++) {
      let row = '';
      for (let x = 0; x < environment.MAP_WIDTH; x++) {
        row += environment.FULL_MAP[y][x] ? JSON.stringify(environment.FULL_MAP[y][x]) : filler;
        row += ' ';
      }
      console.log('         ',row);
    }
  }

  export function agentInfo(agent){

    console.log('[AGENT] Agent info:\n')
    console.log(' - ID: ', agent.id)
    console.log(' - Name: ', agent.name)
    console.log(' - Score: ', agent.score)
    console.log(' - Position: (', agent.x,',',agent.y, ')')
    console.log(' - Server Deliveroo Connected: ',agent.host)
    console.log(' - Token: ',agent.token)
    console.log('\n[ENVIRONMENT] Environment Attributes:\n')
    printAttributes(agent.environment)
    console.log('\n\n[INIT] Initialization phase ended. Start operations.\n')
  }