import { Quaternion, Vector3 } from 'three';
import { clamp } from '../../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { createDynamicCarConfigForBasis } from './DynamicCarRapierConfig.js';

function gravityObject(magnitude, basis = DEFAULT_WORLD_BASIS) {
  const gravity = basis.downVector().multiplyScalar(magnitude);
  return { x: gravity.x, y: gravity.y, z: gravity.z };
}

function cuboidInertia(mass, halfExtents) {
  const w = halfExtents.x * 2;
  const h = halfExtents.y * 2;
  const d = halfExtents.z * 2;
  const scale = mass / 12;
  return {
    x: scale * (h * h + d * d),
    y: scale * (w * w + d * d),
    z: scale * (w * w + h * h),
  };
}

export class DynamicCarBatchResolver {
  constructor({
    world,
    rapier,
    minDeltaSeconds = 1 / 240,
    gravityMagnitude = 9.81,
    effects = [],
    basis = DEFAULT_WORLD_BASIS
  }) {
    if (!world || !rapier) {
      throw new Error('DynamicCarBatchResolver: world and rapier are required');
    }

    this.world = world;
    this.rapier = rapier;
    this.basis = basis;
    this.worldConfig = {
      basis: this.basis,
      minDeltaSeconds,
      gravity: gravityObject(gravityMagnitude, this.basis),
    };

    this.actors = new Set();
    this.queuedMoves = new Map();
    this.results = new Map();
    this.effects = [];
    for (const effect of effects) this.useEffect(effect);
  }

  applyGravityToWorld() {
    this.world.gravity = this.worldConfig.gravity;
    return this.world.gravity;
  }

  useEffect(effect) {
    this.effects.push(effect);
    for (const actor of this.actors) actor.effects.push(effect);
    return this;
  }

  createActor({
    vehicleConfigOptions = {},
    position = { x: 0, y: 0, z: 0 },
    yaw = 0,
    velocity = { x: 0, y: 0, z: 0 },
    angularVelocity = { x: 0, y: 0, z: 0 },
    effects = []
  }) {
    const config = createDynamicCarConfigForBasis(vehicleConfigOptions, this.basis);
    const { chassis, damping, solver, axes, wheels } = config;
    const half = chassis.halfExtents;
    const spawn = position;
    const linvel = velocity;
    const angvel = angularVelocity;
    const bodyRotation = new Quaternion().setFromAxisAngle(this.basis.upVector(), yaw);
    const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setRotation(bodyRotation)
      .setLinvel(linvel.x, linvel.y, linvel.z)
      .setAngvel(angvel)
      .setLinearDamping(damping.linear)
      .setAngularDamping(damping.angular)
      .setAdditionalSolverIterations(solver.additionalSolverIterations)
      .setCcdEnabled(solver.ccdEnabled)
      .setCanSleep(solver.canSleep);

    bodyDesc.setAdditionalMassProperties(
      chassis.mass,
      chassis.centerOfMass,
      cuboidInertia(chassis.mass, half),
      { x: 0, y: 0, z: 0, w: 1 }
    );

    const rigidBody = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(
      Math.max(0.05, half.x),
      Math.max(0.05, half.y),
      Math.max(0.05, half.z)
    ).setTranslation(
        chassis.colliderOffset.x,
        chassis.colliderOffset.y,
        chassis.colliderOffset.z
      )
      .setFriction(chassis.friction)
      .setRestitution(chassis.restitution);

    const collider = this.world.createCollider(colliderDesc, rigidBody);
    const vehicle = this.world.createVehicleController(rigidBody);
    vehicle.indexUpAxis = axes.upAxis;
    // Rapier compat exposes this as a setter property, not a method.
    vehicle.setIndexForwardAxis = axes.forwardAxis;

    const actorWheels = wheels;
    for (const wheel of actorWheels) {
      vehicle.addWheel(
        wheel.connection,
        wheel.direction,
        wheel.axle,
        wheel.suspensionRestLength,
        wheel.radius
      );
      const index = vehicle.numWheels() - 1;
      vehicle.setWheelMaxSuspensionTravel(index, wheel.maxSuspensionTravel);
      vehicle.setWheelSuspensionStiffness(index, wheel.suspensionStiffness);
      vehicle.setWheelSuspensionCompression(index, wheel.suspensionCompression);
      vehicle.setWheelSuspensionRelaxation(index, wheel.suspensionRelaxation);
      vehicle.setWheelMaxSuspensionForce(index, wheel.maxSuspensionForce);
      vehicle.setWheelFrictionSlip(index, wheel.frictionSlip);
      vehicle.setWheelSideFrictionStiffness(index, wheel.sideFrictionStiffness);
      vehicle.setWheelSteering(index, 0);
      vehicle.setWheelEngineForce(index, 0);
      vehicle.setWheelBrake(index, 0);
    }

    const actor = {
      config,
      wheels: actorWheels,
      rigidBody,
      collider,
      vehicle,
      effects: [
        ...this.effects,
        ...effects,
      ],
      extensionState: {},
    };
    this._applyControls(actor, {});
    this.actors.add(actor);
    this.world.updateSceneQueries();
    return actor;
  }

