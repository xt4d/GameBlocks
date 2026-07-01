import * as THREE from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { DEFAULT_PRNG } from '../../math/RandomUtils.js';
import { disposeObject3D } from '../Object3DUtils.js';
import { createTerrainMesh, createTerrainTrimeshCollider } from './TerrainMeshFactory.js';
import { NaturalTerrainSampler } from './TerrainSampler.js';
import { SpawnAreaSampler } from './SpawnAreaSampler.js';
import {
  createGrassBladeVisual,
  createGrassMaterial,
  createTreeMaterials,
  createTreeVisual,
} from '../object/factory/PlantVisualFactory.js';
import {
  createRockMaterial,
  createGroundRockVisual,
} from '../object/factory/RockVisualFactory.js';

export class NaturalEnvironment {
  constructor({
    scene,
    terrainSize = 180,
    terrainSegments = 128,
    baseHeight = 0,
    undulation = 3.6,
    hillFrequency = 1,
    terrainSampler = null,
    treeCount = 155,
    rockCount = 36,
    grassBladeCount = 260,
    propSpawnRegions = [],
    propBlockRegions = [],
    renderOrder = 0,
    prng = DEFAULT_PRNG,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    const resolvedTerrainSampler = terrainSampler ?? new NaturalTerrainSampler({
      baseHeight,
      undulation,
      hillFrequency,
      basis,
    });

    this.placementBounds = {
      rightMin: -0.48 * terrainSize, rightMax: 0.48 * terrainSize, forwardMin: -0.48 * terrainSize, forwardMax: 0.48 * terrainSize
    };

    this.scene = scene;
    this.basis = basis;
    this.prng = prng;
    this.terrainSize = terrainSize;
    this.terrainSegments = terrainSegments;
    this.terrainSampler = resolvedTerrainSampler;
    this.treeCount = treeCount;
    this.rockCount = rockCount;
    this.grassBladeCount = grassBladeCount;
    this.propSpawnAreaSampler = new SpawnAreaSampler({
      bounds: this.placementBounds,
      spawnRegions: propSpawnRegions,
      blockRegions: propBlockRegions,
    });
    this.renderOrder = renderOrder;
    this.group = new THREE.Group();
    this.group.name = 'NaturalEnvironment';
    this.group.renderOrder = this.renderOrder;
    this.terrainMesh = null;
    this.trees = [];
    this.rocks = [];
    this.planarScratch = { right: 0, forward: 0 };
    this.propBasisQuaternion = this.basis.threeObjectCanonicalToBasisQuaternion(new THREE.Quaternion());

    this.physicsWorld = null;
    this.rapier = null;
    this.physicsColliders = [];
  }

  create() {
    this.createTerrain();
    this.createForest();
    this.scene.add(this.group);
    return this;
  }

  terrainHeightAt(position) {
    const p = this.basis.toPlanar(position, this.planarScratch);
    return this.terrainHeightAtPlanar(p.right, p.forward);
  }

  terrainHeightAtPlanar(right, forward) {
    return this.terrainSampler.sample(right, forward)?.height ?? 0;
  }

  placeOnGround(object, rightValue, forwardValue, extraHeight = 0) {
    const position = this.basis.fromBasisComponents(rightValue, 0, forwardValue);
    this.basis.setHeight(position, this.terrainHeightAt(position) + extraHeight);
    object.position.copy(position);
    return position;
  }

  applyRenderOrder(object) {
    object.traverse((node) => {
      node.renderOrder = this.renderOrder;
    });
    return object;
  }

  samplePropPlanarPoint(radius = 0) {
    return this.propSpawnAreaSampler.sample(this.prng, radius);
  }

  orientPropVisual(object) {
    object.quaternion.premultiply(this.propBasisQuaternion);
    return object;
  }

  createTerrain() {
    const mesh = createTerrainMesh({
      terrainSampler: this.terrainSampler,
      size: this.terrainSize,
      segments: this.terrainSegments,
      materialOptions: {
        roughness: 0.9,
        metalness: 0.02,
      },
    });
    this.applyRenderOrder(mesh);
    this.group.add(mesh);
    this.terrainMesh = mesh;
  }

  createForest() {
    if (this.treeCount > 0) this.createTrees(createTreeMaterials({}));
    if (this.rockCount > 0) this.createRocks(createRockMaterial());
    if (this.grassBladeCount > 0) this.createGrass(createGrassMaterial());
  }

  createTrees(materials) {
    for (let i = 0; i < this.treeCount; i += 1) {
      const height = this.prng.uniform(5, 10.5);
      const radius = this.prng.uniform(0.24, 0.55);
      const colliderRadius = radius + 0.35;
      const point = this.samplePropPlanarPoint(colliderRadius);
      if (!point) continue;

      const tree = createTreeVisual({ height, radius, materials, prng: this.prng });
      tree.rotation.y = this.prng.uniform(0, Math.PI * 2);
      tree.rotation.x = this.prng.uniform(-0.025, 0.025);
      tree.rotation.z = this.prng.uniform(-0.035, 0.035);
      this.orientPropVisual(tree);
      this.placeOnGround(tree, point.right, point.forward);
      this.applyRenderOrder(tree);
      this.group.add(tree);
      this.trees.push({visual: tree, radius: colliderRadius, height});
    }
  }

  createRocks(material) {
    for (let i = 0; i < this.rockCount; i += 1) {
      const radius = 1.2;
      const point = this.samplePropPlanarPoint(radius);
      if (!point) continue;

      const rock = createGroundRockVisual({ material, prng: this.prng });
      this.orientPropVisual(rock);
      this.placeOnGround(rock, point.right, point.forward, 0.35);
      this.applyRenderOrder(rock);
      this.group.add(rock);
      this.rocks.push({visual: rock, radius});
    }
  }

  createGrass(material) {
    for (let i = 0; i < this.grassBladeCount; i += 1) {
      const point = this.samplePropPlanarPoint(0.1);
      if (!point) continue;

      const blade = createGrassBladeVisual({ material, prng: this.prng });
      this.orientPropVisual(blade);
      this.placeOnGround(blade, point.right, point.forward, 0.25);
      this.applyRenderOrder(blade);
      this.group.add(blade);
    }
  }

  createTreeColliders(world, rapier) {
    const rotation = this.basis.threeObjectCanonicalToBasisQuaternion();
    const rotationDesc = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    const center = new THREE.Vector3();
    const entries = [];

    for (let index = 0; index < this.trees.length; index += 1) {
      const { radius, height, visual } = this.trees[index];
      center.copy(visual.position);
      this.basis.addHeight(center, height * 0.5);
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z).setRotation(rotationDesc)
      );
      const collider = world.createCollider(
        rapier.ColliderDesc.cylinder(height * 0.5, radius).setFriction(1).setRestitution(0),
        body
      );
      entries.push({ body, collider });
    }

