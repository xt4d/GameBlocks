import { clamp01 } from '../math/ScalarUtils.js';

const DEFAULT_FORMATTER = (value) => String(value ?? '');

function resolveDocument(documentRef = null) {
  return documentRef ?? (typeof document !== 'undefined' ? document : null);
}

export class DomHudRenderer {
  constructor(
    model,
    bindings = [],
    documentRef = null,
    label = 'DomHudRenderer'
  ) {
    if (!model) {
      throw new Error(`${label}: model is required`);
    }

    this.model = model;
    this.bindings = bindings;
    this.documentRef = documentRef;
    this.unsubscribe = null;
  }

  bindText(selector, key, formatter = DEFAULT_FORMATTER) {
    this.bindings.push({
      type: 'text',
      selector,
      key,
      formatter,
    });
    return this;
  }

  bindAttribute(selector, key, attribute, formatter = DEFAULT_FORMATTER) {
    this.bindings.push({
      type: 'attribute',
      selector,
      key,
      attribute,
      formatter,
    });
    return this;
  }

  bindClassToggle(selector, key, className, predicate = Boolean) {
    this.bindings.push({
      type: 'classToggle',
      selector,
      key,
      className,
      predicate,
    });
    return this;
  }

  bindStyleWidth(selector, key, maxKey) {
    this.bindings.push({
      type: 'styleWidth',
      selector,
      key,
      maxKey,
    });
    return this;
  }

  attach() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.model.subscribe((state, changedKeys) => {
      this.render(state, changedKeys);
    });
  }

  detach() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(state, changedKeys = null) {
    const doc = resolveDocument(this.documentRef);
    if (!doc || typeof doc.querySelector !== 'function') return;
    const changedSet = changedKeys ? new Set(changedKeys) : null;

    for (const binding of this.bindings) {
      if (
        changedSet &&
        !changedSet.has(binding.key) &&
        !(binding.maxKey && changedSet.has(binding.maxKey))
      ) {
        continue;
      }

      const element = doc.querySelector(binding.selector);
      if (!element) continue;

      if (binding.type === 'text') {
        element.textContent = binding.formatter(state[binding.key], state);
      } else if (binding.type === 'attribute') {
        element.setAttribute(
          binding.attribute,
          binding.formatter(state[binding.key], state)
        );
      } else if (binding.type === 'classToggle') {
        const active = binding.predicate(state[binding.key], state);
        if (active) {
          element.classList?.add?.(binding.className);
        } else {
          element.classList?.remove?.(binding.className);
        }
      } else if (binding.type === 'styleWidth') {
        const current = Number(state[binding.key] ?? 0);
        const max = Number(state[binding.maxKey] ?? 1);
        const ratio = max <= 0 ? 0 : clamp01(current / max);
        element.style.width = `${Math.round(ratio * 100)}%`;
      }
    }
  }
}