  beginFrame() {
    this.queuedMoves.clear();
    this.results.clear();
  }

  queueMove(actor, movement = null) {
    this._requireActor(actor);
    this.queuedMoves.set(actor, movement);
  }

  resetState(actor, position = { x: 0, y: 0, z: 0 }, yaw = 0) {
    this._requireActor(actor);
    actor.rigidBody.setTranslation(position, true);
    actor.rigidBody.setRotation(new Quaternion().setFromAxisAngle(this.basis.upVector(), yaw), true);
    actor.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    actor.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    actor.extensionState = {};
    this._applyControls(actor, {});
    const resolved = this.getResult(actor);
    this.results.set(actor, resolved);
    this.world.updateSceneQueries();
    return resolved;
  }

  resolveQueuedMoves(deltaSeconds = 1 / 60) {
    const minDeltaSeconds = this.worldConfig.minDeltaSeconds;
    this.world.updateSceneQueries();

    for (const actor of this.actors) {
      const intent = this.queuedMoves.get(actor) ?? {};
      const stepDt = Math.max(minDeltaSeconds, intent.deltaSeconds ?? deltaSeconds);
      this._applyControls(actor, intent, stepDt);
      actor.vehicle.updateVehicle(stepDt);
    }

    if (deltaSeconds > 0) {
      this.world.timestep = Math.max(minDeltaSeconds, deltaSeconds);
      this.world.step();
    }
    this.world.updateSceneQueries();

    this.results.clear();
    for (const actor of this.actors) this.results.set(actor, this.getResult(actor));
    return this.results;
  }

  getResult(actor) {
    if (!this.actors.has(actor)) return null;

    const bodyTranslation = actor.rigidBody.translation();
    const bodyRotation = actor.rigidBody.rotation();
    const bodyLinearVelocity = actor.rigidBody.linvel();
    const bodyAngularVelocity = actor.rigidBody.angvel();
    const position = new Vector3(bodyTranslation.x, bodyTranslation.y, bodyTranslation.z);
    const rotation = new Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w);
    const velocity = new Vector3(bodyLinearVelocity.x, bodyLinearVelocity.y, bodyLinearVelocity.z);
    const angularVelocity = new Vector3(bodyAngularVelocity.x, bodyAngularVelocity.y, bodyAngularVelocity.z);
    const bodyFrame = {
      forward: this.basis.forwardVector().applyQuaternion(rotation).normalize(),
      right: this.basis.rightVector().applyQuaternion(rotation).normalize(),
      up: this.basis.upVector().applyQuaternion(rotation).normalize(),
    };
    const wheels = actor.wheels.map((wheel, index) => {
      const inContact = Boolean(actor.vehicle.wheelIsInContact(index));
      return {
        index,
        name: wheel.name,
        steering: actor.vehicle.wheelSteering(index) ?? 0,
        rotation: actor.vehicle.wheelRotation(index) ?? 0,
        suspensionLength: actor.vehicle.wheelSuspensionLength(index) ?? wheel.suspensionRestLength,
        inContact,
      };
    });

