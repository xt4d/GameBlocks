import * as THREE from 'three';
import { DEFAULT_PRNG } from '../../math/RandomUtils.js';
import { toVec3 } from '../../math/Vector3Utils.js';
import { disposeObject3D } from '../Object3DUtils.js';

export class WeaponEffectsSystem {
  constructor({maxEffects = 16, prng = DEFAULT_PRNG}) {
    this.group = new THREE.Group();
    this.group.name = 'WeaponEffectsSystem';
    this.maxEffects = Math.max(8, Math.floor(maxEffects));
    this.maxTracers = this.maxEffects;
    this.maxParticles = Math.max(128, this.maxEffects * 8);
    this.prng = prng;
    this.flashes = [];
    this.effects = [];

    this._color = new THREE.Color();
    this._tmpOrigin = new THREE.Vector3();
    this._tmpForward = new THREE.Vector3();

    this._setupTracerPool();
    this._setupParticlePool();
  }

  _setupTracerPool() {
    const vertexCount = this.maxTracers * 2;
    this.tracerPositions = new Float32Array(vertexCount * 3);
    this.tracerColors = new Float32Array(vertexCount * 3);
    this.tracers = [];
    this.nextTracer = 0;

    const geometry = new THREE.BufferGeometry();
    this.tracerPositionAttribute = new THREE.BufferAttribute(this.tracerPositions, 3)
      .setUsage(THREE.DynamicDrawUsage);
    this.tracerColorAttribute = new THREE.BufferAttribute(this.tracerColors, 3)
      .setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.tracerPositionAttribute);
    geometry.setAttribute('color', this.tracerColorAttribute);

    const material = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.tracerLines = new THREE.LineSegments(geometry, material);
    this.tracerLines.frustumCulled = false;
    this.group.add(this.tracerLines);

