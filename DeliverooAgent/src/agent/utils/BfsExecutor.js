
export class BfsExecutor {
    
    /**
     * 
     */
    constructor ( ...actions ) {
        this.addAction(...actions);
    }

    actions = {}

    addAction (...actions) {

        for ( let action of actions ) {
            this.actions[action.name.toLowerCase()] = action;
        }
    }
    getExecutor (name) {
        return this.actions[name].executor
    }

    /**
     * @param {PddlPlan} plan 
     */
    async exec (plan) {

        if ( ! plan )
            return;
        
        var previousStepGoals = []

        for (const [index, action] of plan.entries()) {

            await Promise.all(previousStepGoals)
            previousStepGoals = []

            const executor = this.getExecutor(action)
            if ( !executor ) {
                console.error( new Error("No executor for pddlAction" + action + ". Skip and continue with next plan step.") )
                continue;
            }

            const exec = executor(index)
            if ( exec && exec.catch ) {
                previousStepGoals.push( exec );
            }
            else {
                previousStepGoals.push( Promise.resolve() );
            }
        }

        await Promise.all(previousStepGoals)
    }

}

