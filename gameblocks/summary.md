# GameBlocks Modules Summary

This document summarizes the GameBlocks modules under `modules/`. Each entry states the main capability the module provides. The 3D coordinate system is right-handed.

Module dependencies:

1. ThreeJS: `https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js`
2. Rapier3D: `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.14.0/rapier.es.js`

## Actor Motion

### `modules/actor-motion/KinematicBatchResolver.js`
- Functionality: Resolves many kinematic movement requests through Rapier collision and returns grounded/collision outcomes.

### `modules/actor-motion/GeneralVehicleMotionController.js`
- Functionality: Converts local vehicle controls into general-purpose motion with six-axis shifting, four-way path steering, independent body yaw rotation, optional body banking, and instant or acceleration-based response. Supports a wide range of vehicles across aircraft, watercraft, spacecraft, and landcraft.

### `modules/actor-motion/GeneralObjectModelController.js`
- Functionality: Applies caller-provided position and pose frame to object model transforms, with configurable mesh forward direction and optional keep-basis-up alignment.

### `modules/actor-motion/aircraft/AirplaneModelController.js`
- Functionality: Applies flight motion state to airplane visual transforms, including position, yaw, pitch, and roll.

### `modules/actor-motion/aircraft/AirplaneMotionController.js`
- Functionality: Converts local pilot controls for steering, throttle, and boost into fixed-wing airplane motion.

### `modules/actor-motion/character/BaseCharacterMotionController.js`
- Functionality: Provides shared grounded character locomotion for position, velocity, yaw/pitch, sprint, crouch, jump, gravity, resolver intent creation, and commit behavior.

### `modules/actor-motion/character/WorldTargetCharacterMotionController.js`
- Functionality: Converts world-space move and face target points into shared character locomotion. Recommended camera pairing: `PositionFollowCameraRig`.

### `modules/actor-motion/character/WorldCardinalCharacterMotionController.js`
- Functionality: Converts world-space left/right/forward/backward movement and rotateCCW/rotateCW input into shared character locomotion. Recommended camera pairing: `PositionFollowCameraRig`.

### `modules/actor-motion/character/HeadingRelativeCharacterMotionController.js`
- Functionality: Converts character-heading-relative forward/backward movement, strafeLeft/strafeRight movement, and turnLeft/turnRight input into shared character locomotion. Recommended camera pairing: `PoseFollowCameraRig`.

### `modules/actor-motion/character/MouseLookCharacterMotionController.js`
- Functionality: Converts local left/right/forward/backward movement plus mouse-look yaw/pitch deltas into shared character locomotion. Recommended camera pairing: `FirstPersonCameraRig` for first-person view or `PoseFollowCameraRig` for third-person chase view.

### `modules/actor-motion/ground-vehicle/DriftingPlugin.js`
- Functionality: Adds drift response to dynamic car physics by detecting slip and modifying car control behavior.

### `modules/actor-motion/ground-vehicle/DynamicCarBatchResolver.js`
- Functionality: Resolves dynamic Rapier car physics for multiple actors and returns synchronized car state.

### `modules/actor-motion/ground-vehicle/DynamicCarMotionController.js`
- Functionality: Converts local driver controls for steering, throttle, reverse, brake, handbrake, and boost into dynamic car control intent for full wheel-physics simulation.

### `modules/actor-motion/ground-vehicle/DynamicCarRapierConfig.js`
- Functionality: Builds basis-aware dynamic car setup data for Rapier vehicle controllers.

### `modules/actor-motion/ground-vehicle/CarModelController.js`
- Functionality: Applies car motion state to visual transforms, including vehicle body pose and wheel animation.

### `modules/actor-motion/ground-vehicle/ArcadeCarMotionController.js`
- Functionality: Converts local driver controls for steering, throttle, reverse, and boost into lightweight arcade car motion with basic terrain height/normal following.

### `modules/actor-motion/PlateTiltController.js`
- Functionality: Converts directional tilt controls into smoothed plate rotations and gameplay slope values.

### `modules/actor-motion/SnakeMotionController.js`
- Functionality: Converts snake turn and growth input into updated grid-cell direction and segment state.

## Behavior

### `modules/behavior/NearbyAvoidanceSteering.js`
- Functionality: Adjusts planar movement intent to steer an actor away from nearby agents while preserving intended travel direction.

