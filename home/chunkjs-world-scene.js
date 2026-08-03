import cottageDefinition from "../build_ncm/buildings/coastal/seaside-cottage.json";
import noticeBoardDefinition from "../build_ncm/buildings/civic/covered-village-notice-board.json";
import hollowCottageDefinition from "../build_ncm/buildings/residential/hollow-cottage.json";
import footbridgeDefinition from "../build_ncm/buildings/transport/stone-timber-footbridge.json";
import windmillDefinition from "../build_ncm/buildings/agriculture/stone-timber-tower-windmill.json";
import {
  ACTOR_SITES,
  DESKTOP_TERRAIN_VIEW_DISTANCE,
  ECONOMY_FLOW_SITES,
  MINING_TARGET,
  MOBILE_TERRAIN_VIEW_DISTANCE,
  PRESENTATION_GROUND_Y,
  PRESENTATION_WATER_BED_Y,
  STRUCTURE_LAYOUT,
  WORLD_CENTER,
} from "./home-world-layout.js";
import {
  applyHomeWorldTerrain,
  loadHomeWorldTerrain,
} from "./home-world-terrain.js";

const DEFAULT_RUNTIME_ROOT = "/chunk.js";
const CHUNK_RUNTIME_BUNDLE = "chunk/browser-runtime.js";
const CHUNK_WORKER_BUNDLE = "chunk/chunk-build-worker.bundle.js";
const SECTION_VIEWS = Object.freeze(["arrival", "world", "market", "guardian", "roadmap"]);
const CAMERA_TRANSITION_MS = 1_180;
const WINDMILL_ROTATION_MS = 42_000;
const WINDMILL_FRAME_MS = 1_000 / 12;
const WINDMILL_VERTEX_PACK_SCALE = 64;
const BUILDING_INSPECTOR_MIN_VIEWPORT = 901;
const BUILDING_INSPECTOR_MIN_TARGET_PX = 30;
const BUILDING_OUTLINE_MASK_SCALE = 0.5;
const BUILDING_OUTLINE_MASK_MAX_SIZE = 640;
const BUILDING_OUTLINE_MASK_ALPHA_THRESHOLD = 72;
const BUILDING_OUTLINE_SIMPLIFY_TOLERANCE = 1.15;
const AVATAR_HEIGHT_BLOCKS = 1.75 / 0.4;
const AVATAR_VISUAL_SCALE = AVATAR_HEIGHT_BLOCKS / 2.52;
const buildingOutlineCache = new WeakMap();
let buildingOutlineMaskCanvas = null;
const ACTOR_ROUTES = Object.freeze({
  boy: createRoute([
    routeStop("idle", ACTOR_SITES.boy, 4_000),
    routeWalk(ACTOR_SITES.boy, { x: 2506, z: 1750 }, 9_000),
    routeWalk({ x: 2506, z: 1750 }, ACTOR_SITES.bridgeEast, 9_000),
    routeWalk(ACTOR_SITES.bridgeEast, ACTOR_SITES.bridgeWest, 8_400),
    routeWalk(ACTOR_SITES.bridgeWest, { x: 2408, z: 1678 }, 7_000),
    routeWalk({ x: 2408, z: 1678 }, ACTOR_SITES.boyMine, 7_200),
    routeStop("mine", ACTOR_SITES.boyMine, 5_200, { lookAt: MINING_TARGET }),
    routeWalk(ACTOR_SITES.boyMine, { x: 2408, z: 1678 }, 7_200),
    routeWalk({ x: 2408, z: 1678 }, ACTOR_SITES.bridgeWest, 7_000),
    routeWalk(ACTOR_SITES.bridgeWest, ACTOR_SITES.bridgeEast, 8_400),
    routeWalk(ACTOR_SITES.bridgeEast, { x: 2506, z: 1750 }, 9_000),
    routeWalk({ x: 2506, z: 1750 }, ACTOR_SITES.boy, 9_000),
  ]),
  girl: createRoute([
    routeStop("idle", ACTOR_SITES.girl, 4_400),
    routeWalk(ACTOR_SITES.girl, { x: 2516, z: 1748 }, 9_000),
    routeWalk({ x: 2516, z: 1748 }, ACTOR_SITES.bridgeEast, 9_000),
    routeWalk(ACTOR_SITES.bridgeEast, ACTOR_SITES.bridgeWest, 8_400),
    routeWalk(ACTOR_SITES.bridgeWest, ACTOR_SITES.girlCottage, 8_200),
    routeStop("idle", ACTOR_SITES.girlCottage, 3_600, { yaw: 1.48 }),
    routeWalk(ACTOR_SITES.girlCottage, ACTOR_SITES.bridgeWest, 8_200),
    routeWalk(ACTOR_SITES.bridgeWest, ACTOR_SITES.bridgeEast, 8_400),
    routeWalk(ACTOR_SITES.bridgeEast, { x: 2516, z: 1748 }, 9_000),
    routeWalk({ x: 2516, z: 1748 }, ACTOR_SITES.girl, 9_000),
  ]),
});
const STRUCTURE_DEFINITIONS = Object.freeze({
  cottage: cottageDefinition,
  noticeBoard: noticeBoardDefinition,
  hollowCottage: hollowCottageDefinition,
  footbridge: footbridgeDefinition,
  windmill: windmillDefinition,
});
const STRUCTURE_SPECS = Object.freeze(STRUCTURE_LAYOUT.map((spec) => Object.freeze({
  ...spec,
  definition: STRUCTURE_DEFINITIONS[spec.definitionKey],
})));

const CAMERA_PRESETS = Object.freeze({
  arrival: Object.freeze({
    eye: [2548, 117, 1780],
    target: [2465, 101, 1710],
    fov: 43,
  }),
  world: Object.freeze({
    eye: [2444, 112, 1705],
    target: [2388, 101, 1647],
    fov: 39,
  }),
  market: Object.freeze({
    eye: [2543, 113, 1771],
    target: [2488, 102, 1724],
    fov: 39,
  }),
  guardian: Object.freeze({
    eye: [2570, 115, 1718],
    target: [2519, 103, 1657],
    fov: 39,
  }),
  roadmap: Object.freeze({
    eye: [2570, 134, 1708],
    target: [2525, 117, 1646],
    fov: 41,
  }),
});

