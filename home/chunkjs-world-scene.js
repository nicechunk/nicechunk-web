import cottageDefinition from "../build_ncm/buildings/coastal/seaside-cottage.json";
import noticeBoardDefinition from "../build_ncm/buildings/civic/covered-village-notice-board.json";
import hollowCottageDefinition from "../build_ncm/buildings/residential/hollow-cottage.json";
import footbridgeDefinition from "../build_ncm/buildings/transport/stone-timber-footbridge.json";
import windmillDefinition from "../build_ncm/buildings/agriculture/stone-timber-tower-windmill.json";

const DEFAULT_RUNTIME_ROOT = "/chunk.js";
const SECTION_VIEWS = Object.freeze(["arrival", "world", "market", "guardian", "roadmap"]);
// A naturally generated, broad coastal plain from the canonical mainnet seed.
const WORLD_CENTER = Object.freeze({ x: 2432, y: 100, z: 1712 });
const MOBILE_TERRAIN_VIEW_DISTANCE = 6;
const DESKTOP_TERRAIN_VIEW_DISTANCE = 7;
const CAMERA_TRANSITION_MS = 1_180;
const AVATAR_HEIGHT_BLOCKS = 1.75 / 0.4;
const AVATAR_VISUAL_SCALE = AVATAR_HEIGHT_BLOCKS / 2.52;
const PRESENTATION_GROUND_Y = 99;
const PRESENTATION_WATER_Y = 96;
const PRESENTATION_WATER_BED_Y = 93;
const MINING_TARGET = Object.freeze({ x: 2385, z: 1644 });
const ACTOR_SITES = Object.freeze({
  boy: Object.freeze({ x: 2544, z: 1785, yaw: -2.35 }),
  boyMine: Object.freeze({ x: 2388, z: 1648, yaw: -2.36 }),
  girl: Object.freeze({ x: 2553, z: 1768, yaw: -2.42 }),
  girlCottage: Object.freeze({ x: 2399, z: 1703, yaw: 1.48 }),
  bridgeEast: Object.freeze({ x: 2464, z: 1700 }),
  bridgeWest: Object.freeze({ x: 2428, z: 1700 }),
});
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
const PRESENTATION_LANDMASSES = Object.freeze([
  Object.freeze({ x: 2392, z: 1715, radiusX: 77, radiusZ: 112 }),
  Object.freeze({ x: 2494, z: 1712, radiusX: 83, radiusZ: 112 }),
]);
const WESTERN_BAY = Object.freeze({ x: 2356, z: 1710, radiusX: 43, radiusZ: 61 });
const COASTAL_STAGE_BOUNDS = Object.freeze({ minX: 2320, maxX: 2559, minZ: 1600, maxZ: 1839 });
const STRUCTURE_SPECS = Object.freeze([
  Object.freeze({
    id: "coastal-cottage",
    definition: cottageDefinition,
    minX: 2359,
    minZ: 1687,
    surfaceY: PRESENTATION_WATER_BED_Y,
    quarterTurns: 0,
    siteMode: "water",
  }),
  Object.freeze({
    id: "river-footbridge",
    definition: footbridgeDefinition,
    minX: 2431,
    minZ: 1694,
    surfaceY: PRESENTATION_GROUND_Y,
    quarterTurns: 0,
    siteMode: "bridge",
    walkable: true,
    walkCorridor: Object.freeze({ minLocalZ: 4, maxLocalZ: 8 }),
  }),
  Object.freeze({
    id: "village-notice-board",
    definition: noticeBoardDefinition,
    minX: 2480,
    minZ: 1742,
    surfaceY: 100,
    quarterTurns: 1,
  }),
  Object.freeze({
    id: "hollow-cottage",
    definition: hollowCottageDefinition,
    minX: 2488,
    minZ: 1682,
    surfaceY: 100,
    quarterTurns: 2,
  }),
  Object.freeze({
    id: "tower-windmill",
    definition: windmillDefinition,
    minX: 2510,
    minZ: 1624,
    surfaceY: 100,
    quarterTurns: 2,
  }),
]);
const PRESENTATION_TREES = Object.freeze([
  Object.freeze({ x: 2400, z: 1629, height: 6 }),
  Object.freeze({ x: 2373, z: 1770, height: 7 }),
  Object.freeze({ x: 2414, z: 1800, height: 6 }),
  Object.freeze({ x: 2490, z: 1652, height: 6 }),
  Object.freeze({ x: 2531, z: 1712, height: 7 }),
  Object.freeze({ x: 2508, z: 1791, height: 6 }),
]);
const PRESENTATION_PLANTS = Object.freeze([
  Object.freeze({ x: 2520, z: 1735, block: "flowerYellow" }),
  Object.freeze({ x: 2492, z: 1664, block: "flowerWhite" }),
  Object.freeze({ x: 2538, z: 1762, block: "flowerPink" }),
  Object.freeze({ x: 2498, z: 1772, block: "flowerBlue" }),
  Object.freeze({ x: 2408, z: 1668, block: "flowerRed" }),
  Object.freeze({ x: 2386, z: 1782, block: "grassPlant" }),
  Object.freeze({ x: 2420, z: 1742, block: "grassPlant" }),
  Object.freeze({ x: 2398, z: 1685, block: "flowerWhite" }),
]);

