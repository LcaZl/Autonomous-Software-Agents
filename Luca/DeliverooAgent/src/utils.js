
// Generale purpose utility functions

/**
 * Calculates distance between two points
 * @param {Object} p1 - The first point with x and y coordinates.
 * @param {Object} p2 - The second point with x and y coordinates.
 * @return {number} The calculated distance.
*/
export function distance(p1, p2) {
    const dx = Math.abs( Math.round(p1.x) - Math.round(p2.x) )
    const dy = Math.abs( Math.round(p1.y) - Math.round(p2.y) )
    return dx + dy;
}
  
/**
 * Generates a random direction for the agent.
 * @return {string} The generated direction.
 */
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

/**
 * Displays parcels in the console.
 * @param {Object} parcels - The parcels object to be displayed.
 */
export function showParcels(parcels) {
  console.log('[PARCELS ',parcels.getParcelsCount(),']')
  if (parcels.getParcelsCount() == 0 || parcels == null) {
      console.log('- No parcels detected')
  }
  let i = 1
  for (let p of parcels.getValues()){
    console.log(i,' - ',JSON.stringify(p))
    i++
  }
}

/**
 * Displays players in the console.
 * @param {Object} players - The players object to be displayed.
 */
export function showPlayers(players) {
  console.log('[PLAYERS',players.getPlayersCount(),']')
  if ( players.getPlayersCount() == 0 || players == null) {
      console.log('--No players detected.')
  }
  let i = 1
  for (let p of players.getValues()){
    p.info(i)
    i++
  }
}

/**
 * Prints the map of the environment.
 * @param {Object} environment - The environment object.
 * @param {string} [filler='-'] - The filler character for the map printout.
*/
export function printMap(environment, filler = '-') {
  for (let y = environment.mapHeight - 1; y >= 0; y--) {
    let row = '';
    for (let x = 0; x < environment.mapWidth; x++) {
      row += environment.fullMap[x][y] ? JSON.stringify(environment.fullMap[x][y]) : filler;
      row += ' ';
    }
    console.log('         ',row);
  }
}

/**
 * Displays agent's info.
 * @param {Object} agent - The agent object whose info is to be displayed.
*/
export function agentInfo(agent) {

  console.log('[INIT] Agent info:\n')
  console.log(' - ID: ', agent.id)
  console.log(' - Name: ', agent.name)
  console.log(' - Score: ', agent.score)
  console.log(' - Initial Position: (', agent.lastPosition.x, ',', agent.lastPosition.y, ')')
  console.log(' - Server Deliveroo Connected: ', agent.host)
  console.log(' - Token: ', agent.token)
  console.log(' - Environment Configuration:')
  for (const key in agent.getEnvironment().getConfig()) {
    if (agent.getEnvironment().getConfig().hasOwnProperty(key)) {
      const value = agent.environment.getConfig()[key];
      console.log(' -- ',key, ': ', value);
    }
  }
    console.log(' - Environment Map (\'-\': Inactive cells, 1: Active spawner cells, 2: active delivery cells)\n')
    printMap(agent.getEnvironment())
    console.log('\n - Delivery Tiles',agent.getEnvironment().getDeliveryTiles())
    console.log('\n[INIT] Initialization phase ended. Start operations.')
}
  
/**
 * Logs a message with specified step and object.
 * @param {number} step - The step number of the process.
 * @param {string} obj - The object that is relevant for the log message.
 * @param {string} msg - The message to be logged.
*/
export function log(step, obj, msg) { 
  console.log('[',step,'][',obj,']',msg)
}

  /**
   * Shows all beliefs in the belief set.
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