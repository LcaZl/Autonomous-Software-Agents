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
            if (this.teamManager.sincronized)
                this.messaggeDispatcher(packet)
            else
                this.sincornizationProcedure(packet)
        });

        // Send sinchronization message to everyone
        const msg = {
            type : 'sincro_0',
        }
        this.agent.client.shout( msg );
    }

    activate(){
        //this.agent.eventManager.on('update_parcels_beliefs', () => this.updateParcels())
        //this.agent.eventManager.on('update_players_beliefs', () => this.updatePlayers())
        //this.agent.eventManager.on('deleted_parcel', (id) => this.deleteParcel(id))
        //this.agent.eventManager.on('movement', () => this.updateMyPosition())
        this.agent.eventManager.on('picked_up_parcels', (pickedUpParcels) => this.pickedUpParcels(pickedUpParcels)  )
        //this.agent.eventManager.on('delivered_parcels', (deliveredParcels) => this.deliveredParcels(deliveredParcels)  )
        //this.agent.eventManager.on('new_intention', (option) => this.myNewIntention(option) )
        /**
         * Master:
         * Comunica cosa fa e richiede info allo slave
         * Lo slave comunica la sua intenzione al master per l'approvazione
         * Il master manda l'approvazione o meno
         * 
         * Slave:
         * Se l'intenzione fallisce comunica la prossima al master
         * IL master registra l'intenzione e la approva o meno
         * 
         * Il master sostanzialmente non deve richiedere conferma per le sue azioni. Semplicemente valida quelle degli slave
         *  Cosi:
         * MAster e slave:
         * - Comunica parcel e player visti
         * - Comunica propria posizione
         * 
         * Master:
         * - Validazione intenzioni slave
         * 
         * Slave:
         * - Richiesta approvazione intenzione al master
         */
    
    }

    async sincornizationProcedure(packet){
        switch(packet.message.type){
            case 'sincro_0':
                // if thhe message cames from a known name and the team is not already sinchronized
                if (this.teamManager.teamNames.has(packet.name)){
                    console.log('in sicnto')

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
                        this.teamBroadcastMessage(msg)
                    }
                }
                break;
            case 'sincro_1':
                if (this.agent.teamNames.has(packet.name)){
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
            default:
                console.log('Packet not recognized. Message:\n', packet)
                break;
            }
    }
    async messaggeDispatcher(packet){

        switch(packet.message.type){
            case 'pickup':
                this.agent.parcels.deleteParcel(packet.message.id)
                this.agent.eventManager.emit('update_options')     
                break;
            case 'delivered':
                for (const pId of packet.message.ids){
                    this.agent.parcels.deleteParcel(pId)
                }
                break;
            case 'new_intention':
                if (packet.message.parcelId === null){ // Teammate is delivering

                }
                else{ // Teammate is going to pick up something

                }
                break;
            default:
                console.log('Packet not recognized. Message:\n', packet)
                break;
        }
    
    }

    myNewIntention(option){
        if (!option.id.endsWith('patrolling')){
            const message = {
                type : 'new_intention',
                parcelId : option.parcel != null ? option.parcel.id : null,
                position : option.position
            }
            this.teamBroadcastMessage(message)
        }
    }

    deliveredParcels(parcels){
        
        const message = {
            type : 'delivered',
            ids : parcels.map(p => p.id),
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
        return;
    }

    async teamBroadcastMessage(msg){
        msg.currentPosition = this.agent.currentPosition
        for (const teammateId of this.teamManager.teamIds()){
            console.log('Sending this message to ',teammateId,';\n', msg)
            await this.agent.client.say(teammateId, msg)
        }
    }

    updateTeamPositions(){

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