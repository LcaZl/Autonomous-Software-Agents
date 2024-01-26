//import { Agent } from "../Agent.js";
import MessageType from './messageTypes.js';
import { Team , MasterIdPool} from './team.js';

let execTimes = 0  

export class Communication{

    constructor(agent){
        this.agent = agent
        this.team = this.agent.team
        this.tempBeliefSet = new Map()

        this.agent.client.onMsg((id, name, msg, reply) => {
            let answer = this.filterMessage(msg);
            if (reply) {
                try { reply(answer) } catch { (error) => console.error(error) }
            }
        });
    }


    activate(){
        this.agent.eventManager.on('picked_up_parcels', (pickedUpParcels) => this.pickedUpParcels(pickedUpParcels)  )
        this.agent.eventManager.on('parcels_percept', (parcels) => { this.handleParcelsSensing(parcels); });
        this.agent.eventManager.on('players_percept', (sensedPlayers) => this.handlePlayersSensing(sensedPlayers));
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

    composeUpdateParcelBeliefMsg(parcelId, belief){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_PARCELS_BELIEFS, {myId, parcelId, belief});
    }

    composeUpdatePlayerBeliefMsg(playerId, belief){
        let myId = this.agent.agentID
        return this.createMessage(this.team.teamId, MessageType.UPDATE_PLAYERS_BELIEFS, {myId, playerId, belief});
    }

    /* 
    --------------------------------------------------
                    Performatives 
    --------------------------------------------------
    you can make this cleaner, e.g.: 
        message 1 : introduce yourself
        message 2 : update belief-set 
        and so on, then call a single sendMessage(message_id, content) function. 
    */   

    async introduceYourself(myRanking){    
        try {
            let message = this.composeTeamFormationMsg(myRanking)
            await this.agent.client.shout(message);
        } catch (error) {
            console.error(" [SHOUT] - Error while introducing yourself:", error);
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

    async updateParcelBeliefSet(parcelId, belief){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeUpdateParcelBeliefMsg(parcelId, belief)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[PARCEL UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating parcel beliefs:", error)
        }
    };

    async updatePlayerBeliefSet(playerId, belief){
        try {
            if(this.team.masterId && !this.team.MASTER){
                let message = this.composeUpdatePlayerBeliefMsg(playerId, belief)
                await this.agent.client.say(this.team.masterId, message);
            } else {
                if(!this.team.MASTER)
                    console.log("[PLAYER UPDATE] - problem with masterId: ", this.team.masterId)
            }
        } catch (error){
            console.error("[SAY] - error updating player beliefs:", error)
        }   
    }

    /* 
    --------------------------------------------------
            Handle temp. (shared) belief-set
    --------------------------------------------------
    */

    updateTempBeliefSet(playerId, playerBelief){

        // don't overwrite carried parcels. 

        execTimes += 1
        let objectOfInterest = playerBelief[1]
        this.tempBeliefSet[objectOfInterest] = playerBelief[0] + " " + playerBelief[2]

        if(execTimes == 10){
            console.log("[MASTER TEMP BELIEFSET]:")
            console.log(this.tempBeliefSet)
            console.log("----")
            execTimes = 0
        }
    }

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
                    break;
                case MessageType.ASK_FOR_PLAN:
                    break;
                case MessageType.UPDATE_BELIEFS:
                    break;
                case MessageType.UPDATE_PARCELS_BELIEFS:
                    let parcelId = receivedMessage.content.parcelId;
                    let parcelBelief = receivedMessage.content.belief.split(" ");
                    this.updateTempBeliefSet(parcelId, parcelBelief) 
                    break;
                case MessageType.UPDATE_PLAYERS_BELIEFS:
                    let playerId = receivedMessage.content.playerId;
                    let playerBelief = receivedMessage.content.belief.split(" ");
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
            TODO: check problems with event manager emitter. 
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
                - check problems with event manager emitter. 
            TO-FIX: 
                - fix this error: 
                     const currentOptionId = this.agent.intentions.currentIntention.option.id
    /* 
    */
