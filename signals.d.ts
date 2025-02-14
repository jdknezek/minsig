export declare function state<T>(value: T): [() => T, (value: T) => void];
export declare function computed<T>(getter: () => T): () => T;
export declare function tick(): void;
export declare function effect(action: () => void | (() => void)): () => void;
