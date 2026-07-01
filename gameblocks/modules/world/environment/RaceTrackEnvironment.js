import * as THREE from 'three';
import { clamp } from '../../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import {
  PLANAR_EPS,
  normalizePlanar2D,
  planarCentroid,
  planarTangentAt,
} from './PlanarUtils.js';
import { NaturalEnvironment } from './NaturalEnvironment.js';
import { RoadTerrainSampler } from './TerrainSampler.js';
import { SPAWN_REGION_TYPES } from './SpawnAreaSampler.js';
import { disposeObject3D } from '../Object3DUtils.js';

const SIDE_SIGN = Object.freeze({ outer: 1, inner: -1 });

const DEFAULT_NATURAL_ENVIRONMENT_CONFIG = Object.freeze({
  terrainSize: 180,
  terrainSegments: 128,
  treeCount: 155,
  rockCount: 36,
  grassBladeCount: 260,
  renderOrder: 0,
});

const DEFAULT_ROAD_TERRAIN_SAMPLER_CONFIG = Object.freeze({
  seed: 2026,
  roadHalfWidth: 6,
  roadHeight: 0,
  roadFlatnessAtHalfWidth: 0.8,
  largeWaveScale: 0.05,
  largeWaveAmp: 1.45,
  midNoiseScale: 0.12,
  midNoiseAmp: 1.15,
  normalStep: 0.2,
});

const DEFAULT_CHECKPOINT_RADIUS = 7.5;

const DEFAULT_CHECKPOINT_MARKER_CONFIG = Object.freeze({
  width: 12,
  height: 4,
  postRadius: 0.08,
  postSegments: 12,
  crossbarThickness: 0.08,
  flagWidth: 2,
  flagHeight: 1,
  flagThickness: 0.03,
  upOffset: 0.02,
  colors: Object.freeze({
    post: 0x3a3026,
    crossbar: 0x4a3b2d,
    flagA: 0xf9d66f,
    flagB: 0x2f3e55,
  }),
  materialOptions: Object.freeze({}),
});

const DEFAULT_BARRIER_CONFIG = Object.freeze({
  sideOffset: 7,
  postSpacing: 2.5,
  height: 1.2,
  postRadiusRatio: 0.35,
  postSegments: 10,
  railHeightRatio: 0.72,
  railThicknessRatio: 0.16,
  upOffset: 0.02,
  colors: Object.freeze({
    post: 0xe4edf9,
    rail: 0x76849a,
  }),
  materialOptions: Object.freeze({}),
  friction: 1,
  restitution: 0,
});

function terrainHeight(terrainSampler, point) {
  return terrainSampler.heightAt(point.right, point.forward);
}

function offsetPath(path, closed, offset, sideSign = 1) {
  const center = planarCentroid(path);
  const offsetPoints = [];
  for (let index = 0; index < path.length; index += 1) {
    const point = path[index];
    const tangent = planarTangentAt(path, index, closed, { retryFromCurrent: true });
    const side = { right: tangent.forward, forward: -tangent.right };
    const radial = normalizePlanar2D(point.right - center.right, point.forward - center.forward);
    const outwardSign = side.right * radial.right + side.forward * radial.forward >= 0 ? 1 : -1;
    offsetPoints.push({
      right: point.right + side.right * offset * sideSign * outwardSign,
      forward: point.forward + side.forward * offset * sideSign * outwardSign,
    });
  }
  return offsetPoints;
}

function standardMaterial(color, roughness, materialOptions) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness,
    ...materialOptions,
  });
}