const CAMERA_PRESETS = Object.freeze({
  arrival: Object.freeze({
    eye: [2585, 130, 1815],
    target: [2444, 99.2, 1704],
    fov: 47,
  }),
  world: Object.freeze({
    eye: [2570, 122, 1805],
    target: [2438, 99.5, 1698],
    fov: 45,
  }),
  market: Object.freeze({
    eye: [2588, 119, 1805],
    target: [2490, 101, 1715],
    fov: 43,
  }),
  guardian: Object.freeze({
    eye: [2595, 130, 1760],
    target: [2518, 111, 1634],
    fov: 42,
  }),
  roadmap: Object.freeze({
    eye: [2630, 192, 1885],
    target: [2440, 99, 1715],
    fov: 51,
  }),
});

export function createHomeWorldScene(canvas, options = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return createNoopController();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lowPower = Number(navigator.deviceMemory || 8) <= 4 || navigator.connection?.saveData === true;
  const requestedFps = Number(options.maxFps) || (window.innerWidth < 700 ? 20 : 30);
  const maxFps = Math.max(12, Math.min(lowPower ? 20 : 30, requestedFps));
  const terrainViewDistance = lowPower || window.innerWidth < 700
    ? MOBILE_TERRAIN_VIEW_DISTANCE
    : DESKTOP_TERRAIN_VIEW_DISTANCE;
  let expectedTerrainChunks = (terrainViewDistance * 2 + 1) ** 2;
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
  let transitionStart = startedAt;
  let cameraStart = cameraPoseForView("arrival", canvasAspect(canvas));
  let cameraTarget = cameraStart;
  let lastMiningBurst = -1;
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
    cameraTarget = cameraPoseForView(view, canvasAspect(canvas));
    transitionStart = immediate || reducedMotion.matches ? timestamp - CAMERA_TRANSITION_MS : timestamp;
    canvas.dataset.sceneView = view;
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
    renderer.updateVoxelParticles(dt, (worldX, worldZ) => chunks.getOpaqueColumnTopAtWorld(worldX, worldZ) + 1);

    const terrainChunks = [...chunks.chunks.values()].filter((chunk) => chunk.mesh);
    const activeStructureChunks = structureChunks;
    const visibleChunks = terrainChunks.concat(activeStructureChunks);
    const camera = cameraStateFromPose(runtime, resolveCameraPose(timestamp), canvasAspect(canvas));
    renderer.prepareChunksForRender(visibleChunks, {
      maxUploads: lowPower ? 2 : 5,
      cameraState: camera,
    });
    const renderStats = renderer.render(camera, visibleChunks, avatars, overlaysForView(timestamp));
    lastStats = Object.freeze({
      backend: "chunk.js-webgl2",
      terrainChunks: terrainChunks.length,
      structureChunks: activeStructureChunks.length,
      avatars: avatars.length,
      drawCalls: renderStats.drawCalls || 0,
      triangles: renderStats.triangles || 0,
      maxFps,
    });
    canvas.dataset.sceneTerrainChunks = String(lastStats.terrainChunks);
    canvas.dataset.sceneStructureChunks = String(lastStats.structureChunks);
    canvas.dataset.sceneDrawCalls = String(lastStats.drawCalls);
    canvas.dataset.sceneTriangles = String(lastStats.triangles);

    if (canvas.dataset.sceneReady !== "true" && terrainChunks.length >= expectedTerrainChunks) markReady();
    schedule();
  }

  function updateActors(timestamp) {
    const elapsed = Math.max(0, timestamp - startedAt) * actorTimeScale;
    const boy = avatars.find((avatar) => avatar.role === "villager-boy");
    const girl = avatars.find((avatar) => avatar.role === "villager-girl");
    const boyPose = reducedMotion.matches
      ? staticRoutePose(ACTOR_ROUTES.boy)
      : sampleRoute(ACTOR_ROUTES.boy, elapsed);
    const girlPose = reducedMotion.matches
      ? staticRoutePose(ACTOR_ROUTES.girl)
      : sampleRoute(ACTOR_ROUTES.girl, elapsed + 1_800);
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

  function overlaysForView(timestamp) {
    if (focusView === "world") {
      const pulse = reducedMotion.matches ? 0.24 : 0.18 + (Math.sin(timestamp * 0.004) + 1) * 0.07;
      return [{
        worldX: MINING_TARGET.x,
        worldY: miningTargetY(),
        worldZ: MINING_TARGET.z,
        size: 1,
        expand: 0.025,
        fillColor: [0.1, 0.72, 1, pulse * 0.2],
        lineColor: [0.28, 0.9, 1, 0.82],
      }];
    }
    if (focusView === "market") {
      return [{
        shape: "foundation",
        worldX: 2468,
        worldY: 100.02,
        worldZ: 1657,
        width: 21,
        depth: 15,
        preview: true,
        grid: false,
        fillColor: [0.76, 0.94, 0.16, 0.018],
        edgeColor: [0.76, 0.94, 0.16, 0.34],
        glowColor: [0.76, 0.94, 0.16, 0.1],
      }];
    }
    return [];
  }

  function miningTargetY() {
    return chunks?.getOpaqueColumnTopAtWorld(MINING_TARGET.x, MINING_TARGET.z)
      ?? runtime.terrainSurfaceHeight(worldConfig, MINING_TARGET.x, MINING_TARGET.z);
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
    canvas.dataset.sceneActorBehavior = "waypoint-walk-bridge-idle-mine-loop";
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
      runtime = await loadChunkRuntime(options.runtimeRoot || DEFAULT_RUNTIME_ROOT);
      if (destroyed) return;
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
        deferInitialBuilds: true,
        visibilityLingerFrames: 0,
      });
      chunks.updatePlayerPosition(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_CENTER.z, {
        directionX: 0.18,
        directionZ: -1,
      });
      const presentationBounds = presentationBoundsForView(WORLD_CENTER, terrainViewDistance);
      chunks.applyPendingDelta(
        createPresentationDeltas(runtime, worldConfig, presentationBounds),
        "homepage-scene-presentation",
      );
      expectedTerrainChunks = chunks.chunks.size;
      chunks.setBuildConcurrencyLimit(terrainWorkerCount);
      const structures = createStructures(runtime);
      structureChunks = structures.chunks;
      structureWalkSurfaces = structures.walkSurfaces;
      const [boyMesh, girlMesh] = await createVillagerMeshes(runtime);
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
  reducedMotion.addEventListener?.("change", handleVisibility);
  cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibility));
  cleanups.push(() => window.removeEventListener("pointermove", handlePointerMove));
  cleanups.push(() => reducedMotion.removeEventListener?.("change", handleVisibility));
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
  const load = (path) => import(/* @vite-ignore */ `${root}/${path}`);
  const [
    chunkManager,
    buildingMesher,
    buildingParser,
    avatarMesh,
    camera,
    renderer,
    blockRegistry,
    worldGenerator,
  ] = await Promise.all([
    load("chunk/chunk-manager.js"),
    load("construction/building-mesher.js"),
    load("construction/building-parser.js"),
    load("renderer/avatar-mesh.js"),
    load("renderer/camera.js"),
    load("renderer/webgl2-renderer.js"),
    load("world/block-registry.js"),
    load("world/world-generator.js"),
  ]);
  return {
    ChunkManager: chunkManager.ChunkManager,
    createBuildingChunkMeshes: buildingMesher.createBuildingChunkMeshes,
    createBuildingPlacement: buildingParser.createBuildingPlacement,
    parseNcm3Building: buildingParser.parseNcm3Building,
    createAvatarMeshFromNcm: avatarMesh.createAvatarMeshFromNcm,
    createCameraState: camera.createCameraState,
    WebGL2VoxelRenderer: renderer.WebGL2VoxelRenderer,
    BLOCK_ID: blockRegistry.BLOCK_ID,
    MATERIAL_ID: blockRegistry.MATERIAL_ID,
    createWorldGeneratorConfig: worldGenerator.createWorldGeneratorConfig,
    DEFAULT_GENERATION_VERSION: worldGenerator.DEFAULT_GENERATION_VERSION,
    MAINNET_WORLD_SEED: worldGenerator.MAINNET_WORLD_SEED,
    terrainSurfaceHeight: worldGenerator.terrainSurfaceHeight,
  };
}