    return entries;
  }

  createRockColliders(world, rapier) {
    const rotation = this.basis.threeObjectCanonicalToBasisQuaternion();
    const rotationDesc = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    const entries = [];

    for (let index = 0; index < this.rocks.length; index += 1) {
      const { radius, visual } = this.rocks[index];
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(visual.position.x, visual.position.y, visual.position.z).setRotation(rotationDesc)
      );
      const collider = world.createCollider(
        rapier.ColliderDesc.ball(radius).setFriction(1).setRestitution(0),
        body
      );
      entries.push({ body, collider });
    }

    return entries;
  }

  createPhysicsColliders(world, rapier) {
    this.disposePhysicsColliders();
    this.physicsWorld = world;
    this.rapier = rapier;
    this.physicsColliders = [];

    const terrainEntry = createTerrainTrimeshCollider(world, rapier, this.terrainMesh, 1.2, 0);
    this.physicsColliders.push({
      body: terrainEntry.body,
      collider: terrainEntry.collider
    });

    this.physicsColliders.push(
      ...this.createTreeColliders(world, rapier),
      ...this.createRockColliders(world, rapier)
    );

    world.updateSceneQueries();
    return this.physicsColliders;
  }

  disposePhysicsColliders() {
    if (this.physicsWorld) {
      for (const entry of this.physicsColliders) {
        this.physicsWorld.removeRigidBody(entry.body);
      }
      this.physicsWorld.updateSceneQueries();
    }
    this.physicsColliders = [];
    this.physicsWorld = null;
    this.rapier = null;
  }

  dispose() {
    this.disposePhysicsColliders();
    disposeObject3D(this.group);
    this.terrainMesh = null;
    this.trees.length = 0;
    this.rocks.length = 0;
  }
}
