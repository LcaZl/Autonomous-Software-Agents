
// Server address
export const host = "http://localhost:8080" // or https://deliveroojs.onrender.com"

// // ----------------------------------------------- Multi-agent parameters ----------------------------------------------------
export const multiagent = false // Enable the multiagent functionalities
export const teamSize = 0 // Size of the team

export const configurations = [

    {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU5YjYwMzBlNTM1IiwibmFtZSI6IkhhcnZlc3RfMSIsImlhdCI6MTcwNDk5Mjc4OX0.P151qhNBNFBW35wWTTDlWaKWKp2vXXUP0AnXw9vbHWE',
        username: 'Harvest_A',
        duration : 300, // (s) Duration of the agent, if not Infinity the value will be used by the agent.
        moveType : 'BFS', // BFS or PDDL.

        // Do a fast movement to an adiacent tile to take a parcel.
        fastPick : false, //  For both PDDL and BFS.

        // Percentage penality in new option utility, if the actual is stopped for the new one.
        changingRisk : 1, // current_option_utility < (new_option_utility * 0.8)

        // Time window to adjust the movemnt penality, used to calcul,ate the utility of each option.
        adjustMovementCostWindow : 5000 // (ms)
    },

    {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUzMjdmMmZlYTdmIiwibmFtZSI6IkhhcnZlc3RfQiIsImlhdCI6MTcwMjk5ODA2Mn0.6Ze1DVtCkLlj9n1uz9ugH7OovhvwUAc2lYUmlTkzJcY',
        username: 'Harvest_B',
        duration : 300, //s
        moveType : 'BFS',
        fastPick : false,
        changingRisk : 1, // [0,1]
        adjustMovementCostWindow : 5000 // (ms)
    },
    
    {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjMyN2YyZmVhN2ZjIiwibmFtZSI6IkhhcnZlc3RfQyIsImlhdCI6MTcwMjk5ODA3Nn0.dYnnyzFMhx66eSs3y9IsYG1eLBCMgoM2xHp_jyvKHTQ',
        username: 'Harvest_C',
        duration : 300, //s
        moveType : 'BFS',
        fastPick : false,
        changingRisk : 1, // [0,1]
        adjustMovementCostWindow : 5000 // (ms)
    }

]
