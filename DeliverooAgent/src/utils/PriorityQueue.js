export class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    /**
     * Get the size of the queue.
     * @returns {number}
     */
    size() {
        return this.heap.length;
    }

    /**
     * Check if the queue is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this.size() === 0;
    }

    /**
     * Check if an item with the specified ID exists in the queue.
     * @param {number} id - The ID to search for.
     * @returns {boolean} True if the item exists, otherwise false.
     */
    has(id) {
        if (this.size() > 0)
            return this.heap.some(item => item.data.id === id);
        return false
    }

    /**
     * Updates the priority of an item based on its ID.
     * @param {number} id - The ID of the item.
     * @param {number} newPriority - The new priority to set.
     */
    updatePriority(id, newPriority) {
        const index = this.heap.findIndex(item => item.data.id === id);
        if (index === -1) return; // Element not found

        this.heap[index].priority = newPriority;
        this.siftDown(index);
        this.siftUp(index);
    }

    /**
     * View the top item without removing it.
     * @returns {Object}
     */
    peek() {
        return this.heap[0];
    }

    /**
     * Add an item to the queue with its utility.
     * @param {Object} data - The actual data object.
     * @param {number} priority - The utility or priority of the item.
     */
    push(data, priority = 0) {        
        const item = { 'data':data, 'priority':priority };
        this.heap.push(item);
        this.siftUp();
    }

    /**
     * Remove and return the top item from the queue.
     * @returns {Object}
     */
    pop() {
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > 0) this.swap(0, bottom);
        this.heap.pop();
        this.siftDown();
        return poppedValue.data;
    }

    /**
     * Remove an item from the queue based on its ID.
     * @param {number} id - The ID of the item.
     */
    removeById(id) {
        const index = this.heap.findIndex(item => item.data.id === id);
        if (index === -1) return; // Elemento non trovato

        const lastElement = this.heap.pop();

        if (index !== this.size()) { // Se l'elemento rimosso non era l'ultimo elemento
            this.heap[index] = lastElement;
            this.siftDown(index);
            this.siftUp(index);
        }
    }

    /**
     * Returns the item with the specified ID.
     * @param {number} id - The ID to search for.
     * @returns {Object|null} The item with the given ID, or null if not found.
     */
    getById(id) {
        let item = this.heap.find(entry => entry.data.id === id);
        return item ? item.data : null;
    }
    
    /**
     * Returns all items in the queue.
     * @returns {Array<Object>}
     */
    values() {
        return [...this.heap].map(item => item.data);
    }
    
    /**
     * Returns all items in the queue.
     * @returns {Array<Object>}
     */
    valuesWithPriority() {
        return [...this.heap].map(item => item);
    }

    // Helper methods:

    parent(i) {
        return Math.floor((i - 1) / 2);
    }

    left(i) {
        return 2 * i + 1;
    }

    right(i) {
        return 2 * i + 2;
    }

    hasHigherPriority(i, j) {
        return this.heap[i].priority > this.heap[j].priority;
    }

    swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    siftUp() {
        let node = this.size() - 1;
        while (node > 0 && this.hasHigherPriority(node, this.parent(node))) {
            this.swap(node, this.parent(node));
            node = this.parent(node);
        }
    }

    siftDown() {
        let node = 0;
        while (this.left(node) < this.size() && 
              (this.hasHigherPriority(this.left(node), node) || 
              (this.right(node) < this.size() && this.hasHigherPriority(this.right(node), this.left(node))))) {
            
            const highestPriorityChild = 
                (this.right(node) < this.size() && this.hasHigherPriority(this.right(node), this.left(node))) 
                ? this.right(node) 
                : this.left(node);
            
            this.swap(node, highestPriorityChild);
            node = highestPriorityChild;
        }
    }
}

