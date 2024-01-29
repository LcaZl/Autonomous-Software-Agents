import { UtilityCalcolator } from "../../memory/reasoning/UtilityCalcolator.js";
import { PriorityQueue } from "./priorityQueue.js"

let sendPlanToAgentsTimer = 0

export class sharedIntentionQueue {
    constructor(agent) {
        this.agent = agent;
        this.playerQueues = new Map();
        this.utilityCalculator = new UtilityCalcolator(this.agent)
    }

    computeComparedUtility(option, playerId) {
        let maxUtility = option.Utility;
        let maxUtilityPlayerId = playerId; // Initialize with the current playerId
    
        // Assuming sharedBeliefSet is accessible and stores positions of players
        for (let agentId of this.playerQueues.keys()) {
            if (agentId === playerId) continue; // Skip the current player
    
            // Retrieve agent's current position from shared belief set
            let agentPosition = this.agent.communication.getAgentPosition(playerId);
                        
            // Create a copy of the option with the agent's current position
            let optionCopy = { ...option, startPosition: agentPosition };
    
            // Compute utility for the option copy
            let utility;
            if (optionCopy.ID.startsWith('bfs_pickup')) {
                // use a refined version of pickUpUtility 

                // utility = this.utilityCalculator.pickUpUtility(optionCopy.Parcel_id, agentPosition);
                // fix this with actual or estimated reward
                let parcelReward = optionCopy.utility 
                utility = this.utilityCalculator.simplifiedPickUpUtilityMas(optionCopy.Parcel_id, parcelReward, optionCopy.S_POS, optionCopy.F_POS)

            } else if (option.ID === 'bfs_delivery') {
                utility = - Infinity;/* Utility calculation for delivery */;
            } else {
                utility = - Infinity; /* Default utility */;
            }
    
            // Compare and update max utility and corresponding player ID
            if (utility > maxUtility) {
                maxUtility = utility;
                maxUtilityPlayerId = agentId;
            }
        }
    
        return maxUtilityPlayerId;
    }
    
    addOrUpdateOption(playerId, option) {
        if (!this.playerQueues.has(playerId)) {
            this.playerQueues.set(playerId, new PriorityQueue());
        }
        playerId = this.computeComparedUtility(option, playerId)
        const queue = this.playerQueues.get(playerId) || [];
        queue.update(option);

        if (sendPlanToAgentsTimer % 20 === 0) {
            // for each agent, take the option with the greatest utility, compute plan
            this.playerQueues.forEach((queue, agentId) => {
                if (queue.length > 0) {
                    // Get the option with the highest utility
                    const bestOption = queue.peek();
                    
                    // Use the best option to formulate a plan
                    this.createPlanForAgent(agentId, bestOption);
                }
            });
        }
    }
    // Add or update an option for a player based on the option ID
    addOrUpdateOptionOld(playerId, option) {
        
        if(sendPlanToAgentsTimer % 20 === 0){
            // for each agent take the option with greatest utility, compute plan 
            
        }

        //playerId = this.computeComparedUtility(option, playerId)
        let queue = this.playerQueues.get(playerId) || [];

        // Check if the option with the same ID already exists and update it
        const existingOptionIndex = queue.findIndex(opt => opt.ID === option.ID);
        if (existingOptionIndex > -1) {
            queue[existingOptionIndex] = option; // Update the entire option object
        } else {
            // Insert the new option in a sorted position based on its utility
            const insertIndex = queue.findIndex(opt => option.Utility > opt.Utility);
            if (insertIndex > -1) {
                queue.splice(insertIndex, 0, option);
            } else {
                queue.push(option); // If it has the lowest utility or the queue is empty
            }
        }

        // Update the map
        this.playerQueues.set(playerId, queue);
        sendPlanToAgentsTimer += 1
    }

    // Delete an option for a player based on the option ID
    deleteOptionOld(playerId, optionID) {
        let queue = this.playerQueues.get(playerId);
        if (!queue) return; // Player does not exist or has no options

        const indexToRemove = queue.findIndex(opt => opt.ID === optionID);
        if (indexToRemove > -1) {
            queue.splice(indexToRemove, 1); // Remove the option by ID
            this.playerQueues.set(playerId, queue); // Update the queue in the map
        }
    }

    deleteOption(playerId, optionID) {
        const queue = this.playerQueues.get(playerId);
        if (queue) {
            queue.remove(optionID);
        }
    }

    // Get the intention queue of a player
    getQueueOld(playerId) {
        return this.playerQueues.get(playerId) || [];
    }

    getQueue(playerId) {
        const queue = this.playerQueues.get(playerId);
        return queue ? queue.heap : [];
    }
    

    convertToJSON(str) {
        // Remove the leading and trailing brackets
        const trimmedStr = str.slice(1, -1);
    
        // Initialize an empty object
        let obj = {};
    
        // Split the string by comma, except those inside the square brackets
        let parts = trimmedStr.split(/, (?![^\[]*\])/);
    
        parts.forEach(part => {
            // Split each part into key and value
            let [key, value] = part.split(/: (.+)/);
    
            key = key.trim();
    
            // Check for numeric values and convert
            if (!isNaN(value) && value.trim() !== '') {
                value = parseFloat(value);
            } else if (value === 'undefined') { // Check for 'undefined' string and convert to undefined type
                value = undefined;
            } else if (value.startsWith('[X')) { // Special handling for S_POS and F_POS
                const coords = value.match(/\[X:(\d+), Y:(\d+)\]/);
                if (coords) {
                    value = { X: parseInt(coords[1], 10), Y: parseInt(coords[2], 10) };
                }
            } else if (value.startsWith(' ')) { // Trim leading spaces in values
                value = value.trim();
            }
    
            // Assign the value to the corresponding key in our object
            obj[key] = value;
        });

        //this.printShit(obj)
        
        return obj;
    }


    printShit(obj){
        console.log("-----------------------")
        console.log(" [SOME INFO ABOUT SIQ] ")
        console.log("-----------------------")
        console.log("[SHARED-QUEUES SIZE] : " + this.playerQueues.size + "\n")
        const keys = [...this.playerQueues.keys()];
        console.log("[AGENTS TRACKED] : ");
        console.log("Agent 1: " + keys[0])
        console.log("Agent 2: " + keys[1])
        console.log("\n[ADDING OPTION] :")
        console.log(obj)
    }

    // is the bestOption still valid? should we select more than one? 
    async createPlanForAgent(agentId, bestOption){
        try {
        let wrappedPlan = null
        if (bestOption.ID.startsWith('bfs_pickup')) {
            wrappedPlan = await this.agent.planner.getPickupPlanMas(bestOption.S_POS, bestOption.Parcel_id, bestOption.F_POS)
        } else if (bestOption.ID === 'bfs_delivery'){
            wrappedPlan = await this.agent.planner.getDeliveryPlan(bestOption.S_POS, bestOption.Parcel_id)
        }
        console.log("[MASTER GOT A NEW PLAN]")
        console.log(wrappedPlan)
        this.communication.assignPlan(agentId, wrappedPlan)
        } catch(error) {
            console.error("ERROR CREATE PLAN FOR AGENT : ", error)
        }
    }
}