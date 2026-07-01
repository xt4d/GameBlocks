import * as THREE from 'three';
import { clamp } from '../../../math/ScalarUtils.js';

const LOCAL_CONE_FORWARD = new THREE.Vector3(0, 1, 0);
const LOCAL_CYLINDER_FORWARD = new THREE.Vector3(0, 1, 0);

function setCylinderBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  const midpoint = start.clone().addScaledVector(delta, 0.5);
  mesh.position.copy(midpoint);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(LOCAL_CYLINDER_FORWARD, delta.normalize());
}

export function createBulletProjectileVisual() {
  const group = new THREE.Group();
  group.name = 'ProjectileObject.bullet';

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xfff3a1,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    })
  );
  mesh.renderOrder = 7;
  group.add(mesh);

  return {
    group,
    mesh,
    step({ position, ageSeconds, lifetimeSeconds }) {
      mesh.position.copy(position);
      const fade = clamp(1 - ageSeconds / lifetimeSeconds, 0, 1);
      mesh.material.opacity = 0.95 * fade;
    },
  };
}

export function createMissileProjectileVisual() {
  const group = new THREE.Group();
  group.name = 'ProjectileObject.missile';

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(2.8, 13, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf4f7ff,
      emissive: 0xff7b35,
      emissiveIntensity: 1.2,
      metalness: 0.35,
      roughness: 0.28,
    })
  );
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 14, 10),
    new THREE.MeshBasicMaterial({
      color: 0xff9f2f,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 0.55, 1, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffd28a,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
  );

  mesh.renderOrder = 7;
  flame.renderOrder = 7;
  trail.renderOrder = 5;
  group.add(trail, mesh, flame);

  return {
    group,
    mesh,
    flame,
    trail,
    step({ position, direction, ageSeconds }) {
      mesh.position.copy(position);
      mesh.quaternion.setFromUnitVectors(LOCAL_CONE_FORWARD, direction);
      flame.position.copy(position).addScaledVector(direction, -7.5);
      setCylinderBetween(
        trail,
        position.clone().addScaledVector(direction, -84),
        position.clone().addScaledVector(direction, -9)
      );

      const flicker = 0.78 + Math.sin(ageSeconds * 60) * 0.18;
      flame.material.opacity = flicker;
      flame.scale.setScalar(0.9 + flicker * 0.22);
    },
  };
}