export function createHomeWorldScene(canvas, options = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return createNoopController();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const inspectorHoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
  const lowPower = Number(navigator.deviceMemory || 8) <= 4 || navigator.connection?.saveData === true;
  const requestedFps = Number(options.maxFps) || (window.innerWidth < 700 ? 20 : 30);
  const maxFps = Math.max(12, Math.min(lowPower ? 20 : 30, requestedFps));
  const terrainViewDistance = lowPower || window.innerWidth < 700
    ? MOBILE_TERRAIN_VIEW_DISTANCE
    : DESKTOP_TERRAIN_VIEW_DISTANCE;
  const terrainWorkerCount = lowPower || window.innerWidth < 700
    ? 2
    : Math.max(1, Math.min(4, Math.trunc(Number(navigator.hardwareConcurrency) || 4)));
  const renderViewDistance = terrainViewDistance + 3;
  const actorTimeScale = Math.max(0.25, Math.min(8, Number(options.actorTimeScale) || 1));
  const frameInterval = 1_000 / maxFps;
  const cleanups = [];
  let runtime = null;
  let worldConfig = null;
  let renderer = null;
  let chunks = null;
  let structureChunks = [];
  let structureWalkSurfaces = new Map();
  let structureInspectables = [];
  let windmillRotor = null;
  let avatars = [];
  let resizeObserver = null;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let startedAt = performance.now();
  let destroyed = false;
  let initialized = false;
  let settled = false;
  let focusView = "arrival";
  let pointerX = 0;
  let pointerY = 0;
  let pointerClientX = -1;
  let pointerClientY = -1;
  let pointerInspectionEligible = false;
  let inspectedBuildingId = "";
  let transitionStart = startedAt;
  let focusStartedAt = startedAt;
  let cameraStart = cameraPoseForView("arrival", canvasAspect(canvas));
  let cameraTarget = cameraStart;
  let lastMiningBurst = -1;
  const buildMetrics = { baseBuilds: 0, remeshBuilds: 0 };
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let lastStats = Object.freeze({
    backend: "chunk.js-webgl2",
    terrainChunks: 0,
    structureChunks: 0,
    avatars: 0,
    drawCalls: 0,
    triangles: 0,
    baseBuilds: 0,
    remeshBuilds: 0,
    requiredTerrainChunks: 0,
    maxFps,
  });

  const settle = (status, detail = null) => {
    if (settled) return;
    settled = true;
    resolveReady({ status, detail });
  };

  const schedule = () => {
    if (animationFrame || destroyed || document.hidden) return;
    animationFrame = requestAnimationFrame(renderFrame);
  };

  const focus = (view, { immediate = false } = {}) => {
    if (!SECTION_VIEWS.includes(view) || destroyed) return;
    const timestamp = performance.now();
    cameraStart = resolveCameraPose(timestamp, false);
    focusView = view;
    focusStartedAt = timestamp;
    cameraTarget = cameraPoseForView(view, canvasAspect(canvas));
    transitionStart = immediate || reducedMotion.matches ? timestamp - CAMERA_TRANSITION_MS : timestamp;
    canvas.dataset.sceneView = view;
    canvas.dataset.sceneCue = sceneCueForView(view);
    renderFrame(timestamp, true);
    schedule();
  };

  const resolveCameraPose = (timestamp, includeParallax = true) => {
    const elapsed = Math.max(0, timestamp - transitionStart);
    const amount = smoothstep(Math.min(1, elapsed / CAMERA_TRANSITION_MS));
    const pose = {
      eye: mixVector(cameraStart.eye, cameraTarget.eye, amount),
      target: mixVector(cameraStart.target, cameraTarget.target, amount),
      fov: mix(cameraStart.fov, cameraTarget.fov, amount),
    };
    if (!includeParallax || reducedMotion.matches) return pose;
    pose.eye[0] += pointerX * 1.25;
    pose.eye[1] -= pointerY * 0.48;
    pose.eye[2] += pointerX * 0.38;
    return pose;
  };

  function renderFrame(timestamp, force = false) {
    animationFrame = 0;
    if (destroyed || document.hidden || !initialized || !renderer || !chunks || !runtime) return;
    if (!force && timestamp - lastFrameTime < frameInterval) {
      schedule();
      return;
    }

    const dt = Math.min(0.04, Math.max(0.001, (timestamp - lastFrameTime) / 1_000 || 0.016));
    lastFrameTime = timestamp;
    chunks.rebuildDirtyChunks(lowPower ? 2.6 : 4.8);
    updateActors(timestamp);
    updateWindmillRotor(timestamp);
    renderer.updateVoxelParticles(dt, (worldX, worldZ) => chunks.getOpaqueColumnTopAtWorld(worldX, worldZ) + 1);

    const terrainChunks = [...chunks.chunks.values()].filter((chunk) => chunk.mesh);
    const activeStructureChunks = structureChunks;
    const visibleChunks = terrainChunks.concat(activeStructureChunks);
    const cameraPose = resolveCameraPose(timestamp);
    const camera = cameraStateFromPose(runtime, cameraPose, canvasAspect(canvas));
    renderer.prepareChunksForRender(visibleChunks, {
      maxUploads: lowPower ? 2 : 5,
      cameraState: camera,
    });
    const renderStats = renderer.render(camera, visibleChunks, avatars, overlaysForView(timestamp));
    updateBuildingInspection(cameraPose);
    const readiness = cameraReadiness(camera);
    lastStats = Object.freeze({
      backend: "chunk.js-webgl2",
      terrainChunks: terrainChunks.length,
      structureChunks: activeStructureChunks.length,
      avatars: avatars.length,
      drawCalls: renderStats.drawCalls || 0,
      triangles: renderStats.triangles || 0,
      baseBuilds: buildMetrics.baseBuilds,
      remeshBuilds: buildMetrics.remeshBuilds,
      requiredTerrainChunks: readiness.requiredTerrainChunks,
      maxFps,
    });
    canvas.dataset.sceneTerrainChunks = String(lastStats.terrainChunks);
    canvas.dataset.sceneStructureChunks = String(lastStats.structureChunks);
    canvas.dataset.sceneDrawCalls = String(lastStats.drawCalls);
    canvas.dataset.sceneTriangles = String(lastStats.triangles);
    canvas.dataset.sceneRequiredTerrainChunks = String(readiness.requiredTerrainChunks);
    canvas.dataset.sceneReadyTerrainChunks = String(readiness.readyTerrainChunks);
    canvas.dataset.sceneRequiredStructureChunks = String(readiness.requiredStructureChunks);

    if (canvas.dataset.sceneReady !== "true" && readiness.ready) markReady();
    schedule();
  }

  function cameraReadiness(camera) {
    const requiredTerrainIds = new Set();
    for (const chunk of chunks.chunks.values()) {
      if (runtime.chunkIntersectsCameraFrustum(terrainReadinessProbe(chunk), camera)) requiredTerrainIds.add(chunk.id);
    }
    const requiredStructures = structureChunks.filter((chunk) => runtime.chunkIntersectsCameraFrustum(chunk, camera));
    for (const structure of requiredStructures) requiredTerrainIds.add(`${structure.chunkX},${structure.chunkZ}`);
    let readyTerrainChunks = 0;
    for (const id of requiredTerrainIds) {
      if (gpuMeshReady(chunks.chunks.get(id))) readyTerrainChunks += 1;
    }
    const readyStructures = requiredStructures.filter(gpuMeshReady).length;
    return {
      ready: requiredTerrainIds.size > 0
        && readyTerrainChunks === requiredTerrainIds.size
        && readyStructures === requiredStructures.length,
      requiredTerrainChunks: requiredTerrainIds.size,
      readyTerrainChunks,
      requiredStructureChunks: requiredStructures.length,
    };
  }

  function recordBuildEvent(type) {
    if (type === "chunk-build-done") buildMetrics.baseBuilds += 1;
    else if (type === "chunk-remesh-done") buildMetrics.remeshBuilds += 1;
    else return;
    canvas.dataset.sceneBaseBuilds = String(buildMetrics.baseBuilds);
    canvas.dataset.sceneRemeshBuilds = String(buildMetrics.remeshBuilds);
  }

  function updateActors(timestamp) {
    const elapsed = Math.max(0, timestamp - startedAt) * actorTimeScale;
    const focusElapsed = Math.max(0, timestamp - focusStartedAt);
    const boy = avatars.find((avatar) => avatar.role === "villager-boy");
    const girl = avatars.find((avatar) => avatar.role === "villager-girl");
    let boyPose = reducedMotion.matches
      ? staticRoutePose(ACTOR_ROUTES.boy)
      : sampleRoute(ACTOR_ROUTES.boy, elapsed);
    let girlPose = reducedMotion.matches
      ? staticRoutePose(ACTOR_ROUTES.girl)
      : sampleRoute(ACTOR_ROUTES.girl, elapsed + 1_800);

    if (focusView === "world") {
      boyPose = focusedMiningPose(focusElapsed, reducedMotion.matches);
    } else if (focusView === "market") {
      boyPose = focusedIdlePose(ACTOR_SITES.economyBoy, ACTOR_SITES.economyGirl, focusElapsed);
      girlPose = focusedIdlePose(ACTOR_SITES.economyGirl, ACTOR_SITES.economyBoy, focusElapsed);
    } else if (focusView === "guardian") {
      boyPose = focusedIdlePose(ACTOR_SITES.guardianBoy, ACTOR_SITES.guardianGirl, focusElapsed);
      girlPose = focusedIdlePose(ACTOR_SITES.guardianGirl, ACTOR_SITES.guardianBoy, focusElapsed);
    }
    const miningActive = boyPose.phase === "mine";
    const miningProgress = miningActive ? boyPose.progress : 0;

    if (boy) {
      positionAvatarAt(runtime, worldConfig, chunks, structureWalkSurfaces, boy, boyPose);
      boy.animation = {
        moving: boyPose.phase === "walk" && !reducedMotion.matches,
        miningProgress,
        miningAimPitch: -0.08,
        timeMs: timestamp,
        equipment: { rightHand: "pickaxe" },
      };
      exposeActorState(canvas, "boy", boy, boyPose);
    }
    if (girl) {
      positionAvatarAt(runtime, worldConfig, chunks, structureWalkSurfaces, girl, girlPose);
      girl.animation = {
        moving: girlPose.phase === "walk" && !reducedMotion.matches,
        timeMs: timestamp,
      };
      exposeActorState(canvas, "girl", girl, girlPose);
    }

    const miningBurst = `${boyPose.cycle}:${boyPose.segmentIndex}`;
    if (miningActive && miningProgress > 0.58 && miningBurst !== lastMiningBurst) {
      lastMiningBurst = miningBurst;
      const targetY = miningTargetY();
      const blockId = chunks.getBlockAtWorld(MINING_TARGET.x, targetY, MINING_TARGET.z);
      renderer.emitVoxelParticles("fracture", {
        worldX: MINING_TARGET.x,
        worldY: targetY,
        worldZ: MINING_TARGET.z,
        blockId,
        maxPieces: lowPower ? 8 : 16,
      });
    }
  }

  function updateWindmillRotor(timestamp) {
    if (!windmillRotor) return;
    const rotating = canvas.dataset.sceneReady === "true" && !reducedMotion.matches;
    const angle = rotating
      ? (Math.max(0, timestamp - startedAt) % WINDMILL_ROTATION_MS) / WINDMILL_ROTATION_MS * Math.PI * 2
      : 0;
    const updated = windmillRotor.update(angle, timestamp, rotating ? WINDMILL_FRAME_MS : 0);
    if (!updated) return;
    canvas.dataset.sceneWindmillAngle = angle.toFixed(5);
    canvas.dataset.sceneWindmillRotating = String(rotating);
  }

  function overlaysForView(timestamp) {
    const pulse = reducedMotion.matches ? 0.52 : 0.38 + (Math.sin(timestamp * 0.004) + 1) * 0.16;
    if (focusView === "world") {
      return [{
        worldX: MINING_TARGET.x,
        worldY: miningTargetY(),
        worldZ: MINING_TARGET.z,
        size: 1,
        expand: 0.025,
        fillColor: [0.1, 0.72, 1, pulse * 0.12],
        lineColor: [0.28, 0.9, 1, 0.82],
      }];
    }
    if (focusView === "market") {
      const activeIndex = reducedMotion.matches ? ECONOMY_FLOW_SITES.length - 1 : Math.floor(timestamp / 520) % ECONOMY_FLOW_SITES.length;
      const flow = ECONOMY_FLOW_SITES.map((site, index) => ({
        worldX: site.x,
        worldY: surfaceYAt(site.x, site.z) + 1.05,
        worldZ: site.z,
        size: index === ECONOMY_FLOW_SITES.length - 1 ? 1.45 : 0.9,
        expand: index === activeIndex ? 0.12 : 0.025,
        fillColor: index === activeIndex
          ? [0.66, 0.92, 0.32, 0.22]
          : [0.26, 0.72, 0.92, 0.06],
        lineColor: index === activeIndex
          ? [0.76, 1, 0.42, 0.9]
          : [0.4, 0.82, 1, 0.46],
      }));
      return [
        {
          shape: "foundation",
          worldX: 2475,
          worldY: surfaceYAt(2475, 1719) + 1.02,
          worldZ: 1719,
          width: 22,
          depth: 9,
          preview: true,
          grid: false,
          fillColor: [0.66, 0.92, 0.32, 0.018],
          edgeColor: [0.76, 1, 0.42, pulse * 0.5],
          glowColor: [0.5, 0.9, 0.24, pulse * 0.18],
        },
        ...flow,
      ];
    }
    if (focusView === "guardian") {
      const [boy, girl] = avatars;
      if (!boy || !girl) return [];
      const minX = Math.min(boy.worldX, girl.worldX);
      const minZ = Math.min(boy.worldZ, girl.worldZ);
      return [
        avatarRelayOverlay(boy, pulse),
        avatarRelayOverlay(girl, pulse),
        {
          shape: "foundation",
          worldX: minX,
          worldY: Math.min(boy.worldY, girl.worldY) + 0.04,
          worldZ: minZ,
          width: Math.max(1, Math.abs(girl.worldX - boy.worldX) + 1),
          depth: Math.max(1, Math.abs(girl.worldZ - boy.worldZ) + 1),
          preview: false,
          grid: false,
          fillColor: [0.12, 0.72, 1, 0.016],
          edgeColor: [0.32, 0.88, 1, pulse * 0.5],
          glowColor: [0.2, 0.78, 1, pulse * 0.2],
        },
      ];
    }
    if (focusView === "roadmap") {
      return [
        buildingProgressOverlay(2431, 1694, 42, 13, pulse),
        buildingProgressOverlay(2510, 1624, 28, 26, pulse * 0.86),
      ];
    }
    return [];
  }

  function surfaceYAt(worldX, worldZ) {
    return chunks?.getOpaqueColumnTopAtWorld(worldX, worldZ)
      ?? runtime.terrainSurfaceHeight(worldConfig, worldX, worldZ);
  }

  function miningTargetY() {
    return chunks?.getOpaqueColumnTopAtWorld(MINING_TARGET.x, MINING_TARGET.z)
      ?? runtime.terrainSurfaceHeight(worldConfig, MINING_TARGET.x, MINING_TARGET.z);
  }

  function updateBuildingInspection(cameraPose) {
    if (typeof options.onBuildingInspect !== "function") return;
    const enabled = inspectorHoverMedia.matches
      && window.innerWidth >= BUILDING_INSPECTOR_MIN_VIEWPORT
      && pointerInspectionEligible
      && canvas.dataset.sceneReady === "true";
    if (!enabled || !structureInspectables.length) {
      emitBuildingInspection(null);
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const matches = structureInspectables
      .map((target) => projectInspectableStructure(target, cameraPose, canvasRect, {
        x: pointerClientX,
        y: pointerClientY,
      }))
      .filter((projection) => projection && pointInsideRect(pointerClientX, pointerClientY, projection.hitRect));
    const pointerRay = createPointerRay(cameraPose, canvasRect, {
      x: pointerClientX,
      y: pointerClientY,
    });
    const voxelMatches = pointerRay
      ? matches
        .map((projection) => ({
          projection,
          distance: raycastInspectableStructure(projection.target, pointerRay),
        }))
        .filter((candidate) => candidate.distance !== null)
        .sort((left, right) => left.distance - right.distance)
      : [];
    const match = voxelMatches[0]?.projection || matches
      .sort((left, right) => left.depth - right.depth || left.pointerDistance - right.pointerDistance)[0];
    if (!match) {
      emitBuildingInspection(null);
      return;
    }

    inspectedBuildingId = match.target.id;
    const outline = projectInspectableModelOutline(
      match.target,
      cameraPose,
      canvasRect,
      windmillRotor?.currentAngle?.() || 0,
    );
    options.onBuildingInspect({
      target: match.target,
      anchor: match.anchor,
      bounds: match.rect,
      outline,
    });
  }

  function emitBuildingInspection(detail) {
    if (detail) {
      inspectedBuildingId = detail.target.id;
      options.onBuildingInspect?.(detail);
      return;
    }
    if (!inspectedBuildingId) return;
    inspectedBuildingId = "";
    options.onBuildingInspect?.(null);
  }

  function markReady() {
    startedAt = performance.now();
    lastMiningBurst = -1;
    updateActors(startedAt);
    canvas.dataset.sceneReady = "true";
    canvas.dataset.sceneRenderer = "chunk.js-webgl2";
    canvas.dataset.sceneTerrainProfile = "two-landmasses-river-bay";
    canvas.dataset.sceneMapBounds = "240x240";
    canvas.dataset.sceneSeed = runtime.MAINNET_WORLD_SEED;
    canvas.dataset.sceneGeneration = String(runtime.DEFAULT_GENERATION_VERSION);
    canvas.dataset.sceneAvatars = "NCM2:villager-boy,NCM2:villager-girl";
    canvas.dataset.sceneBuildings = STRUCTURE_SPECS.map((spec) => `NCM3:${spec.id}`).join(",");
    canvas.dataset.sceneInspectableBuildings = structureInspectables.map((target) => target.id).join(",");
    canvas.dataset.sceneActorBehavior = "waypoint-walk-bridge-idle-mine-loop";
    canvas.dataset.sceneActionModes = "terrain-delta,material-flow,guardian-relay,building-progress";
    canvas.dataset.sceneWindmillRotationMs = String(WINDMILL_ROTATION_MS);
    canvas.dataset.sceneWindmillAngle ||= "0.00000";
    canvas.dataset.sceneWindmillRotating = String(!reducedMotion.matches);
    document.documentElement.classList.remove("home-world-fallback");
    document.documentElement.classList.add("home-world-ready");
    options.onReady?.(lastStats);
    window.dispatchEvent(new CustomEvent("nicechunk:homeworldready", { detail: lastStats }));
    settle("ready", lastStats);
  }

  async function initialize() {
    try {
      await nextFrame();
      if (destroyed) return;
      const [loadedRuntime, presentationTerrain] = await Promise.all([
        loadChunkRuntime(options.runtimeRoot || DEFAULT_RUNTIME_ROOT),
        loadHomeWorldTerrain(options.terrainUrl),
      ]);
      runtime = loadedRuntime;
      if (destroyed) return;
      if (presentationTerrain.generationVersion !== runtime.DEFAULT_GENERATION_VERSION) {
        throw new Error("Homepage terrain generation does not match the active Chunk.js runtime.");
      }
      worldConfig = runtime.createWorldGeneratorConfig({
        worldSeed: runtime.MAINNET_WORLD_SEED,
        generationVersion: runtime.DEFAULT_GENERATION_VERSION,
      });
      renderer = new runtime.WebGL2VoxelRenderer(canvas, {
        viewDistance: renderViewDistance,
        textureTileSize: 32,
        textureSeed: runtime.MAINNET_WORLD_SEED,
        useRegionBatching: false,
        maxChunkUploadsPerFrame: lowPower ? 2 : 5,
        maxMobileDpr: 1,
        maxDesktopDpr: lowPower ? 1 : 1.25,
        maxVoxelParticles: lowPower ? 48 : 96,
      });
      renderer.init();

      chunks = new runtime.ChunkManager({
        worldSeed: runtime.MAINNET_WORLD_SEED,
        generationVersion: runtime.DEFAULT_GENERATION_VERSION,
        viewDistance: terrainViewDistance,
        preloadMargin: 0,
        useWorkers: true,
        workerCount: terrainWorkerCount,
        workerUrl: runtimeAssetUrl(options.runtimeRoot || DEFAULT_RUNTIME_ROOT, CHUNK_WORKER_BUNDLE),
        deferInitialBuilds: true,
        visibilityLingerFrames: 0,
      });
      chunks.setRenderLogger({ record: recordBuildEvent });
      chunks.updatePlayerPosition(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_CENTER.z, {
        directionX: 0.18,
        directionZ: -1,
      });
      const villagerMeshes = createVillagerMeshes(runtime);
      const terrainResult = await applyHomeWorldTerrain(chunks, presentationTerrain, {
        yieldEvery: lowPower ? 4 : 8,
        onProgress: ({ appliedChunks, appliedDeltas }) => {
          canvas.dataset.sceneTerrainPreparedChunks = String(appliedChunks);
          canvas.dataset.sceneTerrainPreparedDeltas = String(appliedDeltas);
        },
      });
      canvas.dataset.sceneTerrainTotalChunks = String(chunks.chunks.size);
      canvas.dataset.sceneTerrainDeltas = String(terrainResult.appliedDeltas);
      canvas.dataset.sceneTerrainFingerprint = presentationTerrain.fingerprint;
      canvas.dataset.sceneTerrainEncoding = presentationTerrain.transferEncoding;
      canvas.dataset.sceneTerrainTransferBytes = String(presentationTerrain.transferBytes);
      chunks.setBuildConcurrencyLimit(terrainWorkerCount);
      const structures = createStructures(runtime);
      structureChunks = structures.chunks;
      structureWalkSurfaces = structures.walkSurfaces;
      structureInspectables = structures.inspectables;
      windmillRotor = structures.windmillRotor;
      const [boyMesh, girlMesh] = await villagerMeshes;
      if (destroyed) return;
      renderer.uploadAvatarMesh("villager-boy", boyMesh);
      renderer.uploadAvatarMesh("villager-girl", girlMesh);
      avatars = [
        createAvatar(runtime, worldConfig, "villager-boy", ACTOR_SITES.boy, "villager-boy"),
        createAvatar(runtime, worldConfig, "villager-girl", ACTOR_SITES.girl, "villager-girl"),
      ];

      chunks.rebuildDirtyChunks(lowPower ? 8 : 14);
      initialized = true;
      startedAt = performance.now();
      lastFrameTime = startedAt;
      focus(focusView, { immediate: true });
      renderFrame(startedAt, true);
      schedule();
    } catch (error) {
      handleUnavailable(error);
    }
  }

  function handleUnavailable(error) {
    emitBuildingInspection(null);
    renderer?.dispose();
    chunks?.dispose();
    renderer = null;
    chunks = null;
    document.documentElement.classList.remove("home-world-ready");
    document.documentElement.classList.add("home-world-fallback");
    canvas.dataset.sceneReady = "false";
    canvas.dataset.sceneFallback = isWebGl2UnavailableError(error)
      ? "webgl2-unavailable"
      : "chunkjs-initialization-failed";
    if (!isWebGl2UnavailableError(error)) {
      canvas.dataset.sceneError = String(error?.message || error || "Unknown scene error").slice(0, 180);
      console.warn("NiceChunk homepage Chunk.js scene initialization failed; using the static fallback.", error);
    }
    options.onUnavailable?.(error);
    settle("unavailable", error);
  }

  const handleVisibility = () => {
    if (document.hidden) {
      emitBuildingInspection(null);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      return;
    }
    lastFrameTime = performance.now();
    schedule();
  };
  const handlePointerMove = (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
    pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    pointerInspectionEligible = isBuildingInspectionPointerTarget(event.target);
  };
  const handlePointerOut = (event) => {
    if (event.relatedTarget) return;
    pointerInspectionEligible = false;
    emitBuildingInspection(null);
  };
  const handleWindowBlur = () => {
    pointerInspectionEligible = false;
    emitBuildingInspection(null);
  };

  resizeObserver = new ResizeObserver(() => {
    if (destroyed) return;
    cameraTarget = cameraPoseForView(focusView, canvasAspect(canvas));
    renderer?.resize();
    renderFrame(performance.now(), true);
  });
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerout", handlePointerOut, { passive: true });
  window.addEventListener("blur", handleWindowBlur);
  reducedMotion.addEventListener?.("change", handleVisibility);
  inspectorHoverMedia.addEventListener?.("change", handleVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibility));
  cleanups.push(() => window.removeEventListener("pointermove", handlePointerMove));
  cleanups.push(() => window.removeEventListener("pointerout", handlePointerOut));
  cleanups.push(() => window.removeEventListener("blur", handleWindowBlur));
  cleanups.push(() => reducedMotion.removeEventListener?.("change", handleVisibility));
  cleanups.push(() => inspectorHoverMedia.removeEventListener?.("change", handleVisibility));
  canvas.dataset.sceneView = focusView;
  canvas.dataset.sceneReady = "false";
  void initialize();

  return {
    ready,
    focus,
    get stats() {
      return lastStats;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      settle("destroyed");
      if (animationFrame) cancelAnimationFrame(animationFrame);
      emitBuildingInspection(null);
      resizeObserver?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      renderer?.dispose();
      chunks?.dispose();
      renderer = null;
      chunks = null;
      document.documentElement.classList.remove("home-world-ready");
    },
  };
}

