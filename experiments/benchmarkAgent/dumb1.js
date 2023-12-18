#!/usr/bin/env node
import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
import EventEmitter from "events";
import depth_search_daemon from "./depth_search_daemon.js";
import * as pddlClient from "@unitn-asa/pddl-client";
import { default as config } from "../config.js";
import { Team , MasterIdPool} from './team.js';
import { create } from "domain";

const client = new DeliverooApi(
    'http://localhost:8080',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMzJmOTI1OGM0IiwibmFtZSI6ImR1bWIxIiwiaWF0IjoxNzAxODg5NjU4fQ.c5bK0dVi7_d0Rt6vtrvxJy2y9GobpSSTqssAswW7rmY'
)
const himynameis = "dumb1";

//sconst client = new DeliverooApi(config.host, config.token)
//sconst client = new DeliverooApi(config.host, config.token)
client.onConnect(() => console.log("socket", client.socket.id));
client.onDisconnect(() => console.log("disconnected", client.socket.id));


const depth_search = depth_search_daemon(client);

function distance( {x:x1, y:y1}, {x:x2, y:y2} ) {
    return depth_search( {x:x1, y:y1}, {x:x2, y:y2} ).length;
}

/**
 * Beliefset revision function
 */
const me = { carrying: new Map() };
client.onYou( ( {id, name, x, y, score} ) => {
    me.id = id
    me.name = name
    me.x = x
    me.y = y
    me.score = score
} )

const parcels = new Map();
const sensingEmitter = new EventEmitter();

var AGENTS_OBSERVATION_DISTANCE
var MOVEMENT_DURATION
var PARCEL_DECADING_INTERVAL
client.onConfig( (config) => {
    AGENTS_OBSERVATION_DISTANCE = config.AGENTS_OBSERVATION_DISTANCE;
    MOVEMENT_DURATION = config.MOVEMENT_DURATION;
    PARCEL_DECADING_INTERVAL = config.PARCEL_DECADING_INTERVAL == '1s' ? 1000 : 1000000;
} );


const map = {
    width:undefined,
    height:undefined,
    tiles: new Map(),
    add: function ( tile ) {
        const {x, y} = tile;
        return this.tiles.set( x+1000*y, tile );
    },
    xy: function (x, y) {
        return this.tiles.get( x+1000*y )
    }
};
client.onMap( (width, height, tiles) => {
    map.width = width;
    map.height = height;
    for (const t of tiles) {
        map.add( t );
    }
} )
client.onTile( (x, y, delivery) => {
    map.add( {x, y, delivery} );
} )

function nearestDelivery({x, y}) {
    return Array.from( map.tiles.values() ).filter( ({delivery}) => delivery ).sort( (a,b) => distance(a,{x, y})-distance(b,{x, y}) )[0]
}


/**
 * Options generation and filtering function
 */
sensingEmitter.on( "new_parcel", () => {

    // TODO revisit beliefset revision so to trigger option generation only in the case a new parcel is observed

    let carriedQty = me.carrying.size;
    let carriedReward = Array.from( me.carrying.values() ).reduce( (acc, parcel) => acc + parcel.reward, 0 )

    /**
     * Options generation
     */
    const options = []
    for (const parcel of parcels.values()) {
        if ( ! parcel.carriedBy )
            options.push( [ 'go_pick_up', parcel.x, parcel.y, parcel.id, parcel.reward ] );
    }
    if ( carriedReward > 0 || parcels.size > 0 ) {
        options.push( [ 'go_deliver' ] );
    }
    
    function reward (option) {
        if ( option[0] == 'go_deliver' ) {
            let deliveryTile = nearestDelivery(me)
            return carriedReward - carriedQty * MOVEMENT_DURATION/PARCEL_DECADING_INTERVAL * distance( me, deliveryTile ); // carried parcels value - cost for delivery
        }
        else if ( option[0] == 'go_pick_up' ) {
            let [go_pick_up,x,y,id,reward] = option;
            let deliveryTile = nearestDelivery({x, y});
            return carriedReward + reward - (carriedQty+1) * MOVEMENT_DURATION/PARCEL_DECADING_INTERVAL * (distance( {x, y}, me ) + distance( {x, y}, deliveryTile ) ); // parcel value - cost for pick up - cost for delivery
        }
    }
    /**
     * Options filtering / sorting
     */

    options.sort( (o1, o2) => reward(o1)-reward(o2) )

    for (const opt of options) {
        myAgent.push( opt )
    }

} )

