
export class Intention {

    #parent; // parent refers to caller
    #current_plan; // Plan currently used for achieving the intention 
    #started = false;
    #stopped = false; // This is used to stop the intention

    constructor ( parent, option, agent ) {
        this.#parent = parent;
        this.option = option;
        this.agent = agent
    }

    get stopped () { return this.#stopped; }

    stop () {
        // this.log( 'stop intention', ...this.option );
        this.#stopped = true;
        if ( this.#current_plan)
            this.#current_plan.stop();
    }
    log ( ...args ) {
        if ( this.#parent && this.#parent.log )
            this.#parent.log(...args )
        else
            console.log( ...args )
    }

    /**
     * Using the plan library to achieve an intention
     */
    async achieve () {

        // Cannot start twice
        if ( this.#started)
            return this;
        else
            this.#started = true;

        console.log('[INTENTION', this.option.id, '] Started - ', this.#started)

        // Trying all plans in the library
        for (const planClass of this.agent.planner.getPlanLibrary()) {

            if ( this.stopped ) // if stopped then quit
                break;

            // if plan is 'statically' applicable
            if ( planClass.isApplicableTo( this.option ) ) {

                this.#current_plan = new planClass(this.#parent, this.agent); // plan is instantiated

                try {

                    const plan_res = await this.#current_plan.execute( this.option );

                    this.log( '[INTENTION', this.option.id, '] Success with plan', planClass.name, 'with result:', plan_res );
                    return plan_res
                    
                } catch (error) { // errors are caught so to continue with next plan
                    this.log( '[INTENTION', this.option.id, '] Failed with plan', planClass.name, ' - Error:', error );
                    if ( this.stopped )
                        break;
                }
            }
        }

        // if stopped then quit
        if ( this.stopped ) throw [ `[INTENTION ${this.option.id} ] Stopped.')` ];

        // no plans have been found to satisfy the intention
        throw [ `[INTENTION ${this.option.id} ] No plan found.')` ]
    }

}