function createStructures(runtime) {
  const chunks = [];
  const walkSurfaces = new Map();
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
    const placement = runtime.createBuildingPlacement(building, foundation, {
      placementId: spec.id,
      quarterTurns: spec.quarterTurns,
    });
    const placementChunks = runtime.createBuildingChunkMeshes(placement, { chunkSize: 16, revision: revision++ });
    placementChunks.forEach((chunk) => {
      chunk.sceneStructureId = spec.id;
    });
    if (spec.walkable) addStructureWalkSurfaces(placement, spec, walkSurfaces);
    chunks.push(...placementChunks);
  }
  return { chunks, walkSurfaces };
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

function createPresentationDeltas(runtime, worldConfig, bounds = COASTAL_STAGE_BOUNDS) {
  const deltas = new Map();
  const put = (worldX, worldY, worldZ, blockId) => {
    if (worldX < bounds.minX || worldX > bounds.maxX || worldZ < bounds.minZ || worldZ > bounds.maxZ) return;
    deltas.set(`${worldX},${worldY},${worldZ}`, { worldX, worldY, worldZ, blockId });
  };

  addCoastalStageDeltas(runtime, worldConfig, put, bounds);
  addStructureSiteDeltas(runtime, worldConfig, put);
  put(MINING_TARGET.x, PRESENTATION_GROUND_Y, MINING_TARGET.z, runtime.BLOCK_ID.coal);
  PRESENTATION_TREES.forEach((tree) => addTreeDeltas(runtime, worldConfig, tree, put));
  PRESENTATION_PLANTS.forEach((plant) => {
    put(plant.x, PRESENTATION_GROUND_Y + 1, plant.z, runtime.BLOCK_ID[plant.block]);
  });
  return [...deltas.values()];
}

