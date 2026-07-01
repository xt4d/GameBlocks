const cloneCell = (cell) => {
  return {
    right: Math.floor(cell.right),
    forward: Math.floor(cell.forward),
  };
};

const cloneCells = (cells = []) => cells.map(cloneCell);

const CARDINAL_DIRECTIONS = [
  {right: 0, forward: 1},
  {right: 1, forward: 0},
  {right: 0, forward: -1},
  {right: -1, forward: 0},
];

function turnRelativeLeft(direction) {
  const index = CARDINAL_DIRECTIONS.findIndex((item) =>
    item.right === direction.right && item.forward === direction.forward
  );

  return CARDINAL_DIRECTIONS[(index + 3) % 4];
}

function turnRelativeRight(direction) {
  const index = CARDINAL_DIRECTIONS.findIndex((item) =>
    item.right === direction.right && item.forward === direction.forward
  );

  return CARDINAL_DIRECTIONS[(index + 1) % 4];
}

export function stepSnakeCell(cell, direction) {
  const current = cloneCell(cell);
  const vector = direction;

  return {
    right: current.right + vector.right,
    forward: current.forward + vector.forward,
  };
}

function createDefaultSegments(
  initialLength,
  direction,
  startCell
) {
  const head = cloneCell(startCell);
  const segments = [head];
  let cursor = head;
  const reverseDirection = {
    right: -direction.right,
    forward: -direction.forward,
  };

  for (let index = 1; index < initialLength; index += 1) {
    cursor = stepSnakeCell(cursor, reverseDirection);
    segments.push(cursor);
  }

  return segments;
}

export class SnakeMotionController {
  constructor({
    initialLength = 4,
    initialDirection = {forward: 1, right: 0},
    startCell = {forward: 0, right: 0},
    segments = null,
    pendingGrowth = 0,
    mode = 'cardinal'
  }) {
    this.mode = mode;
    this.initialLength = Math.max(2, Math.floor(initialLength));
    this.initialDirection = {
      right: initialDirection.right,
      forward: initialDirection.forward,
    };
    this.startCell = cloneCell(startCell);

    this.pendingGrowth = 0;
    this.segments = [];

    this.reset({
      segments,
      pendingGrowth,
    });
  }

  get head() {
    return this.segments[0] ? cloneCell(this.segments[0]) : null;
  }

  get tail() {
    return this.segments.length > 0 ? cloneCell(this.segments[this.segments.length - 1]) : null;
  }

  get length() {
    return this.segments.length;
  }

  getDirection() {
    return {
      right: this.direction.right,
      forward: this.direction.forward,
    };
  }

  reset({
    segments = null,
    initialLength = this.initialLength,
    direction = this.initialDirection,
    startCell = this.startCell,
    pendingGrowth = 0,
  }) {

    this.direction = {
      right: direction.right,
      forward: direction.forward,
    };
    this.segments = segments
      ? cloneCells(segments)
      : createDefaultSegments(initialLength, direction, startCell);
    this.pendingGrowth = Math.max(0, Math.floor(pendingGrowth));
    return this.getSegments();
  }

  grow(amount = 1) {
    this.pendingGrowth += Math.max(0, Math.floor(amount));
    return this.pendingGrowth;
  }

  // left/right: true turns toward the relative left/right directions in chase mode.
  // left/right/forward/backward: true moves toward allowed basis-cardinal directions in cardinal mode.
  move({
    left = false,
    right = false,
    forward = false,
    backward = false
  }) {
    let direction = {
      right: this.direction.right,
      forward: this.direction.forward,
    };

    if (this.mode === 'chase') {
      if (left && !right) {
        direction = turnRelativeLeft(direction);
      } else if (right && !left) {
        direction = turnRelativeRight(direction);
      }
    } else if (direction.forward !== 0) {
      if (left && !right) {
        direction = CARDINAL_DIRECTIONS[3];
      } else if (right && !left) {
        direction = CARDINAL_DIRECTIONS[1];
      }
    } else if (direction.right !== 0) {
      if (forward && !backward) {
        direction = CARDINAL_DIRECTIONS[0];
      } else if (backward && !forward) {
        direction = CARDINAL_DIRECTIONS[2];
      }
    }

    const head = this.head;
    const nextHead = stepSnakeCell(head, direction);
    const isGrowing = this.pendingGrowth > 0;
    const pendingGrowth = this.pendingGrowth;
    const pendingGrowthAfter = Math.max(0, pendingGrowth - (isGrowing ? 1 : 0));
    const segments = [
      nextHead,
      ...this.segments.slice(0, isGrowing ? this.segments.length : -1),
    ];

    this.direction = {
      right: direction.right,
      forward: direction.forward,
    };
    this.pendingGrowth = pendingGrowthAfter;
    this.segments = cloneCells(segments);

    return {
      direction: {
        right: direction.right,
        forward: direction.forward,
      },
      segments: this.getSegments(),
    };
  }

  getSegments() {
    return cloneCells(this.segments);
  }
}
