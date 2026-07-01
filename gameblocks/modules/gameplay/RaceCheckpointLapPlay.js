export const RACE_STATES = Object.freeze({
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  STARTED: 'STARTED',
  FINISHED: 'FINISHED',
});

export const RACE_CHECKPOINT_LAP_EVENTS = Object.freeze({
  RACE_STARTED: 'race.started',
  CHECKPOINT_PASSED: 'checkpoint.passed',
  LAP_COMPLETED: 'lap.completed',
  PLAYER_FINISHED: 'player.finished',
  RACE_FINISHED: 'race.finished',
});

function clonePosition(position) {
  return { x: position.x, y: position.y, z: position.z };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function clonePlayerState(player) {
  return {
    playerId: player.playerId,
    position: clonePosition(player.position),
    completedLaps: player.completedLaps,
    nextCheckpointIndex: player.nextCheckpointIndex,
    finished: player.finished,
    finishOrder: player.finishOrder,
    finishTimeSeconds: player.finishTimeSeconds,
  };
}

function createPlayerState({ playerId, position }) {
  return {
    playerId,
    position: clonePosition(position),
    completedLaps: 0,
    nextCheckpointIndex: 0,
    finished: false,
    finishOrder: null,
    finishTimeSeconds: null,
  };
}

/**
 * Owns a checkpoint-lap race state.
 *
 * Constructor keys:
 * - checkpoints: ordered checkpoint objects with id, position, and radius.
 * - lapCount: laps required to finish.
 * - startingDelaySeconds: optional countdown duration used by startGame().
 */
export class RaceCheckpointLapPlay {
  constructor({
    checkpoints,
    lapCount = 3,
    startingDelaySeconds = 0,
  }) {
    this.checkpoints = checkpoints;
    this.lapCount = lapCount;
    this.checkpointPerLap = checkpoints.length;
    this.startingDelaySeconds = startingDelaySeconds;

    this.players = new Map();
    this.raceState = RACE_STATES.WAITING;
    this.elapsedSeconds = 0;
    this.countdownSeconds = 0;
    this.finishCounter = 0;
    this._events = [];
  }

  addPlayer({ playerId, position }) {
    const player = createPlayerState({ playerId, position });
    if (this.raceState !== RACE_STATES.WAITING) {
      throw new Error('players can only be added while the race is waiting');
    }
    if (this.players.has(playerId)) {
      throw new Error(`player already exists: ${playerId}`);
    }
    this.players.set(playerId, player);
  }

  removePlayer(playerId) {
    if (!this.players.delete(playerId)) {
      throw new Error(`unknown player: ${playerId}`);
    }
  }

  updatePlayer(playerId, position) {
    const player = this._getPlayer(playerId);
    player.position = clonePosition(position);
  }

  startGame() {
    if (this.raceState !== RACE_STATES.WAITING) {
      throw new Error('race can only be started from WAITING');
    }
    if (this.players.size === 0) {
      throw new Error('race requires at least one player');
    }

    this._resetProgress();
    if (this.startingDelaySeconds > 0) {
      this.raceState = RACE_STATES.STARTING;
      this.countdownSeconds = this.startingDelaySeconds;
      return;
    }
    this.raceState = RACE_STATES.STARTED;
    this._queueEvent({ type: RACE_CHECKPOINT_LAP_EVENTS.RACE_STARTED });
  }

  reset() {
    this._resetProgress();
    this._clearEvents();
    this.raceState = RACE_STATES.WAITING;
    this.countdownSeconds = 0;
  }

  getPlayer(playerId) {
    return clonePlayerState(this._getPlayer(playerId));
  }

  getStandings() {
    return Array.from(this.players.values(), clonePlayerState).sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.completedLaps !== b.completedLaps) return b.completedLaps - a.completedLaps;
      if (a.nextCheckpointIndex !== b.nextCheckpointIndex) {
        return b.nextCheckpointIndex - a.nextCheckpointIndex;
      }
      return a.playerId.localeCompare(b.playerId);
    });
  }

  snapshot() {
    return {
      raceState: this.raceState,
      elapsedSeconds: this.elapsedSeconds,
      countdownSeconds: this.countdownSeconds,
      lapCount: this.lapCount,
      checkpointPerLap: this.checkpointPerLap,
      players: Array.from(this.players.values(), clonePlayerState),
      standings: this.getStandings(),
    };
  }

  _getPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error(`unknown player: ${playerId}`);
    return player;
  }

  _resetProgress() {
    this.elapsedSeconds = 0;
    this.finishCounter = 0;
    for (const player of this.players.values()) {
      player.completedLaps = 0;
      player.nextCheckpointIndex = 0;
      player.finished = false;
      player.finishOrder = null;
      player.finishTimeSeconds = null;
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

  _stepCountdown(deltaSeconds) {
    this.countdownSeconds = Math.max(0, this.countdownSeconds - deltaSeconds);
    if (this.countdownSeconds > 0) return;

    this.raceState = RACE_STATES.STARTED;
    this._queueEvent({ type: RACE_CHECKPOINT_LAP_EVENTS.RACE_STARTED });
  }

  _stepPlayer(player) {
    if (player.finished) return;

    const checkpoint = this.checkpoints[player.nextCheckpointIndex];
    if (distanceSquared(player.position, checkpoint.position) > checkpoint.radius * checkpoint.radius) {
      return;
    }

    this._queueEvent({
      type: RACE_CHECKPOINT_LAP_EVENTS.CHECKPOINT_PASSED,
      playerId: player.playerId,
      checkpointId: checkpoint.id,
      checkpointIndex: player.nextCheckpointIndex,
      lap: player.completedLaps + 1,
    });

    player.nextCheckpointIndex += 1;
    if (player.nextCheckpointIndex < this.checkpointPerLap) return;

    player.nextCheckpointIndex = 0;
    player.completedLaps += 1;
    this._queueEvent({
      type: RACE_CHECKPOINT_LAP_EVENTS.LAP_COMPLETED,
      playerId: player.playerId,
      lap: player.completedLaps,
      remainingLaps: this.lapCount - player.completedLaps,
    });

    if (player.completedLaps < this.lapCount) return;

    this.finishCounter += 1;
    player.finished = true;
    player.finishOrder = this.finishCounter;
    player.finishTimeSeconds = this.elapsedSeconds;
    this._queueEvent({
      type: RACE_CHECKPOINT_LAP_EVENTS.PLAYER_FINISHED,
      playerId: player.playerId,
      finishOrder: player.finishOrder,
      finishTimeSeconds: player.finishTimeSeconds,
    });
  }

  step(deltaSeconds = 1 / 60) {
    let raceDeltaSeconds = deltaSeconds;
    if (this.raceState === RACE_STATES.STARTING) {
      const countdownBeforeStep = this.countdownSeconds;
      this._stepCountdown(deltaSeconds);
      raceDeltaSeconds = Math.max(0, deltaSeconds - countdownBeforeStep);
    }
    if (this.raceState === RACE_STATES.STARTED) {
      this.elapsedSeconds += raceDeltaSeconds;
      for (const player of this.players.values()) {
        this._stepPlayer(player);
      }
      this._finishRaceIfComplete();
    }
    return this._drainEvents();
  }

  _finishRaceIfComplete() {
    if (this.raceState !== RACE_STATES.STARTED || this.players.size === 0) return;
    for (const player of this.players.values()) {
      if (!player.finished) return;
    }
    this.raceState = RACE_STATES.FINISHED;
    this._queueEvent({
      type: RACE_CHECKPOINT_LAP_EVENTS.RACE_FINISHED,
      elapsedSeconds: this.elapsedSeconds,
    });
  }
}
