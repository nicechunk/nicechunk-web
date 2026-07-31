import cottageDefinition from "../build_ncm/buildings/coastal/seaside-cottage.json";
import marketDefinition from "../build_ncm/buildings/commerce/covered-market-stall.json";
import mineDefinition from "../build_ncm/buildings/mining/timber-mine-headframe.json";
import windmillDefinition from "../build_ncm/buildings/agriculture/stone-timber-tower-windmill.json";

const DEFAULT_RUNTIME_ROOT = "/chunk.js";
const SECTION_VIEWS = Object.freeze(["arrival", "world", "market", "guardian", "roadmap"]);
// A naturally generated, broad coastal plain from the canonical mainnet seed.
const WORLD_CENTER = Object.freeze({ x: 2432, y: 100, z: 1712 });
const MOBILE_TERRAIN_VIEW_DISTANCE = 4;
const DESKTOP_TERRAIN_VIEW_DISTANCE = 5;
const CAMERA_TRANSITION_MS = 1_180;
const AVATAR_HEIGHT_BLOCKS = 1.75 / 0.4;
const AVATAR_VISUAL_SCALE = AVATAR_HEIGHT_BLOCKS / 2.52;
const PRESENTATION_GROUND_Y = 99;
const PRESENTATION_WATER_Y = 96;
const PRESENTATION_WATER_BED_Y = 93;
const MINING_TARGET = Object.freeze({ x: 2405, z: 1683 });
const ACTOR_SITES = Object.freeze({
  boy: Object.freeze({ x: 2514, z: 1744, yaw: -2.35 }),
  boyMine: Object.freeze({ x: 2408, z: 1686, yaw: -2.36 }),
  girl: Object.freeze({ x: 2518, z: 1742, yaw: -2.42 }),
  girlMarket: Object.freeze({ x: 2431, z: 1626, yaw: -2.7 }),
});
const ACTOR_ROUTES = Object.freeze({
  boy: createRoute([
    routeStop("idle", ACTOR_SITES.boy, 4_000),
    routeWalk(ACTOR_SITES.boy, { x: 2471, z: 1678 }, 14_500),
    routeWalk({ x: 2471, z: 1678 }, { x: 2439, z: 1669 }, 6_600),
    routeWalk({ x: 2439, z: 1669 }, ACTOR_SITES.boyMine, 6_200),
    routeStop("mine", ACTOR_SITES.boyMine, 5_200, { lookAt: MINING_TARGET }),
    routeWalk(ACTOR_SITES.boyMine, { x: 2441, z: 1669 }, 6_600),
    routeWalk({ x: 2441, z: 1669 }, { x: 2474, z: 1679 }, 6_800),
    routeWalk({ x: 2474, z: 1679 }, ACTOR_SITES.boy, 14_200),
  ]),
  girl: createRoute([
    routeStop("idle", ACTOR_SITES.girl, 4_400),
    routeWalk(ACTOR_SITES.girl, { x: 2488, z: 1677 }, 18_000),
    routeWalk({ x: 2488, z: 1677 }, { x: 2452, z: 1650 }, 7_800),
    routeWalk({ x: 2452, z: 1650 }, ACTOR_SITES.girlMarket, 5_400),
    routeStop("idle", ACTOR_SITES.girlMarket, 3_000, { yaw: 2.35 }),
    routeWalk(ACTOR_SITES.girlMarket, { x: 2451, z: 1668 }, 5_400),
    routeStop("idle", { x: 2451, z: 1668 }, 2_200, { yaw: 1.35 }),
    routeWalk({ x: 2451, z: 1668 }, { x: 2477, z: 1682 }, 5_800),
    routeWalk({ x: 2477, z: 1682 }, ACTOR_SITES.girl, 17_500),
  ]),
});
const COASTAL_TERRACES = Object.freeze([
  Object.freeze({ x: 2395, z: 1659, radiusX: 69, radiusZ: 42 }),
  Object.freeze({ x: 2460, z: 1655, radiusX: 55, radiusZ: 29 }),
  Object.freeze({ x: 2518, z: 1744, radiusX: 36, radiusZ: 26 }),
]);
const COASTAL_CAUSEWAYS = Object.freeze([
  Object.freeze({ from: ACTOR_SITES.boy, to: Object.freeze({ x: 2471, z: 1678 }), radius: 5 }),
  Object.freeze({ from: ACTOR_SITES.girl, to: Object.freeze({ x: 2488, z: 1677 }), radius: 5 }),
  Object.freeze({ from: Object.freeze({ x: 2452, z: 1650 }), to: ACTOR_SITES.girlMarket, radius: 4 }),
]);
const COASTAL_STAGE_BOUNDS = Object.freeze({ minX: 2348, maxX: 2538, minZ: 1622, maxZ: 1768 });
const STRUCTURE_SPECS = Object.freeze([
  Object.freeze({
    id: "coastal-cottage",
    definition: cottageDefinition,
    minX: 2378,
    minZ: 1630,
    surfaceY: 100,
    quarterTurns: 0,
  }),
  Object.freeze({
    id: "covered-market",
    definition: marketDefinition,
    minX: 2418,
    minZ: 1610,
    surfaceY: 100,
    quarterTurns: 2,
  }),
  Object.freeze({
    id: "mine-headframe",
    definition: mineDefinition,
    minX: 2382,
    minZ: 1678,
    surfaceY: 100,
    quarterTurns: 1,
  }),
  Object.freeze({
    id: "tower-windmill",
    definition: windmillDefinition,
    minX: 2345,
    minZ: 1644,
    surfaceY: 100,
    quarterTurns: 2,
  }),
]);
const PRESENTATION_TREES = Object.freeze([
  Object.freeze({ x: 2454, z: 1645, height: 6 }),
  Object.freeze({ x: 2355, z: 1683, height: 7 }),
  Object.freeze({ x: 2521, z: 1661, height: 6 }),
  Object.freeze({ x: 2481, z: 1640, height: 5 }),
]);
const PRESENTATION_PLANTS = Object.freeze([
  Object.freeze({ x: 2511, z: 1694, block: "flowerYellow" }),
  Object.freeze({ x: 2487, z: 1662, block: "flowerWhite" }),
  Object.freeze({ x: 2517, z: 1681, block: "flowerPink" }),
  Object.freeze({ x: 2508, z: 1668, block: "flowerBlue" }),
  Object.freeze({ x: 2435, z: 1658, block: "flowerRed" }),
  Object.freeze({ x: 2471, z: 1664, block: "grassPlant" }),
  Object.freeze({ x: 2450, z: 1649, block: "grassPlant" }),
  Object.freeze({ x: 2369, z: 1674, block: "flowerWhite" }),
]);

