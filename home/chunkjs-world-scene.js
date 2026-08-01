import cottageDefinition from "../build_ncm/buildings/coastal/seaside-cottage.json";
import noticeBoardDefinition from "../build_ncm/buildings/civic/covered-village-notice-board.json";
import hollowCottageDefinition from "../build_ncm/buildings/residential/hollow-cottage.json";
import footbridgeDefinition from "../build_ncm/buildings/transport/stone-timber-footbridge.json";
import windmillDefinition from "../build_ncm/buildings/agriculture/stone-timber-tower-windmill.json";
import {
  ACTOR_SITES,
  DESKTOP_TERRAIN_VIEW_DISTANCE,
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
const AVATAR_HEIGHT_BLOCKS = 1.75 / 0.4;
const AVATAR_VISUAL_SCALE = AVATAR_HEIGHT_BLOCKS / 2.52;
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
  return import(/* @vite-ignore */ runtimeAssetUrl(root, CHUNK_RUNTIME_BUNDLE));
}

function runtimeAssetUrl(runtimeRoot, relativePath) {
  return `${String(runtimeRoot || DEFAULT_RUNTIME_ROOT).replace(/\/+$/, "")}/${relativePath}`;
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
