import { MinimapProjector2D } from './MinimapProjector2D.js';
import { clamp } from '../math/ScalarUtils.js';

const DEFAULT_STYLES = Object.freeze({
  background: 'rgba(6, 10, 16, 0.9)',
  border: 'rgba(128, 153, 191, 0.62)',
  track: 'rgba(113, 185, 255, 0.72)',
  checkpoint: 'rgba(204, 223, 255, 0.7)',
  nextCheckpoint: '#ffe88a',
  localFill: '#f16a45',
  localStroke: '#fff0db',
  leaderRing: '#ffe88a',
});

function toCssColor(value, fallback = '#8ab4d8') {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return fallback;
}

function defaultPixelRatio() {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

export class RaceMinimap extends MinimapProjector2D {
  constructor({
    planarBounds: { minRight, maxRight, minForward, maxForward },
    width = 200,
    height = 200,
    padding = 0,
    invertRight = false,
    invertForward = false,
    canvas = null,
    context = null,
    pixelRatio = defaultPixelRatio,
    maxPixelRatio = 2,
    styles = {}
  }) {
    super({
      planarBounds: { minRight, maxRight, minForward, maxForward },
      width,
      height,
      padding,
      invertRight,
      invertForward,
    });

    this.canvas = canvas;
    this.context = context ?? canvas?.getContext?.('2d') ?? null;
    this.pixelRatio = pixelRatio;
    this.maxPixelRatio = Math.max(1, maxPixelRatio);
    this.styles = { ...DEFAULT_STYLES, ...styles };
    this.scratchPoint = { x: 0, y: 0 };
  }

  setViewport(width = this.width, height = this.height, padding = this.padding) {
    return super.setViewport(width, height, padding);
  }

  project(worldPosition, out = { x: 0, y: 0 }) {
    return super.project(worldPosition, out);
  }

  projectYaw(forwardVector) {
    return super.projectYaw(forwardVector);
  }

  getOrthoFrustumFromBounds() {
    return super.getOrthoFrustumFromBounds();
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas?.getContext?.('2d') ?? null;
    return this;
  }

  syncResolution() {
    if (!this.canvas || !this.context) return false;

    const widthPx = Math.max(1, Math.floor(this.width));
    const heightPx = Math.max(1, Math.floor(this.height));
    const ratio = clamp(this.pixelRatio(), 1, this.maxPixelRatio);

    this.canvas.width = Math.floor(widthPx * ratio);
    this.canvas.height = Math.floor(heightPx * ratio);
    this.canvas.style.width = `${widthPx}px`;
    this.canvas.style.height = `${heightPx}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return true;
  }

  _drawCircle(x, y, radius, fillStyle, strokeStyle = null) {
    const ctx = this.context;
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (!strokeStyle) return;

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  render(
    checkpoints = [],
    localVehicle = null,
    localProgress = null,
    aiCars = [],
    aiLeaderId = null
  ) {
    const ctx = this.context;
    if (!ctx || !this.canvas) return false;

    const widthPx = Math.max(1, Math.floor(this.width));
    const heightPx = Math.max(1, Math.floor(this.height));
    const styles = this.styles;

    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = styles.background;
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.strokeStyle = styles.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, widthPx - 1, heightPx - 1);

    if (checkpoints.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < checkpoints.length; i += 1) {
        const checkpoint = checkpoints[i];
        this.project(checkpoint, this.scratchPoint);
        if (i === 0) ctx.moveTo(this.scratchPoint.x, this.scratchPoint.y);
        else ctx.lineTo(this.scratchPoint.x, this.scratchPoint.y);
      }
      ctx.closePath();
      ctx.strokeStyle = styles.track;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const nextCheckpointIndex = localProgress
      ? localProgress.nextCheckpointIndex % checkpoints.length
      : -1;
    for (let i = 0; i < checkpoints.length; i += 1) {
      const checkpoint = checkpoints[i];
      this.project(checkpoint, this.scratchPoint);
      const isNext = i === nextCheckpointIndex;
      this._drawCircle(
        this.scratchPoint.x,
        this.scratchPoint.y,
        isNext ? 3.4 : 2.1,
        isNext ? styles.nextCheckpoint : styles.checkpoint
      );
    }

    for (const aiCar of aiCars) {
      const position = aiCar?.position ?? aiCar?.motion?.position ?? null;
      if (!position) continue;

      this.project(position, this.scratchPoint);
      this._drawCircle(
        this.scratchPoint.x,
        this.scratchPoint.y,
        2.8,
        toCssColor(aiCar?.color)
      );

      if (aiCar?.id === aiLeaderId) {
        this._drawCircle(
          this.scratchPoint.x,
          this.scratchPoint.y,
          4.8,
          'rgba(0,0,0,0)',
          styles.leaderRing
        );
      }
    }

    const localPosition = localVehicle?.position;
    if (!localPosition) return true;

    const localPoint = this.project(localPosition, { x: 0, y: 0 });
    const yaw = this.projectYaw(localVehicle?.bodyFrame?.forward ?? this.basis.forwardVector());
    ctx.save();
    ctx.translate(localPoint.x, localPoint.y);
    ctx.rotate(yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = styles.localFill;
    ctx.fill();
    ctx.strokeStyle = styles.localStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    return true;
  }
}
