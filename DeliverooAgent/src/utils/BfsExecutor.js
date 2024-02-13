/**
 * A class responsible for executing actions based on a Breadth-First Search (BFS) plan or a similar sequential plan.
 */
export class BfsExecutor {
    /**
     * Initializes a new instance of the BfsExecutor class with a set of actions.
     * 
     * @param {...Object} actions - An array of action objects, each containing a name and an executor function.
     */
    constructor(...actions) {
        this.actions = {} // Initialize an empty object to store action executors keyed by action name.
        this.addAction(...actions) // Add the provided actions to the executor.
    }

    /**
     * Adds one or more actions to the executor.
     * 
     * @param {...Object} actions - Actions to be added, each with a 'name' and 'executor' property.
     */
    addAction(...actions) {
        for (let action of actions) {
            // Add each action's executor function to the 'actions' object, keyed by the action's name.
            this.actions[action.name.toLowerCase()] = action.executor
        }
    }

    /**
     * Retrieves the executor function for a given action name.
     * 
     * @param {string} name - The name of the action whose executor is to be retrieved.
     * @returns {Function} The executor function associated with the specified action name.
     */
    getExecutor(name) {
        return this.actions[name.toLowerCase()]
    }

    /**
     * Executes a sequence of actions based on the provided plan.
     * 
     * @param {Array} plan - An array of action names representing the plan to be executed.
     */
    async exec(plan) {
        if (!plan) return // If no plan is provided, exit the function.

        let previousStepGoals = [] // An array to hold promises for the asynchronous execution of actions.

        // Iterate through each action in the plan.
        for (const [index, action] of plan.entries()) {
            await Promise.all(previousStepGoals) // Ensure all actions from the previous step are completed.
            previousStepGoals = [] // Reset the array for the current step's actions.

            const executor = this.getExecutor(action) // Retrieve the executor function for the current action.
            if (!executor) {
                // If no executor is found for an action, log an error and skip to the next action.
                console.error(new Error("No executor for action '" + action + "'. Skipping and continuing with the next plan step."))
                continue
            }

            const exec = executor(index) // Execute the action using its executor function, passing the action's index.
            if (exec && exec.catch) {
                // If the executor returns a promise (i.e., an asynchronous action), add it to the array for tracking.
                previousStepGoals.push(exec)
            } else {
                // For synchronous actions, add a resolved promise to the array for consistency.
                previousStepGoals.push(Promise.resolve())
            }
        }

        await Promise.all(previousStepGoals) // Ensure all actions in the final step are completed before exiting the function.
    }
}
