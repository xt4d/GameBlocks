import { Raycaster } from 'three';
import { toVec3 } from '../math/Vector3Utils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

const EPS = 1e-6;
const CENTER_NDC = Object.freeze({ x: 0, y: 0 });

function resolveTargetObject(hit, objects) {
  if (!hit || !Array.isArray(objects) || objects.length === 0) return null;

  const candidates = new Set(objects);
  let object = hit.object;
  while (object) {
    if (candidates.has(object)) return object;
    object = object.parent;
  }
  return null;
}

export class AimResolver {
  constructor({
    maxDistance = 1000,
    recursive = false,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.basis = basis;
    this.maxDistance = maxDistance;
    this.raycaster = new Raycaster();
    this.recursive = recursive;
  }

  getAimDirection(camera, crosshairNdc = CENTER_NDC) {
    this.raycaster.setFromCamera(crosshairNdc, camera);
    return this.raycaster.ray.direction.clone().normalize();
  }

  getAimFromCamera({
    camera,
    crosshairNdc = CENTER_NDC,
    launchPosition,
    objects = [],
    maxDistance = this.maxDistance,
    recursive = this.recursive,
  }) {
    this.raycaster.setFromCamera(crosshairNdc, camera);
    return this._resolveAim({
      aimOrigin: this.raycaster.ray.origin.clone(),
      aimDirection: this.raycaster.ray.direction.clone().normalize(),
      launchPosition,
      objects,
      maxDistance,
      recursive,
    });
  }

  getAimFromAimRay({
    aimOrigin,
    aimDirection,
    launchPosition,
    objects = [],
    maxDistance = this.maxDistance,
    recursive = this.recursive,
  }) {
    return this._resolveAim({
      aimOrigin: toVec3(aimOrigin),
      aimDirection: this._normalizeAimDirection(aimDirection),
      launchPosition,
      objects,
      maxDistance,
      recursive,
    });
  }

  _resolveAim({
    aimOrigin,
    aimDirection,
    launchPosition,
    objects,
    maxDistance,
    recursive,
  }) {
    const launch = toVec3(launchPosition);
    const aimRayDistance = maxDistance + aimOrigin.distanceTo(launch);
    const hit = this._intersectAimRay(
      aimOrigin,
      aimDirection,
      objects,
      recursive,
      aimRayDistance
    );

    const hitPosition = hit
      ? hit.point.clone()
      : aimOrigin.clone().addScaledVector(aimDirection, aimRayDistance);

    const launchToHit = hitPosition.clone().sub(launch);
    const launchDistanceToHit = launchToHit.length();
    const shootingDirection = launchDistanceToHit > EPS
      ? launchToHit.multiplyScalar(1 / launchDistanceToHit)
      : aimDirection.clone();

    return {
      aimOrigin: aimOrigin,
      aimDirection: aimDirection,
      launchPosition: launch,
      hitPosition,
      shootingDirection,
      hasHit: Boolean(hit),
      hit,
      targetObject: resolveTargetObject(hit, objects),
      maxDistance,
      aimRayDistance,
      launchDistanceToHit,
    };
  }

  _normalizeAimDirection(aimDirection) {
    const direction = toVec3(aimDirection);
    if (direction.lengthSq() <= EPS * EPS) {
      throw new TypeError('AimResolver: aimDirection must be non-zero');
    }
    return direction.normalize();
  }

  _intersectAimRay(origin, direction, objects, recursive, far) {
    if (!Array.isArray(objects) || objects.length === 0) return null;

    const raycaster = this.raycaster;
    const previousNear = raycaster.near;
    const previousFar = raycaster.far;
    try {
      raycaster.set(origin, direction);
      raycaster.near = 0;
      raycaster.far = far;
      return raycaster.intersectObjects(objects, recursive)[0] ?? null;
    } finally {
      raycaster.near = previousNear;
      raycaster.far = previousFar;
    }
  }
}
