import { onlineSolver, PddlExecutor } from "@unitn-asa/pddl-client";
import fs from 'fs';

export class Planner {
    constructor() {
        console.log('[INIT] Planner Instantiated correctly.')
    }

    async init(){
        try{
            this.domain = await this.readFile('./PDDL/domain.pddl')
            this.problem = await this.readFile('./PDDL/problem.pddl');
            console.log('[INIT] Domain loaded: \n',this.domain)
            return true
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
            return false        
        }
    }
    
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

    readFile ( path ) {
        
        return new Promise( (res, rej) => {

            fs.readFile( path, 'utf8', (err, data) => {
                if (err) rej(err)
                else res(data)
            })

        })
    }
}