async function loadChunkRuntime(runtimeRoot) {
  const root = String(runtimeRoot || DEFAULT_RUNTIME_ROOT).replace(/\/+$/, "");
  return import(/* @vite-ignore */ runtimeAssetUrl(root, CHUNK_RUNTIME_BUNDLE));
}

function runtimeAssetUrl(runtimeRoot, relativePath) {
  return `${String(runtimeRoot || DEFAULT_RUNTIME_ROOT).replace(/\/+$/, "")}/${relativePath}`;
}

function createStructures(runtime) {
  const chunks = [];
  const walkSurfaces = new Map();
  const inspectables = [];
  let windmillRotor = null;
  let revision = 1;
  for (const spec of STRUCTURE_SPECS) {
    const building = runtime.parseNcm3Building(spec.definition.ncm.code, {
      id: spec.id,
      name: spec.definition.titles.en,
    });
    const footprint = spec.quarterTurns % 2 === 0
      ? { width: building.size.x, depth: building.size.z }
      : { width: building.size.z, depth: building.size.x };
    const foundation = {
      id: `${spec.id}-foundation`,
      minX: spec.minX,
      minZ: spec.minZ,
      surfaceY: spec.surfaceY,
      width: footprint.width,
      depth: footprint.depth,
    };
    if (spec.id === "tower-windmill") {
      const split = splitWindmillBuilding(building, spec.definition);
      const bodyPlacement = runtime.createBuildingPlacement(split.body, foundation, {
        placementId: spec.id,
        quarterTurns: spec.quarterTurns,
      });
      const rotorPlacement = runtime.createBuildingPlacement(split.rotor, foundation, {
        placementId: `${spec.id}-rotor`,
        quarterTurns: spec.quarterTurns,
      });
      const bodyChunks = runtime.createBuildingChunkMeshes(bodyPlacement, { chunkSize: 16, revision: revision++ });
      const rotorChunks = runtime.createBuildingChunkMeshes(rotorPlacement, { chunkSize: 16, revision: revision++ });
      bodyChunks.forEach((chunk) => {
        chunk.sceneStructureId = spec.id;
      });
      rotorChunks.forEach((chunk) => {
        chunk.sceneStructureId = spec.id;
        chunk.sceneAnimatedPart = "windmill-rotor";
        chunk.regionBatchEligible = false;
        chunk.frustumCullEligible = false;
      });
      windmillRotor = createWindmillRotor(rotorPlacement, rotorChunks, spec.definition);
      inspectables.push(createInspectableStructure(building, [
        { placement: bodyPlacement },
        { placement: rotorPlacement, rotationPivot: windmillRotor.pivot },
      ], spec));
      chunks.push(...bodyChunks, ...rotorChunks);
      continue;
    }

    const placement = runtime.createBuildingPlacement(building, foundation, {
      placementId: spec.id,
      quarterTurns: spec.quarterTurns,
    });
    const placementChunks = runtime.createBuildingChunkMeshes(placement, { chunkSize: 16, revision: revision++ });
    placementChunks.forEach((chunk) => {
      chunk.sceneStructureId = spec.id;
    });
    if (spec.walkable) addStructureWalkSurfaces(placement, spec, walkSurfaces);
    inspectables.push(createInspectableStructure(building, [placement], spec));
    chunks.push(...placementChunks);
  }
  return { chunks, walkSurfaces, inspectables, windmillRotor };
}

