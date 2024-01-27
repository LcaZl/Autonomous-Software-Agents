export class PriorityQueue {
    constructor(comparator = (a, b) => a.Utility > b.Utility) {
        this.heap = [];
        this.comparator = comparator;
    }

    get length() {
        return this.heap.length;
    }

    enqueue(item) {
        this.heap.push(item);
        this.heap.sort(this.comparator);
    }

    dequeue() {
        return this.heap.shift();
    }

    peek() {
        return this.heap[0] || null;
    }

    update(item) {
        const index = this.heap.findIndex(i => i.ID === item.ID);
        if (index > -1) {
            this.heap[index] = item;
            this.heap.sort(this.comparator);
        } else {
            this.enqueue(item);
        }
    }

    remove(itemID) {
        this.heap = this.heap.filter(i => i.ID !== itemID);
    }
}
