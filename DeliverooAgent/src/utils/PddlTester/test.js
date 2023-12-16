
import { PddlProblem } from '@unitn-asa/pddl-client';
import fs from 'fs'
import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";

class PDDL_tester{

    constructor(){
        this.domain = null
        this.problem = null
    }

    async loadDomain() {
        try{
            this.domain = await this.readFile('./domain.pddl')
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
        }
        return this.domain
    }

    async loadProblem() {
        try{
            this.problem = await this.readFile('./problem.pddl')
        }
        catch(exception){
            console.error("[INIT] Planner ininitalization error.\n", exception)
        }
        return this.problem
    }
    async getPlan(){
        let plan = null
        try{
            plan = await onlineSolver( this.domain, this.problem );
        }
        catch (error){
            console.log(error)
            return error
        }
        return plan
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

const tester = new PDDL_tester()
const domain = await tester.loadDomain()
const problem = await tester.loadProblem()
console.log('PROBLEM:\n', problem)
console.log('domain:\n', domain)

const plan = await tester.getPlan()
console.log('plan:\n', plan)

let a = [1,2,3]
let b = [1,2,3]
console.log(a == b)
let equal = true
for (const el of a){
    if (!b.has(el)){
        equal = false
        break;
    }
}
console.log(equal)
