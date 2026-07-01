import { DEFAULT_CLOCK } from '../math/TimeUtils.js';

function cloneItem(item) {
  return { ...item };
}

export class NotificationQueue {
  constructor(
    maxVisible = 3,
    defaultLifetimeMs = 1500,
    idPrefix = null,
    clock = DEFAULT_CLOCK
  ) {
    this.clock = clock;
    this.maxVisible = Math.max(1, Math.floor(maxVisible));
    this.defaultLifetimeMs = Math.max(0, defaultLifetimeMs);
    this.idPrefix = idPrefix;
    this.currentTimeMs = this.readNow();
    this.pending = [];
    this.visible = [];
    this.listeners = new Set();
    this.nextId = 1;
  }

  readNow() {
    return this.clock.now();
  }

  setTime(nowMs = this.readNow()) {
    this.currentTimeMs = nowMs;
    return this.currentTimeMs;
  }

  syncClock() {
    return this.setTime(this.readNow());
  }

  subscribe(listener, emitInitial = false) {
    if (typeof listener !== 'function') {
      throw new Error('NotificationQueue.subscribe: listener must be a function');
    }

    this.listeners.add(listener);
    if (emitInitial) listener(this.getVisible());
    return () => this.listeners.delete(listener);
  }

  _emit() {
    const visible = this.getVisible();
    for (const listener of this.listeners) listener(visible);
  }

  _createId() {
    const id = this.idPrefix == null
      ? this.nextId
      : `${this.idPrefix}${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  _promote() {
    while (this.visible.length < this.maxVisible && this.pending.length > 0) {
      const item = this.pending.shift();
      item.shownAt = this.currentTimeMs;
      item.expiresAt = item.sticky ? 0 : this.currentTimeMs + item.lifetimeMs;
      this.visible.push(item);
    }
  }

  add(
    content,
    type = 'info',
    lifetimeMs = this.defaultLifetimeMs,
    sticky = false,
    extra = {}
  ) {
    const item = {
      id: this._createId(),
      content,
      type,
      sticky: Boolean(sticky),
      lifetimeMs: lifetimeMs,
      createdAt: this.currentTimeMs,
      shownAt: 0,
      expiresAt: 0,
      ...extra,
    };

    this.pending.push(item);
    this._promote();
    this._emit();
    return cloneItem(item);
  }

  remove(id) {
    const visibleIndex = this.visible.findIndex((item) => item.id === id);
    if (visibleIndex >= 0) {
      this.visible.splice(visibleIndex, 1);
      this._promote();
      this._emit();
      return true;
    }

    const pendingIndex = this.pending.findIndex((item) => item.id === id);
    if (pendingIndex >= 0) {
      this.pending.splice(pendingIndex, 1);
      this._emit();
      return true;
    }

    return false;
  }

  clear() {
    this.pending = [];
    this.visible = [];
    this._emit();
  }

  expire() {
    this.visible = this.visible.filter((item) => {
      if (item.sticky) return true;
      return item.expiresAt > this.currentTimeMs;
    });
    this._promote();
    this._emit();
    return this.getVisible();
  }

  tick(deltaMs = 0) {
    const safeDelta = Math.max(0, deltaMs);
    this.currentTimeMs += safeDelta;
    return this.expire();
  }

  tickAt(nowMs = this.readNow()) {
    this.setTime(nowMs);
    return this.expire();
  }

  getVisible() {
    return this.visible.map(cloneItem);
  }

  getPending() {
    return this.pending.map(cloneItem);
  }

  dispose() {
    this.clear();
    this.listeners.clear();
  }
}

export class ExpiringMessageFeed {
  constructor(
    lingerMs = 3000,
    maxEntries = 6,
    idPrefix = 'message-',
    clock = DEFAULT_CLOCK
  ) {
    this.clock = clock;
    this.lingerMs = lingerMs;
    this.maxEntries = maxEntries;
    this.idPrefix = idPrefix;
    this.sequence = 0;
    this.messages = [];
    this.listeners = new Set();
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('ExpiringMessageFeed.subscribe: listener must be a function');
    }

    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  _notify() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  push(text, kind = 'info', atMs = this.clock.now(), lingerMs = this.lingerMs, extra = {}) {
    this.sequence += 1;
    const message = {
      messageId: `${this.idPrefix}${this.sequence}`,
      text,
      kind,
      atMs,
      expiresAtMs: atMs + lingerMs,
      ...extra,
    };

    this.messages.unshift(message);
    this.messages = this.messages.slice(0, this.maxEntries);
    this._notify();
    return cloneItem(message);
  }

  tick(nowMs = this.clock.now()) {
    this.messages = this.messages.filter((message) => nowMs < message.expiresAtMs);
    this._notify();
    return this.snapshot();
  }

  clear() {
    this.messages = [];
    this._notify();
  }

  snapshot() {
    return this.messages.map(cloneItem);
  }
}
