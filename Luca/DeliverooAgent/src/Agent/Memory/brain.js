import { Planner } from "./Reasoning/planner.js"
import { Beliefs } from "./Reasoning/beliefs.js"
import { Options } from "./Reasoning/options.js"
import fs from 'fs';


/**
 * Represents the brain of an agent.
 * @class Brain
 * @param {Agent} agent - The agent that owns this brain.
 */
export class Brain{ 

    /**
     * Constructs a new instance of the Brain class.
     * @param {Agent} agent - The agent associated with this brain.
     * @returns None
     */
    constructor(agent){ 
        this.agent = agent
        this.environment = this.agent.getEnvironment()
        this.beliefs = new Beliefs(this.agent)
        this.options = new Options()
        
        console.log('[INIT][BRN ] Brain Instantiated.')
    }

    /**
     * Initializes the planner by creating a new instance of the Planner class.
     * This function is used only during deliverooAgent initialization.
     * 
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating
     * whether the initialization was successful or not.
     */
    async initPlanner() {
        this.planner = new Planner(this.beliefs)
        this.domain = await this.readFile('src/Agent/Memory/domain.pddl')
        let success = await this.planner.init()
        return success
    }

    /**
     * Updates the specified type of information in the agent's beliefs.
     * 
     * @param {string} type - The type of information to update.
     *    - 'all_belief': Updates the entire belief set.
     *    - 'belief_player': Updates information about other players.
     *    - 'belief_parcels': Updates information about parcels.
     *    - 'plan': Does not update any information for now.
     *    - 'options': Does not update any information for now.
     * @returns None
     */
    update(type){
        switch (type) {
            case 'all_beliefs':
                this.beliefs.updateBeliefSet(this.agent)
                break;
            case 'belief_player':
                this.beliefs.updatePlayers(this.agent)
                break;
            case 'belief_parcels':
                this.beliefs.updateParcels(this.agent)
                break;
            case 'plan':
                break;
            case 'options':
                break;
        }
    }
    
    generateProblem() {
        var pddlProblem = new pddlProblem(
            'bestParcel',
            this.beliefs.objects.join(' '),
            this.beliefs.toPddlString(),
            'and (switched-on light1) (not (switched-on light2))'
        )
    }

        /**
     * Reads a file and returns its content.
     * @param {string} path - The path to the file.
     * @returns {Promise<string>} A promise that resolves to the content of the file.
    */
    readFile ( path ) {
    
        return new Promise( (res, rej) => {

            fs.readFile( path, 'utf8', (err, data) => {
                if (err) rej(err)
                else res(data)
            })

        })
    }
}