import * as THREE from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { disposeObject3D } from '../Object3DUtils.js';

export class GroundClickIndicator {
  constructor({
    position,
    durationMs = 420,
    color = 0x76f0c9,
    accentColor = 0xbaf8ec,
    startScale = 0.42,
    endScale = 1.4,
    startUpOffset = 0.06,
    endUpOffset = 0.1,
    ringLocalNormalOffset = 0.01,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.kind = 'command';
    this.basis = basis;
    this.remainingMs = durationMs;
    this.maxMs = durationMs;
    this.startScale = startScale;
    this.endScale = endScale;
    this.startUpOffset = startUpOffset;
    this.endUpOffset = endUpOffset;

    const planar = this.basis.toPlanar(position);
    this.group = new THREE.Group();
    this.group.position.copy(this.basis.fromBasisComponents(
      planar.right,
      startUpOffset,
      planar.forward
    ));
    this.group.quaternion.copy(this.basis.threePlaneCanonicalToBasisQuaternion());
    this.group.scale.setScalar(startScale);

    this.diskMaterial = this._createMaterial(color, 0.28);
    this.disk = new THREE.Mesh(
      new THREE.CircleGeometry(1.02, 40),
      this.diskMaterial
    );
    this.group.add(this.disk);

    this.ringMaterial = this._createMaterial(accentColor, 0.96);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.18, 48),
      this.ringMaterial
    );
    this.ring.position.z = ringLocalNormalOffset;
    this.group.add(this.ring);

    this.materials = [this.diskMaterial, this.ringMaterial];
  }

  _createMaterial(color, baseOpacity) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    material.userData.baseOpacity = baseOpacity;
    return material;
  }

  step(deltaSeconds = 1 / 60) {
    this.remainingMs -= deltaSeconds * 1000;
    const ratio = Math.max(0, this.remainingMs / this.maxMs);
    const progress = 1 - ratio;

    this.materials.forEach((material) => {
      material.opacity = ratio * (material.userData.baseOpacity ?? 1);
    });

    this.group.scale.setScalar(
      this.startScale + (this.endScale - this.startScale) * progress
    );
    this.basis.setHeight(
      this.group.position,
      this.startUpOffset + (this.endUpOffset - this.startUpOffset) * progress
    );

    return this.remainingMs > 0;
  }

  dispose() {
    disposeObject3D(this.group);
  }
}
