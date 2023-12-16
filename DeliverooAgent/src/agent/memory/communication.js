import { Agent } from "../Agent.js";

export class Communication{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent
        this.teamManager = agent.teamManager
        this.sincroRequest = 0

        this.agent.client.onMsg( async (id, name, msg, reply) => {
            const packet = {
                id : id,
                name : name,
                message : msg,
                reply : reply
            }
            console.log('Received message:\n', packet)

            this.messaggeDispatcher(packet)
        });

        // Send sinchronization message to everyone
        const msg = {
            type : 'sincro_0',
        }
        this.agent.client.shout( msg );
    }


    async messaggeDispatcher(packet){

        switch(packet.message.type){
            case 'sincro_0':
                // if thhe message cames from a known name and the team is not already sinchronized
                if (!this.teamManager.sincronized && this.agent.teamNames.has(packet.name)){
                    const msg = {
                        type : 'sincro_1',
                        position : this.agent.currentPosition, // Potentially i'm sending the position to an enemy 
                    }

                    // Requesting confirmation
                    const reply = await this.agent.client.ask(packet.id, msg)
                    console.log('in reply:', reply)
                    if (reply.type === 'sincro_2'){
                        // Confirmed, add team member
                        this.teamManager.addMember(reply.name, reply.id, reply.position)
                        this.sincroRequest += 1
                    }

                    console.log(this.sincroRequest, this.agent.teamSize)
                    
                    if (this.sincroRequest === (this.agent.teamSize - 1) ){
                        this.teamManager.setMaster(this.agent.agentID)
                        const msg = {
                            type : 'master_set',
                        }
                        await this.teamBroadcastMessage(msg)
                    }
                }
                break;
            case 'sincro_1':
                if (!this.teamManager.sincronized && this.agent.teamNames.has(packet.name)){
                    this.teamManager.addMember(packet.name, packet.id, packet.message.position)
                    const msg = {
                        type : 'sincro_2',
                        id : this.agent.agentID,
                        name: this.agent.name,
                        position : this.agent.currentPosition
                    }
                    packet.reply(msg)
                }
                break;
            case 'master_set':
                this.teamManager.setMaster(packet.id)
                break;
            case 'pickup':
                this.agent.parcels.deleteParcel(packet.message.id)
                //this.agent.eventManager.emit('picked_up_parcels_by', pickedUpParcels)     
                break;
            case 'delivered':
                for (const pId of packet.message.ids){
                    this.agent.parcels.deleteParcel(pId)
                }
                this.agent.teamScore += packet.message.reward
                break;
            case 'intention_changed':
                
                break;
            default:
                console.log('Packet not recognized. Message:\n', packet)
                break;
        }
    
    }

    myNewIntention(id){}

    deliveredParcels(parcels, reward){
        
        const message = {
            type : 'delivered',
            ids : parcels.map(p => p.id),
            reward : reward
        }
        this.teamBroadcastMessage(message)
    }

    pickedUpParcels(parcels){
        for (const p of parcels){
            const message = {
                type : 'pickup',
                id : p.id
            }
            this.teamBroadcastMessage(message)
        }
    }

    currentIntentionChanged(option){

    }

    async teamBroadcastMessage(msg){
        for (const teammateId of this.teamManager.teamIds()){
            console.log('Sending this message to ',teammateId,';\n', msg)
            await this.agent.client.say(teammateId, msg)
        }
    }
}

export class TeamManager{

    /**
     * 
     * @param {Agent} agent 
     */
    constructor(agent){
        this.agent = agent
        this.teamNames = agent.teamNames
        this.teamSize = agent.teamSize
        this.sincronized = false
        this.team = new Map()
        this.master = null
        this.me = {
            id : this.agent.agentID,
            name : this.agent.name,
            position : this.agent.currentPosition
        }
    }

    setMaster(id){
        this.master = id
        this.sincronized = true
        // Update beliefs, sincronization complete.
    }

    teamIds(){
        return this.team.keys()
    }

    addMember(name, id, position){
        console.log('adding member:',name, id, position)
        const teamMember = {
            id : id,
            name : name,
            position : position
        }

        this.team.set(id, teamMember)
    }

    
}