import { Agent } from "../../Agent.js";

export class Option{
    
        /**
     * Constructs a new instance of the Option class.
     * 
     * @param {string} id - The identifier of the option.
     * @param {Position} position - The position associated with this option.
     * @param {number} utility - The utility value of the option.
     * @param {boolean} search - Contains information of the first search.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     */
        constructor(id, startPosition, finalPosition, utility) {
            this.id = id
            this.startPosition = startPosition
            this.finalPosition = finalPosition
            this.utility = utility;
        }
}
export class BfsOption extends Option{
    /**
     * Constructs a new instance of the Option class.
     * 
     * @param {string} id - The identifier of the option.
     * @param {Position} position - The position associated with this option.
     * @param {number} utility - The utility value of the option.
     * @param {boolean} search - Contains information of the first search.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     */
    constructor(id, startPosition, finalPosition, utility, search, arg) {
        super(id, startPosition, finalPosition, utility)
        this.bfs = search

        if (id.startsWith('bfs_pickup-'))
            this.parcel = arg
        else
            this.parcelIds = arg
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_id: ${this.parcel ? this.parcel.id : ''}, Search: ${this.search ? this.search.firstPosition : ''}]`;
    }
}

export class PddlOption extends Option{

    /**
     * 
     * @param {*} id 
     * @param {*} startPosition 
     * @param {*} finalPosition 
     * @param {*} utility 
     * @param {Agent} agent 
     * @param {*} parcel 
     */
    constructor(id, utility, startPosition, finalPosition, agent, parcel){
        super(id, startPosition, finalPosition, utility)
        this.agent = agent
        this.parcel = null
        this.parcelId = null

        if (this.id === 'pddl_delivery' || this.id.startsWith('pddl_pickup-')){
            this.parcel = parcel
            this.parcelId = parcel.id
        }

        this.plan = null
        this.updatePlan(this.agent.currentPosition)
    }

    async updatePlan(startPosition){
        //console.log('updating single plan for ', this.id)

        this.startPosition = startPosition

        if (this.id === 'pddl_patrolling')
            this.plan = await this.agent.planner.getPlanFromTo(this.startPosition, this.finalPosition)
        
        else if (this.id === 'pddl_delivery')
            this.plan = await this.agent.planner.getDeliveryPlan(this.startPosition, this.parcelId)

        else if (this.id.startsWith('pddl_pickup-'))
            this.plan = await this.agent.planner.getPickupPlan(this.startPosition, this.parcel)

        else throw ['Option_id_not_valid', this.id]

        if (this.plan != null){
            this.finalPosition = this.plan.finalPosition
            //this.updateUtility()
        }
    }

    updateUtility(){

        let distance = (this.plan.steps.length - 1)
        let reward = this.agent.parcels.getMyParcelsReward()

        if (this.id.startsWith('pddl_pickup-')){
            distance = (this.plan.steps.length - 1) + this.parcel.pathToDelivery.length
            reward = this.parcel.reward
        }   

        let cost = distance * this.agent.options.utilityCalcolator.movementPenality
        if (this.startPosition.isEqual(this.agent.currentPosition))
            cost += this.startPosition.distanceTo(this.agent.currentPosition)
        
        this.utility = reward - cost
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_ids: ${this.parcelId}`
    }

}
/**
 * 
 * 
export class MultiplePddlOption{

    constructor(multipleGoalPlan, utility, agent){
        
        this.id = 'pddl_pickup-'
        this.agent = agent
        this.utility = utility
        this.startPosition = multipleGoalPlan.startPosition

        this.totalReward = 0
        this.length = 0
        this.checkpoints = []
        this.parcelIds = new Set()

        let finalIndex = 0
        for (const checkpoint of multipleGoalPlan.checkpoints){
            if (checkpoint.type === 'pickup'){
                const currentParcel = this.agent.parcels.getParcels().get(checkpoint.parcelId)
                if (!currentParcel) break;
                this.checkpoints.push(checkpoint)
                this.totalReward += currentParcel.reward
                this.parcelIds.add(checkpoint.parcelId)
                this.id += checkpoint.parcelId
                this.finalPosition = checkpoint.position
                this.length += checkpoint.length
                finalIndex = checkpoint.finalIndex + 1
            }
        }

        this.actions = multipleGoalPlan.actions.slice(0, finalIndex)
        this.steps = multipleGoalPlan.steps.slice(0, finalIndex)
        this.positions = multipleGoalPlan.positions.slice(0, finalIndex)
        this.currentSubOptionId = this.checkpoints[0].parcelId
    }

    getSubOptions(){
        let options = []
        while(this.checkpoints.length > 0){
            let id = null
            let parcel = null
            const checkpoint = this.checkpoints.shift()
            if (!checkpoint) return null
            if (checkpoint.type === 'pickup'){
                id = `pddl_pickup-${checkpoint.parcelId}`
                parcel = this.agent.parcels.getParcels().get(checkpoint.parcelId)
            }
            else if (checkpoint.type === 'deliver'){
                id = `pddl_delivery`
                parcel = this.agent.parcels.getParcels().get(checkpoint.parcelId)
            }
            if (!parcel) return null

            const plan = {
                steps : this.steps.slice(checkpoint.startIndex, checkpoint.finalIndex + 1),
                actions : this.actions.slice(checkpoint.startIndex, checkpoint.finalIndex + 1),
                positions : this.positions.slice(checkpoint.startIndex, checkpoint.finalIndex + 1)
            }
            const option = new SinglePddlOption(id, 
                    checkpoint.previousCheckpointPosition, 
                    checkpoint.position, 
                    this.utility,
                    this.agent,
                    parcel,
                    plan
                    )
            this.currentSubOptionId = parcel.id
            options.push(option)
        }
        return options
        
    }

    async extendWithDelivery(){
        const deliveryPlan = await this.agent.planner.getDeliveryPlan(this.finalPosition, this.parcelIds.values().next().value)
        
        if (deliveryPlan){
            const newCheckpoint = deliveryPlan.checkpoints[0]
            newCheckpoint.startIndex = this.checkpoints[this.checkpoints.length - 1].finalIndex + 1
            newCheckpoint.finalIndex = this.steps.length + newCheckpoint.length
            this.checkpoints.push(newCheckpoint)
            this.steps.push(...deliveryPlan.steps)
            this.actions.push(...deliveryPlan.actions)
            this.positions.push(...deliveryPlan.positions)
            this.length += deliveryPlan.length
            this.finalPosition = deliveryPlan.finalPosition
        }
    }

    toString() {
        let description = ``;
        description += `Id: ${this.id} - `;
        description += `PIds: ${this.parcelIds.values().toString()} - `;
        description += `U: ${this.utility} - `;
        description += `L: ${this.length} - `;
        description += `TotR: ${this.totalReward} - `;
        description += `SP ${this.startPosition} - `;
        description += `Fp: ${this.finalPosition} -`;
        description += `Fp: ${this.currentSubOptionId} -`;

        for (let i = 0; i < this.steps.length; i++){
            description += `\nStep ${i}\n`
            description += `Action: ${this.actions[i]}\n`
            description += `Position: ${this.positions[i]}\n`
            description += `Step: ${this.steps[i].action} ${this.steps[i].args}\n`
        }
        return description;
    }
 *     async init(){
        let targetPositions = []
        let targetParcels = []
        for (let opt of this.options){
            console.log(' - ', opt.data.toString())
            targetPositions.push(opt.data.position)
            targetParcels.push(opt.data.id == 'go_deliver' ? 'delivery' : opt.data.parcel)
        }

        console.log(' - positions:', targetPositions)
        console.log(' - parcels:', targetParcels.toString())
        let problem = this.agent.problemGenerator.goToMultipleOption(targetParcels)
        console.log(problem)
        let plan = await this.agent.planner.getPlan( problem )
        console.log(plan)
    }

    extractSubOptions(){
        let finalPosition = null
        let intermediateStartPosition = this.startPosition
        let positions = [this.startPosition]
        let parcels = []
        let length = 0
        let bestUtility = 0
        let startIndex = 0

        for (let [index, step] of this.plan.steps.entries()){
            length += 1
            
            if (step.action === 'pickup'){ // Goal
                finalPosition = this.agent.planner.exractTilePositionFromPDDL(step.args[2])
                const currentParcel = this.agent.parcels.getParcels().get(step.args[1])
                const currentReward = currentParcel.reward

                const cost = ((length - 1)) * (this.agent.options.utilityCalcolator.movementPenality)
                const utility = this.totalReward - (cost * (parcels.length + 1))

                if (utility >= bestUtility)
                    bestUtility = utility
                else break;

                const subPlan = {
                    steps : [...this.steps.slice(startIndex, index + 1)], 
                    positions : [...positions],
                    actions : [...this.actions.slice(startIndex, index + 1)],
                    startPosition : intermediateStartPosition,
                    finalPosition : finalPosition, 
                    previousParcels : parcels,
                    length : length - 1,
                    utility : utility,
                }

                this.subPlans.push(subPlan)
                this.subOptions.push(new PddlOption(`pddl_pickup-${currentParcel.id}`, intermediateStartPosition, finalPosition, utility, subPlan, currentParcel))
                
                intermediateStartPosition = finalPosition
                positions = [intermediateStartPosition]
                parcels = parcels.concat([currentParcel])
                this.length += length - 1
                length = 0
                startIndex = index + 1
            }

        }

        this.utility = bestUtility
        this.finalPosition = finalPosition


    }

    toString() {
        let str = `Multiple option:\n`
        str += `\n - length: ${this.length}`
        str += `\n - startPosition: ${this.startPosition}`
        str += `\n - finalPosition: ${this.finalPosition}`
        str += `\n - totalReward: ${this.totalReward}`
        str += `\n - parcelIds: ` + this.parcelIds
        str += `\n - actions: ${this.actions}`
        //str += `\n - steps: ${this.steps}`
        str += `\n - positions: ${this.positions}`
        for (let el of this.subOptions)
            str += `\n -- subOptions: ${el}`
        for (let el of this.subPlans){
            str += `\n - subPlan: ${el.id}\n -- ${el.parcel}\n -- ${el.length}\n -- ${el.actions}`
        }
        return str
    }

    export class MultipleGoalPddlOption{

    constructor(multipleGoalPlan, agent){
        
        this.id = 'pddl_pickup-'
        this.rawPlan = multipleGoalPlan
        this.agent = agent
        this.parcelIds = new Set()
        this.utility = 0
        this.length = 0
        this.totalReward = 0
        this.startPosition = multipleGoalPlan.startPosition
        this.actions = []
        this.steps = []
        this.positions = []
        this.splitIdx = []
        this.goalPositions = []

        for (const  [index, action] of this.rawPlan.actions.entries()){
            if (action === 'pickup')
                this.splitIdx.push(index)
        }

        for (const index of this.splitIdx){
            const currentParcel = this.agent.parcels.getParcels().get(multipleGoalPlan.steps[index].args[1])
            if (!currentParcel) break;
            
            const currentReward = currentParcel.reward
            const totalReward = this.agent.parcels.getMyParcelsReward() + this.totalReward + currentReward
            const deliveryDistanceAtTheEnd = currentParcel.pathToDelivery.length
            const carriedParcels = this.agent.parcels.carriedParcels() + this.parcelIds.size + 1
            const cost = (this.length + (index - 1) + deliveryDistanceAtTheEnd) * this.agent.options.utilityCalcolator.movementPenality
            this.utility = totalReward - (cost * carriedParcels)
            //console.log('-',index,' - UTILITY:', utility)

            this.length += index - 1
            this.parcelIds.add(currentParcel.id)
            this.id += currentParcel.id
            this.totalReward += currentReward
            this.finalPosition = multipleGoalPlan.positions[index]
            this.actions = multipleGoalPlan.actions.slice(0, index + 1)
            this.positions = multipleGoalPlan.positions.slice(0, index + 1)
            this.steps = multipleGoalPlan.steps.slice(0, index + 1)
            this.goalPositions.push(multipleGoalPlan.positions[index])
        }

        if (this.length === 0)
            return null
    }

    async extendWithDelivery(){
        //console.log('before utility:\n', this.toString())
        //console.log(this.agent.parcels.myParcels)
        const deliveryPlan = await this.agent.planner.getDeliveryPlan(this.finalPosition, this.parcelIds)
        if (deliveryPlan){
            this.steps.push(...deliveryPlan.steps)
            this.actions.push(...deliveryPlan.actions)
            this.positions.push(...deliveryPlan.positions)
            this.length += deliveryPlan.length - 1

            const totalReward = this.agent.parcels.getMyParcelsReward() + this.totalReward
            const carriedParcels = this.agent.parcels.carriedParcels() + this.parcelIds.size
            const cost = (this.length) * this.agent.options.utilityCalcolator.movementPenality
            this.utility = Math.max(totalReward - (cost * carriedParcels), 0)
        }
    }

    async updateStart(){
        //console.log('\n\nupdating start - BEFORE:\n',this.actions)
        const gotoPlan = await this.agent.planner.getPlanFromTo(this.agent.currentPosition, this.goalPositions[0])
        if (!gotoPlan) return null
        this.steps = this.steps.slice(this.splitIdx[0], this.steps.length)
        this.positions = this.positions.slice(this.splitIdx[0], this.positions.length)
        this.actions = this.actions.slice(this.splitIdx[0], this.actions.length)
        //console.log('\n\nupdating start - BEFORE:\n',this.actions)
1
        this.steps.unshift(...gotoPlan.steps)
        this.positions.unshift(...gotoPlan.positions)
        this.actions.unshift(...gotoPlan.actions)
        this.startPosition = this.positions[0]
        //console.log('\n\nupdating start - BEFORE:\n',this.actions)
    }

    toString() {
        let description = ``;
        description += `Id: ${this.id} - `;
        description += `PIds: ${this.parcelIds.values().toString()} - `;
        description += `U: ${this.utility} - `;
        description += `L: ${this.length} - `;
        description += `TotR: ${this.totalReward} - `;
        description += `SP ${this.startPosition} - `;
        description += `Fp: ${this.finalPosition}`;
        for (let i = 0; i < this.steps.length; i++){
            description += `\nStep ${i}\n`
            description += `Action: ${this.actions[i]}\n`
            description += `Position: ${this.positions[i]}\n`
            description += `Step: ${this.steps[i].action} ${this.steps[i].args}\n`
        }
        return description;
    }
 */