    for (let i = 0; i < this.maxTracers; i += 1) {
      this.tracers.push({
        active: false,
        ageSeconds: 0,
        ttlSeconds: 0,
        color: new THREE.Color(),
      });
    }
  }

  _setupParticlePool() {
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleVelocities = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleBaseColors = new Float32Array(this.maxParticles * 3);
    this.particleAges = new Float32Array(this.maxParticles);
    this.particleTtls = new Float32Array(this.maxParticles);
    this.particleActive = new Uint8Array(this.maxParticles);
    this.activeParticles = [];
    this.nextParticle = 0;

    const geometry = new THREE.BufferGeometry();
    this.particlePositionAttribute = new THREE.BufferAttribute(this.particlePositions, 3)
      .setUsage(THREE.DynamicDrawUsage);
    this.particleColorAttribute = new THREE.BufferAttribute(this.particleColors, 3)
      .setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.particlePositionAttribute);
    geometry.setAttribute('color', this.particleColorAttribute);

    const material = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    this.particlePoints = new THREE.Points(geometry, material);
    this.particlePoints.frustumCulled = false;
    this.group.add(this.particlePoints);
  }

  _setTracerSlot(index, from, to, color, ttlSeconds) {
    const tracer = this.tracers[index];
    const vertexOffset = index * 6;
    this._color.set(color);

    this.tracerPositions[vertexOffset] = from.x;
    this.tracerPositions[vertexOffset + 1] = from.y;
    this.tracerPositions[vertexOffset + 2] = from.z;
    this.tracerPositions[vertexOffset + 3] = to.x;
    this.tracerPositions[vertexOffset + 4] = to.y;
    this.tracerPositions[vertexOffset + 5] = to.z;

    tracer.color.copy(this._color);
    tracer.active = true;
    tracer.ageSeconds = 0;
    tracer.ttlSeconds = ttlSeconds;
    this._writeTracerColor(index, 1);
  }

  _writeTracerColor(index, fade) {
    const tracer = this.tracers[index];
    const vertexOffset = index * 6;
    const r = tracer.color.r * fade;
    const g = tracer.color.g * fade;
    const b = tracer.color.b * fade;

    this.tracerColors[vertexOffset] = r;
    this.tracerColors[vertexOffset + 1] = g;
    this.tracerColors[vertexOffset + 2] = b;
    this.tracerColors[vertexOffset + 3] = r;
    this.tracerColors[vertexOffset + 4] = g;
    this.tracerColors[vertexOffset + 5] = b;
  }

  _clearTracerSlot(index) {
    const tracer = this.tracers[index];
    tracer.active = false;
    tracer.ageSeconds = 0;
    tracer.ttlSeconds = 0;
    this._writeTracerColor(index, 0);
  }

  spawnTracer(from, to, color = 0xffe7ad, ttlSeconds = 0.08) {
    if (!from || !to) return null;

    const index = this.nextTracer;
    this.nextTracer = (this.nextTracer + 1) % this.maxTracers;
    this._setTracerSlot(
      index,
      toVec3(from),
      toVec3(to),
      color,
      Math.max(0.001, ttlSeconds)
    );
    this.tracerPositionAttribute.needsUpdate = true;
    this.tracerColorAttribute.needsUpdate = true;
    return this.tracerLines;
  }

  emitHitBurst(
    position,
    direction = new THREE.Vector3(0, 1, 0),
    color = 0xff5533,
    count = 10,
    speed = 1.5,
    spread = 0.8,
    lifetimeMs = 300
  ) {
    if (!position) return null;

    const particleCount = Math.max(0, Math.floor(count));
    const ttlSeconds = Math.max(0.02, lifetimeMs / 1000);
    this._tmpOrigin.copy(toVec3(position));
    this._tmpForward.copy(toVec3(direction));
    if (this._tmpForward.lengthSq() <= 1e-6) this._tmpForward.set(0, 1, 0);
    this._tmpForward.normalize();
    this._color.set(color);

    for (let i = 0; i < particleCount; i += 1) {
      const index = this.nextParticle;
      const offset = index * 3;
      this.nextParticle = (this.nextParticle + 1) % this.maxParticles;

      const vx = ((this.prng.random() - 0.5) * spread + this._tmpForward.x) * speed;
      const vy = ((this.prng.random() - 0.5) * spread + this._tmpForward.y) * speed;
      const vz = ((this.prng.random() - 0.5) * spread + this._tmpForward.z) * speed;

      this.particlePositions[offset] = this._tmpOrigin.x;
      this.particlePositions[offset + 1] = this._tmpOrigin.y;
      this.particlePositions[offset + 2] = this._tmpOrigin.z;
      this.particleVelocities[offset] = vx;
      this.particleVelocities[offset + 1] = vy;
      this.particleVelocities[offset + 2] = vz;
      this.particleBaseColors[offset] = this._color.r;
      this.particleBaseColors[offset + 1] = this._color.g;
      this.particleBaseColors[offset + 2] = this._color.b;
      this.particleColors[offset] = this._color.r;
      this.particleColors[offset + 1] = this._color.g;
      this.particleColors[offset + 2] = this._color.b;
      this.particleAges[index] = 0;
      this.particleTtls[index] = ttlSeconds;
      if (!this.particleActive[index]) {
        this.activeParticles.push(index);
      }
      this.particleActive[index] = 1;
    }

    this.particlePositionAttribute.needsUpdate = true;
    this.particleColorAttribute.needsUpdate = true;
    return this.particlePoints;
  }

  step(deltaSeconds = 1 / 60) {
    let tracersChanged = false;
    let particlesChanged = false;

    for (let i = 0; i < this.tracers.length; i += 1) {
      const tracer = this.tracers[i];
      if (!tracer.active) continue;

      tracer.ageSeconds += deltaSeconds;
      const t = Math.min(1, tracer.ageSeconds / tracer.ttlSeconds);
      this._writeTracerColor(i, 1 - t);
      tracersChanged = true;

      if (tracer.ageSeconds >= tracer.ttlSeconds) {
        this._clearTracerSlot(i);
      }
    }

    let writeParticle = 0;
    for (let i = 0; i < this.activeParticles.length; i += 1) {
      const index = this.activeParticles[i];
      if (!this.particleActive[index]) continue;

      const offset = index * 3;
      this.particleAges[index] += deltaSeconds;
      const t = Math.min(1, this.particleAges[index] / this.particleTtls[index]);
      const fade = 1 - t;
      this.particleVelocities[offset + 1] -= 3 * deltaSeconds;
      this.particlePositions[offset] += this.particleVelocities[offset] * deltaSeconds;
      this.particlePositions[offset + 1] += this.particleVelocities[offset + 1] * deltaSeconds;
      this.particlePositions[offset + 2] += this.particleVelocities[offset + 2] * deltaSeconds;
      this.particleColors[offset] = this.particleBaseColors[offset] * fade;
      this.particleColors[offset + 1] = this.particleBaseColors[offset + 1] * fade;
      this.particleColors[offset + 2] = this.particleBaseColors[offset + 2] * fade;
      particlesChanged = true;

      if (this.particleAges[index] >= this.particleTtls[index]) {
        this.particleActive[index] = 0;
        this.particleColors[offset] = 0;
        this.particleColors[offset + 1] = 0;
        this.particleColors[offset + 2] = 0;
      } else {
        this.activeParticles[writeParticle] = index;
        writeParticle += 1;
      }
    }
    this.activeParticles.length = writeParticle;

    if (tracersChanged) this.tracerColorAttribute.needsUpdate = true;
    if (particlesChanged) {
      this.particlePositionAttribute.needsUpdate = true;
      this.particleColorAttribute.needsUpdate = true;
    }
  }

  clear() {
    for (let i = 0; i < this.tracers.length; i += 1) {
      this._clearTracerSlot(i);
    }
    this.tracerColorAttribute.needsUpdate = true;

    this.particlePositions.fill(0);
    this.particleVelocities.fill(0);
    this.particleColors.fill(0);
    this.particleBaseColors.fill(0);
    this.particleAges.fill(0);
    this.particleTtls.fill(0);
    this.particleActive.fill(0);
    this.activeParticles.length = 0;
    this.particlePositionAttribute.needsUpdate = true;
    this.particleColorAttribute.needsUpdate = true;

    this.effects.length = 0;
  }

  dispose() {
    this.clear();
    disposeObject3D(this.group);
  }
}
