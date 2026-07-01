import { Matrix4, Vector3 } from 'three';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

export class GeneralObjectModelController {
  constructor({
    model = null,
    localForward = '-z',
    basis = DEFAULT_WORLD_BASIS,
    keepBasisUp = false,
  }) {
    this.model = model;
    this.basis = basis;
    this.localForwardSign = localForward === '+z' ? 1 : -1;
    this.keepBasisUp = keepBasisUp;

    this.modelMatrix = new Matrix4();
    this.xAxis = new Vector3();
    this.yAxis = new Vector3();
    this.zAxis = new Vector3();
    this.right = this.xAxis;
    this.up = this.yAxis;
    this.forward = this.zAxis;
  }

  reset(position = null) {
    if (!this.model) return this.model;

    if (position) this.model.position.copy(position);
    this.model.quaternion.identity();
    return this.model;
  }

  step(position, objectFrame = null) {
    if (!this.model) return this.model;

    if (position) this.model.position.copy(position);
    if (objectFrame) this.updateObjectFrame(objectFrame);

    return this.model;
  }

  updateObjectFrame(objectFrame) {
    this.zAxis
      .set(objectFrame.forward.x, objectFrame.forward.y, objectFrame.forward.z);

    if (this.keepBasisUp) {
      this.basis.flatten(this.zAxis);
    }

    this.zAxis.normalize().multiplyScalar(this.localForwardSign);

    if (!this.keepBasisUp && objectFrame.right && objectFrame.up) {
      this.xAxis
        .set(objectFrame.right.x, objectFrame.right.y, objectFrame.right.z)
        .normalize()
        .multiplyScalar(-this.localForwardSign);
      this.yAxis
        .set(objectFrame.up.x, objectFrame.up.y, objectFrame.up.z)
        .normalize();
    } else {
      this.basis.upVector(this.yAxis);
      this.xAxis.crossVectors(this.yAxis, this.zAxis).normalize();
    }

    this.modelMatrix.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    this.model.quaternion.setFromRotationMatrix(this.modelMatrix);
  }
}
