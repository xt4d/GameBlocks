import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

export const FLIGHT_PLAY_EVENTS = Object.freeze({
  PLAYER_HIT_GROUND: 'flight.player.hitGround'
});

function clonePosition(position) {
  return { x: position.x, y: position.y, z: position.z };
}

function clonePlayer(player) {
  return {
    playerId: player.playerId,
    position: clonePosition(player.position),
    finished: player.finished,
  };
}

function createPlayer({ playerId, position }) {
  return {
    playerId,
    position: clonePosition(position),
    finished: false,
  };
}

export class FlightPlay {
  constructor({ crashHeightAt, basis = DEFAULT_WORLD_BASIS}) {
    if (typeof crashHeightAt !== 'function') {
      throw new Error('FlightPlay requires crashHeightAt');
    }

    this.crashHeightAt = crashHeightAt;
    this.basis = basis;
    this.players = new Map();
    this._events = [];
  }

  addPlayer({ playerId, position }) {
    if (this.players.has(playerId)) {
      throw new Error(`player already exists: ${playerId}`);
    }
    this.players.set(playerId, createPlayer({ playerId, position }));
  }

  movePlayer(playerId, position) {
    this._getPlayer(playerId).position = clonePosition(position);
  }

  startGame() {
    if (this.players.size === 0) {
      throw new Error('flight requires at least one player');
    }

    for (const player of this.players.values()) {
      player.finished = false;
    }
  }

  reset() {
    this._clearEvents();
    for (const player of this.players.values()) {
      player.finished = false;
    }
  }

  getPlayer(playerId) {
    return clonePlayer(this._getPlayer(playerId));
  }

  _getPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error(`unknown player: ${playerId}`);
    return player;
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

  step() {
    for (const player of this.players.values()) {
      if (player.finished) continue;

      const planar = this.basis.toPlanar(player.position);
      const crashHeight = this.crashHeightAt(planar.right, planar.forward);
      const playerHeight = this.basis.upComponent(player.position);
      if (playerHeight > crashHeight) continue;

      player.finished = true;
      this._queueEvent({
        type: FLIGHT_PLAY_EVENTS.PLAYER_HIT_GROUND,
        playerId: player.playerId,
        position: clonePosition(player.position),
        height: playerHeight,
        crashHeight,
      });
    }

    return this._drainEvents();
  }
}
