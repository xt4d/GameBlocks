import * as THREE from 'three';
import { DEFAULT_PRNG } from '../../../math/RandomUtils.js';

export function createRockMaterial(color = 0x7b827a) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.96 });
}

export function createGroundRockVisual({
  material = createRockMaterial(),
  prng = DEFAULT_PRNG,
}) {

  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(prng.uniform(0.7, 2.0), 0), material);
  rock.name = 'GroundRock';
  rock.scale.y = prng.uniform(0.35, 0.8);
  rock.rotation.set(prng.random() * Math.PI, prng.random() * Math.PI, prng.random() * Math.PI);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

function vertexKey(vertex) {
  return [
    Math.round(vertex.x * 10000),
    Math.round(vertex.y * 10000),
    Math.round(vertex.z * 10000),
  ].join(',');
}

function applySeamSafeIrregularity(geometry, prng, irregularity) {
  const position = geometry.getAttribute('position');
  const vertex = new THREE.Vector3();
  const scaleByVertex = new Map();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const key = vertexKey(vertex);
    let scale = scaleByVertex.get(key);

    if (scale === undefined) {
      scale = prng.uniform(1 - irregularity, 1 + irregularity);
      scaleByVertex.set(key, scale);
    }

    vertex.multiplyScalar(scale);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  geometry.computeBoundingSphere();
}

export function createIrregularRockVisual({
  radius = 1,
  color = 0x8e95a3,
  detail = 1,
  irregularity = 0.16,
  scaleVariance = 0.12,
  roughness = 0.9,
  metalness = 0.05,
  castShadow = true,
  receiveShadow = true,
  prng = DEFAULT_PRNG,
}) {
  const safeRadius = Math.max(0.05, radius);
  const geometry = new THREE.IcosahedronGeometry(safeRadius, detail);
  applySeamSafeIrregularity(geometry, prng, irregularity);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'IrregularRock';
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.scale.set(
    prng.uniform(1 - scaleVariance, 1 + scaleVariance),
    prng.uniform(1 - scaleVariance, 1 + scaleVariance),
    prng.uniform(1 - scaleVariance, 1 + scaleVariance)
  );

  return {
    mesh,
    radius: safeRadius,
  };
}
