import { readFile } from '../../../utils/utils.js';
import { Agent } from '../../agent.js';
import { DepthSearchMove, GoDeliver, GoPickUp, Patrolling, PddlBatchMove, PddlMove } from './Plans.js';

/**
 * Classe used to manage the selection of the next action of the agent
 */
export class Planner {

    /**
     * @param {Brain} brain - The brain
     * @param {Agent} agent
    */
   
    constructor(agent) {

        this.library = []
        this.library.push( GoPickUp )
        this.library.push( GoDeliver )
        this.library.push( DepthSearchMove )
        this.library.push( Patrolling )
        this.library.push( PddlMove)
        this.library.push( PddlBatchMove)


        console.log('[INIT] Planner Initialized.')
    }

    getPlanLibrary(){ return this.library }

    getDomain(){ return this.domain }

    async loadDomain() {
        try{
            this.domain = await readFile('agent/memory/pddl/domain.pddl')
            console.log('[INIT] Planner Domain loaded')//,this.domain)
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
        }
    }
}