function addShadowMesh(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class RaceTrackEnvironment {
  constructor({
    scene,
    trackPlanarPoints,
    closed = true,
    checkpointRadius = DEFAULT_CHECKPOINT_RADIUS,
    naturalEnvironmentConfig = DEFAULT_NATURAL_ENVIRONMENT_CONFIG,
    roadTerrainSamplerConfig = DEFAULT_ROAD_TERRAIN_SAMPLER_CONFIG,
    roadPropClearance = 1.5,
    checkpointMarkerConfig = DEFAULT_CHECKPOINT_MARKER_CONFIG,
    barrierConfig = DEFAULT_BARRIER_CONFIG,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.scene = scene;
    this.closed = closed;
    this.basis = basis;
    this.group = new THREE.Group();
    this.group.name = 'RaceTrackEnvironment';
    this.trackPlanarPoints = trackPlanarPoints;
    this.roadSegments = [];
    this.checkpoints = [];
    this.roadPropClearance = roadPropClearance;

    this.buildRoadSegments();
    this.naturalEnvironment = this.buildNaturalEnvironment(naturalEnvironmentConfig, roadTerrainSamplerConfig);
    this.terrainSampler = this.naturalEnvironment.terrainSampler;
    this.checkpointMarkers = null;
    this.barriers = null;
    this.checkpointMarkerConfig = checkpointMarkerConfig;
    this.barrierConfig = barrierConfig;
    this.buildCheckpoints(checkpointRadius);

    this.physicsWorld = null;
    this.rapier = null;
    this.physicsColliders = [];
  }

  create() {
    this.naturalEnvironment.create();
    this.createCheckpointMarkers();
    this.createBarriers();
    this.scene.add(this.group);
    return this;
  }

  buildNaturalEnvironment(naturalEnvironmentConfig, roadTerrainSamplerConfig) {
    const terrainSampler = new RoadTerrainSampler({
      ...roadTerrainSamplerConfig,
      roadSegments: this.roadSegments,
      basis: this.basis,
    });
    const propBlockRegions = [];
    if (this.roadPropClearance >= 0) {
      propBlockRegions.push({
        type: SPAWN_REGION_TYPES.SEGMENT_CORRIDOR,
        segments: this.roadSegments,
        halfWidth: terrainSampler.roadHalfWidth,
        clearance: this.roadPropClearance,
      });
    }

    return new NaturalEnvironment({
      ...naturalEnvironmentConfig,
      scene: this.scene,
      basis: this.basis,
      terrainSampler,
      propBlockRegions,
    });
  }

  buildRoadSegments() {
    const count = this.trackPlanarPoints.length;
    this.roadSegments = [];
    const segmentCount = this.closed ? count : count - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      this.roadSegments.push({
        start: this.trackPlanarPoints[i],
        end: this.trackPlanarPoints[(i + 1) % count],
      });
    }
    return this.roadSegments;
  }

  buildCheckpoints(radius) {
    this.checkpoints = [];
    for (let index = 0; index < this.trackPlanarPoints.length; index += 1) {
      const point = this.trackPlanarPoints[index];
      const height = terrainHeight(this.terrainSampler, point);
      const position = this.basis.fromBasisComponents(point.right, height, point.forward);
      this.checkpoints.push({
        id: `cp_${index + 1}`,
        right: point.right,
        forward: point.forward,
        position,
        radius,
      });
    }
    return this.checkpoints;
  }

  createCheckpointMarkers() {
    if (!this.checkpointMarkerConfig) return null;

    const group = new THREE.Group();
    const postMaterial = standardMaterial(
      this.checkpointMarkerConfig.colors.post,
      0.85,
      this.checkpointMarkerConfig.materialOptions
    );
    const crossbarMaterial = standardMaterial(
      this.checkpointMarkerConfig.colors.crossbar,
      0.82,
      this.checkpointMarkerConfig.materialOptions
    );
    const flagMaterialA = standardMaterial(
      this.checkpointMarkerConfig.colors.flagA,
      0.76,
      this.checkpointMarkerConfig.materialOptions
    );
    const flagMaterialB = standardMaterial(
      this.checkpointMarkerConfig.colors.flagB,
      0.76,
      this.checkpointMarkerConfig.materialOptions
    );
    const postGeometry = new THREE.CylinderGeometry(
      this.checkpointMarkerConfig.postRadius,
      this.checkpointMarkerConfig.postRadius,
      this.checkpointMarkerConfig.height,
      this.checkpointMarkerConfig.postSegments
    );
    const crossbarGeometry = new THREE.BoxGeometry(
      this.checkpointMarkerConfig.width + this.checkpointMarkerConfig.postRadius * 2.4,
      this.checkpointMarkerConfig.crossbarThickness,
      this.checkpointMarkerConfig.crossbarThickness
    );
    const flagGeometry = new THREE.BoxGeometry(
      this.checkpointMarkerConfig.flagWidth,
      this.checkpointMarkerConfig.flagHeight,
      this.checkpointMarkerConfig.flagThickness
    );

    for (let index = 0; index < this.checkpoints.length; index += 1) {
      const checkpoint = this.checkpoints[index];
      const prev = this.checkpoints[(index - 1 + this.checkpoints.length) % this.checkpoints.length];
      const next = this.checkpoints[(index + 1) % this.checkpoints.length];
      const tangent = normalizePlanar2D(next.right - prev.right, next.forward - prev.forward);
      const gate = new THREE.Group();
      gate.position.copy(this.basis.fromBasisComponents(
        checkpoint.right,
        terrainHeight(this.terrainSampler, checkpoint) + this.checkpointMarkerConfig.upOffset,
        checkpoint.forward
      ));
      gate.quaternion.setFromRotationMatrix(this.getPlanarTangentFrame(tangent));

      for (const side of [-1, 1]) {
        addShadowMesh(
          gate,
          postGeometry,
          postMaterial,
          side * this.checkpointMarkerConfig.width * 0.5,
          this.checkpointMarkerConfig.height * 0.5,
          0
        );
      }
      addShadowMesh(gate, crossbarGeometry, crossbarMaterial, 0, this.checkpointMarkerConfig.height, 0);

      const flagMaterials = index % 2 === 0
        ? [flagMaterialA, flagMaterialB]
        : [flagMaterialB, flagMaterialA];
      const flagOffsets = [
        -this.checkpointMarkerConfig.width * 0.5 + this.checkpointMarkerConfig.flagWidth * 0.5,
        this.checkpointMarkerConfig.width * 0.5 - this.checkpointMarkerConfig.flagWidth * 0.5,
      ];
      for (let flag = 0; flag < 2; flag += 1) {
        addShadowMesh(
          gate,
          flagGeometry,
          flagMaterials[flag],
          flagOffsets[flag],
          this.checkpointMarkerConfig.height - this.checkpointMarkerConfig.flagHeight * 0.65,
          0
        );
      }
      group.add(gate);
    }

    this.checkpointMarkers = group;
    this.group.add(group);
    return group;
  }

  getPlanarTangentFrame(tangentPlanar) {
    const up = this.basis.upVector();
    const tangent = this.basis.fromBasisComponents(tangentPlanar.right, 0, tangentPlanar.forward).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
    return new THREE.Matrix4().makeBasis(side, up, tangent);
  }

  createBarriers() {
    if (!this.barrierConfig) return null;

    const outerPath = offsetPath(this.trackPlanarPoints, this.closed, this.barrierConfig.sideOffset, SIDE_SIGN.outer);
    const innerPath = offsetPath(this.trackPlanarPoints, this.closed, this.barrierConfig.sideOffset, SIDE_SIGN.inner);
    const group = new THREE.Group();
    const rails = [];
    const postMaterial = new THREE.MeshStandardMaterial({
      color: this.barrierConfig.colors.post,
      metalness: 0.1,
      roughness: 0.72,
      ...this.barrierConfig.materialOptions,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: this.barrierConfig.colors.rail,
      metalness: 0.12,
      roughness: 0.66,
      ...this.barrierConfig.materialOptions,
    });
    const postGeometry = new THREE.CylinderGeometry(
      this.barrierConfig.height * this.barrierConfig.postRadiusRatio,
      this.barrierConfig.height * this.barrierConfig.postRadiusRatio,
      this.barrierConfig.height,
      this.barrierConfig.postSegments
    );
    const outerPosts = this.barrierPostsFromPath(outerPath, postGeometry, postMaterial);
    const innerPosts = this.barrierPostsFromPath(innerPath, postGeometry, postMaterial);
    const posts = [...outerPosts, ...innerPosts];

    for (const post of posts) {
      group.add(post.visual);
    }

    for (const sidePosts of [outerPosts, innerPosts]) {
      const sideRails = this.railsFromPosts(sidePosts, railMaterial);
      for (const rail of sideRails) {
        group.add(rail.visual);
        rails.push(rail);
      }
    }

    this.barriers = {
      group,
      posts,
      rails,
    };
    this.group.add(group);
    return this.barriers;
  }

  barrierPostsFromPath(path, geometry, material) {
    const posts = [];
    const count = this.closed ? path.length : path.length - 1;
    const radius = this.barrierConfig.height * this.barrierConfig.postRadiusRatio;
    const height = this.barrierConfig.height;
    const rotation = this.basis.threeObjectCanonicalToBasisQuaternion();
    for (let i = 0; i < count; i += 1) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      const dRight = b.right - a.right;
      const dForward = b.forward - a.forward;
      const length = Math.hypot(dRight, dForward);
      if (length < PLANAR_EPS) continue;

      const postCount = Math.max(1, Math.floor(length / this.barrierConfig.postSpacing));
      for (let j = 0; j < postCount; j += 1) {
        const t = (j * this.barrierConfig.postSpacing) / length;
        const point = {
          right: a.right + dRight * t,
          forward: a.forward + dForward * t,
        };
        const position = this.basis.fromBasisComponents(
          point.right,
          terrainHeight(this.terrainSampler, point)
            + this.barrierConfig.height * 0.5
            + this.barrierConfig.upOffset,
          point.forward
        );
        const visual = new THREE.Mesh(geometry, material);
        visual.position.copy(position);
        visual.quaternion.copy(rotation);
        visual.castShadow = true;
        visual.receiveShadow = true;
        posts.push({
          visual,
          radius,
          height,
        });
      }
    }
    return posts;
  }

  railsFromPosts(posts, material) {
    const rails = [];
    const count = this.closed ? posts.length : posts.length - 1;
    const up = this.basis.upVector();
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    const midpointWorld = new THREE.Vector3();
    const aPlanar = { right: 0, forward: 0 };
    const bPlanar = { right: 0, forward: 0 };

    for (let i = 0; i < count; i += 1) {
      const a = posts[i];
      const b = posts[(i + 1) % posts.length];
      this.basis.toPlanar(a.visual.position, aPlanar);
      this.basis.toPlanar(b.visual.position, bPlanar);
      const dRight = bPlanar.right - aPlanar.right;
      const dForward = bPlanar.forward - aPlanar.forward;
      const length = Math.hypot(dRight, dForward);
      if (length < PLANAR_EPS) continue;

      const midpoint = {
        right: (aPlanar.right + bPlanar.right) * 0.5,
        forward: (aPlanar.forward + bPlanar.forward) * 0.5,
      };
      const spanRight = this.barrierConfig.height * this.barrierConfig.railThicknessRatio;
      const spanUp = this.barrierConfig.height * this.barrierConfig.railThicknessRatio;
      const spanForward = length;
      const visual = new THREE.Mesh(
        new THREE.BoxGeometry(
          spanRight,
          spanUp,
          spanForward
        ),
        material
      );

      this.basis.fromBasisComponents(
        midpoint.right,
        terrainHeight(this.terrainSampler, midpoint)
          + this.barrierConfig.height * this.barrierConfig.railHeightRatio
          + this.barrierConfig.upOffset,
        midpoint.forward,
        midpointWorld
      );
      this.basis.fromBasisComponents(dRight / length, 0, dForward / length, tangent).normalize();
      side.crossVectors(up, tangent).normalize();
      matrix.makeBasis(side, up, tangent);

      visual.position.copy(midpointWorld);
      visual.quaternion.setFromRotationMatrix(matrix);
      visual.castShadow = true;
      visual.receiveShadow = true;
      rails.push({
        visual,
        spanRight,
        spanUp,
        spanForward,
      });
    }
    return rails;
  }

  createBarrierColliders(world, rapier) {
    const posts = this.barriers.posts;
    const rails = this.barriers.rails;
    const entries = [];

    for (let index = 0; index < posts.length; index += 1) {
      const post = posts[index];
      const visual = post.visual;
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed()
          .setTranslation(visual.position.x, visual.position.y, visual.position.z)
          .setRotation({
            x: visual.quaternion.x,
            y: visual.quaternion.y,
            z: visual.quaternion.z,
            w: visual.quaternion.w,
          })
      );
      const collider = world.createCollider(
        rapier.ColliderDesc.cylinder(post.height * 0.5, post.radius)
          .setFriction(this.barrierConfig.friction)
          .setRestitution(this.barrierConfig.restitution),
        body
      );
      entries.push({ body, collider });
    }

    for (const rail of rails) {
      const visual = rail.visual;

      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed()
          .setTranslation(visual.position.x, visual.position.y, visual.position.z)
          .setRotation({
            x: visual.quaternion.x,
            y: visual.quaternion.y,
            z: visual.quaternion.z,
            w: visual.quaternion.w,
          })
      );
      const collider = world.createCollider(
        rapier.ColliderDesc.cuboid(rail.spanRight * 0.5, rail.spanUp * 0.5, rail.spanForward * 0.5)
          .setFriction(this.barrierConfig.friction)
          .setRestitution(this.barrierConfig.restitution),
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

    this.naturalEnvironment.createPhysicsColliders(world, rapier);

    if (this.barriers) {
      const barrierColliders = this.createBarrierColliders(world, rapier);
      this.physicsColliders.push(...barrierColliders);
    }
    world.updateSceneQueries();
    return this.physicsColliders;
  }

  disposePhysicsColliders() {
    this.naturalEnvironment.disposePhysicsColliders();

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
    this.naturalEnvironment.dispose();
    disposeObject3D(this.group);
    this.checkpointMarkers = null;
    this.barriers = null;
  }

  spawnPose(startIndex, clockwise, spawnDistance, lateralOffset, upOffset) {
    const count = this.checkpoints.length;
    const index = ((startIndex % count) + count) % count;
    const prevIndex = this.closed ? (index - 1 + count) % count : clamp(index - 1, 0, count - 1);
    const nextIndex = this.closed ? (index + 1) % count : clamp(index + 1, 0, count - 1);
    const current = this.checkpoints[index].position;
    const previous = this.checkpoints[prevIndex].position;
    const forward = this.basis.planarDelta(current, previous);
    const length = Math.hypot(forward.right, forward.forward);
    const forwardWorld = this.basis.fromBasisComponents(forward.right / length, 0, forward.forward / length);
    const yaw = this.basis.forwardToYaw(forwardWorld);
    const frame = this.basis.yawPitchRollFrame(yaw);
    const position = current.clone()
      .addScaledVector(frame.forward, -spawnDistance)
      .addScaledVector(frame.right, lateralOffset);
    this.basis.addHeight(position, upOffset);

    return {
      startIndex: index,
      prevIndex,
      nextIndex,
      prevCheckpointId: this.checkpoints[prevIndex].id,
      startCheckpointId: this.checkpoints[index].id,
      nextCheckpointId: this.checkpoints[nextIndex].id,
      clockwise,
      forward: { x: frame.forward.x, y: frame.forward.y, z: frame.forward.z },
      right: { x: frame.right.x, y: frame.right.y, z: frame.right.z },
      position,
      yaw,
    };
  }
}
