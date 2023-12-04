

export class Option {
    /**
     * Constructs a new instance of the Option class.
     * 
     * @param {string} id - The identifier of the option.
     * @param {Position} position - The position associated with this option.
     * @param {number} utility - The utility value of the option.
     * @param {boolean} search - Contains information of the first search.
     * @param {Parcel} parcel - The parcel associated with this option, if any.
     */
    constructor(id, startPosition, finalPosition, utility, bfsSearch, parcel) {

        this.id = id
        this.startPosition = startPosition
        this.finalPosition = finalPosition
        this.utility = utility;
        this.bfsSearch = bfsSearch
        this.parcel = parcel
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, S_POS: ${this.startPosition}, F_POS: ${this.finalPosition}, Parcel_id: ${this.parcel ? this.parcel.id : ''}, Search: ${this.search ? this.search.firstPosition : ''}]`;
    }
}


export class BatchOption{

    constructor(id, utility, parcels, agent){
        this.id = id
        this.utility = utility
        this.agent = agent
        this.parcels = parcels
        this.positions = []
        this.parcelIds = new Set()
        this.parcels.forEach(p => {
            this.parcelIds.add(p.id)
            this.positions.push(p.position)
        })
        this.position = this.positions[this.positions.length - 1]
        this.pddlPlan = null
        console.log('Target parcel ids:', this.parcelIds)
        console.log(this.toString(), '\n')
    }

    toString() {
        let str = `BatchOption - ID: ${this.id}, Utility: ${this.utility}, Target parcels:`;
        this.parcels.forEach((parcel, index) => {
            str += `\n   Parcel ${index + 1}: ${parcel.toString()}`;
        });
        return str;
    }
}

/**
 * 
 *     async init(){
        let targetPositions = []
        let targetParcels = []
        for (let opt of this.options){
            console.log(' - ', opt.data.toString())
            targetPositions.push(opt.data.position)
            targetParcels.push(opt.data.id == 'go_deliver' ? 'delivery' : opt.data.parcel)
        }

        console.log(' - positions:', targetPositions)
        console.log(' - parcels:', targetParcels.toString())
        let problem = this.agent.problemGenerator.goToMultipleOption(targetParcels)
        console.log(problem)
        let plan = await this.agent.planner.getPlan( problem )
        console.log(plan)
    }

 */