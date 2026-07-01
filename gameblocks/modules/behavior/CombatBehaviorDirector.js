import { DEFAULT_PRNG } from '../math/RandomUtils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

const distSqPlanar = (a, b, basis) => basis.distanceSqPlanar(a, b);

export const ENEMY_BEHAVIOR_STATES = Object.freeze({
  IDLE: 'idle',
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  DEAD: 'dead',
});

export class CombatBehaviorDirector {
  constructor({
    idleMinMs = 1000,
    idleMaxMs = 4500,
    attackDistance = 2.2,
    chaseDistance = 18,
    loseTargetDistance = 26,
    repathIntervalMs = 450,
    attackCooldownMs = 900,
    strafeBias = 0.35,
    prng = DEFAULT_PRNG,
    basis = DEFAULT_WORLD_BASIS
  }) {
    this.idleMinMs = idleMinMs;
    this.idleMaxMs = idleMaxMs;
    this.attackDistance = attackDistance;
    this.chaseDistance = chaseDistance;
    this.loseTargetDistance = loseTargetDistance;
    this.repathIntervalMs = repathIntervalMs;
    this.attackCooldownMs = attackCooldownMs;
    this.strafeBias = strafeBias;
    this.prng = prng;
    this.basis = basis;

    this.memory = new Map();
  }

  _getMemory(agentId) {
    if (!this.memory.has(agentId)) {
      this.memory.set(agentId, {
        state: ENEMY_BEHAVIOR_STATES.IDLE,
        waitMs: this._randomIdleTime(),
        repathMs: 0,
        attackMs: 0,
        preferredDirection: this.prng.random() < 0.5 ? 1 : -1,
      });
    }
    return this.memory.get(agentId);
  }

  _randomIdleTime() {
    return this.prng.uniform(this.idleMinMs, this.idleMaxMs);
  }

  _setState(mem, state) {
    if (mem.state === state) return false;
    mem.state = state;
    if (state === ENEMY_BEHAVIOR_STATES.IDLE) mem.waitMs = this._randomIdleTime();
    if (state === ENEMY_BEHAVIOR_STATES.ATTACK) mem.attackMs = this.attackCooldownMs;
    if (state === ENEMY_BEHAVIOR_STATES.CHASE) mem.repathMs = 0;
    return true;
  }

  reset(agentId) {
    this.memory.delete(agentId);
  }

  step({
    actorId = 'default',
    actorPosition = null,
    actorAlive = true,
    targetPosition = null,
    canSeeTarget = false,
    canAttackTarget = false,
    hasMovePath = false,
    deltaMs = 1000 / 60,
  }) {
    const mem = this._getMemory(actorId);
    const targetPos = targetPosition;

    if (actorAlive === false) {
      this._setState(mem, ENEMY_BEHAVIOR_STATES.DEAD);
      return {
        state: mem.state,
        moveTarget: null,
        aimTarget: null,
        wantsPatrol: false,
        wantsPathRefresh: false,
        wantsAttack: false,
        movementStyle: ENEMY_BEHAVIOR_STATES.DEAD,
        lateralMove: 0,
      };
    }

    if (!targetPos || !actorPosition) {
      return {
        state: mem.state,
        moveTarget: null,
        aimTarget: null,
        wantsPatrol: true,
        wantsPathRefresh: false,
        wantsAttack: false,
        movementStyle: ENEMY_BEHAVIOR_STATES.IDLE,
        lateralMove: 0,
      };
    }

    const toTargetDistSq = distSqPlanar(actorPosition, targetPos, this.basis);
    const attackDistSq = this.attackDistance * this.attackDistance;
    const chaseDistSq = this.chaseDistance * this.chaseDistance;
    const loseDistSq = this.loseTargetDistance * this.loseTargetDistance;

    mem.waitMs = Math.max(0, mem.waitMs - deltaMs);
    mem.repathMs = Math.max(0, mem.repathMs - deltaMs);
    mem.attackMs = Math.max(0, mem.attackMs - deltaMs);

    switch (mem.state) {
      case ENEMY_BEHAVIOR_STATES.IDLE:
        if (canSeeTarget && toTargetDistSq <= chaseDistSq) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.CHASE);
        } else if (mem.waitMs <= 0) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.PATROL);
        }
        break;
      case ENEMY_BEHAVIOR_STATES.PATROL:
        if (canSeeTarget && toTargetDistSq <= chaseDistSq) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.CHASE);
        } else if (!hasMovePath) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.IDLE);
        }
        break;
      case ENEMY_BEHAVIOR_STATES.CHASE:
        if (toTargetDistSq <= attackDistSq) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.ATTACK);
        } else if (!canSeeTarget && toTargetDistSq > loseDistSq) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.IDLE);
        }
        break;
      case ENEMY_BEHAVIOR_STATES.ATTACK:
        if (toTargetDistSq > attackDistSq * 1.2) {
          this._setState(mem, ENEMY_BEHAVIOR_STATES.CHASE);
        }
        break;
      default:
        break;
    }

    const command = {
      state: mem.state,
      moveTarget: null,
      aimTarget: targetPos,
      wantsPatrol: false,
      wantsPathRefresh: false,
      wantsAttack: false,
      movementStyle: mem.state,
      lateralMove: 0,
    };

    if (mem.state === ENEMY_BEHAVIOR_STATES.PATROL) {
      if (!hasMovePath) {
        command.wantsPatrol = true;
      }
    }

    if (mem.state === ENEMY_BEHAVIOR_STATES.CHASE) {
      command.moveTarget = targetPos;
      if (mem.repathMs <= 0) {
        command.wantsPathRefresh = true;
        mem.repathMs = this.repathIntervalMs;
      }
      if (canSeeTarget && this.prng.random() < this.strafeBias) {
        command.lateralMove = mem.preferredDirection;
      }
    }

    if (mem.state === ENEMY_BEHAVIOR_STATES.ATTACK) {
      command.moveTarget = targetPos;
      if (canAttackTarget && mem.attackMs <= 0) {
        command.wantsAttack = true;
        mem.attackMs = this.attackCooldownMs;
      }
    }

    return command;
  }
}
