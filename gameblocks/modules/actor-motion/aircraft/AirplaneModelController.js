import { Matrix4 } from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

export class AirplaneModelController {
  constructor(planeModel = null, jetFlames = [], basis = DEFAULT_WORLD_BASIS) {
    this.planeModel = planeModel;
    this.jetFlames = jetFlames;
    this.basis = basis;

    this.modelMatrix = new Matrix4();
  }

  reset() {
    if (!this.planeModel) return;
    this.planeModel.position.set(0, 0, 0);
    this.planeModel.quaternion.identity();
  }

  step({
    position,
    yaw,
    pitch,
    roll,
    throttle,
    isBoosting,
    elapsedTimeSeconds,
    deltaSeconds = 1 / 60
  }) {
    if (!this.planeModel) return;

    this.planeModel.position.set(position.x, position.y, position.z);

    const frame = this.basis.yawPitchRollFrame(yaw, pitch, roll);
    this.modelMatrix.makeBasis(frame.right, frame.up, frame.back ?? frame.forward.clone().negate());
    this.planeModel.quaternion.setFromRotationMatrix(this.modelMatrix);

    for (const flame of this.jetFlames) {
      flame.step({
        throttle,
        isBoosting,
        timeSeconds: elapsedTimeSeconds,
        deltaSeconds
      });
    }
  }
}
