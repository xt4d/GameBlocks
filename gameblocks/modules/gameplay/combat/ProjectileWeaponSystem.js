import { DEFAULT_CLOCK } from '../../math/TimeUtils.js';
import { toVec3 } from '../../math/Vector3Utils.js';

export const WEAPON_DECISIONS = Object.freeze({
  FIRE_GUN: 'fire-gun',
  FIRE_MISSILE: 'fire-missile',
  BLOCKED: 'blocked',
  EMPTY_WARNING: 'empty-warning',
});

export const WEAPON_TYPES = Object.freeze({
  GUN: 'gun',
  MISSILE: 'missile',
});

export const WEAPON_AIM_MODES = Object.freeze({
  BORESIGHT: 'boresight',
  CROSSHAIR: 'crosshair',
});

export const MISSILE_LOCK_STATUS = Object.freeze({
  NONE: 'NONE',
  LOCKING: 'LOCKING',
  LOCKED: 'LOCKED',
});

function calculateDist(sourcePosition, targetPosition) {
  return Math.hypot(
    targetPosition.x - sourcePosition.x,
    targetPosition.y - sourcePosition.y,
    targetPosition.z - sourcePosition.z
  );
}

function calculateDotProduct(sourcePosition, targetPosition, aimDirection) {
  const dX = targetPosition.x - sourcePosition.x;
  const dY = targetPosition.y - sourcePosition.y;
  const dZ = targetPosition.z - sourcePosition.z;
  const len = Math.hypot(dX, dY, dZ);
  if (len <= 1e-6) return 0;

  return aimDirection.x * (dX / len) + aimDirection.y * (dY / len) + aimDirection.z * (dZ / len);
}

export class ProjectileWeaponSystem {
  constructor({
    lockRequiredSeconds = 1.0,
    gunHeatPerShot = 0.02,
    gunCoolRatePerSecond = 0.2,
    gunOverheatThreshold = 1.0,
    gunRecoveredThreshold = 0.3,
    emptyWarningCooldownSeconds = 2.0,
    aimMode = WEAPON_AIM_MODES.CROSSHAIR,
    targetAimDotMin = 0.94,
    targetMaxDistance = 10000,
    clock = DEFAULT_CLOCK,
  }) {
    this.clock = clock;
    this.aimMode = aimMode;
    this.cfg = {
      lockRequiredSeconds,
      gunHeatPerShot,
      gunCoolRatePerSecond,
      gunOverheatThreshold,
      gunRecoveredThreshold,
      emptyWarningCooldownSeconds,
      targetAimDotMin,
      targetMaxDistance
    };

    this.weapons = new Map();
    this.weapons.set(WEAPON_TYPES.GUN, {id: WEAPON_TYPES.GUN, lastFireTime: -Infinity, ammo: Infinity, maxAmmo: Infinity, fireRate: 0.05});
    this.weapons.set(WEAPON_TYPES.MISSILE, {id: WEAPON_TYPES.MISSILE, lastFireTime: -Infinity, ammo: 50, maxAmmo: 50, fireRate: 1.0});
    this.weaponIds = [WEAPON_TYPES.GUN, WEAPON_TYPES.MISSILE];

    this.selectedWeaponId = WEAPON_TYPES.GUN;
    this.target = null;
    this.isGunOverheated = false;
    this.gunHeat = 0;
    this.lockTime = 0;
    this.lockStatus = MISSILE_LOCK_STATUS.NONE;
    this.lockingTarget = null;
    this.emptyWarningTimers = {
      [WEAPON_TYPES.GUN]: 0,
      [WEAPON_TYPES.MISSILE]: 0,
    };
    this.lastEmptyWarningAtSeconds = 0;
  }

  updateWeaponConfig(weaponId, {ammo, maxAmmo, fireRate, speed, launchOffset}) {
    const weapon = this.weapons.get(weaponId);
    weapon.ammo = ammo;
    weapon.maxAmmo = maxAmmo;
    weapon.fireRate = fireRate;
    weapon.speed = speed;
    weapon.launchOffset = launchOffset;
  }

  resetAmmo() {
    for (const weaponId of this.weaponIds) {
      const weapon = this.weapons.get(weaponId);
      weapon.ammo = weapon.maxAmmo;
      weapon.lastFireTime = -Infinity;
    }
    this.selectedWeaponId = WEAPON_TYPES.GUN;
    this.target = null;
    this.isGunOverheated = false;
    this.gunHeat = 0;
    this.lockTime = 0;
    this.lockStatus = MISSILE_LOCK_STATUS.NONE;
    this.lockingTarget = null;
    this.emptyWarningTimers = {
      [WEAPON_TYPES.GUN]: 0,
      [WEAPON_TYPES.MISSILE]: 0,
    };
    this.lastEmptyWarningAtSeconds = 0;
  }

