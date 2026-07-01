import * as THREE from 'three';
import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

function applyOpacity(material, opacity) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (!entry) continue;
    entry.transparent = true;
    entry.opacity = opacity;
  }
}

function sanitizeBoardSize(columns, rows, cellSize) {
  return {
    columns: Math.max(2, Math.floor(columns)),
    rows: Math.max(2, Math.floor(rows)),
    cellSize: Math.max(0.01, cellSize),
  };
}

export function boardCenterOffset(columns, rows, cellSize) {
  return {
    right: (columns - 1) * cellSize * 0.5,
    forward: (rows - 1) * cellSize * 0.5,
  };
}

export function defaultBoardOrigin(rows, cellSize, basis = DEFAULT_WORLD_BASIS) {
  return basis.fromBasisComponents(0, 0, -(rows - 1) * cellSize);
}

export function offsetBoardPoint(
  origin,
  right = 0,
  up = 0,
  forward = 0,
  basis = DEFAULT_WORLD_BASIS
) {
  return new THREE.Vector3()
    .copy(origin)
    .add(basis.fromBasisComponents(right, up, forward));
}

export class BoardEnvironment {
  constructor({
    scene = null,
    columns = 20,
    rows = 20,
    cellSize = 1,
    backgroundScale = 2.5,
    boardUp = -0.5,
    gridUp = -0.49,
    groundColor = 0xd68a4c,
    gridColor = 0xffffff,
    gridOpacity = 0.3,
    groundRoughness = 1,
    groundMetalness = 0,
    lighting = true,
    ambientColor = 0xffffff,
    ambientIntensity = 0.6,
    keyLightColor = 0xffffff,
    keyLightIntensity = 0.7,
    keyLightPosition = { right: 20, up: 18, forward: 20 },
    shadowMapSize = 1024,
    shadowExtent = 30,
    name = 'BoardEnvironment',
    basis = DEFAULT_WORLD_BASIS,
  }) {
    const safeSize = sanitizeBoardSize(columns, rows, cellSize);

    this.scene = scene;
    this.columns = safeSize.columns;
    this.rows = safeSize.rows;
    this.cellSize = safeSize.cellSize;
    this.backgroundScale = Math.max(1, backgroundScale);
    this.boardUp = boardUp;
    this.gridUp = gridUp;
    this.groundColor = groundColor;
    this.gridColor = gridColor;
    this.gridOpacity = gridOpacity;
    this.groundRoughness = groundRoughness;
    this.groundMetalness = groundMetalness;
    this.lighting = lighting;
    this.ambientColor = ambientColor;
    this.ambientIntensity = ambientIntensity;
    this.keyLightColor = keyLightColor;
    this.keyLightIntensity = keyLightIntensity;
    this.keyLightPosition = keyLightPosition;
    this.shadowMapSize = shadowMapSize;
    this.shadowExtent = shadowExtent;
    this.basis = basis;
    this.origin = defaultBoardOrigin(this.rows, this.cellSize, this.basis);
    this.centerOffset = boardCenterOffset(this.columns, this.rows, this.cellSize);
    this.center = offsetBoardPoint(
      this.origin,
      this.centerOffset.right,
      0,
      this.centerOffset.forward,
      this.basis
    );
    this.bounds = Object.freeze({
      minRight: 0,
      maxRight: this.columns - 1,
      minForward: 0,
      maxForward: this.rows - 1,
    });
    this.boardWidth = this.columns * this.cellSize * this.backgroundScale;
    this.boardLength = this.rows * this.cellSize * this.backgroundScale;
    this.group = new THREE.Group();
    this.group.name = name;
    this.boardMesh = null;
    this.gridHelper = null;
    this.ambientLight = null;
    this.keyLight = null;
    this.created = false;
  }

  create() {
    if (this.created) return this;

    this.createBoardMesh();
    this.createGridHelper();
    if (this.lighting) {
      this.createKeyLight();
      this.createAmbientLight();
    }
    if (this.scene) this.scene.add(this.group);
    this.created = true;
    return this;
  }

  cellToWorldPoint(cell, up = 0) {
    return offsetBoardPoint(
      this.origin,
      cell.right * this.cellSize,
      up,
      cell.forward * this.cellSize,
      this.basis
    );
  }

  worldPoint(right = 0, up = 0, forward = 0) {
    return offsetBoardPoint(this.origin, right, up, forward, this.basis);
  }

  createBoardMesh() {
    const planeGeometry = new THREE.PlaneGeometry(this.boardWidth, this.boardLength);
    const boardMaterial = new THREE.MeshStandardMaterial({
      color: this.groundColor,
      roughness: this.groundRoughness,
      metalness: this.groundMetalness,
    });
    const boardMesh = new THREE.Mesh(planeGeometry, boardMaterial);
    boardMesh.name = `${this.group.name}.Ground`;
    boardMesh.receiveShadow = true;
    boardMesh.position.copy(this.cellToWorldPoint(this.centerOffset, this.boardUp));
    boardMesh.quaternion.copy(this.basis.threePlaneCanonicalToBasisQuaternion());
    this.group.add(boardMesh);
    this.boardMesh = boardMesh;
    return boardMesh;
  }

  createGridHelper() {
    const helperSize = Math.max(this.columns, this.rows) * this.cellSize;
    const helperDivisions = Math.max(this.columns, this.rows);
    const gridHelper = new THREE.GridHelper(
      helperSize,
      helperDivisions,
      this.gridColor,
      this.gridColor
    );
    gridHelper.name = `${this.group.name}.Grid`;
    gridHelper.scale.set(
      (this.columns * this.cellSize) / helperSize,
      1,
      (this.rows * this.cellSize) / helperSize
    );
    gridHelper.position.copy(this.cellToWorldPoint(this.centerOffset, this.gridUp));
    gridHelper.quaternion.copy(this.basis.threeObjectCanonicalToBasisQuaternion());
    applyOpacity(gridHelper.material, this.gridOpacity);
    this.group.add(gridHelper);
    this.gridHelper = gridHelper;
    return gridHelper;
  }

  createAmbientLight() {
    const ambientLight = new THREE.AmbientLight(this.ambientColor, this.ambientIntensity);
    ambientLight.name = `${this.group.name}.Ambient`;
    this.group.add(ambientLight);
    this.ambientLight = ambientLight;
    return ambientLight;
  }

  createKeyLight() {
    const keyLight = new THREE.DirectionalLight(this.keyLightColor, this.keyLightIntensity);
    keyLight.name = `${this.group.name}.KeyLight`;
    keyLight.castShadow = true;
    keyLight.position.copy(this.worldPoint(
      this.keyLightPosition.right,
      this.keyLightPosition.up,
      this.keyLightPosition.forward
    ));

    if (keyLight.shadow?.mapSize) {
      keyLight.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
    }
    if (keyLight.shadow?.camera) {
      keyLight.shadow.camera.top = this.shadowExtent;
      keyLight.shadow.camera.bottom = -this.shadowExtent;
      keyLight.shadow.camera.left = -this.shadowExtent;
      keyLight.shadow.camera.right = this.shadowExtent;
    }
    if (keyLight.shadow) {
      keyLight.shadow.radius = 7;
      keyLight.shadow.blurSamples = 20;
    }

    if (keyLight.target?.position) {
      keyLight.target.name = `${this.group.name}.KeyLightTarget`;
      keyLight.target.position.copy(this.center);
      this.group.add(keyLight.target);
    }

    this.group.add(keyLight);
    this.keyLight = keyLight;
    return keyLight;
  }
}