const CAMERA_PRESETS = Object.freeze({
  arrival: Object.freeze({
    eye: [2523, 108.5, 1762],
    target: [2452, 99.2, 1681],
    fov: 44,
  }),
  world: Object.freeze({
    eye: [2479, 109, 1740],
    target: [MINING_TARGET.x, 99.5, MINING_TARGET.z],
    fov: 45,
  }),
  market: Object.freeze({
    eye: [2490, 109, 1695],
    target: [2428, 100, 1620],
    fov: 45,
  }),
  guardian: Object.freeze({
    eye: [2488, 122, 1742],
    target: [2368, 112, 1645],
    fov: 43,
  }),
  roadmap: Object.freeze({
    eye: [2520, 142, 1780],
    target: [2438, 99, 1680],
    fov: 50,
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
      positionAvatarAt(runtime, worldConfig, chunks, boy, boyPose);
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
      positionAvatarAt(runtime, worldConfig, chunks, girl, girlPose);
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
    canvas.dataset.sceneTerrainProfile = "open-coastal-plain";
    canvas.dataset.sceneSeed = runtime.MAINNET_WORLD_SEED;
    canvas.dataset.sceneGeneration = String(runtime.DEFAULT_GENERATION_VERSION);
    canvas.dataset.sceneAvatars = "NCM2:villager-boy,NCM2:villager-girl";
    canvas.dataset.sceneBuildings = STRUCTURE_SPECS.map((spec) => `NCM3:${spec.id}`).join(",");
    canvas.dataset.sceneActorBehavior = "waypoint-walk-idle-mine-loop";
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
        cloudHeight: 176,
        cloudRadius: 440,
        cloudCellSize: lowPower ? 58 : 44,
        cloudFarPadding: 100,
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
      chunks.applyPendingDelta(createPresentationDeltas(runtime, worldConfig), "homepage-scene-presentation");
      expectedTerrainChunks = chunks.chunks.size;
      chunks.setBuildConcurrencyLimit(terrainWorkerCount);
      structureChunks = createStructures(runtime);
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
    chunks.push(...placementChunks);
  }
  return chunks;
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

function createPresentationDeltas(runtime, worldConfig) {
  const deltas = new Map();
  const put = (worldX, worldY, worldZ, blockId) => {
    deltas.set(`${worldX},${worldY},${worldZ}`, { worldX, worldY, worldZ, blockId });
  };

  addCoastalStageDeltas(runtime, worldConfig, put);
  addStructureSiteDeltas(runtime, worldConfig, put);
  put(MINING_TARGET.x, PRESENTATION_GROUND_Y, MINING_TARGET.z, runtime.BLOCK_ID.coal);
  PRESENTATION_TREES.forEach((tree) => addTreeDeltas(runtime, worldConfig, tree, put));
  PRESENTATION_PLANTS.forEach((plant) => {
    const surfaceY = runtime.terrainSurfaceHeight(worldConfig, plant.x, plant.z);
    put(plant.x, surfaceY + 1, plant.z, runtime.BLOCK_ID[plant.block]);
  });
  return [...deltas.values()];
}

function addCoastalStageDeltas(runtime, worldConfig, put) {
  const { minX, maxX, minZ, maxZ } = COASTAL_STAGE_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const terraceDistance = Math.min(...COASTAL_TERRACES.map((terrace) => ellipseDistance(x, z, terrace)));
      const causewayDistance = Math.min(...COASTAL_CAUSEWAYS.map((causeway) => capsuleDistance(x, z, causeway)));
      const landDistance = Math.min(terraceDistance, causewayDistance);
      const waterDistance = coastalWaterDistance(x, z);
      if (waterDistance <= 0 && causewayDistance > 0) {
        addWaterColumn(runtime, worldConfig, x, z, put);
        continue;
      }
      if (landDistance > 0) continue;
      if (waterDistance <= 3.25 && causewayDistance > 0) {
        addLandColumn(runtime, worldConfig, x, z, PRESENTATION_WATER_Y + 1, runtime.BLOCK_ID.sand, put, true);
        continue;
      }
      const sourceY = runtime.terrainSurfaceHeight(worldConfig, x, z);
      const targetY = Math.max(PRESENTATION_GROUND_Y, Math.min(PRESENTATION_GROUND_Y + 1, sourceY));
      addLandColumn(runtime, worldConfig, x, z, targetY, runtime.BLOCK_ID.grass, put, false);
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

function coastalWaterDistance(x, z) {
  const lagoon = ellipseDistance(x, z, { x: 2444, z: 1708, radiusX: 44, radiusZ: 29 });
  const westernCove = ellipseDistance(x, z, { x: 2407, z: 1720, radiusX: 29, radiusZ: 19 });
  const channelStartZ = 1717;
  const channelEndZ = COASTAL_STAGE_BOUNDS.maxZ + 2;
  const amount = clamp((z - channelStartZ) / (channelEndZ - channelStartZ), 0, 1);
  const centerX = 2444 + amount * 12 - Math.sin(amount * Math.PI) * 6;
  const halfWidth = 18 + amount * 17;
  const channel = Math.max(Math.abs(x - centerX) - halfWidth, channelStartZ - z, z - channelEndZ);
  return Math.min(lagoon, westernCove, channel);
}

function ellipseDistance(x, z, ellipse) {
  const normalized = Math.hypot((x - ellipse.x) / ellipse.radiusX, (z - ellipse.z) / ellipse.radiusZ);
  return (normalized - 1) * Math.min(ellipse.radiusX, ellipse.radiusZ);
}

function capsuleDistance(x, z, capsule) {
  const dx = capsule.to.x - capsule.from.x;
  const dz = capsule.to.z - capsule.from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = lengthSquared > 0
    ? clamp(((x - capsule.from.x) * dx + (z - capsule.from.z) * dz) / lengthSquared, 0, 1)
    : 0;
  const closestX = capsule.from.x + dx * amount;
  const closestZ = capsule.from.z + dz * amount;
  return Math.hypot(x - closestX, z - closestZ) - capsule.radius;
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
        for (let y = sourceY + 1; y < groundY; y += 1) {
          put(x, y, z, runtime.BLOCK_ID.dirt);
        }
        put(x, groundY, z, runtime.BLOCK_ID.grass);
        for (let y = groundY + 1; y <= Math.max(sourceY + 14, groundY + 1); y += 1) {
          put(x, y, z, runtime.BLOCK_ID.air);
        }
      }
    }
  }
}

function addTreeDeltas(runtime, worldConfig, tree, put) {
  const groundY = Math.max(PRESENTATION_GROUND_Y, runtime.terrainSurfaceHeight(worldConfig, tree.x, tree.z));
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
    ? Math.atan2(segment.lookAt.x - x, segment.lookAt.z - z)
    : Number.isFinite(segment.yaw)
      ? segment.yaw
      : segment.phase === "walk"
        ? Math.atan2(segment.to.x - segment.from.x, segment.to.z - segment.from.z)
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

function positionAvatarAt(runtime, worldConfig, chunks, avatar, pose) {
  const actualX = pose.x + 0.5;
  const actualZ = pose.z + 0.5;
  const worldX = Math.floor(actualX);
  const worldZ = Math.floor(actualZ);
  const worldY = chunks?.getOpaqueColumnTopAtWorld(worldX, worldZ) + 1
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
    target[0] += 26;
    target[2] -= 11;
    eye = [...source.eye];
  } else {
    const distanceScale = mobile ? 1.25 : 1;
    eye = target.map((value, index) => value + (source.eye[index] - source.target[index]) * distanceScale);
  }
  return {
    eye,
    target,
    fov: source.fov + (mobile ? (view === "arrival" ? 16 : 4) : 0),
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
