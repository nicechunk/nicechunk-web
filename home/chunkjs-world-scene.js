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
const MINING_TARGET = Object.freeze({ x: 2403, z: 1688 });
const ACTOR_SITES = Object.freeze({
  boy: Object.freeze({ x: 2486, z: 1728, yaw: -2.35 }),
  boyMine: Object.freeze({ x: 2405, z: 1691, yaw: -2.58 }),
  girl: Object.freeze({ x: 2494, z: 1724, yaw: -2.42 }),
  girlMarket: Object.freeze({ x: 2478, z: 1683, yaw: -2.7 }),
});
const STRUCTURE_SPECS = Object.freeze([
  Object.freeze({
    id: "coastal-cottage",
    definition: cottageDefinition,
    minX: 2402,
    minZ: 1644,
    surfaceY: 100,
    quarterTurns: 0,
  }),
  Object.freeze({
    id: "covered-market",
    definition: marketDefinition,
    minX: 2468,
    minZ: 1657,
    surfaceY: 100,
    quarterTurns: 2,
  }),
  Object.freeze({
    id: "mine-headframe",
    definition: mineDefinition,
    minX: 2390,
    minZ: 1667,
    surfaceY: 100,
    quarterTurns: 1,
  }),
  Object.freeze({
    id: "tower-windmill",
    definition: windmillDefinition,
    minX: 2357,
    minZ: 1647,
    surfaceY: 102,
    quarterTurns: 0,
  }),
]);
const STRUCTURES_BY_VIEW = Object.freeze({
  arrival: Object.freeze(new Set(["coastal-cottage", "tower-windmill"])),
  world: Object.freeze(new Set(["mine-headframe"])),
  market: Object.freeze(new Set(["covered-market"])),
  guardian: Object.freeze(new Set(["tower-windmill"])),
  roadmap: null,
});
const PRESENTATION_TREES = Object.freeze([
  Object.freeze({ x: 2465, z: 1688, height: 6 }),
  Object.freeze({ x: 2365, z: 1688, height: 7 }),
  Object.freeze({ x: 2500, z: 1678, height: 6 }),
]);
const PRESENTATION_PLANTS = Object.freeze([
  Object.freeze({ x: 2480, z: 1700, block: "flowerYellow" }),
  Object.freeze({ x: 2455, z: 1691, block: "flowerWhite" }),
  Object.freeze({ x: 2498, z: 1692, block: "flowerPink" }),
  Object.freeze({ x: 2506, z: 1685, block: "flowerBlue" }),
  Object.freeze({ x: 2438, z: 1686, block: "flowerRed" }),
  Object.freeze({ x: 2470, z: 1689, block: "grassPlant" }),
  Object.freeze({ x: 2446, z: 1682, block: "grassPlant" }),
  Object.freeze({ x: 2376, z: 1694, block: "flowerWhite" }),
]);

