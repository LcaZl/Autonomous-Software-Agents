import { PddlProblem } from '@unitn-asa/pddl-client'
import { Agent } from '../../../agent.js'
import { BreadthFirstSearchMove, ParcelsSharingMovement, Patrolling, PddlMove, PddlMultiagentMove } from '../Moves.js'
import fs from 'fs'
import { onlineSolver } from "@unitn-asa/pddl-client"
import { Position } from '../../../utils/Position.js'
import { ProblemGenerator } from './ProblemGenerator.js'
import { Parcel } from '../../../Environment/Parcels/Parcel.js'
import { performance } from 'perf_hooks'

/**
 * Manages the plan generation.
 */
export class Planner {
    /**
     * Initializes the planner with a reference to the agent and sets up the planning library based on the agent's configuration.
     * 
     * @param {Agent} agent - The agent
     */
    constructor(agent) {
        this.agent = agent
        this.library = [Patrolling] // Default plan library, starting with Patrolling
        this.positionMap = new Map() // Vocabulary from PDDL position in string to Position object
        this.problemGenerator = new ProblemGenerator(agent) // Initializes the problem generator for PDDL planning
        this.cache = new Map() // Cache for storing planning results to optimize performance
        this.regex = /(\d+)/g

        // Configure the planning library based on the agent's movement type
        switch (agent.moveType) {
            case 'BFS':
                this.library.push(BreadthFirstSearchMove) // Add BFS planning strategy
                break
            case 'PDDL_1':
            case 'PDDL':
                this.library.push(PddlMove) // Add PDDL planning strategy
                break
        }

        // Add multi-agent strategies to the planning library if applicable
        if (agent.multiagent) {
            if (this.agent.moveType === 'PDDL_1')
                this.library.push(PddlMultiagentMove)
            this.library.push(ParcelsSharingMovement)
        }

        console.log('[INIT] Planner Initialized.')
    }

    /**
     * Returns the plan library
     * 
     * @returns {Array} The plan library.
     */
    getPlanLibrary() {
        return this.library
    }

    /**
     * Loads the PDDL domain from a file.
     */
    async loadDomain() {
        function readFile ( path ) {
            return new Promise( (res, rej) => {
            
                fs.readFile( path, 'utf8', (err, data) => {
                    if (err) rej(err)
                    else res(data)
                })
            
            })
        }

        try {
            // Assuming readFile is a defined method or utility that reads file contents
            this.domain = await readFile('./src/memory/pddl/domain.pddl')
            console.log('[INIT] Planner Domain loaded')
        } catch (exception) {
            console.error("[INIT] Planner initialization error.\n", exception)
            process.exit(0) // Consider handling the error without exiting if possible
        }
    }


    
    /**
     * Requests a plan from an online PDDL solver given a PDDL problem description.
     * 
     * @param {PddlProblem} problem - The PDDL problem instance.
     * @returns {Promise<Array>|null} A promise that resolves to the plan or null if no plan is found or an error occurs.
     */
    async requestPlan(problem) {
        try {
            let plan = await onlineSolver(this.domain, problem.toPddlString())
            this.agent.onlineSolverCalls++ // Track the number of solver calls for diagnostics

            if (!plan || plan.length === 0) {
                //console.log("Problem PDDL:", problem.toPddlString()) // Optionally log the problem for debugging
                return null
            }

            return plan
        } catch (error) {
            console.log('Error while requesting plan:', error)
            return null
        }
    }
        
    /**
     * Generates or retrieves from cache a plan for moving the agent from one location to another.
     * 
     * @param {Position} from - The starting position.
     * @param {Position} to - The destination position.
     * @returns {Promise<Object|null>} A promise that resolves to the wrapped plan object or null if no plan is found.
     */
    async getPlanFromTo(from, to) {
        const cacheId = `${from.x}_${from.y}-${to.x}_${to.y}`
        const cachedPlan = this.checkCache(cacheId, null, null)
        if (cachedPlan !== null) {
            return cachedPlan // Return cached plan if available
        }

        const problem = this.problemGenerator.go(from, to) // Generate problem definition
        const plan = await this.requestPlan(problem) // Request plan from solver

        if (!plan) {
            //console.log('Plan not found for go from', from, 'to', to, problem.toPddlString())
            return null
        }

        const wrappedPlan = this.wrapPlan(plan) // Wrap the raw plan for agent's use
        return wrappedPlan
    }