function createInspectableStructure(building, placements, spec) {
  const components = placements.map((entry) => entry?.placement ? entry : { placement: entry });
  const placementList = components.map((entry) => entry.placement);
  const bounds = worldVoxelBounds(placementList);
  const occupiedVoxels = new Set();
  for (const placement of placementList) {
    for (const voxel of placement.worldVoxels.values()) {
      occupiedVoxels.add(worldVoxelKey(voxel.x, voxel.y, voxel.z));
    }
  }
  const outlineGroups = components.map(({ placement, rotationPivot = null }) => {
    const surface = structureSurfaceProjectionMesh(placement.worldVoxels.values());
    return Object.freeze({
      faces: surface.faces,
      points: surface.points,
      rotationPivot,
    });
  });
  return Object.freeze({
    id: spec.id,
    titles: Object.freeze({ ...spec.definition.titles }),
    descriptions: Object.freeze({ ...spec.definition.descriptions }),
    ncmCode: spec.definition.ncm.code,
    payloadBytes: building.payloadBytes,
    voxelCount: building.voxels.size,
    modelSize: Object.freeze({ ...building.size }),
    worldBounds: bounds,
    corners: Object.freeze(buildingBoundsCorners(bounds)),
    outlineGroups: Object.freeze(outlineGroups),
    hasWorldVoxel: (x, y, z) => occupiedVoxels.has(worldVoxelKey(x, y, z)),
  });
}

const STRUCTURE_FACE_DEFINITIONS = Object.freeze([
  Object.freeze({ neighbor: [-1, 0, 0], normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] }),
  Object.freeze({ neighbor: [1, 0, 0], normal: [1, 0, 0], corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] }),
  Object.freeze({ neighbor: [0, -1, 0], normal: [0, -1, 0], corners: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] }),
  Object.freeze({ neighbor: [0, 1, 0], normal: [0, 1, 0], corners: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] }),
  Object.freeze({ neighbor: [0, 0, -1], normal: [0, 0, -1], corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] }),
  Object.freeze({ neighbor: [0, 0, 1], normal: [0, 0, 1], corners: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] }),
]);

function structureSurfaceProjectionMesh(voxels) {
  const voxelList = Array.from(voxels, (voxel) => Object.freeze({ x: voxel.x, y: voxel.y, z: voxel.z }));
  const occupied = new Set(voxelList.map((voxel) => worldVoxelKey(voxel.x, voxel.y, voxel.z)));
  const faceGroups = new Map();
  const pointIndexes = new Map();
  const points = [];
  const faces = [];
  const pointIndex = (x, y, z) => {
    const key = worldVoxelKey(x, y, z);
    const existing = pointIndexes.get(key);
    if (existing !== undefined) return existing;
    const index = points.length;
    points.push(Object.freeze([x, y, z]));
    pointIndexes.set(key, index);
    return index;
  };
  for (const voxel of voxelList) {
    for (const face of STRUCTURE_FACE_DEFINITIONS) {
      if (occupied.has(worldVoxelKey(
        voxel.x + face.neighbor[0],
        voxel.y + face.neighbor[1],
        voxel.z + face.neighbor[2],
      ))) continue;
      const cell = structureSurfaceFaceCell(voxel, face.normal);
      const key = `${cell.axis}:${cell.sign}:${cell.plane}`;
      let group = faceGroups.get(key);
      if (!group) {
        group = { ...cell, cells: new Set() };
        faceGroups.set(key, group);
      }
      group.cells.add(`${cell.u},${cell.v}`);
    }
  }
  for (const group of faceGroups.values()) {
    for (const rectangle of mergeStructureSurfaceCells(group.cells)) {
      const corners = structureSurfaceRectangleCorners(group, rectangle);
      faces.push(Object.freeze({
        pointIndexes: Object.freeze(corners.map((corner) => pointIndex(...corner))),
        normal: group.normal,
      }));
    }
  }
  return Object.freeze({
    faces: Object.freeze(faces),
    points: Object.freeze(points),
  });
}

function structureSurfaceFaceCell(voxel, normal) {
  if (normal[0]) {
    return {
      axis: "x",
      sign: normal[0],
      plane: voxel.x + (normal[0] > 0 ? 1 : 0),
      u: voxel.y,
      v: voxel.z,
      normal,
    };
  }
  if (normal[1]) {
    return {
      axis: "y",
      sign: normal[1],
      plane: voxel.y + (normal[1] > 0 ? 1 : 0),
      u: voxel.x,
      v: voxel.z,
      normal,
    };
  }
  return {
    axis: "z",
    sign: normal[2],
    plane: voxel.z + (normal[2] > 0 ? 1 : 0),
    u: voxel.x,
    v: voxel.y,
    normal,
  };
}

function mergeStructureSurfaceCells(cellKeys) {
  const remaining = new Set(cellKeys);
  const cells = [...cellKeys]
    .map((key) => key.split(",").map(Number))
    .sort((left, right) => left[1] - right[1] || left[0] - right[0]);
  const rectangles = [];
  for (const [startU, startV] of cells) {
    if (!remaining.has(`${startU},${startV}`)) continue;
    let width = 1;
    while (remaining.has(`${startU + width},${startV}`)) width += 1;
    let height = 1;
    while (true) {
      const nextV = startV + height;
      let complete = true;
      for (let offset = 0; offset < width; offset += 1) {
        if (!remaining.has(`${startU + offset},${nextV}`)) {
          complete = false;
          break;
        }
      }
      if (!complete) break;
      height += 1;
    }
    for (let offsetV = 0; offsetV < height; offsetV += 1) {
      for (let offsetU = 0; offsetU < width; offsetU += 1) {
        remaining.delete(`${startU + offsetU},${startV + offsetV}`);
      }
    }
    rectangles.push(Object.freeze({
      minU: startU,
      minV: startV,
      maxU: startU + width,
      maxV: startV + height,
    }));
  }
  return rectangles;
}

