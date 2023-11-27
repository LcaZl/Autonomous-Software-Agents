export class Option{

    constructor(id, position = null, utility = 0, search = null){

        this.id = id
        this.utility = utility
        this.position = position
        this.firstSearch = search
        this.side_options = []
    }

    setSideOptions(opts){
        this.side_options = opts
    }

    getSideOptions(){
        return this.side_options
    }

    toString() {
        return `[ID: ${this.id}, Utility: ${this.utility}, Position: ${this.position}]`
    }
}