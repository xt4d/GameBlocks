import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { DEFAULT_PRNG } from '../../math/RandomUtils.js';
import { clamp, smoothingAlpha } from '../../math/ScalarUtils.js';
import { disposeObject3D } from '../Object3DUtils.js';

function createWeaponLocalMesh() {
  const group = new Group();
  const bodyMat = new MeshBasicMaterial({
    color: 0x232a35,
    depthTest: false,
    depthWrite: false,
  });
  const accentMat = new MeshBasicMaterial({
    color: 0x8ea8c6,
    depthTest: false,
    depthWrite: false,
  });

  const body = new Mesh(new BoxGeometry(0.16, 0.12, 0.42), bodyMat);
  const slide = new Mesh(new BoxGeometry(0.12, 0.06, 0.24), accentMat);
  slide.position.set(0, 0.07, 0.05);

  // The mesh is authored in viewmodel-local space, where +Z is backward.
  const barrel = new Mesh(new CylinderGeometry(0.022, 0.022, 0.28, 12), accentMat);
  barrel.rotation.x = Math.PI * 0.5;
  barrel.position.set(0, -0.015, 0.22);

  group.add(body, slide, barrel);
  group.renderOrder = 9999;
  group.traverse((node) => {
    if (!node.isMesh) return;
    node.renderOrder = 9999;
  });
  return group;
}

// Viewmodel is authored in ThreeJS camera-local space: +X right, +Y up, and -Z forward.
export class FpsWeaponViewModel {
  constructor({
    normalOffset = new Vector3(0.25, -0.4, -0.25),
    scopedOffset = new Vector3(0.0, -0.21, -0.2),
    crouchedOffset = new Vector3(0.3, -0.55, -0.35),
    offsetLag = 0.10,
    sprintYaw = 1.25,
    sprintLag = 0.5,
    recoilRecoveryLag = 0.08,
    recoilKickRecoveryLag = 0.06,
    maxRecoilPitch = 0.15,
    maxRecoilYaw = 0.03,
    prng = DEFAULT_PRNG
  }) {
    this.group = createWeaponLocalMesh();

    this.normalOffset = normalOffset.clone();
    this.scopedOffset = scopedOffset.clone();
    this.crouchedOffset = crouchedOffset.clone();
    this.offsetLag = offsetLag;
    this.sprintYaw = sprintYaw;
    this.sprintLag = sprintLag;
    this.recoilRecoveryLag = recoilRecoveryLag;
    this.recoilKickRecoveryLag = recoilKickRecoveryLag;
    this.maxRecoilPitch = maxRecoilPitch;
    this.maxRecoilYaw = maxRecoilYaw;
    this.prng = prng;

    this.state = {
      moving: false,
      sprinting: false,
      crouching: false,
      scoping: false,
      onGround: true,
    };

    this.currentOffset = this.normalOffset.clone();
    this.currentSprintYaw = 0;
    this.recoil = { pitch: 0, yaw: 0, kick: 0 };

    this._tmpEuler = new Euler();
    this._tmpQuatBase = new Quaternion();
    this._tmpQuatOffset = new Quaternion();
    this._tmpPos = new Vector3();
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  setState(
    moving = this.state.moving,
    sprinting = this.state.sprinting,
    crouching = this.state.crouching,
    scoping = this.state.scoping,
    onGround = this.state.onGround
  ) {
    this.state.moving = moving;
    this.state.sprinting = sprinting;
    this.state.crouching = crouching;
    this.state.scoping = scoping;
    this.state.onGround = onGround;
  }

  kick(pitch = 0.03, yawJitter = 0.01, kickback = 0.035) {
    this.recoil.pitch = clamp(this.recoil.pitch + pitch, 0, this.maxRecoilPitch);
    const yawDelta = (this.prng.random() - 0.5) * yawJitter * 2;
    this.recoil.yaw = clamp(this.recoil.yaw + yawDelta, -this.maxRecoilYaw, this.maxRecoilYaw);
    this.recoil.kick += kickback;
  }

  _computeTargetOffset() {
    if (this.state.scoping) return this.scopedOffset;
    if (this.state.crouching) return this.crouchedOffset;
    return this.normalOffset;
  }

  _recoverRecoil(deltaSeconds) {
    const recoilLerp = smoothingAlpha(this.recoilRecoveryLag, deltaSeconds);
    const kickLerp = smoothingAlpha(this.recoilKickRecoveryLag, deltaSeconds);
    this.recoil.pitch = MathUtils.lerp(this.recoil.pitch, 0, recoilLerp);
    this.recoil.yaw = MathUtils.lerp(this.recoil.yaw, 0, recoilLerp);
    this.recoil.kick = MathUtils.lerp(this.recoil.kick, 0, kickLerp);
  }

  step(camera, deltaSeconds = 1 / 60) {
    const targetOffset = this._computeTargetOffset();
    this.currentOffset.lerp(targetOffset, smoothingAlpha(this.offsetLag, deltaSeconds));

    const sprintTarget =
      this.state.sprinting && this.state.onGround && !this.state.scoping ? this.sprintYaw : 0;
    this.currentSprintYaw = MathUtils.lerp(
      this.currentSprintYaw,
      sprintTarget,
      smoothingAlpha(this.sprintLag, deltaSeconds)
    );

    this._recoverRecoil(deltaSeconds);

    const offsetX = this.currentOffset.x;
    const offsetY = this.currentOffset.y;
    const offsetZ = this.currentOffset.z - this.recoil.kick;

    // Convert the camera-local offset into world space.
    // Local +Z points backward for THREE.Camera, so forward/back offset uses -offsetZ.
    this._tmpPos
      .set(offsetX, offsetY, -offsetZ)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);

    // Recoil and sprint roll are local viewmodel rotations applied after the
    // camera orientation, not world-basis rotations.
    this._tmpEuler.set(-this.recoil.pitch, this.currentSprintYaw - this.recoil.yaw, 0, 'XYZ');
    this._tmpQuatOffset.setFromEuler(this._tmpEuler);
    const finalQuat = this._tmpQuatBase.copy(camera.quaternion).multiply(this._tmpQuatOffset);

    this.group.position.copy(this._tmpPos);
    this.group.quaternion.copy(finalQuat);

    return {
      position: { x: this._tmpPos.x, y: this._tmpPos.y, z: this._tmpPos.z },
      quaternion: {
        x: finalQuat.x,
        y: finalQuat.y,
        z: finalQuat.z,
        w: finalQuat.w,
      },
      recoil: { ...this.recoil },
      sprintYaw: this.currentSprintYaw,
    };
  }

  dispose() {
    disposeObject3D(this.group);
  }
}
