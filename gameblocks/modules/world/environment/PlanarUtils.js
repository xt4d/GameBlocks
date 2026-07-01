import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

export const PLANAR_EPS = 1e-6;

export function terrainBasis(terrainSampler) {
  return (terrainSampler?.basis ?? DEFAULT_WORLD_BASIS);
}

export function basisFromLayout(layout, terrainSampler = null) {
  return (layout?.basis ?? terrainSampler?.basis ?? DEFAULT_WORLD_BASIS);
}

export function terrainHeight(terrainSampler, planarPoint) {
  if (typeof terrainSampler?.heightAt === 'function') {
    return terrainSampler.heightAt(planarPoint.right, planarPoint.forward);
  }
  if (typeof terrainSampler?.sample === 'function') {
    return terrainSampler.sample(planarPoint.right, planarPoint.forward)?.height ?? 0;
  }
  return 0;
}

export function normalizePlanar2D(
  right,
  forward,
  fallback = { right: 0, forward: 1 },
  epsilon = PLANAR_EPS
) {
  const length = Math.hypot(right, forward);
  if (length < epsilon) return { ...fallback };
  return { right: right / length, forward: forward / length };
}

export function planarCentroid(points) {
  let right = 0;
  let forward = 0;
  for (const point of points) {
    right += point.right;
    forward += point.forward;
  }
  return {
    right: points.length > 0 ? right / points.length : 0,
    forward: points.length > 0 ? forward / points.length : 0,
  };
}

export function planarTangentAt(points, index, closed, {
  fallback = { right: 0, forward: 1 },
  retryFromCurrent = false,
  epsilon = PLANAR_EPS,
} = {}) {
  const count = points.length;
  if (count < 2) return { ...fallback };

  const prevIndex = closed ? ((index - 1 + count) % count) : Math.max(0, index - 1);
  const nextIndex = closed ? ((index + 1) % count) : Math.min(count - 1, index + 1);
  const prev = points[prevIndex];
  const next = points[nextIndex];
  let right = next.right - prev.right;
  let forward = next.forward - prev.forward;

  if (retryFromCurrent && Math.hypot(right, forward) < epsilon) {
    right = next.right - points[index].right;
    forward = next.forward - points[index].forward;
  }

  return normalizePlanar2D(right, forward, fallback, epsilon);
}
