class Activity {
    #step;
    #tasks;
    
    constructor() {
        this.#step = false;
        this.#tasks = [];
    }

    executeAndRegister(task) {
        if (typeof task === "function") {
            task();
            this.#tasks.push(task);
        }
    }

    executeAll() {
        this.#tasks.forEach(task => task());
    }
}