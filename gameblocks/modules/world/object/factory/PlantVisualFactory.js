import * as THREE from 'three';
import { DEFAULT_PRNG } from '../../../math/RandomUtils.js';

export function createTreeMaterials({
  trunkColor = 0x6d472b,
  barkShadowColor = 0x3f281b,
  leafColors = [
    { color: 0x245d3a, roughness: 0.86 },
    { color: 0x3f783f, roughness: 0.84 },
    { color: 0x6e8f3a, roughness: 0.86 },
    { color: 0x8fa65a, roughness: 0.88 },
  ],
}) {
  return {
    trunk: new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.86, flatShading: true }),
    barkShadow: new THREE.MeshStandardMaterial({ color: barkShadowColor, roughness: 0.92, flatShading: true }),
    leaves: leafColors.map((entry) => {
      const color = typeof entry === 'number' ? entry : entry.color;
      const roughness = typeof entry === 'number' ? 0.86 : entry.roughness;
      return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
    }),
  };
}

export function createTreeVisual({
  height,
  radius,
  materials = createTreeMaterials(),
  prng = DEFAULT_PRNG,
}) {
  if (!prng) throw new Error('createTreeVisual requires a PRNG');

  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 1.03, height, 9, 3),
    materials.trunk
  );
  trunk.position.y = height * 0.5;
  tree.add(trunk);

  const rootFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.35, radius * 1.7, Math.max(0.18, radius * 0.52), 9),
    materials.barkShadow
  );
  rootFlare.position.y = Math.max(0.09, radius * 0.26);
  tree.add(rootFlare);

  if (prng.random() < 0.52) {
    const branchCount = prng.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < branchCount; i += 1) {
      tree.add(createBranchStub(height, radius, prng, materials.barkShadow));
    }
  }

  if (prng.random() < 0.74) {
    addConiferCanopy(tree, height, prng, materials.leaves);
  } else {
    addBroadleafCanopy(tree, height, prng, materials.leaves);
  }

  tree.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return tree;
}

export function createGrassMaterial(color = 0xa2b86a) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
}

export function createGrassBladeVisual({
  material = createGrassMaterial(),
  prng = DEFAULT_PRNG,
}) {

  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.08, prng.uniform(0.45, 1.2), 4), material);
  blade.rotation.y = prng.uniform(0, Math.PI * 2);
  return blade;
}

function createBranchStub(height, radius, prng, material) {
  const length = prng.uniform(0.48, 0.88);
  const branch = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.13, radius * 0.2, length, 7),
    material
  );
  const angle = prng.uniform(0, Math.PI * 2);
  const sideLean = prng.uniform(0.74, 0.98);
  const direction = new THREE.Vector3(
    Math.cos(angle) * sideLean,
    prng.uniform(0.22, 0.42),
    Math.sin(angle) * sideLean
  ).normalize();
  branch.position.set(
    direction.x * length * 0.34,
    height * prng.uniform(0.48, 0.68),
    direction.z * length * 0.34
  );
  branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return branch;
}

function addConiferCanopy(tree, height, prng, leafMaterials) {
  const baseRadius = prng.uniform(1.85, 3.3) * THREE.MathUtils.clamp(height / 7.6, 0.82, 1.18);
  const layers = [
    { y: height * 0.68, radius: baseRadius, height: height * prng.uniform(0.44, 0.56) },
    { y: height * 0.88, radius: baseRadius * prng.uniform(0.72, 0.84), height: height * prng.uniform(0.36, 0.48) },
    { y: height * 1.06, radius: baseRadius * prng.uniform(0.48, 0.62), height: height * prng.uniform(0.28, 0.38) },
  ];

  for (const layer of layers) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(layer.radius, layer.height, 9, 1, true),
      prng.choice(leafMaterials)
    );
    crown.position.y = layer.y;
    crown.rotation.y = prng.uniform(0, Math.PI * 2);
    crown.scale.set(prng.uniform(0.88, 1.12), 1, prng.uniform(0.88, 1.12));
    tree.add(crown);
  }
}

function addBroadleafCanopy(tree, height, prng, leafMaterials) {
  const crownSize = prng.uniform(1.25, 2.0) * THREE.MathUtils.clamp(height / 7.2, 0.85, 1.25);
  const clusters = [
    { x: 0, y: height * 0.93, z: 0, scale: 1.25 },
    { x: -crownSize * 0.45, y: height * 0.82, z: crownSize * 0.12, scale: 0.86 },
    { x: crownSize * 0.42, y: height * 0.84, z: -crownSize * 0.18, scale: 0.8 },
    { x: crownSize * 0.06, y: height * 1.08, z: -crownSize * 0.05, scale: 0.72 },
  ];

  for (const cluster of clusters) {
    const crown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(crownSize * cluster.scale, 0),
      prng.choice(leafMaterials)
    );
    crown.position.set(cluster.x, cluster.y, cluster.z);
    crown.rotation.set(
      prng.uniform(-0.2, 0.2),
      prng.uniform(0, Math.PI * 2),
      prng.uniform(-0.2, 0.2)
    );
    crown.scale.set(
      prng.uniform(0.95, 1.18),
      prng.uniform(0.78, 1.08),
      prng.uniform(0.92, 1.18)
    );
    tree.add(crown);
  }
}
