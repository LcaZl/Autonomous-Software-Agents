/**
 * @typedef { { parallel: boolean, action: string, args: string [] } } PddlPlanStep
 */

/**
 * @typedef { PddlPlanStep [] } PddlPlan
 */

export default class PddlExecutor {
    
    /**
     * 
     * @param { ...{pddlAction} } } actions 
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

    getAction (name) {
        return this.actions[name]
    }

    /**
     * @param {PddlPlan} plan 
     */
    async exec (plan) {

        if ( ! plan )
            return;
        
        var previousStepGoals = []

        for (const [index, step] of plan.entries()) {
            if (step.parallel) {
                console.log( 'Starting concurrent step', step.action, ...step.args )
            }
            else {
                await Promise.all(previousStepGoals)
                previousStepGoals = []
                //console.log( 'Starting sequential step', step.action, ...step.args )
            }

            let action = this.getAction(step.action)
            if ( !action || !action.executor ) {
                console.error( new Error("No executor for pddlAction" + step.action + ". Skip and continue with next plan step.") )
                continue;
            }

            var exec = action.executor(index)
            if ( exec && exec.catch ) {
                previousStepGoals.push( exec );
            }
            else {
                previousStepGoals.push( Promise.resolve() );
            }
        }

        // wait for last steps to complete before finish blackbox plan execution intention
        await Promise.all(previousStepGoals)
    }

}