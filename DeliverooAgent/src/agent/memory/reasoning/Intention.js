export class Intention {

    #parent; // Reference to the caller
    #current_plan; // Currently active plan for achieving the intention 
    #started = false;
    #stopped = false; // Flag to control the stopping of the intention

    /**
     * Constructs a new instance of the Intention class.
     * 
     * @param {Object} parent - The parent object that created this intention.
     * @param {Object} option - The option associated with this intention.
     * @param {Agent} agent - The agent executing this intention.
     */
    constructor(parent, option, agent) {
        this.#parent = parent;
        this.option = option;
        this.agent = agent;
    }

    get stopped() { return this.#stopped; }
    get nextPosition() { return this.#current_plan.nextPosition}
    /**
     * Stops the execution of the current plan and sets the intention as stopped.
     */
    stop() {
        this.#stopped = true;
        if (this.#current_plan) {
            this.#current_plan.stop();

        }
    }

    /**
     * Logs messages using either the parent's log method or the agent's log method.
     * 
     * @param {...any} args - The arguments to log.
     */
    log(...args) {
        if (this.#parent && this.#parent.log) {
            this.#parent.log(...args);
        } else {
            //this.agent.log(...args);
        }
    }

    /**
     * Attempts to achieve the intention by executing applicable plans.
     * 
     * @returns {Promise<any>} The result of executing the plan.
     * @throws {Error} Throws an error if no plan is found or if there is an error within a plan.
     */
    async achieve() {
        if (this.#started) {
            return this;
        }
        this.#started = true;
        //this.agent.log('[INTENTION', this.option.id, '] Started - ', this.#started);

        for (const planClass of this.agent.planner.getPlanLibrary()) {
            if (this.stopped) break;

            if (planClass.isApplicableTo(this.option)) {
                this.#current_plan = new planClass(this.#parent, this.agent);

                try {

                    const plan_res = await this.#current_plan.execute(this.option);
                    //console.log('[INTENTION', this.option.id, '] Plan', planClass.name, plan_res, 'terminated.');
                    return plan_res;

                } catch ( error ) {

                    //console.log('[INTENTION', this.option.id, '] Plan', planClass.name, 'Failed - Status:', error[0]);

                    switch(error[0]){
                        case 'target_not_reachable':
                            this.stop()
                            throw ['target_not_reachable',this.option.toString()];
                        case 'path_not_free':
                            this.stop()
                            throw ['path_not_free',this.option.toString()];
                        case 'stopped':
                            throw ['stopped',this.option.toString()]
                        case 'movement_fail':
                            this.stop()
                            throw ['movement_fail',this.option.toString()];
                        case 'alignment_fail':
                            this.stop()
                            throw ['alignment_fail',this.option.toString()]
                        case 'last_checkpoint_error':
                            throw ['last_checkpoint_error']
                        default:
                            throw error
                    }
                }
            }
        }

        throw ['No suitable plan found for ', this.option.toString()];
    }
}