function structureSurfaceRectangleCorners(group, rectangle) {
  const { minU, minV, maxU, maxV } = rectangle;
  if (group.axis === "x") {
    return group.sign < 0
      ? [[group.plane, minU, minV], [group.plane, maxU, minV], [group.plane, maxU, maxV], [group.plane, minU, maxV]]
      : [[group.plane, minU, minV], [group.plane, minU, maxV], [group.plane, maxU, maxV], [group.plane, maxU, minV]];
  }
  if (group.axis === "y") {
    return group.sign < 0
      ? [[minU, group.plane, minV], [minU, group.plane, maxV], [maxU, group.plane, maxV], [maxU, group.plane, minV]]
      : [[minU, group.plane, minV], [maxU, group.plane, minV], [maxU, group.plane, maxV], [minU, group.plane, maxV]];
  }
  return group.sign < 0
    ? [[minU, minV, group.plane], [maxU, minV, group.plane], [maxU, maxV, group.plane], [minU, maxV, group.plane]]
    : [[minU, minV, group.plane], [minU, maxV, group.plane], [maxU, maxV, group.plane], [maxU, minV, group.plane]];
}

function worldVoxelBounds(placements) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
  for (const placement of placements) {
    for (const voxel of placement.worldVoxels.values()) {
      bounds.minX = Math.min(bounds.minX, voxel.x);
      bounds.minY = Math.min(bounds.minY, voxel.y);
      bounds.minZ = Math.min(bounds.minZ, voxel.z);
      bounds.maxX = Math.max(bounds.maxX, voxel.x + 1);
      bounds.maxY = Math.max(bounds.maxY, voxel.y + 1);
      bounds.maxZ = Math.max(bounds.maxZ, voxel.z + 1);
    }
  }
  if (!Object.values(bounds).every(Number.isFinite)) throw new Error("Homepage building inspection bounds are unavailable.");
  return Object.freeze(bounds);
}

function buildingBoundsCorners(bounds) {
  const corners = [];
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const y of [bounds.minY, bounds.maxY]) {
      for (const z of [bounds.minZ, bounds.maxZ]) corners.push(Object.freeze([x, y, z]));
    }
  }
  return corners;
}

function splitWindmillBuilding(building, definition) {
  const rotorKeys = windmillRotorVoxelKeys(definition);
  const sailMaterialIds = new Set((definition.extraMaterials || [])
    .filter((entry) => /sail|slat/iu.test(String(entry.label || "")))
    .map((entry) => Number(entry.materialId)));
  const bodyVoxels = new Map();
  const rotorVoxels = new Map();
  for (const [key, voxel] of building.voxels) {
    const target = rotorKeys.has(localVoxelKey(voxel.x, voxel.y, voxel.z)) || sailMaterialIds.has(voxel.material)
      ? rotorVoxels
      : bodyVoxels;
    target.set(key, voxel);
  }
  if (!bodyVoxels.size || !rotorVoxels.size) throw new Error("The homepage windmill rotor could not be separated from its tower.");
  return {
    body: cloneParsedBuilding(building, `${building.id}-body`, bodyVoxels),
    rotor: cloneParsedBuilding(building, `${building.id}-rotor`, rotorVoxels),
  };
}

function windmillRotorVoxelKeys(definition) {
  const keys = new Set();
  for (const band of definition.validation?.diagonalBands || []) {
    for (let index = 0; index < band.count; index += 1) {
      const originX = band.x + band.dx * index;
      const originY = band.y + band.dy * index;
      const originZ = band.z + band.dz * index;
      for (let z = originZ; z < originZ + band.depth; z += 1) {
        for (let y = originY; y < originY + band.height; y += 1) {
          for (let x = originX; x < originX + band.width; x += 1) keys.add(localVoxelKey(x, y, z));
        }
      }
    }
  }
  return keys;
}

function cloneParsedBuilding(building, id, voxels) {
  return Object.freeze({
    ...building,
    id,
    voxels,
    voxelCount: voxels.size,
    materials: Object.freeze(Array.from(new Set(Array.from(voxels.values(), (voxel) => voxel.material))).sort((a, b) => a - b)),
  });
}

function createWindmillRotor(placement, chunks, definition) {
  const shaft = (definition.validation?.horizontalSpans || [])
    .find((entry) => /windshaft axle/iu.test(String(entry.label || "")));
  const rotorPlaneZ = Number(definition.validation?.diagonalBands?.[0]?.z);
  const localPivot = {
    x: Number(shaft?.fixed),
    y: Number(shaft?.y),
    z: rotorPlaneZ,
  };
  if (!Object.values(localPivot).every(Number.isFinite)) {
    throw new Error("The homepage windmill shaft metadata is incomplete.");
  }
  const rotatedPivot = rotateLocalCenter(
    localPivot.x + 0.5,
    localPivot.z + 0.5,
    placement.building.size,
    placement.quarterTurns,
  );
  const pivot = Object.freeze({
    x: placement.origin.x + rotatedPivot.x,
    y: placement.origin.y + localPivot.y + 0.5,
    z: placement.origin.z + rotatedPivot.z,
  });
  const sources = chunks.map((chunk) => Object.freeze({
    chunk,
    vertices: new Uint8Array(chunk.mesh.vertices),
  }));
  let lastAngle = 0;
  let lastUpdateAt = -Infinity;
  let revision = Math.max(...chunks.map((chunk) => chunk.meshVersion || chunk.version || 1));

  return Object.freeze({
    pivot,
    currentAngle() {
      return lastAngle;
    },
    update(angle, timestamp, minimumInterval = 0) {
      if (timestamp - lastUpdateAt < minimumInterval) return false;
      if (Math.abs(angle - lastAngle) < 0.00001) return false;
      revision += 1;
      for (const source of sources) {
        source.chunk.mesh = rotatedRotorMesh(source.chunk, source.vertices, pivot, angle);
        source.chunk.meshVersion = revision;
        source.chunk.version = revision;
        source.chunk.gpuUploaded = false;
      }
      lastAngle = angle;
      lastUpdateAt = timestamp;
      return true;
    },
  });
}

function rotateLocalCenter(x, z, size, quarterTurns) {
  if (quarterTurns === 1) return { x: size.z - z, z: x };
  if (quarterTurns === 2) return { x: size.x - x, z: size.z - z };
  if (quarterTurns === 3) return { x: z, z: size.x - x };
  return { x, z };
}

function rotatedRotorMesh(chunk, sourceVertices, pivot, angle) {
  const vertices = new Uint8Array(sourceVertices);
  const source = new DataView(sourceVertices.buffer, sourceVertices.byteOffset, sourceVertices.byteLength);
  const target = new DataView(vertices.buffer, vertices.byteOffset, vertices.byteLength);
  const chunkOriginX = chunk.chunkX * chunk.chunkSize;
  const chunkOriginZ = chunk.chunkZ * chunk.chunkSize;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  for (let offset = 0; offset < vertices.byteLength; offset += 20) {
    const sourceScale = Math.max(1, source.getInt16(offset + 6, true));
    const worldX = chunkOriginX + source.getInt16(offset, true) / sourceScale;
    const worldY = source.getInt16(offset + 2, true) / sourceScale;
    const worldZ = chunkOriginZ + source.getInt16(offset + 4, true) / sourceScale;
    const deltaX = worldX - pivot.x;
    const deltaY = worldY - pivot.y;
    const rotatedWorldX = pivot.x + deltaX * cosine - deltaY * sine;
    const rotatedWorldY = pivot.y + deltaX * sine + deltaY * cosine;
    target.setInt16(offset, Math.round((rotatedWorldX - chunkOriginX) * WINDMILL_VERTEX_PACK_SCALE), true);
    target.setInt16(offset + 2, Math.round(rotatedWorldY * WINDMILL_VERTEX_PACK_SCALE), true);
    target.setInt16(offset + 4, Math.round((worldZ - chunkOriginZ) * WINDMILL_VERTEX_PACK_SCALE), true);
    target.setInt16(offset + 6, WINDMILL_VERTEX_PACK_SCALE, true);

    const normalX = source.getInt8(offset + 8) / 127;
    const normalY = source.getInt8(offset + 9) / 127;
    target.setInt8(offset + 8, Math.round((normalX * cosine - normalY * sine) * 127));
    target.setInt8(offset + 9, Math.round((normalX * sine + normalY * cosine) * 127));
  }
  return Object.freeze({ ...chunk.mesh, vertices });
}

function localVoxelKey(x, y, z) {
  return `${x},${y},${z}`;
}

function addStructureWalkSurfaces(placement, spec, walkSurfaces) {
  const corridor = spec.walkCorridor;
  for (const voxel of placement.worldVoxels.values()) {
    if (corridor && (voxel.localZ < corridor.minLocalZ || voxel.localZ > corridor.maxLocalZ)) continue;
    const key = `${voxel.x},${voxel.z}`;
    walkSurfaces.set(key, Math.max(walkSurfaces.get(key) ?? -Infinity, voxel.y));
  }
}

async function createVillagerMeshes(runtime) {
  const [boyCode, girlCode] = await Promise.all([
    fetchNcm("/media/vox/chr_peasant_guy_blackhair.ncm"),
    fetchNcm("/media/vox/chr_peasant_girl_orangehair.ncm"),
  ]);
  const boyMesh = runtime.createAvatarMeshFromNcm(boyCode, {
    scale: AVATAR_VISUAL_SCALE,
    name: "villager-boy",
    attachIronPickaxe: true,
    attachForgedPickaxe: false,
  });
  const girlMesh = runtime.createAvatarMeshFromNcm(girlCode, {
    scale: AVATAR_VISUAL_SCALE,
    name: "villager-girl",
  });
  return [boyMesh, girlMesh];
}

