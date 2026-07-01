import * as THREE from 'three';
import { JetFlameLocalVisual } from '../../visual-effects/JetFlame.js';

export function createAirplaneVisual({
  scale = 8,
  bodyColor = 0xe1ebf5,
  bodyEmissive = 0x000000,
  bodyEmissiveIntensity = 0,
  bodyMetalness = 0.78,
  bodyRoughness = 0.28,
  accentColor = 0xffa33a,
  accentEmissive = 0x5a2200,
  accentEmissiveIntensity = 0.26,
  accentMetalness = 0.44,
  accentRoughness = 0.42,
  canopyColor = 0x87cefa,
  canopyEmissive = 0x102c4b,
  canopyEmissiveIntensity = 0.4,
  canopyOpacity = 0.9,
  showCanopy = true,
  showJetFlames = true,
  showEngineGlow = false,
  engineGlowColor = 0xffb35b,
  engineGlowOpacity = 0.78,
  showCentroid = false,
  centroidColor = 0xff2bd6,
  showTargetRing = false,
  targetRingName = 'AirplaneTargetRing',
  targetRingColor = 0xff775c,
  targetRingRadius = 2.15,
  targetRingTube = 0.035,
  targetRingOpacity = 0.36,
}) {
  const group = new THREE.Group();
  const airframe = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    emissive: bodyEmissive,
    emissiveIntensity: bodyEmissiveIntensity,
    metalness: bodyMetalness,
    roughness: bodyRoughness,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentEmissive,
    emissiveIntensity: accentEmissiveIntensity,
    metalness: accentMetalness,
    roughness: accentRoughness,
  });
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: canopyColor,
    emissive: canopyEmissive,
    emissiveIntensity: canopyEmissiveIntensity,
    metalness: 0.18,
    roughness: 0.14,
    transparent: true,
    opacity: canopyOpacity,
  });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.36, 3.6, 18),
    bodyMaterial
  );
  // CylinderGeometry head faces +Y, rotate -90 (clockwise) to make its head face -Z (local forward)
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.castShadow = true;
  airframe.add(fuselage);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.96, 18),
    accentMaterial
  );
  // ConeGeometry is same to CylinderGeometry
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.25;
  nose.castShadow = true;
  airframe.add(nose);

  if (showCanopy) {
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12),
      canopyMaterial
    );
    canopy.scale.set(1.05, 0.7, 1.8);
    canopy.position.set(0, 0.25, -0.35);
    airframe.add(canopy);
  }

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 0.1, 0.76),
    bodyMaterial
  );
  wing.position.set(0, -0.02, 0.16);
  wing.castShadow = true;
  airframe.add(wing);

  const wingTip = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.04, 0.2),
    accentMaterial
  );
  wingTip.position.set(0, 0.06, -0.04);
  wingTip.castShadow = true;
  airframe.add(wingTip);

  const tailWing = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.08, 0.42),
    bodyMaterial
  );
  tailWing.position.set(0, 0.28, 1.22);
  tailWing.castShadow = true;
  airframe.add(tailWing);

  const tailFin = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.86, 0.56),
    accentMaterial
  );
  tailFin.position.set(0, 0.56, 1.18);
  tailFin.castShadow = true;
  airframe.add(tailFin);

  const engineGeometry = new THREE.CylinderGeometry(0.14, 0.19, 1.15, 12);
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(engineGeometry, bodyMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.34, -0.1, 1.25);
    engine.castShadow = true;
    airframe.add(engine);
  }

  const airframeCenter = new THREE.Box3()
    .setFromObject(airframe)
    .getCenter(new THREE.Vector3());
  airframe.position.sub(airframeCenter);

  const jetFlames = [];
  if (showJetFlames) {
    const flameLeft = new JetFlameLocalVisual();
    const flameRight = new JetFlameLocalVisual();
    flameLeft.group.position.set(-0.34, -0.1, 1.78);
    flameRight.group.position.set(0.34, -0.1, 1.78);
    airframe.add(flameLeft.group);
    airframe.add(flameRight.group);
    jetFlames.push(flameLeft, flameRight);
  }

  if (showEngineGlow) {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: engineGlowColor,
      transparent: true,
      opacity: engineGlowOpacity,
    });
    for (const side of [-1, 1]) {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        glowMaterial.clone()
      );
      glow.position.set(side * 0.32, -0.1, 1.82);
      airframe.add(glow);
    }
  }

  group.add(airframe);

  if (showCentroid) {
    const centroidMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshBasicMaterial({
        color: centroidColor,
        depthTest: false,
        depthWrite: false,
      })
    );
    centroidMarker.name = 'PlaneCentroidMarker';
    centroidMarker.renderOrder = 1000;
    group.add(centroidMarker);
  }

  let targetRing = null;
  if (showTargetRing) {
    targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(targetRingRadius, targetRingTube, 8, 36),
      new THREE.MeshBasicMaterial({
        color: targetRingColor,
        transparent: true,
        opacity: targetRingOpacity,
        depthWrite: false,
      })
    );
    targetRing.name = targetRingName;
    targetRing.renderOrder = 4;
    group.add(targetRing);
  }

  group.scale.setScalar(scale);

  return {
    group,
    airframe,
    jetFlames,
    targetRing,
  };
}
