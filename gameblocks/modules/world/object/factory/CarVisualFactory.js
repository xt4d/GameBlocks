import * as THREE from 'three';

export function createCarVisual({
  paintColor = 0xc75238,
  cabinColor = 0xf4f7ff,
  wheelColor = 0x181c22,
  arrowColor = null,
  wheelOffsets = [
    [-0.84, 0.26, -1.07],
    [0.84, 0.26, -1.07],
    [-0.84, 0.26, 1.07],
    [0.84, 0.26, 1.07],
  ]
}) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.58, 3.0),
    new THREE.MeshStandardMaterial({ color: paintColor, metalness: 0.1 })
  );
  body.position.y = 0.42;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.45, 1.3),
    new THREE.MeshStandardMaterial({ color: cabinColor, metalness: 0.08 })
  );
  cabin.position.set(0, 0.83, -0.1);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  group.add(cabin);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: wheelColor });
  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.32, 16);
  wheelGeometry.rotateZ(Math.PI * 0.5);

  const wheels = [];
  const wheelPivots = [];
  for (const [x, y, z] of wheelOffsets) {
    const wheelPivot = new THREE.Group();
    wheelPivot.position.set(x, y, z);

    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    wheelPivot.add(wheel);
    group.add(wheelPivot);

    wheelPivots.push(wheelPivot);
    wheels.push(wheel);
  }

  const forwardArrow = arrowColor == null
    ? null
    : new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 0),
      3.6,
      arrowColor,
      0.8,
      0.5
    );

  if (forwardArrow) group.add(forwardArrow);

  return {
    group,
    wheels,
    wheelPivots,
    forwardArrow,
  };
}