/* ----------------------------------------
    ---------------------------------------
    SHIT FOR MULTI-AGENT BELIEF MANAGEMENT
    -------------- master -----------------
---------------------------------------- */

class Parcel {
    constructor(data) {
        this.update(data);
    }

    update(data) {
        this.id = data.id;
        this.x = data.x;
        this.y = data.y;
        this.carriedBy = data.carriedBy;
        this.reward = data.reward;
    }
}

class BeliefSet {
    constructor() {
        this.parcels = new Map();
    }

    handleUpdateBeliefsMessage(msg) {
        const { content } = msg;
        const { beliefSet, agentPosition } = content;

        // Update or add parcels to the Master's structure
        beliefSet.forEach((parcelData) => {
            const existingParcel = this.parcels.get(parcelData.id);

            if (existingParcel) {
                // Update existing parcel
                existingParcel.update(parcelData);
            } else {
                // Add new parcel
                const newParcel = new Parcel(parcelData);
                this.parcels.set(parcelData.id, newParcel);
            }
        });

        // Select the parcel with the highest reward
        const parcelWithHighestReward = this.selectParcelWithHighestReward();
        console.log('Parcel with highest reward:', parcelWithHighestReward);

        // Additional processing or storage logic can be added here

        // Example: Print the updated Master's parcel structure
        console.log('Updated Master\'s parcels:', Array.from(this.parcels.values()));
    }

    selectParcelWithHighestReward() {
        let highestReward = -Infinity;
        let selectedParcel = null;

        for (const parcel of this.parcels.values()) {
            if (parcel.reward > highestReward) {
                highestReward = parcel.reward;
                selectedParcel = parcel;
            }
        }

        return selectedParcel;
    }
}

let shared_beliefset = new BeliefSet()

// FLAG FOR IGNORING UPDATES?? 
// if EXECUTING_PLAN ignore PLAN_ASSIGNMENT ? 

function evaluate(plan) { 
    console.log("\n\n I RECEIVED A PLAN FROM THE MASTER NOW I'LL DO MY BEST.\n\n")   
    console.log(JSON.stringify(plan))
    console.log("-------------------------------\n\n")


    /* ASSUMING I ACHIEVED IT  */

    // notify master ??? 

    /* ASSUMING I FAILED  */

    // notify master ??? 

}
/* ------------------------------------------------
   ------------------------------------------------
      ------ SHIT FOR MESSAGE TESTING ------
   ------------------------------------------------
   ------------------------------------------------
*/

// keeping 'teamId' secret is the only way we can ensure nobody is messing with our messaging system
const teamId = 'TEAM-NAME'
const team = new Team();
const masterIdPool = new MasterIdPool(); 
const myRanking = Math.floor(Math.random() * 100) + 1;
let myId = client.id;
let masterId = null;
let masterRanking = null;
const masterkPool = null; 
let eventManager = new EventEmitter()

let myPosition = {
    x: null,
    y: null
}

let TEAM_FORMATION = true; 
let TEAM_SIZE = 2; 
let MASTER = false; 
let MASTER_SET = false;

const moveRandomly = async () => {
    const moves = ['up', 'down', 'left', 'right'];
    let gotPosition = true
    let success = false
    while (!success) {
        const randomIndex = Math.floor(Math.random() * moves.length);
        const randomMove = moves[randomIndex];
        success = await client.move(randomMove);
        if (success) {
            console.log(`Successfully moved ${randomMove}`);
            console.log('NEW POSITION = ' + success.x + " " + success.y)
            myPosition.x = success.x 
            myPosition.y = success.y
            gotPosition = false
        }
    }
}