    /**
     * Generates or retrieves from cache a delivery plan to the nearest delivery tile from the start position.
     * 
     * @param {Position} startPosition - The position from where the delivery starts.
     * @param {String} parcelId - The identifier of the parcel to be delivered.
     * @returns {Promise<Object|null>} A promise that resolves to the wrapped delivery plan or null if no plan is found.
     */
    async getDeliveryPlan(startPosition, parcelId) {
        const cacheId = `${startPosition.x}_${startPosition.y}-delivery`
        const cachedPlan = this.checkCache(cacheId, 'deliver', parcelId)
        if (cachedPlan !== null) {
            return cachedPlan // Return cached plan if available
        }

        const problem = this.problemGenerator.deliverFrom(startPosition, parcelId) // Generate delivery problem
        const plan = await this.requestPlan(problem) // Request plan from solver

        if (!plan) {
            //console.log('Plan not found for delivery from', startPosition, 'with', parcelId)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan, startPosition) // Wrap the raw plan for agent's use
        return wrappedPlan
    }

    /**
     * Generates or retrieves from cache a plan for picking up a specified parcel.
     * 
     * @param {Position} from - The agent's current position.
     * @param {Parcel} parcel - The parcel to be picked up.
     * @returns {Promise<Object|null>} A promise that resolves to the wrapped pickup plan or null if no plan is found.
     */
    async getPickupPlan(from, parcel) {
        const cacheId = `${from.x}_${from.y}-${parcel.position.x}_${parcel.position.y}`
        const cachedPlan = this.checkCache(cacheId, 'pickup', parcel.id)
        if (cachedPlan !== null) {
            return cachedPlan // Return cached plan if available
        }

        const problem = this.problemGenerator.pickupFrom(from, parcel.id) // Generate pickup problem
        const plan = await this.requestPlan(problem) // Request plan from solver

        if (!plan) {
            //console.log('Plan not found for pickup from', from, 'to', parcel.position)
            return null
        }

        const wrappedPlan = this.wrapPlan(plan) // Wrap the raw plan for agent's use
        return wrappedPlan
    }

    /**
     * Retrieves a cached plan based on the cache ID and optionally appends a final action based on the type.
     * 
     * @param {String} cacheId - The unique identifier for the cached plan.
     * @param {String} type - The type of action to append to the plan, 'delivery' or 'pickup'.
     * @param {String} parcelId - The identifier of the parcel associated with the final action.
     * @returns {Object|null} The cached plan with the optional final action appended, or null if no cache hit.
     */
    checkCache(cacheId, type, parcelId) {
        if (this.cache.has(cacheId)) {
            let cacheHit = this.cache.get(cacheId)

            // Dynamically append final action based on the type if provided
            if (type !== null) {
                cacheHit.actions.push(type)
                cacheHit.steps.push({
                    parallel: false,
                    action: type,
                    args: [this.agent.agentID, parcelId, cacheHit.steps[cacheHit.steps.length - 1].args[2]]
                })
            }

            this.cache.delete(cacheId) // Remove the plan from cache after retrieval
            this.agent.cacheHit++ // Increment cache hit counter for the agent
            return cacheHit
        }

        return null // Return null if no cache hit
    }

    /**
     * Extracts a Position object from a given PDDL string.
     * 
     * @param {String} str - The PDDL string containing position information.
     * @returns {Position} The extracted position from the PDDL string.
     */
    extractTilePositionFromPDDL(str) {
        if (this.positionMap.has(str)) {
            return this.positionMap.get(str) // Return cached position if available
        }

        const numbers = str.match(this.regex).map(Number) // Extract numerical values from the string
        const position = new Position(numbers[0], numbers[1])
        this.positionMap.set(str, position) // Cache the extracted position for future use

        return position
    }

    /**
     * Wraps a raw plan from the online solver into a more structured object and caches all subpaths.
     * 
     * @param {Array} plan - The raw plan returned by the online solver.
     * @returns {Object} The wrapped plan with structured information and cached subpaths.
     */
    wrapPlan(plan) {
        const startPosition = this.extractTilePositionFromPDDL(plan[0].args[1])
        let wrappedPlan = {
            steps: [],
            actions: [],
            positions: [startPosition],
            startPosition: startPosition,
            finalPosition: this.extractTilePositionFromPDDL(plan[plan.length - 1].args[2]),
            length: 0
        }

        let cacheActions = [], cacheSteps = [], cachePositions = []
        let length = 0

        for (const [index, step] of plan.entries()) {
            const stepPosition = this.extractTilePositionFromPDDL(step.args[2])
            wrappedPlan.steps.push(step)
            wrappedPlan.positions.push(stepPosition)

            if (step.action.startsWith('move')) {
                wrappedPlan.actions.push(step.action.split('_').at(1))
                length++

                // Cache the subpath
                cacheSteps.push(step)
                cacheActions.push(step.action.split('_').at(1))
                cachePositions.push(stepPosition)
                const key = `${startPosition.x}_${startPosition.y}-${stepPosition.x}_${stepPosition.y}`
                const subPlan = {
                    steps: [...cacheSteps],
                    startPosition: startPosition,
                    finalPosition: stepPosition,
                    positions: [...cachePositions],
                    actions: [...cacheActions],
                    length: length,
                    uses: 0
                }
                this.cache.set(key, subPlan)
            } else {
                wrappedPlan.actions.push(step.action)
            }
        }

        wrappedPlan.length = length
        return wrappedPlan
    }

    /**
     * Generates a multi-agent plan for a master and slave agent based on their respective options.
     * 
     * @param {Object} masterOption - The option representing the master agent's task.
     * @param {Object} slaveOption - The option representing the slave agent's task.
     * @returns {Object|null} An object containing the plans for both master and slave agents, or null if no plan could be generated.
     */
    async getMultiagentPlan(masterOption, slaveOption){

        let masterPlan = []
        let slavePlan = []
        let plan = null
        const problem = this.problemGenerator.multiagentProblem(masterOption, slaveOption)
        
        if (problem === null){
            console.log('Error with problem', problem.toPddlString())
            process.exit(0)
        }

        const masterCacheId = problem.master.name
        const slaveCacheId = problem.slave.name
        //console.log('Cache ids: master:', masterCacheId, 'slave:',slaveCacheId)

        let masterCachedPlan = null
        if (masterCacheId.endsWith('delivery'))
            masterCachedPlan = this.checkCache(masterCacheId, 'deliver', masterOption.parcel.id)
        else
            masterCachedPlan = this.checkCache(masterCacheId, 'pickup', masterOption.parcel.id)

        let slaveCachedPlan = null
        if (slaveCacheId.endsWith('delivery'))
            slaveCachedPlan = this.checkCache(slaveCacheId, 'deliver', slaveOption.parcel.id)
        else
            slaveCachedPlan = this.checkCache(slaveCacheId, 'pickup', slaveOption.parcel.id)

        //console.log('master cached plan:', masterCachedPlan)
        //console.log('slave cached plan', slaveCachedPlan)

        if (masterCachedPlan === null && slaveCachedPlan === null){
            plan = await this.requestPlan(problem.total)
            if (!plan) {
                //console.log('Plan not found for', problem.total.toPddlString())
                return null
            }

            for (const el of plan){
                if (el.args[0] === ('a' + this.agent.agentID))
                    masterPlan.push(el)
                else
                    slavePlan.push(el)
            }

            masterPlan = this.wrapPlan(masterPlan)
            slavePlan = this.wrapPlan(slavePlan)

        }
        else if (masterCachedPlan === null){
            slavePlan = slaveCachedPlan
            plan = await this.requestPlan(problem.master)
            if (!plan) {
                //console.log('Plan not found for', problem.master.name)
                return null
            }
            masterPlan = this.wrapPlan(plan)
        }
        else{
            masterPlan = masterCachedPlan
            plan = await this.requestPlan(problem.slave)
            if (!plan) {
                //console.log('Plan not found for', problem.slave.name)
                return null
            }
            slavePlan = this.wrapPlan(plan)
        }

        return {master : masterPlan, slave: slavePlan}

    }
}
