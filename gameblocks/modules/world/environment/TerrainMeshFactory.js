import * as THREE from 'three';
import { terrainBasis } from './PlanarUtils.js';

function ensureWorld(world, rapier) {
  if (!world || !rapier) {
    throw new Error('Terrain collider factory requires both world and rapier');
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function defaultTerrainColor(height = 0, colorNoise = 0) {
  const grassMix = clamp01((height + 4) / 12);
  const ridgeMix = clamp01((height - 8) / 18);
  return {
    r: 0.22 + grassMix * 0.1 + ridgeMix * 0.16 + colorNoise,
    g: 0.32 + grassMix * 0.18 - ridgeMix * 0.02 + colorNoise * 0.6,
    b: 0.16 + grassMix * 0.08 + ridgeMix * 0.09 + colorNoise * 0.35,
  };
}

export function createTerrainMesh({
  terrainSampler,
  size = 184,
  segments = 220,
  materialOptions = {},
}) {
  if (!terrainSampler || typeof terrainSampler.sample !== 'function') {
    throw new Error('createTerrainMesh: terrainSampler.sample(right, forward) is required');
  }

  const basis = terrainBasis(terrainSampler);
  const safeSize = Math.max(0.001, size);
  const safeSegments = Math.max(1, Math.floor(segments));
  const vertexSide = safeSegments + 1;
  const vertexCount = vertexSide * vertexSide;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(safeSegments * safeSegments * 6);
  const halfSize = safeSize * 0.5;
  const step = safeSize / safeSegments;
  const worldPoint = new THREE.Vector3(0, 0, 0);

  for (let row = 0; row <= safeSegments; row += 1) {
    for (let col = 0; col <= safeSegments; col += 1) {
      const i = row * vertexSide + col;
      const right = -halfSize + col * step;
      const forward = -halfSize + row * step;
      const sample = terrainSampler.sample(right, forward) ?? { height: 0 };
      const height = sample.height;
      basis.fromBasisComponents(right, height, forward, worldPoint);
      positions[i * 3 + 0] = worldPoint.x;
      positions[i * 3 + 1] = worldPoint.y;
      positions[i * 3 + 2] = worldPoint.z;

      let colorValue = sample.color;
      if (!colorValue) {
        const colorNoise = typeof terrainSampler.noise2D === 'function'
          ? terrainSampler.noise2D(right * 0.21 + 13, forward * 0.21 - 5, 103) * 0.08
          : 0;
        colorValue = defaultTerrainColor(height, colorNoise);
      }

      colors[i * 3 + 0] = colorValue.r;
      colors[i * 3 + 1] = colorValue.g;
      colors[i * 3 + 2] = colorValue.b;
    }
  }

  let index = 0;
  for (let row = 0; row < safeSegments; row += 1) {
    for (let col = 0; col < safeSegments; col += 1) {
      const a = row * vertexSide + col;
      const b = a + 1;
      const c = (row + 1) * vertexSide + col;
      const d = c + 1;
      indices[index] = a; index += 1;
      indices[index] = b; index += 1;
      indices[index] = d; index += 1;
      indices[index] = a; index += 1;
      indices[index] = d; index += 1;
      indices[index] = c; index += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.04,
    ...materialOptions,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrainTrimeshCollider(
  world,
  rapier,
  mesh,
  friction = 1.2,
  restitution = 0,
) {
  ensureWorld(world, rapier);
  if (!mesh?.geometry) {
    throw new Error('createTerrainTrimeshCollider: mesh.geometry is required');
  }

  const positionAttr = mesh.geometry.getAttribute?.('position');
  const indexAttr = mesh.geometry.getIndex?.();

  if (!positionAttr || !indexAttr) {
    throw new Error('createTerrainTrimeshCollider: indexed terrain geometry is required');
  }

  const vertices = new Float32Array(positionAttr.array);
  const indices = new Uint32Array(indexAttr.array);
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());

  const collider = world.createCollider(
    rapier.ColliderDesc.trimesh(vertices, indices)
      .setFriction(friction)
      .setRestitution(restitution),
    body
  );

  return { body, collider };
}