const MessageType = {
    TEAM_FORMATION: 'TEAM_FORMATION', 
    MASTER_CHECK: 'MASTER_CHECK',
    ASK_MASTER: 'ASK_MASTER',
    ASK_FOR_PLAN: 'ASK_FOR_PLAN',
    PLAN_ASSIGNMENT : 'PLAN_ASSIGNMENT',
    UPDATE_BELIEFS : 'UPDATE_BELIEFS'
};

const createMessage = (teamId, messageType, content) => {
    return {
      teamId: teamId,
      messageType: messageType,
      content: content
    };
};

const composeTeamFormationMsg = (agentRanking) => {
    return createMessage(teamId, MessageType.TEAM_FORMATION, {myId, agentRanking});
};

const composeMasterCheckMsg = () => {
    if (masterId !== null) { 
        return createMessage(teamId, MessageType.MASTER_CHECK, {myId, masterId, masterRanking});
    } else {
        let masterId = myId;
        let masterRanking = myRanking; 
        return createMessage(teamId, MessageType.MASTER_CHECK, {myId, masterId, masterRanking});
    }};

const composeAskMasterMsg = () => {
    return createMessage(teamId, MessageType.ASK_MASTER, {myId}); 
};

const composeAskForPlanMsg = () => {
    // substitute currentPosition with the centre-of-mass
    let pos = client.agentPosition
    return createMessage(teamId, MessageType.ASK_FOR_PLAN, {myId, pos}); 
};

const composePlanAssignmentMsg = async (agentId, agentPosition) => {
    let plan = extractAgentPlan(agentId, agentPosition); 
    return createMessage(teamId, MessageType.PLAN_ASSIGNMENT, {plan});
};

const tempPlanAssignmentMsg = async (plan) => {
    return createMessage(teamId, MessageType.PLAN_ASSIGNMENT, {plan});
};

const composeUpdateBeliefstMsg = async (beliefSet, agentPosition) => {
   return createMessage(teamId, MessageType.UPDATE_BELIEFS, {myId, beliefSet, agentPosition});
}; 


// ------------------ PERFORMATIVES -----------------
// not sure about the name, check speech-act theory (or fuck it) 

// the agent informs the world about its presence in order to find its teammates 
const introduceYourself = async () => {    
    try {
        let message = composeTeamFormationMsg(myRanking)
        //await client.shout(message);
        client.shout(message);
    } catch (error) {
        console.error(" [SHOUT] - Error while introducing yourself:", error);
    }
};

// the agent ask to every member of the team who is the master 
const lookForMaster = async() => {
    try {
        let message = composeAskMasterMsg(); 
        await client.shout(message);
    } catch (error) {
        console.error(" [SHOUT] - Error while asking for MasterId:", error);
    }
};

// the agent ask a plan directly to whoever he considers the master 
const askForPlan = async () => {
    let planRequest = composeAskForPlanMsg()
    if (masterId !== null) {
        try {
            await client.say(masterId, planRequest);    
        } catch (error) {
            consolel.error("[SAY] - Error while sending a plan: ", error);
        }
    }
};

// the agent ask to every member of the team who is the master 
const updateBeliefSet = async(beliefSet, agentPosition) => {
    try {
        let message = await composeUpdateBeliefstMsg(beliefSet, agentPosition); 
        console.log("[UPDATE-BELIEFS-SAY: sending: \n\n " + JSON.stringify(message) + "\n\n")
        await client.say(masterId, message);
    } catch (error) {
        console.error(" [SAY] - Error while sending belief-set update to master:", error);
    }
};

const sendPlan = async (agent, goalPosition) => {
    try {
        let message = await tempPlanAssignmentMsg(goalPosition)
        console.log("SENDING PLAN : " + JSON.stringify(message) + "\n\n")
        await client.say(agent, message)
    } catch (error) {
        console.error(" [SAY] - Error while sending plan back to agent:", error) 
    }
}


