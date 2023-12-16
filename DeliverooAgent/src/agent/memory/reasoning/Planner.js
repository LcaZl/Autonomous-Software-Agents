import { PddlProblem } from '@unitn-asa/pddl-client';
import { Agent } from '../../agent.js';
import { BlindMove, BreadthFirstSearchMove, Patrolling, PddlMove } from './Moves.js';
import fs from 'fs'
import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from '../../../utils/Position.js';
import { ProblemGenerator } from './ProblemGenerator.js';

/**
 * Classe used to manage the selection of the next action of the agent
 */
export class Planner {

    /**
     * @param {Brain} brain - The brain
     * @param {Agent} agent
    */
   
    constructor(agent) {

        this.agent = agent
        this.library = []
        this.library.push( Patrolling )
        this.library.push( BlindMove )

        this.regex = /(\d+)/g
        this.positionMap = new Map()
        this.problemGenerator = new ProblemGenerator(agent)

        switch (agent.moveType){
            case 'BFS':
                this.library.push( BreadthFirstSearchMove )
                break;
            case 'PDDL':
                this.library.push( PddlMove )
                this.library.push( BreadthFirstSearchMove )
                break;
        }
        this.cache = new Map()

        this.agent.log('[INIT] Planner Initialized.')
    }

    getDomain(){ return this.domain }

    getPlanLibrary() {return this.library }

    async loadDomain() {
        try{
            this.domain = await this.readFile('agent/memory/pddl/domain.pddl')
            this.agent.log('[INIT] Planner Domain loaded')//,this.domain)
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
        }
    }

    /**
     * @param {PddlProblem} pddlProblem 
     * @returns 
    */
    async requestPlan(problem){
        try{
            let plan = null
            plan = await onlineSolver( this.domain, problem );
            this.agent.onlineSolverCalls++
            if (!plan || plan.length == 0){
                return null
            }
            return plan
        }
        catch (error){
            console.log('Error while requesting plan. Error:\n', error)
            process.exit(0)
        }
    }


    async getPlanFromTo(from, to){
        //console.log('getPlanFromTo',startPosition, endPosition)
        const cacheId = `${from.x}_${from.y}-${to.x}_${to.y}`
        const cachedPlan = this.checkCache(cacheId, null, null)
        if (cachedPlan != null) return cachedPlan

        const problem = this.problemGenerator.go(from, to)
        const plan = await this.requestPlan(problem)

        if (!plan) {
            console.log('Plan not found for go from', from, ' to ', to)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan)
        return wrappedPlan

    }

    async getDeliveryPlan(startPosition, parcelId){
        //console.log('getDeliveryPlan',startPosition, parcelId)    
        const cacheId = `${startPosition.x}_${startPosition.y}-delivery`
        const cachedPlan = this.checkCache(cacheId, 'deliver', parcelId)
        if (cachedPlan != null) return cachedPlan

        const problem = this.agent.problemGenerator.deliverFrom(startPosition, parcelId)
        const plan = await this.requestPlan(problem)

        if (!plan){
            console.log('Plan not found for delivery from', startPosition, ' with ', parcelId)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan, startPosition)
        this.cache.set(`${startPosition.x}_${startPosition.y}-delivery`, wrappedPlan)
        return wrappedPlan

    }

    async getPickupPlan( from, parcel){
        //console.log('getPickupPlan',parcel.id, from)
        const cacheId = `${from.x}_${from.y}-${parcel.position.x}_${parcel.position.y}`
        const cachedPlan = this.checkCache(cacheId, 'pickup', parcel.id)
        if (cachedPlan != null) return cachedPlan

        let problem = null
        problem = this.problemGenerator.pickupFrom(from, parcel.id)

        const plan = await this.requestPlan(problem)

        if (!plan) {
            console.log('Plan not found for single pickup.')
            return null
        }

        const wrappedPlan = this.wrapPlan(plan)
        return wrappedPlan

    }

    checkCache(cacheId, type , parcelId){

        if (this.cache.has(cacheId)){
            let cacheHit = this.cache.get(cacheId)
            if (type !== null) {
                cacheHit.actions.push(type)
                cacheHit.steps.push({
                    parallel : false,
                    action : type,
                    args : [this.agent.agentID, parcelId, this.exractTilePositionFromPDDL(cacheHit.steps[cacheHit.steps.length - 1].args[2])]
                })
            }
            this.cache.delete(cacheId)
            this.agent.cacheHit++
            return cacheHit
        }

        return null
    }

    exractTilePositionFromPDDL(str){
        if(this.positionMap.has(str)) return this.positionMap.get(str)
        const numbers = str.match(this.regex).map(Number)
        const position = new Position(numbers[0], numbers[1])
        this.positionMap.set(str, position)
        return position
    }

    generateCacheId(startPosition, endPosition){

        if (endPosition === 'delivery') return `${startPosition.x}_${startPosition.y}-delivery`
        else return `${startPosition.x}_${startPosition.y}-${parcel.position.x}_${parcel.position.y}`
    }

    readFile ( path ) {

        return new Promise( (res, rej) => {
      
            fs.readFile( path, 'utf8', (err, data) => {
                if (err) rej(err)
                else res(data)
            })
      
        })
      }

