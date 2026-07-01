import { clamp, smoothToward } from '../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

export class PlateTiltController {
  constructor({
    maxTiltRadians = 0.13,
    tiltLag = 0.10,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.maxTiltRadians = Math.max(1e-6, maxTiltRadians);
    this.tiltLag = Math.max(0, tiltLag);
    this.rightTiltRadians = 0;
    this.forwardTiltRadians = 0;
    this.basis = basis;
  }

  reset(rightTiltRadians = 0, forwardTiltRadians = 0) {
    this.rightTiltRadians = rightTiltRadians;
    this.forwardTiltRadians = forwardTiltRadians;
    return this.snapshot();
  }

  // forward/backward: 0..1 tilts toward the local forward/backward directions.
  // left/right: 0..1 tilts toward the local left/right directions.
  move({
    forward = 0,
    backward = 0,
    left = 0,
    right = 0,
    deltaSeconds = 1 / 60
  }) {
    const targetForward = this.basis.controlSignal('clockWise', forward) + this.basis.controlSignal('counterClockWise', backward);
    const targetRight = this.basis.controlSignal('clockWise', right) + this.basis.controlSignal('counterClockWise', left);

    this.forwardTiltRadians = smoothToward(
      this.forwardTiltRadians,
      targetForward * this.maxTiltRadians,
      this.tiltLag,
      deltaSeconds
    );
    this.rightTiltRadians = smoothToward(
      this.rightTiltRadians,
      targetRight * this.maxTiltRadians,
      this.tiltLag,
      deltaSeconds
    );

    return this.snapshot();
  }

  slopeSignal() {
    // Gameplay acceleration follows the downhill slope, which is opposite the signed rotation angle for positive forward/right tilt.
    return {
      right: clamp(-this.rightTiltRadians / this.maxTiltRadians, -1, 1),
      forward: clamp(-this.forwardTiltRadians / this.maxTiltRadians, -1, 1),
    };
  }

  snapshot() {
    return {
      rightTiltRadians: this.rightTiltRadians,
      forwardTiltRadians: this.forwardTiltRadians,
      slope: this.slopeSignal(),
    };
  }
}