// ------------------ ON BELIEF-SET UPDATE ------------------
// this is a simplified version to test the update-belief performative
// and master plan communication. 

client.onParcelsSensing( async ( perceived_parcels ) => {
    //console.log("ON PARCEL SENSING")
    //console.log(parcels)
    let new_parcel_sensed = false;
    for (const p of perceived_parcels) {
        if ( ! parcels.has(p.id) )
            new_parcel_sensed = true;
            //console.log("[NEW PARCEL SENSED] - " + p.id + " at position " + p.x + " , " + p.y)
        parcels.set( p.id, p)
        if ( p.carriedBy == me.id ) {
            me.carrying.set( p.id, p );
        }
    }
    for ( const [id,p] of parcels.entries() ) {
        if ( ! perceived_parcels.find( p=>p.id==id ) ) {
            parcels.delete( id ); 
            me.carrying.delete( id );
        }
    }
    if (new_parcel_sensed) {
        sensingEmitter.emit("new_parcel")

        if (MASTER_SET && new_parcel_sensed && !MASTER){
            await updateBeliefSet(perceived_parcels, myPosition)
            /*
            console.log("I am " + myId + " : ranking " + myRanking +
            "\n\n MASTER_SET: " + MASTER_SET +
            "\n\n MASTER: " + MASTER + 
            "\n\nMY MEMORY IS REALLY BAD, SO SEND EVERYTHING TO MASTER HOPING IT WILL REMEMBER.")
            */
        }
    }
})


// ------------------ ON MESSAGE ------------------

client.onMsg((id, name, msg, reply) => {
    let answer = filterMessage(msg);
    /*
    console.log("MESSAGE RECEIVED WITH: \n" +
    "id: " + id + "\n" + 
    "name: " + name + "\n" + 
    "msg:" +  JSON.stringify(msg, null, 2)  + "\n")
    */
    if (reply) {  // if the message was sent through ask, i guess... 
        try { reply(answer) } catch { (error) => console.error(error) }
    }
});

