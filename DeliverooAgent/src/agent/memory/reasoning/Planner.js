import { PddlProblem } from '@unitn-asa/pddl-client';
import { Agent } from '../../agent.js';
import { BlindMove, DepthSearcDeliveryhMove, DepthSearchMove, Patrolling, PddlBatchMove, PddlMove } from './Plans.js';
import fs from 'fs'
import { onlineSolver } from "@unitn-asa/pddl-client";

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
        this.library.push( DepthSearchMove )
        this.library.push( DepthSearcDeliveryhMove)
        this.library.push( Patrolling )
        this.library.push( PddlMove )
        this.library.push( BlindMove )
        this.library.push( PddlBatchMove )
        this.memory = new Map()

        this.agent.log('[INIT] Planner Initialized.')
    }

    getPlanLibrary(){ return this.library }

    /**
     * 
     * @param {PddlProblem} pddlProblem 
     * @returns 
     */
    async getPlan(problem){
        let plan = null
        //this.agent.log('[PLANNER] Requested plan for problem:', problem.name, '(Memory hit ', this.memory.has(problem.name),')')
        if (!this.memory.has(problem.name)){
            try{
                plan = await onlineSolver( this.domain, problem.toPddlString() );
            }
            catch (error){
                this.agent.log(problem, this.domain)
                this.agent.log(error)
                return null
            }
            this.memory.set(problem.name, plan)
        }
        else{
            plan = this.memory.get(problem.name)
        }
        return plan
    }

    getDomain(){ return this.domain }

    async loadDomain() {
        try{
            this.domain = await this.readFile('agent/memory/pddl/domain.pddl')
            this.agent.log('[INIT] Planner Domain loaded')//,this.domain)
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
        }
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