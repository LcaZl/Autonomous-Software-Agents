import { PddlAction, PddlExecutor, onlineSolver } from "@unitn-asa/pddl-client";
import { Agent } from "../../agent.js";
import { Intention } from "./Intention.js";
import { Option } from "./Option.js";
import { Position } from "../../../utils/Position.js";
import BfsExecutor from "./BfsExecutor.js";
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
        this.index = null
        this.positions = []
        this.actions = []
        this.plan = null
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
    isPathFree(idx = -1) {
        const inViewPositions = idx === -1 ? this.positions : this.positions.slice(idx)
        const currentPositions = this.agent.players.getCurrentPositions();
        const limit = Math.min(this.agent.AGENTS_OBSERVATION_DISTANCE, inViewPositions.length);

        for (let index = 0; index < limit; index++) {
            const tile = inViewPositions[index];
            const isTileOccupied = currentPositions.some(pos => pos.isEqual(tile));

            if (isTileOccupied) {
                //this.agent.log('[ACTUAL PLAN] Future tile (', tile, ') occupied. Need to update Plan.');
                return false;
            }
        }
        return true;
    }

    setPddlPath() {

        this.positions = []
        this.actions = []

        for (let step of this.plan) {
            if (step.action === 'pickup')
                this.actions.push('pickup')
            else if (step.action === 'deliver')
                this.actions.push('deliver')
            else
            this.actions.push(step.action.split('_').at(1))
            this.positions.push(this.exractTilePositionFromPDDL(step.args[2]))
        }
    }

    setBfsPath() {
        this.positions = this.plan.path.positions
        this.actions = this.plan.path.actions
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
        if (this.agent.moveType === 'BFS')
            await this.subIntention( new Option('bfs_patrolling', option.startPosition, option.finalPosition, option.finalPosition, null, null))
        else if (this.agent.moveType === 'PDDL'){
            await this.subIntention( new Option('pddl_patrolling', option.startPosition, option.finalPosition, option.finalPosition, null, null))
        }

        return true
    }
}

export class BlindMove extends Plan {

    static isApplicableTo ( option ) {
        return option.id == 'go_to';
    }

    async execute ( option ) {
        const status_go = await this.agent.client.move( option.bfsSearch[0])
        if (!status_go) throw ['movement_fail']
        await this.agent.pickup()
        this.agent.fastPickMoves++
        return true
    }
}

export class BreadthFirstSearchMove extends Plan {

    static isApplicableTo ( option ) { 
        return option.id.startsWith('bfs_pickup-') || option.id == 'bfs_patrolling' || option.id == 'bfs_delivery'}

    async execute ( option ) {
        

        const updatePlan = () => {

            if (option.id == 'bfs_delivery'){
                this.plan = this.agent.environment.getNearestDeliveryTile(this.agent.currentPosition);
                if ( this.plan.length == 0 ) { throw ['target_not_reachable'] }
                this.setBfsPath()
            }
            else{
                let position = null
                if (option.id === 'bfs_patrolling')
                    position = this.agent.environment.getRandomPosition()
                else if (option.id.startsWith('bfs_pickup-'))
                    position = option.finalPosition

                this.plan = this.agent.environment.getShortestPath(this.agent.currentPosition, position);
                if ( this.plan.length == 0 ) { throw ['target_not_reachable'] }
                this.setBfsPath()
            }
        }        
        const movementHandle = async (direction, index) => {
            if ( this.stopped ) throw ['stopped']
            if (this.agent.players.playerInView){
                const freePath = this.isPathFree(index)
                if (!freePath){
                    this.agent.eventManager.emit('update_options')
                    throw ['path_not_free']
                }
            }

            const status = await this.agent.move(direction);
            if (!status)  throw ['movement_fail']
            if ( this.stopped ) throw ['stopped']
        }

        const bfsExecutor = new BfsExecutor(
            {name: 'right', executor:  (idx) => movementHandle('right', idx)},
            {name: 'left', executor: (idx) => movementHandle('left', idx)},
            {name: 'up', executor: (idx) => movementHandle('up', idx)},
            {name: 'down', executor: (idx) =>  movementHandle('down', idx)},
        );

        if (option.id !== 'bfs_patrolling' && 
        option.startPosition.isEqual(this.agent.currentPosition) && 
        option.bfsSearch.length != 0){
            
            this.plan = option.bfsSearch
            this.setBfsPath()
            this.agent.lookAheadHits++
            //console.log('hit for ', option.id)
        }
        else
            updatePlan()

        this.agent.client.socket.emit( "path", this.positions);
        await bfsExecutor.exec( this.actions ).catch((error) =>{
            throw error
        })
        
        if (option.id.startsWith('bfs_pickup-'))
            this.agent.pickup()
        if (option.id === 'bfs_delivery' )
            this.agent.deliver()
        return true
    }
}


export class PddlMove extends Plan {
    
    static isApplicableTo ( option ) {
        return option.id.startsWith('pddl_pickup-') || option.id === 'pddl_delivery' || option.id === 'pddl_patrolling';
    }

    async execute ( option ) {

        let problem = null

        const updatePlan = async () => {

            problem = this.agent.problemGenerator.getProblem('goto', option.finalPosition)
            this.plan = await this.agent.planner.getPlan( problem );
            if ( this.plan == null || this.plan.length == 0 ) throw ['target_not_reachable'];
            this.setPddlPath()
        }

        const movementHandle = async (direction) => {
            if ( this.stopped ) throw ['stopped']
            const freePath = this.isPathFree()
            if (!freePath) {
                this.agent.eventManager.emit('update_options')
                await updatePlan()
            }
            const status = await this.agent.move(direction);
            if (!status)  throw ['movement_fail']
            if ( this.stopped ) throw ['stopped']
        }

        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  () => movementHandle('right')},
            {name: 'move_left', executor: () => movementHandle('left')},
            {name: 'move_up', executor: () => movementHandle('up')},
            {name: 'move_down', executor: () =>  movementHandle('down')},
            {name: 'deliver', executor: () => this.agent.deliver()},
            {name: 'pickup', executor: () =>  this.agent.pickup()}
        );

        if (option.pddlPlan != null && option.startPosition.isEqual(this.agent.currentPosition)){
            this.plan = option.pddlPlan
            if ( this.plan == null || this.plan.length == 0 ) throw ['target_not_reachable'];
            this.setPddlPath()
            this.agent.lookAheadHits++
            //console.log('hit for ', option.id)
        }
        else
            await updatePlan()

        let pathError = null
        do{
            pathError = false
            this.agent.client.socket.emit( "path", this.positions);
            await pddlExecutor.exec( this.plan ).catch((error) =>{
                pathError = true
                if (error[0] !== 'path_not_free')
                    throw error
            })
        }
        while(pathError)
        return true
    }
}

export class PddlBatchMove extends Plan {
    
    static isApplicableTo ( option ) {
        return option.id.startsWith('pddl_batch-');
    }

    async execute ( option ) {

        let problem = null
        let target = null

        const updatePlan = async () => {

            ////console.log(option.targetOptions.length)
            let goals = option.parcels.length
            for (let i = 0; i < goals; i++){
                problem = this.agent.problemGenerator.goToMultipleOption(option.parcels)
                this.plan = await this.agent.planner.getPlan( problem );
                if ( this.plan != null && this.plan.length > 0 ) {
                    break;
                };
                option.parcels.pop()   
            }
            if ( this.plan == null || this.plan.length === 0 ) throw ['target_not_reachable']

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
        //console.log('Ora dovrei conseganre')
        await this.agent.deliver()
        return true;
    }
}
 */