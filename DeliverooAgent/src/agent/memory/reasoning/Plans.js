import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";
import { distance, objectsAreEqual } from "../../../utils/utils.js";
import { Agent } from "../../agent.js";
import { Intention } from "./Intention.js";
import { Option } from "./Option.js";
import { ProblemGenerator } from "./ProblemGenerator.js";
export class Plan {

    // This is used to stop the plan
    #parent; //parent refers to caller
    #stopped = false;
    #sub_intentions = []; // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.

    /**
     * 
     * @param {*} parent 
     * @param {Agent} agent 
     */
    constructor ( parent, agent) {
        this.#parent = parent;
        this.agent = agent
        this.problemGenerator = new ProblemGenerator(agent)
    }
    
    get stopped () { return this.#stopped; }

    stop () {
        this.log( '[ACTUAL PLAN] Stopped.' );
        this.#stopped = true;

        for ( const i of this.#sub_intentions ) {
            i.stop();
        }
    }
    
    log ( ...args ) {
        if ( this.#parent && this.#parent.log )
            this.#parent.log(...args )
        else
            console.log( ...args )
    }

    async subIntention ( option ) {
        const sub_intention = new Intention( this, option, this.agent );
        this.#sub_intentions.push( sub_intention );
        return sub_intention.achieve();
    }

    /**
     * Check if the tiles of the path are free from other players.
     * 
     * @returns - true if the path is free, else otherwise.
     */
    isPathFree(positions) {
        const currentPositions = this.agent.players.getCurrentPositions();
    
        const limit = Math.min(this.agent.AGENTS_OBSERVATION_DISTANCE, positions.length);

        for (let index = 0; index < limit; index++) {
            const tile = positions[index];
            const isTileOccupied = currentPositions.some(pos => objectsAreEqual(tile, pos));

            if (isTileOccupied) {
                console.log('[ACTUAL PLAN] Future tile (', tile, ') occupied. Need to update Plan.');
                return false;
            }
        }
        return true;
    }

}

/**
 * This function wrap the chosen method between BFS and PDDL. 
 * By setting the first parameter of Option object is possible to define if the
 * will use the bfs or the pddl to get the paths. 
 * 
 */
export class GoPickUp extends Plan {

    static isApplicableTo ( option ) {
        return option.id.startsWith('go_pick_up-');
    }

    async execute ( option ) {
        if ( this.stopped ) throw ['stopped'];
        if (MOVE_TYPE == 'PDDL')
            await this.subIntention( new Option('go_to_pddl', option.position, null)) // -- HERE
        else // BFS
            await this.subIntention( new Option('go_to_bfs', option.position, null)) // -- HERE
        if ( this.stopped ) throw ['stopped']; 
        await this.agent.pickup()
        if ( this.stopped ) throw ['stopped']; 
        return true;
    }
}

export class GoDeliver extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_deliver';
    }

    async execute ( option ) {

        await this.subIntention(new Option('go_to_bfs', 'delivery', null));
        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        await this.agent.deliver()
        if ( this.stopped ) throw ['stopped']; // if stopped then quit

        return true;

    }

}

export class Patrolling extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'patrolling';
    }

    async execute ( option ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        const moves = 500
        for (let i = 0; i < moves; i++){
            let dir = this.agent.environment.getAvailableDirections()
            await this.agent.move(dir)
            if ( this.stopped ) throw ['stopped, not error']; // if stopped then quit
        }
        return true;
    }
}

export class DepthSearchMove extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_to_bfs';
    }

    async execute ( option ) {
        
        let target = null
        let plan = null
        const updatePlanAndTarget = () => {

            if (option.position == 'delivery') {

                plan = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition);
                target = plan.path.positions[plan.path.positions.length - 1];

            } else {

                plan = this.agent.environment.getShortestPath(this.agent.currentPosition, option.position);
                target = option.position;
            }
        }        
        
        if (!option.search || !this.isPathFree(option.search.path.positions))
            updatePlanAndTarget()
        else{
            plan = option.search
            target = option.position
        }

        do{

            if ( !plan || plan.path.actions.length == 0 ) throw 'target not reachable';
            else
                this.agent.client.socket.emit( "path", plan.path.positions);
    
            for (const [index, action] of plan.path.actions.entries()) {

                if ( this.stopped ) throw ['stopped']; // if stopped then quit

                const status = await this.agent.move(action)
                const freePath = this.isPathFree(plan.path.positions.slice(index))  

                if (!(status && freePath)){
                    updatePlanAndTarget()
                }

            }
            
        } while ( !objectsAreEqual(this.agent.currentPosition, target));

        return true;

    }
}

export class PddlMove extends Plan {

    exractTilePositionFromPDDL(str) {
        const regex = /(\d+)/g;
        let numbers = str.match(regex).map(Number)
        return {'x': numbers[0], 'y':numbers[1]}
      }

    pathInfo(plan) {

        let positions = []
        let actions = []

        for (let step of plan) {
            actions.push(step.action.split('_').at(0))
            positions.push(this.exractTilePositionFromPDDL(step.args[1]))
        }
        positions.push(this.exractTilePositionFromPDDL(plan[plan.length - 1].args[2]))

        return positions
    }

    static isApplicableTo ( option ) {
        return option.id == 'go_to_pddl';
    }

    async execute ( option ) {

        //console.log( pddlProblem );
        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  (l) => this.agent.move('right')},
            {name: 'move_left', executor: (l) => this.agent.move('left')},
            {name: 'move_up', executor: (l) => this.agent.move('up')},
            {name: 'move_down', executor: (l) =>  this.agent.move('down')},
            {name: 'deliver', executor: (l) => this.agent.deliver()},
            {name: 'pickup', executor: (l) =>  this.agent.pickup()}
        );

        let pddlProblem = null
        let plan = null
        let target = null
        let positions = null

        const updatePlan = async () => {
            if (option.position == 'delivery'){
                plan = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition);
                target = plan.position
            }
            else
                target = option.position

            pddlProblem = this.problemGenerator.getProblem('goto', target)
            //console.log(pddlProblem, this.agent.planner.domain)
            plan = await onlineSolver( this.agent.planner.domain, pddlProblem );
            positions = this.pathInfo(plan)
        }

        await updatePlan()
        if ( !plan || plan.length == 0 ) throw 'target not reachable';

        //console.log(positions,plan)
        this.agent.client.socket.emit( "path", positions);

        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        await pddlExecutor.exec( plan );
        //await updatePlan()
        console.log('COMPLETEDPDDL')
    

    }
}