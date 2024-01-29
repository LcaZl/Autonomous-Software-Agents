//import { Agent } from "../Agent.js";
import MessageType from './messageTypes.js';
import { Team , MasterIdPool} from './team.js';
import { sharedIntentionQueue } from './planning/sharedIntentionQueue.js'
import { Position } from '../../../../DeliverooAgent/src/utils/Position.js';

let execTimes = 0  

export class Communication{

    constructor(agent){
        this.agent = agent
        this.team = this.agent.team
        this.tempBeliefSet = new Map()
        this.tempBeliefSet.set('positions', {}); 
        this.sharedIntentionQueue = new sharedIntentionQueue(this.agent);

        this.agent.client.onMsg((id, name, msg, reply) => {
            let answer = this.filterMessage(msg);
            if (reply) {
                try { reply(answer) } catch { (error) => console.error(error) }
            }
        });
    }

    /**
     * 
     * 1 - Logica gestine del passaggio di opzioni tra agenti.
     * 2 - Condivisione dei dati dell'ambiente tra agenti.
     * 3 - Uso activate ?
     * 
     * 
     * 
     * 
     */

    activate(){
        this.agent.eventManager.on('picked_up_parcels', (pickedUpParcels) => this.pickedUpParcels(pickedUpParcels)  )
        this.agent.eventManager.on('parcels_percept', (parcels) => { this.handleParcelsSensing(parcels); });
        this.agent.eventManager.on('players_percept', (sensedPlayers) => this.handlePlayersSensing(sensedPlayers));
        this.agent.eventManager.on('updated_parcels_beliefset', (sensedPlayers) => this.handleUpdatedBeliefset(sensedPlayers));
        this.agent.eventManager.on('updated_parcels_beliefset', (sensedPlayers) => this.handleUpdatedBeliefset(sensedPlayers));
    }

    /* 
    --------------------------------------------------
                    Compose messages 
    --------------------------------------------------
    */

    createMessage(teamId, messageType, content){
        return {
          teamId: teamId,
          messageType: messageType,
          content: content
        };
    };

