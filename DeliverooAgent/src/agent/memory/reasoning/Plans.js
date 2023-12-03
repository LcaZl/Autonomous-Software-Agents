import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";
import { Agent } from "../../agent.js";
import { Intention } from "./Intention.js";
import { Option } from "./Option.js";
import { Position } from "../../../utils/Position.js";
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
        //console.log('started getpddlposition s')
        for (let step of plan) {
            //console.log('step:', step)
            //console.log('1 - ',step.action.split('_').at(1) )
            //console.log('2 - ',this.exractTilePositionFromPDDL(step.args[2]))
            if (step.action === 'pickup')
                actions.push('pickup')
            else if (step.action === 'deliver')
                actions.push('deliver')
            else
                actions.push(step.action.split('_').at(1))
            positions.push(this.exractTilePositionFromPDDL(step.args[2]))
        }

        return [positions, actions]
    }

    exractTilePositionFromPDDL(str) {
        const regex = /(\d+)/g;
        let numbers = str.match(regex).map(Number)
        return new Position(numbers[0], numbers[1])
      }
}

export class Patrolling extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'patrolling';
    }

    async execute ( option ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        let pos = this.agent.environment.getRandomPosition()
        await this.subIntention( new Option('bfs_patrolling', pos, null, null, null))
        return true
    }
}

export class BlindMove extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_to';
    }

    async execute ( option ) {
        const status_go = await this.agent.client.move( option.firstSearch[0])
        if (!status_go) throw ['movement_fail']
        await this.agent.pickup()
        this.agent.fastPickMoves++
        return true
    }
}

export class DepthSearchMove extends Plan {

    static isApplicableTo ( option ) { 
        return option.id.startsWith('bfs_pickup-') || option.id == 'bfs_patrolling' }

    async execute ( option ) {
        
        let target = null
        let plan = null

        const updatePlanAndTarget = () => {
            plan = this.agent.environment.getShortestPath(this.agent.currentPosition, option.position);
            if ( !plan || plan.length == 0 ) throw ['target_not_reachable'];
            target = option.position;
        }        
        
        if (option.firstSearch != null && option.firstSearch.length != 0 && this.isPathFree(option.firstSearch.path.positions) && option.firstSearch.firstPosition.isEqual(this.agent.currentPosition)){
            plan = option.firstSearch
            target = option.position
            this.agent.lookAheadHits++
        }
        else
            updatePlanAndTarget()

        do{
            this.agent.client.socket.emit( "path", plan.path.positions);

            for (const [index, action] of plan.path.actions.entries()) {

                if ( this.stopped ) throw ['stopped']; // if stopped then quit
                const status = await this.agent.move(action);
                if (!status) {
                    throw ['movement_fail']
                }
                const freePath = this.isPathFree(plan.path.positions.slice(index))
                if (!freePath){
                    this.agent.eventManager.emit('update_option')
                    updatePlanAndTarget()
                    break;
                }
            }
            
        } while ( !this.agent.currentPosition.isEqual(target));

        return true;
    }
}

export class DepthSearcDeliveryhMove extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'bfs_delivery';
    }

    async execute ( option ) {

        let target = null
        let plan = null

        const updatePlanAndTarget = () => {

                plan = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition);

                if ( plan.length == 0 ) {
                    throw ['target_not_reachable'];
                }
                target = plan.path.positions[plan.path.positions.length - 1];
        }        

        if (option.firstSearch != null && option.length > 0){
            if (this.isPathFree(option.firstSearch.path.positions) && option.firstSearch.path.positions[0].isEqual(this.agent.currentPosition)){
                this.agent.lookAheadHits++
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
                const status = await this.agent.move(action);
                if (!status) {
                    throw ['movement_fail']
                }
                const freePath = this.isPathFree(plan.path.positions)
                if (!freePath){
                    this.agent.eventManager.emit('update_option')
                    updatePlanAndTarget()
                    break;
                }
            }
            
        } while ( !this.agent.currentPosition.isEqual(target));
        await this.agent.deliver()
        return true;

    }
}

export class PddlMove extends Plan {
    
    static isApplicableTo ( option ) {
        return option.id.startsWith('pddl_pickup-') || option.id === 'pddl_delivery';
    }

