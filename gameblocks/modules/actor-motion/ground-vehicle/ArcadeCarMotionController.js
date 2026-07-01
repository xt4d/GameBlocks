import { Vector3 } from 'three';
import { clamp, smoothToward } from '../../math/ScalarUtils.js';
import { toVec3 } from '../../math/Vector3Utils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

function buildOrientationBasis(yaw, surfaceNormal, basis = DEFAULT_WORLD_BASIS) {
  const worldBasis = basis;
  const up = surfaceNormal.clone().normalize();

  const frame = worldBasis.yawPitchRollFrame(yaw);
  const forward = frame.forward.projectOnPlane(up).normalize();

  const right = new Vector3().crossVectors(forward, up);
  right.normalize();

  forward.crossVectors(up, right).normalize();
  return { right, up, forward };
}

function resolveTerrainSample(terrain, worldPosition, basis = DEFAULT_WORLD_BASIS) {
  if (terrain === null) {
    return {
      height: 0,
      normal: basis.upVector(),
    };
  }

  const worldBasis = basis;
  const planar = worldBasis.toPlanar(worldPosition);
  return terrain.sample(planar.right, planar.forward);
}

function tangentForwardSpeed(velocity, basis) {
  return velocity.clone().projectOnPlane(basis.up).dot(basis.forward);
}

export class ArcadeCarMotionController {
  constructor({
    maxForwardSpeed = 54,
    maxReverseSpeed = 18,
    throttleAccel = 40,
    reverseAccel = 16,
    engineBrake = 1.0,
    steerLag = 0.09,
    steerAngleMax = 0.56,
    wheelBase = 5.6,
    rideHeight = 0.38,
    boostMultiplier = 1.35,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    
    // Top speed happens when speed stops increasing:
    // 0 = throttleAccel - engineBrake * speed,
    // speed = throttleAccel / engineBrake.
    // normal top speed is throttleAccel / engineBrake.
    this.cfg = {
      maxForwardSpeed,
      maxReverseSpeed,
      throttleAccel,
      reverseAccel,
      engineBrake,
      steerLag,
      steerAngleMax,
      wheelBase,
      rideHeight,
      boostMultiplier,
    };

    this.steer = 0;
    this.basis = basis;

    this.position = new Vector3();
    this.velocity = new Vector3();
    this.surfaceNormal = this.basis.upVector();
    this.bodyFrame = buildOrientationBasis(0, this.surfaceNormal, this.basis);

    this.yaw = 0;
    this.steeringAngle = 0;
  }

  reset(position = {x:0, y:0, z:0}, yaw = 0) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.surfaceNormal.copy(this.basis.upVector());

    this.yaw = yaw;
    this.steer = 0;
    this.steeringAngle = 0;

    const basis = buildOrientationBasis(this.yaw, this.surfaceNormal, this.basis);
    this.bodyFrame.right.copy(basis.right);
    this.bodyFrame.up.copy(basis.up);
    this.bodyFrame.forward.copy(basis.forward);
  }

  // left/right: 0..1 steers toward the local left/right directions.
  // throttle/reverse: 0..1 accelerates along the local forward/backward directions.
  // boost: true scales throttle acceleration.
  // terrain: supply height and surface normal.
  planMovement({
    left = 0,
    right = 0,
    throttle = 0,
    reverse = 0,
    boost = false,
    deltaSeconds = 1 / 60,
    terrain = null,
    commit = false
  }) {
    const startPosition = this.position.clone();
    const input = {
      steer: this.basis.controlSignal('counterClockWise', left) + this.basis.controlSignal('clockWise', right),
      throttle: clamp(throttle, 0, 1),
      reverse: clamp(reverse, 0, 1),
      boost: Boolean(boost),
    };

    const terrainNow = resolveTerrainSample(terrain, startPosition, this.basis);
    this.steer = input.steer != 0 ? smoothToward(this.steer, input.steer, this.cfg.steerLag, deltaSeconds) : input.steer;

    const startBasis = buildOrientationBasis(this.yaw, terrainNow.normal, this.basis);
    const currentForwardSpeed = tangentForwardSpeed(this.velocity, startBasis);
    const steerAngle = this.steer * this.cfg.steerAngleMax;
    const yawRate = currentForwardSpeed * Math.tan(steerAngle) / this.cfg.wheelBase;
    const nextYaw = this.yaw + yawRate * deltaSeconds;
    const motionBasis = buildOrientationBasis(nextYaw, terrainNow.normal, this.basis);

    const boostScale = input.boost ? this.cfg.boostMultiplier : 1;
    const driveAccel = input.throttle * this.cfg.throttleAccel * boostScale - input.reverse * this.cfg.reverseAccel;
    const dragAccel = -this.cfg.engineBrake * currentForwardSpeed;
    const nextForwardSpeed = clamp(
      currentForwardSpeed + (driveAccel + dragAccel) * deltaSeconds,
      -this.cfg.maxReverseSpeed,
      this.cfg.maxForwardSpeed
    );

    const desiredVelocity = new Vector3().addScaledVector(motionBasis.forward, nextForwardSpeed);
    const targetPosition = startPosition.clone().addScaledVector(desiredVelocity, deltaSeconds);
    const terrainAfter = resolveTerrainSample(terrain, targetPosition, this.basis);
    this.basis.setHeight(targetPosition, terrainAfter.height + this.cfg.rideHeight);

    const desiredDelta = targetPosition.clone().sub(startPosition);

    const intent = {
      position: targetPosition.clone(),
      startPosition,
      desiredDelta,
      velocity: desiredVelocity.clone(),
      deltaSeconds,
      yaw: nextYaw,
      steeringAngle: steerAngle
    };

    if (commit) {
      return this.commitMovement(intent, null, terrain);
    }
    return intent;
  }

  commitMovement(intent, resolved = null, terrain = null) {
    const position = toVec3(resolved ? resolved.position : intent.position);
    const velocity = toVec3(resolved ? resolved.velocity : intent.velocity);
    const surfaceNormal = resolveTerrainSample(terrain, position, this.basis).normal;

    this.position.copy(position);
    this.velocity.copy(velocity);
    this.yaw = intent.yaw;
    this.steeringAngle = intent.steeringAngle;
    this.surfaceNormal.copy(surfaceNormal);

    const basis = buildOrientationBasis(this.yaw, this.surfaceNormal, this.basis);
    this.bodyFrame.right.copy(basis.right);
    this.bodyFrame.up.copy(basis.up);
    this.bodyFrame.forward.copy(basis.forward);

    const tangentSpeed = this.velocity.clone().projectOnPlane(this.bodyFrame.up).length();

    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      speed: tangentSpeed,
      yaw: this.yaw,
      steering: this.steer,
      steeringAngle: this.steeringAngle,
      surfaceNormal: this.surfaceNormal.clone(),
      bodyFrame: {
        forward: this.bodyFrame.forward.clone(),
        right: this.bodyFrame.right.clone(),
        up: this.bodyFrame.up.clone(),
      },
      collisions: resolved ? resolved.collisions : 0,
    };
  }
}