// return an answer message to messages that require to do so, 
// trigger meaningul actions otherwise.   
const filterMessage = async (receivedMessage) => {
    // Check if the expected properties exist in the receivedMessage, if so message isn't spam. 
    if (  receivedMessage &&
        typeof receivedMessage === 'object' &&
        'teamId' in receivedMessage &&
        'messageType' in receivedMessage) {
        let messageType = receivedMessage.messageType
        console.log(messageType)
        switch(messageType) {
            case MessageType.TEAM_FORMATION:
                console.log("[MESSAGE RECEIVED] - Team Formation message.")
                // message received from an agent trying to form a team 
                let teamMateId = receivedMessage.content.myId; 
                let teamMateRanking = receivedMessage.content.agentRanking; 
                console.log("inserted id: " + teamMateId + " , inserted ranking: " + teamMateRanking)
                team.insert(teamMateId, teamMateRanking);
                console.log("Inserted " + teamMateId + "in the team.")
                let members = team.getNumberOfMembers() 
                console.log("Number of teammates = " + members)
                break;
            case MessageType.MASTER_CHECK:
                console.log("[MESSAGE RECEIVED] - Master Check message.")
                // message received from an agent that is replying to your ASK_MASTER 
                let voterId = receivedMessage.content.agentId; 
                let votedMaster = receivedMessage.content.masterId;
                masterIdPool.addAnswer(voterId, votedMaster);
                // It can happen that an agent gets a message from a team-mate with a masterId lower that the one locally stored. 
                // In this case the agent should reply with a "WARNING_MASTER_ID" message, so that the team-mate can update its masterId. 
                break; 
            case MessageType.ASK_MASTER: 
                console.log("[MESSAGE RECEIVED] - Ask Master message.")
                // message received from an agent who is looking for masterId
                //masterId !== null && masterRanking !== null ? composeMasterCheckMsg(masterId, masterRanking) : null;
                let message = composeMasterCheckMsg();
                masterId === myId ? masterId = null : null 
                try {
                    await client.say(receivedMessage.content.myId, message);    
                } catch (error) {
                    consolel.error("[ASK PLAN] - Error while sending a plan: ", error);
                }
                break; 
            case MessageType.PLAN_ASSIGNMENT: // 
                console.log("[MESSAGE RECEIVED] - Plan Assignment message.")
                // message received from the master, see if you want to execute the plan 
                let plan = receivedMessage.content.plan; 
                console.log("[PLAN RECEIVED] - plan: " + plan)
                evaluate(plan);
                break;
            case MessageType.ASK_FOR_PLAN: 
                console.log("[MESSAGE RECEIVED] - Ask for Plan message.")    
                // message received from an agent looking for a plan, provide it 
                if (masterId == myId) {
                    let agentId = receivedMessage.content.agentId;
                    let agentPosition = receivedMessage.content.agentPosition;
                    composePlanAssignmentMsg(agentId, agentPosition);
                } else {
                    // nothing... atm , even if you are not the master you act like it 
                    let agentId = receivedMessage.content.agentId;
                    let agentPosition = receivedMessage.content.agentPosition;
                    composePlanAssignmentMsg(agentId, agentPosition);
                }
                break;
            case MessageType.UPDATE_BELIEFS: 
                console.log("[MESSAGE RECEIVED] - Update Beliefs message.")    
                // message received from an agent who discovered new parcels 
                let parcels = receivedMessage.content.beliefSet; 
                let agent = receivedMessage.content.myId; 
                console.log("Bro " + agent +  " @ position " + receivedMessage.agentPosition +
                " - sent the following belief-set update: \n" +
                parcels + "\n")
                // todo: update beliefset 
                shared_beliefset.handleUpdateBeliefsMessage(receivedMessage)
                console.log("I THINK YOU SHOULD GO TO " + JSON.stringify(shared_beliefset.selectParcelWithHighestReward()))
                // todo: plan assignment 
                await sendPlan(agent, shared_beliefset.selectParcelWithHighestReward())
            default:
                console.error('[MESSAGE FILTERING] - Unknown message type:', messageType);
                console.error(JSON.stringify(receivedMessage))
        }


    } else {
        console.error('[SPAM] - Invalid message structure:', receivedMessage);
      }
  };

/* ------------------------------------------------
   ------------------------------------------------
      ------ END SHIT FOR MESSAGE TESTING ------
   ------------------------------------------------
   ------------------------------------------------
*/


/**
 * Intention
 */
class Intention {

    // Plan currently used for achieving the intention 
    #current_plan;
    
