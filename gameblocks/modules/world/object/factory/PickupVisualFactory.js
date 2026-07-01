import * as THREE from 'three';

function createMaterial(color, emissiveIntensity = 0.2) {
  const base = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: base,
    emissive: base.clone().multiplyScalar(0.2),
    emissiveIntensity,
    metalness: 0.25,
    roughness: 0.4,
  });
}

export function buildAmmoPickupVisual(color = null, accentColor = null) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.8, 0.9),
    createMaterial(color ?? 0x4b7b51)
  );
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.2, 0.92),
    createMaterial(accentColor ?? 0xd9e56a, 0.35)
  );
  belt.position.y = 0.16;
  group.add(body, belt);
  return { mesh: group, radius: 0.85 };
}

export function buildHealthPickupVisual(color = null, crossColor = null) {
  const size = 0.75;
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    createMaterial(color ?? 0xaa1f24)
  );
  const thick = size * 0.2;
  const vertical = new THREE.Mesh(
    new THREE.BoxGeometry(thick, size * 0.75, size * 1.01),
    createMaterial(crossColor ?? 0xffffff, 0.5)
  );
  const horizontal = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.75, thick, size * 1.01),
    createMaterial(crossColor ?? 0xffffff, 0.5)
  );
  vertical.position.z = size * 0.51;
  horizontal.position.z = size * 0.51;
  group.add(body, vertical, horizontal);
  return { mesh: group, radius: 0.8 };
}

export function buildArmorPickupVisual(color = null, ringColor = null) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 1.0, 10),
    createMaterial(color ?? 0x2d66ff, 0.4)
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.05, 12, 24),
    createMaterial(ringColor ?? 0x77a3ff, 0.6)
  );
  ring.rotation.x = Math.PI * 0.5;
  group.add(core, ring);
  return { mesh: group, radius: 0.82 };
}

export function createPickupVisual({
  type,
  color = null,
  accentColor = null,
  crossColor = null,
  ringColor = null,
}) {
  if (type === 'ammo') return buildAmmoPickupVisual(color, accentColor);
  if (type === 'health') return buildHealthPickupVisual(color, crossColor);
  return buildArmorPickupVisual(color, ringColor);
}