  getCurrentWeapon() {
    return this.weapons.get(this.selectedWeaponId);
  }

  getLaunchPosition(shooterPosition, shooterBodyFrame, weaponId = null) {
    const weapon = weaponId ? this.weapons.get(weaponId) : this.getCurrentWeapon();
    if (!weapon) return shooterPosition;
    const shooterOrigin = toVec3(shooterPosition);
    const offset = weapon.launchOffset ?? {};
    return shooterBodyFrame.right.clone()
      .multiplyScalar(offset.right ?? 0)
      .addScaledVector(shooterBodyFrame.up, offset.up ?? 0)
      .addScaledVector(shooterBodyFrame.forward, offset.forward ?? 0)
      .add(shooterOrigin);
  }

  toggleWeapon() {
    const currentIndex = Math.max(0, this.weaponIds.indexOf(this.selectedWeaponId));
    const nextIndex = (currentIndex + 1) % this.weaponIds.length;
    this.selectedWeaponId = this.weaponIds[nextIndex];
  }

  selectWeapon(weaponId) {
    if (!this.weapons.has(weaponId)) return null;
    this.selectedWeaponId = weaponId;
  }

  // In crosshair mode, aimPosition is the world-space point the launched shot should travel toward from its launch position, it can come from AimResolver's getAimFromCamera(...).hitPosition or AimResolver's getAimFromAimRay(...).hitPosition.
  requestFire({
    shooterPosition,
    shooterBodyFrame,
    aimPosition = null,
    weaponId = null
  }) {
    const weapon = weaponId ? this.weapons.get(weaponId) : this.getCurrentWeapon();
    if (!weapon) return null;

    if (this.aimMode === WEAPON_AIM_MODES.CROSSHAIR && !aimPosition) {
      throw new TypeError('ProjectileWeaponSystem: crosshair fire requires aimPosition');
    }

    const now = this.clock.nowSeconds();
    if (weapon.ammo <= 0) return this._emptyWarning(weapon.id, now);
    if (weapon.id === WEAPON_TYPES.GUN && this.isGunOverheated) {
      return { type: WEAPON_DECISIONS.BLOCKED, message: 'Weapon overheated', weapon };
    }
    if (now - weapon.lastFireTime < weapon.fireRate) {
      return { type: WEAPON_DECISIONS.BLOCKED, message: 'Weapon cooldown', weapon };
    }
    if (weapon.id === WEAPON_TYPES.MISSILE && this.lockStatus !== MISSILE_LOCK_STATUS.LOCKED) {
      return { type: WEAPON_DECISIONS.BLOCKED, message: 'Missile needs lock', weapon };
    }

    const motionState = this._computeLaunchMotionState(
      weapon,
      shooterPosition,
      shooterBodyFrame,
      aimPosition
    );

    weapon.lastFireTime = now;
    if (weapon.ammo !== Infinity) weapon.ammo -= 1;

    if (weapon.id === WEAPON_TYPES.GUN) {
      this.gunHeat += this.cfg.gunHeatPerShot;
      const overheated = this.gunHeat >= this.cfg.gunOverheatThreshold;
      if (overheated) this.isGunOverheated = true;
      return {
        type: WEAPON_DECISIONS.FIRE_GUN,
        weapon,
        overheated,
        ...motionState
      };
    }

    if (weapon.id === WEAPON_TYPES.MISSILE) {
      return {
        type: WEAPON_DECISIONS.FIRE_MISSILE,
        weapon,
        target: this.target,
        ...motionState
      };
    }

    return { type: WEAPON_DECISIONS.BLOCKED, message: 'Unsupported weapon', weapon };
  }

  // In crosshair mode, aimDirection is the world-space direction the shooter is currently aiming, it can come from AimResolver's getAimDirection(camera, crosshairNdc).
  step({
    shooterPosition,
    shooterBodyFrame,
    aimDirection = null,
    targets = [],
    deltaSeconds = 1 / 60
  }) {
    const currentWeapon = this.getCurrentWeapon();

    if (currentWeapon.id === WEAPON_TYPES.MISSILE) {
      this._stepMissileLock({
        shooterPosition,
        shooterBodyFrame,
        aimDirection,
        targets,
        deltaSeconds
      });
    } else {
      this.lockingTarget = null;
      this.lockTime = 0;
      this.lockStatus = MISSILE_LOCK_STATUS.NONE;
      this.target = null;
    }

    this._stepGunHeat(deltaSeconds);
    this._stepEmptyWarningCooldowns(deltaSeconds);
  }

