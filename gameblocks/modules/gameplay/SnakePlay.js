export const SNAKE_PLAY_EVENTS = Object.freeze({
  ITEM_PICKED_UP: 'snake.item.picked-up',
  PLAYER_DIED: 'snake.died',
});

export const SNAKE_DEATH_REASONS = Object.freeze({
  WALL: 'wall',
  SELF: 'self',
  SNAKE: 'snake',
});

function cloneCell(cell) {
  return {
    right: Math.floor(cell.right),
    forward: Math.floor(cell.forward),
  };
}

function cloneCells(cells) {
  return cells.map(cloneCell);
}

function cellKey(cell) {
  return `${cell.right}:${cell.forward}`;
}

function clonePlayer(player) {
  return {
    playerId: player.playerId,
    segments: cloneCells(player.segments),
    alive: player.alive,
  };
}

function createPlayer({ playerId, segments }) {
  return {
    playerId,
    segments: cloneCells(segments),
    alive: true,
  };
}

export class SnakePlay {
  constructor({ minRight, maxRight, minForward, maxForward }) {
    this.minRight = Math.floor(minRight);
    this.maxRight = Math.floor(maxRight);
    this.minForward = Math.floor(minForward);
    this.maxForward = Math.floor(maxForward);
    this.players = new Map();
    this.items = new Map();
  }

  addPlayer({ playerId, segments }) {
    if (this.players.has(playerId)) {
      throw new Error(`player already exists: ${playerId}`);
    }

    this.players.set(playerId, createPlayer({ playerId, segments }));
  }

  movePlayer({ playerId, segments }) {
    const player = this._getPlayer(playerId);
    player.segments = cloneCells(segments);
  }

  addItem({ cell, growth = 1 }) {
    const nextItem = {
      cell: cloneCell(cell),
      growth: Math.max(0, Math.floor(growth)),
    };
    const key = cellKey(nextItem.cell);
    if (this.items.has(key)) {
      throw new Error(`item already exists at cell: ${key}`);
    }

    this.items.set(key, nextItem);
  }

  step() {
    const events = [];
    const alivePlayerIds = new Set(
      Array.from(this.players.values())
        .filter((player) => player.alive)
        .map((player) => player.playerId)
    );

    for (const player of this.players.values()) {
      if (!alivePlayerIds.has(player.playerId)) continue;

      const head = player.segments[0] ? cloneCell(player.segments[0]) : null;
      if (!head || this._isWall(head)) {
        player.alive = false;
        events.push(this._createDeathEvent(player, SNAKE_DEATH_REASONS.WALL, head));
        continue;
      }

      if (this._hitsSelf(player)) {
        player.alive = false;
        events.push(this._createDeathEvent(player, SNAKE_DEATH_REASONS.SELF, head));
        continue;
      }

      const hitPlayer = this._playerAt(head, player.playerId, alivePlayerIds);
      if (hitPlayer) {
        player.alive = false;
        events.push(this._createDeathEvent(
          player,
          SNAKE_DEATH_REASONS.SNAKE,
          head,
          hitPlayer.playerId
        ));
        continue;
      }

      const itemKey = cellKey(head);
      const item = this.items.get(itemKey);
      if (!item) continue;

      this.items.delete(itemKey);
      const growBy = item.growth;
      events.push({
        type: SNAKE_PLAY_EVENTS.ITEM_PICKED_UP,
        playerId: player.playerId,
        cell: cloneCell(item.cell),
        growBy,
      });
    }

    return events;
  }

  getPlayerState(playerId) {
    return clonePlayer(this._getPlayer(playerId));
  }

  getItemState() {
    return Array.from(this.items.values()).map((item) => {
      return {
        cell: cloneCell(item.cell),
        growth: item.growth,
      };
    });
  }

  _createDeathEvent(player, reason, cell, hitPlayerId = null) {
    const event = {
      type: SNAKE_PLAY_EVENTS.PLAYER_DIED,
      playerId: player.playerId,
      reason,
      cell: cell ? cloneCell(cell) : null,
    };
    if (hitPlayerId) event.hitPlayerId = hitPlayerId;

    return event;
  }

  _isWall(cell) {
    return (
      cell.right < this.minRight
      || cell.right > this.maxRight
      || cell.forward < this.minForward
      || cell.forward > this.maxForward
    );
  }

  _hitsSelf(player) {
    if (player.segments.length <= 1) return false;
    const headKey = cellKey(player.segments[0]);
    return player.segments
      .slice(1)
      .some((segment) => cellKey(segment) === headKey);
  }

  _playerAt(cell, excludePlayerId, alivePlayerIds = null) {
    const key = cellKey(cell);
    for (const player of this.players.values()) {
      if (player.playerId === excludePlayerId) continue;
      if (alivePlayerIds ? !alivePlayerIds.has(player.playerId) : !player.alive) continue;
      if (player.segments.some((segment) => cellKey(segment) === key)) return player;
    }
    return null;
  }

  _getPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error(`unknown player: ${playerId}`);
    return player;
  }
}
