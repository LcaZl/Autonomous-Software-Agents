
// Server address
export const host = "http://localhost:8080" // or https://deliveroojs.onrender.com"

// // ----------------------------------------------- Multi-agent parameters ----------------------------------------------------
export const multiagent = false // Enable the multiagent functionalities
export const multiagentConfiguration = {
    teamSize : 2,
    teamStrategy : 'BFS',
    teamName : 'Harvester',
    teamNames : new Set(['Harvest_A', 'Harvest_B'])
}

export const singleAgentConfigurations = [

    {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjdlZDhiNWYyMzJkIiwibmFtZSI6IkhhcnZlc3RfQSIsImlhdCI6MTcwNjYwMTI0OH0.8I1JFAaS5-ITyULY4IwW0VRczdhV62uScN7PdJL10Ds',
        username: 'Harvest_A',
        duration : 300, // (s) Duration of the agent, if not Infinity the value will be used by the agent.
        moveType : 'BFS', // BFS or PDDL.

        // Do a fast movement to an adiacent tile to take a parcel.
        fastPick : true, //  For both PDDL and BFS.

        // Percentage penality in new option utility, if the actual is stopped for the new one.
        changingRisk : 0.5, // current_option_utility < (new_option_utility * 0.8)

        // Time window to adjust the movemnt penality, used to calcul,ate the utility of each option.
        adjustMovementCostWindow : 1000, // (ms)
        disappearedPlayerValidity : 500, // (ms)
        playerCheckInterval : 1000 // (ms)
    },

    {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUzMjdmMmZlYTdmIiwibmFtZSI6IkhhcnZlc3RfQiIsImlhdCI6MTcwMjk5ODA2Mn0.6Ze1DVtCkLlj9n1uz9ugH7OovhvwUAc2lYUmlTkzJcY',
        username: 'Harvest_B',
        duration : 300, //s
        moveType : 'PDDL',
        fastPick : true,
        changingRisk : 0, // [0,1]
        adjustMovementCostWindow : 1000, // (ms)
        disappearedPlayerValidity : 500, // (ms)
        playerCheckInterval : 1000 // (ms)
    }

]
