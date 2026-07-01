import { MinimapProjector2D } from './MinimapProjector2D.js';
import { clamp, clamp01 } from '../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

function parseVec3Reading(value) {
  if (!value) return null;

  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

function toCssColor(value, fallback = '#53fe8e') {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Number.isFinite(value)) return `#${value.toString(16).padStart(6, '0')}`;
  return fallback;
}

function defaultPixelRatio() {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
}

export class HeadingRelativeRadar {
  constructor({
    container = null,
    width = 250,
    height = 200,
    range = 20,
    playerColor = 0x53fe8e,
    contactColor = 0xff4444,
    contactOpacity = 0.85,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.container = container;
    this.playerColor = toCssColor(playerColor);
    this.contactColor = toCssColor(contactColor, '#ff4444');
    this.contactOpacity = clamp01(contactOpacity);
    this.basis = basis;

    this.projector = new MinimapProjector2D({
      planarBounds: {
        minRight: -range,
        maxRight: range,
        minForward: -range,
        maxForward: range,
      },
      width,
      height,
    });
    this._ownsCanvas = false;
    this.canvas = this._resolveCanvas(container);
    this.context = this.canvas?.getContext?.('2d') ?? null;
    this._point = { x: 0, y: 0 };

    this.setRange(range);
    this.setSize(width, height);
  }

  _resolveCanvas(container) {
    if (container?.getContext) return container;
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    this._ownsCanvas = true;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    if (container?.appendChild) container.appendChild(canvas);
    return canvas;
  }

  setRange(range) {
    this.range = Math.max(0.5, range);
    this.projector.setPlanarBounds(-this.range, this.range, -this.range, this.range);
  }

  setBasis(basis = DEFAULT_WORLD_BASIS) {
    this.basis = basis;
    return this;
  }

  setSize(width, height) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.radarRadius = Math.max(1, Math.min(this.width, this.height) * 0.5 - 11);
    this.radarCenterX = this.width * 0.5;
    this.radarCenterY = this.height * 0.5;
    this.radarOriginX = this.radarCenterX - this.radarRadius;
    this.radarOriginY = this.radarCenterY - this.radarRadius;
    this.projector.setViewport(this.radarRadius * 2, this.radarRadius * 2, 0);

    if (!this.canvas || !this.context) return;
    const ratio = clamp(defaultPixelRatio(), 1, 2);
    this.canvas.width = Math.floor(this.width * ratio);
    this.canvas.height = Math.floor(this.height * ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  _yawFromForward(forward) {
    return this.basis.forwardToYaw(forward);
  }

  _projectRelativePoint(localRight, localForward, out = { x: 0, y: 0 }) {
    const distance = Math.hypot(localRight, localForward);
    let clampedRight = localRight;
    let clampedForward = localForward;

    if (distance > this.range) {
      const scale = this.range / distance;
      clampedRight *= scale;
      clampedForward *= scale;
    }

    this.projector.projectPlanar(clampedRight, clampedForward, out);
    out.x += this.radarOriginX;
    out.y += this.radarOriginY;
    return out;
  }

  _projectContact(position, playerPosition, playerYaw, out = { x: 0, y: 0 }) {
    const delta = this.basis.planarDelta(position, playerPosition);
    const dRight = delta.right;
    const dForward = delta.forward;
    const cos = Math.cos(playerYaw);
    const sin = Math.sin(playerYaw);
    return this._projectRelativePoint(
      cos * dRight + sin * dForward,
      -sin * dRight + cos * dForward,
      out
    );
  }

  _drawBackground(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = 'rgba(6, 12, 20, 0.86)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(140, 170, 210, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.radarCenterX, this.radarCenterY - this.radarRadius);
    ctx.lineTo(this.radarCenterX, this.radarCenterY + this.radarRadius);
    ctx.moveTo(this.radarCenterX - this.radarRadius, this.radarCenterY);
    ctx.lineTo(this.radarCenterX + this.radarRadius, this.radarCenterY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(140, 170, 210, 0.34)';
    ctx.beginPath();
    ctx.arc(this.radarCenterX, this.radarCenterY, this.radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(119, 148, 188, 0.38)';
    ctx.strokeRect(0.5, 0.5, this.width - 1, this.height - 1);
  }

  _drawContact(ctx, point, contact = {}, rotation = 0) {
    const color = toCssColor(contact.color, this.contactColor);
    const opacity = clamp01(Number(contact.opacity ?? this.contactOpacity) || 0);
    const size = Math.max(2, Number(contact.size) || 4.2);
    const shape = contact.shape ?? 'dot';

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);

    if (shape === 'cross') {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size - 2, 0);
      ctx.lineTo(size + 2, 0);
      ctx.moveTo(0, -size - 2);
      ctx.lineTo(0, size + 2);
      ctx.stroke();
    } else if (shape === 'triangle') {
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.moveTo(0, -size - 2);
      ctx.lineTo(size, size + 1);
      ctx.lineTo(-size, size + 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawPlayer(ctx, point) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.fillStyle = this.playerColor;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.6, 6);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-5.6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderRadar(playerPositionReading, playerForwardReading = null, contacts = []) {
    if (!this.context || !this.canvas) return false;

    const playerPosition = parseVec3Reading(playerPositionReading);
    if (!playerPosition) return false;

    const playerForward = playerForwardReading === null
      ? this.basis.forwardVector()
      : parseVec3Reading(playerForwardReading);
    if (!playerForward) return false;
    const playerYaw = this._yawFromForward(playerForward);
    const ctx = this.context;

    this._drawBackground(ctx);

    for (const contact of contacts) {
      const contactPosition = parseVec3Reading(contact?.position ?? contact);
      if (!contactPosition) continue;

      const point = this._projectContact(contactPosition, playerPosition, playerYaw, this._point);
      // canvas positive rotation is visually clockwise
      const rotation = Number.isFinite(contact.yaw) ? -(contact.yaw - playerYaw) : 0;
      this._drawContact(ctx, point, contact, rotation);
    }

    this._drawPlayer(ctx, this._projectRelativePoint(0, 0, { x: 0, y: 0 }));
    return true;
  }

  dispose() {
    if (this._ownsCanvas) this.canvas?.remove?.();
    this.canvas = null;
    this.context = null;
    this._ownsCanvas = false;
  }
}
