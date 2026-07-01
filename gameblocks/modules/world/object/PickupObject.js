import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { disposeObject3D } from '../Object3DUtils.js';

export class PickupObject {
  constructor({
    id = null,
    type = null,
    pickupVisual,
    position,
    floorUp = 0,
    scale = 1,
    basis = DEFAULT_WORLD_BASIS
  }) {
    if (!position) throw new Error('PickupObject: position is required');

    this.id = id;
    this.type = type;
    this.basis = basis;
    this.up = this.basis.upVector();

    this.group = pickupVisual.mesh;
    this.group.position.copy(position);
    this.basis.setHeight(this.group.position, floorUp + 0.5);
    this.group.scale.setScalar(scale);

    this.position = this.group.position;
    this.radius = pickupVisual.radius * scale;
    this.phase = 0;
    this.baseHeight = this.basis.upComponent(this.group.position);
  }

  animate(deltaSeconds, bobSpeed = 3.2, bobHeight = 0.12, spinSpeed = 1.8) {
    this.phase += Math.max(0, deltaSeconds) * bobSpeed;
    this.basis.setHeight(
      this.group.position,
      this.baseHeight + Math.sin(this.phase) * bobHeight
    );
    this.group.rotateOnWorldAxis(this.up, Math.max(0, deltaSeconds) * spinSpeed);
  }

  dispose() {
    disposeObject3D(this.group);
  }
}
