import { Vector3 } from 'three';
import { clamp } from '../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';
import { toVec3 } from '../math/Vector3Utils.js';

const EPS = 1e-6;

function neutralIntent({ waypoint = null }) {
  const target = waypoint ? toVec3(waypoint) : null;
  return {
    waypoint: target ? target.clone() : null,
    direction: new Vector3(0, 0, 0),
    desiredSpeed: 0,
    distance: 0,
  };
}

export class AgentPathNavigator {
  constructor({
    maxSpeed = 3.5,
    minSpeed = 0,
    arriveRadius = 1.25,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.maxSpeed = maxSpeed;
    this.minSpeed = minSpeed;
    this.arriveRadius = arriveRadius;
    this.basis = basis;
    this.last = null;
  }

  reset() {
    this.last = null;
  }

  step({
    position = null,
    waypoint = null,
    movementEnabled = true,
    maxSpeed = this.maxSpeed,
  }) {

    if (movementEnabled === false || !position || !waypoint) {
      this.last = neutralIntent({ waypoint });
      return this.last;
    }

    const target = toVec3(waypoint);
    const toTarget = target.clone().sub(toVec3(position));
    this.basis.flatten(toTarget);

    const distance = toTarget.length();
    if (distance <= EPS) {
      this.last = neutralIntent({ waypoint: target });
      return this.last;
    }

    const speedLimit = Math.max(0, maxSpeed);
    const arrivalScale = this.arriveRadius > EPS
      ? clamp(distance / this.arriveRadius, 0, 1)
      : 1;
    const desiredSpeed = clamp(
      speedLimit * arrivalScale,
      Math.max(0, Math.min(this.minSpeed, speedLimit)),
      speedLimit
    );

    this.last = {
      waypoint: target.clone(),
      direction: toTarget.multiplyScalar(1 / distance),
      desiredSpeed,
      distance,
    };

    return this.last;
  }
}
