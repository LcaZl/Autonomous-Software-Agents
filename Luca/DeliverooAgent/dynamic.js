import { onlineSolver, PddlExecutor, PddlProblem } from "@unitn-asa/pddl-client";
import fs from 'fs';

function readFile ( path ) {
    
    return new Promise( (res, rej) => {

        fs.readFile( path, 'utf8', (err, data) => {
            if (err) rej(err)
            else res(data)
        })

    })

}

async function main () {
    
    let pddlProblem = await readFile('./problem.pddl' );
    
    //let problem = pddlProblem.toPddlString();
    console.log( pddlProblem );

    let domain = await readFile('./domain.pddl' );

    var plan = await onlineSolver( domain, pddlProblem );
    
    const pddlExecutor = new PddlExecutor( { name: 'action', executor: (l) => console.log('action '+l) } );
    pddlExecutor.exec( plan );

}

main();