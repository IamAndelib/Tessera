export class BiMap<K, V> {
    private forward = new Map<K, V>();
    private backward = new Map<V, K>();

    inverse = {
        get: (value: V): K | undefined => this.backward.get(value),
        has: (value: V): boolean => this.backward.has(value),
        delete: (value: V): void => {
            const key = this.backward.get(value);
            if (key !== undefined) {
                this.forward.delete(key);
                this.backward.delete(value);
            }
        },
    };

    set(key: K, value: V): void {
        const existingValue = this.forward.get(key);
        if (existingValue !== undefined) this.backward.delete(existingValue);
        const existingKey = this.backward.get(value);
        if (existingKey !== undefined) this.forward.delete(existingKey);
        this.forward.set(key, value);
        this.backward.set(value, key);
    }

    get(key: K): V | undefined {
        return this.forward.get(key);
    }

    has(key: K): boolean {
        return this.forward.has(key);
    }

    delete(key: K): void {
        const value = this.forward.get(key);
        if (value !== undefined) {
            this.backward.delete(value);
            this.forward.delete(key);
        }
    }

    clear(): void {
        this.forward.clear();
        this.backward.clear();
    }

    keys(): IterableIterator<K> {
        return this.forward.keys();
    }
}
