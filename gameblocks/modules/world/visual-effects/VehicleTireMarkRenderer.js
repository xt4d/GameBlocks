import * as THREE from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { disposeObject3D } from '../Object3DUtils.js';

export class VehicleTireMarkRenderer {
  constructor({
    terrainSampler,
    maxSegments = 1200,
    minDistance = 0.16,
    width = 0.18,
    lift = 0.026,
    halfTrack = 0.84,
    frontForwardOffset = 1.07,
    rearForwardOffset = -1.07,
    frontColor = 0x161719,
    rearColor = 0x8d2119,
    frontOpacity = 0.42,
    rearOpacity = 0.58,
    minSpeed = 0.6,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.group = new THREE.Group();
    this.group.name = 'VehicleTireMarkRenderer';
    this.basis = basis;
    this.terrainSampler = terrainSampler;
    this.maxSegments = Math.max(1, Math.floor(maxSegments));
    this.minDistance = minDistance;
    this.width = width;
    this.lift = lift;
    this.halfTrack = halfTrack;
    this.frontForwardOffset = frontForwardOffset;
    this.rearForwardOffset = rearForwardOffset;
    this.minSpeed = minSpeed;
    this.front = this.createTrack(frontColor, frontOpacity);
    this.rear = this.createTrack(rearColor, rearOpacity);
  }

  get frontSegments() {
    return this.front.segmentCount;
  }

  get rearSegments() {
    return this.rear.segmentCount;
  }

  get totalSegments() {
    return this.frontSegments + this.rearSegments;
  }

  setTerrainSampler(terrainSampler) {
    this.terrainSampler = terrainSampler;
  }

  createTrack(color, opacity) {
    const geometry = new THREE.BufferGeometry();
    const buffer = new Float32Array(this.maxSegments * 18);
    const attribute = new THREE.BufferAttribute(buffer, 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    geometry.setDrawRange(0, 0);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    this.group.add(mesh);

    const track = {
      geometry,
      attribute,
      buffer,
      material,
      mesh,
      vertices: [],
      last: [null, null],
      segmentCount: 0,
    };
    this.refresh(track);
    return track;
  }

  clear() {
    for (const track of [this.front, this.rear]) {
      track.vertices.length = 0;
      track.last[0] = null;
      track.last[1] = null;
      track.segmentCount = 0;
      this.refresh(track);
    }
  }

  resetLast() {
    for (const track of [this.front, this.rear]) {
      track.last[0] = null;
      track.last[1] = null;
    }
  }

  step(vehicleState) {
    if (!vehicleState.grounded || vehicleState.horizontalSpeed < this.minSpeed) {
      this.resetLast();
      return;
    }

    this.stepTrack(vehicleState, this.front, this.frontForwardOffset);
    this.stepTrack(vehicleState, this.rear, this.rearForwardOffset);
  }

  stepTrack(vehicleState, track, forwardOffset) {
    let changed = false;
    const points = [
      this.tirePoint(vehicleState, forwardOffset, -1),
      this.tirePoint(vehicleState, forwardOffset, 1),
    ];

    for (let i = 0; i < points.length; i += 1) {
      if (track.last[i]) changed = this.appendSegment(track, track.last[i], points[i]) || changed;
      track.last[i] = points[i].clone();
    }
    if (changed) this.refresh(track);
  }

  tirePoint(vehicleState, forwardOffset, side) {
    const point = vehicleState.position.clone()
      .addScaledVector(vehicleState.bodyFrame.right, side * this.halfTrack)
      .addScaledVector(vehicleState.bodyFrame.forward, forwardOffset);
    const planar = this.basis.toPlanar(point);
    const up = this.terrainSampler.heightAt(planar.right, planar.forward) + this.lift;
    return this.basis.fromBasisComponents(planar.right, up, planar.forward, point);
  }

  appendSegment(track, from, to) {
    const direction = to.clone().sub(from);
    if (direction.length() < this.minDistance) return false;

    const edge = direction
      .cross(this.basis.upVector())
      .normalize()
      .multiplyScalar(this.width * 0.5);
    const a = from.clone().add(edge);
    const b = from.clone().sub(edge);
    const c = to.clone().sub(edge);
    const d = to.clone().add(edge);

    this.pushPoint(track, a);
    this.pushPoint(track, b);
    this.pushPoint(track, c);
    this.pushPoint(track, a);
    this.pushPoint(track, c);
    this.pushPoint(track, d);
    track.segmentCount += 1;

    while (track.segmentCount > this.maxSegments) {
      track.vertices.splice(0, 18);
      track.segmentCount -= 1;
    }
    return true;
  }

  pushPoint(track, point) {
    track.vertices.push(point.x, point.y, point.z);
  }

  refresh(track) {
    const vertexCount = Math.floor(track.vertices.length / 3);
    track.buffer.set(track.vertices, 0);
    track.attribute.needsUpdate = true;
    track.geometry.setDrawRange(0, vertexCount);
  }

  dispose() {
    this.clear();
    for (const track of [this.front, this.rear]) {
      disposeObject3D(track.mesh);
    }
    this.group.parent?.remove(this.group);
  }
}