    return {
      position,
      rotation,
      velocity,
      angularVelocity,
      speed: velocity.length(),
      horizontalSpeed: this.basis.planarLength(velocity),
      vehicleSpeed: actor.vehicle.currentVehicleSpeed(),
      grounded: wheels.some((wheel) => wheel.inContact),
      bodyFrame,
      wheels,
      extensionState: { ...actor.extensionState },
    };
  }

  disposeActor(actor) {
    if (!this.actors.has(actor)) return false;
    if (actor.vehicle) {
      this.world.removeVehicleController(actor.vehicle);
    }
    if (actor.rigidBody) this.world.removeRigidBody(actor.rigidBody);
    this.actors.delete(actor);
    this.queuedMoves.delete(actor);
    this.results.delete(actor);
    return true;
  }

  dispose() {
    for (const actor of Array.from(this.actors)) this.disposeActor(actor);
  }

  _applyControls(actor, controls = {}, deltaSeconds = 0) {
    const { drive, axes } = actor.config;
    const steeringAngle = controls.steeringAngle ?? 0;
    const throttle = clamp(controls.throttle ?? 0, 0, 1);
    const reverse = clamp(controls.reverse ?? 0, 0, 1);
    const brake = clamp(controls.brake ?? 0, 0, 1);
    const handbrake = Boolean(controls.handbrake);
    const boost = Boolean(controls.boost);
    const engineForce = (
      throttle * drive.maxEngineForce * (boost ? drive.boostMultiplier : 1)
      - reverse * drive.maxReverseForce
    ) * axes.forwardSign;
    const brakeForce = brake * drive.maxBrakeForce;
    const handbrakeForce = handbrake ? drive.maxHandbrakeForce : 0;

    const wheelControls = actor.wheels.map((wheel, index) => {
      const wheelBrakeForce = wheel.brake ? brakeForce * wheel.brakeScale : 0;
      const wheelHandbrakeForce = wheel.handbrake
        ? handbrakeForce * wheel.handbrakeScale
        : 0;
      return {
        index,
        wheel,
        steering: wheel.steerable ? steeringAngle * wheel.steeringScale : 0,
        engineForce: wheel.drive ? engineForce * wheel.engineScale : 0,
        brakeForce: wheelBrakeForce,
        handbrakeForce: wheelHandbrakeForce,
        brake: wheelBrakeForce + wheelHandbrakeForce,
        frictionSlip: wheel.frictionSlip,
        sideFrictionStiffness: wheel.sideFrictionStiffness,
      };
    });

    for (const effect of actor.effects) {
      effect.applyDynamicCarControls({
        resolver: this,
        actor,
        controls,
        wheelControls,
        deltaSeconds: Math.max(0, deltaSeconds),
        state: actor.extensionState,
        basis: this.basis,
      });
    }

    for (const control of wheelControls) {
      actor.vehicle.setWheelSteering(control.index, control.steering);
      actor.vehicle.setWheelEngineForce(control.index, control.engineForce);
      actor.vehicle.setWheelBrake(control.index, control.brake);
      actor.vehicle.setWheelFrictionSlip(control.index, Math.max(0, control.frictionSlip));
      actor.vehicle.setWheelSideFrictionStiffness(control.index, Math.max(0, control.sideFrictionStiffness));
    }
  }

  _requireActor(actor) {
    if (!this.actors.has(actor)) {
      throw new Error('DynamicCarBatchResolver: unknown actor handle');
    }
  }
}
