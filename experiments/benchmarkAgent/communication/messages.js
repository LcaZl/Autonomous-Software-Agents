import MessageType from './messageTypes';

class Communication {
    constructor(teamId, myId, masterId, masterRanking) {
        this.team = team.id;
        this.myId = myId;
        this.masterId = masterId;
        this.masterRanking = masterRanking;
    }

    createMessage (messageType, content) {
        return {
            teamId : this.teamId,
            messageType : messageType, 
            content : content
        }; 
    }

    /* COMPOSING MESSAGES */

    composeTeamFormationMsg (agentRanking) {
        return createMessage(teamId, MessageType.TEAM_FORMATION, {myId, agentRanking});
    };


    composeMasterCheckMsg () {
        if (masterId !== null) { 
            return createMessage(teamId, MessageType.MASTER_CHECK, {myId, masterId, masterRanking});
        } else {
            let masterId = myId;
            let masterRanking = myRanking; 
            return createMessage(teamId, MessageType.MASTER_CHECK, {myId, masterId, masterRanking});
        }
    };

    composeAskMasterMsg () {
        return createMessage(teamId, MessageType.ASK_MASTER, {myId}); 
    };

    composeAskForPlanMsg (agentPosition) {
    // substitute currentPosition with the centre-of-mass
    //let pos = client.agentPosition
    let pos = agentPosition
    return createMessage(teamId, MessageType.ASK_FOR_PLAN, {myId, pos}); 
    };

    async composePlanAssignmentMsg (agentId, agentPosition) {
        let plan = extractAgentPlan(agentId, agentPosition); 
        return createMessage(teamId, MessageType.PLAN_ASSIGNMENT, {plan});
    };

    async tempPlanAssignmentMsg(plan) {
        return createMessage(teamId, MessageType.PLAN_ASSIGNMENT, {plan});
    };

    async composeUpdateBeliefstMsg (beliefSet, agentPosition) {
        return createMessage(teamId, MessageType.UPDATE_BELIEFS, {myId, beliefSet, agentPosition});
    };
   
    /* PERFORMATIVES */
    
    async introduceYourself () {    
        try {
            let message = composeTeamFormationMsg(myRanking)
            //await client.shout(message);
            client.shout(message);
        } catch (error) {
            console.error(" [SHOUT] - Error while introducing yourself:", error);
        }
    };

    async lookForMaster () {
        try {
            let message = composeAskMasterMsg(); 
            await client.shout(message);
        } catch (error) {
            console.error(" [SHOUT] - Error while asking for MasterId:", error);
        }
    };

    async askForPlan () {
        let planRequest = composeAskForPlanMsg()
        if (masterId !== null) {
            try {
                await client.say(masterId, planRequest);    
            } catch (error) {
                consolel.error("[SAY] - Error while sending a plan: ", error);
            }
        }
    };    

    async updateBeliefSet (beliefSet, agentPosition) {
        try {
            let message = await composeUpdateBeliefstMsg(beliefSet, agentPosition); 
            console.log("[UPDATE-BELIEFS-SET] sending: \n\n " + JSON.stringify(message) + "\n\n")
            await client.say(masterId, message);
        } catch (error) {
            console.error("[UPDATE-BELIEFS-SET] - Error while sending belief-set update to master:", error);
        }
    };

    async sendPlan (agent, goalPosition) {
        try {
            let message = await tempPlanAssignmentMsg(goalPosition)
            console.log("SENDING PLAN : \n" + JSON.stringify(message) + "\n\n")
            await client.say(agent, message)
        } catch (error) {
            console.error(" [SAY] - Error while sending plan back to agent:", error) 
        }
    }

    /* MESSAGE FILTERING */

    async filterMessage (receivedMessage) {
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
            } else {
            console.error('[SPAM] - Invalid message structure:', receivedMessage);
        }
    };
}
}