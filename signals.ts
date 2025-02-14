interface Source {
	subscribe (sink: Sink): void,
	unsubscribe (sink: Sink): void,
}

interface Sink {
	subscribeTo (source: Source): void,
	invalidate (): void,
}

let runningSink: Sink | undefined;

class State<T> implements Source {
	value: T;
	sinks = new Set<Sink>();

	constructor(value: T) {
		this.value = value;
	}

	get () {
		runningSink?.subscribeTo(this);
		return this.value;
	}

	set (value: T) {
		this.value = value;
		for (const sink of this.sinks) {
			sink.invalidate();
		}
	}

	subscribe (sink: Sink) {
		this.sinks.add(sink);
	}

	unsubscribe (sink: Sink) {
		this.sinks.delete(sink);
	}
}

export function state<T> (value: T): [() => T, (value: T) => void] {
	const s = new State(value);
	return [() => s.get(), (value) => s.set(value)];
}

class Computed<T> implements Source, Sink {
	getter: () => T;
	dirty = true;
	value?: T;
	sources = new Set<Source>();
	sinks = new Set<Sink>();

	constructor(getter: () => T) {
		this.getter = getter;
	}

	get (): T {
		if (runningSink === this) throw new Error('computed depends on itself');
		runningSink?.subscribeTo(this);
		if (this.dirty) this.update();
		return this.value!;
	}

	invalidate () {
		this.dirty = true;
		this.value = undefined;
		for (const source of this.sources) {
			source.unsubscribe(this);
		}
		this.sources.clear();
		for (const sink of this.sinks) {
			sink.invalidate();
		}
	}

	update () {
		const previousSink = runningSink;
		runningSink = this;
		try {
			this.value = this.getter();
			this.dirty = false;
		} finally {
			runningSink = previousSink;
		}
	}

	subscribe (sink: Sink) {
		this.sinks.add(sink);
	}

	unsubscribe (sink: Sink) {
		this.sinks.delete(sink);
	}

	subscribeTo (source: Source) {
		source.subscribe(this);
		this.sources.add(source);
	}
}

export function computed<T> (getter: () => T) {
	const c = new Computed(getter);
	return () => c.get();
}

const pendingEffects = new Set<Effect>();

export function tick () {
	for (const effect of pendingEffects) {
		effect.run();
	}
	pendingEffects.clear();
}

class Effect implements Sink {
	action: () => void | (() => void);
	cleanup?: () => void;
	sources = new Set<Source>();

	constructor(action: () => void | (() => void)) {
		this.action = action;
		this.invalidate();
	}

	subscribeTo (source: Source) {
		source.subscribe(this);
		this.sources.add(source);
	}

	invalidate () {
		pendingEffects.add(this);
		if (pendingEffects.size === 1) queueMicrotask(tick);
	}

	run () {
		this.cleanup?.();
		const previousSink = runningSink;
		runningSink = this;
		try {
			const cleanup = this.action();
			if (typeof cleanup === 'function') this.cleanup = cleanup;
		} finally {
			runningSink = previousSink;
		}
	}

	dispose () {
		for (const source of this.sources) {
			source.unsubscribe(this);
		}
		this.sources.clear();
	}
}

export function effect (action: () => void | (() => void)) {
	const e = new Effect(action);
	return () => e.dispose();
}