function presentationBoundsForView(center, viewDistance) {
  const chunkSize = 16;
  const centerChunkX = Math.floor(center.x / chunkSize);
  const centerChunkZ = Math.floor(center.z / chunkSize);
  return Object.freeze({
    minX: Math.max(COASTAL_STAGE_BOUNDS.minX, (centerChunkX - viewDistance) * chunkSize),
    maxX: Math.min(COASTAL_STAGE_BOUNDS.maxX, (centerChunkX + viewDistance + 1) * chunkSize - 1),
    minZ: Math.max(COASTAL_STAGE_BOUNDS.minZ, (centerChunkZ - viewDistance) * chunkSize),
    maxZ: Math.min(COASTAL_STAGE_BOUNDS.maxZ, (centerChunkZ + viewDistance + 1) * chunkSize - 1),
  });
}

function addCoastalStageDeltas(runtime, worldConfig, put, bounds) {
  const { minX, maxX, minZ, maxZ } = bounds;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const landDistance = Math.min(...PRESENTATION_LANDMASSES.map((landmass) => ellipseDistance(x, z, landmass)));
      const riverDistance = presentationRiverDistance(x, z);
      const bayDistance = ellipseDistance(x, z, WESTERN_BAY);
      if (landDistance > 0 || riverDistance <= 0 || bayDistance <= 0) {
        addWaterColumn(runtime, worldConfig, x, z, put);
        continue;
      }
      const shoreDistance = Math.min(-landDistance, riverDistance, bayDistance);
      if (shoreDistance <= 4.25) {
        addLandColumn(runtime, worldConfig, x, z, PRESENTATION_WATER_Y + 1, runtime.BLOCK_ID.sand, put, true);
        continue;
      }
      addLandColumn(runtime, worldConfig, x, z, PRESENTATION_GROUND_Y, runtime.BLOCK_ID.grass, put, true);
    }
  }
}