    async execute ( option ) {

        let problem = null
        let plan = null
        let positions = null
        let actions = null
        let target = null

        const updatePlan = async () => {
            problem = this.agent.problemGenerator.getProblem('goto', option.position)
            plan = await this.agent.planner.getPlan( problem );
            if ( plan == null || plan.length == 0 ) throw ['target_not_reachable'];

            [positions, actions] = this.getPddlPathPositions(plan)
            target = option.position
        }

        const movementHandle = async (direction) => {

                if ( this.stopped ) throw ['stopped']
                const status = await this.agent.move(direction);
                if (!status)  throw ['movement_fail']
                const freePath = this.isPathFree(positions)
                if (!freePath) {
                    this.agent.eventManager.emit('update_options')
                    await updatePlan()
                }
        }

        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  () => movementHandle('right')},
            {name: 'move_left', executor: () => movementHandle('left')},
            {name: 'move_up', executor: () => movementHandle('up')},
            {name: 'move_down', executor: () =>  movementHandle('down')},
            {name: 'deliver', executor: () => this.agent.deliver()},
            {name: 'pickup', executor: () =>  this.agent.pickup()}
        );

        /*
        if (option.firstSearch != null){
            console.log('in', option.firstSearch)
            let posact = this.getPddlPathPositions(option.firstSearch)
            console.log(posact)
            if (this.isPathFree(posact[0]) && posact[0][0].isEqual(this.agent.currentPosition)){
                plan = option.pddlPlan
                console.log('luckypddlhit')
            }
            else
                await updatePlan()
        }
        else*/
        await updatePlan()
        do{
            this.agent.client.socket.emit( "path", positions);
            if ( this.stopped ) throw ['stopped']

            await pddlExecutor.exec( plan ).catch((error) =>{
                console.log('finito il piano', this.agent.currentPosition, target)

                if (error[0] !== 'path_not_free')
                    throw error
            })
            console.log('finito il piano', this.agent.currentPosition, target)

        }while(!this.agent.currentPosition.isEqual(target))
        if (option.id === 'pddl_delivery')
            await this.agent.deliver()
        return true
    }
}

export class PddlBatchMove extends Plan {
    
    static isApplicableTo ( option ) {
        return option.id.startsWith('pddl_batch-');
    }

    async execute ( option ) {

        let problem = null
        let plan = null
        let positions = null
        let actions = null
        let target = null

        const updatePlan = async () => {

            //console.log(option.targetOptions.length)
            let goals = option.parcels.length
            for (let i = 0; i < goals; i++){
                problem = this.agent.problemGenerator.goToMultipleOption(option.parcels)
                plan = await this.agent.planner.getPlan( problem );
                if ( plan != null && plan.length > 0 ) {
                    break;
                };
                option.parcels.pop()   
            }
            if ( plan == null || plan.length === 0 ) throw ['target_not_reachable']

            let res = this.getPddlPathPositions(plan)
            positions = res[0]
            actions = res[1]
            target = positions[positions.length - 1];
        }

        const movementHandle = async (direction) => {

                if ( this.stopped ) throw ['stopped']
                const status = await this.agent.move(direction);
                if (!status)  throw ['movement_fail']
                const freePath = this.isPathFree(positions)
                if (!freePath) {
                    this.agent.eventManager.emit('update_options')
                    await updatePlan()
                }
        }

        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  () => movementHandle('right')},
            {name: 'move_left', executor: () => movementHandle('left')},
            {name: 'move_up', executor: () => movementHandle('up')},
            {name: 'move_down', executor: () =>  movementHandle('down')},
            {name: 'deliver', executor: () => this.agent.deliver()},
            {name: 'pickup', executor: () =>  this.agent.pickup()}
        );

        if (option.pddlPlan != null && option.positions[0].isEqual(this.agent.currentPosition))
            plan = option.pddlPlan
        else
            await updatePlan()
        do{
            this.agent.client.socket.emit( "path", positions);
            if ( this.stopped ) throw ['stopped']

            await pddlExecutor.exec( plan ).catch((error) =>{
                if (error[0] !== 'path_not_free')
                    throw error
            })

        }while(!this.agent.currentPosition.isEqual(target))
        return true
    }
}




/**
 * 
 * 
 * This function wrap the chosen method between BFS and PDDL. 
 * By setting the first parameter of Option object is possible to define if the
 * will use the bfs or the pddl to get the paths. 
 * 
 
export class GoPickUp extends Plan {

    static isApplicableTo ( option ) {
        return option.id.startsWith('go_pick_up-');
    }
    async execute ( option ) {
        if ( this.stopped ) throw ['stopped'];
        if (this.agent.moveType === 'PDDL')
            await this.subIntention( new Option('pddl_move',  option.position, option.utility, option.firstSearch, option.parcel)) // -- HERE
        else // BFS
            await this.subIntention( new Option('go_to_bfs', option.position, option.utility, option.firstSearch, option.parcel)) // -- HERE
        await this.agent.pickup()
        return true
    }
}

export class GoDeliver extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'bfs_delivery' || option.id == 'pddl_delivery';
    }
    async execute ( option ) {
        if ( this.stopped ) throw ['stopped'];
        if (this.agent.moveType === 'PDDL')
            await this.subIntention(new Option('pddl_move', option.position, option.utility, option.firstSearch, null));
        else
            await this.subIntention(new Option('go_to_bfs_delivery', null, option.utility, option.firstSearch, null));
        console.log('Ora dovrei conseganre')
        await this.agent.deliver()
        return true;
    }
}
 */