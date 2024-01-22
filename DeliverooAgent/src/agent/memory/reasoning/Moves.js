import { PddlExecutor } from "@unitn-asa/pddl-client";
import { Agent } from "../../agent.js";
import { Intention } from "./intentions/Intention.js";
import { BfsExecutor } from "../../utils/BfsExecutor.js";
import { BfsOption, PddlOption } from "./options/Option.js";
export class Move {

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
    isPathFree(idx) {
        const remainingPositions = idx === -1 ? this.positions : this.positions.slice(idx)
        const currentPositions = this.agent.players.getCurrentPositions();
        //const limit = Math.min(this.agent.AGENTS_OBSERVATION_DISTANCE, inViewPositions.length);

        for (let index = 0; index < remainingPositions.length; index++) {
            const tile = remainingPositions[index];
            const isTileOccupied = currentPositions.some(pos => pos.isEqual(tile));

            if (isTileOccupied) {
                return false;
            }
        }
        return true;
    }
}

export class Patrolling extends Move {

    static isApplicableTo ( option ) {
        return option.id == 'patrolling';
    }

    async execute ( option ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        let patrolling = null 
        if (this.agent.moveType === 'BFS')
            patrolling = new BfsOption('bfs_patrolling', null, this.agent)
        else if (this.agent.moveType === 'PDDL')
            patrolling = new PddlOption('pddl_patrolling', null, this.agent)
        
        await this.subIntention( patrolling )

        return true
    }
}

export class BreadthFirstSearchMove extends Move {

    static isApplicableTo ( option ) { 
        return option.id.startsWith('bfs_pickup-') || option.id == 'bfs_patrolling' || option.id == 'bfs_delivery'}

    async execute ( option ) {
        

        const updatePlan = () => {

            option.update(this.agent.currentPosition)
            this.plan = option.search
            if ( this.plan.length == 0 ) { throw ['target_not_reachable'] }
            this.positions = option.search.path.positions
            this.actions = option.search.path.actions
        }        

        const movementHandle = async (direction, index) => {
            if ( this.stopped ) throw ['stopped']

            if (this.agent.players.playerInView){
                const freePath = this.isPathFree(index)
                if (!freePath){
                    this.agent.eventManager.emit('update_options')
                    updatePlan()
                    throw ['path_not_free']
                }
            }
            await this.agent.actualTileCheck(this.positions[index])

            const status = await this.agent.move(direction);
            if (!status)  throw ['movement_fail']
        }

        const bfsExecutor = new BfsExecutor(
            {name: 'right', executor:  (idx) => movementHandle('right', idx)},
            {name: 'left', executor: (idx) => movementHandle('left', idx)},
            {name: 'up', executor: (idx) => movementHandle('up', idx)},
            {name: 'down', executor: (idx) =>  movementHandle('down', idx)},
        );

        if (
        option.startPosition.isEqual(this.agent.currentPosition) && 
        option.search.length != 0){
        
            this.positions = option.search.path.positions
            this.actions = option.search.path.actions
        }
        else
            updatePlan()

        let pathError = false
        do{
            if ( this.stopped ) throw ['stopped']
            pathError = false
            this.agent.client.socket.emit( "path", this.positions);
            await bfsExecutor.exec( this.actions ).catch((error) =>{
                if (error[0] !== 'path_not_free')
                    throw error
                else
                    pathError = true
            })
        }
        while(pathError)

        if (option.id.startsWith('bfs_pickup-'))
            await this.agent.pickup()
        if (option.id === 'bfs_delivery' )
            await this.agent.deliver()
        return true
    }
}


export class PddlMove extends Move {
    
    static isApplicableTo ( option ) {
        return option.id.startsWith('pddl_pickup-') || option.id.startsWith('pddl_delivery') || option.id === 'pddl_patrolling';
    }

    async execute ( option ) {

        const updatePlan = async () => {

            await option.update(this.agent.currentPosition)
            if ( option.plan === null || option.plan.length === 0 ) throw ['target_not_reachable'];
            this.plan = option.plan.steps
            this.positions = option.plan.positions
        }

        const movementHandle = async (direction, index) => {
            if ( this.stopped ) throw ['stopped']

            const freePath = this.isPathFree(index)
            if (!freePath) {
                //this.agent.eventManager.emit('update_players_beliefs')
                this.agent.eventManager.emit('update_options')
                await updatePlan()
                throw ['path_not_free']
            }
            await this.agent.actualTileCheck(this.positions[index])
            const status = await this.agent.move(direction);
            if (!status)  throw ['movement_fail']

        }

        const pddlExecutor = new PddlExecutor(
            {name: 'move_right', executor:  (idx) => movementHandle('right', idx)},
            {name: 'move_left', executor: (idx) => movementHandle('left', idx)},
            {name: 'move_up', executor: (idx) => movementHandle('up', idx)},
            {name: 'move_down', executor: (idx) =>  movementHandle('down', idx)},
            {name: 'deliver', executor: (idx) => this.agent.deliver()},
            {name: 'pickup', executor: (idx) =>  this.agent.pickup()}
        );
        console.log(option.plan)
        if (option.plan !== null && option.startPosition.isEqual(this.agent.currentPosition)){
            this.plan = option.plan.steps
            this.positions = option.plan.positions
            this.agent.lookAheadHits++
        }
        else 
            await updatePlan()


        let pathError = false
        do{
            pathError = false
            this.agent.client.socket.emit( "path", this.positions);

            await pddlExecutor.exec( this.plan ).catch(async (error) =>{
                if (error[0] !== 'path_not_free')
                    throw error
                else
                    pathError = true
            })

        }
        while(pathError)

        return true
    }
}