const CAMERA_PRESETS = Object.freeze({
  arrival: Object.freeze({
    eye: [2508, 110, 1760],
    target: [2442, 99, 1678],
    fov: 45,
  }),
  world: Object.freeze({
    eye: [2498, 111, 1742],
    target: [MINING_TARGET.x, 99, MINING_TARGET.z],
    fov: 45,
  }),
  market: Object.freeze({
    eye: [2520, 111, 1750],
    target: [2478, 101, 1664],
    fov: 45,
  }),
  guardian: Object.freeze({
    eye: [2502, 128, 1765],
    target: [2373, 114, 1659],
    fov: 43,
  }),
  roadmap: Object.freeze({
    eye: [2510, 148, 1785],
    target: [2430, 99, 1670],
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
    const activeStructureChunks = structureChunksForView(structureChunks, focusView);
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
    const elapsed = timestamp - startedAt;
    const boy = avatars.find((avatar) => avatar.role === "villager-boy");
    const girl = avatars.find((avatar) => avatar.role === "villager-girl");
    const miningActive = focusView === "world";
    const miningDuration = 1_260;
    const miningCycle = Math.floor(elapsed / miningDuration);
    const miningProgress = miningActive ? (elapsed % miningDuration) / miningDuration : 0;

    if (boy) {
      positionAvatar(runtime, worldConfig, boy, miningActive ? ACTOR_SITES.boyMine : ACTOR_SITES.boy);
      boy.animation = {
        moving: focusView === "arrival" && !reducedMotion.matches,
        miningProgress,
        miningAimPitch: -0.08,
        timeMs: timestamp,
        equipment: { rightHand: "pickaxe" },
      };
    }
    if (girl) {
      positionAvatar(runtime, worldConfig, girl, focusView === "market" ? ACTOR_SITES.girlMarket : ACTOR_SITES.girl);
      girl.animation = {
        moving: (focusView === "arrival" || focusView === "market") && !reducedMotion.matches,
        timeMs: timestamp,
      };
    }

    if (miningActive && miningProgress > 0.58 && miningCycle !== lastMiningBurst) {
      lastMiningBurst = miningCycle;
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
    return runtime.terrainSurfaceHeight(worldConfig, MINING_TARGET.x, MINING_TARGET.z);
  }

  function markReady() {
    canvas.dataset.sceneReady = "true";
    canvas.dataset.sceneRenderer = "chunk.js-webgl2";
    canvas.dataset.sceneTerrainProfile = "open-coastal-plain";
    canvas.dataset.sceneSeed = runtime.MAINNET_WORLD_SEED;
    canvas.dataset.sceneGeneration = String(runtime.DEFAULT_GENERATION_VERSION);
    canvas.dataset.sceneAvatars = "NCM2:villager-boy,NCM2:villager-girl";
    canvas.dataset.sceneBuildings = STRUCTURE_SPECS.map((spec) => `NCM3:${spec.id}`).join(",");
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
        cloudHeight: 158,
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

function structureChunksForView(chunks, view) {
  const visible = STRUCTURES_BY_VIEW[view];
  return visible ? chunks.filter((chunk) => visible.has(chunk.sceneStructureId)) : chunks;
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
  const targetY = runtime.terrainSurfaceHeight(worldConfig, MINING_TARGET.x, MINING_TARGET.z);
  const deltas = new Map();
  const put = (worldX, worldY, worldZ, blockId) => {
    deltas.set(`${worldX},${worldY},${worldZ}`, { worldX, worldY, worldZ, blockId });
  };

  put(MINING_TARGET.x, targetY, MINING_TARGET.z, runtime.BLOCK_ID.coal);
  addStructureSiteDeltas(runtime, worldConfig, put);
  PRESENTATION_TREES.forEach((tree) => addTreeDeltas(runtime, worldConfig, tree, put));
  PRESENTATION_PLANTS.forEach((plant) => {
    const surfaceY = runtime.terrainSurfaceHeight(worldConfig, plant.x, plant.z);
    put(plant.x, surfaceY + 1, plant.z, runtime.BLOCK_ID[plant.block]);
  });
  return [...deltas.values()];
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
  const groundY = runtime.terrainSurfaceHeight(worldConfig, tree.x, tree.z);
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

function positionAvatar(runtime, worldConfig, avatar, site) {
  const worldY = runtime.terrainSurfaceHeight(worldConfig, site.x, site.z) + 1;
  avatar.worldX = site.x;
  avatar.worldY = worldY;
  avatar.worldZ = site.z;
  avatar.yaw = site.yaw;
  avatar.shadowWorldY = worldY;
}

function cameraPoseForView(view, aspect) {
  const source = CAMERA_PRESETS[view] || CAMERA_PRESETS.arrival;
  const mobile = aspect < 0.78;
  const distanceScale = mobile ? 1.25 : 1;
  const target = [...source.target];
  const eye = target.map((value, index) => value + (source.eye[index] - source.target[index]) * distanceScale);
  return {
    eye,
    target,
    fov: source.fov + (mobile ? 4 : 0),
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
