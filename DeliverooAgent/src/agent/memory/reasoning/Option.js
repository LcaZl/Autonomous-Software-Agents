export class Option{

    constructor(id, position = null, utility = 0, search = null){

        this.id = id
        this.utility = utility
        this.position = position
        this.firstSearch = search
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, Position: ${this.position}]`
    }
}