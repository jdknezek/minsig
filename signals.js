                  
                              
                                
 

                
                                    
                     
 

let runningSink                  ;

class State                      {
	value   ;
	sinks = new Set      ();

	constructor(value   ) {
		this.value = value;
	}

	get () {
		runningSink?.subscribeTo(this);
		return this.value;
	}

	set (value   ) {
		this.value = value;
		for (const sink of this.sinks) {
			sink.invalidate();
		}
	}

	subscribe (sink      ) {
		this.sinks.add(sink);
	}

	unsubscribe (sink      ) {
		this.sinks.delete(sink);
	}
}

export function state    (value   )                                {
	const s = new State(value);
	return [() => s.get(), (value) => s.set(value)];
}

class Computed                            {
	getter         ;
	dirty = true;
	value    ;
	sources = new Set        ();
	sinks = new Set      ();

	constructor(getter         ) {
		this.getter = getter;
	}

	get ()    {
		if (runningSink === this) throw new Error('computed depends on itself');
		runningSink?.subscribeTo(this);
		if (this.dirty) this.update();
		return this.value ;
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

	subscribe (sink      ) {
		this.sinks.add(sink);
	}

	unsubscribe (sink      ) {
		this.sinks.delete(sink);
	}

	subscribeTo (source        ) {
		source.subscribe(this);
		this.sources.add(source);
	}
}

export function computed    (getter         ) {
	const c = new Computed(getter);
	return () => c.get();
}

const pendingEffects = new Set        ();

export function tick () {
	for (const effect of pendingEffects) {
		effect.run();
	}
	pendingEffects.clear();
}

class Effect                 {
	action                           ;
	cleanup             ;
	sources = new Set        ();

	constructor(action                           ) {
		this.action = action;
		this.invalidate();
	}

	subscribeTo (source        ) {
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
			if (cleanup) this.cleanup = cleanup;
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

export function effect (action                           ) {
	const e = new Effect(action);
	return () => e.dispose();
}
