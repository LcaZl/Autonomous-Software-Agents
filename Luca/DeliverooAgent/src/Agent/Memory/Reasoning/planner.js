import { onlineSolver, PddlExecutor } from "@unitn-asa/pddl-client";

/**
 * The Planner class handles the domain-specific planning logic for the agent.
 */
export class Planner {

    /**
     * Constructs a new instance of the Planner class.
    */
    constructor() {
        console.log('[INIT][PLNR] Planner Instantiated correctly.')
    }

    /**
     * Initializes the planner by loading the domain and problem definitions.
     * @returns {Promise<boolean>} A promise that resolves to true if the initialization was successful and false otherwise.
    */
    async init() {
        let success = false
        try{
            //this.domain = await this.readFile('./PDDL/domain.pddl')
            //this.problem = await this.readFile('./PDDL/problem.pddl');
            console.log('[INIT][PLNR] Domain loaded')//,this.domain)
            //var plan = await onlineSolver(this.domain, this.problem);
            //console.log( plan );
            success = true
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
            success = false
        }
        return success
    }
    
    /**
     * Generates a plan using the domain and problem definitions.
     * @returns {Promise<void>} A promise that resolves when the plan has been generated and executed.
    */
    async plan(){
        var plan = await onlineSolver(this.domain, this.problem);
        console.log( plan );

        const pddlExecutor = new PddlExecutor( 
            { name: 'move-up', executor: (l)=>console.log('Move up '+l) },
            { name: 'move-down', executor: (l)=>console.log('Move down '+l) },
            { name: 'move-left', executor: (l)=>console.log('Move left '+l) },
            { name: 'move-right', executor: (l)=>console.log('Move right '+l) }
        
        );
        pddlExecutor.exec( plan );
    }


}