### `modules/behavior/GridPathPlanner.js`
- Functionality: Plans grid-board routes and reachable cells with blocked cells and wrapping or bounded edges.

### `modules/behavior/AgentPathNavigator.js`
- Functionality: Converts character position, current waypoint, and speed limit into planar movement intent, including direction, desired speed, waypoint, and distance.

### `modules/behavior/WaypointProgressTracker.js`
- Functionality: Tracks route progress by advancing waypoints after the reach distance is met and reporting the current waypoint, progress, and corner profile.

### `modules/behavior/WaypointDriver.js`
- Functionality: Converts waypoint, vehicle pose, speed, and corner profile into AI vehicle controls, including throttle, reverse, brake, left/right steering, and boost.

### `modules/behavior/CombatBehaviorDirector.js`
- Functionality: Maintains tactical state for shooter agents as they idle, patrol, chase, attack, or die.

## Camera

### `modules/camera/BaseCameraRig.js`
- Functionality: Provides base smoothing and basis-aware pose behavior for concrete camera rigs.

### `modules/camera/PositionFollowCameraRig.js`
- Functionality: Follows a target position with a fixed world-basis offset and fixed viewing angle while looking at the target.

### `modules/camera/PoseFollowCameraRig.js`
- Functionality: Follows a target position and targetFrame with a pose-relative offset and pose-relative look target so the view moves and turns with the target.

### `modules/camera/FirstPersonCameraRig.js`
- Functionality: Follows a target eye position and current forward direction to produce actor-locked first-person view motion.

### `modules/camera/LookOffsetCameraRig.js`
- Functionality: Applies temporary free-look rotation around a target and recenters the view when look input stops.

## Gameplay

### `modules/gameplay/AimResolver.js`
- Functionality: Resolves screen/camera aiming or explicit ray aiming into hit position, aim direction, matched target, and launch-to-hit shooting direction.

### `modules/gameplay/CombatPlay.js`
- Functionality: Owns team combat player state, health and armor changes, death events, winner resolution, and reset behavior.

### `modules/gameplay/FlightPlay.js`
- Functionality: Owns flight player state, terrain crash checks, hit-ground events, finish state, and reset behavior.

### `modules/gameplay/RaceCheckpointLapPlay.js`
- Functionality: Owns checkpoint-lap race state, countdown start, player progress, lap completion, finish order, standings, race events, and reset behavior.

### `modules/gameplay/SnakePlay.js`
- Functionality: Owns snake player and item state, wall collisions, self collisions, snake collisions, item pickups, death events, and reset behavior.

### `modules/gameplay/WaveSpawnDirector.js`
- Functionality: Schedules and spawns enemy waves, escalates spawn pressure, and advances waves as active units are cleared.

### `modules/gameplay/combat/ProjectileWeaponSystem.js`
- Functionality: Manages gun and missile weapon selection, ammo, cooldowns, gun heat, missile lock-on targeting, and fire decisions with launch position, direction, and speed.

### `modules/gameplay/combat/ProjectileManager.js`
- Functionality: Manages live projectile objects, removes inactive projectiles, and returns projectile hit events.

## Math

### `modules/math/RandomUtils.js`
- Functionality: Provides a deterministic pseudo-random generator with uniform, integer range, step range, and choice helpers.

### `modules/math/ScalarUtils.js`
- Functionality: Provides shared scalar operations for stable numeric motion and value normalization.

### `modules/math/TimeUtils.js`
- Functionality: Provides system and manually controlled clock helpers for consistent millisecond and second timestamps.

### `modules/math/Vector3Utils.js`
- Functionality: Normalizes vector inputs into safe Three.js vectors and basis-aware planar directions.

### `modules/math/WorldBasis.js`
- Functionality: Defines how gameplay directions map onto world axes and keeps basis-aware movement, height, compass, and frame math consistent.

## User Interface

### `modules/user-interface/DomHudRenderer.js`
- Functionality: Renders shared UI state into DOM HUD elements.

### `modules/user-interface/MinimapProjector2D.js`
- Functionality: Maps world-space positions and headings into minimap-space coordinates.

### `modules/user-interface/NotificationQueue.js`
- Functionality: Maintains visible and pending notification state over time.

### `modules/user-interface/HeadingRelativeRadar.js`
- Functionality: Renders nearby contacts in heading-relative radar space.

### `modules/user-interface/StorageSettingsStore.js`
- Functionality: Persists user settings safely through localStorage.

