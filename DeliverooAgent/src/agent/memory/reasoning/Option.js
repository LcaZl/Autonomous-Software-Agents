export class Option{

    constructor(id, position = null, utility = 0, search = null, parcel = null){

        this.id = id
        this.utility = utility
        this.position = position
        this.firstSearch = search
        this.batch = false
        this.parcel = parcel
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, Position: ${this.position}, Parcel_id: ${this.parcel ? this.parcel.id : null}]`
    }
}