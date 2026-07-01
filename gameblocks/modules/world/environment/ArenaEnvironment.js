import * as THREE from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { DEFAULT_PRNG } from '../../math/RandomUtils.js';
import { disposeObject3D } from '../Object3DUtils.js';

function rampAxes(ramp) {
  const cos = Math.cos(ramp.yaw);
  const sin = Math.sin(ramp.yaw);
  return [
    { right: cos, forward: sin },
    { right: -sin, forward: cos },
  ];
}

export function defaultRampLayout(scale=1.0) {
  return [
    {
      right: 0.10 * scale,
      forward: -0.24 * scale,
      spanRight: 0.07 * scale,
      spanForward: 0.14 * scale,
      spanUp: 0.032 * scale,
      yaw: 0,
    },
    {
      right: -0.20 * scale,
      forward: -0.08 * scale,
      spanRight: 0.068 * scale,
      spanForward: 0.112 * scale,
      spanUp: 0.04 * scale,
      yaw: Math.PI * 0.5,
    },
    {
      right: 0.30 * scale,
      forward: 0.08 * scale,
      spanRight: 0.084 * scale,
      spanForward: 0.16 * scale,
      spanUp: 0.052 * scale,
      yaw: Math.PI,
    },
  ];
}

export function defaultPillarLayout(scale=1.0) {
  const pillars = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const radiusFromCenter = i % 2 === 0 ? 0.20 : 0.28;
    const height = i % 2 === 0 ? 0.07 : 0.08;
    const radius = i % 2 === 0 ? 0.02 : 0.03;
    pillars.push({
      right: Math.cos(angle) * radiusFromCenter * scale,
      forward: -Math.sin(angle) * radiusFromCenter * scale,
      radius: radius * scale,
      spanUp: height * scale,
    });
  }
  return pillars;
}

export function defaultWallLayout(worldSize, floorUp, wallHeight, wallThickness) {
  return [
    {
      right: 0,
      up: floorUp + wallHeight * 0.5,
      forward: worldSize * 0.5,
      spanRight: worldSize,
      spanUp: wallHeight,
      spanForward: wallThickness,
    },
    {
      right: 0,
      up: floorUp + wallHeight * 0.5,
      forward: -worldSize * 0.5,
      spanRight: worldSize,
      spanUp: wallHeight,
      spanForward: wallThickness,
    },
    {
      right: -worldSize * 0.5,
      up: floorUp + wallHeight * 0.5,
      forward: 0,
      spanRight: wallThickness,
      spanUp: wallHeight,
      spanForward: worldSize,
    },
    {
      right: worldSize * 0.5,
      up: floorUp + wallHeight * 0.5,
      forward: 0,
      spanRight: wallThickness,
      spanUp: wallHeight,
      spanForward: worldSize,
    },
  ];
}

export class ArenaEnvironment {
  constructor({
    scene,
    worldSize = 50,
    floorUp = 0,
    wallHeight = 3,
    wallThickness = 0.7,
    groundColor = 0x58745e,
    gridMajorColor = 0x89a9cc,
    gridMinorColor = 0x5d7593,
    wallColor = 0x3f5261,
    pillarColor = 0x8d6f53,
    rampColor = 0x8d6f53,
    prng = DEFAULT_PRNG,
    basis = DEFAULT_WORLD_BASIS,
  }) {

    this.scene = scene;
    this.worldSize = worldSize;
    this.floorUp = floorUp;
    this.wallHeight = wallHeight;
    this.wallThickness = wallThickness;
    this.groundColor = groundColor;
    this.gridMajorColor = gridMajorColor;
    this.gridMinorColor = gridMinorColor;
    this.wallColor = wallColor;
    this.pillarColor = pillarColor;
    this.rampColor = rampColor;
    this.prng = prng;
    this.basis = basis;
    this.objectRotation = this.basis.threeObjectCanonicalToBasisQuaternion();
    this.planeRotation = this.basis.threePlaneCanonicalToBasisQuaternion();
    this.group = new THREE.Group();
    this.group.name = 'ArenaEnvironment';

    this.bounds = this.createBounds();
    this.wallLayout = defaultWallLayout(this.worldSize, this.floorUp, this.wallHeight, this.wallThickness);
    this.pillarLayout = defaultPillarLayout(this.worldSize);
    this.rampLayout = defaultRampLayout(this.worldSize);

    this.physicsWorld = null;
    this.rapier = null;
    this.physicsColliders = [];
  }

  create() {
    this.createGround();
    this.createGrid();
    this.createWalls();
    this.createPillars();
    this.createRamps();
    this.scene.add(this.group);
    return this;
  }

  createGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.worldSize, this.worldSize),
      new THREE.MeshStandardMaterial({ color: this.groundColor, roughness: 1, metalness: 0 })
    );
    ground.position.copy(this.basis.fromBasisComponents(0, this.floorUp, 0));
    ground.quaternion.copy(this.planeRotation);
    this.group.add(ground);
  }

  createGrid() {
    const grid = new THREE.GridHelper(
      this.worldSize,
      this.worldSize,
      this.gridMajorColor,
      this.gridMinorColor
    );
    grid.position.copy(this.basis.fromBasisComponents(0, this.floorUp + 0.01, 0));
    grid.quaternion.copy(this.objectRotation);
    this.group.add(grid);
  }

  createWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: this.wallColor,
      roughness: 0.88,
      metalness: 0,
    });

    for (const wall of this.wallLayout) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.spanRight, wall.spanUp, wall.spanForward), wallMaterial);
      mesh.position.copy(this.basis.fromBasisComponents(wall.right, wall.up, wall.forward));
      mesh.quaternion.copy(this.objectRotation);
      this.group.add(mesh);
    }
  }

  createPillars() {
    const pillarMaterial = new THREE.MeshStandardMaterial({
      color: this.pillarColor,
      roughness: 0.86,
      metalness: 0.02,
    });

    for (const pillar of this.pillarLayout) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(pillar.radius, pillar.radius, pillar.spanUp, 18),
        pillarMaterial
      );
      const pillarUp = this.floorUp + pillar.spanUp * 0.5;
      mesh.position.copy(this.basis.fromBasisComponents(pillar.right, pillarUp, pillar.forward));
      mesh.quaternion.copy(this.objectRotation);
      this.group.add(mesh);
      pillar.mesh = mesh;
    }
  }

  createRamps() {
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: this.rampColor,
      roughness: 0.9,
      metalness: 0,
    });

    for (const ramp of this.rampLayout) {
      const geometry = this.createRampGeometry(ramp);
      const mesh = new THREE.Mesh(geometry, rampMaterial);
      this.group.add(mesh);
      ramp.mesh = mesh;
    }
  }

  createRampGeometry(ramp) {
    const halfW = ramp.spanRight * 0.5;
    const halfL = ramp.spanForward * 0.5;
    const [rightAxis, forwardAxis] = rampAxes(ramp);
    const localCorners = [
      [-halfW, 0, halfL],
      [halfW, 0, halfL],
      [-halfW, 0, -halfL],
      [halfW, 0, -halfL],
      [-halfW, ramp.spanUp, -halfL],
      [halfW, ramp.spanUp, -halfL],
    ];
    const positions = [];
    const indices = [];
    const vertex = new THREE.Vector3();

    const addCorner = (cornerIndex) => {
      const [localRight, localUp, localForward] = localCorners[cornerIndex];
      const right = ramp.right + localRight * rightAxis.right + localForward * forwardAxis.right;
      const forward = ramp.forward + localRight * rightAxis.forward + localForward * forwardAxis.forward;
      this.basis.fromBasisComponents(right, this.floorUp + localUp, forward, vertex);
      positions.push(
        vertex.x,
        vertex.y,
        vertex.z
      );
      return positions.length / 3 - 1;
    };

    const addTriangle = (a, b, c) => {
      indices.push(addCorner(a), addCorner(b), addCorner(c));
    };

    const addQuad = (a, b, c, d) => {
      addTriangle(a, b, c);
      addTriangle(a, c, d);
    };

    addQuad(0, 1, 3, 2);
    addQuad(0, 4, 5, 1);
    addQuad(2, 3, 5, 4);
    addTriangle(0, 2, 4);
    addTriangle(1, 5, 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  createBounds() {
    const halfSize = this.worldSize * 0.5;
    return {
      minRight: -halfSize + 1.2,
      maxRight: halfSize - 1.2,
      minForward: -halfSize + 1.2,
      maxForward: halfSize - 1.2,
      left: -halfSize + 1.2,
      right: halfSize - 1.2,
      back: -halfSize + 1.2,
      front: halfSize - 1.2,
    };
  }

  isPlanarPointBlockedByGeometry(right, forward, clearance = 1.2) {
    for (const pillar of this.pillarLayout) {
      const dRight = right - pillar.right;
      const dForward = forward - pillar.forward;
      const minDist = pillar.radius + clearance;
      if (dRight * dRight + dForward * dForward < minDist * minDist) return true;
    }

    for (const ramp of this.rampLayout) {
      const [rightAxis, forwardAxis] = rampAxes(ramp);
      const dRight = right - ramp.right;
      const dForward = forward - ramp.forward;
      const localRight = dRight * rightAxis.right + dForward * rightAxis.forward;
      const localForward = dRight * forwardAxis.right + dForward * forwardAxis.forward;

      if (Math.abs(localRight) <= ramp.spanRight * 0.5 + clearance
        && Math.abs(localForward) <= ramp.spanForward * 0.5 + clearance
      ) {
        return true;
      }
    }

    return false;
  }

  sampleSpawn(
    excludePosition = null,
    minDistance = 0,
    attempts = 24,
    clearance = 1.2
  ) {
    const excludePlanar = excludePosition
      ? this.basis.toPlanar(excludePosition)
      : null;
    for (let i = 0; i < attempts; i += 1) {
      const right = this.prng.uniform(this.bounds.minRight, this.bounds.maxRight);
      const forward = this.prng.uniform(this.bounds.minForward, this.bounds.maxForward);

      if (excludePlanar) {
        const dRight = right - excludePlanar.right;
        const dForward = forward - excludePlanar.forward;
        if (dRight * dRight + dForward * dForward < minDistance * minDistance) continue;
      }

      const blocked = this.isPlanarPointBlockedByGeometry(right, forward, clearance);

      if (!blocked) return this.basis.fromBasisComponents(right, this.floorUp, forward);
    }

    return this.basis.fromBasisComponents(0, this.floorUp, 0);
  }

  createStaticCuboidCollider(box, rotation = this.objectRotation, friction = 0.95) {
    const position = this.basis.fromBasisComponents(box.right, box.up, box.forward);
    const body = this.physicsWorld.createRigidBody(
      this.rapier.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
    );
    const collider = this.physicsWorld.createCollider(
      this.rapier.ColliderDesc.cuboid(box.spanRight * 0.5, box.spanUp * 0.5, box.spanForward * 0.5)
      .setFriction(friction)
      .setRestitution(0),
      body
    );
    return { body, collider };
  }

  createStaticPillarCollider(pillar, friction = 1) {
    const position = this.basis.fromBasisComponents(
      pillar.right,
      this.floorUp + pillar.spanUp * 0.5,
      pillar.forward
    );
    const body = this.physicsWorld.createRigidBody(
      this.rapier.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        x: this.objectRotation.x,
        y: this.objectRotation.y,
        z: this.objectRotation.z,
        w: this.objectRotation.w,
      })
    );
    const collider = this.physicsWorld.createCollider(
      this.rapier.ColliderDesc.cylinder(pillar.spanUp * 0.5, pillar.radius)
      .setFriction(friction)
      .setRestitution(0),
      body
    );
    return { body, collider };
  }

  createStaticRampCollider(geometry, friction = 1) {
    const positionAttr = geometry.getAttribute('position');
    const indexAttr = geometry.getIndex();
    const desc = this.rapier.ColliderDesc.trimesh(
      new Float32Array(positionAttr.array),
      new Uint32Array(indexAttr.array)
    )
      .setFriction(friction)
      .setRestitution(0);
    const body = this.physicsWorld.createRigidBody(this.rapier.RigidBodyDesc.fixed());
    const collider = this.physicsWorld.createCollider(desc, body);
    return { body, collider };
  }

  createPhysicsColliders(world, rapier) {
    this.disposePhysicsColliders();
    this.physicsWorld = world;
    this.rapier = rapier;
    this.physicsColliders = [];

    const groundBox = {
      right: 0,
      up: this.floorUp - 0.1,
      forward: 0,
      spanRight: this.worldSize + this.wallThickness * 2,
      spanUp: 0.2,
      spanForward: this.worldSize + this.wallThickness * 2,
    };
    this.physicsColliders.push({
      ...this.createStaticCuboidCollider(groundBox, this.objectRotation, 1),
    });

    for (let index = 0; index < this.wallLayout.length; index += 1) {
      this.physicsColliders.push({
        ...this.createStaticCuboidCollider(this.wallLayout[index], this.objectRotation, 0.95),
      });
    }

    for (let index = 0; index < this.pillarLayout.length; index += 1) {
      this.physicsColliders.push({
        ...this.createStaticPillarCollider(this.pillarLayout[index], 1),
      });
    }

    for (let index = 0; index < this.rampLayout.length; index += 1) {
      const ramp = this.rampLayout[index];
      const geometry = ramp.mesh.geometry;
      this.physicsColliders.push({
        ...this.createStaticRampCollider(geometry, 1),
      });
    }

    this.physicsWorld.updateSceneQueries();
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
  }
}
