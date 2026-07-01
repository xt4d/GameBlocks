export function resolveStorage(storage = null) {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readStorageItem(storage, key) {
  if (!storage || !key) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageItem(storage, key, value) {
  if (!storage || !key) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readBoolean(raw, fallback = false) {
  if (raw == null) return fallback;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  return fallback;
}

export function readInteger(raw, fallback = 0) {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readJsonStorageItem(storage, key, fallback = null) {
  const raw = readStorageItem(storage, key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export class JsonSettingsStore {
  constructor(storage = null, storageKey = '', defaults = {}) {
    this.storage = resolveStorage(storage);
    this.storageKey = storageKey;
    this.defaults = { ...defaults };
    this.settings = { ...defaults };
  }

  load() {
    const saved = readJsonStorageItem(this.storage, this.storageKey, null);
    if (saved && typeof saved === 'object') {
      this.settings = {
        ...this.settings,
        ...saved,
      };
    }
    return this.settings;
  }

  save() {
    writeStorageItem(this.storage, this.storageKey, JSON.stringify(this.settings));
    return this.settings;
  }

  update(nextSettings = {}) {
    this.settings = {
      ...this.settings,
      ...nextSettings,
    };
    return this.settings;
  }
}
