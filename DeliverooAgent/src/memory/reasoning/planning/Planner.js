import { PddlProblem } from '@unitn-asa/pddl-client';
import { Agent } from '../../../agent.js';
import { BreadthFirstSearchMove, Patrolling, PddlMove } from '../Moves.js';
import fs from 'fs'
import { onlineSolver } from "@unitn-asa/pddl-client";
import { Position } from '../../../utils/Position.js';
import { ProblemGenerator } from './ProblemGenerator.js';
import { Parcel } from '../../../Environment/Parcels/Parcel.js';
import { performance } from 'perf_hooks';

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

        console.log('[INIT] Planner Initialized.')
    }

    getDomain(){ return this.domain }

    getPlanLibrary() {return this.library }

    async loadDomain() {
        try{
            this.domain = await this.readFile('./src/memory/pddl/domain.pddl')
            console.log('[INIT] Planner Domain loaded')//,this.domain)
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
            process.exit(0)
        }
    }

    /**
     * Manage the request for a plan to the online solver.
     * 
     * @param {PddlProblem} pddlProblem 
     * @returns 
    */
    async requestPlan(problem){
        try{
            let plan = null
            //console.log(this.agent.beliefs.toPddlString())
            plan = await onlineSolver( this.domain, problem.toPddlString() );
            this.agent.onlineSolverCalls += 1
            if (!plan || plan.length == 0){
                return null
            }
            return plan
        }
        catch (error){
            console.log('Error while requesting plan. Error:\n', error)
            return null
        }
    }

    /**
     * Get a plan from agent current position to a specified location.
     * Used for: Patrolling.
     * 
     * @param {Position} from 
     * @param {Position} to 
     * @returns 
     */
    async getPlanFromTo(from, to){

        const cacheId = `${from.x}_${from.y}-${to.x}_${to.y}`
        const cachedPlan = this.checkCache(cacheId, null, null)
        if (cachedPlan != null) {
            return cachedPlan
        }

        const problem = this.problemGenerator.go(from, to)
        const plan = await this.requestPlan(problem)

        if (!plan) {
            console.log('Plan not found for go from', this.agent.currentPosition, ' to ', to)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan)
        return wrappedPlan

    }

    /**
     * Get a delivery plan from start position to the nearest delivery tile.
     * The specified id will be used to set the parcel to deliver. Anyway when the
     * agent will deliverm, he will drop all carried parcels.
     * 
     * Used for: Pddl delivery.
     * 
     * @param {Position} startPosition 
     * @param {String} parcelId 
     * @returns 
     */
    async getDeliveryPlan(startPosition, parcelId){

        //const cacheId = `${startPosition.x}_${startPosition.y}-delivery`
        //const cachedPlan = this.checkCache(cacheId, 'deliver', parcelId)
        //if (cachedPlan != null) {
         //   return cachedPlan
        //}

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

    /**
     * Get a plan to pick a parcel from the specified position.
     * 
     * Used for: pddl pickup.
     * 
     * @param {Position} from 
     * @param {Parcel} parcel 
     * @returns 
     */
    async getPickupPlan( from, parcel){

        //const cacheId = `${from.x}_${from.y}-${parcel.position.x}_${parcel.position.y}`
        //const cachedPlan = this.checkCache(cacheId, 'pickup', parcel.id)
        //if (cachedPlan != null) {
            //return cachedPlan
        //}

        let problem = null
        problem = this.problemGenerator.pickupFrom(from, parcel.id)

        const plan = await this.requestPlan(problem)

        if (!plan) {
            console.log('Plan not found for single pickup from', from, ' to ', parcel.position)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan)
        return wrappedPlan

    }

    /**
     * Check the cache for element with cacheId. Then:
     * - if type is delivery, add a final delivery action on the last position of the founded plan;
     * - if type is pickup, add a final pickup action as above.
     * 
     * @param {String} cacheId 
     * @param {String} type 
     * @param {String} parcelId 
     * @returns 
     */
    checkCache(cacheId, type , parcelId){

        if (this.cache.has(cacheId)){
            let cacheHit = this.cache.get(cacheId)
            if (type !== null) {
                cacheHit.actions.push(type)

                // Here the last action is dinamically added based on type
                cacheHit.steps.push({
                    parallel : false,
                    action : type,
                    args : [this.agent.agentID, parcelId, cacheHit.steps[cacheHit.steps.length - 1].args[2]]
                })
            }
            this.cache.delete(cacheId)
            this.agent.cacheHit++
            return cacheHit
        }

        return null
    }

    /**
     * Extract a Position object from a pddl string.
     * 
     * @param {String} str 
     * @returns 
     */
    exractTilePositionFromPDDL(str){
        if(this.positionMap.has(str)) return this.positionMap.get(str)
        const numbers = str.match(this.regex).map(Number)
        const position = new Position(numbers[0], numbers[1])
        this.positionMap.set(str, position)
        return position
    }

    /**
     * The cache will use indexes based only on initial and final position.
     * Takes two positions and based on the value of endposition returns the appropriate index.
     * 
     * @param {Position} startPosition 
     * @param {Position} endPosition 
     * @returns 
     */
    generateCacheId(startPosition, endPosition){

        if (endPosition === 'delivery') return `${startPosition.x}_${startPosition.y}-delivery`
        else return `${startPosition.x}_${startPosition.y}-${parcel.position.x}_${parcel.position.y}`
    }

      

    /**
     * Takes in input the plan returned by the online solver and wrap it into a more
     * structured object. While doing this it saves all the subpath into the cache.
     * Returns the same plan but wrapped.
     * @param {Dict} plan 
     * @returns 
     */
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
        let cachePositions = []
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
                cachePositions.push(stepPosition)
                const key = `${startPosition.x}_${startPosition.y}-${stepPosition.x}_${stepPosition.y}` 
                const subPlan = {
                    steps : [...cacheSteps], 
                    startPosition : startPosition,
                    finalPosition : stepPosition, 
                    positions : [...cachePositions],
                    actions : [...cacheActions],
                    length : length,
                    uses : 0
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
    
    readFile ( path ) {
        return new Promise( (res, rej) => {
        
            fs.readFile( path, 'utf8', (err, data) => {
                if (err) rej(err)
                else res(data)
            })
        
        })
    }
}
