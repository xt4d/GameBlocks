export const COMBAT_STATES = Object.freeze({
  WAITING: 'WAITING',
  STARTED: 'STARTED',
  FINISHED: 'FINISHED',
});

export const COMBAT_PLAY_EVENTS = Object.freeze({
  COMBAT_FINISHED: 'combat.finished',
  PLAYER_KILLED: 'combat.player.killed',
});

function clonePlayer(player) {
  return {
    playerId: player.playerId,
    teamId: player.teamId,
    maxHealth: player.maxHealth,
    health: player.health,
    maxArmor: player.maxArmor,
    armor: player.armor,
    alive: player.alive,
  };
}

function createPlayer({
  playerId,
  teamId,
  maxHealth,
  health,
  maxArmor,
  armor,
}) {
  return {
    playerId,
    teamId,
    maxHealth,
    health,
    maxArmor,
    armor,
    alive: health > 0,
  };
}

export class CombatPlay {
  constructor({
    maxHealth = 100,
    maxArmor = 100,
    armorAbsorption = 0.6,
  }) {
    this.maxHealth = maxHealth;
    this.maxArmor = maxArmor;
    this.armorAbsorption = armorAbsorption;

    this.players = new Map();
    this.combatState = COMBAT_STATES.WAITING;
    this.winnerTeamId = null;
    this._events = [];
  }

  addPlayer({
    playerId,
    teamId,
    health = this.maxHealth,
    armor = 0,
  }) {
    if (this.combatState !== COMBAT_STATES.WAITING) {
      throw new Error('players can only be added while combat is waiting');
    }
    if (this.players.has(playerId)) {
      throw new Error(`player already exists: ${playerId}`);
    }

    this.players.set(playerId, createPlayer({
      playerId,
      teamId,
      maxHealth: this.maxHealth,
      health: health,
      maxArmor: this.maxArmor,
      armor: armor,
    }));
  }

  removePlayer(playerId) {
    if (!this.players.delete(playerId)) {
      throw new Error(`unknown player: ${playerId}`);
    }
  }

  updatePlayer({ playerId, health, armor }) {
    const player = this._getPlayer(playerId);
    if (health !== undefined) {
      player.health = Math.min(health, player.maxHealth);
      player.alive = player.health > 0;
    }
    if (armor !== undefined) {
      player.armor = Math.min(armor, player.maxArmor);
    }
  }

  startGame() {
    if (this.combatState !== COMBAT_STATES.WAITING) {
      throw new Error('combat can only be started from WAITING');
    }
    if (this.players.size === 0) {
      throw new Error('combat requires at least one player');
    }

    this.winnerTeamId = null;
    this.combatState = COMBAT_STATES.STARTED;
  }

  reset() {
    this._resetPlayers();
    this._clearEvents();
    this.combatState = COMBAT_STATES.WAITING;
  }

  getPlayer(playerId) {
    return clonePlayer(this._getPlayer(playerId));
  }

  getCombatState() {
    return this.combatState;
  }

  getAliveTeamIds() {
    return Array.from(new Set(
      Array.from(this.players.values())
        .filter((player) => player.alive)
        .map((player) => player.teamId)
    ));
  }

  _getPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error(`unknown player: ${playerId}`);
    return player;
  }

  _resetPlayers() {
    this.winnerTeamId = null;
    for (const player of this.players.values()) {
      player.health = this.maxHealth;
      player.armor = 0;
      player.alive = player.health > 0;
    }
  }

  _queueEvent(event) {
    this._events.push(event);
  }

  _clearEvents() {
    this._events = [];
  }

  _drainEvents() {
    const events = this._events;
    this._events = [];
    return events;
  }

  damage({
    playerId,
    amount,
    sourceId = null,
    bypassArmor = false,
  }) {
    if (this.combatState !== COMBAT_STATES.STARTED) return;

    const player = this._getPlayer(playerId);
    if (!player.alive) {
      return;
    }

    const armorDamage = bypassArmor ? 0 : Math.min(player.armor, amount * this.armorAbsorption);
    const healthDamage = Math.min(player.health, amount - armorDamage);

    player.armor -= armorDamage;
    player.health -= healthDamage;
    player.alive = player.health > 0;

    if (!player.alive) {
      this._queueEvent({
        type: COMBAT_PLAY_EVENTS.PLAYER_KILLED,
        playerId,
        sourceId,
      });
    }
  }

  heal({ playerId, amount }) {
    if (this.combatState !== COMBAT_STATES.STARTED) return;

    const player = this._getPlayer(playerId);
    if (!player.alive) {
      return;
    }

    player.health = Math.min(player.maxHealth, player.health + amount);
  }

  addArmor({ playerId, amount }) {
    if (this.combatState !== COMBAT_STATES.STARTED) return;

    const player = this._getPlayer(playerId);
    player.armor = Math.min(player.maxArmor, player.armor + amount);
  }

  step() {
    this._finishCombatIfResolved();
    return this._drainEvents();
  }

  _finishCombatIfResolved() {
    if (this.combatState !== COMBAT_STATES.STARTED) return;

    const aliveTeamIds = this.getAliveTeamIds();
    if (aliveTeamIds.length > 1) return;

    this.combatState = COMBAT_STATES.FINISHED;
    this.winnerTeamId = aliveTeamIds[0] ?? null;
    this._queueEvent({
      type: COMBAT_PLAY_EVENTS.COMBAT_FINISHED,
      winnerTeamId: this.winnerTeamId,
    });
  }
}
