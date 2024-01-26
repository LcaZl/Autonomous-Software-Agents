export class Intention {

    #parent; // Reference to the caller
    #current_plan; // Currently active plan for achieving the intention 
    #started = false;
    #stopped = false; // Flag to control the stopping of the intention

    /**
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

        for (const planClass of this.agent.planner.getPlanLibrary()) {
            if (this.stopped) break;

            if (planClass.isApplicableTo(this.option)) {
                this.#current_plan = new planClass(this.#parent, this.agent);

                try {

                    const plan_res = await this.#current_plan.execute(this.option);
                    return plan_res;

                } catch ( error ) {
                    this.stop()
                    throw [error,this.option.id]
                }
            }
        }

        throw ['No suitable plan found for ', this.option.toString()];
    }
}
