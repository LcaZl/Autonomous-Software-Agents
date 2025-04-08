/**
 * Represents an intention, managing the selection and execution of plans to achieve the intention.
 */
export class Intention {
    #parent // Private field for the parent object, the agent or a higher-level intention.
    #currentPlan // The currently active plan being executed to achieve this intention.
    #started = false // Flag indicating whether the intention's execution has started.
    #stopped = false // Flag indicating whether the intention has been stopped.

    /**
     * Constructs an Intention instance associated with a specific agent and option.
     * 
     * @param {Object} parent - The parent context of this intention, providing scope and possibly shared state.
     * @param {Object} option - The option that this intention is meant to fulfill, containing relevant details or parameters.
     * @param {Agent} agent - The agent that is executing this intention, providing access to capabilities and state.
     */
    constructor(parent, option, agent) {
        this.#parent = parent
        this.option = option // Public field for the option associated with this intention.
        this.agent = agent // The agent responsible for executing this intention.
    }

    // Getter for the stopped state, allowing external checks without modifying the state.
    get stopped() { 
        return this.#stopped 
    }

    // Getter for the next position, derived from the current plan if available.
    get nextPosition() { 
        return this.#currentPlan ? this.#currentPlan.nextPosition : undefined
    }

    /**
     * Stops the execution of the current plan, marking the intention as stopped. It will also stop the plan's execution if a plan is active.
     */
    stop() {
        this.#stopped = true
        if (this.#currentPlan) {
            this.#currentPlan.stop() // Delegate the stop to the current plan.
        }
    }

    /**
     * Initiates the process to achieve the intention by selecting and executing an applicable movement.
     * It iterates through available moves to find one applicable to the current option.
     * Moves loaded in Planner.
     * 
     * @returns {Promise<any>} A promise resolving with the result of the executed plan.
     * @throws {Error} Throws an error if no applicable plan is found or if an error occurs during plan execution.
     */
    async achieve() {
        if (this.#started) { // Prevent re-entry if the intention is already in progress.
            return this
        }
        this.#started = true

        // Iterate through the plan library to find an applicable plan.
        for (const movementClass of this.agent.planner.getPlanLibrary()) {
            if (this.#stopped) throw ['Early stop for ' + this.option.id]

            if (movementClass.isApplicableTo(this.option)) { // Check plan applicability.
                this.#currentPlan = new movementClass(this.#parent, this.agent) // Instantiate the applicable plan.

                try {
                    const planRes = await this.#currentPlan.execute(this.option) // Execute the plan.
                    return planRes // Return the result of the plan execution.
                } catch (error) {
                    this.stop() // Stop the intention on error.
                    throw [error, this.option.id] // Include the option ID with the thrown error for context.
                }
            }
        }

        throw new Error('No suitable plan found for ' + this.option.id) //id Throw if no applicable plan is found.
    }
}