async function fetchNcm(url) {
  const response = await fetch(url, { cache: "force-cache", headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`Unable to load canonical avatar model (${response.status}).`);
  const code = (await response.text()).trim();
  if (!code.startsWith("NCM2:") && !code.startsWith("NCM4:")) throw new Error("Canonical avatar model is invalid.");
  return code;
}

function focusedMiningPose(elapsedMs, reducedMotion) {
  const cycleDuration = 1_480;
  const cycle = Math.floor(elapsedMs / cycleDuration);
  const cycleProgress = reducedMotion ? 0.42 : (elapsedMs % cycleDuration) / cycleDuration;
  return {
    phase: "mine",
    x: ACTOR_SITES.boyMine.x,
    z: ACTOR_SITES.boyMine.z,
    yaw: headingYaw(ACTOR_SITES.boyMine, MINING_TARGET),
    progress: cycleProgress,
    cycle,
    segmentIndex: 0,
    distance: 0,
  };
}

function focusedIdlePose(site, lookAt, elapsedMs) {
  return {
    phase: "idle",
    x: site.x,
    z: site.z,
    yaw: headingYaw(site, lookAt),
    progress: 0,
    cycle: Math.floor(elapsedMs / 4_000),
    segmentIndex: 0,
    distance: 0,
  };
}

function avatarRelayOverlay(avatar, pulse) {
  return {
    worldX: avatar.worldX + avatar.localOffsetX - 0.6,
    worldY: avatar.worldY,
    worldZ: avatar.worldZ + avatar.localOffsetZ - 0.6,
    sizeX: 1.2,
    sizeY: AVATAR_HEIGHT_BLOCKS,
    sizeZ: 1.2,
    expand: 0.03,
    fillColor: [0.12, 0.72, 1, 0.025],
    lineColor: [0.32, 0.88, 1, pulse * 0.72],
  };
}

function buildingProgressOverlay(worldX, worldZ, width, depth, pulse) {
  return {
    shape: "foundation",
    worldX,
    worldY: PRESENTATION_GROUND_Y + 1.02,
    worldZ,
    width,
    depth,
    preview: true,
    grid: true,
    fillColor: [0.2, 0.72, 1, 0.014],
    gridColor: [0.42, 0.86, 1, pulse * 0.16],
    edgeColor: [0.66, 0.94, 1, pulse * 0.52],
    glowColor: [0.2, 0.76, 1, pulse * 0.18],
  };
}

function sceneCueForView(view) {
  return {
    arrival: "world-travel",
    world: "terrain-delta",
    market: "material-flow",
    guardian: "guardian-relay",
    roadmap: "building-progress",
  }[view] || "world-travel";
}

function routeWalk(from, to, durationMs) {
  const start = routePoint(from);
  const end = routePoint(to);
  return Object.freeze({
    phase: "walk",
    from: start,
    to: end,
    durationMs,
    distance: Math.hypot(end.x - start.x, end.z - start.z),
  });
}

function routeStop(phase, at, durationMs, options = {}) {
  const point = routePoint(at);
  return Object.freeze({
    phase,
    from: point,
    to: point,
    durationMs,
    distance: 0,
    yaw: Number.isFinite(options.yaw) ? options.yaw : point.yaw,
    lookAt: options.lookAt ? routePoint(options.lookAt) : null,
  });
}

function routePoint(point) {
  return Object.freeze({
    x: Number(point.x),
    z: Number(point.z),
    yaw: Number.isFinite(point.yaw) ? Number(point.yaw) : undefined,
  });
}

function createRoute(segments) {
  let startMs = 0;
  let startDistance = 0;
  const timeline = segments.map((segment) => {
    const timed = Object.freeze({ ...segment, startMs, startDistance });
    startMs += segment.durationMs;
    startDistance += segment.distance;
    return timed;
  });
  return Object.freeze({
    segments: Object.freeze(timeline),
    durationMs: startMs,
    distance: startDistance,
  });
}

function sampleRoute(route, elapsedMs) {
  const safeElapsed = Math.max(0, Number(elapsedMs) || 0);
  const cycle = Math.floor(safeElapsed / route.durationMs);
  const cycleTime = safeElapsed % route.durationMs;
  let segmentIndex = route.segments.findIndex((segment) => cycleTime < segment.startMs + segment.durationMs);
  if (segmentIndex < 0) segmentIndex = route.segments.length - 1;
  const segment = route.segments[segmentIndex];
  const progress = clamp((cycleTime - segment.startMs) / segment.durationMs, 0, 1);
  const x = mix(segment.from.x, segment.to.x, progress);
  const z = mix(segment.from.z, segment.to.z, progress);
  const yaw = segment.lookAt
    ? headingYaw({ x, z }, segment.lookAt)
    : Number.isFinite(segment.yaw)
      ? segment.yaw
      : segment.phase === "walk"
        ? headingYaw(segment.from, segment.to)
        : segment.from.yaw ?? 0;
  return {
    phase: segment.phase,
    x,
    z,
    yaw,
    progress,
    cycle,
    segmentIndex,
    distance: cycle * route.distance + segment.startDistance + segment.distance * progress,
  };
}

function headingYaw(from, to) {
  return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function staticRoutePose(route) {
  const first = route.segments[0];
  return {
    phase: "idle",
    x: first.from.x,
    z: first.from.z,
    yaw: first.from.yaw ?? first.yaw ?? 0,
    progress: 0,
    cycle: 0,
    segmentIndex: 0,
    distance: 0,
  };
}

function createAvatar(runtime, worldConfig, role, site, meshId) {
  const worldY = runtime.terrainSurfaceHeight(worldConfig, site.x, site.z) + 1;
  return {
    id: role,
    meshId,
    role,
    worldX: site.x,
    worldY,
    worldZ: site.z,
    localOffsetX: 0.5,
    localOffsetY: 0,
    localOffsetZ: 0.5,
    yaw: site.yaw,
    animation: { moving: false, timeMs: performance.now() },
    shadowWorldY: worldY,
    shadowCasterHeight: AVATAR_HEIGHT_BLOCKS,
    shadowRadiusX: 0.55,
    shadowRadiusZ: 0.45,
    shadowAlpha: 0.42,
  };
}

function positionAvatarAt(runtime, worldConfig, chunks, structureWalkSurfaces, avatar, pose) {
  const actualX = pose.x + 0.5;
  const actualZ = pose.z + 0.5;
  const worldX = Math.floor(actualX);
  const worldZ = Math.floor(actualZ);
  const structureSurfaceY = structureWalkSurfaces.get(`${worldX},${worldZ}`);
  const worldY = Number.isFinite(structureSurfaceY)
    ? structureSurfaceY + 1
    : chunks?.getOpaqueColumnTopAtWorld(worldX, worldZ) + 1
      || runtime.terrainSurfaceHeight(worldConfig, worldX, worldZ) + 1;
  avatar.worldX = worldX;
  avatar.worldY = worldY;
  avatar.worldZ = worldZ;
  avatar.localOffsetX = actualX - worldX;
  avatar.localOffsetZ = actualZ - worldZ;
  avatar.yaw = pose.yaw;
  avatar.shadowWorldY = worldY;
}

function exposeActorState(canvas, actor, avatar, pose) {
  const prefix = `scene${actor[0].toUpperCase()}${actor.slice(1)}`;
  canvas.dataset[`${prefix}Phase`] = pose.phase;
  canvas.dataset[`${prefix}Cycle`] = String(pose.cycle);
  canvas.dataset[`${prefix}Segment`] = String(pose.segmentIndex);
  canvas.dataset[`${prefix}Distance`] = pose.distance.toFixed(2);
  canvas.dataset[`${prefix}Yaw`] = avatar.yaw.toFixed(6);
  canvas.dataset[`${prefix}Position`] = [
    avatar.worldX + avatar.localOffsetX,
    avatar.worldY,
    avatar.worldZ + avatar.localOffsetZ,
  ].map((value) => Number(value).toFixed(2)).join(",");
}

function cameraPoseForView(view, aspect) {
  const source = CAMERA_PRESETS[view] || CAMERA_PRESETS.arrival;
  const mobile = aspect < 0.78;
  const target = [...source.target];
  let eye;
  if (mobile && view === "arrival") {
    target.splice(0, 3, 2503, 101, 1723);
    eye = [2558, 116, 1781];
  } else {
    const distanceScale = mobile ? 1.08 : 1;
    eye = target.map((value, index) => value + (source.eye[index] - source.target[index]) * distanceScale);
  }
  return {
    eye,
    target,
    fov: source.fov + (mobile ? 2 : 0),
  };
}

function cameraStateFromPose(runtime, pose, aspect, far = 560) {
  const eyeX = Math.floor(pose.eye[0]);
  const eyeY = Math.floor(pose.eye[1]);
  const eyeZ = Math.floor(pose.eye[2]);
  const targetX = Math.floor(pose.target[0]);
  const targetY = Math.floor(pose.target[1]);
  const targetZ = Math.floor(pose.target[2]);
  return runtime.createCameraState({
    worldX: eyeX,
    worldY: eyeY,
    worldZ: eyeZ,
    localOffsetX: pose.eye[0] - eyeX,
    localOffsetY: pose.eye[1] - eyeY,
    localOffsetZ: pose.eye[2] - eyeZ,
    targetWorldX: targetX,
    targetWorldY: targetY,
    targetWorldZ: targetZ,
    targetLocalOffsetX: pose.target[0] - targetX,
    targetLocalOffsetY: pose.target[1] - targetY,
    targetLocalOffsetZ: pose.target[2] - targetZ,
    fov: pose.fov,
    aspect,
    near: 0.1,
    far,
  });
}

function projectInspectableStructure(target, pose, viewport, pointer) {
  const points = target.corners
    .map((corner) => projectWorldPoint(corner, pose, viewport))
    .filter(Boolean);
  if (points.length < 4) return null;
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  if (right < viewport.left || left > viewport.right || bottom < viewport.top || top > viewport.bottom) return null;

  const rect = Object.freeze({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  });
  const centerX = (left + right) * 0.5;
  const centerY = (top + bottom) * 0.5;
  const hitWidth = Math.max(BUILDING_INSPECTOR_MIN_TARGET_PX, rect.width);
  const hitHeight = Math.max(BUILDING_INSPECTOR_MIN_TARGET_PX, rect.height);
  const hitRect = Object.freeze({
    left: centerX - hitWidth * 0.5,
    top: centerY - hitHeight * 0.5,
    right: centerX + hitWidth * 0.5,
    bottom: centerY + hitHeight * 0.5,
  });
  const topCenter = projectWorldPoint([
    (target.worldBounds.minX + target.worldBounds.maxX) * 0.5,
    target.worldBounds.maxY,
    (target.worldBounds.minZ + target.worldBounds.maxZ) * 0.5,
  ], pose, viewport);
  const center = projectWorldPoint([
    (target.worldBounds.minX + target.worldBounds.maxX) * 0.5,
    (target.worldBounds.minY + target.worldBounds.maxY) * 0.5,
    (target.worldBounds.minZ + target.worldBounds.maxZ) * 0.5,
  ], pose, viewport);
  if (!center) return null;
  return {
    target,
    rect,
    hitRect,
    anchor: visibleProjectionAnchor(topCenter, center, rect, viewport),
    depth: center.depth,
    pointerDistance: Math.hypot(
      pointerDistanceAxis(pointer.x - centerX, hitWidth),
      pointerDistanceAxis(pointer.y - centerY, hitHeight),
    ),
  };
}

function projectInspectableModelOutline(target, pose, viewport, animationAngle = 0) {
  const cacheKey = projectedOutlineCacheKey(target, pose, viewport, animationAngle);
  const cached = buildingOutlineCache.get(target);
  if (cached?.key === cacheKey) return cached.outline;

  const projector = createWorldPointProjector(pose, viewport);
  const projectedFaces = [];
  for (const group of target.outlineGroups || []) {
    const angle = group.rotationPivot ? animationAngle : 0;
    const worldPoints = group.points.map((point) => (
      rotateStructureOutlinePoint(point, group.rotationPivot, angle)
    ));
    const projectedPoints = new Array(worldPoints.length);
    for (const face of group.faces) {
      const corners = face.pointIndexes.map((index) => worldPoints[index]);
      const centerX = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) * 0.25;
      const centerY = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) * 0.25;
      const centerZ = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) * 0.25;
      const normal = rotateStructureOutlineNormal(face.normal, angle);
      const facing = normal[0] * (pose.eye[0] - centerX)
        + normal[1] * (pose.eye[1] - centerY)
        + normal[2] * (pose.eye[2] - centerZ);
      if (facing <= 0.0001) continue;
      const projected = face.pointIndexes.map((index) => {
        if (projectedPoints[index] === undefined) {
          projectedPoints[index] = projectWorldPointWithProjector(worldPoints[index], projector);
        }
        return projectedPoints[index];
      });
      if (projected.some((corner) => !corner) || !projectedPolygonIntersectsViewport(projected, viewport)) continue;
      projectedFaces.push(projected);
    }
  }
  const outline = rasterizeInspectableSilhouette(projectedFaces, viewport);
  buildingOutlineCache.set(target, Object.freeze({ key: cacheKey, outline }));
  return outline;
}