    composeTeamFormationMsg(agentRanking){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.TEAM_FORMATION, {myId, agentRanking});
    };

    composeUpdateBeliefsetMsg(beliefSet){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_BELIEFS, {myId, beliefSet});
     }; 

    composeUpdateParcelBeliefMsg(parcelId, belief, action){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_PARCELS_BELIEFS, {myId, parcelId, belief, action});
    }

    composeUpdatePlayerBeliefMsg(playerId, belief, action){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_PLAYERS_BELIEFS, {myId, playerId, belief, action});
    }

    composePushOptionMsg(option, utility){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_OPTION, {myId, option, utility});
    }

    composeDeleteOptionMsg(option, utility){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.DELETE_OPTION, {myId, option, utility}); 
    }

    composePositionUpdate(position){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.POSITION_UPDATE, {myId, position}); 
    }
    
    composePlanAssignment(plan){
        return this.createMessage(this.team.teamId, MessageType.PLAN_ASSIGNMENT, {myId, plan});  
    }
    /* 
    --------------------------------------------------
                    Performatives 
    --------------------------------------------------
    when refactoring: 
    you can make this cleaner, e.g. 
        message 1 : introduce yourself
        message 2 : update belief-set wrt parcel
        message 3 : update belief-set wrt player
        and so on, then call a single sendMessage(message_type, content) function. 

    */   

    async introduceYourself(myRanking){    
        try {
            let message = this.composeTeamFormationMsg(myRanking)
            await this.agent.client.shout(message);
        } catch (error) {
            console.error(" [SHOUT] - error while introducing yourself:", error);
        }
    };

    async updateBeliefSet(beliefSet){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeUpdateBeliefsetMsg(beliefSet); 
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[BELIEF-SET UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error) {
            console.error(" [SAY] - error while sending belief-set update to master:", error);
        }
    };

    async updateParcelBeliefSet(parcelId, belief, action){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeUpdateParcelBeliefMsg(parcelId, belief, action)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[PARCEL UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating parcel beliefs:", error)
        }
    };

    async updatePlayerBeliefSet(playerId, belief, action){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeUpdatePlayerBeliefMsg(playerId, belief, action)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[PLAYER UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating player beliefs:", error)
        }   
    }

    async pushOptionToMasQueue(option, utility){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composePushOptionMsg(option, utility)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[OPTION UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating options:", error)
        }        
    }

    async deleteOptionToMasQueue(option, utility){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeDeleteOptionMsg(option, utility)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[OPTION UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error deleting options:", error)
        }        
    }

    async positionUpdate(position){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composePositionUpdate(position)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[POSITION UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating position:", error)
        }        
    }

    async assignPlan(agentId, plan){
        try {
            if(this.team.masterId && this.team.MASTER){
                let message = this.composePlanAssignment(plan)
                await this.agent.client.say(agentId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[PLAN ASSIGNMENT] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error assigning plan:", error)
        }        
    }

    /* 
    ----------------------------------------------------------------------
            Handle temp. (shared) belief-set 
            TODO: make separate Class. 
    ----------------------------------------------------------------------
    */

    standardizeId(id) {
        // If the ID starts and ends with a quote, remove them
        if (id.startsWith("'") && id.endsWith("'")) {
            return id.slice(1, -1); // Remove the first and last characters (the quotes)
        }
        return id;
    }

    updateTempBeliefSet(object, id, belief, action){
        let objectOfInterest = belief[1]

        if(action === "add") {
            if (object === "parcel") {
                this.tempBeliefSet.set(objectOfInterest, belief[0] + " " + belief[2])
            } 

            if (object === "player") {
                if( belief[0] === 'carries') {
                    if(this.tempBeliefSet.has(objectOfInterest)){
                        let existingArray = this.tempBeliefSet.get(objectOfInterest);
                        existingArray.push(belief[0] + " " + belief[2]);
                    } else {
                        this.tempBeliefSet.set(objectOfInterest, [belief[0] + " " + belief[2]]);
                    }
                }
            }
        }

        if(action === "remove") {
            //console.log("[UPDATE BELIEFSET] - action:  DELETE: " + id + "\n")
            //console.log("id type: " + typeof id )
            //console.log("DOES MAP HAVE KEY [id]? : " + this.tempBeliefSet.has(String(id)))
            // one of the two lines below, to check (maybe identical)
            this.tempBeliefSet.delete(String(id))
            //this.tempBeliefSet.delete(id)
        }

        execTimes += 1
        if(execTimes == 10){
            console.log("[MASTER TEMP BELIEFSET]:")
            console.log(this.tempBeliefSet)
            console.log("----")
            execTimes = 0
        }
    }

    updateAgentPosition(agentId, newPosition) {
        //agentId = this.standardizeId(agentId)
        let positionObject = new Position(newPosition.x, newPosition.y);
        let positions = this.tempBeliefSet.get('positions');
        positions[agentId] = positionObject; // Update or set the agent's position
        this.tempBeliefSet.set('positions', positions); // Update the positions in the belief set
    }

    // Method to retrieve the position of an agent
    getAgentPosition(agentId) {
        //agentId = this.standardizeId(agentId)
        let positions = this.tempBeliefSet.get('positions');
        return positions ? positions[agentId] : null;
    }    


    /* 
    --------------------------------------------------
            Handle temp. (shared) intentions
    --------------------------------------------------
    nothing atm, everything in sharedIntentionQueue.js
    */

    /* 
    --------------------------------------------------
                    Filter Messages
    --------------------------------------------------
    */

    async filterMessage(receivedMessage){
        if (receivedMessage && typeof receivedMessage === 'object' &&
        'teamId' in receivedMessage && 'messageType' in receivedMessage) {

            let messageType = receivedMessage.messageType

            switch(receivedMessage.messageType) {
                case MessageType.TEAM_FORMATION:
                    let teamMateId = receivedMessage.content.myId;
                    let teamMateRanking = receivedMessage.content.agentRanking;
                    this.team.insert(teamMateId, teamMateRanking)
                    break;
                case MessageType.MASTER_CHECK:
                    break;
                case MessageType.ASK_MASTER:
                    break;
                case MessageType.PLAN_ASSIGNMENT:
                    // i am a slave who received a plan. EXECUTE.
                    break;
                case MessageType.ASK_FOR_PLAN:
                    break;
                case MessageType.UPDATE_BELIEFS:
                    break;
                case MessageType.UPDATE_PARCELS_BELIEFS:
                    let parcelId = receivedMessage.content.parcelId;
                    let parcelBelief = receivedMessage.content.belief.split(" ");
                    let parcelAction = receivedMessage.content.action;
                    this.updateTempBeliefSet("parcel", parcelId, parcelBelief, parcelAction) 
                    break;
                case MessageType.UPDATE_PLAYERS_BELIEFS:
                    let playerId = receivedMessage.content.playerId;
                    let playerBelief = receivedMessage.content.belief.split(" ");
                    let playerAction = receivedMessage.content.action;
                    this.updateTempBeliefSet("player", playerId, playerBelief, playerAction) 
                    break;
                case MessageType.POSITION_UPDATE: 
                    let positionUpdateAgentId = receivedMessage.content.myId;
                    let updatedCurrentPosition = receivedMessage.content.position;
                    this.updateAgentPosition(positionUpdateAgentId, updatedCurrentPosition)
                    break;
                case MessageType.UPDATE_OPTION: 
                    let optionPlayerIdAdd = receivedMessage.content.myId;
                    let optionAdd = receivedMessage.content.option;
                    //console.log(optionAdd)
                    //console.log(JSON.stringify(option, null, 2));
                    optionAdd = this.sharedIntentionQueue.convertToJSON(optionAdd)
                    let utilityAdd = receivedMessage.content.utility;
                    this.sharedIntentionQueue.addOrUpdateOption(optionPlayerIdAdd, optionAdd)
                    break;
                case MessageType.DELETE_OPTION: 
                    let optionPlayerIdDel = receivedMessage.content.myId;
                    let optionDel = receivedMessage.content.option;
                    optionDel = this.sharedIntentionQueue.convertToJSON(optionDel)
                    let utilityDel = receivedMessage.content.utility;
                    this.sharedIntentionQueue.deleteOption(optionPlayerIdDel, optionDel)
                    break;
                default:
                    console.error('[MESSAGE FILTERING] - Unknown message type:', messageType)
                    console.error(JSON.stringify(receivedMessage))
            }

        } else {
            console.error('[SPAM] - Invalid message structure:', receivedMessage)
            console.log(receivedMessage.messageType)
        }
    }


    /* 
    --------------------------------------------------
                Handling emitted events 
    --------------------------------------------------
            TODO: 
                - [x] check problems with event manager emitter
                (now it works, but we're handling it throught filterMessage directly) 
    */


    handleParcelsSensing(parcels){
        // notify master about parcels sensing 
        //console.log("[COMMUNICATION] - sensed parcels: ", parcels)
    }

    handlePlayersSensing(players){
        // notify master about players sensing 
        //console.log("[COMMUNICATION] - sensed players: ", players)
    }

    pickedUpParcels(parcels){
        // notify master about picked up parcels 
        //console.log("[COMMUNICATION] - picked up parcels: ", parcels)
    }

    handleBeliefSetUpdate(beliefs){
        // notify beliefset update
        //console.log("[COMMUNICATION] - beliefset update: ", beliefs)
    }
    
    handleUpdatedBeliefset(updateBeliefset){
        console.log("[ERRORRRRRRRRRRRRRRRRRRRRRR] : " + updateBeliefset)
    }

}

    /* 
    --------------------------------------------------
                TO-DO / TO-FIX
    --------------------------------------------------

            TO-DO: 
                - Ensure also master is building his intetion queue. 

                - Recompute Utility of options for each newly added option: 
                    option coming from agent a , does it have a better utility if done from agent b? 
                    if so add it to agent b queue.  (based on beliefset) 

                - Plan based on shared intention queues and send plan to agents. 



            TO-FIX: 
                - fix this error: 
                     const currentOptionId = this.agent.intentions.currentIntention.option.id
    /* 
    */