function addWaterColumn(runtime, worldConfig, x, z, put) {
  const sourceY = runtime.terrainSurfaceHeight(worldConfig, x, z);
  put(x, PRESENTATION_WATER_BED_Y, z, runtime.BLOCK_ID.sand);
  for (let y = PRESENTATION_WATER_BED_Y + 1; y <= PRESENTATION_WATER_Y; y += 1) {
    put(x, y, z, runtime.BLOCK_ID.water);
  }
  for (let y = PRESENTATION_WATER_Y + 1; y <= Math.max(PRESENTATION_WATER_Y + 1, sourceY + 8); y += 1) {
    put(x, y, z, runtime.BLOCK_ID.air);
  }
}

function addLandColumn(runtime, worldConfig, x, z, targetY, topBlockId, put, clearDecorations) {
  const sourceY = runtime.terrainSurfaceHeight(worldConfig, x, z);
  const fillStart = Math.min(sourceY + 1, targetY);
  for (let y = fillStart; y < targetY; y += 1) put(x, y, z, runtime.BLOCK_ID.dirt);
  put(x, targetY, z, topBlockId);
  const clearTop = clearDecorations ? sourceY + 8 : Math.max(sourceY, targetY);
  for (let y = targetY + 1; y <= clearTop; y += 1) put(x, y, z, runtime.BLOCK_ID.air);
}

function presentationRiverDistance(x, z) {
  const amount = clamp(
    (z - COASTAL_STAGE_BOUNDS.minZ) / (COASTAL_STAGE_BOUNDS.maxZ - COASTAL_STAGE_BOUNDS.minZ),
    0,
    1,
  );
  const centerX = 2446 + Math.sin(amount * Math.PI * 2) * 4;
  const halfWidth = 8.5 + Math.sin(amount * Math.PI) * 1.5;
  return Math.abs(x - centerX) - halfWidth;
}

function ellipseDistance(x, z, ellipse) {
  const normalized = Math.hypot((x - ellipse.x) / ellipse.radiusX, (z - ellipse.z) / ellipse.radiusZ);
  return (normalized - 1) * Math.min(ellipse.radiusX, ellipse.radiusZ);
}

function addStructureSiteDeltas(runtime, worldConfig, put) {
  for (const spec of STRUCTURE_SPECS) {
    const building = runtime.parseNcm3Building(spec.definition.ncm.code, { id: spec.id });
    const width = spec.quarterTurns % 2 === 0 ? building.size.x : building.size.z;
    const depth = spec.quarterTurns % 2 === 0 ? building.size.z : building.size.x;
    const groundY = spec.surfaceY - 1;
    for (let z = spec.minZ; z < spec.minZ + depth; z += 1) {
      for (let x = spec.minX; x < spec.minX + width; x += 1) {
        const sourceY = runtime.terrainSurfaceHeight(worldConfig, x, z);
        if (spec.siteMode === "water") {
          addWaterColumn(runtime, worldConfig, x, z, put);
        } else if (spec.siteMode !== "bridge") {
          addLandColumn(runtime, worldConfig, x, z, groundY, runtime.BLOCK_ID.grass, put, true);
        }
        const clearFromY = spec.siteMode === "water" ? PRESENTATION_WATER_Y + 1 : PRESENTATION_GROUND_Y + 1;
        for (let y = clearFromY; y <= Math.max(sourceY + 14, clearFromY); y += 1) {
          put(x, y, z, runtime.BLOCK_ID.air);
        }
      }
    }
  }
}

function addTreeDeltas(runtime, worldConfig, tree, put) {
  const groundY = PRESENTATION_GROUND_Y;
  const crownY = groundY + tree.height;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.abs(dx) + Math.abs(dz) + Math.max(0, Math.abs(dy) - 1);
        if (distance > 4 || (dx === 0 && dz === 0 && dy < 1)) continue;
        put(tree.x + dx, crownY + dy, tree.z + dz, runtime.BLOCK_ID.leaves);
      }
    }
  }
  for (let y = groundY + 1; y <= crownY + 1; y += 1) {
    put(tree.x, y, tree.z, runtime.BLOCK_ID.trunk);
  }
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
    target.splice(0, 3, 2510, 100, 1725);
    eye = [2581, 124, 1812];
  } else {
    const distanceScale = mobile ? 1.25 : 1;
    eye = target.map((value, index) => value + (source.eye[index] - source.target[index]) * distanceScale);
  }
  return {
    eye,
    target,
    fov: source.fov + (mobile ? (view === "arrival" ? 5 : 4) : 0),
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