function projectedOutlineCacheKey(target, pose, viewport, animationAngle) {
  const animated = target.outlineGroups?.some((group) => group.rotationPivot);
  const angleStep = animated
    ? Math.round((((animationAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 512 / (Math.PI * 2))
    : 0;
  return [
    ...pose.eye.map((value) => Number(value).toFixed(4)),
    ...pose.target.map((value) => Number(value).toFixed(4)),
    Number(pose.fov).toFixed(4),
    Number(viewport.left).toFixed(2),
    Number(viewport.top).toFixed(2),
    Math.round(viewport.width),
    Math.round(viewport.height),
    angleStep,
  ].join("|");
}

function rasterizeInspectableSilhouette(projectedFaces, viewport) {
  if (!projectedFaces.length || typeof document === "undefined") return null;
  let projectedLeft = Infinity;
  let projectedTop = Infinity;
  let projectedRight = -Infinity;
  let projectedBottom = -Infinity;
  for (const face of projectedFaces) {
    for (const point of face) {
      projectedLeft = Math.min(projectedLeft, point.x);
      projectedTop = Math.min(projectedTop, point.y);
      projectedRight = Math.max(projectedRight, point.x);
      projectedBottom = Math.max(projectedBottom, point.y);
    }
  }
  const margin = 3;
  const left = Math.max(viewport.left - margin, projectedLeft - margin);
  const top = Math.max(viewport.top - margin, projectedTop - margin);
  const right = Math.min(viewport.right + margin, projectedRight + margin);
  const bottom = Math.min(viewport.bottom + margin, projectedBottom + margin);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;

  const padding = 3;
  const scale = Math.min(
    BUILDING_OUTLINE_MASK_SCALE,
    (BUILDING_OUTLINE_MASK_MAX_SIZE - padding * 2) / width,
    (BUILDING_OUTLINE_MASK_MAX_SIZE - padding * 2) / height,
  );
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const canvasWidth = Math.max(1, Math.ceil(width * scale) + padding * 2);
  const canvasHeight = Math.max(1, Math.ceil(height * scale) + padding * 2);
  const canvas = reusableBuildingOutlineMaskCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.setTransform(scale, 0, 0, scale, padding - left * scale, padding - top * scale);
  context.fillStyle = "#fff";
  context.beginPath();
  for (const face of projectedFaces) {
    context.moveTo(face[0].x, face[0].y);
    for (let index = 1; index < face.length; index += 1) context.lineTo(face[index].x, face[index].y);
    context.closePath();
  }
  context.fill();
  context.setTransform(1, 0, 0, 1, 0, 0);

  const image = context.getImageData(0, 0, canvasWidth, canvasHeight);
  const contours = traceStructureMaskContours(image.data, canvasWidth, canvasHeight)
    .filter((contour) => polygonSignedArea(contour) > 0.5)
    .map((contour) => simplifyClosedContour(contour, BUILDING_OUTLINE_SIMPLIFY_TOLERANCE))
    .filter((contour) => contour.length >= 3)
    .map((contour) => contour.map(([x, y]) => Object.freeze({
      x: left + (x - padding) / scale,
      y: top + (y - padding) / scale,
    })));
  if (!contours.length) return null;

  const screenPoints = contours.flat();
  const outlineLeft = Math.min(...screenPoints.map((point) => point.x));
  const outlineTop = Math.min(...screenPoints.map((point) => point.y));
  const outlineRight = Math.max(...screenPoints.map((point) => point.x));
  const outlineBottom = Math.max(...screenPoints.map((point) => point.y));
  const path = contours.map((contour) => [
    `M ${contour[0].x.toFixed(2)} ${contour[0].y.toFixed(2)}`,
    ...contour.slice(1).map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
    "Z",
  ].join(" ")).join(" ");
  return Object.freeze({
    path,
    segmentCount: contours.reduce((sum, contour) => sum + contour.length, 0),
    bounds: Object.freeze({
      left: outlineLeft,
      top: outlineTop,
      right: outlineRight,
      bottom: outlineBottom,
      width: outlineRight - outlineLeft,
      height: outlineBottom - outlineTop,
    }),
  });
}

function reusableBuildingOutlineMaskCanvas(width, height) {
  if (!buildingOutlineMaskCanvas) buildingOutlineMaskCanvas = document.createElement("canvas");
  if (buildingOutlineMaskCanvas.width !== width) buildingOutlineMaskCanvas.width = width;
  if (buildingOutlineMaskCanvas.height !== height) buildingOutlineMaskCanvas.height = height;
  return buildingOutlineMaskCanvas;
}

function traceStructureMaskContours(rgba, width, height) {
  const filled = new Uint8Array(width * height);
  for (let index = 0; index < filled.length; index += 1) {
    filled[index] = rgba[index * 4 + 3] >= BUILDING_OUTLINE_MASK_ALPHA_THRESHOLD ? 1 : 0;
  }
  const isFilled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x] === 1;
  const edges = [];
  const outgoing = new Map();
  const pointKey = (x, y) => y * (width + 1) + x;
  const addEdge = (startX, startY, endX, endY, direction) => {
    const edge = { startX, startY, endX, endY, direction, visited: false };
    edges.push(edge);
    const key = pointKey(startX, startY);
    const bucket = outgoing.get(key);
    if (bucket) bucket.push(edge);
    else outgoing.set(key, [edge]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFilled(x, y)) continue;
      if (!isFilled(x, y - 1)) addEdge(x, y, x + 1, y, 0);
      if (!isFilled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
      if (!isFilled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
      if (!isFilled(x - 1, y)) addEdge(x, y + 1, x, y, 3);
    }
  }

  const contours = [];
  for (const firstEdge of edges) {
    if (firstEdge.visited) continue;
    const startKey = pointKey(firstEdge.startX, firstEdge.startY);
    const contour = [];
    let edge = firstEdge;
    let closed = false;
    for (let guard = 0; guard <= edges.length; guard += 1) {
      edge.visited = true;
      contour.push([edge.startX, edge.startY]);
      const endKey = pointKey(edge.endX, edge.endY);
      if (endKey === startKey) {
        closed = true;
        break;
      }
      const candidates = (outgoing.get(endKey) || []).filter((candidate) => !candidate.visited);
      edge = selectMaskBoundaryEdge(candidates, edge.direction);
      if (!edge) break;
    }
    if (closed && contour.length >= 4) contours.push(removeCollinearContourPoints(contour));
  }
  return contours;
}

function selectMaskBoundaryEdge(candidates, incomingDirection) {
  const turnPriority = [1, 0, 3, 2];
  return candidates.sort((left, right) => (
    turnPriority.indexOf((left.direction - incomingDirection + 4) % 4)
      - turnPriority.indexOf((right.direction - incomingDirection + 4) % 4)
  ))[0] || null;
}

function removeCollinearContourPoints(points) {
  if (points.length < 4) return points;
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return (point[0] - previous[0]) * (next[1] - point[1])
      !== (point[1] - previous[1]) * (next[0] - point[0]);
  });
}

function simplifyClosedContour(points, tolerance) {
  const clean = removeCollinearContourPoints(points);
  if (clean.length <= 4) return clean;
  let splitIndex = 1;
  let farthestDistance = 0;
  for (let index = 1; index < clean.length; index += 1) {
    const distance = squaredDistance(clean[0], clean[index]);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      splitIndex = index;
    }
  }
  const firstArc = simplifyOpenPolyline(clean.slice(0, splitIndex + 1), tolerance);
  const secondArc = simplifyOpenPolyline([...clean.slice(splitIndex), clean[0]], tolerance);
  return [...firstArc, ...secondArc.slice(1, -1)];
}

function simplifyOpenPolyline(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const toleranceSquared = tolerance * tolerance;
  while (stack.length) {
    const [start, end] = stack.pop();
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;
    for (let index = start + 1; index < end; index += 1) {
      const distance = squaredSegmentDistance(points[index], points[start], points[end]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }
    if (farthestIndex < 0) continue;
    keep[farthestIndex] = 1;
    stack.push([start, farthestIndex], [farthestIndex, end]);
  }
  return points.filter((_, index) => keep[index] === 1);
}

function squaredSegmentDistance(point, start, end) {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (!lengthSquared) return squaredDistance(point, start);
  const amount = clamp(
    ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) / lengthSquared,
    0,
    1,
  );
  const projected = [start[0] + deltaX * amount, start[1] + deltaY * amount];
  return squaredDistance(point, projected);
}

