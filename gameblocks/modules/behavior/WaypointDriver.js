import { clamp } from '../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

const EPS = 1e-6;

function resolveForward(yaw, basis) {
  const forward = basis.yawPitchRollFrame(yaw).forward;
  const planar = basis.toPlanar(forward);
  const len = Math.hypot(planar.right, planar.forward);
  if (len > EPS) {
    return { right: planar.right / len, forward: planar.forward / len };
  }
  return { right: 0, forward: 0 };
}

function directionToTarget(from, target, basis = DEFAULT_WORLD_BASIS) {
  const delta = basis.planarDelta(target, from);
  const dRight = delta.right;
  const dForward = delta.forward;
  const len = Math.hypot(dRight, dForward);
  if (len < EPS) return { right: 0, forward: 0, len: 0 };
  return { right: dRight / len, forward: dForward / len, len };
}

function signedYawError(forward, desired) {
  const dot = clamp(
    forward.right * desired.right + forward.forward * desired.forward,
    -1,
    1
  );
  const rightTurnCross = forward.forward * desired.right - forward.right * desired.forward;
  const angle = Math.acos(dot);
  return angle * Math.sign(rightTurnCross || 1);
}

function neutralControls() {
  return {
    throttle: false,
    reverse: false,
    left: false,
    right: false,
    brake: true,
    boost: false,
  };
}

export class WaypointDriver {
  constructor({
    targetSpeed = 32,
    minSpeed = 4,
    cornerSlowdown = 16,
    steerGain = 2.4,
    steerDeadzone = 0.12,
    brakeYawThreshold = 0.88,
    accelerateSpeedError = 0.4,
    brakeSpeedError = -0.9,
    stuckSpeed = 0.35,
    stuckYawThreshold = 1.35,
    stuckTimeMs = 900,
    reverseTimeMs = 420,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.targetSpeed = targetSpeed;
    this.minSpeed = minSpeed;
    this.cornerSlowdown = cornerSlowdown;
    this.steerGain = steerGain;
    this.steerDeadzone = steerDeadzone;
    this.brakeYawThreshold = brakeYawThreshold;
    this.accelerateSpeedError = accelerateSpeedError;
    this.brakeSpeedError = brakeSpeedError;

    this.stuckSpeed = stuckSpeed;
    this.stuckYawThreshold = stuckYawThreshold;
    this.stuckTimeMs = stuckTimeMs;
    this.reverseTimeMs = reverseTimeMs;
    this.basis = basis;

    this.stuckMs = 0;
    this.reverseRemainingMs = 0;
    this.last = null;
  }

  reset() {
    this.stuckMs = 0;
    this.reverseRemainingMs = 0;
    this.last = null;
  }

  step({
    position = null,
    yaw = 0,
    speed = 0,
    waypoint = null,
    cornerMagnitude = 0,
    steerBias = 0,
    raceStarted = true,
    deltaSeconds = 1 / 60,
  }) {
    const dtMs = Math.max(0, deltaSeconds * 1000);

    if (raceStarted === false || !waypoint || !position) {
      const controls = neutralControls();
      this.last = {
        ...controls,
        desiredSpeed: 0,
        yawError: 0,
        speedError: 0,
        steerIntent: 0,
      };
      return this.last;
    }

    const forward = resolveForward(yaw, this.basis);
    const toTarget = directionToTarget(position, waypoint, this.basis);

    if (toTarget.len < EPS) {
      const controls = neutralControls();
      this.last = {
        ...controls,
        desiredSpeed: 0,
        yawError: 0,
        speedError: 0,
        steerIntent: 0,
      };
      return this.last;
    }

    const yawError = signedYawError(forward, toTarget);
    const steerIntent = clamp(yawError * this.steerGain + steerBias, -1, 1);

    const cornerPenalty = cornerMagnitude * this.cornerSlowdown;
    const desiredSpeed = clamp(
      this.targetSpeed - cornerPenalty,
      this.minSpeed,
      this.targetSpeed
    );

    const speedError = desiredSpeed - speed;

    const stuck = speed <= this.stuckSpeed && Math.abs(yawError) >= this.stuckYawThreshold;
    if (stuck) {
      this.stuckMs += dtMs;
      if (this.stuckMs >= this.stuckTimeMs) {
        this.reverseRemainingMs = this.reverseTimeMs;
        this.stuckMs = 0;
      }
    } else {
      this.stuckMs = Math.max(0, this.stuckMs - dtMs * 2);
    }

    if (this.reverseRemainingMs > 0) {
      this.reverseRemainingMs = Math.max(0, this.reverseRemainingMs - dtMs);
      const controls = {
        throttle: false,
        reverse: true,
        left: steerIntent > this.steerDeadzone,
        right: steerIntent < -this.steerDeadzone,
        brake: false,
        boost: false,
      };
      this.last = {
        ...controls,
        desiredSpeed,
        yawError,
        speedError,
        steerIntent,
      };
      return this.last;
    }

    const shouldBrakeForTurn = Math.abs(yawError) >= this.brakeYawThreshold && speed > desiredSpeed * 0.7;
    const shouldBrakeForSpeed = speedError <= this.brakeSpeedError;

    const brake = shouldBrakeForTurn || shouldBrakeForSpeed;

    const throttleDrive = speedError >= this.accelerateSpeedError && !brake;

    const controls = {
      throttle: throttleDrive,
      reverse: false,
      left: steerIntent < -this.steerDeadzone,
      right: steerIntent > this.steerDeadzone,
      brake,
      boost: throttleDrive && Math.abs(steerIntent) < 0.15,
    };

    this.last = {
      ...controls,
      desiredSpeed,
      yawError,
      speedError,
      steerIntent,
    };

    return this.last;
  }
}