    // This is used to stop the intention
    #stopped = false;
    get stopped () {
        return this.#stopped;
    }
    stop () {
        // this.log( 'stop intention', ...this.#predicate );
        this.#stopped = true;
        if ( this.#current_plan)
            this.#current_plan.stop();
    }

    /**
     * #parent refers to caller
     */
    #parent;

    /**
     * predicate is in the form ['go_to', x, y]
     */
    get predicate () {
        return this.#predicate;
    }
    #predicate;

    constructor ( parent, predicate ) {
        this.#parent = parent;
        this.#predicate = predicate;
    }

    log ( ...args ) {
        if ( this.#parent && this.#parent.log )
            this.#parent.log( '\t', ...args )
        else
            console.log( ...args )
    }

    #started = false;
    /**
     * Using the plan library to achieve an intention
     */
    async achieve () {
        // Cannot start twice
        if ( this.#started)
            return this;
        else
            this.#started = true;

        // Trying all plans in the library
        for (const planClass of planLibrary) {

            // if stopped then quit
            if ( this.stopped )
                break;

            // if plan is 'statically' applicable
            if ( planClass.isApplicableTo( ...this.predicate ) ) {
                // plan is instantiated
                this.#current_plan = new planClass(this.parent);
                // this.log('achieving intention', ...this.predicate, 'with plan', planClass.name);
                // and plan is executed and result returned
                try {
                    const plan_res = await this.#current_plan.execute( ...this.predicate );
                    this.log( 'succesful intention', ...this.predicate, 'with plan', planClass.name, 'with result:', plan_res );
                    return plan_res
                // or errors are caught so to continue with next plan
                } catch (error) {
                    if ( this.stopped )
                        break;
                    this.log( 'failed intention', ...this.predicate, 'with plan', planClass.name, 'with error:', error );
                }
            }

        }

        // if stopped then quit
        if ( this.stopped ) throw [ 'stopped intention', ...this.predicate ];

        // no plans have been found to satisfy the intention
        // this.log( 'no plan satisfied the intention ', ...this.predicate );
        throw ['no plan satisfied the intention ', ...this.predicate ]
    }

}

/**
 * Plan library
 */
const planLibrary = [];

class Plan {

    // This is used to stop the plan
    #stopped = false;
    stop () {
        // this.log( 'stop plan' );
        this.#stopped = true;
        for ( const i of this.#sub_intentions ) {
            i.stop();
        }
    }
    get stopped () {
        return this.#stopped;
    }

    /**
     * #parent refers to caller
     */
    #parent;

    constructor ( parent ) {
        this.#parent = parent;
    }

    log ( ...args ) {
        if ( this.#parent && this.#parent.log )
            this.#parent.log( '\t', ...args )
        else
            console.log( ...args )
    }

    // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.
    #sub_intentions = [];

    async subIntention ( predicate ) {
        const sub_intention = new Intention( this, predicate );
        this.#sub_intentions.push( sub_intention );
        return sub_intention.achieve();
    }

}

class GoPickUp extends Plan {

    static isApplicableTo ( go_pick_up, x, y, id ) {
        return go_pick_up == 'go_pick_up';
    }

    async execute ( go_pick_up, x, y ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await this.subIntention( ['go_to', x, y] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await client.pickup()
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }

}

class GoDeliver extends Plan {

    static isApplicableTo ( go_deliver ) {
        return go_deliver == 'go_deliver';
    }

    async execute ( go_deliver ) {

        let deliveryTile = nearestDelivery( me );

        await this.subIntention( ['go_to', deliveryTile.x, deliveryTile.y] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        await client.putdown()
        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        return true;

    }

}

class Patrolling extends Plan {

    static isApplicableTo ( patrolling ) {
        return patrolling == 'patrolling';
    }

    async execute ( patrolling ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        let i = Math.round( Math.random() * map.tiles.size );
        let tile = Array.from( map.tiles.values() ).at( i );
        if ( tile )
            await this.subIntention( ['go_to', tile.x, tile.y] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }

}

class DepthSearchMove extends Plan {

    static isApplicableTo ( go_to, x, y ) {
        return go_to == 'go_to';
    }

    async execute ( go_to, x, y ) {
        
        this.log( 'DepthSearchMove', 'from',  me.x, me.y, 'to', {x, y} );
        
        while ( me.x != x && me.y != y ) {

            const plan = depth_search(me, {x, y})
    
            client.socket.emit( "path", plan.map( step => step.current ) );

            if ( plan.length == 0 ) {
                throw 'target not reachable';
            }
    
            for ( const step of plan ) {
    
                if ( this.stopped ) throw ['stopped']; // if stopped then quit
                
                const status = await client.move( step.action )
    
                if ( status ) {
                    me.x = status.x;
                    me.y = status.y;
                }
                else {
                    this.log( 'DepthSearchMove replanning', 'from',  me.x, me.y, 'to', {x, y} );
                    break;
                }
    
            }
            
        }

        return true;

    }
}

class BlindMove extends Plan {

    static isApplicableTo ( go_to, x, y ) {
        return go_to == 'go_to';
    }

    async execute ( go_to, x, y ) {

        while ( me.x != x || me.y != y ) {

            if ( this.stopped ) throw ['stopped']; // if stopped then quit

            let status_x = false;
            let status_y = false;
            
            // this.log('me', me, 'xy', x, y);

            if ( x > me.x )
                status_x = await client.move('right')
                // status_x = await this.subIntention( 'go_to', {x: me.x+1, y: me.y} );
            else if ( x < me.x )
                status_x = await client.move('left')
                // status_x = await this.subIntention( 'go_to', {x: me.x-1, y: me.y} );

            if (status_x) {
                me.x = status_x.x;
                me.y = status_x.y;
            }

            if ( this.stopped ) throw ['stopped']; // if stopped then quit

            if ( y > me.y )
                status_y = await client.move('up')
                // status_x = await this.subIntention( 'go_to', {x: me.x, y: me.y+1} );
            else if ( y < me.y )
                status_y = await client.move('down')
                // status_x = await this.subIntention( 'go_to', {x: me.x, y: me.y-1} );

            if (status_y) {
                me.x = status_y.x;
                me.y = status_y.y;
            }
            
            if ( ! status_x && ! status_y) {
                // this.log('stucked');
                throw 'stucked';
            } else if ( me.x == x && me.y == y ) {
                // this.log('target reached');
            }
            
        }

        return true;

    }
}

// plan classes are added to plan library 
planLibrary.push( GoPickUp )
planLibrary.push( Patrolling )
planLibrary.push( GoDeliver )
planLibrary.push( DepthSearchMove )
// planLibrary.push( BlindMove )



/**
 * Intention revision loop
 */
class IntentionRevision {

    #intention_queue = new Array();
    get intention_queue () {
        return this.#intention_queue;
    }

    currentIntention;

    stopCurrent () {
        if ( this.currentIntention )
            this.currentIntention.stop();
    }
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // ----------------  NEW     ------------------------
    // ----------------  AGENT   ------------------------
    // ----------------  LOOP    ------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    // --------------------------------------------------
    
    /*--------------------------------------------------
        For simplicity the agent loop is modelled as 
        a clean state-transition system: 
        
        • s0; team formation: 

            - the agent can execute its "moves".  
            (note: moves can be random, or executed according to a plan)

            - the agent wait for all team-mates to present itself. 
            
            move-to: s1
        
        • s1; master electiom: 

            - the agent can execute its "moves". 
            (note: moves can be random, or executed according to a plan)

            - the agent talks with team-mate to elect the master. 
            (note: atm, the agent pool mechanism is not used, 
            and the first agent proposal whose id is != from 
            this.id , is accepted)

            - the agent talks to other team-mates to share part of its belief-set.

            move-to: s2


        • s2; asking plan: 
                
            - the agent can execute its "moves" around the position selected as centre-of-mass, 
            which is the one communicated to the master in the request for a plan.
            (note: moves can be random, or executed according to a plan)

            - the agent waits for a plan 5 seconds. 

            move-to: s3

        • s3; plan execution: 

            - the agent tries to execute the plan, if it fails it tries
            to find a remedy alone. Whether this intention is successful 
            or not, it ask for a new plan, communicating a new centre-of-mass.  (this allows for a dynamic-area allocation -> exploration maximisation, centralized multi-agent planning, minimise conflicts)
        
            move-to: s2 
    --------------------------------------------------*/
    async loop ( ) {

        /* --------------------------------------
        Waking up slowly.
        -------------------------------------- */
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log("I'm "  + himynameis +" \n"+
        "my id is: " +  client.id + "\n")
        myId = client.id;

        //console.log(JSON.stringify(client.map))
        await moveRandomly()
        console.log("MY POSITION IS " + myPosition.x + "," + myPosition.y)
        

        /*
            here i should start: 
            - patrolling 
            - update belief-set on parcel sensing 
            - share my belief-set 
        */
        eventManager.on('parcels_percept', (parcels) => { this.handleParcelsSensing(parcels); });


        /* --------------------------------------
        s0 : TEAM_FORMATION 
        -------------------------------------- */
            while ( TEAM_FORMATION ) {

                // WAIT FOR ALL TEAMMATES TO BE ONLINE. (simple version)
                await new Promise(resolve => setTimeout(resolve, 5000));
                introduceYourself();

                // when TEAM_SIZE is equal to the predefined one, we're done with team formation process. Ready for s1. 
                if (team.getNumberOfMembers() == TEAM_SIZE - 1) {
                    TEAM_FORMATION = false; 
                    console.log("[TEAM_FORMATION DONE] - agent " + himynameis + " knows all the team members.")
                    team.insert(myId, myRanking);
                }
            }
        /* --------------------------------------
            s1 : MASTER_ELECTION
        
            as discussed, we could think of: 
            - act indipendently while waiting for the most-voted master,
            - act using as a proxy the agent locally considered as a master  
            - wait, as we do in this naive test 
       
        // This has to be fixed, but assuming to know how TEAM_SIZE in advance is not really needed. 

            lookForMaster();
            
            while (masterIdPool.voteCount != TEAM_SIZE - 1) {
                // kill some time / act indipendently / whatever .... 
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log("[MASTER ELECTED] - master id : " + masterId)
        --------------------------------------*/


        console.log("SHOWING TEAM: \n\n")
        team.displayTeamMembers()
        console.log('-------------')
        let master= team.getAgentWithHighestRanking()
        console.log("\n\n Master is " + JSON.stringify(master) + "\n\n")
        master.id === myId ? MASTER = true : MASTER = false; 
        masterId = master.id
        /*
            s2 : ASK_FOR_PLAN 
        */

        if (MASTER) {
            console.log("[PLANNING] - I'm the f*cking MASTER you suckeeeerzz.\n\n")
            MASTER_SET = true
        } else {
            console.log("[PLANNING] - I'm waiting for your orders mr. master. I'll be here patrolling a bit.\n\n")
            MASTER_SET = true
        }

        /*
            s3 : PLAN_EXECUTION 
        */




    /*    
        while ( true ) {
            // Consumes intention_queue if not empty
            if ( this.intention_queue.length > 0 ) {
                console.log( 'intentionRevision.loop', this.intention_queue );
            
                // Current intention
                const predicate = this.intention_queue.shift();
                const intention = this.currentIntention = new Intention( this, predicate );
                
                // Is queued intention still valid? Do I still want to achieve it?
                // TODO this hard-coded implementation is an example
                if ( intention.predicate[0] == "go_pick_up" ) {
                    let id = intention.predicate[3]
                    let p = parcels.get(id)
                    if ( p && p.carriedBy ) {
                        console.log( 'Skipping intention because no more valid', intention.predicate );
                        continue;
                    }
                }

                // Start achieving intention
                await intention.achieve()
                // Catch eventual error and continue
                .catch( error => {
                    if ( !intention.stopped )
                        console.error( 'Failed intention', ...intention.predicate, 'with error:', error )
                } );

            }
            else {
                this.push( this.idle );
            }

            // Postpone next iteration at setImmediate
            await new Promise( res => setImmediate( res ) );
        }
    */


    }

    // async push ( predicate ) { }

    log ( ...args ) {
        console.log( ...args )
    }
    
    async push ( predicate ) {

        // console.log( 'IntentionRevisionReplace.push', predicate );

        // // Check if already queued
        // if ( this.intention_queue.find( (p) => p.join(' ') == predicate.join(' ') ) )
        //     return;
        
        // // Reschedule current
        // if ( this.currentIntention )
        //     this.intention_queue.unshift( this.currentIntention.predicate );

        // Prioritize pushed one
        this.intention_queue.unshift( predicate );

        // Force current to stop
        this.stopCurrent();
        
    }

}

/**
 * Start intention revision loop
 */

// const myAgent = new IntentionRevisionQueue();
const myAgent = new IntentionRevision();
myAgent.idle = [ "patrolling" ];
// const myAgent = new IntentionRevisionRevise();
myAgent.loop();
