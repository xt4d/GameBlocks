import { Quaternion, Vector3 } from 'three';
import { clamp, smoothToward } from '../../math/ScalarUtils.js';
import { toVec3 } from '../../math/Vector3Utils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

function quatFromYaw(yaw = 0, basis = DEFAULT_WORLD_BASIS) {
  return new Quaternion().setFromAxisAngle(basis.upVector(), yaw);
}

function basisFromRotation(rotation, basis = DEFAULT_WORLD_BASIS) {
  const worldBasis = basis;
  return {
    forward: worldBasis.forwardVector().applyQuaternion(rotation).normalize(),
    right: worldBasis.rightVector().applyQuaternion(rotation).normalize(),
    up: worldBasis.upVector().applyQuaternion(rotation).normalize(),
  };
}

function mergePluginResult(controller, intent, result) {
  if (!result || typeof result !== 'object') return;

  const pluginIntent = result.intent;
  if (intent && pluginIntent) {
    if (pluginIntent.effects) {
      intent.effects = Object.assign(intent.effects ?? {}, pluginIntent.effects);
    }

    for (const key of Object.keys(pluginIntent)) {
      if (key !== 'effects') intent[key] = pluginIntent[key];
    }
  }

  if (result.state) Object.assign(controller, result.state);
}

function callPlugin(plugin, hook, frame) {
  if (typeof plugin[hook] === 'function') {
    return plugin[hook](frame);
  }
  return null;
}

export class DynamicCarMotionController {
  constructor({
    steerLag = 0.09,
    throttleLag = 0.06,
    reverseLag = 0.06,
    brakeLag = 0.04,
    releaseLag = 0.04,
    maxSteeringAngle = 0.56,
    plugins = [],
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.cfg = {
      steerLag,
      throttleLag,
      reverseLag,
      brakeLag,
      releaseLag,
      maxSteeringAngle: maxSteeringAngle,
    };

    this.basis = basis;
    this.plugins = [];

    for (const plugin of plugins) this.use(plugin);

    this.initControls();
    this.initMotion(new Vector3(), 0);
    this.runPluginHook('reset', {
      controller: this,
      position: this.position,
      yaw: 0,
      basis: this.basis,
    });
  }

  use(plugin) {
    this.plugins.push(plugin);
    return this;
  }

  reset(position = { x: 0, y: 0, z: 0 }, yaw = 0) {
    this.initControls();
    this.initMotion(position, yaw);
    this.runPluginHook('reset', {
      controller: this,
      position,
      yaw,
      basis: this.basis,
    });
  }

  // left/right: 0..1 steers toward the local left/right directions.
  // throttle/reverse: 0..1 applies forward/reverse drive pressure.
  // brake: 0..1 applies brake pressure.
  // handbrake/boost: true triggers discrete action flags.
  planMovement({
    left = 0,
    right = 0,
    throttle = 0,
    reverse = 0,
    brake = 0,
    handbrake = false,
    boost = false,
    deltaSeconds = 1 / 60,
  }) {
    const input = {
      steer: this.basis.controlSignal('counterClockWise', left) + this.basis.controlSignal('clockWise', right),
      throttle: clamp(throttle, 0, 1),
      reverse: clamp(reverse, 0, 1),
      brake: clamp(brake, 0, 1),
      handbrake: Boolean(handbrake),
      boost: Boolean(boost),
    };

    this.inputSteer = input.steer;
    this.steer = smoothToward(this.steer, input.steer, this.cfg.steerLag, deltaSeconds);
    this.steeringAngle = this.steer * this.cfg.maxSteeringAngle;
    this.throttle = smoothToward(
      this.throttle,
      input.throttle,
      input.throttle > this.throttle ? this.cfg.throttleLag : this.cfg.releaseLag,
      deltaSeconds
    );
    this.reverse = smoothToward(
      this.reverse,
      input.reverse,
      input.reverse > this.reverse ? this.cfg.reverseLag : this.cfg.releaseLag,
      deltaSeconds
    );
    this.brake = smoothToward(
      this.brake,
      input.brake,
      input.brake > this.brake ? this.cfg.brakeLag : this.cfg.releaseLag,
      deltaSeconds
    );
    this.handbrake = input.handbrake;
    this.boost = input.boost;

    const intent = {
      deltaSeconds,
      steeringAngle: this.steeringAngle,
      throttle: this.throttle,
      reverse: this.reverse,
      brake: this.brake,
      handbrake: this.handbrake,
      boost: this.boost,
    };

    this.runPluginHook('planMovement', {
      controller: this,
      intent,
      deltaSeconds,
      basis: this.basis,
    }, intent);

    return intent;
  }

  commitMovement(resolved = null) {
    if (resolved) {
      this.position = resolved.position;
      this.rotation = resolved.rotation;
      this.velocity = resolved.velocity;
      this.angularVelocity = resolved.angularVelocity;
      this.speed = resolved.speed;
      this.horizontalSpeed = resolved.horizontalSpeed;
      this.vehicleSpeed = resolved.vehicleSpeed;
      this.grounded = resolved.grounded;
      this.bodyFrame = resolved.bodyFrame;
      this.wheels = resolved.wheels;
      this.runPluginHook('commitMovement', {
        controller: this,
        resolved,
        basis: this.basis,
      });
    }
  }

  initMotion(position, yaw) {
    this.position = toVec3(position);
    this.rotation = quatFromYaw(yaw, this.basis);
    this.velocity = new Vector3();
    this.angularVelocity = new Vector3();
    this.speed = 0;
    this.horizontalSpeed = 0;
    this.vehicleSpeed = 0;
    this.grounded = false;
    this.bodyFrame = basisFromRotation(this.rotation, this.basis);
    this.wheels = [];
  }

  initControls() {
    this.inputSteer = 0;
    this.steer = 0;
    this.steeringAngle = 0;
    this.throttle = 0;
    this.reverse = 0;
    this.brake = 0;
    this.handbrake = false;
    this.boost = false;
  }

  runPluginHook(hook, frame, intent = null) {
    for (const plugin of this.plugins) {
      mergePluginResult(this, intent, callPlugin(plugin, hook, frame));
    }
  }
}
