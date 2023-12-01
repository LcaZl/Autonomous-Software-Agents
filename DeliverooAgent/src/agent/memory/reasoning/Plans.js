import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";
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
            this.agent.log( ...args )
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
            const isTileOccupied = currentPositions.some(pos => pos.isEqual(tile));

            if (isTileOccupied) {
                this.agent.log('[ACTUAL PLAN] Future tile (', tile, ') occupied. Need to update Plan.');
                return false;
            }
        }
        return true;
    }

    getPddlPathPositions(plan) {

        let positions = []
        let actions = []

        for (let step of plan) {
            actions.push(step.action.split('_').at(0))
            positions.push(this.exractTilePositionFromPDDL(step.args[1]))
        }
        positions.push(this.exractTilePositionFromPDDL(plan[plan.length - 1].args[2]))

        return positions
    }

    exractTilePositionFromPDDL(str) {
        const regex = /(\d+)/g;
        let numbers = str.match(regex).map(Number)
        return {'x': numbers[0], 'y':numbers[1]}
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
        if (this.agent.move_type == 'PDDL')
            await this.subIntention( new Option('go_to_pddl',  option.position, option.utility, option. firstSearch, option.parcel)) // -- HERE
        else // BFS
            await this.subIntention( new Option('go_to_bfs', option.position, option.utility, option. firstSearch, option.parcel)) // -- HERE
        await this.agent.pickup()
        return true
    }
}

export class GoDeliver extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_deliver';
    }

    async execute ( option ) {

        await this.subIntention(new Option('go_to_bfs', 'delivery', option.utility, null, option.parcel));
        await this.agent.deliver()
        return true;

    }

}
export class Patrolling extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'patrolling';
    }

    async execute ( option ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        let pos = this.agent.environment.getRandomPosition()
        if (this.agent.move_type == 'PDDL')
            await this.subIntention( new Option('go_to_pddl',  pos, null, null, null)) // -- HERE
        else // BFS
            await this.subIntention( new Option('go_to_bfs', pos, null, null, null)) // -- HERE
        return true
    }
}

export class DepthSearchMove extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_to_bfs';
    }

    async execute ( option ) {
        
        let target = null
        let plan = null
        let failures = 0

        const updatePlanAndTarget = () => {

            if (option.position == 'delivery') {

                plan = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition);
                if ( !plan || plan.length == 0 ) throw ['target not reachable'];
                target = plan.path.positions[plan.path.positions.length - 1];

            } else {

                plan = this.agent.environment.getShortestPath(this.agent.currentPosition, option.position);
                if ( !plan || plan.length == 0 ) throw ['target not reachable'];
                target = option.position;
            }

        }        
        
        if (option.firstSearch != null && option.length > 0){
            if (this.isPathFree(option.firstSearch.path.positions) && option.firstSearch.path.positions[0].isEqual(this.agent.currentPosition)){
                plan = option.firstSearch
                target = option.position}
            else
                updatePlanAndTarget()
        }
        else
            updatePlanAndTarget()


        do{
            this.agent.client.socket.emit( "path", plan.path.positions);

            for (const [index, action] of plan.path.actions.entries()) {

                if ( this.stopped ) throw ['stopped']; // if stopped then quit

                const status = await this.agent.move(action)

                if (!status) {
                    updatePlanAndTarget()
                    break;
                }   
                
                const freePath = this.isPathFree(plan.path.positions.slice(index))  

                if (!freePath){
                    updatePlanAndTarget()
                    break;
                }
            }
            
        } while ( !this.agent.currentPosition.isEqual(target));

        return true;

    }
}

export class PddlMove extends Plan {
    
    static isApplicableTo ( option ) {
        return option.id == 'go_to_pddl';
    }

    async execute ( option ) {

        let problem = null
        let plan = null
        let positions = null
        let target = null
        
        const updatePlan = async () => {
            problem = this.problemGenerator.getProblem('goto', option.position)
            plan = await this.agent.planner.getPlan( problem );
            if ( plan == null || plan.length == 0 ) throw 'Plan failed - Target not reachable';

            positions = this.getPddlPathPositions(plan)
            target = positions[positions.length - 1];
        }

        const movementHandle = async (direction) => {

                if ( this.stopped ) throw ['stopped']
                const status = await this.agent.move(direction);
                if (!status) throw ['movement_fail']
                const freePath = this.isPathFree(positions);
                if (!freePath) throw ['path_not_free']
        }

        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  () => movementHandle('right')},
            {name: 'move_left', executor: () => movementHandle('left')},
            {name: 'move_up', executor: () => movementHandle('up')},
            {name: 'move_down', executor: () =>  movementHandle('down')},
            {name: 'deliver', executor: () => this.agent.deliver()},
            {name: 'pickup', executor: () =>  this.agent.pickup()}
        );

        await updatePlan()
        do{

            this.agent.client.socket.emit( "path", positions);

            try{
                await pddlExecutor.exec( plan )
            }
            catch(error){

                this.agent.log('catched error',error)
                if (error[0] == 'movement_fail')
                    await updatePlan()
                if (error[0] == ['path_not_free'])
                    await updatePlan()
                else throw error
            }
            if ( this.stopped ) throw ['stopped']

        }while(!this.agent.currentPosition.isEqual(target))
        return true
    }
}
