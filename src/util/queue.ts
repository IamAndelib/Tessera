export class Queue<T> {
    private items: T[] = [];
    private offset = 0;

    get size(): number {
        return this.items.length - this.offset;
    }

    enqueue(item: T): void {
        this.items.push(item);
    }

    dequeue(): T | undefined {
        if (this.size === 0) return undefined;
        const item = this.items[this.offset];
        if (++this.offset * 2 >= this.items.length) {
            this.items = this.items.slice(this.offset);
            this.offset = 0;
        }
        return item;
    }
}