### `modules/user-interface/UiStateModel.js`
- Functionality: Provides observable UI state updates with stable snapshots.

### `modules/user-interface/FlightHud.js`
- Functionality: Renders flight, weapon, navigation, scoring, and warning state as a cockpit-style HUD.

### `modules/user-interface/RaceMinimap.js`
- Functionality: Renders race progress and competitors into a track-aware minimap.

## World

### `modules/world/Object3DUtils.js`
- Functionality: Removes and disposes Three.js object hierarchies, including geometry and material resources.

### `modules/world/environment/ArenaEnvironment.js`
- Functionality: Builds arena scene visuals with obstacles and walls, supports spawn position sampling and obstacle queries, and creates explicit Rapier physics colliders.

### `modules/world/environment/NaturalEnvironment.js`
- Functionality: Builds natural scene visuals with terrain and tree/rock/grass props, supports terrain height queries, and creates explicit terrain/tree/rock Rapier physics colliders.

### `modules/world/environment/RaceTrackEnvironment.js`
- Functionality: Builds race-track scene visuals with road terrain, checkpoint markers, and barriers, supports spawn pose sampling, and creates explicit terrain/barrier Rapier physics colliders.

### `modules/world/environment/BoardEnvironment.js`
- Functionality: Builds board scene visuals with grid cells and lighting, supports cell/world coordinate helpers, and exposes grid bounds.

### `modules/world/environment/TerrainMeshFactory.js`
- Functionality: Builds vertex-colored terrain meshes from terrain sampler output and matching Rapier trimesh colliders.

### `modules/world/environment/TerrainSampler.js`
- Functionality: Provides terrain sampler classes that expose `heightAt`, `normalAt`, `colorAt`, and `sample(right, forward)` for procedural worlds. Includes natural grassland terrain, archipelago terrain, and road terrain via road flattening.

### `modules/world/environment/WorldBoundsColliderFactory.js`
- Functionality: Builds physical boundary wall colliders around a basis-aware planar world area.

### `modules/world/environment/SpawnAreaSampler.js`
- Functionality: Samples planar spawn positions inside optional allowed regions while rejecting blocked regions, using simple rect, circle, polygon, and segment-corridor shape contracts.

### `modules/world/environment/PlanarUtils.js`
- Functionality: Provides shared basis-aware planar geometry and terrain helpers.

### `modules/world/object/PickupObject.js`
- Functionality: Updates pickup world state, including visual animation, collection bounds, and collection checks.

### `modules/world/object/ProjectileObject.js`
- Functionality: Updates projectile world state, including linear or homing motion, hit checks, visual updates, and expiry.

### `modules/world/object/FpsWeaponViewModel.js`
- Functionality: Updates first-person weapon presentation from player movement, stance, aiming, and recoil state.

### `modules/world/object/HealthBarView.js`
- Functionality: Updates floating world-space health presentation above an entity.

### `modules/world/object/factory/AirplaneVisualFactory.js`
- Functionality: Builds airplane visual models for flight actors.

### `modules/world/object/factory/PlantVisualFactory.js`
- Functionality: Builds plant visual models and materials for natural environments, including tree trunks, conifer and broadleaf canopies, branch stubs, and grass blades.

### `modules/world/object/factory/RockVisualFactory.js`
- Functionality: Builds rock visual models and materials for natural environments, including ground rocks and irregular rock meshes with randomized shape variation.

### `modules/world/object/factory/PickupVisualFactory.js`
- Functionality: Builds pickup visual models for ammo, health, and armor pickups.

### `modules/world/object/factory/ProjectileVisualFactory.js`
- Functionality: Builds projectile visual models and update helpers for bullets and missiles.

### `modules/world/object/factory/CarVisualFactory.js`
- Functionality: Builds lightweight car visual models for racing and prototype vehicles.

### `modules/world/visual-effects/JetFlame.js`
- Functionality: Renders jet exhaust intensity from aircraft throttle and boost state.

### `modules/world/visual-effects/GroundClickIndicator.js`
- Functionality: Renders a fading ground marker for click or target feedback.

### `modules/world/visual-effects/VehicleTireMarkRenderer.js`
- Functionality: Renders terrain-following tire trails from grounded vehicle motion.

### `modules/world/visual-effects/WeaponEffectsSystem.js`
- Functionality: Renders short-lived visual feedback for weapon fire and impacts.
