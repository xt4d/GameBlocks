const DEFAULT_MAX_ATTEMPTS = 40;

export const SPAWN_REGION_TYPES = Object.freeze({
  RECT: 'rect',
  CIRCLE: 'circle',
  POLYGON: 'polygon',
  SEGMENT_CORRIDOR: 'segmentCorridor',
});

function distanceSqPointToSegment(point, start, end) {
  const deltaRight = end.right - start.right;
  const deltaForward = end.forward - start.forward;
  const lengthSq = deltaRight * deltaRight + deltaForward * deltaForward;

  if (lengthSq === 0) {
    const right = point.right - start.right;
    const forward = point.forward - start.forward;
    return right * right + forward * forward;
  }

  const t = Math.max(0, Math.min(1, (
    (point.right - start.right) * deltaRight
    + (point.forward - start.forward) * deltaForward
  ) / lengthSq));
  const right = point.right - (start.right + deltaRight * t);
  const forward = point.forward - (start.forward + deltaForward * t);
  return right * right + forward * forward;
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if ((a.forward > point.forward) === (b.forward > point.forward)) continue;

    const edgeRight = a.right + (
      (point.forward - a.forward) * (b.right - a.right)
    ) / (b.forward - a.forward);
    if (point.right < edgeRight) inside = !inside;
  }
  return inside;
}

function pointInRegion(point, region, padding = 0) {
  if (region.type === SPAWN_REGION_TYPES.RECT) {
    const halfRight = region.size.right * 0.5 + padding;
    const halfForward = region.size.forward * 0.5 + padding;
    return halfRight >= 0
      && halfForward >= 0
      && Math.abs(point.right - region.center.right) <= halfRight
      && Math.abs(point.forward - region.center.forward) <= halfForward;
  }

  if (region.type === SPAWN_REGION_TYPES.CIRCLE) {
    const radius = region.radius + padding;
    const right = point.right - region.center.right;
    const forward = point.forward - region.center.forward;
    return radius >= 0 && right * right + forward * forward <= radius * radius;
  }

  if (region.type === SPAWN_REGION_TYPES.POLYGON) {
    return pointInPolygon(point, region.points);
  }

  if (region.type === SPAWN_REGION_TYPES.SEGMENT_CORRIDOR) {
    const halfWidth = region.halfWidth + padding;
    return halfWidth >= 0 && region.segments.some(({ start, end }) => (
      distanceSqPointToSegment(point, start, end) <= halfWidth * halfWidth
    ));
  }

  return false;
}

function pointAllowed(point, {
  radius = 0,
  spawnRegions = [],
  blockRegions = [],
}) {
  const inSpawnRegion = spawnRegions.length === 0
    || spawnRegions.some((region) => pointInRegion(point, region, -radius));

  return inSpawnRegion && !blockRegions.some((region) => (
    pointInRegion(point, region, radius + (region.clearance ?? 0))
  ));
}

function addPoint(bounds, point) {
  bounds.rightMin = Math.min(bounds.rightMin, point.right);
  bounds.rightMax = Math.max(bounds.rightMax, point.right);
  bounds.forwardMin = Math.min(bounds.forwardMin, point.forward);
  bounds.forwardMax = Math.max(bounds.forwardMax, point.forward);
}

function addRegion(bounds, region) {
  if (region.type === SPAWN_REGION_TYPES.RECT) {
    addPoint(bounds, {
      right: region.center.right - region.size.right * 0.5,
      forward: region.center.forward - region.size.forward * 0.5,
    });
    addPoint(bounds, {
      right: region.center.right + region.size.right * 0.5,
      forward: region.center.forward + region.size.forward * 0.5,
    });
    return;
  }

  if (region.type === SPAWN_REGION_TYPES.CIRCLE) {
    addPoint(bounds, {
      right: region.center.right - region.radius,
      forward: region.center.forward - region.radius,
    });
    addPoint(bounds, {
      right: region.center.right + region.radius,
      forward: region.center.forward + region.radius,
    });
    return;
  }

  if (region.type === SPAWN_REGION_TYPES.POLYGON) {
    for (const point of region.points) addPoint(bounds, point);
    return;
  }

  if (region.type === SPAWN_REGION_TYPES.SEGMENT_CORRIDOR) {
    for (const { start, end } of region.segments) {
      addPoint(bounds, { right: start.right - region.halfWidth, forward: start.forward - region.halfWidth });
      addPoint(bounds, { right: start.right + region.halfWidth, forward: start.forward + region.halfWidth });
      addPoint(bounds, { right: end.right - region.halfWidth, forward: end.forward - region.halfWidth });
      addPoint(bounds, { right: end.right + region.halfWidth, forward: end.forward + region.halfWidth });
    }
    return;
  }
}

function boundsForRegions(regions) {
  if (regions.length === 0) return null;

  const bounds = {
    rightMin: Infinity,
    rightMax: -Infinity,
    forwardMin: Infinity,
    forwardMax: -Infinity,
  };
  for (const region of regions) addRegion(bounds, region);
  return bounds;
}

function samplePoint(prng, bounds) {
  return {
    right: prng.uniform(bounds.rightMin, bounds.rightMax),
    forward: prng.uniform(bounds.forwardMin, bounds.forwardMax),
  };
}

export class SpawnAreaSampler {
  constructor({
    bounds,
    spawnRegions = [],
    blockRegions = [],
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  }) {
    this.bounds = bounds;
    this.spawnRegions = spawnRegions;
    this.blockRegions = blockRegions;
    this.maxAttempts = maxAttempts;
    this.sampleBounds = boundsForRegions(spawnRegions) ?? bounds;
  }

  allows(point, radius = 0) {
    return pointAllowed(point, {
      radius,
      spawnRegions: this.spawnRegions,
      blockRegions: this.blockRegions,
    });
  }

  sample(prng, radius = 0) {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const point = samplePoint(prng, this.sampleBounds);
      if (this.allows(point, radius)) return point;
    }
    return null;
  }
}
