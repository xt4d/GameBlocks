import { DEFAULT_WORLD_BASIS } from '../../math/WorldBasis.js';

function createWallCollider(
  world,
  rapier,
  position,
  spanRight,
  spanUp,
  spanForward,
  rotation,
  friction = 1,
  restitution = 0,
) {
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotation)
  );
  const collider = world.createCollider(
    rapier.ColliderDesc.cuboid(spanRight * 0.5, spanUp * 0.5, spanForward * 0.5)
      .setFriction(friction)
      .setRestitution(restitution),
    body
  );
  return { body, collider };
}

export function createWorldBoundsColliders({
  world,
  rapier,
  minRight = -88,
  maxRight = 88,
  minForward = -88,
  maxForward = 88,
  wallThickness = 1.6,
  wallHeight = 16,
  centerUp = 0,
  friction = 1,
  restitution = 0,
  basis = DEFAULT_WORLD_BASIS,
}) {
  if (!world || !rapier) {
    throw new Error('World bounds collider factory requires both world and rapier');
  }
  if (!(maxRight > minRight) || !(maxForward > minForward)) {
    throw new Error('createWorldBoundsColliders: min bounds must be smaller than max bounds');
  }

  const worldBasis = basis;
  const rotation = worldBasis.threeObjectCanonicalToBasisQuaternion();
  const spanRight = maxRight - minRight;
  const spanForward = maxForward - minForward;
  const centerRight = (minRight + maxRight) * 0.5;
  const centerForward = (minForward + maxForward) * 0.5;

  const walls = [
    {
      right: minRight - wallThickness * 0.5,
      forward: centerForward,
      spanRight: wallThickness,
      spanForward: spanForward + wallThickness,
    },
    {
      right: maxRight + wallThickness * 0.5,
      forward: centerForward,
      spanRight: wallThickness,
      spanForward: spanForward + wallThickness,
    },
    {
      right: centerRight,
      forward: minForward - wallThickness * 0.5,
      spanRight: spanRight + wallThickness,
      spanForward: wallThickness,
    },
    {
      right: centerRight,
      forward: maxForward + wallThickness * 0.5,
      spanRight: spanRight + wallThickness,
      spanForward: wallThickness,
    },
  ];

  return walls.map((wall) => {
    const position = worldBasis.fromBasisComponents(
      wall.right,
      centerUp,
      wall.forward
    );
    return {
      ...createWallCollider(
        world,
        rapier,
        position,
        wall.spanRight,
        wallHeight,
        wall.spanForward,
        rotation,
        friction,
        restitution
      ),
    };
  });
}