  findPotentialTarget({
    shooterPosition,
    shooterBodyFrame,
    aimDirection = null,
    targets = []
  }) {
    const position = toVec3(shooterPosition);
    let resolvedAimDirection;
    if (this.aimMode === WEAPON_AIM_MODES.BORESIGHT) {
      resolvedAimDirection = shooterBodyFrame.forward.clone();
    } else if (this.aimMode === WEAPON_AIM_MODES.CROSSHAIR) {
      resolvedAimDirection = toVec3(aimDirection);
    }
    resolvedAimDirection.normalize();

    let bestTarget = null;
    let maxDot = this.cfg.targetAimDotMin;

    for (const target of targets) {
      if (target.destroyed) continue;

      const dot = calculateDotProduct(position, target.position, resolvedAimDirection);
      if (dot <= maxDot) continue;

      const dist = calculateDist(position, target.position);
      if (dist >= this.cfg.targetMaxDistance) continue;

      bestTarget = target;
      maxDot = dot;
    }

    return bestTarget;
  }

  _stepMissileLock({
    shooterPosition,
    shooterBodyFrame,
    aimDirection,
    targets,
    deltaSeconds
  }) {
    const potentialTarget = this.findPotentialTarget({
      shooterPosition,
      shooterBodyFrame,
      aimDirection,
      targets
    });

    if (!potentialTarget) {
      this.lockingTarget = null;
      this.lockTime = 0;
      this.lockStatus = MISSILE_LOCK_STATUS.NONE;
      this.target = null;
      return;
    }

    if (this.lockingTarget !== potentialTarget) {
      this.lockingTarget = potentialTarget;
      this.lockTime = 0;
      this.lockStatus = MISSILE_LOCK_STATUS.LOCKING;
      this.target = null;
      return;
    }

    this.lockTime += deltaSeconds;
    if (this.lockTime >= this.cfg.lockRequiredSeconds) {
      this.lockStatus = MISSILE_LOCK_STATUS.LOCKED;
      this.target = potentialTarget;
      return;
    }

    this.lockStatus = MISSILE_LOCK_STATUS.LOCKING;
  }

  _computeLaunchMotionState(
    weapon,
    shooterPosition,
    shooterBodyFrame,
    aimPosition = null
  ) {
    const position = this.getLaunchPosition(shooterPosition, shooterBodyFrame, weapon.id);
    let direction;
    if (this.aimMode === WEAPON_AIM_MODES.BORESIGHT) {
      direction = shooterBodyFrame.forward.clone();
    } else if (this.aimMode === WEAPON_AIM_MODES.CROSSHAIR) {
      direction = toVec3(aimPosition).sub(position);
    }
    if (direction.lengthSq() <= 1e-12) {
      throw new TypeError('ProjectileWeaponSystem: fire direction must be non-zero');
    }
    direction.normalize();

    return {
      position: position,
      direction,
      speed: weapon.speed
    };
  }

  _stepGunHeat(deltaSeconds) {
    if (this.gunHeat <= 0) return;

    this.gunHeat -= deltaSeconds * this.cfg.gunCoolRatePerSecond;
    if (this.gunHeat <= 0) {
      this.gunHeat = 0;
      this.isGunOverheated = false;
    }
    if (this.isGunOverheated && this.gunHeat < this.cfg.gunRecoveredThreshold) {
      this.isGunOverheated = false;
    }
  }

  _stepEmptyWarningCooldowns(deltaSeconds) {
    for (const key in this.emptyWarningTimers) {
      if (this.emptyWarningTimers[key] <= 0) continue;
      this.emptyWarningTimers[key] -= deltaSeconds;
      if (this.emptyWarningTimers[key] < 0) this.emptyWarningTimers[key] = 0;
    }
  }

  _emptyWarning(weaponId, now) {
    if (now - this.lastEmptyWarningAtSeconds <= this.cfg.emptyWarningCooldownSeconds) {
      return { type: WEAPON_DECISIONS.BLOCKED, message: 'Weapon empty', weaponId };
    }

    this.emptyWarningTimers[weaponId] = 1.0;
    this.lastEmptyWarningAtSeconds = now;
    return { type: WEAPON_DECISIONS.EMPTY_WARNING, weaponId };
  }
}
