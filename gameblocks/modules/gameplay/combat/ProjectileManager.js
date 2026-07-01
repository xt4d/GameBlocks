import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';
import { ProjectileObject } from '../../world/object/ProjectileObject.js';

export class ProjectileManager {
  constructor({
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.basis = basis;
    this.projectiles = [];
    this.projectileMetadata = new Map();
  }

  spawnProjectile({
    visual,
    metadata = null,
    position,
    direction,
    speed,
    target = null,
    lifetimeSeconds,
    hitRadius,
    turnResponse = 0,
    basis = this.basis,
  }) {
    if (!visual?.group) {
      throw new Error('ProjectileManager: projectile visual with group is required');
    }

    const projectile = new ProjectileObject({
      visual,
      position,
      direction,
      speed,
      target,
      lifetimeSeconds,
      hitRadius,
      turnResponse,
      basis,
    });

    this.projectiles.push(projectile);
    if (metadata !== null) this.projectileMetadata.set(projectile, metadata);
    return projectile;
  }

  step(targets = [], deltaSeconds = 1 / 60) {
    const hitEvents = [];

    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      const result = projectile.step(targets, deltaSeconds);

      const hittedTarget = result.hittedTarget;
      if (hittedTarget) {
        hitEvents.push({
          projectile,
          position: result.position,
          target: result.target,
          hittedTarget,
          metadata: this.projectileMetadata.get(projectile) ?? null,
        });
      }

      if (!projectile.active) {
        projectile.dispose?.();
        this.projectileMetadata.delete(projectile);
        this.projectiles.splice(i, 1);
      }
    }

    return hitEvents;
  }

  clear() {
    for (const projectile of this.projectiles) projectile.dispose?.();
    this.projectiles.length = 0;
    this.projectileMetadata.clear();
  }

  dispose() {
    this.clear();
  }
}
