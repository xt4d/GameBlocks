import { clamp } from '../../math/ScalarUtils.js';
import { toUnitVec3, toVec3 } from '../../math/Vector3Utils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { disposeObject3D } from '../Object3DUtils.js';

export class ProjectileObject {
  constructor({
    visual,
    position,
    direction,
    speed,
    target = null,
    lifetimeSeconds,
    hitRadius,
    turnResponse = 0,
    basis = DEFAULT_WORLD_BASIS,
  }) {

    this.target = target;
    this.speed = speed;
    this.lifetimeSeconds = lifetimeSeconds;
    this.hitRadius = hitRadius;
    this.turnResponse = turnResponse;
    this.active = true;
    this.ageSeconds = 0;

    this.position = toVec3(position);
    const launchDirection = toUnitVec3(direction, basis.forwardVector());
    this.velocity = launchDirection.multiplyScalar(this.speed);

    this.visual = visual;
    this.group = this.visual.group;
    this._syncVisual();
  }

  step(targets = [], deltaSeconds = 1 / 60) {
    if (!this.active) return this._result();

    this.ageSeconds += deltaSeconds;

    const result = this.target
      ? this._stepHomingMotion(targets, deltaSeconds)
      : this._stepLinearMotion(targets, deltaSeconds);

    if (this.active && this.ageSeconds >= this.lifetimeSeconds) this.active = false;
    return result;
  }

  _stepLinearMotion(targets, deltaSeconds) {
    this.position.addScaledVector(this.velocity, deltaSeconds);
    this._syncVisual();

    const hitTarget = this._findHitTarget(targets);
    if (hitTarget) {
      this.active = false;
    }

    return this._result(null, hitTarget);
  }

  _stepHomingMotion(targets, deltaSeconds) {
    const target = this.target && !this.target.destroyed ? this.target : null;
    if (target) {
      const desired = toVec3(target.position).sub(this.position);
      if (desired.lengthSq() > 1e-6) {
        desired.normalize().multiplyScalar(this.speed);
        this.velocity.lerp(desired, clamp(deltaSeconds * this.turnResponse, 0, 1));
      }
    }

    this.position.addScaledVector(this.velocity, deltaSeconds);
    this._syncVisual();

    const hitTarget = this._findHitTarget(targets, 1.2);
    if (hitTarget) {
      this.active = false;
    }
    return this._result(target, hitTarget);
  }

  _findHitTarget(targets, radiusScale = 1) {
    const hitRadius = this.hitRadius * radiusScale;
    for (const target of targets) {
      if (target.destroyed) continue;
      const targetPosition = toVec3(target.position);
      if (this.position.distanceTo(targetPosition) <= hitRadius) return target;
    }
    return null;
  }

  _direction() {
    if (this.velocity.lengthSq() <= 1e-6) return this.velocity.clone();
    return this.velocity.clone().normalize();
  }

  _syncVisual() {
    this.visual.step?.({
      position: this.position,
      direction: this._direction(),
      velocity: this.velocity,
      ageSeconds: this.ageSeconds,
      lifetimeSeconds: this.lifetimeSeconds,
    });
  }

  _result(target = null, hittedTarget = null) {
    return {
      position: this.position,
      target,
      hittedTarget,
    };
  }

  dispose() {
    disposeObject3D(this.group);
  }
}