function squaredDistance(left, right) {
  const deltaX = left[0] - right[0];
  const deltaY = left[1] - right[1];
  return deltaX * deltaX + deltaY * deltaY;
}

function polygonSignedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area * 0.5;
}

function rotateStructureOutlinePoint(point, pivot, angle) {
  if (!pivot || Math.abs(angle) < 0.00001) return point;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const deltaX = point[0] - pivot.x;
  const deltaY = point[1] - pivot.y;
  return [
    pivot.x + deltaX * cosine - deltaY * sine,
    pivot.y + deltaX * sine + deltaY * cosine,
    point[2],
  ];
}

function rotateStructureOutlineNormal(normal, angle) {
  if (Math.abs(angle) < 0.00001) return normal;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    normal[0] * cosine - normal[1] * sine,
    normal[0] * sine + normal[1] * cosine,
    normal[2],
  ];
}

function projectedPolygonIntersectsViewport(points, viewport) {
  const margin = 8;
  return Math.max(...points.map((point) => point.x)) >= viewport.left - margin
    && Math.min(...points.map((point) => point.x)) <= viewport.right + margin
    && Math.max(...points.map((point) => point.y)) >= viewport.top - margin
    && Math.min(...points.map((point) => point.y)) <= viewport.bottom + margin;
}

function visibleProjectionAnchor(topCenter, center, rect, viewport) {
  const visibleRect = {
    left: Math.max(viewport.left, rect.left),
    top: Math.max(viewport.top, rect.top),
    right: Math.min(viewport.right, rect.right),
    bottom: Math.min(viewport.bottom, rect.bottom),
  };
  const preferred = topCenter && pointInsideRect(topCenter.x, topCenter.y, visibleRect)
    ? topCenter
    : center;
  const insetX = Math.min(6, Math.max(0, (visibleRect.right - visibleRect.left) * 0.5));
  const insetY = Math.min(6, Math.max(0, (visibleRect.bottom - visibleRect.top) * 0.5));
  return Object.freeze({
    x: clamp(preferred.x, visibleRect.left + insetX, visibleRect.right - insetX),
    y: clamp(preferred.y, visibleRect.top + insetY, visibleRect.bottom - insetY),
  });
}

function createPointerRay(pose, viewport, pointer) {
  if (!viewport.width || !viewport.height) return null;
  const forward = normalizeVector(subtractVector(pose.target, pose.eye));
  const right = normalizeVector(crossVector(forward, [0, 1, 0]));
  const up = crossVector(right, forward);
  const tangent = Math.tan((pose.fov * Math.PI) / 360);
  const aspect = Math.max(0.25, viewport.width / Math.max(1, viewport.height));
  const normalizedX = ((pointer.x - viewport.left) / viewport.width) * 2 - 1;
  const normalizedY = 1 - ((pointer.y - viewport.top) / viewport.height) * 2;
  return Object.freeze({
    origin: pose.eye,
    direction: normalizeVector([
      forward[0] + right[0] * normalizedX * tangent * aspect + up[0] * normalizedY * tangent,
      forward[1] + right[1] * normalizedX * tangent * aspect + up[1] * normalizedY * tangent,
      forward[2] + right[2] * normalizedX * tangent * aspect + up[2] * normalizedY * tangent,
    ]),
  });
}

function raycastInspectableStructure(target, ray) {
  const interval = rayBoundsInterval(ray, target.worldBounds);
  if (!interval || interval.exit < 0) return null;
  const entry = Math.max(0, interval.enter);
  const epsilon = 1e-5;
  const start = addScaledVector(ray.origin, ray.direction, entry + epsilon);
  let voxelX = Math.floor(start[0]);
  let voxelY = Math.floor(start[1]);
  let voxelZ = Math.floor(start[2]);
  const stepX = Math.sign(ray.direction[0]);
  const stepY = Math.sign(ray.direction[1]);
  const stepZ = Math.sign(ray.direction[2]);
  const deltaX = stepX ? Math.abs(1 / ray.direction[0]) : Infinity;
  const deltaY = stepY ? Math.abs(1 / ray.direction[1]) : Infinity;
  const deltaZ = stepZ ? Math.abs(1 / ray.direction[2]) : Infinity;
  let nextX = nextVoxelBoundaryDistance(ray.origin[0], ray.direction[0], voxelX, stepX);
  let nextY = nextVoxelBoundaryDistance(ray.origin[1], ray.direction[1], voxelY, stepY);
  let nextZ = nextVoxelBoundaryDistance(ray.origin[2], ray.direction[2], voxelZ, stepZ);
  let distance = entry;

  for (let steps = 0; steps < 256 && distance <= interval.exit + epsilon; steps += 1) {
    if (target.hasWorldVoxel(voxelX, voxelY, voxelZ)) return distance;
    distance = Math.min(nextX, nextY, nextZ);
    if (!Number.isFinite(distance)) break;
    if (nextX <= distance + epsilon) {
      voxelX += stepX;
      nextX += deltaX;
    }
    if (nextY <= distance + epsilon) {
      voxelY += stepY;
      nextY += deltaY;
    }
    if (nextZ <= distance + epsilon) {
      voxelZ += stepZ;
      nextZ += deltaZ;
    }
  }
  return null;
}

function rayBoundsInterval(ray, bounds) {
  let enter = -Infinity;
  let exit = Infinity;
  const minimum = [bounds.minX, bounds.minY, bounds.minZ];
  const maximum = [bounds.maxX, bounds.maxY, bounds.maxZ];
  for (let axis = 0; axis < 3; axis += 1) {
    const origin = ray.origin[axis];
    const direction = ray.direction[axis];
    if (Math.abs(direction) < 1e-8) {
      if (origin < minimum[axis] || origin > maximum[axis]) return null;
      continue;
    }
    const first = (minimum[axis] - origin) / direction;
    const second = (maximum[axis] - origin) / direction;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (exit < enter) return null;
  }
  return { enter, exit };
}

function nextVoxelBoundaryDistance(origin, direction, voxel, step) {
  if (!step) return Infinity;
  const boundary = step > 0 ? voxel + 1 : voxel;
  return (boundary - origin) / direction;
}

function addScaledVector(origin, direction, amount) {
  return [
    origin[0] + direction[0] * amount,
    origin[1] + direction[1] * amount,
    origin[2] + direction[2] * amount,
  ];
}

function worldVoxelKey(x, y, z) {
  return `${x},${y},${z}`;
}

function projectWorldPoint(point, pose, viewport) {
  return projectWorldPointWithProjector(point, createWorldPointProjector(pose, viewport));
}

function createWorldPointProjector(pose, viewport) {
  const forward = normalizeVector(subtractVector(pose.target, pose.eye));
  const right = normalizeVector(crossVector(forward, [0, 1, 0]));
  const up = crossVector(right, forward);
  const tangent = Math.tan((pose.fov * Math.PI) / 360);
  const aspect = Math.max(0.25, viewport.width / Math.max(1, viewport.height));
  return Object.freeze({ pose, viewport, forward, right, up, tangent, aspect });
}

function projectWorldPointWithProjector(point, projector) {
  const deltaX = point[0] - projector.pose.eye[0];
  const deltaY = point[1] - projector.pose.eye[1];
  const deltaZ = point[2] - projector.pose.eye[2];
  const depth = deltaX * projector.forward[0]
    + deltaY * projector.forward[1]
    + deltaZ * projector.forward[2];
  if (depth <= 0.1) return null;
  const normalizedX = (
    deltaX * projector.right[0]
    + deltaY * projector.right[1]
    + deltaZ * projector.right[2]
  ) / (depth * projector.tangent * projector.aspect);
  const normalizedY = (
    deltaX * projector.up[0]
    + deltaY * projector.up[1]
    + deltaZ * projector.up[2]
  ) / (depth * projector.tangent);
  return {
    x: projector.viewport.left + (normalizedX + 1) * 0.5 * projector.viewport.width,
    y: projector.viewport.top + (1 - normalizedY) * 0.5 * projector.viewport.height,
    depth,
  };
}

function subtractVector(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function normalizeVector(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function crossVector(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dotVector(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function pointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pointerDistanceAxis(center, extent) {
  return Math.abs(center) / Math.max(1, extent);
}

function isBuildingInspectionPointerTarget(target) {
  if (!(target instanceof Element)) return true;
  return !target.closest("a, button, input, select, textarea, [contenteditable], .chapter-card, .chapter-nav, .site-header, .site-footer");
}

function terrainReadinessProbe(chunk) {
  const centerY = (PRESENTATION_WATER_BED_Y + PRESENTATION_GROUND_Y + 12) * 0.5;
  return {
    chunkX: chunk.chunkX,
    chunkZ: chunk.chunkZ,
    frustumCullEligible: true,
    frustumBounds: {
      centerX: chunk.chunkX * 16 + 8,
      centerY,
      centerZ: chunk.chunkZ * 16 + 8,
      radius: Math.hypot(12, 14, 12),
    },
  };
}

function gpuMeshReady(chunk) {
  if (!chunk?.mesh) return false;
  if (chunk.mesh.indexCount > 0 && !chunk.gpuUploaded) return false;
  if (chunk.visualMesh?.indexCount > 0 && !chunk.visualGpuUploaded) return false;
  return true;
}

function isWebGl2UnavailableError(error) {
  return /webgl\s*2[^.]*?(?:unavailable|not available|unsupported|not supported)/iu
    .test(String(error?.message || error || ""));
}

function canvasAspect(canvas) {
  const rect = canvas.getBoundingClientRect();
  return Math.max(0.25, (rect.width || window.innerWidth || 1) / Math.max(1, rect.height || window.innerHeight || 1));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function mix(left, right, amount) {
  return left + (right - left) * amount;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mixVector(left, right, amount) {
  return left.map((value, index) => mix(value, right[index], amount));
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function createNoopController() {
  return {
    ready: Promise.resolve({ status: "unavailable" }),
    focus() {},
    stats: Object.freeze({
      backend: "unavailable",
      terrainChunks: 0,
      structureChunks: 0,
      avatars: 0,
      drawCalls: 0,
      triangles: 0,
      maxFps: 0,
    }),
    destroy() {},
  };
}

export const HOME_WORLD_SECTION_VIEWS = SECTION_VIEWS;