      wrapPlan(plan){
        
        const startPosition = this.exractTilePositionFromPDDL(plan[0].args[1])
        let wrappedPlan = {
            steps : [],
            actions : [],
            positions : [this.exractTilePositionFromPDDL(plan[0].args[1])],
            startPosition : startPosition,
            finalPosition : this.exractTilePositionFromPDDL(plan[plan.length - 1].args[2]),
            length : 0
        }

        let cacheActions = []
        let cacheSteps = []
        let length = 0

        for (const [index, step] of plan.entries()){
            const stepPosition = this.exractTilePositionFromPDDL(step.args[2])
            wrappedPlan.steps.push(step)
            wrappedPlan.positions.push(stepPosition)

            if (step.action.startsWith('move')){
                wrappedPlan.actions.push(step.action.split('_').at(1))
                length += 1

                // caching path
                cacheSteps.push(step)
                cacheActions.push(step.action.split('_').at(1))
                const key = `${startPosition.x}_${startPosition.y}-${stepPosition.x}_${stepPosition.y}` 
                const subPlan = {
                    steps : [...cacheSteps], 
                    startPosition : startPosition,
                    finalPosition : stepPosition, 
                    positions : [...wrappedPlan.positions],
                    actions : [...cacheActions],
                    length : length,
                }
                this.cache.set(key, subPlan)
            }
            else{
                wrappedPlan.actions.push(step.action)
            }
        }

        wrappedPlan.length = length
        return wrappedPlan
      }

      savePlan(plan){

        const totalStartPosition = this.exractTilePositionFromPDDL(plan[0].args[1])
        let steps = []
        let positions = new Set().add(totalStartPosition)
        let actions = []
        let finalPosition = null

        for (let step of plan){

            if (step.action.startsWith('move')) {
                steps.push(step)
                actions.push(step.action.split('_').at(1))
                finalPosition = this.exractTilePositionFromPDDL(step.args[2])
                const key = `${totalStartPosition.x}_${totalStartPosition.y}-${finalPosition.x}_${finalPosition.y}` 
                positions.add(finalPosition)

                const subPlan = {
                    id: key,
                    steps : steps, 
                    startPosition : totalStartPosition,
                    finalPosition : finalPosition, 
                    positions : [...positions],
                    actions : actions,
                    length : actions.length,
                }

                this.cache.set(key, subPlan)
            }
        }
    }
}


/**
 *             //id = this.generateCacheId(type, startPosition, parcels)
        //console.log(' - id:',id)
        //if (this.cache.has(id)){
            //console.log('PLAN FOUND in cache:')
            //console.log(this.cache.get(id))
            //return this.cache.get(id)
        //}
 * 
    savePlan(plan){
        const totalStartPosition = this.exractTilePositionFromPDDL(plan[0].args[1])
        let singleStartPosition = totalStartPosition
        
        let steps = []
        let totalPositions = new Set().add(totalStartPosition)
        let singlePositions = new Set().add(singleStartPosition)
        let actions = []
        let finalPosition = null
        let subPlans = []
        let previousParcels = []
        let startIndex = 0
        let key = null
        let reward = 0

        const addCachePlan = (step, finalPosition) => {
            const key = `${totalStartPosition.x}_${totalStartPosition.y}-${finalPosition.x}_${finalPosition.y}` 
            actions.push(step.action.split('_').at(1))
            totalPositions.add(finalPosition)
            singlePositions.add(finalPosition)

            const subPlan = {
                id: key,
                steps : steps, 
                startPosition : totalStartPosition,
                finalPosition : finalPosition, 
                positions : [...totalPositions],
                actions : actions,
                parcelIds : [],
                previousParcels : [],
                length : actions.length,
                reward : reward
            }

            this.cache.set(key, subPlan)
        }

        for (let [index, step] of plan.entries()){
            
            steps.push(step)
            finalPosition = this.exractTilePositionFromPDDL(step.args[2])

            if (step.action.startsWith('move')) 
                addCachePlan(step, finalPosition)


            else if (step.action === 'pickup' || step.action === 'deliver'){
                actions.push(step.action)
                if(step.action === 'pickup'){
                    key = `pickup-${step.args[1]}`
                    reward += this.agent.parcels.getParcels().get(step.args[1]).reward
                }
                else
                    key = `${singleStartPosition.x}_${singleStartPosition.y}-delivery`

                const subPlan = {
                    id: key,
                    steps : steps.slice(startIndex), 
                    startPosition : singleStartPosition,
                    finalPosition : finalPosition, 
                    positions : [...singlePositions],
                    actions : actions.slice(startIndex),
                    parcelId : step.args[1],
                    previousParcels : previousParcels,
                    length : actions.slice(startIndex).length,
                    reward : reward
                }

                if (step.action === 'deliver')
                    this.cache.set(subPlan.id, subPlan)

                console.log('Sub plan ',subPlan.id)
                console.log(' - length', subPlan.length)
                console.log(' - startPosition', subPlan.startPosition)
                console.log(' - finalPosition', subPlan.finalPosition)
                console.log(' - positions', subPlan.positions.values().toString())
                console.log(' - actions', subPlan.actions.toString())
                console.log(' - reward', subPlan.reward)
                console.log(' - id', subPlan.parcelId)
                subPlans.push(subPlan)
                singleStartPosition = finalPosition
                singlePositions = new Set().add(finalPosition)
                previousParcels = previousParcels.concat([step.args[1]])
                startIndex = index + 1
            }

            else{
                console.log('Action not recognized. ', step)
                process.exit(0)
            }

            //console.log(' - subPlans:')
            //for (let t of wrappedPlan.steps)
              //  console.log(t)


        }

        //console.log('\nPlan splitted:\n')
        //for (let el of subPlans){
          //  console.log(el)
        //}

        let wrappedPlan = {
            id: key,
            steps : steps, 
            startPosition : totalStartPosition,
            finalPosition : finalPosition, 
            positions : [...totalPositions],
            actions : actions,
            parcelIds : previousParcels,
            previousParcels : previousParcels,
            length : actions.length,
            reward : reward
        }

        return {total:wrappedPlan, subPlans:subPlans}
    }
 */