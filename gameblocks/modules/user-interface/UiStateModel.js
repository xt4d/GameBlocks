function cloneState(state) {
  return { ...state };
}

export class UiStateModel {
  constructor(
    initialState = {},
    emitInitial = false,
    equality = Object.is
  ) {
    this.state = cloneState(initialState);
    this.emitInitial = emitInitial;
    this.equality = equality;
    this.listeners = new Set();
  }

  getState() {
    return cloneState(this.state);
  }

  subscribe(listener, emitInitial = this.emitInitial) {
    if (typeof listener !== 'function') {
      throw new Error('UiStateModel.subscribe: listener must be a function');
    }

    this.listeners.add(listener);
    if (emitInitial) {
      listener(this.getState(), Object.keys(this.state));
    }

    return () => this.listeners.delete(listener);
  }

  patch(partialState = {}) {
    const nextState = cloneState(this.state);
    const changedKeys = [];

    for (const [key, value] of Object.entries(partialState)) {
      if (this.equality(this.state[key], value)) continue;
      nextState[key] = value;
      changedKeys.push(key);
    }

    if (changedKeys.length === 0) return [];

    this.state = nextState;
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot, changedKeys);
    }

    return changedKeys;
  }

  replace(nextState = {}) {
    const keys = new Set([
      ...Object.keys(this.state),
      ...Object.keys(nextState),
    ]);
    const changedKeys = [];

    for (const key of keys) {
      if (this.equality(this.state[key], nextState[key])) continue;
      changedKeys.push(key);
    }

    if (changedKeys.length === 0) return [];

    this.state = cloneState(nextState);
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot, changedKeys);
    }

    return changedKeys;
  }
}
