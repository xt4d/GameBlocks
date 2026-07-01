import { clamp } from '../math/ScalarUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

const EPS = 1e-6;

function wrapIndex(index, len) {
  if (len <= 0) return 0;
  return ((index % len) + len) % len;
}

function distanceSqPlanar(a, b, basis) {
  return basis.distanceSqPlanar(a, b);
}

function normalizePlanar(dRight, dForward) {
  const len = Math.hypot(dRight, dForward);
  if (len < EPS) return { right: 0, forward: 0, len: 0 };
  return { right: dRight / len, forward: dForward / len, len };
}

function planarDelta(from, to, basis) {
  const fromPlanar = basis.toPlanar(from);
  const toPlanar = basis.toPlanar(to);
  const dRight = toPlanar.right - fromPlanar.right;
  const dForward = toPlanar.forward - fromPlanar.forward;
  return normalizePlanar(dRight, dForward);
}

function asPlainWaypoint(point) {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
  };
}

function resolveStepIndex(index, step, count, closed) {
  if (closed) return wrapIndex(index + step, count);
  return clamp(index + step, 0, count - 1);
}

function cornerProfile(waypoints, index, closed, basis) {
  const count = waypoints.length;
  if (count < 3) {
    return { sign: 0, magnitude: 0 };
  }

  const prevIndex = resolveStepIndex(index, -1, count, closed);
  const nextIndex = resolveStepIndex(index, 1, count, closed);
  if (!closed && (prevIndex === index || nextIndex === index)) {
    return { sign: 0, magnitude: 0 };
  }

  const prev = waypoints[prevIndex];
  const curr = waypoints[index];
  const next = waypoints[nextIndex];

  const inDir = planarDelta(prev, curr, basis);
  const outDir = planarDelta(curr, next, basis);
  if (inDir.len < EPS || outDir.len < EPS) {
    return { sign: 0, magnitude: 0 };
  }

  const planarCross = inDir.right * outDir.forward - inDir.forward * outDir.right;
  const dot = clamp(inDir.right * outDir.right + inDir.forward * outDir.forward, -1, 1);
  return {
    sign: Math.sign(planarCross || 1),
    magnitude: Math.acos(dot),
  };
}

export class WaypointProgressTracker {
  constructor({
    waypoints = [],
    reachDistance = 4,
    closed = true,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.reachDistance = reachDistance;
    this.closed = closed !== false;
    this.basis = basis;

    this.waypoints = [];
    this.currentIndex = 0;
    this.initialized = false;
    this.last = null;

    this.setWaypoints(waypoints);
  }

  setWaypoints(waypoints = []) {
    this.waypoints = Array.isArray(waypoints)
      ? waypoints
        .filter((p) => this.basis.hasWorldPlanarComponents(p))
        .map((p) => asPlainWaypoint(p))
      : [];

    this.currentIndex = 0;
    this.initialized = false;
    this.last = null;
  }

  reset(startIndex = 0) {
    const count = this.waypoints.length;
    this.currentIndex = count > 0 ? wrapIndex(startIndex, count) : 0;
    this.initialized = count > 0;
    this.last = null;
  }

  _findNearestGlobal(position) {
    let bestIndex = 0;
    let bestDistSq = Infinity;

    for (let i = 0; i < this.waypoints.length; i += 1) {
      const distSq = distanceSqPlanar(position, this.waypoints[i], this.basis);
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  _advance(index, step) {
    return resolveStepIndex(index, step, this.waypoints.length, this.closed);
  }

  step(position) {
    const count = this.waypoints.length;
    if (count === 0 || !position) {
      this.last = null;
      return null;
    }

    let currentIndex = this.initialized ? this.currentIndex : this._findNearestGlobal(position);
    this.initialized = true;

    let distanceToCurrent = Math.sqrt(
      distanceSqPlanar(position, this.waypoints[currentIndex], this.basis)
    );
    if (distanceToCurrent <= this.reachDistance && (this.closed || currentIndex < count - 1)) {
      currentIndex = this._advance(currentIndex, 1);
      distanceToCurrent = Math.sqrt(
        distanceSqPlanar(position, this.waypoints[currentIndex], this.basis)
      );
    }

    this.currentIndex = currentIndex;

    const corner = cornerProfile(this.waypoints, currentIndex, this.closed, this.basis);

    this.last = {
      currentIndex,
      currentWaypoint: this.waypoints[currentIndex],
      distanceToCurrent,
      cornerSign: corner.sign,
      cornerMagnitude: corner.magnitude,
      waypointCount: count,
    };

    return { ...this.last };
  }

  snapshot() {
    return {
      currentIndex: this.currentIndex,
      initialized: this.initialized,
      waypointCount: this.waypoints.length,
      last: this.last ? { ...this.last } : null,
    };
  }
}
