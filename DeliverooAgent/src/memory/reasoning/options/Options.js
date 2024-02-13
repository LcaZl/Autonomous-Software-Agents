import { BfsOption, PddlOption } from "./Option.js"
import { ProblemGenerator } from "../planning/ProblemGenerator.js"
import { UtilityCalculator } from "../UtilityCalculator.js" // Assuming the file name is UtilityCalculator.js

/**
 * Manages and updates the options available to an agent based on the agent's state and environment.
 * This includes responding to changes in the environment, parcels picked up or delivered and agents movement.
 */
export class Options {
    /**
     * Initializes the Options manager.
     * 
     * @param {Agent} agent - The agent for which options are being managed.
     */
    constructor(agent) {
        this.agent = agent
        this.problemGenerator = new ProblemGenerator(agent) // Initializes problem generator for PDDL-based planning
        this.utilityCalculator = new UtilityCalculator(agent) // Initializes utility calculator for evaluating options
        this.pddlNearEnd = false // Flag to indicate whether PDDL planning should consider end conditions

        console.log('[INIT] Options initialized.')
    }

    /**
     * Sets up listeners for various events that could affect the agent's options, triggering updates as necessary.
     */
    activate() {
        // Defines a notification function to update options based on the agent's strategy
        const notification = () => {
            switch (this.agent.moveType) {
                case 'BFS': // If the agent uses BFS for movement
                    this.updateOptionsForBfs()
                    break
                case 'PDDL': // If the agent uses PDDL and planning for movement
                    this.updateOptionsForPddl()
                    break
            }
        }

        // Set up event listeners to trigger options update on relevant events
        this.agent.eventManager.on('update_options', notification)
        this.agent.eventManager.on('picked_up_parcels', notification)
        this.agent.eventManager.on('delivered_parcels', notification)
        this.agent.eventManager.on('movement', notification)
    }

    /**
     * Updates the options for an agent using BFS (Breadth-First Search) based on the current state of the agent and environment.
     * It evaluates delivery options if the agent is carrying parcels and generates pickup options for accessible and free parcels.
     */
    updateOptionsForBfs() {
        const currentOption = this.agent.intentions.currentIntention.option

        // Evaluate a delivery option if carrying parcels and not already in a delivery intention
        if ((this.agent.parcels.carriedParcels() > 0 && currentOption.id !== 'bfs_delivery') 
            || currentOption.id.startsWith('bfs_pickup')) {
            const parcel = this.agent.parcels.getOneOfMyParcels() ?? currentOption.parcel
            const option = new BfsOption('bfs_delivery', parcel, this.agent)
            // Push the delivery option if it has positive utility
            if (option.utility > 0) {
                this.agent.intentions.push([option])
            }
        }

        let options = []

        // Generate pickup options
        this.agent.parcels.getParcels().forEach(parcel => {
            const id = `bfs_pickup-${parcel.id}`
            if (parcel.isFree() && parcel.isAccessible() && currentOption.id !== id) {
                const option = new BfsOption(id, parcel, this.agent)
                // Add the option if it has positive utility
                if (option.utility > 0) {
                    options.push(option)
                }
            }
        })

        // Sort options by utility and push them to the agent's intentions if there are any
        if (options.length > 0) {
            options.sort((opt1, opt2) => opt2.utility - opt1.utility)
            this.agent.intentions.push(options)
        }
    }


    /**
     * Asynchronously updates the options for an agent using PDDL strategy
     * based on the current state of the agent and environment.
     * It considers delivery options if carrying parcels and generates pickup options for accessible and free parcels.
     */
    async updateOptionsForPddl() {
        let options = []
        const currentOption = this.agent.intentions.currentIntention ? this.agent.intentions.currentIntention.option : null

        // Evaluate a delivery option if carrying parcels and not on a delivery tile or already in a delivery intention
        if (this.agent.parcels.carriedParcels() > 0 && (!currentOption || currentOption.id !== 'pddl_delivery') 
            && !this.agent.environment.onDeliveryTile()) {
            const parcel = this.agent.parcels.getOneOfMyParcels()
            const deliveryOption = new PddlOption('pddl_delivery', parcel, this.agent)
            // Add the delivery option if it has positive utility
            if (deliveryOption.utility > 0) {
                options.push(deliveryOption)
            }
        }

        // Generate pickup options
        const parcelsToTake = this.agent.parcels.getFreeParcels()
        parcelsToTake.forEach(parcel => {
            if (!currentOption || currentOption.id !== `pddl_pickup-${parcel.id}`) {
                const option = new PddlOption(`pddl_pickup-${parcel.id}`, parcel, this.agent)
                // Add the option if it has positive utility
                if (option.utility > 0) {
                    options.push(option)
                }
            }
        })

        // Sort options by utility and push them to the agent's intentions if there are any
        if (options.length > 0) {
            options.sort((opt1, opt2) => opt2.utility - opt1.utility)
            this.agent.intentions.push(options)
        }
    }

}