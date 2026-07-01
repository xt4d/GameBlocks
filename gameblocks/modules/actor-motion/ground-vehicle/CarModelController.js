import { Matrix4, Vector3 } from 'three';

const EPS = 1e-6;

export class CarModelController {
  constructor({
    vehicleModel = null,
    wheels = [],
    wheelPivots = [],
    wheelRadius = 0.35,
    steerWheelIndices = [0, 1]
  }) {
    this.vehicleModel = vehicleModel;
    this.wheels = wheels;
    this.wheelPivots = wheelPivots;

    this.wheelRadius = wheelRadius;
    this.steerWheelIndices = new Set(steerWheelIndices);

    this.wheelSpin = 0;
    this.modelMatrix = new Matrix4();
    this.forwardVelocity = new Vector3();
    this.modelBack = new Vector3();
  }

  reset(position) {
    this.wheelSpin = 0;

    if (this.vehicleModel) {
      this.vehicleModel.position.copy(position);
      this.vehicleModel.quaternion.identity();
    }

    for (let i = 0; i < this.wheels.length; i += 1) {
      const wheel = this.wheels[i];
      const pivot = this.wheelPivots[i];

      if (wheel) {
        wheel.rotation.x = 0;
        wheel.rotation.y = 0;
      }
      if (pivot) pivot.rotation.y = 0;
    }

    return this.vehicleModel;
  }

  step({
    position,
    bodyFrame,
    velocity,
    steeringAngle, // Rapier3D local yaw angle around up (+Y)
    deltaSeconds = 1 / 60
  }) {
    this.updateChassis(position, bodyFrame);
    this.updateWheels(bodyFrame, velocity, steeringAngle, deltaSeconds);

    return this.vehicleModel;
  }

  updateChassis(position, bodyFrame) {
    if (!this.vehicleModel) return;

    this.vehicleModel.position.copy(position);

    if (bodyFrame?.right && bodyFrame?.up && bodyFrame?.forward) {
      // Matrix4.makeBasis asks where local +Z points; since vehicle meshes face local -Z, local +Z points to the backward direction.
      this.modelBack.copy(bodyFrame.forward).multiplyScalar(-1);
      this.modelMatrix.makeBasis(bodyFrame.right, bodyFrame.up, this.modelBack);
      this.vehicleModel.quaternion.setFromRotationMatrix(this.modelMatrix);
    }
  }

  updateWheels(
    bodyFrame,
    velocity,
    steeringAngle, // Rapier3D local yaw angle around up (+Y)
    deltaSeconds
  ) {
    const radius = Math.max(EPS, Math.abs(this.wheelRadius));
    this.wheelSpin += (this.getForwardSpeed(velocity, bodyFrame) * deltaSeconds) / radius;
    const localYaw = steeringAngle;

    for (let i = 0; i < this.wheels.length; i += 1) {
      const wheel = this.wheels[i];
      const pivot = this.wheelPivots[i];
      const wheelYaw = this.steerWheelIndices.has(i) ? localYaw : 0;

      wheel.rotation.x = this.wheelSpin;

      if (pivot) {
        pivot.rotation.y = wheelYaw;
        wheel.rotation.y = 0;
      } else {
        wheel.rotation.y = wheelYaw;
      }
    }
  }

  getForwardSpeed(velocity = null, bodyFrame = null) {
    if (!velocity || !bodyFrame?.forward) return 0;
    return this.forwardVelocity.copy(velocity).dot(bodyFrame.forward);
  }
}
