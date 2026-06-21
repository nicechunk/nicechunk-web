import * as THREE from "three";
import "./styles.css";
import "./polyfills.js";
import { applyWorldConfigFromChain, chunkSize, cloudRenderRadius, cloudSectorSize, detailRenderDistance, renderDistance, seaLevel } from "./world/config.js";
import { setWorldSeed, terrainHeight, terrainProfile } from "./world/generator.js";
import { renderTypeForBlock, WORLD_MAP_BLOCK_DEBUG_COLOR, WorldMapBlock } from "./world/blocks.js";
import { blockKey, chunkKey } from "./world/keys.js";
import { createWorldState, isSolidCell as querySolidCell, surfaceHeight as querySurfaceHeight } from "./world/state.js";
import { flowWaterFromBreak as simulateWaterFlow, hasWaterAt } from "./world/fluid.js";
import { blockTint, createChunkGroup, createCloudSectorGroup, generatedBlockTypeAt } from "./world/chunks.js";
import { createAvatar, createAvatarMaterials } from "./render/avatar.js";
import { updateAvatarMotion, startAvatarHandSwing } from "./player/avatarMotion.js";
import { createWorldGeometryByType, createWorldMaterials } from "./world/rendering.js";
import { updateProceduralMaterialTime } from "./render/proceduralMaterials.js";
import { initI18n, t } from "./i18n.js";
import {
  createNiceChunkGuardianClient,
  getNiceChunkGuardianSpawnState,
  markGuardianSpawnForSession,
  shouldUseGuardianSpawnForSession,
} from "./guardianClient.js";
import { createGuardianRegistryResolver, guardianCoversChunk } from "./guardianRegistry.js";
import { equipForgedItemOnAvatar, forgedItemsStorageKey, latestForgedItemStorageKey, loadLatestForgedItem } from "./forgedItems.js";
import {
  backpackSlotIndex,
  createBackpackSlot,
  createForgedItemSlot,
  createHotbarItems,
  createInitialHotbarSlots,
  forgedItemSlotIndex,
  hotbarItemAt as itemAtHotbarSlot,
  hotbarSlotAt as slotAtHotbarIndex,
  hotbarSlotCount,
  isReservedHotbarSlot,
  maxStackSize,
  renderHotbarSlots,
} from "./items/hotbar.js";
import {
  currentGameRedirectPath,
  getGameSession,
  isGameSessionReady,
  isGameSessionStorageKey,
  redirectToGameLogin,
} from "./gameSession.js";
import { clearWalletSession } from "./walletSession.js";
import {
  addResourceToHotbar,
  formatResourceAmount,
  resetHotbarForResourceSimulation,
  resourceDebugEventName,
  simulatedResourceItems,
  simulateResourceDiscovery,
} from "./resourceSimulator.js";
import {
  getNicechunkRpcUrl,
  getStoredHeliusApiKey,
  rpcErrorEventName,
  saveHeliusApiKey,
} from "./rpcConfig.js";
import { getBlockAtlasEntry } from "./data/blockAtlas.js";

const canvas = document.querySelector("#game");
const positionLabel = document.querySelector("#position");
const chunksLabel = document.querySelector("#chunks");
const fpsLabel = document.querySelector("#fps");
const topHud = document.querySelector(".hud");
const debugMiningButton = document.querySelector("#debugMining");
const resourceDebugFeed = document.querySelector("#resourceDebugFeed");
const chainEventLog = document.querySelector("#chainEventLog");
const accountHud = document.querySelector("#accountHud");
const accountName = document.querySelector("#accountName");
const accountLevel = document.querySelector("#accountLevel");
const accountTitle = document.querySelector("#accountTitle");
const accountWallet = document.querySelector("#accountWallet");
const accountSessionBalance = document.querySelector("#accountSessionBalance");
const sessionFundingOverlay = document.querySelector("#sessionFundingOverlay");
const sessionFundingPanel = document.querySelector("#sessionFundingPanel");
const sessionFundingForm = document.querySelector("#sessionFundingForm");
const sessionFundingAmount = document.querySelector("#sessionFundingAmount");
const sessionFundingMinimum = document.querySelector("#sessionFundingMinimum");
const sessionFundingCurrent = document.querySelector("#sessionFundingCurrent");
const sessionFundingCancel = document.querySelector("#sessionFundingCancel");
const sessionWalletApps = document.querySelector("#sessionWalletApps");
const sessionOpenPhantom = document.querySelector("#sessionOpenPhantom");
const sessionOpenSolflare = document.querySelector("#sessionOpenSolflare");
const sessionOpenBackpack = document.querySelector("#sessionOpenBackpack");
const profileOverlay = document.querySelector("#profileOverlay");
const profilePanel = document.querySelector("#profilePanel");
const profileClose = document.querySelector("#profileClose");
const profileLogout = document.querySelector("#profileLogout");
const profileTabs = document.querySelectorAll("[data-profile-tab]");
const profileModelContainer = document.querySelector(".profile-model");
const profileModelCanvas = document.querySelector("#profileModel");
const profileName = document.querySelector("#profileName");
const profileLevel = document.querySelector("#profileLevel");
const profileTitleValue = document.querySelector("#profileTitleValue");
const profileWallet = document.querySelector("#profileWallet");
const profilePosition = document.querySelector("#profilePosition");
const profileChunks = document.querySelector("#profileChunks");
const profileBackpackStatus = document.querySelector("#profileBackpackStatus");
const profileBackpackBuy = document.querySelector("#profileBackpackBuy");
const hotbar = document.querySelector("#hotbar");
const backpackOverlay = document.querySelector("#backpackOverlay");
const backpackPanel = document.querySelector("#backpackPanel");
const backpackGrid = document.querySelector("#backpackGrid");
const backpackDetail = document.querySelector("#backpackDetail");
const backpackClose = document.querySelector("#backpackClose");
const backpackCapacity = document.querySelector("#backpackCapacity");
const backpackWeight = document.querySelector("#backpackWeight");
const backpackWallet = document.querySelector("#backpackWallet");
const marketPhone = document.querySelector("#marketPhone");
const marketOverlay = document.querySelector("#marketOverlay");
const marketPanel = document.querySelector("#marketPanel");
const marketClose = document.querySelector("#marketClose");
const marketTabs = document.querySelectorAll("[data-market-tab]");
const marketTabPanels = document.querySelectorAll("[data-market-tab-panel]");
const marketWallet = document.querySelector("#marketWallet");
const marketBackpack = document.querySelector("#marketBackpack");
const marketSearch = document.querySelector("#marketSearch");
const marketCategoryButtons = document.querySelectorAll("[data-market-category]");
const marketListingGrid = document.querySelector("#marketListingGrid");
const marketInventoryGrid = document.querySelector("#marketInventoryGrid");
const marketListingForm = document.querySelector("#marketListingForm");
const marketListingCategory = document.querySelector("#marketListingCategory");
const marketListingCurrency = document.querySelector("#marketListingCurrency");
const marketListingPrice = document.querySelector("#marketListingPrice");
const marketCreateListing = document.querySelector("#marketCreateListing");
const marketSelectedItem = document.querySelector("#marketSelectedItem");
const marketFormStatus = document.querySelector("#marketFormStatus");
const marketOrdersGrid = document.querySelector("#marketOrdersGrid");
const minimapPanel = document.querySelector(".minimap-panel");
const minimapCanvas = document.querySelector("#minimap");
const minimapContext = minimapCanvas.getContext("2d", { willReadFrequently: true });
const minimapWorldCoord = document.querySelector("#minimapWorldCoord");
const minimapChunkCoord = document.querySelector("#minimapChunkCoord");
const mapOverlay = document.querySelector("#mapOverlay");
const largeMinimapCanvas = document.querySelector("#largeMinimap");
const largeMinimapContext = largeMinimapCanvas.getContext("2d", { willReadFrequently: true });
const mapGuardianStatus = document.querySelector("#mapGuardianStatus");
const mapTeleportForm = document.querySelector("#mapTeleportForm");
const mapTeleportX = document.querySelector("#mapTeleportX");
const mapTeleportZ = document.querySelector("#mapTeleportZ");
const mapTeleportStatus = document.querySelector("#mapTeleportStatus");
const chatInput = document.querySelector("#chatInput");
const gameLoadingOverlay = document.querySelector("#gameLoadingOverlay");
const gameLoadingTitle = document.querySelector("#gameLoadingTitle");
const gameLoadingText = document.querySelector("#gameLoadingText");
const gameLoadingBar = document.querySelector("#gameLoadingBar");
const gameLoadingPercent = document.querySelector("#gameLoadingPercent");
const gameLoadingBytes = document.querySelector("#gameLoadingBytes");
const rpcConfigPanel = document.querySelector("#rpcConfigPanel");
const rpcConfigForm = document.querySelector("#rpcConfigForm");
const rpcConfigApiKey = document.querySelector("#rpcConfigApiKey");
const rpcConfigStatus = document.querySelector("#rpcConfigStatus");
const rpcConfigDismiss = document.querySelector("#rpcConfigDismiss");

let i18nReady = false;
let runtimeUiReady = false;
let firstGameFrameRendered = false;
let gameLoadingComplete = false;
let startupChunkTotal = 0;

const gameLoadingFallbacks = {
  boot: {
    title: "Booting client",
    body: "Preparing player session and voxel engine.",
  },
  session: {
    title: "Checking session",
    body: "Validating wallet access before entering the world.",
  },
  language: {
    title: "Loading language data",
    body: "Fetching interface dictionary and mainnet version metadata.",
  },
  worldConfig: {
    title: "Reading world parameters",
    body: "Loading the on-chain world seed and terrain configuration.",
  },
  chainSync: {
    title: "Syncing on-chain resources",
    body: "Loading visible chunk resource changes before rendering the world.",
  },
  engine: {
    title: "Starting voxel engine",
    body: "Creating renderer, materials, avatar, lighting, and input systems.",
  },
  chunks: {
    title: "Building visible chunks",
    body: "Generating terrain, water, trees, and first visible chunk meshes.",
  },
  ready: {
    title: "World ready",
    body: "First frame rendered. Entering NiceChunk.",
  },
  redirect: {
    title: "Opening wallet gateway",
    body: "No active game session was found. Redirecting to wallet login.",
  },
};

const loadingFetchTracker = installLoadingFetchTracker();
setupRpcConfigPanel();

window.NiceChunkBootLoading?.stop?.();
setGameLoadingStage("boot", 4);

setGameLoadingStage("session", 10);
if (!isGameSessionReady()) {
  setGameLoadingStage("redirect", 12);
  redirectToGameLogin({ redirectPath: currentGameRedirectPath(), autoConnect: true });
  await new Promise(() => {});
}

setGameLoadingStage("language", 18);
initI18n()
  .then(() => {
    i18nReady = true;
    if (runtimeUiReady) refreshRuntimeI18nText();
    updateCurrentGameLoadingText();
  })
  .catch((error) => {
    console.warn("Failed to load NiceChunk language data", error);
  });
window.addEventListener("storage", (event) => {
  if (isGameSessionStorageKey(event.key) && !isGameSessionReady()) {
    redirectToGameLogin({ redirectPath: currentGameRedirectPath(), autoConnect: true });
  }
});
window.addEventListener("nicechunk:languagechange", () => {
  if (!runtimeUiReady) return;
  refreshRuntimeI18nText();
});

function refreshRuntimeI18nText() {
  updateAccountHud();
  renderHotbar();
  renderBackpackPanel();
  updateHud();
  updateProfilePanelDetails();
  renderResourceDebugFeed();
  updateMapGuardianStatus();
  updateCurrentGameLoadingText();
  updateRpcConfigStatusText();
}

function setGameLoadingStage(stage, percent) {
  if (gameLoadingComplete) return;
  const progress = Math.max(0, Math.min(100, Math.round(percent)));
  const fallback = gameLoadingFallbacks[stage] ?? gameLoadingFallbacks.boot;
  const titleKey = `main.loading.stages.${stage}.title`;
  const bodyKey = `main.loading.stages.${stage}.body`;
  const title = i18nReady ? t(titleKey) : fallback.title;
  const body = i18nReady ? t(bodyKey) : fallback.body;

  if (gameLoadingTitle) gameLoadingTitle.textContent = title === titleKey ? fallback.title : title;
  if (gameLoadingText) gameLoadingText.textContent = body === bodyKey ? fallback.body : body;
  if (gameLoadingBar) gameLoadingBar.style.width = `${progress}%`;
  if (gameLoadingPercent) gameLoadingPercent.textContent = `${progress}%`;
  updateGameLoadingBytes();
  if (gameLoadingOverlay) gameLoadingOverlay.dataset.stage = stage;
}

function updateCurrentGameLoadingText() {
  if (!gameLoadingOverlay || gameLoadingComplete) return;
  setGameLoadingStage(gameLoadingOverlay.dataset.stage || "boot", Number.parseInt(gameLoadingPercent?.textContent, 10) || 0);
}

function gameText(key, fallback, params = {}) {
  if (!i18nReady) return interpolateLoadingText(fallback, params);
  const value = t(key, params);
  return value === key ? interpolateLoadingText(fallback, params) : value;
}

function interpolateLoadingText(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, name) => params[name] ?? "");
}

async function initializeWorldConfig() {
  setGameLoadingStage("worldConfig", 28);
  try {
    const { loadGlobalConfig } = await import("./chain/nicechunkChain.js");
    const config = await loadGlobalConfig();
    applyWorldConfigFromChain(config);
    setWorldSeed(config.worldSeedHex ?? bufferToHex(config.worldSeed));
    window.NiceChunkWorldConfig = config;
  } catch (error) {
    console.warn("Failed to load NiceChunk world config", error);
  }
}

function bufferToHex(value) {
  if (!value) return "";
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function updateGameLoadingBytes() {
  if (!gameLoadingBytes) return;
  const bytes = getLoadingResourceBytes();
  gameLoadingBytes.textContent = formatLoadingBytes(bytes.loaded, bytes.total);
}

function finishGameLoading() {
  if (gameLoadingComplete) return;
  setGameLoadingStage("ready", 100);
  updateGameLoadingBytes();
  gameLoadingComplete = true;
  window.setTimeout(() => gameLoadingOverlay?.classList.add("loaded"), 220);
}

function installLoadingFetchTracker() {
  if (!window.fetch || window.__nicechunkLoadingFetchTracker) return window.__nicechunkLoadingFetchTracker ?? { active: new Map() };
  const tracker = { active: new Map(), sequence: 0 };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = requestUrl(args[0]);
    if (!shouldTrackLoadingResponse(response, url)) return response;

    const total = Number(response.headers.get("content-length")) || 0;
    if (!response.body) return response;

    const id = ++tracker.sequence;
    const reader = response.body.getReader();
    tracker.active.set(id, { loaded: 0, total });
    updateGameLoadingBytes();

    const stream = new ReadableStream({
      async pull(controller) {
        const result = await reader.read();
        if (result.done) {
          tracker.active.delete(id);
          updateGameLoadingBytes();
          controller.close();
          return;
        }
        const entry = tracker.active.get(id);
        if (entry) {
          entry.loaded += result.value.byteLength;
          updateGameLoadingBytes();
        }
        controller.enqueue(result.value);
      },
      cancel(reason) {
        tracker.active.delete(id);
        updateGameLoadingBytes();
        return reader.cancel(reason);
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  window.__nicechunkLoadingFetchTracker = tracker;
  return tracker;
}

function requestUrl(request) {
  if (typeof request === "string") return request;
  if (request instanceof URL) return request.href;
  return request?.url ?? "";
}

function shouldTrackLoadingResponse(response, url) {
  if (!response.ok || !url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.origin === window.location.origin;
  } catch (_error) {
    return true;
  }
}

function getLoadingResourceBytes() {
  const entries = [
    ...performance.getEntriesByType("navigation"),
    ...performance.getEntriesByType("resource"),
  ];
  const seen = new Set();
  let loaded = 0;
  let total = 0;

  for (const entry of entries) {
    if (!entry.name || seen.has(entry.name)) continue;
    seen.add(entry.name);
    const encoded = Math.max(0, entry.encodedBodySize || 0);
    const transfer = Math.max(0, entry.transferSize || 0);
    const decoded = Math.max(0, entry.decodedBodySize || 0);
    const size = transfer || encoded || decoded;
    if (!size) continue;
    loaded += size;
    total += encoded || size;
  }

  for (const entry of loadingFetchTracker.active.values()) {
    loaded += entry.loaded;
    total += entry.total || entry.loaded;
  }

  return { loaded, total };
}

function formatLoadingBytes(loaded, total) {
  const formattedLoaded = formatByteSize(loaded);
  if (total > 0 && total >= loaded) {
    const formattedTotal = formatByteSize(total);
    return gameText("main.loading.bytesKnown", "Transferred {loaded} / {total}", {
      loaded: formattedLoaded,
      total: formattedTotal,
    });
  }
  return gameText("main.loading.bytesUnknown", "Transferred {loaded}", { loaded: formattedLoaded });
}

function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function isNicechunkChainFeatureEnabled() {
  return localStorage.getItem(chainSyncStorageKey) !== "0";
}

function loadNicechunkChainModule() {
  if (!nicechunkChainModulePromise) {
    nicechunkChainModulePromise = import("./chain/nicechunkChain.js");
  }
  return nicechunkChainModulePromise;
}

const rpcConfigState = {
  statusKey: "",
  statusFallback: "",
  statusParams: {},
};

function setupRpcConfigPanel() {
  if (rpcConfigApiKey) rpcConfigApiKey.value = getStoredHeliusApiKey();

  window.addEventListener(rpcErrorEventName, () => {
    showRpcConfigPanel(
      "main.rpcConfig.publicRpcFailed",
      "Public devnet RPC is rate limited. Add a Helius API key to keep chain reads and mining transactions reliable.",
    );
  });

  rpcConfigForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const apiKey = rpcConfigApiKey?.value ?? "";
    if (!apiKey.trim()) {
      showRpcConfigPanel("main.rpcConfig.invalid", "Enter a Helius API key before saving.");
      rpcConfigApiKey?.focus();
      return;
    }
    saveHeliusApiKey(apiKey);
    showRpcConfigPanel("main.rpcConfig.saved", "Saved. NiceChunk will use your Helius devnet RPC for chain calls.");
    updateRpcConfigStatusText({ rpcUrl: getNicechunkRpcUrl() });
    if (rpcConfigPanel) rpcConfigPanel.hidden = true;
  });

  rpcConfigDismiss?.addEventListener("click", () => {
    if (rpcConfigPanel) rpcConfigPanel.hidden = true;
  });
}

function showRpcConfigPanel(statusKey, statusFallback, statusParams = {}) {
  rpcConfigState.statusKey = statusKey;
  rpcConfigState.statusFallback = statusFallback;
  rpcConfigState.statusParams = statusParams;
  updateRpcConfigStatusText();
  if (rpcConfigPanel) rpcConfigPanel.hidden = false;
}

function updateRpcConfigStatusText(extraParams = {}) {
  if (!rpcConfigStatus || !rpcConfigState.statusKey) return;
  const params = { ...rpcConfigState.statusParams, ...extraParams };
  rpcConfigStatus.textContent = gameText(rpcConfigState.statusKey, rpcConfigState.statusFallback, params);
}

await initializeWorldConfig();
setGameLoadingStage("engine", 42);

const scene = new THREE.Scene();
const normalSkyColor = new THREE.Color(0x8fc8e8);
const guardianFogSkyColor = new THREE.Color(0x34383b);
const normalSceneFog = new THREE.Fog(0x8fc8e8, 52, 160);
const guardianSceneFog = new THREE.FogExp2(0x3b3f42, 0.034);
const guardianAreaFog = new THREE.Fog(0x7a7f82, 28, 102);
scene.background = normalSkyColor;
scene.fog = normalSceneFog;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1300);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xeef8ff, 0x6d7b45, 2.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4c2, 2.1);
sun.position.set(-26, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
scene.add(sun);

const generatedChunks = new Map();
const preloadedChunks = new Map();
let pendingChunkKeys = [];
let pendingPreloadChunkKeys = [];
let pendingChunkRefreshKeys = [];
const knownChunks = new Map();
const chunkChainSync = new Map();
const chunkChainSyncBatchSize = 50;
const chunkChainSyncRetryMs = 8000;
const chainSyncStorageKey = "nicechunk.chainSync";
const chainEventLogMaxRows = 6;
const chainEventFailureRemovalMs = 30_000;
let nicechunkChainModulePromise = null;
let chunkChainViewportCenterKey = "";
let chunkChainViewportLoading = false;
let realtimeChunkSubscription = null;
let realtimeChunkKey = null;
let realtimeChunkAppliedSequence = 0;
let gameplaySessionStatus = null;
let gameplaySessionStatusLoading = false;
let gameplaySessionStatusLastLoadedAt = 0;
let equippedBackpackStatus = null;
let equippedBackpackLoading = false;
let equippedBackpackLastLoadedAt = 0;
let sessionFundingDialogResolve = null;
const generatedCloudSectors = new Map();
const cloudUpdateState = { sectorX: null, sectorZ: null };
const worldState = createWorldState();
const { solidBlocks, removedBlocks, placedBlocks, blockDamage } = worldState;
const breakParticles = [];
const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);
const clouds = new THREE.Group();
clouds.name = "clouds";
scene.add(clouds);
const clickRaycaster = new THREE.Raycaster();
const previewRaycaster = new THREE.Raycaster();

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const placementPreviewGeometry = new THREE.EdgesGeometry(cubeGeometry);
const cloudGeometry = new THREE.SphereGeometry(1, 18, 12);
const guardianFogVolumeRadius = renderDistance + 1;
const guardianFogVolumeHeight = 58;
const guardianFogVolumeMaxInstances = (guardianFogVolumeRadius * 2 + 1) ** 2;
const guardianFogVolumeGeometry = new THREE.PlaneGeometry(chunkSize * 1.9, guardianFogVolumeHeight);
const guardianFogVolumeMaterial = new THREE.MeshBasicMaterial({
  color: 0x9a9d9f,
  transparent: true,
  opacity: 0.26,
  side: THREE.DoubleSide,
  depthWrite: false,
  fog: false,
});
const guardianFogVolumeMesh = new THREE.InstancedMesh(
  guardianFogVolumeGeometry,
  guardianFogVolumeMaterial,
  guardianFogVolumeMaxInstances,
);
guardianFogVolumeMesh.name = "guardian-fog-volumes";
guardianFogVolumeMesh.count = 0;
guardianFogVolumeMesh.frustumCulled = false;
scene.add(guardianFogVolumeMesh);
const guardianFogVolumeTransform = new THREE.Object3D();
const waterGeometry = new THREE.PlaneGeometry(1, 1);
waterGeometry.rotateX(-Math.PI / 2);
const geometryByType = createWorldGeometryByType({ THREE, cubeGeometry, waterGeometry, cloudGeometry });
const materials = {
  ...createWorldMaterials({ THREE, includeCloud: true }),
  ...createAvatarMaterials(THREE, createAvatarMaterial),
  crack: new THREE.MeshBasicMaterial({ color: 0x1d1712, transparent: true, opacity: 0.55 }),
};
const hotbarItems = createHotbarItems(simulatedResourceItems);
const hotbarSlots = createInitialHotbarSlots();
const backpackSlotTotal = 50;
const backpackDemoSlots = createInitialBackpackSlots();
const backpackSlotCache = {
  signature: "",
  slots: [],
};
let latestForgedItem = null;
let equippedForgedMesh = null;
const resourceDebugEvents = [];
const hotbarActions = {
  swing: () => startHandSwing(),
  openBackpack: () => openBackpackPanel(),
  mine: ({ event, hit }) => {
    if (!hit) {
      startHandSwing();
      return;
    }
    if (handlePickaxeClick(hit, event.pointerType)) consumeSelectedToolDurability();
  },
  placeBlock: ({ item, hit }) => {
    if (!hit) {
      startHandSwing();
      return;
    }
    if (placeHeldBlock(hit, item.type)) consumeSelectedStack();
  },
  placePlant: ({ item, hit }) => {
    if (!hit) {
      startHandSwing();
      return;
    }
    if (placeHeldPlant(hit, item.type)) consumeSelectedStack();
  },
};
const marketListingStorageKey = "nicechunk.marketListings.mvp.v1";
const marketCategories = ["all", "raw", "equipment", "building", "vegetation", "clothing"];
const marketSampleListings = [
  {
    id: "sample-iron",
    seller: "NPC",
    nameKey: "main.market.sampleIron",
    metaKey: "main.market.sampleIronMeta",
    category: "raw",
    currency: "NCK",
    price: "18.50",
    iconType: "resource",
    source: "sample",
  },
  {
    id: "sample-pickaxe",
    seller: "NPC",
    nameKey: "main.market.samplePickaxe",
    metaKey: "main.market.samplePickaxeMeta",
    category: "equipment",
    currency: "NCK",
    price: "42.00",
    iconType: "equipment",
    source: "sample",
  },
  {
    id: "sample-brick",
    seller: "NPC",
    nameKey: "main.market.sampleBrick",
    metaKey: "main.market.sampleBrickMeta",
    category: "building",
    currency: "NCK",
    price: "6.25",
    iconType: "building",
    source: "sample",
  },
  {
    id: "sample-cloak",
    seller: "NPC",
    nameKey: "main.market.sampleCloak",
    metaKey: "main.market.sampleCloakMeta",
    category: "vegetation",
    currency: "NCK",
    price: "3.20",
    iconType: "resource",
    source: "sample",
  },
];
let marketSelectedCategory = "all";
let marketSelectedListingItem = null;
let marketListingSubmitting = false;
let marketBuyingListingId = null;
let marketChainListings = [];
let marketChainListingsLoading = false;
let marketChainListingsLoadedAt = 0;
let marketChainListingsError = null;

const playerPositionStorageKey = "nicechunk.playerPosition.v1";
const currentSession = getGameSession();
const savedPlayerState = loadSavedPlayerState();
const guardianSpawnState = shouldUseGuardianSpawnForSession(currentSession)
  ? getNiceChunkGuardianSpawnState({ chunkSize, surfaceHeight })
  : null;
if (guardianSpawnState) markGuardianSpawnForSession(currentSession);
const initialPlayerState = guardianSpawnState ?? savedPlayerState;
const player = {
  position: vectorFromPlayerState(initialPlayerState) ?? new THREE.Vector3(0, terrainHeight(0, 0) + 1.01, 0),
  velocity: new THREE.Vector3(),
  yaw: initialPlayerState?.yaw ?? Math.PI * 0.25,
  cameraPitch: initialPlayerState?.cameraPitch ?? -0.42,
  speed: 10.5,
  sprintSpeed: 16.5,
  grounded: false,
  moving: false,
  autoMoveTarget: null,
  autoMovePath: [],
  autoJumpReadyAt: 0,
  autoJumpCommitUntil: 0,
  selectedBlock: null,
  miningTargetHit: null,
  miningSwing: 0,
  miningHitDone: false,
  miningContact: null,
  miningPreviousToolBoxes: null,
};

const avatarGroundOffset = 0.5;
const playerRadius = 0.36;
const playerBodyTopOffset = 1;
const gravity = 24;
const jumpImpulse = 9.2;
const stepBlockEpsilon = 0.08;
const autoStepHeight = 1.08;
const autoJumpHeight = 1.65;
const autoJumpRetryMs = 420;
const autoJumpCommitMs = 760;
const autoDirectPathSampleSpacing = 0.35;
const autoPathSearchRadius = 72;
const autoPathMaxNodes = 1800;
const miningSwingDuration = 260;
const miningStandDistance = 1.28;
const miningReachDown = 1;
const miningReachUp = 4;
const miningHorizontalRadius = 1;
const miningCollisionStartProgress = 0.22;
const miningBlockCollisionPadding = 0.06;
const placementReach = 3;
const initialChunkRadius = 1;
const chunkBuildBudget = 4;
const chunkBuildBudgetMs = 10;
const preloadDistance = renderDistance + 3;
const preloadChunkBuildBudget = 1;
const chunkRefreshBudget = 1;
const startupChunkLoadRadius = initialChunkRadius;
const cameraPitchMin = -0.92;
const cameraPitchMax = 0.42;
const headPitchMin = -0.48;
const headPitchMax = 0.52;
const minimapScale = 1;
const largeMinimapMinScale = 0.35;
const largeMinimapMaxScale = 6;
const minimapUpdateMs = 120;
const minimapStorageKey = "nicechunk.knownMap.v1";
const maxStoredKnownChunks = 1200;
const playerPositionSaveMs = 1000;
const minimapState = { lastDrawAt: 0, expanded: false, largeScale: 1 };
const minimapSaveState = { dirty: false, lastSaveAt: 0 };
const playerPositionSaveState = { lastSaveAt: 0, lastPayload: "" };
const knownChunkRestoreState = { pending: [], loading: false };
const largeMapDrag = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  viewX: 0,
  viewZ: 0,
};

const keys = new Set();
const avatar = createAvatar({ THREE, cubeGeometry, materials });
scene.add(avatar);
const guardianClient = createNiceChunkGuardianClient({
  chunkSize,
  walletAddress: currentSession.walletAddress,
  onPlayerJoin: handleGuardianPlayerJoin,
  onPlayerMove: handleGuardianPlayerMove,
  onPlayerLeave: handleGuardianPlayerLeave,
  onDig: handleGuardianDig,
  onChat: handleGuardianChat,
  onClose: clearGuardianRemotePlayers,
  onError: (error) => console.warn("NiceChunk Guardian socket error", error),
  onProtocolError: (error) => console.warn("NiceChunk Guardian protocol error", error),
});
const guardianRegistryResolver = createGuardianRegistryResolver({ fallbackUrl: guardianClient.getUrl() });
const guardianConnectionState = {
  endpoint: "",
  guardian: null,
  resolving: false,
  lastResolveAt: 0,
};
const guardianMapCoverageState = {
  guardians: [],
  loaded: false,
  loading: false,
  lastLoadAt: 0,
  version: 0,
};
const guardianSceneFogState = {
  chunkKey: "",
  active: null,
};
const guardianFogVolumeState = {
  chunkKey: "",
  coverageVersion: -1,
};
const guardianMapCoverageRefreshMs = 30000;
void refreshGuardianMapCoverage();
const guardianRemotePlayers = new Map();
const guardianRemoteInterpolationMs = 120;
const guardianRemoteMaxExtrapolationMs = 120;
const guardianRemoteSnapDistance = 48;
const guardianRemoteSettleDistance = 0.015;
const guardianRemoteTempA = new THREE.Vector3();
const guardianRemoteTempB = new THREE.Vector3();
const chatBubbleWorldPosition = new THREE.Vector3();
const chatBubbleDurationMs = 30000;
const chatBubbleCanvasMaxWidth = 512;
const chatBubbleCanvasMinWidth = 176;
const chatBubbleCanvasHeight = 160;
const chatBubbleAvatarOffsetY = 3.95;
let localChatBubble = null;
const profilePreview = createProfilePreview();
const cameraFocus = new THREE.Vector3();
let cameraFocusReady = false;
const crackMarker = createCrackMarker();
scene.add(crackMarker);
const placementPreview = createPlacementPreview();
scene.add(placementPreview);
const miningDebug = createMiningDebug();
scene.add(miningDebug);
const fpsState = { frames: 0, lastTime: performance.now(), value: 0 };
let debugMiningEnabled = false;
window.NiceChunkDebugMining = debugMiningEnabled;
let selectedHotbarSlot = 0;
let hotbarDrag = null;
let backpackDrag = null;
let dragGhost = null;

window.addEventListener("keydown", (event) => {
  if (event.target === chatInput) return;
  if (event.key === "Enter" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !isTextEntryTarget(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    openChatInput();
    return;
  }
  if (isTextEntryTarget(event.target)) return;
  if (/^Digit[1-9]$/.test(event.code)) {
    selectHotbarSlot(Number(event.code.slice(5)) - 1);
    return;
  }
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  if (isTextEntryTarget(event.target)) return;
  keys.delete(event.code);
});
window.addEventListener("resize", resize);
window.addEventListener("focus", () => {
  const changed = syncLatestForgedItemSlot();
  const reset = resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  if (changed || reset) renderHotbar();
  void refreshGameplaySessionHud({ force: true });
  void refreshEquippedBackpack({ force: true });
});
window.addEventListener("storage", (event) => {
  if (event.key !== latestForgedItemStorageKey && event.key !== forgedItemsStorageKey) return;
  const changed = syncLatestForgedItemSlot();
  const reset = resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  if (changed || reset) renderHotbar();
});
window.addEventListener("beforeunload", () => {
  savePlayerPosition(true);
  saveKnownChunksToStorage(true);
  guardianClient.disconnect();
});
window.setInterval(() => {
  void refreshGameplaySessionHud();
  void refreshEquippedBackpack();
}, 15000);
debugMiningButton?.addEventListener("click", () => {
  setDebugMiningEnabled(!debugMiningEnabled);
});
debugMiningButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
debugMiningButton?.addEventListener("pointerup", (event) => event.stopPropagation());
accountHud?.addEventListener("click", openProfilePanel);
accountHud?.addEventListener("pointerdown", (event) => event.stopPropagation());
accountHud?.addEventListener("pointerup", (event) => event.stopPropagation());
profileOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeProfilePanel();
});
profileClose?.addEventListener("click", closeProfilePanel);
profileLogout?.addEventListener("click", logoutProfile);
profileBackpackBuy?.addEventListener("click", handleBuyBackpack);
profileTabs.forEach((tab) => {
  tab.addEventListener("click", () => setProfileTab(tab.dataset.profileTab || "attributes"));
});
profilePanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
profileModelContainer?.addEventListener("pointerdown", beginProfilePreviewDrag);
profileModelContainer?.addEventListener("pointermove", dragProfilePreview);
profileModelContainer?.addEventListener("pointerup", endProfilePreviewDrag);
profileModelContainer?.addEventListener("pointercancel", endProfilePreviewDrag);
profileModelContainer?.addEventListener("wheel", zoomProfilePreview, { passive: false });
sessionFundingOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
});
sessionFundingPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
sessionFundingCancel?.addEventListener("click", () => closeSessionFundingDialog(false));
sessionFundingForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(sessionFundingAmount?.value);
  closeSessionFundingDialog({ amount });
});
window.addEventListener(resourceDebugEventName, (event) => {
  resourceDebugEvents.unshift(event.detail);
  resourceDebugEvents.splice(8);
  renderResourceDebugFeed();
});
minimapPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
minimapPanel.addEventListener("pointerup", (event) => {
  event.preventDefault();
  event.stopPropagation();
  openLargeMap();
});
mapOverlay.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (event.target === mapOverlay) closeLargeMap();
});
largeMinimapCanvas.addEventListener("pointerdown", handleLargeMapPointerDown);
largeMinimapCanvas.addEventListener("pointermove", handleLargeMapPointerMove);
largeMinimapCanvas.addEventListener("pointerup", handleLargeMapPointerUp);
largeMinimapCanvas.addEventListener("pointercancel", handleLargeMapPointerUp);
largeMinimapCanvas.addEventListener("wheel", handleLargeMapWheel, { passive: false });
mapTeleportForm?.addEventListener("submit", handleMapTeleportSubmit);
mapTeleportForm?.addEventListener("pointerdown", (event) => event.stopPropagation());
mapTeleportForm?.addEventListener("pointerup", (event) => event.stopPropagation());
chatInput?.addEventListener("keydown", handleChatInputKeyDown);
chatInput?.addEventListener("pointerdown", (event) => event.stopPropagation());
chatInput?.addEventListener("pointerup", (event) => event.stopPropagation());
hotbar.addEventListener("pointerdown", handleHotbarPointerDown);
hotbar.addEventListener("pointermove", handleHotbarPointerMove);
hotbar.addEventListener("pointerup", handleHotbarPointerUp);
hotbar.addEventListener("pointercancel", handleHotbarPointerCancel);
hotbar.addEventListener("dragstart", (event) => event.preventDefault());
hotbar.addEventListener("pointerup", (event) => {
  event.stopPropagation();
});
backpackOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeBackpackPanel();
});
backpackClose?.addEventListener("click", closeBackpackPanel);
backpackPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
backpackGrid?.addEventListener("pointerdown", handleBackpackPointerDown);
backpackPanel?.addEventListener("pointermove", handleBackpackPointerMove);
backpackPanel?.addEventListener("pointerup", handleBackpackPointerUp);
backpackPanel?.addEventListener("pointercancel", handleBackpackPointerCancel);
backpackPanel?.addEventListener("dragstart", (event) => event.preventDefault());
marketPhone?.addEventListener("click", openMarketPanel);
marketPhone?.addEventListener("pointerdown", (event) => event.stopPropagation());
marketPhone?.addEventListener("pointerup", (event) => event.stopPropagation());
marketOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeMarketPanel();
});
marketClose?.addEventListener("click", closeMarketPanel);
marketPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
marketTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectMarketTab(tab.dataset.marketTab || "browse"));
});
marketCategoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.marketCategory || "all";
    marketSelectedCategory = marketCategories.includes(category) ? category : "all";
    updateMarketPanel();
  });
});
marketSearch?.addEventListener("input", updateMarketPanel);
marketListingPrice?.addEventListener("input", updateMarketListingDraft);
marketListingCategory?.addEventListener("change", updateMarketListingDraft);
marketListingCurrency?.addEventListener("change", updateMarketListingDraft);
marketListingForm?.addEventListener("submit", handleCreateMarketListing);
window.addEventListener("keydown", (event) => {
  if (event.target === chatInput) return;
  if (event.key !== "Escape") return;
  closeBackpackPanel();
  closeProfilePanel();
  closeMarketPanel();
});

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerDownX = 0;
let pointerDownY = 0;
let pointerDownAt = 0;
let activePointerId = null;

window.addEventListener("pointerdown", (event) => {
  if (isInteractivePointerTarget(event.target)) return;
  event.preventDefault();
  dragging = true;
  activePointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  pointerDownX = event.clientX;
  pointerDownY = event.clientY;
  pointerDownAt = performance.now();
  event.target?.setPointerCapture?.(event.pointerId);
}, { passive: false });

window.addEventListener("pointerup", (event) => {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  dragging = false;
  activePointerId = null;
  const moved = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
  const elapsed = performance.now() - pointerDownAt;
  if (isPrimaryPointer(event) && moved < 14 && elapsed < 620) {
    handleWorldClick(event);
  }
});

window.addEventListener("pointercancel", (event) => {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  dragging = false;
  activePointerId = null;
});

window.addEventListener("pointermove", (event) => {
  if (!dragging && !isInteractivePointerTarget(event.target)) {
    updatePlacementPreviewFromPointer(event);
  }
  if (!dragging) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  event.preventDefault();
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  player.yaw -= dx * 0.006;
  player.cameraPitch = THREE.MathUtils.clamp(player.cameraPitch - dy * 0.003, cameraPitchMin, cameraPitchMax);
}, { passive: false });

runtimeUiReady = true;
if (i18nReady) refreshRuntimeI18nText();
syncEquippedBackpackSlot();
renderHotbar();
void refreshEquippedBackpack({ force: true });

requestAnimationFrame(startInitialWorld);

async function startInitialWorld() {
  prepareStartupChunkLoading(player.position);
  await syncInitialChainViewport(player.position);
  setGameLoadingStage("chunks", 58);
  generateAround(player.position);
  generateCloudsAround(player.position);
  placePlayerOnGround(!initialPlayerState);
  startGuardianConnection();
  syncLatestForgedItemSlot();
  resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  renderHotbar();
  selectHotbarSlot(selectedHotbarSlot);
  void refreshGameplaySessionHud({ force: true });
  animate();
  scheduleKnownChunkRestore();
}

async function syncInitialChainViewport(center) {
  if (!isNicechunkChainFeatureEnabled()) return;
  const centerChunkX = Math.floor(center.x / chunkSize);
  const centerChunkZ = Math.floor(center.z / chunkSize);
  const chunks = collectSortedViewportChunks(centerChunkX, centerChunkZ, renderDistance);
  if (!chunks.length) return;

  setGameLoadingStage("chainSync", 44);
  try {
    const { loadChunkBlockDeltasBatch } = await loadNicechunkChainModule();
    const totalBatches = Math.ceil(chunks.length / chunkChainSyncBatchSize);
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const batch = chunks.slice(
        batchIndex * chunkChainSyncBatchSize,
        (batchIndex + 1) * chunkChainSyncBatchSize,
      );
      const deltasByChunk = await loadChunkBlockDeltasBatch(batch, { batchSize: chunkChainSyncBatchSize });
      const loadedAt = performance.now();
      for (const chunk of batch) {
        const key = chunkKey(chunk.chunkX, chunk.chunkZ);
        const deltas = deltasByChunk.get(key) ?? [];
        const maxSequence = deltas.reduce((max, delta) => Math.max(max, delta.sequence), 0);
        const previous = chunkChainSync.get(key);
        await applyChunkChainDeltas(deltas, previous?.appliedSequence ?? 0);
        chunkChainSync.set(key, {
          key,
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
          loading: false,
          loadedAt,
          failedAt: 0,
          appliedSequence: Math.max(previous?.appliedSequence ?? 0, maxSequence),
        });
      }
      const progress = (batchIndex + 1) / totalBatches;
      setGameLoadingStage("chainSync", 44 + progress * 12);
    }
    chunkChainViewportCenterKey = chunkKey(centerChunkX, centerChunkZ);
  } catch (error) {
    console.warn("Failed to load initial NiceChunk chunk PDA viewport", error);
  }
}

function createAvatarMaterial(color, _roughness = 0.1, name = "avatar") {
  const material = new THREE.MeshLambertMaterial({
    color,
  });
  material.fog = true;
  material.name = `avatar:${name}`;
  return material;
}

function addBox(parent, name, material, position, scale) {
  const mesh = new THREE.Mesh(cubeGeometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createProfilePreview() {
  if (!profileModelCanvas) return null;
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);

  const previewRenderer = new THREE.WebGLRenderer({
    canvas: profileModelCanvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  previewRenderer.setClearColor(0x000000, 0);
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const previewRoot = new THREE.Group();
  previewRoot.position.set(0, -1.15, 0);
  const previewAvatar = createAvatar({ THREE, cubeGeometry, materials });
  const previewTool = previewAvatar.userData.limbs?.rightTool;
  if (previewTool) previewTool.visible = false;
  previewRoot.add(previewAvatar);
  previewScene.add(previewRoot);

  const keyLight = new THREE.DirectionalLight(0xfff2cf, 2.4);
  keyLight.position.set(3, 5, 5);
  previewScene.add(keyLight);
  previewScene.add(new THREE.HemisphereLight(0xeef8ff, 0x344234, 2.8));

  return {
    scene: previewScene,
    camera: previewCamera,
    renderer: previewRenderer,
    root: previewRoot,
    avatar: previewAvatar,
    rotationX: 0,
    rotationY: Math.PI,
    distance: 7.4,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    active: false,
    width: 0,
    height: 0,
  };
}

function isInteractivePointerTarget(target) {
  return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, .market-panel, .market-overlay, .market-phone, .backpack-panel, .backpack-overlay, .profile-panel, .profile-overlay, .rpc-config-panel, .session-funding-panel, .session-funding-overlay"));
}

function isTextEntryTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function isPrimaryPointer(event) {
  return event.pointerType === "touch" || event.button === 0;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncLatestForgedItemSlot() {
  const item = loadLatestForgedItem();
  const previousCode = latestForgedItem?.code ?? null;
  const nextCode = item?.code ?? null;
  if (previousCode === nextCode) return false;
  latestForgedItem = item;
  hotbarSlots[forgedItemSlotIndex] = item ? createForgedItemSlot(item) : null;
  if (selectedHotbarSlot === forgedItemSlotIndex) updateEquippedItem();
  return true;
}

function syncEquippedBackpackSlot() {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const currentSlotIndex = findBackpackHotbarSlotIndex();
  if (!backpack) {
    if (currentSlotIndex !== null) hotbarSlots[currentSlotIndex] = null;
    if (selectedHotbarSlot === currentSlotIndex) selectFirstSelectableHotbarSlot();
    return;
  }
  hotbarSlots[currentSlotIndex ?? backpackSlotIndex] = createBackpackSlot({
    address: backpack.publicKey,
    backpackId: backpack.backpackId,
    capacity: backpack.capacity,
    itemCount: backpack.itemCount,
  });
  if (isBackpackHotbarSlot(selectedHotbarSlot)) selectFirstSelectableHotbarSlot();
}

function renderHotbar() {
  renderHotbarSlots({ hotbar, hotbarSlots, hotbarItems, selectedHotbarSlot, t, formatResourceAmount });
}

function selectHotbarSlot(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= hotbarSlotCount) return;
  if (hotbarItemAt(slotIndex).action === "openBackpack") {
    openBackpackPanel();
    updateHotbarSelection();
    updateEquippedItem();
    placementPreview.visible = false;
    return;
  }
  selectedHotbarSlot = slotIndex;
  updateHotbarSelection();
  updateEquippedItem();
  placementPreview.visible = false;
  closeBackpackPanel();
}

function updateHotbarSelection() {
  hotbar.querySelectorAll(".hotbar-slot").forEach((slot, index) => {
    slot.classList.toggle("selected", index === selectedHotbarSlot);
  });
}

function hotbarSlotAt(slotIndex) {
  return slotAtHotbarIndex(hotbarSlots, slotIndex);
}

function hotbarItemAt(slotIndex) {
  return itemAtHotbarSlot(hotbarSlots, hotbarItems, slotIndex);
}

function isBackpackHotbarSlot(slotIndex) {
  return hotbarItemAt(slotIndex).action === "openBackpack";
}

function findBackpackHotbarSlotIndex() {
  const index = hotbarSlots.findIndex((slot) => {
    const item = hotbarItems[slot?.itemId];
    return item?.action === "openBackpack";
  });
  return index >= 0 ? index : null;
}

function hasEquippedBackpack() {
  return Boolean(equippedBackpackStatus?.backpack) || findBackpackHotbarSlotIndex() !== null;
}

function selectFirstSelectableHotbarSlot() {
  const next = hotbarSlots.findIndex((slot, index) => slot && !isBackpackHotbarSlot(index));
  selectedHotbarSlot = next >= 0 ? next : 0;
  updateHotbarSelection();
  updateEquippedItem();
  placementPreview.visible = false;
}

function heldItem() {
  return hotbarItemAt(selectedHotbarSlot);
}

function heldSlot() {
  return hotbarSlotAt(selectedHotbarSlot);
}

function openProfilePanel() {
  if (!profilePanel || !profileOverlay) return;
  profileOverlay.hidden = false;
  profilePanel.hidden = false;
  profileOverlay.setAttribute("aria-hidden", "false");
  profilePanel.setAttribute("aria-hidden", "false");
  setProfileTab(profilePanel.dataset.activeProfileTab || "attributes");
  updateProfilePanelDetails();
  if (profilePreview) profilePreview.active = true;
  resizeProfilePreview();
  renderProfilePreview();
}

function closeProfilePanel() {
  if (!profilePanel || !profileOverlay) return;
  profileOverlay.hidden = true;
  profilePanel.hidden = true;
  profileOverlay.setAttribute("aria-hidden", "true");
  profilePanel.setAttribute("aria-hidden", "true");
  if (profilePreview) {
    profilePreview.active = false;
    profilePreview.dragging = false;
    profilePreview.pointerId = null;
  }
  profileModelContainer?.classList.remove("dragging");
}

function updateProfilePanelDetails() {
  if (!profilePanel || profilePanel.hidden) return;
  const session = getGameSession();
  const level = 1;
  if (profileName) profileName.textContent = session.username || t("main.account.guest");
  if (profileLevel) profileLevel.textContent = t("main.account.level", { level });
  if (profileTitleValue) profileTitleValue.textContent = t("main.account.defaultTitle");
  if (profileWallet) profileWallet.textContent = session.walletAddress ? formatWalletAddress(session.walletAddress) : t("main.account.notConnected");
  if (profilePosition) profilePosition.textContent = `${Math.round(player.position.x)}, ${Math.round(player.position.y)}, ${Math.round(player.position.z)}`;
  if (profileChunks) profileChunks.textContent = String(knownChunks.size);
  updateProfileBackpackDetails();
}

function setProfileTab(tabName) {
  const next = tabName === "model" ? "model" : "attributes";
  if (profilePanel) profilePanel.dataset.activeProfileTab = next;
  profileTabs.forEach((tab) => {
    const active = tab.dataset.profileTab === next;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (next === "model") {
    window.requestAnimationFrame(() => {
      resizeProfilePreview();
      renderProfilePreview();
    });
  }
}

function updateProfileBackpackDetails() {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  if (profileBackpackStatus) {
    profileBackpackStatus.textContent = backpack
      ? gameText("main.profile.backpackEquipped", "{address} · {count}/{capacity}", {
          address: formatWalletAddress(backpack.publicKey),
          count: backpack.itemCount ?? 0,
          capacity: backpack.capacity ?? backpackSlotTotal,
        })
      : gameText("main.profile.noBackpack", "No backpack equipped");
    profileBackpackStatus.title = backpack?.publicKey ?? "";
  }
  if (profileBackpackBuy) {
    profileBackpackBuy.hidden = Boolean(backpack);
    profileBackpackBuy.disabled = equippedBackpackLoading;
    if (!profileBackpackBuy.hidden) {
      profileBackpackBuy.textContent = equippedBackpackLoading
        ? gameText("main.profile.buyingBackpack", "Buying...")
        : gameText("main.profile.buyBackpack", "Buy Backpack");
    }
  }
}

async function handleBuyBackpack(event) {
  event.preventDefault();
  event.stopPropagation();
  if (equippedBackpackLoading) return;
  equippedBackpackLoading = true;
  updateProfileBackpackDetails();
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.purchaseDefaultBackpack();
    if (!result?.purchased) {
      profileBackpackStatus.textContent = gameText("main.profile.backpackPurchaseFailed", "Backpack purchase failed: {reason}", {
        reason: chainSubmitReasonLabel(result?.reason),
      });
      return;
    }
    await refreshEquippedBackpack({ force: true });
  } catch (error) {
    console.warn("Failed to buy NiceChunk backpack", error);
    if (profileBackpackStatus) {
      profileBackpackStatus.textContent = gameText("main.profile.backpackPurchaseFailed", "Backpack purchase failed: {reason}", {
        reason: readableChainError(error),
      });
    }
  } finally {
    equippedBackpackLoading = false;
    updateProfileBackpackDetails();
  }
}

async function refreshEquippedBackpack({ force = false } = {}) {
  if (!isNicechunkChainFeatureEnabled()) {
    equippedBackpackStatus = null;
    syncEquippedBackpackSlot();
    renderHotbar();
    updateProfileBackpackDetails();
    return null;
  }
  const now = performance.now();
  if (equippedBackpackLoading && !force) return equippedBackpackStatus;
  if (!force && now - equippedBackpackLastLoadedAt < 14000) return equippedBackpackStatus;
  equippedBackpackLoading = true;
  try {
    const { getEquippedBackpackStatus } = await loadNicechunkChainModule();
    equippedBackpackStatus = await getEquippedBackpackStatus();
    equippedBackpackLastLoadedAt = performance.now();
    syncEquippedBackpackSlot();
    renderHotbar();
    if (backpackPanel && !backpackPanel.hidden) renderBackpackPanel();
    if (marketPanel && !marketPanel.hidden) updateMarketPanel();
    updateProfileBackpackDetails();
    return equippedBackpackStatus;
  } catch (error) {
    console.warn("Failed to refresh equipped backpack", error);
    return equippedBackpackStatus;
  } finally {
    equippedBackpackLoading = false;
    updateProfileBackpackDetails();
    if (marketPanel && !marketPanel.hidden) updateMarketPanel();
  }
}

async function refreshGameplaySessionHud({ force = false } = {}) {
  if (!isNicechunkChainFeatureEnabled()) {
    gameplaySessionStatus = null;
    updateAccountHud();
    return null;
  }
  const now = performance.now();
  if (gameplaySessionStatusLoading) return gameplaySessionStatus;
  if (!force && now - gameplaySessionStatusLastLoadedAt < 14000) return gameplaySessionStatus;
  gameplaySessionStatusLoading = true;
  try {
    const { getGameplaySessionStatus } = await loadNicechunkChainModule();
    gameplaySessionStatus = await getGameplaySessionStatus();
    gameplaySessionStatusLastLoadedAt = performance.now();
    updateAccountHud();
    return gameplaySessionStatus;
  } catch (error) {
    console.warn("Failed to refresh NiceChunk gameplay session balance", error);
    return gameplaySessionStatus;
  } finally {
    gameplaySessionStatusLoading = false;
  }
}

async function ensureGameplaySessionFundingForMining(chainModule) {
  const status = await refreshGameplaySessionHud({ force: true });
  const operationalMinimumLamports = 8_000_000;
  const hasUsableBalance = Number.isFinite(status?.balanceLamports) && status.balanceLamports >= operationalMinimumLamports;
  if (status?.acknowledged && hasUsableBalance) return true;

  const result = await openSessionFundingDialog(chainModule, status);
  if (!result) return false;
  const configuredSol = chainModule.setConfiguredGameplaySessionFundingSol(result.amount, currentSession.walletAddress);
  if (sessionFundingAmount) sessionFundingAmount.value = configuredSol.toFixed(2).replace(/\.?0+$/, "");
  chainModule.acknowledgeGameplaySessionFunding(currentSession.walletAddress);
  gameplaySessionStatus = {
    ...(status ?? {}),
    acknowledged: true,
    configuredFundingLamports: Math.round(configuredSol * 1_000_000_000),
  };
  updateAccountHud();
  const funded = await chainModule.ensureGameplaySessionFunded();
  if (!funded?.funded) return false;
  gameplaySessionStatus = {
    ...gameplaySessionStatus,
    balanceLamports: funded.balanceLamports,
    balanceSol: funded.balanceSol,
    publicKey: funded.publicKey,
    expiresAt: funded.expiresAt,
  };
  updateAccountHud();
  return true;
}

function openSessionFundingDialog(chainModule, status = null) {
  if (!sessionFundingPanel || !sessionFundingOverlay || !sessionFundingAmount) return Promise.resolve(true);
  if (sessionFundingDialogResolve) return Promise.resolve(false);

  const minimumSol = chainModule.getMinimumGameplaySessionFundingSol();
  const configuredSol = chainModule.getConfiguredGameplaySessionFundingSol(currentSession.walletAddress);
  sessionFundingAmount.min = String(minimumSol);
  sessionFundingAmount.value = Math.max(minimumSol, configuredSol).toFixed(2).replace(/\.?0+$/, "");
  if (sessionFundingMinimum) {
    sessionFundingMinimum.textContent = gameText("main.chainSession.minimum", "Minimum: {amount} SOL", {
      amount: formatSolAmount(minimumSol),
    });
  }
  updateSessionFundingCurrent(status);
  updateSessionWalletAppLinks();

  sessionFundingOverlay.hidden = false;
  sessionFundingPanel.hidden = false;
  sessionFundingOverlay.setAttribute("aria-hidden", "false");
  sessionFundingPanel.setAttribute("aria-hidden", "false");
  window.setTimeout(() => sessionFundingAmount.focus(), 0);

  return new Promise((resolve) => {
    sessionFundingDialogResolve = resolve;
  });
}

function updateSessionWalletAppLinks() {
  const hasInjectedWallet = detectInjectedWalletProvider();
  if (sessionWalletApps) sessionWalletApps.hidden = hasInjectedWallet;
  const links = {
    phantom: sessionOpenPhantom,
    solflare: sessionOpenSolflare,
    backpack: sessionOpenBackpack,
  };
  for (const [wallet, link] of Object.entries(links)) {
    if (!link) continue;
    link.href = buildWalletAppBrowseLink(wallet);
    link.target = "_self";
  }
}

function detectInjectedWalletProvider() {
  return Boolean(
    window.phantom?.solana?.connect ||
    window.solflare?.connect ||
    window.backpack?.solana?.connect ||
    window.solana?.connect,
  );
}

function buildWalletAppBrowseLink(wallet) {
  const target = new URL(window.location.href);
  const encodedTarget = encodeURIComponent(target.toString());
  const encodedRef = encodeURIComponent(window.location.origin);
  const bases = {
    phantom: "https://phantom.app/ul/browse",
    solflare: "https://solflare.com/ul/v1/browse",
    backpack: "https://backpack.app/ul/v1/browse",
  };
  return `${bases[wallet]}/${encodedTarget}?ref=${encodedRef}`;
}

function closeSessionFundingDialog(result) {
  if (!sessionFundingPanel || !sessionFundingOverlay) return;
  if (document.activeElement instanceof HTMLElement && sessionFundingPanel.contains(document.activeElement)) {
    document.activeElement.blur();
    canvas?.focus?.({ preventScroll: true });
  }
  sessionFundingOverlay.hidden = true;
  sessionFundingPanel.hidden = true;
  sessionFundingOverlay.setAttribute("aria-hidden", "true");
  sessionFundingPanel.setAttribute("aria-hidden", "true");
  const resolve = sessionFundingDialogResolve;
  sessionFundingDialogResolve = null;
  resolve?.(result);
}

function updateSessionFundingCurrent(status) {
  if (!sessionFundingCurrent) return;
  if (!status?.publicKey || status.balanceLamports === null) {
    sessionFundingCurrent.textContent = gameText("main.chainSession.currentUnknown", "Current session balance: unknown");
    return;
  }
  sessionFundingCurrent.textContent = gameText("main.chainSession.current", "Current session balance: {balance} SOL", {
    balance: formatSolAmount(status.balanceLamports / 1_000_000_000),
  });
}

function logoutProfile() {
  savePlayerPosition(true);
  saveKnownChunksToStorage(true);
  clearWalletSession();
  clearLocalSessionAuthorities();
  closeProfilePanel();
  redirectToGameLogin({ redirectPath: "/play/", autoConnect: false });
}

function clearLocalSessionAuthorities() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("nicechunk.session.v1.")) localStorage.removeItem(key);
  }
  localStorage.removeItem("nicechunk.phantomRedirectConnect");
  localStorage.removeItem("nicechunk.walletLoginChallenge");
}

function resizeProfilePreview() {
  if (!profilePreview || !profileModelCanvas) return;
  if (profileModelContainer && !profileModelContainer.offsetParent) return;
  const rect = (profileModelContainer ?? profileModelCanvas).getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || profileModelCanvas.clientWidth || 360));
  const height = Math.max(1, Math.floor(rect.height || profileModelCanvas.clientHeight || 420));
  if (width === profilePreview.width && height === profilePreview.height) return;
  profilePreview.width = width;
  profilePreview.height = height;
  profilePreview.camera.aspect = width / height;
  profilePreview.camera.updateProjectionMatrix();
  profilePreview.renderer.setSize(width, height, false);
}

function updateProfilePreviewCamera() {
  if (!profilePreview) return;
  profilePreview.camera.position.set(0, 1.45, profilePreview.distance);
  profilePreview.camera.lookAt(0, 1.15, 0);
}

function renderProfilePreview() {
  if (!profilePreview?.active) return;
  if (profileModelContainer && !profileModelContainer.offsetParent) return;
  resizeProfilePreview();
  profilePreview.root.rotation.x = profilePreview.rotationX;
  profilePreview.root.rotation.y = profilePreview.rotationY;
  updateProfilePreviewCamera();
  profilePreview.renderer.render(profilePreview.scene, profilePreview.camera);
}

function beginProfilePreviewDrag(event) {
  if (!profilePreview || !isPrimaryPointer(event)) return;
  event.preventDefault();
  event.stopPropagation();
  profilePreview.dragging = true;
  profilePreview.pointerId = event.pointerId;
  profilePreview.lastX = event.clientX;
  profilePreview.lastY = event.clientY;
  profileModelContainer?.classList.add("dragging");
  try {
    profileModelContainer?.setPointerCapture?.(event.pointerId);
  } catch {
    // Synthetic pointer events and some cancelled gestures may not have an active pointer to capture.
  }
}

function dragProfilePreview(event) {
  if (!profilePreview?.dragging || event.pointerId !== profilePreview.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const deltaX = event.clientX - profilePreview.lastX;
  const deltaY = event.clientY - profilePreview.lastY;
  profilePreview.lastX = event.clientX;
  profilePreview.lastY = event.clientY;
  profilePreview.rotationY += deltaX * 0.012;
  profilePreview.rotationX = clampNumber(profilePreview.rotationX + deltaY * 0.006, -0.45, 0.35);
}

function endProfilePreviewDrag(event) {
  if (!profilePreview?.dragging || event.pointerId !== profilePreview.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  profilePreview.dragging = false;
  profilePreview.pointerId = null;
  profileModelContainer?.classList.remove("dragging");
  try {
    profileModelContainer?.releasePointerCapture?.(event.pointerId);
  } catch {
    // The pointer may already be released by the browser after cancellation.
  }
}

function zoomProfilePreview(event) {
  if (!profilePreview) return;
  event.preventDefault();
  event.stopPropagation();
  profilePreview.distance = clampNumber(profilePreview.distance + event.deltaY * 0.006, 4.8, 10.5);
  updateProfilePreviewCamera();
}

function renderResourceDebugFeed() {
  if (!resourceDebugFeed) return;
  resourceDebugFeed.hidden = !debugMiningEnabled;
  if (!debugMiningEnabled) {
    resourceDebugFeed.replaceChildren();
    return;
  }
  const rows = resourceDebugEvents.length
    ? resourceDebugEvents.map((event) => {
      const row = document.createElement("div");
      row.className = "resource-debug-row";
      const material = localizedBlockName(event.blockKey ?? event.material);
      const amount = formatResourceAmount(event.amount);
      row.textContent =
        event.amount > 0
          ? t("resourceSimulator.debug.reward", { material, amount, resource: t(`resourceSimulator.resource.${event.resourceId}`) })
          : t("resourceSimulator.debug.noReward", { material });
      return row;
    })
    : [createResourceDebugStatusRow()];
  resourceDebugFeed.replaceChildren(...rows);
}

function createResourceDebugStatusRow() {
  const row = document.createElement("div");
  row.className = "resource-debug-row";
  row.textContent = t("resourceSimulator.debug.enabled");
  return row;
}

function localizedBlockName(blockKey) {
  const normalizedKey = blockKey || "unknown";
  const blockLabelKey = `main.block.${normalizedKey}`;
  const blockLabel = t(blockLabelKey);
  if (blockLabel !== blockLabelKey) return blockLabel;
  const materialLabelKey = `resourceSimulator.material.${normalizedKey}`;
  const materialLabel = t(materialLabelKey);
  return materialLabel !== materialLabelKey ? materialLabel : normalizedKey;
}

function updateEquippedItem() {
  const item = heldItem();
  const slot = heldSlot();
  const { rightTool, heldBlock } = avatar.userData.limbs;
  if (rightTool) rightTool.visible = item.hand === "pickaxe";
  if (heldBlock) heldBlock.visible = item.hand === "block";
  if (item.hand === "block") {
    heldBlock.material = materials[item.handType ?? item.type] ?? materials.dirt;
    heldBlock.scale.setScalar(item.handScale ?? 0.38);
  }
  updateEquippedForgedItem(item.hand === "forged" ? slot?.bytes ?? slot?.code : null);
}

function updateEquippedForgedItem(code) {
  try {
    equippedForgedMesh = equipForgedItemOnAvatar({ avatar, code, currentMesh: equippedForgedMesh });
  } catch (error) {
    console.warn("Failed to equip forged item", error);
  }
}

function createInitialBackpackSlots() {
  return Array.from({ length: backpackSlotTotal }, () => null);
}

function openBackpackPanel() {
  if (!backpackPanel || !backpackOverlay) return;
  backpackPanel.hidden = false;
  backpackOverlay.hidden = false;
  backpackPanel.setAttribute("aria-hidden", "false");
  backpackOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("backpack-open");
  renderBackpackPanel();
  void refreshEquippedBackpack({ force: true });
}

function closeBackpackPanel() {
  if (!backpackPanel || !backpackOverlay) return;
  backpackPanel.hidden = true;
  backpackOverlay.hidden = true;
  backpackPanel.setAttribute("aria-hidden", "true");
  backpackOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("backpack-open");
}

function openMarketPanel() {
  if (!marketPanel || !marketOverlay) return;
  marketPanel.hidden = false;
  marketOverlay.hidden = false;
  marketPanel.setAttribute("aria-hidden", "false");
  marketOverlay.setAttribute("aria-hidden", "false");
  selectMarketTab(marketPanel.dataset.activeMarketTab || "browse");
  updateMarketPanel();
  void refreshMarketChainListings({ force: performance.now() - marketChainListingsLoadedAt > 15000 });
}

function closeMarketPanel() {
  if (!marketPanel || !marketOverlay) return;
  marketPanel.hidden = true;
  marketOverlay.hidden = true;
  marketPanel.setAttribute("aria-hidden", "true");
  marketOverlay.setAttribute("aria-hidden", "true");
}

function selectMarketTab(tabName) {
  const selected = ["browse", "sell", "orders"].includes(tabName) ? tabName : "browse";
  if (marketPanel) marketPanel.dataset.activeMarketTab = selected;
  marketTabs.forEach((tab) => {
    const active = tab.dataset.marketTab === selected;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  marketTabPanels.forEach((panel) => {
    const active = panel.dataset.marketTabPanel === selected;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  updateMarketPanel();
}

function updateMarketPanel() {
  updateMarketCategoryButtons();
  if (marketWallet) {
    marketWallet.textContent = currentSession.walletAddress
      ? formatWalletAddress(currentSession.walletAddress)
      : gameText("main.account.notConnected", "Not connected");
    marketWallet.title = currentSession.walletAddress ?? "";
  }
  if (marketBackpack) {
    const backpack = equippedBackpackStatus?.backpack ?? null;
    marketBackpack.textContent = backpack
      ? gameText("main.market.backpackCount", "{count}/{capacity}", {
          count: backpack.itemCount ?? 0,
          capacity: backpack.capacity ?? backpackSlotTotal,
        })
      : gameText("main.profile.noBackpack", "No backpack equipped");
  }
  renderMarketListings();
  renderMarketInventory();
  renderMarketOrders();
  updateMarketListingDraft();
  if (marketPanel && !marketPanel.hidden) {
    void refreshMarketChainListings({ force: performance.now() - marketChainListingsLoadedAt > 30000 });
  }
}

function updateMarketCategoryButtons() {
  marketCategoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.marketCategory === marketSelectedCategory);
  });
}

function renderMarketListings() {
  if (!marketListingGrid) return;
  const listings = filterMarketListings([...marketSampleListings, ...loadMergedMarketListings()]);
  if (!listings.length) {
    marketListingGrid.replaceChildren(createMarketEmptyState(
      marketChainListingsLoading
        ? gameText("main.market.loadingListings", "Loading listings...")
        : gameText("main.market.noListings", "No listings match"),
      marketChainListingsError
        ? gameText("main.market.chainListingLoadFailed", "On-chain listings are temporarily unavailable.")
        : gameText("main.market.noListingsMeta", "Try another category or search term."),
    ));
    return;
  }
  marketListingGrid.replaceChildren(...listings.map((listing) => createMarketListingCard(listing, { order: false })));
}

function renderMarketOrders() {
  if (!marketOrdersGrid) return;
  const orders = loadMarketOrderListings();
  if (!orders.length) {
    marketOrdersGrid.replaceChildren(createMarketEmptyState(
      gameText("main.market.noOrders", "No active orders"),
      gameText("main.market.noOrdersMeta", "Wallet orders will appear here."),
    ));
    return;
  }
  marketOrdersGrid.replaceChildren(...orders.map((listing) => createMarketListingCard(listing, { order: true })));
}

function renderMarketInventory() {
  if (!marketInventoryGrid) return;
  const items = collectMarketSelectableItems();
  if (!items.length) {
    marketInventoryGrid.replaceChildren(createMarketEmptyState(
      gameText("main.market.noInventoryItems", "No listable items"),
      gameText("main.market.noInventoryItemsMeta", "Equip a backpack or keep tools in your hotbar to create listings."),
    ));
    return;
  }
  marketInventoryGrid.replaceChildren(...items.map(createMarketInventoryItemButton));
}

function filterMarketListings(listings) {
  const query = String(marketSearch?.value ?? "").trim().toLowerCase();
  return listings.filter((listing) => {
    if (marketSelectedCategory !== "all" && listing.category !== marketSelectedCategory) return false;
    if (!query) return true;
    return [
      marketListingName(listing),
      marketListingMeta(listing),
      marketCategoryLabel(listing.category),
      listing.currency,
      listing.price,
    ].join(" ").toLowerCase().includes(query);
  });
}

function createMarketListingCard(listing, { order = false } = {}) {
  const card = document.createElement("article");
  card.className = "market-listing-card";
  card.dataset.category = listing.category;
  const icon = document.createElement("div");
  icon.className = `market-listing-icon ${marketListingIconType(listing)}`;
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = marketListingName(listing);
  const meta = document.createElement("span");
  meta.textContent = `${marketCategoryLabel(listing.category)} · ${marketListingMeta(listing)}`;
  copy.append(title, meta);
  const price = document.createElement("b");
  price.textContent = `${listing.price} ${listing.currency}`;
  const action = document.createElement("button");
  action.type = "button";
  action.textContent = order ? gameText("main.market.cancelListing", "Cancel") : gameText("main.market.buy", "Buy");
  if (order) {
    action.addEventListener("click", () => handleCancelMarketListing(listing, action));
  } else if (listing.listing && listing.seller) {
    action.disabled = marketBuyingListingId === listing.id;
    action.textContent = action.disabled ? gameText("main.market.buyPending", "Buying...") : gameText("main.market.buy", "Buy");
    action.addEventListener("click", () => handleBuyMarketListing(listing, action));
  } else {
    action.disabled = true;
    action.title = gameText("main.market.sampleListing", "Sample listing");
  }
  card.append(icon, copy, price, action);
  return card;
}

function createMarketInventoryItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "market-inventory-item";
  button.classList.toggle("selected", marketSelectedListingItem?.id === item.id);
  button.dataset.itemId = item.id;
  const icon = document.createElement("span");
  icon.className = `market-listing-icon ${item.iconType}`;
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  title.textContent = item.name;
  const meta = document.createElement("small");
  meta.textContent = `${marketCategoryLabel(item.category)} · ${item.meta}`;
  copy.append(title, meta);
  button.append(icon, copy);
  button.addEventListener("click", () => {
    marketSelectedListingItem = item;
    if (marketListingCategory) marketListingCategory.value = item.category;
    updateMarketListingDraft();
    renderMarketInventory();
  });
  return button;
}

function createMarketEmptyState(title, body) {
  const empty = document.createElement("div");
  empty.className = "market-empty-state";
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const bodyEl = document.createElement("span");
  bodyEl.textContent = body;
  empty.append(titleEl, bodyEl);
  return empty;
}

function updateMarketListingDraft() {
  if (marketSelectedItem) {
    marketSelectedItem.textContent = marketSelectedListingItem?.name ?? gameText("main.market.noSelection", "No item selected");
  }
  const price = Number(marketListingPrice?.value);
  if (marketCreateListing) {
    marketCreateListing.disabled = marketListingSubmitting || !marketSelectedListingItem || !Number.isFinite(price) || price <= 0;
  }
}

async function handleCreateMarketListing(event) {
  event.preventDefault();
  event.stopPropagation();
  if (marketListingSubmitting) return;
  updateMarketListingDraft();
  const price = Number(marketListingPrice?.value);
  if (!marketSelectedListingItem || !Number.isFinite(price) || price <= 0) {
    if (marketFormStatus) marketFormStatus.textContent = gameText("main.market.invalidListing", "Select an item and enter a valid price.");
    return;
  }
  marketListingSubmitting = true;
  if (marketFormStatus) marketFormStatus.textContent = gameText("main.market.listingPending", "Confirm the transaction to create this listing on-chain.");
  updateMarketListingDraft();
  try {
    const chainModule = await loadNicechunkChainModule();
    const category = marketListingCategory?.value || marketSelectedListingItem.category;
    const currency = marketListingCurrency?.value || "NCK";
    const result = await chainModule.createMarketListingOnChain({
      item: marketSelectedListingItem,
      category,
      currency,
      price: marketListingPrice?.value ?? price,
      quantity: marketSelectedListingItem.quantity ?? 1,
    });
    if (!result?.submitted) {
      if (marketFormStatus) {
        marketFormStatus.textContent = gameText("main.market.listingFailed", "Listing transaction failed: {reason}", {
          reason: chainSubmitReasonLabel(result?.reason),
        });
      }
      return;
    }
    const listing = {
      id: `chain-${result.listingId}`,
      seller: result.seller || currentSession.walletAddress || "local",
      listing: result.listing,
      listingId: result.listingId,
      signature: result.signature,
      programId: result.programId,
      name: marketSelectedListingItem.name,
      meta: marketSelectedListingItem.meta,
      category,
      currency,
      price: formatMarketPrice(price),
      priceBaseUnits: result.priceBaseUnits,
      iconType: marketSelectedListingItem.iconType,
      source: marketSelectedListingItem.source,
      sourceItemId: marketSelectedListingItem.id,
      createdAt: Date.now(),
    };
    saveMarketListings([listing, ...loadMarketListings()]);
    marketSelectedListingItem = null;
    if (marketListingPrice) marketListingPrice.value = "";
    if (marketFormStatus) {
      marketFormStatus.textContent = gameText("main.market.listingCreated", "Listing created on-chain: {signature}", {
        signature: shortSignature(result.signature),
      });
    }
    selectMarketTab("orders");
  } catch (error) {
    console.warn("Failed to create market listing", error);
    if (marketFormStatus) {
      marketFormStatus.textContent = gameText("main.market.listingFailed", "Listing transaction failed: {reason}", {
        reason: readableChainError(error),
      });
    }
  } finally {
    marketListingSubmitting = false;
    updateMarketPanel();
  }
}

async function handleCancelMarketListing(listing, action) {
  if (!listing?.id) return;
  if (!listing.listing && !listing.listingId) {
    removeMarketListing(listing.id);
    updateMarketPanel();
    return;
  }
  action.disabled = true;
  action.textContent = gameText("main.market.cancelPending", "Canceling...");
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.cancelMarketListingOnChain({
      listing: listing.listing,
      listingId: listing.listingId,
    });
    if (!result?.submitted) {
      if (marketFormStatus) {
        marketFormStatus.textContent = gameText("main.market.cancelFailed", "Cancel transaction failed: {reason}", {
          reason: chainSubmitReasonLabel(result?.reason),
        });
      }
      action.disabled = false;
      action.textContent = gameText("main.market.cancelListing", "Cancel");
      return;
    }
    removeMarketListing(listing.id);
    updateMarketPanel();
  } catch (error) {
    console.warn("Failed to cancel market listing", error);
    if (marketFormStatus) {
      marketFormStatus.textContent = gameText("main.market.cancelFailed", "Cancel transaction failed: {reason}", {
        reason: readableChainError(error),
      });
    }
    action.disabled = false;
    action.textContent = gameText("main.market.cancelListing", "Cancel");
  }
}

async function handleBuyMarketListing(listing, action) {
  if (!listing?.id || marketBuyingListingId) return;
  marketBuyingListingId = listing.id;
  action.disabled = true;
  action.textContent = gameText("main.market.buyPending", "Buying...");
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.buyMarketListingOnChain({ listing });
    if (!result?.submitted) {
      if (marketFormStatus) {
        marketFormStatus.textContent = gameText("main.market.buyFailed", "Buy transaction failed: {reason}", {
          reason: chainSubmitReasonLabel(result?.reason),
        });
      }
      action.disabled = false;
      action.textContent = gameText("main.market.buy", "Buy");
      return;
    }
    removeMarketListing(listing.id);
    if (marketFormStatus) {
      marketFormStatus.textContent = gameText("main.market.buyCreated", "Purchase confirmed on-chain: {signature}", {
        signature: shortSignature(result.signature),
      });
    }
    updateMarketPanel();
  } catch (error) {
    console.warn("Failed to buy market listing", error);
    if (marketFormStatus) {
      marketFormStatus.textContent = gameText("main.market.buyFailed", "Buy transaction failed: {reason}", {
        reason: readableChainError(error),
      });
    }
    action.disabled = false;
    action.textContent = gameText("main.market.buy", "Buy");
  } finally {
    marketBuyingListingId = null;
    updateMarketPanel();
  }
}

function collectMarketSelectableItems() {
  const items = [];
  const listedSourceIds = new Set(loadMarketListings().map((listing) => listing.sourceItemId).filter(Boolean));
  const backpack = equippedBackpackStatus?.backpack ?? null;
  createBackpackSlotsFromChain(backpack).forEach((slot, index) => {
    if (!slot) return;
    const id = `backpack-${index}-${slot.record?.worldX ?? 0}-${slot.record?.worldY ?? 0}-${slot.record?.worldZ ?? 0}`;
    if (listedSourceIds.has(id)) return;
    items.push({
      id,
      slotIndex: index,
      source: "backpack",
      name: slot.meta?.name ?? gameText("main.backpack.coordinateResource", "Coordinate Resource"),
      meta: slot.meta?.source ?? gameText("main.backpack.unknownSource", "Unknown source"),
      category: marketCategoryForBackpackSlot(slot),
      iconType: marketIconTypeForCategory(marketCategoryForBackpackSlot(slot)),
      slot,
    });
  });
  hotbarSlots.forEach((slot, index) => {
    if (!slot) return;
    const item = hotbarItems[slot.itemId];
    if (!item || item.action === "openBackpack") return;
    const id = `hotbar-${index}-${slot.itemId}`;
    if (listedSourceIds.has(id)) return;
    const category = marketCategoryForHotbarItem(slot, item);
    items.push({
      id,
      slotIndex: index,
      source: "hotbar",
      name: marketHotbarItemName(slot, item),
      meta: gameText("main.market.hotbarSlotMeta", "Hotbar slot {slot}", { slot: index + 1 }),
      category,
      iconType: marketIconTypeForCategory(category),
      slot,
    });
  });
  return items;
}

function marketCategoryForBackpackSlot(slot) {
  const key = slot?.atlasKey || slot?.blockType || "";
  if (["oakLeaf", "oakLog", "leaf", "leaves", "log", "wood", "tree", "grassPlant", "bush"].includes(key)) return "vegetation";
  if (["stone", "deepStone", "sand", "sandstone", "gravel", "clay", "dirt", "mud", "dryDirt", "basalt", "ash"].includes(key)) return "building";
  return "raw";
}

function marketCategoryForHotbarItem(slot, item) {
  if (item.kind === "tool" || item.kind === "forged" || item.action === "mine") return "equipment";
  if (item.kind === "plant") return "vegetation";
  if (item.kind === "block") return "building";
  return "raw";
}

function marketHotbarItemName(slot, item) {
  if (item.kind === "forged" && slot?.code) return gameText("main.item.forged_item", "Forged Item");
  return t(item.labelKey);
}

function marketListingName(listing) {
  return listing.nameKey ? t(listing.nameKey) : listing.name;
}

function marketListingMeta(listing) {
  return listing.metaKey ? t(listing.metaKey) : listing.meta;
}

function marketListingIconType(listing) {
  return listing.iconType || marketIconTypeForCategory(listing.category);
}

function marketIconTypeForCategory(category) {
  if (category === "equipment") return "equipment";
  if (category === "building") return "building";
  if (category === "clothing") return "clothing";
  return "resource";
}

function marketCategoryLabel(category) {
  const key = {
    raw: "main.market.categoryRaw",
    equipment: "main.market.categoryEquipment",
    building: "main.market.categoryBuilding",
    vegetation: "main.market.categoryVegetation",
    clothing: "main.market.categoryClothing",
  }[category] ?? "main.market.categoryAll";
  return t(key);
}

function marketSourceLabel(source) {
  if (source === "hotbar") return gameText("main.market.sourceHotbar", "Hotbar");
  return gameText("main.market.sourceBackpack", "Backpack");
}

async function refreshMarketChainListings({ force = false } = {}) {
  if (marketChainListingsLoading) return;
  const now = performance.now();
  if (!force && now - marketChainListingsLoadedAt < 30000) return;
  marketChainListingsLoading = true;
  marketChainListingsError = null;
  try {
    const chainModule = await loadNicechunkChainModule();
    const listings = await chainModule.fetchMarketListingsOnChain();
    marketChainListings = Array.isArray(listings) ? listings : [];
    marketChainListingsLoadedAt = performance.now();
  } catch (error) {
    console.warn("Failed to load market listings", error);
    marketChainListingsError = error;
  } finally {
    marketChainListingsLoading = false;
    if (marketPanel && !marketPanel.hidden) {
      renderMarketListings();
      renderMarketOrders();
      renderMarketInventory();
    }
  }
}

function loadMergedMarketListings() {
  const localListings = loadMarketListings();
  const localByPda = new Map(localListings.filter((listing) => listing.listing).map((listing) => [listing.listing, listing]));
  const chainListings = marketChainListings
    .filter((listing) => listing?.stateLabel === "active")
    .map((listing) => normalizeChainMarketListing(listing, localByPda.get(listing.listing)));
  const chainPdas = new Set(chainListings.map((listing) => listing.listing).filter(Boolean));
  return [
    ...chainListings,
    ...localListings.filter((listing) => !listing.listing || !chainPdas.has(listing.listing)),
  ];
}

function loadMarketOrderListings() {
  const wallet = currentSession.walletAddress;
  return loadMergedMarketListings().filter((listing) => {
    if (!wallet) return Boolean(listing.sourceItemId);
    return listing.seller === wallet || Boolean(listing.sourceItemId);
  });
}

function normalizeChainMarketListing(listing, localListing = null) {
  const source = listing.source || localListing?.source || "backpack";
  const sourceIndex = Number.isFinite(Number(listing.sourceIndex)) ? Number(listing.sourceIndex) : 0;
  const category = listing.category || localListing?.category || "raw";
  return {
    id: `chain-${listing.listing}`,
    seller: listing.seller,
    listing: listing.listing,
    listingId: listing.listingId,
    signature: localListing?.signature,
    programId: listing.programId || localListing?.programId,
    name: localListing?.name || gameText("main.market.chainListingName", "On-chain Resource Listing"),
    meta: localListing?.meta || gameText("main.market.chainListingMeta", "{source} slot {slot}", {
      source: marketSourceLabel(source),
      slot: sourceIndex + 1,
    }),
    category,
    currency: listing.currency || localListing?.currency || "NCK",
    price: listing.price || localListing?.price || "0",
    priceBaseUnits: listing.priceBaseUnits || localListing?.priceBaseUnits,
    iconType: localListing?.iconType || marketIconTypeForCategory(category),
    source,
    sourceIndex,
    sourceItemId: localListing?.sourceItemId,
    stateLabel: listing.stateLabel,
    buyer: listing.buyer,
    createdAt: Number(listing.createdAt || 0) * 1000 || localListing?.createdAt || Date.now(),
  };
}

function loadMarketListings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(marketListingStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((listing) => listing?.id && listing?.name && listing?.price) : [];
  } catch {
    return [];
  }
}

function saveMarketListings(listings) {
  localStorage.setItem(marketListingStorageKey, JSON.stringify(listings.slice(0, 50)));
}

function removeMarketListing(id) {
  saveMarketListings(loadMarketListings().filter((listing) => listing.id !== id));
  marketChainListings = marketChainListings.filter((listing) => `chain-${listing.listing}` !== id);
}

function formatMarketPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric >= 1 ? numeric.toFixed(2).replace(/\.?0+$/, "") : numeric.toFixed(6).replace(/\.?0+$/, "");
}

function renderBackpackPanel() {
  if (!backpackGrid || !backpackDetail) return;
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const slots = createBackpackSlotsFromChain(backpack);
  const capacity = backpack?.capacity ?? backpackSlotTotal;
  const filledSlots = slots.filter(Boolean);
  if (backpackCapacity) backpackCapacity.textContent = `${filledSlots.length}/${capacity}`;
  if (backpackWeight) backpackWeight.textContent = gameText("main.backpack.totalWeight", "Weight: {weight}", {
    weight: formatMassKg(totalBackpackMassKg(filledSlots)),
  });
  if (backpackWallet) {
    backpackWallet.textContent = backpack?.publicKey
      ? formatWalletAddress(backpack.publicKey)
      : gameText("main.profile.noBackpack", "No backpack equipped");
    backpackWallet.title = backpack?.publicKey ?? "";
  }

  backpackGrid.replaceChildren(
    ...Array.from({ length: capacity }, (_, index) => createBackpackSlotElement(slots[index], index)),
  );
  renderBackpackDetail(filledSlots[6] ?? filledSlots[0] ?? null);
}

function createBackpackSlotsFromChain(backpack) {
  const signature = backpackSlotsSignature(backpack);
  if (backpackSlotCache.signature === signature) return backpackSlotCache.slots;

  const capacity = backpack?.capacity ?? backpackSlotTotal;
  const slots = Array.from({ length: capacity }, () => null);
  (backpack?.records ?? []).slice(0, capacity).forEach((record, index) => {
    const blockType = blockTypeFromBackpackRecord(record);
    const atlasKey = blockAtlasKeyForRenderType(blockType);
    const atlas = getBlockAtlasEntry(atlasKey);
    const massKg = atlas?.physical?.massKg ?? null;
    slots[index] = {
      itemId: "backpack_resource",
      blockType,
      atlasKey,
      massKg,
      meta: {
        name: localizedBlockResourceName(atlasKey, atlas),
        source: `${record.worldX}, ${record.worldY}, ${record.worldZ}`,
        elements: [
          gameText("main.backpack.massLine", "Mass {mass}", { mass: formatMassKg(massKg) }),
          ...(atlas?.composition ?? []).slice(0, 3).map(([symbol, range]) => `${symbol} ${range}`),
        ],
      },
      record,
    };
  });
  backpackSlotCache.signature = signature;
  backpackSlotCache.slots = slots;
  return slots;
}

function backpackSlotsSignature(backpack) {
  if (!backpack) return `empty:${localStorage.getItem("nicechunk.language") ?? "en"}`;
  const records = (backpack.records ?? [])
    .slice(0, backpack.capacity ?? backpackSlotTotal)
    .map((record) => `${record.worldX},${record.worldY},${record.worldZ}`)
    .join("|");
  return [
    localStorage.getItem("nicechunk.language") ?? "en",
    backpack.publicKey ?? "",
    backpack.capacity ?? backpackSlotTotal,
    backpack.itemCount ?? backpack.records?.length ?? 0,
    records,
  ].join(":");
}

function blockTypeFromBackpackRecord(record) {
  if (!record) return "stone";
  const key = blockKey(record.worldX, record.worldY, record.worldZ);
  const placedType = placedBlocks.get(key);
  if (placedType) return placedType;
  return generatedBlockTypeAt(record.worldX, record.worldY, record.worldZ) ?? "stone";
}

function blockAtlasKeyForRenderType(blockType) {
  if (blockType === "trunkDark") return "trunk";
  if (["leavesDark", "leavesLight", "leavesTeal", "leavesWarm"].includes(blockType)) return "leaves";
  if (blockType === "snowLeaves") return "pineLeaves";
  return blockType;
}

function localizedBlockResourceName(atlasKey, atlas = null) {
  const key = `resourceAtlas.block.${atlasKey}.name`;
  const label = t(key);
  if (label !== key) return label;
  return atlas?.name ?? gameText("main.backpack.coordinateResource", "Coordinate Resource");
}

function totalBackpackMassKg(slots) {
  return slots.reduce((total, slot) => total + (Number.isFinite(slot?.massKg) ? slot.massKg : 0), 0);
}

function formatMassKg(value) {
  if (!Number.isFinite(value) || value <= 0) return gameText("main.backpack.unknownMass", "Unknown");
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} t`;
  if (value >= 10) return `${value.toFixed(1)} kg`;
  if (value >= 1) return `${value.toFixed(2)} kg`;
  return `${Math.round(value * 1000)} g`;
}

function createBackpackSlotElement(slot, index) {
  const button = document.createElement("button");
  button.className = "backpack-slot";
  button.type = "button";
  button.dataset.backpackSlot = String(index);
  button.setAttribute("aria-label", slot ? backpackItemLabel(slot) : t("main.backpack.emptySlot", { slot: index + 1 }));

  if (!slot) {
    button.classList.add("empty");
    return button;
  }

  const item = hotbarItems[slot.itemId] ?? { kind: "empty", labelKey: "main.item.empty", iconClass: "" };
  button.classList.toggle("resource", item.kind === "resource");
  button.classList.toggle("forged", item.kind === "forged");
  button.append(createBackpackItemIcon(item, slot));

  button.addEventListener("pointerenter", () => renderBackpackDetail(slot));
  button.addEventListener("focus", () => renderBackpackDetail(slot));
  return button;
}

function createBackpackItemIcon(item, slot = null) {
  if (slot?.blockType) {
    return createChainEventBlockPreview(slot.blockType, {
      className: "backpack-block-preview",
      canvasClassName: "backpack-block-canvas",
      rotating: false,
    });
  }
  const icon = document.createElement("span");
  icon.className = `backpack-item-icon ${item.iconClass ?? ""}`.trim();
  return icon;
}

function renderBackpackDetail(slot) {
  if (!backpackDetail) return;
  if (!slot) {
    const empty = document.createElement("div");
    empty.className = "backpack-detail-empty";
    empty.textContent = t("main.backpack.emptyDetail");
    backpackDetail.replaceChildren(empty);
    return;
  }

  const item = hotbarItems[slot.itemId] ?? { kind: "empty", labelKey: "main.item.empty", iconClass: "" };
  const meta = slot.meta ?? {};
  const preview = document.createElement("div");
  preview.className = "backpack-detail-preview";
  preview.append(
    slot.blockType
      ? createChainEventBlockPreview(slot.blockType, {
          className: "backpack-detail-block-preview",
          canvasClassName: "backpack-detail-block-canvas",
          rotating: false,
          block: previewBlockFromSlot(slot),
          immediate: true,
        })
      : createBackpackItemIcon(item, slot),
  );

  const copy = document.createElement("div");
  copy.className = "backpack-detail-copy";
  copy.innerHTML = `
    <strong></strong>
    <p></p>
    <div class="backpack-elements"></div>
  `;
  copy.querySelector("strong").textContent = meta.name || t(item.labelKey);
  copy.querySelector("p").textContent = t("main.backpack.detailLine", {
    source: meta.source || t("main.backpack.unknownSource"),
  });
  const elements = copy.querySelector(".backpack-elements");
  (meta.elements ?? []).forEach((label) => {
    const chip = document.createElement("b");
    chip.textContent = label;
    elements.append(chip);
  });

  backpackDetail.replaceChildren(preview, copy);
}

function backpackItemLabel(slot) {
  const item = hotbarItems[slot.itemId] ?? { labelKey: "main.item.empty" };
  return slot?.meta?.name ?? t(item.labelKey);
}

function previewBlockFromSlot(slot) {
  const record = slot?.record;
  if (!record) return null;
  return {
    x: record.worldX,
    y: record.worldY,
    z: record.worldZ,
    type: slot.blockType,
  };
}

function handleBackpackPointerDown(event) {
  const slotIndex = backpackSlotIndexFromEvent(event);
  if (slotIndex === null || !backpackDemoSlots[slotIndex]) return;
  event.preventDefault();
  event.stopPropagation();
  backpackDrag = {
    pointerId: event.pointerId,
    from: slotIndex,
    overBackpack: slotIndex,
    overHotbar: null,
    x: event.clientX,
    y: event.clientY,
    active: false,
  };
  event.target.closest(".backpack-slot")?.setPointerCapture?.(event.pointerId);
}

function handleBackpackPointerMove(event) {
  if (!backpackDrag || event.pointerId !== backpackDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const moved = Math.hypot(event.clientX - backpackDrag.x, event.clientY - backpackDrag.y);
  if (moved > 8) backpackDrag.active = true;
  if (!backpackDrag.active) return;
  if (!dragGhost) {
    beginDragGhost(backpackGrid?.querySelector(`.backpack-slot[data-backpack-slot="${backpackDrag.from}"]`), event.clientX, event.clientY);
  } else {
    moveDragGhost(event.clientX, event.clientY);
  }

  backpackDrag.overBackpack = backpackSlotIndexFromPoint(event.clientX, event.clientY);
  backpackDrag.overHotbar = hotbarSlotIndexFromPoint(event.clientX, event.clientY);
  updateBackpackDragClasses();
}

function handleBackpackPointerUp(event) {
  if (!backpackDrag || event.pointerId !== backpackDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const from = backpackDrag.from;
  const toBackpack = backpackSlotIndexFromPoint(event.clientX, event.clientY) ?? backpackDrag.overBackpack;
  const toHotbar = hotbarSlotIndexFromPoint(event.clientX, event.clientY) ?? backpackDrag.overHotbar;
  const wasDragging = backpackDrag.active;
  clearBackpackDragState();

  if (!wasDragging) {
    renderBackpackDetail(backpackDemoSlots[from]);
    return;
  }

  if (toHotbar !== null && moveBackpackSlotToHotbar(from, toHotbar)) {
    renderBackpackPanel();
    renderHotbar();
    selectedHotbarSlot = toHotbar;
    updateHotbarSelection();
    updateEquippedItem();
    placementPreview.visible = false;
    return;
  }

  if (toBackpack !== null && toBackpack !== from) {
    swapBackpackSlots(from, toBackpack);
    renderBackpackPanel();
    renderBackpackDetail(backpackDemoSlots[toBackpack]);
  }
}

function handleBackpackPointerCancel(event) {
  if (!backpackDrag || event.pointerId !== backpackDrag.pointerId) return;
  event.stopPropagation();
  clearBackpackDragState();
}

function updateBackpackDragClasses() {
  backpackGrid?.querySelectorAll(".backpack-slot").forEach((slot, index) => {
    slot.classList.toggle("drag-source", index === backpackDrag?.from);
    slot.classList.toggle("drag-over", index === backpackDrag?.overBackpack && index !== backpackDrag?.from);
  });
  hotbar.querySelectorAll(".hotbar-slot").forEach((slot, index) => {
    slot.classList.toggle("drag-over", index === backpackDrag?.overHotbar && canDropIntoHotbar(index));
    slot.classList.toggle("drop-blocked", index === backpackDrag?.overHotbar && !canDropIntoHotbar(index));
  });
}

function clearBackpackDragState() {
  backpackDrag = null;
  clearDragGhost();
  backpackGrid?.querySelectorAll(".backpack-slot").forEach((slot) => {
    slot.classList.remove("drag-source", "drag-over");
  });
  hotbar.querySelectorAll(".hotbar-slot").forEach((slot) => {
    slot.classList.remove("drag-over", "drop-blocked");
  });
}

function backpackSlotIndexFromEvent(event) {
  const slot = event.target.closest(".backpack-slot");
  if (!slot) return null;
  const index = Number(slot.dataset.backpackSlot);
  return Number.isInteger(index) ? index : null;
}

function backpackSlotIndexFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest?.(".backpack-slot");
  if (!slot) return null;
  const index = Number(slot.dataset.backpackSlot);
  return Number.isInteger(index) ? index : null;
}

function swapBackpackSlots(from, to) {
  const source = backpackDemoSlots[from] ?? null;
  backpackDemoSlots[from] = backpackDemoSlots[to] ?? null;
  backpackDemoSlots[to] = source;
}

function moveBackpackSlotToHotbar(fromBackpack, toHotbar) {
  if (!canDropIntoHotbar(toHotbar)) return false;
  const source = backpackDemoSlots[fromBackpack] ?? null;
  if (!source) return false;
  const target = hotbarSlots[toHotbar] ?? null;
  backpackDemoSlots[fromBackpack] = target && !isReservedHotbarSlot(target, hotbarItems[target.itemId]) ? target : null;
  hotbarSlots[toHotbar] = source;
  return true;
}

function canDropIntoHotbar(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= hotbarSlotCount) return false;
  const slot = hotbarSlots[slotIndex] ?? null;
  const item = hotbarItems[slot?.itemId] ?? null;
  return !isReservedHotbarSlot(slot, item);
}

function handleHotbarPointerDown(event) {
  const slotIndex = hotbarSlotIndexFromEvent(event);
  if (slotIndex === null) return;
  event.preventDefault();
  event.stopPropagation();
  hotbarDrag = {
    pointerId: event.pointerId,
    from: slotIndex,
    over: slotIndex,
    x: event.clientX,
    y: event.clientY,
    active: false,
  };
  event.target.closest(".hotbar-slot")?.setPointerCapture?.(event.pointerId);
}

function handleHotbarPointerMove(event) {
  if (!hotbarDrag || event.pointerId !== hotbarDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const moved = Math.hypot(event.clientX - hotbarDrag.x, event.clientY - hotbarDrag.y);
  if (moved > 8) hotbarDrag.active = true;
  if (!hotbarDrag.active) return;
  if (!dragGhost) {
    beginDragGhost(hotbar.querySelector(`.hotbar-slot[data-slot="${hotbarDrag.from}"]`), event.clientX, event.clientY);
  } else {
    moveDragGhost(event.clientX, event.clientY);
  }
  hotbarDrag.over = hotbarSlotIndexFromPoint(event.clientX, event.clientY) ?? hotbarDrag.over;
  hotbar.querySelectorAll(".hotbar-slot").forEach((slot, index) => {
    slot.classList.toggle("drag-source", index === hotbarDrag.from);
    slot.classList.toggle("drag-over", index === hotbarDrag.over && index !== hotbarDrag.from);
  });
}

function handleHotbarPointerUp(event) {
  if (!hotbarDrag || event.pointerId !== hotbarDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  const from = hotbarDrag.from;
  const to = hotbarSlotIndexFromPoint(event.clientX, event.clientY) ?? hotbarDrag.over;
  const wasDragging = hotbarDrag.active;
  clearHotbarDragState();

  if (wasDragging && to !== null && to !== from) {
    const draggedWasBackpack = isBackpackHotbarSlot(from);
    swapHotbarSlots(from, to);
    if (draggedWasBackpack) {
      if (isBackpackHotbarSlot(selectedHotbarSlot)) selectFirstSelectableHotbarSlot();
    } else if (selectedHotbarSlot === from) {
      selectedHotbarSlot = to;
    } else if (selectedHotbarSlot === to) {
      selectedHotbarSlot = from;
    }
    if (isBackpackHotbarSlot(selectedHotbarSlot)) selectFirstSelectableHotbarSlot();
    renderHotbar();
    updateEquippedItem();
    placementPreview.visible = false;
    return;
  }

  selectHotbarSlot(from);
}

function handleHotbarPointerCancel(event) {
  if (!hotbarDrag || event.pointerId !== hotbarDrag.pointerId) return;
  event.stopPropagation();
  clearHotbarDragState();
}

function clearHotbarDragState() {
  hotbarDrag = null;
  clearDragGhost();
  hotbar.querySelectorAll(".hotbar-slot").forEach((slot) => {
    slot.classList.remove("drag-source", "drag-over");
  });
}

function beginDragGhost(sourceElement, x, y) {
  if (!sourceElement || !sourceElement.childElementCount) return;
  clearDragGhost();
  const rect = sourceElement.getBoundingClientRect();
  dragGhost = sourceElement.cloneNode(true);
  dragGhost.classList.remove("selected", "drag-source", "drag-over", "drop-blocked");
  dragGhost.classList.add("drag-ghost");
  dragGhost.removeAttribute("id");
  dragGhost.removeAttribute("data-slot");
  dragGhost.removeAttribute("data-backpack-slot");
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  copyCanvasPixels(sourceElement, dragGhost);
  document.body.append(dragGhost);
  moveDragGhost(x, y);
}

function moveDragGhost(x, y) {
  if (!dragGhost) return;
  dragGhost.style.left = `${x}px`;
  dragGhost.style.top = `${y}px`;
}

function clearDragGhost() {
  dragGhost?.remove();
  dragGhost = null;
}

function copyCanvasPixels(sourceElement, targetElement) {
  const sourceCanvases = sourceElement.querySelectorAll("canvas");
  const targetCanvases = targetElement.querySelectorAll("canvas");
  sourceCanvases.forEach((sourceCanvas, index) => {
    const targetCanvas = targetCanvases[index];
    if (!targetCanvas) return;
    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    const context = targetCanvas.getContext("2d");
    if (!context) return;
    context.drawImage(sourceCanvas, 0, 0);
  });
}

function hotbarSlotIndexFromEvent(event) {
  const slot = event.target.closest(".hotbar-slot");
  if (!slot) return null;
  const index = Number(slot.dataset.slot);
  return Number.isInteger(index) ? index : null;
}

function hotbarSlotIndexFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const slot = element?.closest?.(".hotbar-slot");
  if (!slot) return null;
  const index = Number(slot.dataset.slot);
  return Number.isInteger(index) ? index : null;
}

function swapHotbarSlots(from, to) {
  const source = hotbarSlots[from] ?? null;
  hotbarSlots[from] = hotbarSlots[to] ?? null;
  hotbarSlots[to] = source;
}

function consumeSelectedStack(amount = 1) {
  const slot = heldSlot();
  if (!slot || !Number.isFinite(slot.count)) return;
  slot.count = Math.max(0, slot.count - amount);
  if (slot.count <= 0) hotbarSlots[selectedHotbarSlot] = null;
  renderHotbar();
  updateEquippedItem();
  placementPreview.visible = false;
}

function consumeSelectedToolDurability(amount = 1) {
  const slot = heldSlot();
  if (!slot || !Number.isFinite(slot.durability)) return;
  slot.durability = Math.max(0, slot.durability - amount);
  if (slot.durability <= 0) hotbarSlots[selectedHotbarSlot] = null;
  renderHotbar();
  updateEquippedItem();
  placementPreview.visible = false;
}

function createCrackMarker() {
  const marker = new THREE.Group();
  marker.name = "crackMarker";
  marker.visible = false;
  addBox(marker, "crackA", materials.crack, [0, 0.01, -0.515], [0.68, 0.055, 0.018]);
  addBox(marker, "crackB", materials.crack, [-0.21, -0.14, -0.516], [0.055, 0.34, 0.018]);
  addBox(marker, "crackC", materials.crack, [0.18, 0.16, -0.517], [0.055, 0.28, 0.018]);
  addBox(marker, "crackD", materials.crack, [0.05, -0.27, -0.518], [0.34, 0.055, 0.018]);
  return marker;
}

function createPlacementPreview() {
  const material = new THREE.LineDashedMaterial({
    color: 0xffffff,
    dashSize: 0.16,
    gapSize: 0.1,
    linewidth: 1,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  const preview = new THREE.LineSegments(placementPreviewGeometry, material);
  preview.name = "placementPreview";
  preview.scale.setScalar(1.035);
  preview.visible = false;
  preview.renderOrder = 10;
  preview.computeLineDistances();
  return preview;
}

function prepareStartupChunkLoading(center) {
  const centerChunkX = Math.floor(center.x / chunkSize);
  const centerChunkZ = Math.floor(center.z / chunkSize);
  startupChunkTotal = collectChunkKeys(centerChunkX, centerChunkZ, startupChunkLoadRadius).size;
}

function updateStartupChunkLoadingProgress() {
  if (gameLoadingComplete || !startupChunkTotal) return;
  const progress = Math.min(1, generatedStartupChunkCount() / startupChunkTotal);
  setGameLoadingStage("chunks", 58 + progress * 36);
  if (firstGameFrameRendered && progress >= 1) finishGameLoading();
}

function generatedStartupChunkCount() {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  let count = 0;
  for (let z = centerChunkZ - startupChunkLoadRadius; z <= centerChunkZ + startupChunkLoadRadius; z++) {
    for (let x = centerChunkX - startupChunkLoadRadius; x <= centerChunkX + startupChunkLoadRadius; x++) {
      if (generatedChunks.has(chunkKey(x, z))) count++;
    }
  }
  return count;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  updateProceduralMaterialTime(materials, clock.elapsedTime);
  updateFps();
  updatePlayer(dt);
  updateAvatar(dt);
  updateGuardianNetworking();
  updateGuardianRemotePlayers(dt);
  updateChatBubbles();
  updateMiningToolCollision();
  updateBreakParticles(dt);
  updateCrackMarker();
  updateMiningDebug();
  generateAround(player.position);
  updateChunkChainViewportSync();
  buildPendingChunks();
  restoreKnownChunksBudgeted();
  generateCloudsAround(player.position);
  updateCamera(dt);
  updateHud();
  updateMinimap();
  updateGuardianSceneFog();
  savePlayerPosition();
  renderer.render(scene, camera);
  renderProfilePreview();
  if (!firstGameFrameRendered) firstGameFrameRendered = true;
  updateStartupChunkLoadingProgress();
}

function updatePlayer(dt) {
  player.moving = false;
  resolvePlayerOverlap();
  const groundAtStart = surfaceHeight(player.position.x, player.position.z) + 1.01;
  const canUseGroundControl =
    player.grounded || (player.position.y <= groundAtStart + 0.04 && player.velocity.y <= 0);
  const input = new THREE.Vector3(
    axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft"),
    0,
    axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp"),
  );
  let requestedTakeoffDirection = null;
  let requestedTakeoffSpeed = 0;

  if (canUseGroundControl) {
    const speed = currentMoveSpeed();
    if (input.lengthSq() > 0) {
      clearAutoMove();
      input.normalize();
      const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const movement = right.multiplyScalar(input.x).add(forward.multiplyScalar(input.z)).normalize();
      requestedTakeoffDirection = movement;
      requestedTakeoffSpeed = speed;
      player.moving = tryMoveHorizontal(movement, speed * dt);
      setHorizontalVelocity(movement, player.moving ? speed : 0);
      faceDirection(movement);
    } else if (player.autoMoveTarget) {
      const toTarget = new THREE.Vector3(
        player.autoMoveTarget.x - player.position.x,
        0,
        player.autoMoveTarget.z - player.position.z,
      );
      if (toTarget.lengthSq() < 0.045) {
        player.position.x = player.autoMoveTarget.x;
        player.position.z = player.autoMoveTarget.z;
        clearHorizontalVelocity();
        player.moving = advanceAutoMoveTarget();
      } else {
        const movement = toTarget.normalize();
        const autoMoveSpeed = player.speed * 0.78;
        const jumped = tryAutoJumpToTarget(movement, autoMoveSpeed);
        player.moving = jumped || tryMoveHorizontal(movement, autoMoveSpeed * dt, { allowStepUp: true });
        if (player.moving && !jumped) setHorizontalVelocity(movement, autoMoveSpeed);
        if (!player.moving) {
          clearAutoMove();
          clearHorizontalVelocity();
        }
        faceDirection(movement);
      }
    } else {
      clearHorizontalVelocity();
    }
  } else {
    player.moving = applyAirborneHorizontalVelocity(dt);
  }

  const ground = surfaceHeight(player.position.x, player.position.z) + 1.01;
  const canJump = player.grounded || (player.position.y <= ground + 0.04 && player.velocity.y <= 0);
  if (keys.has("Space") && canJump) {
    if (requestedTakeoffDirection) setHorizontalVelocity(requestedTakeoffDirection, requestedTakeoffSpeed);
    player.velocity.y = jumpImpulse;
    player.grounded = false;
  }

  player.velocity.y -= gravity * dt;
  player.position.y += player.velocity.y * dt;

  if (player.position.y <= ground && player.velocity.y <= 0) {
    player.position.y = ground;
    player.velocity.y = 0;
    player.grounded = true;
    clearHorizontalVelocity();
  } else {
    player.grounded = false;
  }
}

function axis(positiveCode, positiveAlt) {
  return keys.has(positiveCode) || keys.has(positiveAlt) ? 1 : 0;
}

function currentMoveSpeed() {
  const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");
  if (debugMiningEnabled && shiftHeld) return player.speed * 100;
  return shiftHeld ? player.sprintSpeed : player.speed;
}

function setAutoMovePath(path) {
  const normalizedPath = Array.isArray(path) ? path.filter(Boolean) : [];
  player.autoMovePath = normalizedPath.slice(1);
  player.autoMoveTarget = normalizedPath[0] ?? null;
}

function clearAutoMove() {
  player.autoMoveTarget = null;
  player.autoMovePath = [];
}

function advanceAutoMoveTarget() {
  if (player.autoMovePath.length) {
    player.autoMoveTarget = player.autoMovePath.shift();
    return true;
  }
  player.autoMoveTarget = null;
  return false;
}

function setHorizontalVelocity(direction, speed) {
  if (!direction || speed <= 0) {
    clearHorizontalVelocity();
    return;
  }
  player.velocity.x = direction.x * speed;
  player.velocity.z = direction.z * speed;
}

function clearHorizontalVelocity() {
  player.velocity.x = 0;
  player.velocity.z = 0;
}

function applyAirborneHorizontalVelocity(dt) {
  const vx = player.velocity.x;
  const vz = player.velocity.z;
  if (Math.abs(vx) < 0.001 && Math.abs(vz) < 0.001) return false;

  const nextX = player.position.x + vx * dt;
  const nextZ = player.position.z + vz * dt;
  if (moveHorizontalTo(nextX, nextZ)) return true;

  let moved = false;
  if (Math.abs(vx) > 0.001) {
    const movedX = moveHorizontalTo(nextX, player.position.z);
    moved = movedX || moved;
  }
  if (Math.abs(vz) > 0.001) {
    const movedZ = moveHorizontalTo(player.position.x, nextZ);
    moved = movedZ || moved;
  }
  return moved;
}

function tryMoveHorizontal(direction, distance, options = {}) {
  const nextX = player.position.x + direction.x * distance;
  const nextZ = player.position.z + direction.z * distance;
  if (moveHorizontalTo(nextX, nextZ, options)) return true;

  let moved = false;
  if (Math.abs(direction.x) > 0.001) moved = moveHorizontalTo(nextX, player.position.z, options) || moved;
  if (Math.abs(direction.z) > 0.001) moved = moveHorizontalTo(player.position.x, nextZ, options) || moved;
  return moved;
}

function moveHorizontalTo(x, z, options = {}) {
  const currentGround = surfaceHeight(player.position.x, player.position.z) + 1.01;
  const nextGround = surfaceHeight(x, z) + 1.01;
  const groundDelta = nextGround - currentGround;
  const nearGround = player.grounded || Math.abs(player.position.y - currentGround) < 0.12;
  const canStepUp =
    options.allowStepUp &&
    nearGround &&
    groundDelta > stepBlockEpsilon &&
    groundDelta <= autoStepHeight;

  if (groundDelta > stepBlockEpsilon && !canStepUp && player.position.y < nextGround - 0.02) {
    return false;
  }
  const testY = canStepUp ? nextGround : player.position.y;
  if (playerBodyCollides(x, z, testY)) return false;

  player.position.x = x;
  player.position.z = z;
  if (canStepUp) {
    player.position.y = nextGround;
    player.velocity.y = 0;
    player.grounded = true;
  }
  return true;
}

function tryAutoJumpToTarget(direction, takeoffSpeed) {
  const target = player.autoMoveTarget;
  if (!target) return false;

  const now = performance.now();
  const currentGround = surfaceHeight(player.position.x, player.position.z) + 1.01;
  const probeX = player.position.x + direction.x * 0.68;
  const probeZ = player.position.z + direction.z * 0.68;
  const nextGround = surfaceHeight(probeX, probeZ) + 1.01;
  const targetGround = target.y ?? surfaceHeight(target.x, target.z) + 1.01;
  const jumpDelta = Math.max(nextGround, targetGround) - currentGround;
  const closeEnough = Math.hypot(target.x - player.position.x, target.z - player.position.z) < 2.6;
  const canRetry = now >= player.autoJumpReadyAt;
  const canJump = player.grounded || Math.abs(player.position.y - currentGround) < 0.12;

  if (!closeEnough || !canRetry || !canJump || jumpDelta <= stepBlockEpsilon || jumpDelta > autoJumpHeight) {
    return false;
  }

  setHorizontalVelocity(direction, takeoffSpeed);
  player.velocity.y = Math.max(player.velocity.y, jumpImpulse * 0.92);
  player.grounded = false;
  player.autoJumpReadyAt = now + autoJumpRetryMs;
  player.autoJumpCommitUntil = now + autoJumpCommitMs;
  return true;
}

function playerBodyCollides(x, z, y) {
  return playerBodyCollisionPush(x, z, y).lengthSq() > 0;
}

function resolvePlayerOverlap() {
  for (let i = 0; i < 3; i++) {
    const push = playerBodyCollisionPush(player.position.x, player.position.z, player.position.y);
    if (push.lengthSq() === 0) return;
    player.position.x += push.x;
    player.position.z += push.z;
  }
}

function playerBodyCollisionPush(x, z, y) {
  const minX = x - playerRadius;
  const maxX = x + playerRadius;
  const minZ = z - playerRadius;
  const maxZ = z + playerRadius;
  const firstBlockX = Math.floor(minX + 0.5);
  const lastBlockX = Math.floor(maxX + 0.5);
  const firstBlockZ = Math.floor(minZ + 0.5);
  const lastBlockZ = Math.floor(maxZ + 0.5);
  const firstBodyY = Math.floor(y);
  const lastBodyY = firstBodyY + playerBodyTopOffset;
  let push = new THREE.Vector3();

  for (let bx = firstBlockX; bx <= lastBlockX; bx++) {
    for (let bz = firstBlockZ; bz <= lastBlockZ; bz++) {
      for (let by = firstBodyY; by <= lastBodyY; by++) {
        const key = blockKey(bx, by, bz);
        if (!solidBlocks.has(key) || removedBlocks.has(key)) continue;

        const overlapX = Math.min(maxX - (bx - 0.5), bx + 0.5 - minX);
        const overlapZ = Math.min(maxZ - (bz - 0.5), bz + 0.5 - minZ);
        if (overlapX <= 0 || overlapZ <= 0) continue;

        if (overlapX < overlapZ) {
          push.x += x < bx ? -overlapX - 0.002 : overlapX + 0.002;
        } else {
          push.z += z < bz ? -overlapZ - 0.002 : overlapZ + 0.002;
        }
      }
    }
  }

  return push;
}

function faceDirection(direction) {
  const yaw = Math.atan2(-direction.x, -direction.z);
  avatar.rotation.y = yaw;
}

function faceBlock(block) {
  const direction = new THREE.Vector3(block.x - player.position.x, 0, block.z - player.position.z);
  if (direction.lengthSq() > 0.0001) faceDirection(direction.normalize());
}

function updateAvatar(dt) {
  updateAvatarMotion({
    THREE,
    avatar,
    player,
    avatarGroundOffset,
    miningSwingDuration,
    cameraPitchMin,
    cameraPitchMax,
    headPitchMin,
    headPitchMax,
  });
}

function startHandSwing() {
  startAvatarHandSwing(player, miningSwingDuration);
}

function startGuardianConnection() {
  if (!currentSession.walletAddress) {
    redirectToGameLogin({ redirectPath: currentGameRedirectPath(), autoConnect: true });
    return;
  }
  void ensureGuardianConnectionForPosition({ force: true });
}

function updateGuardianNetworking() {
  void ensureGuardianConnectionForPosition();
  guardianClient.updateLocalPlayer({
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: avatar.rotation.y,
    pitch: player.cameraPitch,
  });
}

async function ensureGuardianConnectionForPosition({ force = false } = {}) {
  if (!currentSession.walletAddress || guardianConnectionState.resolving) return;
  const chunk = playerChunkFromPosition(player.position);
  if (!force && guardianCoversChunk(guardianConnectionState.guardian, chunk.x, chunk.z)) return;
  const now = performance.now();
  if (!force && now - guardianConnectionState.lastResolveAt < 1000) return;

  guardianConnectionState.resolving = true;
  guardianConnectionState.lastResolveAt = now;
  updateMapGuardianStatus();
  try {
    const resolved = await guardianRegistryResolver.resolveForChunk(chunk.x, chunk.z);
    syncGuardianMapCoverageFromResolver();
    if (!resolved?.url) {
      guardianClient.disconnect();
      clearGuardianRemotePlayers();
      guardianConnectionState.endpoint = "";
      guardianConnectionState.guardian = null;
      updateMapGuardianStatus();
      return;
    }

    const switched = guardianClient.reconnectTo(resolved.url, { position: player.position });
    if (switched) clearGuardianRemotePlayers();
    guardianConnectionState.endpoint = resolved.url;
    guardianConnectionState.guardian = resolved.guardian;
    updateMapGuardianStatus();
  } catch (error) {
    console.warn("Failed to resolve NiceChunk Guardian endpoint", error);
    guardianClient.connect({ position: player.position });
    guardianConnectionState.endpoint = guardianClient.getUrl();
    guardianConnectionState.guardian = null;
    updateMapGuardianStatus();
  } finally {
    guardianConnectionState.resolving = false;
    updateMapGuardianStatus();
  }
}

function playerChunkFromPosition(position) {
  return {
    x: Math.floor(position.x / chunkSize),
    z: Math.floor(position.z / chunkSize),
  };
}

function handleGuardianPlayerJoin(remotePlayer) {
  upsertGuardianRemotePlayer(remotePlayer, { fromMove: false });
}

function handleGuardianPlayerMove(remotePlayer) {
  upsertGuardianRemotePlayer(remotePlayer, { fromMove: true });
}

function upsertGuardianRemotePlayer(remotePlayer, { fromMove = false } = {}) {
  let entry = guardianRemotePlayers.get(remotePlayer.localPlayerId);
  if (!entry) {
    const remoteAvatar = createAvatar({ THREE, cubeGeometry, materials });
    remoteAvatar.name = `guardian-player-${remotePlayer.localPlayerId}`;
    remoteAvatar.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    scene.add(remoteAvatar);
    entry = {
      avatar: remoteAvatar,
      motion: {
        position: new THREE.Vector3(remotePlayer.x, remotePlayer.y, remotePlayer.z),
        moving: false,
        miningSwing: 0,
        miningContact: null,
        miningTargetHit: null,
        miningPreviousToolBoxes: null,
        cameraPitch: remotePlayer.pitch,
      },
      target: new THREE.Vector3(remotePlayer.x, remotePlayer.y, remotePlayer.z),
      samples: [{ at: performance.now(), position: new THREE.Vector3(remotePlayer.x, remotePlayer.y, remotePlayer.z), yaw: remotePlayer.yaw, pitch: remotePlayer.pitch }],
      ownerHash: normalizeGuardianOwnerHash(remotePlayer.ownerHash),
      ownerKey: normalizeGuardianOwnerKey(remotePlayer),
      chatBubble: null,
      yaw: remotePlayer.yaw,
      pitch: remotePlayer.pitch,
      lastSeenAt: performance.now(),
      ready: fromMove || hasGuardianPose(remotePlayer),
    };
    remoteAvatar.visible = entry.ready;
    guardianRemotePlayers.set(remotePlayer.localPlayerId, entry);
  }

  const now = performance.now();
  const ownerHash = normalizeGuardianOwnerHash(remotePlayer.ownerHash);
  const ownerKey = normalizeGuardianOwnerKey(remotePlayer);
  if (ownerKey || ownerHash) {
    adoptGuardianChatBubbleFromDuplicate(entry, { ownerHash, ownerKey, preserveLocalPlayerId: remotePlayer.localPlayerId });
    removeGuardianRemotePlayersWithOwner({ ownerHash, ownerKey, localPlayerId: remotePlayer.localPlayerId }, { preserveLocalPlayerId: remotePlayer.localPlayerId });
    if (ownerKey) entry.ownerKey = ownerKey;
    entry.ownerHash = ownerHash;
  }
  entry.target.set(remotePlayer.x, remotePlayer.y, remotePlayer.z);
  pushGuardianRemoteSample(entry, remotePlayer, now);
  entry.yaw = remotePlayer.yaw;
  entry.pitch = remotePlayer.pitch;
  entry.lastSeenAt = now;
  if (fromMove && !entry.ready) {
    entry.motion.position.copy(entry.target);
    entry.avatar.visible = true;
    entry.ready = true;
  }
}

function handleGuardianPlayerLeave(remotePlayer) {
  removeGuardianRemotePlayer(remotePlayer);
  removeGuardianRemotePlayersWithOwner(remotePlayer);
}

function removeGuardianRemotePlayersWithOwner(remotePlayer, { preserveLocalPlayerId = 0 } = {}) {
  const ownerHash = normalizeGuardianOwnerHash(remotePlayer.ownerHash);
  const ownerKey = normalizeGuardianOwnerKey(remotePlayer);
  if (!ownerKey && !ownerHash) return;
  for (const [localPlayerId, entry] of [...guardianRemotePlayers]) {
    const sameOwnerKey = ownerKey && entry.ownerKey === ownerKey;
    const sameOwnerHash = ownerHash && entry.ownerHash === ownerHash;
    if (localPlayerId !== preserveLocalPlayerId && (sameOwnerKey || sameOwnerHash)) {
      removeGuardianRemotePlayer({ localPlayerId });
    }
  }
}

function adoptGuardianChatBubbleFromDuplicate(targetEntry, { ownerHash, ownerKey, preserveLocalPlayerId = 0 } = {}) {
  if (!targetEntry || targetEntry.chatBubble || (!ownerKey && !ownerHash)) return;
  for (const [localPlayerId, entry] of guardianRemotePlayers) {
    if (localPlayerId === preserveLocalPlayerId || !entry.chatBubble) continue;
    const sameOwnerKey = ownerKey && entry.ownerKey === ownerKey;
    const sameOwnerHash = ownerHash && entry.ownerHash === ownerHash;
    if (!sameOwnerKey && !sameOwnerHash) continue;
    targetEntry.chatBubble = entry.chatBubble;
    entry.chatBubble = null;
    targetEntry.chatBubble.userData.targetAvatar = targetEntry.avatar;
    syncChatBubblePosition(targetEntry.chatBubble);
    return;
  }
}

function normalizeGuardianOwnerHash(ownerHash) {
  return Number(ownerHash || 0) >>> 0;
}

function normalizeGuardianOwnerKey(remotePlayer) {
  const ownerKey = String(remotePlayer?.ownerKey || "").trim();
  if (ownerKey) return ownerKey;
  const ownerHash = normalizeGuardianOwnerHash(remotePlayer?.ownerHash);
  return ownerHash ? `h:${ownerHash}` : "";
}

function removeGuardianRemotePlayer(remotePlayer) {
  const entry = guardianRemotePlayers.get(remotePlayer.localPlayerId);
  if (!entry) return;
  disposeChatBubble(entry.chatBubble);
  scene.remove(entry.avatar);
  disposeGroup(entry.avatar);
  guardianRemotePlayers.delete(remotePlayer.localPlayerId);
}

function clearGuardianRemotePlayers() {
  for (const localPlayerId of [...guardianRemotePlayers.keys()]) {
    removeGuardianRemotePlayer({ localPlayerId });
  }
}

function handleGuardianDig(event) {
  applyGuardianDigEventToWorld(event);
  const entry = guardianRemotePlayers.get(event.localPlayerId);
  if (!entry) return;
  const direction = new THREE.Vector3(event.x - entry.motion.position.x, 0, event.z - entry.motion.position.z);
  if (direction.lengthSq() > 0.0001) entry.yaw = Math.atan2(-direction.x, -direction.z);
  entry.avatar.visible = true;
  entry.ready = true;
  entry.lastSeenAt = performance.now();
  startAvatarHandSwing(entry.motion, miningSwingDuration);
}

function applyGuardianDigEventToWorld(event) {
  if (event.action !== 3) return;
  const key = blockKey(event.x, event.y, event.z);
  if (removedBlocks.has(key) && !solidBlocks.has(key)) return;
  removedBlocks.add(key);
  blockDamage.delete(key);
  solidBlocks.delete(key);
  placedBlocks.delete(key);
  rebuildChunksAroundBlock({ x: event.x, y: event.y, z: event.z });
  flowWaterFromBreak({ x: event.x, y: event.y, z: event.z });
}

function handleGuardianChat(event) {
  const entry = guardianRemotePlayers.get(event.localPlayerId);
  if (!entry) return;
  entry.chatBubble = setAvatarChatBubble(entry.avatar, entry.chatBubble, event.message);
  entry.lastSeenAt = performance.now();
}

function updateGuardianRemotePlayers(dt) {
  const now = performance.now();
  for (const entry of guardianRemotePlayers.values()) {
    if (!entry.ready) continue;
    const renderPose = sampleGuardianRemotePose(entry, now);
    const distance = entry.motion.position.distanceTo(renderPose.position);
    entry.motion.moving = distance > 0.03;
    if (distance > guardianRemoteSnapDistance) {
      entry.motion.position.copy(renderPose.position);
    } else if (distance < guardianRemoteSettleDistance) {
      entry.motion.position.copy(renderPose.position);
    } else {
      const alpha = 1 - Math.exp(-dt * 22);
      entry.motion.position.lerp(renderPose.position, alpha);
    }
    entry.yaw = smoothAngle(entry.yaw, renderPose.yaw, 1 - Math.exp(-dt * 18));
    entry.pitch += (renderPose.pitch - entry.pitch) * (1 - Math.exp(-dt * 18));
    entry.motion.cameraPitch = entry.pitch;
    entry.avatar.rotation.y = entry.yaw;
    updateAvatarMotion({
      THREE,
      avatar: entry.avatar,
      player: entry.motion,
      avatarGroundOffset,
      miningSwingDuration,
      cameraPitchMin,
      cameraPitchMax,
      headPitchMin,
      headPitchMax,
    });
  }
}

function pushGuardianRemoteSample(entry, remotePlayer, now) {
  const latest = entry.samples[entry.samples.length - 1];
  if (
    latest &&
    latest.position.distanceToSquared(entry.target) < 0.000001 &&
    Math.abs(latest.yaw - remotePlayer.yaw) < 0.0001 &&
    Math.abs(latest.pitch - remotePlayer.pitch) < 0.0001
  ) {
    latest.at = now;
    return;
  }
  entry.samples.push({
    at: now,
    position: entry.target.clone(),
    yaw: remotePlayer.yaw,
    pitch: remotePlayer.pitch,
  });
  while (entry.samples.length > 6) entry.samples.shift();
}

function sampleGuardianRemotePose(entry, now) {
  const samples = entry.samples;
  if (!samples.length) return { position: entry.target, yaw: entry.yaw, pitch: entry.pitch };
  if (samples.length === 1) return samples[0];

  const renderAt = now - guardianRemoteInterpolationMs;
  let previous = samples[0];
  let next = null;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].at >= renderAt) {
      next = samples[i];
      break;
    }
    previous = samples[i];
  }

  if (next) {
    const span = Math.max(1, next.at - previous.at);
    const alpha = Math.max(0, Math.min(1, (renderAt - previous.at) / span));
    guardianRemoteTempA.lerpVectors(previous.position, next.position, alpha);
    return {
      position: guardianRemoteTempA,
      yaw: lerpAngle(previous.yaw, next.yaw, alpha),
      pitch: previous.pitch + (next.pitch - previous.pitch) * alpha,
    };
  }

  const latest = samples[samples.length - 1];
  const before = samples[samples.length - 2];
  if (now - latest.at > guardianRemoteInterpolationMs + guardianRemoteMaxExtrapolationMs) {
    return latest;
  }
  const spanSeconds = Math.max(0.001, (latest.at - before.at) / 1000);
  const extrapolateSeconds = Math.min(guardianRemoteMaxExtrapolationMs, Math.max(0, renderAt - latest.at)) / 1000;
  guardianRemoteTempB.copy(latest.position).sub(before.position).multiplyScalar(extrapolateSeconds / spanSeconds);
  guardianRemoteTempA.copy(latest.position).add(guardianRemoteTempB);
  return {
    position: guardianRemoteTempA,
    yaw: latest.yaw,
    pitch: latest.pitch,
  };
}

function lerpAngle(a, b, alpha) {
  let delta = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * alpha;
}

function smoothAngle(current, target, alpha) {
  return lerpAngle(current, target, alpha);
}

function hasGuardianPose(remotePlayer) {
  return Math.abs(remotePlayer.x) > 0.001 || Math.abs(remotePlayer.y) > 0.001 || Math.abs(remotePlayer.z) > 0.001;
}

function sendGuardianDig(block, action) {
  if (!block) return;
  guardianClient.sendDig({
    x: block.x,
    y: block.y,
    z: block.z,
    action,
  });
}

function handleChatInputKeyDown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    submitChatInput();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeChatInput();
  }
}

function openChatInput() {
  if (!chatInput || !currentSession.walletAddress) return;
  chatInput.hidden = false;
  chatInput.value = "";
  keys.clear();
  window.setTimeout(() => chatInput.focus(), 0);
}

function closeChatInput() {
  if (!chatInput) return;
  chatInput.hidden = true;
  chatInput.value = "";
  chatInput.blur();
  keys.clear();
}

function submitChatInput() {
  if (!chatInput) return;
  const message = normalizeChatMessage(chatInput.value);
  closeChatInput();
  if (!message) return;
  if (isDebugCommand(message)) {
    setDebugMiningEnabled(!debugMiningEnabled);
    return;
  }
  if (guardianClient.sendChat(message)) {
    localChatBubble = setAvatarChatBubble(avatar, localChatBubble, message);
  }
}

function isDebugCommand(message) {
  return message.toLowerCase() === "/debug";
}

function setDebugMiningEnabled(enabled) {
  debugMiningEnabled = Boolean(enabled);
  window.NiceChunkDebugMining = debugMiningEnabled;
  if (topHud) topHud.hidden = !debugMiningEnabled;
  debugMiningButton?.setAttribute("aria-pressed", String(debugMiningEnabled));
  renderResourceDebugFeed();
  updateMiningDebug();
}

function normalizeChatMessage(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function setAvatarChatBubble(targetAvatar, currentBubble, message) {
  disposeChatBubble(currentBubble);
  const sprite = createChatBubbleSprite(message);
  sprite.userData.targetAvatar = targetAvatar;
  syncChatBubblePosition(sprite);
  sprite.userData.expiresAt = performance.now() + chatBubbleDurationMs;
  scene.add(sprite);
  return sprite;
}

function createChatBubbleSprite(message) {
  const canvas = document.createElement("canvas");
  canvas.height = chatBubbleCanvasHeight;
  canvas.width = chatBubbleCanvasMaxWidth;
  let context = canvas.getContext("2d");
  const layout = measureChatBubbleLayout(context, message);
  canvas.width = layout.width;
  canvas.height = chatBubbleCanvasHeight;
  context = canvas.getContext("2d");
  drawChatBubbleTexture(context, layout);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(material);
  const widthScale = 3.8 * (layout.width / chatBubbleCanvasMaxWidth);
  sprite.scale.set(widthScale, 1.18, 1);
  return sprite;
}

function measureChatBubbleLayout(context, message) {
  context.font = "700 30px Inter, system-ui, sans-serif";
  const maxTextWidth = chatBubbleCanvasMaxWidth - 72;
  const lines = wrapChatBubbleText(context, message, maxTextWidth, 2);
  const textWidth = Math.max(...lines.map((line) => context.measureText(line).width), 0);
  return {
    width: Math.ceil(THREE.MathUtils.clamp(textWidth + 72, chatBubbleCanvasMinWidth, chatBubbleCanvasMaxWidth)),
    lines,
  };
}

function drawChatBubbleTexture(context, layout) {
  const width = layout.width;
  const height = chatBubbleCanvasHeight;
  context.clearRect(0, 0, width, height);
  context.font = "700 30px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "left";
  const lines = layout.lines;
  const bubbleHeight = lines.length > 1 ? 118 : 86;
  const bubbleY = Math.round((height - bubbleHeight) / 2) - 10;
  const tailTipY = Math.min(height - 10, bubbleY + bubbleHeight + 36);
  const tailHalfWidth = 24;
  chatBubblePath(context, 18, bubbleY, width - 36, bubbleHeight, 24, width / 2, tailHalfWidth, tailTipY);
  context.fillStyle = "rgba(245, 248, 244, 0.92)";
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "rgba(33, 38, 40, 0.82)";
  context.stroke();
  context.fillStyle = "#171b1d";
  const startY = lines.length > 1 ? bubbleY + 42 : bubbleY + bubbleHeight / 2;
  lines.forEach((line, index) => {
    context.fillText(line, 36, startY + index * 38);
  });
}

function wrapChatBubbleText(context, text, maxWidth, maxLines) {
  const segments = Array.from(text);
  const lines = [];
  let line = "";
  for (const char of segments) {
    const next = line + char;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = char;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && segments.join("").length > lines.join("").length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && context.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}...`;
  }
  return lines.length ? lines : [""];
}

function chatBubblePath(context, x, y, width, height, radius, tailCenterX, tailHalfWidth, tailTipY) {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(tailCenterX + tailHalfWidth, bottom);
  context.lineTo(tailCenterX, tailTipY);
  context.lineTo(tailCenterX - tailHalfWidth, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function updateChatBubbles() {
  const now = performance.now();
  if (localChatBubble && now >= localChatBubble.userData.expiresAt) {
    disposeChatBubble(localChatBubble);
    localChatBubble = null;
  } else if (localChatBubble) {
    syncChatBubblePosition(localChatBubble);
  }
  for (const entry of guardianRemotePlayers.values()) {
    if (entry.chatBubble && now >= entry.chatBubble.userData.expiresAt) {
      disposeChatBubble(entry.chatBubble);
      entry.chatBubble = null;
    } else if (entry.chatBubble) {
      syncChatBubblePosition(entry.chatBubble);
    }
  }
}

function syncChatBubblePosition(sprite) {
  const targetAvatar = sprite?.userData?.targetAvatar;
  if (!targetAvatar) return;
  targetAvatar.getWorldPosition(chatBubbleWorldPosition);
  sprite.position.set(
    chatBubbleWorldPosition.x,
    chatBubbleWorldPosition.y + chatBubbleAvatarOffsetY,
    chatBubbleWorldPosition.z,
  );
  sprite.visible = targetAvatar.visible !== false;
}

function disposeChatBubble(sprite) {
  if (!sprite) return;
  sprite.parent?.remove(sprite);
  sprite.material?.map?.dispose?.();
  sprite.material?.dispose?.();
}

function updateCamera(dt = 1 / 60) {
  const mobileCamera = isMobileViewport();
  const desiredFocus = player.position.clone().add(new THREE.Vector3(0, mobileCamera ? 2.05 : 1.5, 0));
  if (!cameraFocusReady || cameraFocus.distanceToSquared(desiredFocus) > 256) {
    cameraFocus.copy(desiredFocus);
    cameraFocusReady = true;
  } else {
    const horizontalAlpha = 1 - Math.exp(-dt * 14);
    const verticalAlpha = 1 - Math.exp(-dt * 7);
    cameraFocus.x = THREE.MathUtils.lerp(cameraFocus.x, desiredFocus.x, horizontalAlpha);
    cameraFocus.z = THREE.MathUtils.lerp(cameraFocus.z, desiredFocus.z, horizontalAlpha);
    cameraFocus.y = THREE.MathUtils.lerp(cameraFocus.y, desiredFocus.y, verticalAlpha);
  }
  const distance = 8.4;
  const horizontal = Math.cos(player.cameraPitch) * distance;
  const offset = new THREE.Vector3(
    Math.sin(player.yaw) * horizontal,
    Math.sin(-player.cameraPitch) * distance + (mobileCamera ? 3.8 : 2.1),
    Math.cos(player.yaw) * horizontal,
  );
  const positionAlpha = 1 - Math.exp(-dt * 9);
  camera.position.lerp(cameraFocus.clone().add(offset), positionAlpha);
  camera.lookAt(cameraFocus);
}

function isMobileViewport() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760;
}

function generateAround(center) {
  const cx = Math.floor(center.x / chunkSize);
  const cz = Math.floor(center.z / chunkSize);
  const visibleKeys = collectChunkKeys(cx, cz, renderDistance);
  const preloadKeys = collectChunkKeys(cx, cz, preloadDistance);
  const nextPending = [];
  const nextPreload = [];

  for (let z = cz - renderDistance; z <= cz + renderDistance; z++) {
    for (let x = cx - renderDistance; x <= cx + renderDistance; x++) {
      const key = chunkKey(x, z);
      const generated = generatedChunks.get(key);
      if (generated) {
        queueChunkDetailRefreshIfNeeded(key, generated, chunkDetailModeForChunk(x, z));
        continue;
      }
      const preloaded = preloadedChunks.get(key);
      if (preloaded) {
        attachPreloadedChunk(key, preloaded, chunkDetailModeForChunk(x, z));
        continue;
      }
      if (Math.abs(x - cx) <= initialChunkRadius && Math.abs(z - cz) <= initialChunkRadius) {
        generatedChunks.set(key, createChunk(x, z, true, chunkDetailModeForChunk(x, z)));
      } else {
        nextPending.push(key);
      }
    }
  }
  pendingChunkKeys = mergePendingChunkKeys(pendingChunkKeys, nextPending, visibleKeys, cx, cz);

  for (const [key, group] of generatedChunks) {
    if (visibleKeys.has(key)) continue;
    world.remove(group);
    generatedChunks.delete(key);
    disposeGroup(group);
  }

  for (const key of preloadKeys) {
    if (visibleKeys.has(key) || generatedChunks.has(key) || preloadedChunks.has(key)) continue;
    nextPreload.push(key);
  }
  pendingPreloadChunkKeys = mergePendingChunkKeys(pendingPreloadChunkKeys, nextPreload, preloadKeys, cx, cz);

  for (const [key, group] of preloadedChunks) {
    if (preloadKeys.has(key) && !visibleKeys.has(key)) continue;
    preloadedChunks.delete(key);
    if (!generatedChunks.has(key)) disposeGroup(group);
  }
}

function buildPendingChunks() {
  const start = performance.now();
  let built = 0;
  while (pendingChunkKeys.length && built < chunkBuildBudget && performance.now() - start < chunkBuildBudgetMs) {
    const key = pendingChunkKeys.shift();
    if (generatedChunks.has(key) || !isChunkKeyInRenderRange(key)) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    generatedChunks.set(key, createChunk(chunkX, chunkZ, true, chunkDetailModeForChunk(chunkX, chunkZ)));
    built++;
  }

  let refreshed = 0;
  while (
    pendingChunkRefreshKeys.length &&
    refreshed < chunkRefreshBudget &&
    performance.now() - start < chunkBuildBudgetMs
  ) {
    const key = pendingChunkRefreshKeys.shift();
    if (!isChunkKeyInRenderRange(key)) continue;
    const current = generatedChunks.get(key);
    if (!current) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const detailMode = chunkDetailModeForChunk(chunkX, chunkZ);
    if (current.userData.detailMode === detailMode) continue;
    world.remove(current);
    disposeGroup(current);
    generatedChunks.delete(key);
    generatedChunks.set(key, createChunk(chunkX, chunkZ, true, detailMode));
    refreshed++;
  }

  let preloaded = 0;
  while (
    !pendingChunkKeys.length &&
    !pendingChunkRefreshKeys.length &&
    pendingPreloadChunkKeys.length &&
    preloaded < preloadChunkBuildBudget &&
    performance.now() - start < chunkBuildBudgetMs
  ) {
    const key = pendingPreloadChunkKeys.shift();
    if (generatedChunks.has(key) || preloadedChunks.has(key) || !isChunkKeyInPreloadRange(key)) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    preloadedChunks.set(key, createChunk(chunkX, chunkZ, false, "surface"));
    preloaded++;
  }
}

function mergePendingChunkKeys(current, next, visibleKeys, centerChunkX, centerChunkZ) {
  const unique = new Set();
  const merged = [];
  for (const key of [...current, ...next]) {
    if (unique.has(key) || generatedChunks.has(key) || preloadedChunks.has(key) || !visibleKeys.has(key)) continue;
    unique.add(key);
    merged.push(key);
  }
  merged.sort((a, b) => chunkDistanceScore(a, centerChunkX, centerChunkZ) - chunkDistanceScore(b, centerChunkX, centerChunkZ));
  return merged;
}

function collectChunkKeys(centerChunkX, centerChunkZ, radius) {
  const keys = new Set();
  for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
    for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
      keys.add(chunkKey(x, z));
    }
  }
  return keys;
}

function collectSortedViewportChunks(centerChunkX, centerChunkZ, radius) {
  const chunks = [];
  for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
    for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
      chunks.push({ key: chunkKey(x, z), chunkX: x, chunkZ: z });
    }
  }
  chunks.sort((a, b) => (
    Math.hypot(a.chunkX - centerChunkX, a.chunkZ - centerChunkZ) -
    Math.hypot(b.chunkX - centerChunkX, b.chunkZ - centerChunkZ)
  ));
  return chunks;
}

function attachPreloadedChunk(key, group, detailMode) {
  preloadedChunks.delete(key);
  if (group.userData.detailMode !== detailMode) {
    disposeGroup(group);
    const [chunkX, chunkZ] = key.split(",").map(Number);
    generatedChunks.set(key, createChunk(chunkX, chunkZ, true, detailMode));
    return;
  }
  world.add(group);
  generatedChunks.set(key, group);
}

function queueChunkDetailRefreshIfNeeded(key, group, detailMode) {
  if (group.userData.detailMode === detailMode) return;
  if (pendingChunkRefreshKeys.includes(key)) return;
  pendingChunkRefreshKeys.push(key);
}

function chunkDetailModeForChunk(chunkX, chunkZ) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  return Math.abs(chunkX - centerChunkX) <= detailRenderDistance && Math.abs(chunkZ - centerChunkZ) <= detailRenderDistance
    ? "full"
    : "distant";
}

function chunkDistanceScore(key, centerChunkX, centerChunkZ) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  return Math.hypot(chunkX - centerChunkX, chunkZ - centerChunkZ);
}

function generateCloudsAround(center) {
  const radiusInSectors = Math.ceil(cloudRenderRadius / cloudSectorSize);
  const centerSectorX = Math.floor(center.x / cloudSectorSize);
  const centerSectorZ = Math.floor(center.z / cloudSectorSize);
  if (cloudUpdateState.sectorX === centerSectorX && cloudUpdateState.sectorZ === centerSectorZ) return;
  cloudUpdateState.sectorX = centerSectorX;
  cloudUpdateState.sectorZ = centerSectorZ;

  const visibleKeys = new Set();

  for (let z = centerSectorZ - radiusInSectors; z <= centerSectorZ + radiusInSectors; z++) {
    for (let x = centerSectorX - radiusInSectors; x <= centerSectorX + radiusInSectors; x++) {
      const sectorCenterX = (x + 0.5) * cloudSectorSize;
      const sectorCenterZ = (z + 0.5) * cloudSectorSize;
      if (Math.hypot(sectorCenterX - center.x, sectorCenterZ - center.z) > cloudRenderRadius + cloudSectorSize) continue;

      const key = `${x},${z}`;
      visibleKeys.add(key);
      if (generatedCloudSectors.has(key)) continue;

      const group = createCloudSector(x, z);
      generatedCloudSectors.set(key, group);
      if (group) clouds.add(group);
    }
  }

  for (const [key, group] of generatedCloudSectors) {
    if (visibleKeys.has(key)) continue;
    if (group) {
      clouds.remove(group);
      disposeGroup(group);
    }
    generatedCloudSectors.delete(key);
  }
}

function handleWorldClick(event) {
  const hit = pickBlockFromPointer(event);
  const item = heldItem();
  const action = hotbarActions[item.action] ?? hotbarActions.swing;
  action({ event, hit, item });
}

function handlePickaxeClick(hit, pointerType) {
  if (isBlockInMiningArea(hit.block)) {
    clearAutoMove();
    player.selectedBlock = hit.block;
    player.miningContact = createMiningContact(hit);
    faceBlock(hit.block);
    return startMiningSwing(hit.block, hit);
  }

  const target = pointerType === "touch" ? findNavigationTarget(hit) : findAdjacentStandTarget(hit.block, hit.normal);
  if (!target) return false;
  player.selectedBlock = hit.block;
  player.miningContact = null;
  const path = pointerType === "touch" ? findAutoMovePath(target) : [];
  const route = path.length ? path : [target];
  setAutoMovePath(route);
  const first = route[0];
  faceDirection(new THREE.Vector3(first.x - player.position.x, 0, first.z - player.position.z).normalize());
  return false;
}

function findNavigationTarget(hit) {
  if (hit.normal.y > 0.45) {
    const x = THREE.MathUtils.clamp(hit.point.x, hit.block.x - 0.42, hit.block.x + 0.42);
    const z = THREE.MathUtils.clamp(hit.point.z, hit.block.z - 0.42, hit.block.z + 0.42);
    const topTarget = {
      x,
      z,
      y: isWaterVisualBlock(hit.block) ? surfaceHeight(x, z) + 1.01 : hit.block.y + 1.01,
    };
    if (!isColumnBlockedForPlayer(topTarget.x, topTarget.z)) return topTarget;
  }

  const adjacentTarget = findAdjacentStandTarget(hit.block, hit.normal);
  if (!isColumnBlockedForPlayer(adjacentTarget.x, adjacentTarget.z)) return adjacentTarget;
  return null;
}

function findAutoMovePath(target) {
  if (isDirectAutoMovePathClear(target)) return [autoMoveWaypoint(target.x, target.z)];

  const start = {
    x: Math.round(player.position.x),
    z: Math.round(player.position.z),
  };
  const goal = {
    x: Math.round(target.x),
    z: Math.round(target.z),
  };

  if (!isAutoMoveCellWalkable(goal.x, goal.z)) return [];
  if (start.x === goal.x && start.z === goal.z) return [autoMoveWaypoint(target.x, target.z)];

  const open = [{ ...start, g: 0, f: autoPathHeuristic(start, goal), parent: null }];
  const bestByKey = new Map([[autoPathKey(start.x, start.z), open[0]]]);
  const closed = new Set();
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let visited = 0;

  while (open.length && visited < autoPathMaxNodes) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = autoPathKey(current.x, current.z);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    visited++;

    if (current.x === goal.x && current.z === goal.z) {
      return straightenAutoMovePath(buildAutoMovePath(current, target));
    }

    for (const [dx, dz] of directions) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (Math.abs(next.x - start.x) > autoPathSearchRadius || Math.abs(next.z - start.z) > autoPathSearchRadius) continue;
      const nextKey = autoPathKey(next.x, next.z);
      if (closed.has(nextKey)) continue;
      if (!isAutoMoveStepAllowed(current, next)) continue;

      const g = current.g + 1;
      const previous = bestByKey.get(nextKey);
      if (previous && previous.g <= g) continue;
      const node = {
        ...next,
        g,
        f: g + autoPathHeuristic(next, goal),
        parent: current,
      };
      bestByKey.set(nextKey, node);
      open.push(node);
    }
  }

  return [];
}

function isDirectAutoMovePathClear(target, from = player.position) {
  if (!target) return false;
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return isAutoMoveCellWalkable(target.x, target.z);

  const steps = Math.max(1, Math.ceil(distance / autoDirectPathSampleSpacing));
  let previousHeight = surfaceHeight(from.x, from.z);
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    const x = from.x + dx * t;
    const z = from.z + dz * t;
    if (!isAutoMoveCellWalkable(x, z)) return false;

    const height = surfaceHeight(x, z);
    const delta = height - previousHeight;
    const nearTarget = distance * (1 - t) < 2.6;
    const climbLimit = nearTarget ? autoJumpHeight : autoStepHeight;
    if (delta > climbLimit || delta < -4) return false;
    previousHeight = height;
  }

  return true;
}

function straightenAutoMovePath(path) {
  if (!Array.isArray(path) || path.length <= 1) return path;
  const straightened = [];
  let anchor = player.position;
  let index = 0;

  while (index < path.length) {
    let nextIndex = index;
    for (let candidate = path.length - 1; candidate > index; candidate--) {
      if (isDirectAutoMovePathClear(path[candidate], anchor)) {
        nextIndex = candidate;
        break;
      }
    }
    straightened.push(path[nextIndex]);
    anchor = path[nextIndex];
    index = nextIndex + 1;
  }

  return straightened;
}

function buildAutoMovePath(goalNode, target) {
  const cells = [];
  for (let node = goalNode; node; node = node.parent) cells.push(node);
  cells.reverse();
  const waypoints = cells.slice(1).map((cell) => autoMoveWaypoint(cell.x, cell.z));
  if (!waypoints.length) return [autoMoveWaypoint(target.x, target.z)];
  const last = waypoints[waypoints.length - 1];
  last.x = target.x;
  last.z = target.z;
  last.y = surfaceHeight(target.x, target.z) + 1.01;
  return waypoints;
}

function autoMoveWaypoint(x, z) {
  return { x, z, y: surfaceHeight(x, z) + 1.01 };
}

function autoPathHeuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function autoPathKey(x, z) {
  return `${x},${z}`;
}

function isAutoMoveStepAllowed(from, to) {
  if (!isAutoMoveCellWalkable(to.x, to.z)) return false;
  const fromHeight = surfaceHeight(from.x, from.z);
  const toHeight = surfaceHeight(to.x, to.z);
  const delta = toHeight - fromHeight;
  if (delta > autoJumpHeight) return false;
  if (delta < -4) return false;
  return true;
}

function isAutoMoveCellWalkable(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const groundY = surfaceHeight(x, z) + 1.01;
  if (playerBodyCollides(x, z, groundY)) return false;
  return !hasWaterAt(worldState, Math.round(x), Math.floor(groundY), Math.round(z));
}

function pickBlockFromPointer(event) {
  return pickBlockAtClientPoint(event.clientX, event.clientY, clickRaycaster);
}

function pickBlockAtClientPoint(clientX, clientY, raycaster) {
  const rect = canvas.getBoundingClientRect();
  const pointer = {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
  raycaster.setFromCamera(pointer, camera);
  raycaster.far = 120;
  const hits = raycaster.intersectObjects(world.children, true);

  for (const hit of hits) {
    const blocks = hit.object.userData.blocks;
    const block = blocks?.[hit.instanceId];
    if (!block || removedBlocks.has(block.key)) continue;
    const normal = hit.face?.normal?.clone() ?? new THREE.Vector3(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld);
    return { block, point: hit.point.clone(), normal };
  }

  return null;
}

function placementTargetFromHit(hit) {
  if (!hit) return null;
  const normal = hit.normal.clone();
  const dx = Math.round(normal.x);
  const dy = Math.round(normal.y);
  const dz = Math.round(normal.z);
  return {
    x: hit.block.x + dx,
    y: hit.block.y + dy,
    z: hit.block.z + dz,
  };
}

function canPlaceBlockAt(target) {
  if (!target) return false;
  if (!isPlacementTargetInRange(target)) return false;
  if (isSolidCell(target.x, target.y, target.z)) return false;
  if (wouldBlockIntersectPlayer(target)) return false;
  return true;
}

function isPlacementTargetInRange(target) {
  const dx = target.x - player.position.x;
  const dy = target.y - player.position.y;
  const dz = target.z - player.position.z;
  return dx * dx + dy * dy + dz * dz <= placementReach * placementReach;
}

function placeHeldBlock(hit, type) {
  const target = placementTargetFromHit(hit);
  if (!canPlaceBlockAt(target)) {
    startHandSwing();
    return false;
  }
  const key = blockKey(target.x, target.y, target.z);
  worldState.dynamicWater.delete(key);
  removedBlocks.delete(key);
  blockDamage.delete(key);
  placedBlocks.set(key, type);
  solidBlocks.add(key);
  startHandSwing();
  rebuildChunksAroundBlock(target);
  updatePlacementPreview(target, true);
  submitPlacedBlockToChain(target, type);
  return true;
}

function updatePlacementPreviewFromPointer(event) {
  if (!isPlacementAction(heldItem())) {
    placementPreview.visible = false;
    return;
  }
  const hit = pickBlockAtClientPoint(event.clientX, event.clientY, previewRaycaster);
  const target = placementTargetFromHit(hit);
  updatePlacementPreview(target, canPlaceBlockAt(target));
}

function updatePlacementPreview(target, valid) {
  placementPreview.visible = Boolean(target && valid && isPlacementAction(heldItem()));
  if (!placementPreview.visible) return;
  placementPreview.position.set(target.x, target.y, target.z);
}

function isPlacementAction(item) {
  return item.action === "placeBlock" || item.action === "placePlant";
}

function placeHeldPlant(hit, type) {
  const target = placementTargetFromHit(hit);
  if (!canPlaceBlockAt(target)) {
    startHandSwing();
    return false;
  }
  const belowKey = blockKey(target.x, target.y - 1, target.z);
  if (!solidBlocks.has(belowKey) || removedBlocks.has(belowKey)) {
    startHandSwing();
    return false;
  }
  const stemKey = blockKey(target.x, target.y, target.z);
  const flowerKey = blockKey(target.x, target.y + 1, target.z);
  if (isSolidCell(target.x, target.y + 1, target.z) || wouldBlockIntersectPlayer({ x: target.x, y: target.y + 1, z: target.z })) {
    startHandSwing();
    return false;
  }
  removedBlocks.delete(stemKey);
  removedBlocks.delete(flowerKey);
  placedBlocks.set(stemKey, "flowerStem");
  placedBlocks.set(flowerKey, type);
  solidBlocks.add(stemKey);
  solidBlocks.add(flowerKey);
  startHandSwing();
  rebuildChunksAroundBlock(target);
  updatePlacementPreview(target, true);
  return true;
}

function wouldBlockIntersectPlayer(target) {
  const minX = target.x - 0.5;
  const maxX = target.x + 0.5;
  const minZ = target.z - 0.5;
  const maxZ = target.z + 0.5;
  const minY = target.y - 0.5;
  const maxY = target.y + 0.5;
  const playerMinX = player.position.x - playerRadius;
  const playerMaxX = player.position.x + playerRadius;
  const playerMinZ = player.position.z - playerRadius;
  const playerMaxZ = player.position.z + playerRadius;
  const playerMinY = player.position.y - 1.01;
  const playerMaxY = player.position.y + playerBodyTopOffset;
  return (
    minX < playerMaxX &&
    maxX > playerMinX &&
    minZ < playerMaxZ &&
    maxZ > playerMinZ &&
    minY < playerMaxY &&
    maxY > playerMinY
  );
}

function findAdjacentStandTarget(block, normal) {
  const fromNormal = horizontalStandDirection(normal);
  const fromPlayer = new THREE.Vector3(player.position.x - block.x, 0, player.position.z - block.z);
  const playerSide =
    Math.abs(fromPlayer.x) > Math.abs(fromPlayer.z)
      ? new THREE.Vector3(Math.sign(fromPlayer.x || 1), 0, 0)
      : new THREE.Vector3(0, 0, Math.sign(fromPlayer.z || 1));
  const directions = [
    fromNormal,
    playerSide,
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ].filter((direction) => direction !== null);
  const candidates = directions.map((direction) => ({
    x: block.x + direction.x * miningStandDistance,
    z: block.z + direction.z * miningStandDistance,
  }));

  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - player.position.x, a.z - player.position.z) -
      Math.hypot(b.x - player.position.x, b.z - player.position.z),
  );
  const best = candidates.find((candidate) => !isColumnBlockedForPlayer(candidate.x, candidate.z)) ?? candidates[0];
  return { x: best.x, z: best.z };
}

function horizontalStandDirection(normal) {
  if (Math.abs(normal.x) > Math.abs(normal.z) && Math.abs(normal.x) > 0.01) {
    return new THREE.Vector3(Math.sign(normal.x), 0, 0);
  }
  if (Math.abs(normal.z) > 0.01) {
    return new THREE.Vector3(0, 0, Math.sign(normal.z));
  }
  return null;
}

function isColumnBlockedForPlayer(x, z) {
  return playerBodyCollides(x, z, surfaceHeight(x, z) + 1.01);
}

function isWaterVisualBlock(block) {
  return block?.type === "water" || block?.type === "swampWater" || block?.type === "toxicWater";
}

function isBlockInMiningArea(block) {
  if (isMiningBlockedByWater(block)) return false;
  const playerCellX = Math.round(player.position.x);
  const playerCellZ = Math.round(player.position.z);
  const feetY = playerFeetBlockY();
  return (
    Math.abs(block.x - playerCellX) <= miningHorizontalRadius &&
    Math.abs(block.z - playerCellZ) <= miningHorizontalRadius &&
    block.y >= feetY - miningReachDown &&
    block.y <= feetY + miningReachUp
  );
}

function isMiningBlockedByWater(block) {
  if (!block) return true;
  if (isWaterVisualBlock(block)) return true;
  return hasWaterAt(worldState, block.x, block.y + 1, block.z);
}

function playerFeetBlockY() {
  return Math.floor(player.position.y - 1.01);
}

function avatarForward() {
  return new THREE.Vector3(-Math.sin(avatar.rotation.y), 0, -Math.cos(avatar.rotation.y)).normalize();
}

function createChunk(chunkX, chunkZ, attach = true, detailMode = chunkDetailModeForChunk(chunkX, chunkZ)) {
  ensureKnownChunk(chunkX, chunkZ);
  const group = createChunkGroup({ THREE, chunkX, chunkZ, state: worldState, geometryByType, materials, detailMode });
  if (attach) world.add(group);
  return group;
}

function updateChunkChainViewportSync() {
  if (!isNicechunkChainFeatureEnabled()) return;
  if (chunkChainViewportLoading) return;
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const centerKey = chunkKey(centerChunkX, centerChunkZ);
  const centerUnchanged = centerKey === chunkChainViewportCenterKey;

  const now = performance.now();
  const visibleKeys = collectChunkKeys(centerChunkX, centerChunkZ, renderDistance);
  const chunksToLoad = [];
  for (const chunk of collectSortedViewportChunks(centerChunkX, centerChunkZ, renderDistance)) {
    const { key, chunkX, chunkZ } = chunk;
    const current = chunkChainSync.get(key);
    if (current?.loading) continue;
    if (current?.loadedAt && !current?.failedAt) continue;
    if (current?.failedAt && now - current.failedAt < chunkChainSyncRetryMs) continue;
    chunkChainSync.set(key, {
      loading: true,
      loadedAt: current?.loadedAt ?? 0,
      failedAt: 0,
      appliedSequence: current?.appliedSequence ?? 0,
      chunkX,
      chunkZ,
    });
    chunksToLoad.push({ key, chunkX, chunkZ });
  }

  if (centerUnchanged && !chunksToLoad.length) return;
  chunkChainViewportCenterKey = centerKey;

  if (!chunksToLoad.length) {
    pruneChunkChainSyncCache(visibleKeys);
    return;
  }

  chunkChainViewportLoading = true;
  loadNicechunkChainModule()
    .then(({ loadChunkBlockDeltasBatch }) => loadChunkBlockDeltasBatch(chunksToLoad, { batchSize: chunkChainSyncBatchSize }))
    .then(async (deltasByChunk) => {
      const loadedAt = performance.now();
      for (const chunk of chunksToLoad) {
        const deltas = deltasByChunk.get(chunk.key) ?? [];
        const maxSequence = deltas.reduce((max, delta) => Math.max(max, delta.sequence), 0);
        const previous = chunkChainSync.get(chunk.key);
        const changed = await applyChunkChainDeltas(deltas, previous?.appliedSequence ?? 0);
        chunkChainSync.set(chunk.key, {
          ...chunk,
          loading: false,
          loadedAt,
          failedAt: 0,
          appliedSequence: Math.max(previous?.appliedSequence ?? 0, maxSequence),
        });
        if (changed) rebuildChunkByKey(chunk.key);
      }
      pruneChunkChainSyncCache(visibleKeys);
    })
    .catch((error) => {
      console.warn("Failed to load NiceChunk chunk PDA viewport", error);
      const failedAt = performance.now();
      for (const chunk of chunksToLoad) {
        const previous = chunkChainSync.get(chunk.key);
        chunkChainSync.set(chunk.key, {
          ...chunk,
          loading: false,
          loadedAt: previous?.loadedAt ?? 0,
          failedAt,
          appliedSequence: previous?.appliedSequence ?? 0,
        });
      }
    })
    .finally(() => {
      chunkChainViewportLoading = false;
    });
}

function pruneChunkChainSyncCache(visibleKeys) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const cacheRadius = renderDistance + 2;
  for (const key of [...chunkChainSync.keys()]) {
    if (visibleKeys.has(key)) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    if (Math.abs(chunkX - centerChunkX) <= cacheRadius && Math.abs(chunkZ - centerChunkZ) <= cacheRadius) continue;
    chunkChainSync.delete(key);
  }
}

async function applyChunkChainDeltas(deltas, appliedSequence = 0) {
  if (!deltas.length) return false;
  const { renderTypeForBlockId } = await loadNicechunkChainModule();
  let changed = false;
  for (const delta of deltas) {
    if (delta.sequence <= appliedSequence) continue;
    const key = blockKey(delta.x, delta.y, delta.z);
    if (delta.action === 1 && delta.newBlockId === 0) {
      if (!removedBlocks.has(key)) changed = true;
      removedBlocks.add(key);
      blockDamage.delete(key);
      solidBlocks.delete(key);
      placedBlocks.delete(key);
      continue;
    }
    if (delta.action === 2 && delta.newBlockId !== 0) {
      const renderType = renderTypeForBlockId(delta.newBlockId);
      if (!renderType) continue;
      if (placedBlocks.get(key) !== renderType || removedBlocks.has(key) || !solidBlocks.has(key)) changed = true;
      removedBlocks.delete(key);
      blockDamage.delete(key);
      placedBlocks.set(key, renderType);
      solidBlocks.add(key);
    }
  }
  return changed;
}

function updateRealtimeChunkSubscription() {
  if (realtimeChunkSubscription) realtimeChunkSubscription();
  realtimeChunkSubscription = null;
  realtimeChunkKey = null;
  realtimeChunkAppliedSequence = 0;
}

function ensureKnownChunk(chunkX, chunkZ) {
  const key = chunkKey(chunkX, chunkZ);
  if (knownChunks.has(key)) return knownChunks.get(key);
  const data = createKnownChunkData(chunkX, chunkZ);
  knownChunks.set(key, data);
  return data;
}

function createKnownChunkData(chunkX, chunkZ) {
  const tile = document.createElement("canvas");
  tile.width = chunkSize;
  tile.height = chunkSize;
  const context = tile.getContext("2d", { willReadFrequently: true });
  const data = { chunkX, chunkZ, tile, context };
  refreshKnownChunkData(data);
  return data;
}

function createKnownChunkDataFromStorage(chunkX, chunkZ, pixels) {
  const tile = document.createElement("canvas");
  tile.width = chunkSize;
  tile.height = chunkSize;
  const context = tile.getContext("2d", { willReadFrequently: true });
  const data = { chunkX, chunkZ, tile, context };
  const image = context.createImageData(chunkSize, chunkSize);
  fillImageDataFromHex(image, pixels);
  context.putImageData(image, 0, 0);
  return data;
}

function refreshKnownChunkByKey(key) {
  const data = knownChunks.get(key);
  if (data) {
    refreshKnownChunkData(data);
    return;
  }
  const [chunkX, chunkZ] = key.split(",").map(Number);
  ensureKnownChunk(chunkX, chunkZ);
}

function refreshKnownChunkData(data) {
  const image = data.context.createImageData(chunkSize, chunkSize);
  for (let localZ = 0; localZ < chunkSize; localZ++) {
    for (let localX = 0; localX < chunkSize; localX++) {
      const x = data.chunkX * chunkSize + localX;
      const z = data.chunkZ * chunkSize + localZ;
      const color = minimapCellColor(x, z);
      const offset = (localZ * chunkSize + localX) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  data.context.putImageData(image, 0, 0);
  markKnownMapDirty();
}

function markKnownMapDirty() {
  minimapSaveState.dirty = true;
}

function scheduleKnownChunkRestore() {
  window.setTimeout(queueKnownChunkRestore, 0);
}

function queueKnownChunkRestore() {
  try {
    const raw = localStorage.getItem(minimapStorageKey);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (!stored || stored.version !== 1 || !stored.chunks) return;

    knownChunkRestoreState.pending = Object.entries(stored.chunks).filter(
      ([, entry]) => entry && Number.isFinite(entry.chunkX) && Number.isFinite(entry.chunkZ) && typeof entry.pixels === "string",
    );
    knownChunkRestoreState.loading = knownChunkRestoreState.pending.length > 0;
    minimapState.largeScale = THREE.MathUtils.clamp(
      Number(stored.largeScale) || minimapState.largeScale,
      largeMinimapMinScale,
      largeMinimapMaxScale,
    );
  } catch {
    knownChunkRestoreState.pending = [];
    knownChunkRestoreState.loading = false;
    localStorage.removeItem(minimapStorageKey);
  }
}

function restoreKnownChunksBudgeted() {
  if (!knownChunkRestoreState.pending.length) {
    knownChunkRestoreState.loading = false;
    return;
  }

  const start = performance.now();
  let restored = 0;
  while (knownChunkRestoreState.pending.length && restored < 12 && performance.now() - start < 5) {
    const [key, entry] = knownChunkRestoreState.pending.shift();
    if (!knownChunks.has(key)) {
      knownChunks.set(key, createKnownChunkDataFromStorage(entry.chunkX, entry.chunkZ, entry.pixels));
    }
    restored++;
  }
  knownChunkRestoreState.loading = knownChunkRestoreState.pending.length > 0;
}

function saveKnownChunksToStorage(force = false) {
  if (!minimapSaveState.dirty && !force) return;
  if (knownChunkRestoreState.loading) return;
  const now = performance.now();
  if (!force && now - minimapSaveState.lastSaveAt < 1500) return;

  try {
    const entries = Array.from(knownChunks.entries())
      .sort(([, a], [, b]) => distanceToPlayerChunk(a) - distanceToPlayerChunk(b))
      .slice(0, maxStoredKnownChunks);
    const chunks = {};
    for (const [key, data] of entries) {
      chunks[key] = {
        chunkX: data.chunkX,
        chunkZ: data.chunkZ,
        pixels: imageDataToHex(data.context.getImageData(0, 0, chunkSize, chunkSize)),
      };
    }
    localStorage.setItem(
      minimapStorageKey,
      JSON.stringify({
        version: 1,
        largeScale: minimapState.largeScale,
        savedAt: Date.now(),
        chunks,
      }),
    );
    minimapSaveState.dirty = false;
    minimapSaveState.lastSaveAt = now;
  } catch {
    minimapSaveState.dirty = false;
  }
}

function distanceToPlayerChunk(data) {
  const centerX = data.chunkX * chunkSize + chunkSize * 0.5;
  const centerZ = data.chunkZ * chunkSize + chunkSize * 0.5;
  return Math.hypot(centerX - player.position.x, centerZ - player.position.z);
}

function imageDataToHex(image) {
  let hex = "";
  for (let i = 0; i < image.data.length; i += 4) {
    hex += byteToHex(image.data[i]) + byteToHex(image.data[i + 1]) + byteToHex(image.data[i + 2]);
  }
  return hex;
}

function fillImageDataFromHex(image, hex) {
  const expectedLength = chunkSize * chunkSize * 6;
  if (hex.length !== expectedLength) return;
  let source = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = Number.parseInt(hex.slice(source, source + 2), 16);
    image.data[i + 1] = Number.parseInt(hex.slice(source + 2, source + 4), 16);
    image.data[i + 2] = Number.parseInt(hex.slice(source + 4, source + 6), 16);
    image.data[i + 3] = 255;
    source += 6;
  }
}

function byteToHex(value) {
  return value.toString(16).padStart(2, "0");
}

function minimapCellColor(x, z) {
  const profile = terrainProfile(x, z);
  let topY = profile.height;
  let topType = profile.fluid ?? (topY < seaLevel ? WorldMapBlock.Water : profile.terrain);
  const terrainKey = blockKey(x, topY, z);
  if (removedBlocks.has(terrainKey)) {
    topY -= 1;
    topType = topY < terrainHeight(x, z) - 2 ? WorldMapBlock.Stone : WorldMapBlock.Dirt;
  }

  for (const [key, type] of placedBlocks) {
    if (removedBlocks.has(key)) continue;
    const [px, py, pz] = key.split(",").map(Number);
    if (px === x && pz === z && py >= topY) {
      topY = py;
      topType = type;
    }
  }

  return minimapColorForType(topType, topY);
}

function minimapColorForType(type, y) {
  const shade = THREE.MathUtils.clamp((y - 3) * 4, -22, 34);
  if (typeof type === "number") {
    const base = hexToRgb(WORLD_MAP_BLOCK_DEBUG_COLOR[type] ?? WORLD_MAP_BLOCK_DEBUG_COLOR[WorldMapBlock.Grass]);
    return base.map((channel) => THREE.MathUtils.clamp(channel + shade, 0, 255));
  }
  const colors = {
    water: [54, 126, 184],
    sand: [202, 186, 112],
    sandstone: [178, 139, 82],
    snow: [225, 238, 242],
    grass: [88, 158, 67],
    dirt: [126, 82, 47],
    stone: [128, 132, 124],
    trunk: [115, 72, 39],
    trunkDark: [82, 50, 32],
    leaves: [54, 130, 55],
    leavesDark: [37, 105, 55],
    leavesLight: [106, 176, 70],
    leavesTeal: [34, 146, 124],
    leavesWarm: [100, 152, 62],
    pineLeaves: [30, 96, 80],
    snowLeaves: [190, 218, 216],
    flowerStem: [62, 142, 50],
    flowerRed: [206, 72, 72],
    flowerYellow: [226, 196, 70],
    flowerBlue: [88, 136, 218],
    flowerWhite: [230, 226, 205],
  };
  const base = colors[type] ?? colors.grass;
  return base.map((channel) => THREE.MathUtils.clamp(channel + shade, 0, 255));
}

function hexToRgb(hex) {
  const value = Number.parseInt(String(hex).replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function createCloudSector(sectorX, sectorZ) {
  return createCloudSectorGroup({
    THREE,
    sectorX,
    sectorZ,
    geometry: geometryByType.cloud,
    material: materials.cloud,
  });
}

function startMiningSwing(targetBlock = null, targetHit = null) {
  if (targetBlock) player.selectedBlock = targetBlock;
  if (!player.selectedBlock || !isBlockInMiningArea(player.selectedBlock)) return false;
  if (isUnbreakableBlock(player.selectedBlock)) return false;
  if (!hasEquippedBackpack()) {
    const row = appendChainEventLog(
      "warn",
      gameText("main.chainLog.noBackpackTitle", "Backpack required"),
      gameText("main.chainLog.noBackpackDetail", "Buy and equip a backpack before mining {coords}", {
        coords: formatBlockCoords(player.selectedBlock),
      }),
      { block: player.selectedBlock },
    );
    scheduleChainEventLogRemoval(row);
    return false;
  }
  player.miningSwing = performance.now() + miningSwingDuration;
  player.miningHitDone = false;
  player.miningTargetHit = targetHit ? cloneMiningHit(targetHit) : null;
  player.miningContact = null;
  player.miningPreviousToolBoxes = null;
  sendGuardianDig(player.selectedBlock, 1);
  return true;
}

function cloneMiningHit(hit) {
  return {
    block: hit.block,
    point: hit.point.clone(),
    normal: hit.normal.clone(),
  };
}

function applyMiningDamage(hit) {
  const nextDamage = (blockDamage.get(hit.block.key) ?? 0) + 1;
  const requiredDamage = debugMiningEnabled ? 1 : 3;
  blockDamage.set(hit.block.key, nextDamage);
  player.miningContact = createMiningContact(hit);
  spawnHitParticles(hit.block, hit.point, hit.normal, nextDamage);

  if (nextDamage >= requiredDamage) {
    blockDamage.delete(hit.block.key);
    removedBlocks.add(hit.block.key);
    solidBlocks.delete(hit.block.key);
    player.miningContact = null;
    crackMarker.visible = false;
    spawnBreakParticles(hit.block);
    rebuildChunkForBlock(hit.block);
    flowWaterFromBreak(hit.block);
    sendGuardianDig(hit.block, 3);
    submitMinedBlockToChain(hit.block);
    if (!isNicechunkChainFeatureEnabled()) {
      const discovery = simulateResourceDiscovery({ block: hit.block, debug: debugMiningEnabled });
      if (addResourceToHotbar(hotbarSlots, hotbarItems, discovery.resourceId, discovery.amount, maxStackSize)) {
        renderHotbar();
        updateEquippedItem();
      }
    }
    return true;
  }
  return true;
}

function updateMiningToolCollision() {
  const now = performance.now();
  const remaining = Math.max(0, player.miningSwing - now);
  if (remaining <= 0) {
    player.miningPreviousToolBoxes = null;
    player.miningTargetHit = null;
    return;
  }
  if (player.miningHitDone || !player.selectedBlock) return;
  if (!isBlockInMiningArea(player.selectedBlock) || isUnbreakableBlock(player.selectedBlock)) return;
  if (removedBlocks.has(player.selectedBlock.key) || !solidBlocks.has(player.selectedBlock.key)) return;

  avatar.updateMatrixWorld(true);
  const boxes = miningToolCollisionBoxes();
  if (!boxes.length) return;

  const progress = 1 - remaining / miningSwingDuration;
  const previousBoxes = player.miningPreviousToolBoxes;
  player.miningPreviousToolBoxes = boxes.map((box) => box.clone());
  if (progress < miningCollisionStartProgress) return;

  const blockBox = blockCollisionBox(player.selectedBlock, miningBlockCollisionPadding);
  for (let index = 0; index < boxes.length; index++) {
    const sweptBox = boxes[index].clone();
    if (previousBoxes?.[index]) sweptBox.union(previousBoxes[index]);
    if (!sweptBox.intersectsBox(blockBox)) continue;
    player.miningHitDone = true;
    player.miningPreviousToolBoxes = null;
    applyMiningDamage(createToolCollisionMiningHit(player.selectedBlock, sweptBox));
    return;
  }
}

function miningToolCollisionBoxes() {
  const item = heldItem();
  if (item.hand === "forged" && equippedForgedMesh?.visible) {
    const box = objectWorldBox(equippedForgedMesh);
    return box ? [box] : [];
  }

  const { rightTool } = avatar.userData.limbs;
  if (item.hand !== "pickaxe" || !rightTool?.visible) return [];
  return ["toolHead", "toolTipTop", "toolTipBottom"]
    .map((name) => objectWorldBox(rightTool.getObjectByName(name)))
    .filter(Boolean);
}

function objectWorldBox(object) {
  if (!object) return null;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  return box;
}

function blockCollisionBox(block, padding = 0) {
  return new THREE.Box3(
    new THREE.Vector3(block.x - 0.5 - padding, block.y - 0.5 - padding, block.z - 0.5 - padding),
    new THREE.Vector3(block.x + 0.5 + padding, block.y + 0.5 + padding, block.z + 0.5 + padding),
  );
}

function createToolCollisionMiningHit(block, toolBox) {
  const targetHit = player.miningTargetHit?.block?.key === block.key ? player.miningTargetHit : createMiningHitFromSelectedBlock(block);
  const point = clampPointToBox(toolBox.getCenter(new THREE.Vector3()), blockCollisionBox(block));
  return {
    block,
    point,
    normal: targetHit.normal.clone(),
  };
}

function clampPointToBox(point, box) {
  return new THREE.Vector3(
    THREE.MathUtils.clamp(point.x, box.min.x, box.max.x),
    THREE.MathUtils.clamp(point.y, box.min.y, box.max.y),
    THREE.MathUtils.clamp(point.z, box.min.z, box.max.z),
  );
}

function submitMinedBlockToChain(block) {
  const coords = formatBlockCoords(block);
  if (!isNicechunkChainFeatureEnabled()) {
    const row = appendChainEventLog("warn", gameText("main.chainLog.mineSkipped", "Mining sync skipped"), gameText("main.chainLog.disabled", "On-chain sync is disabled for {coords}", { coords }));
    scheduleChainEventLogRemoval(row);
    return;
  }
  let logEntry = null;
  loadNicechunkChainModule().then(async (chainModule) => {
    const ready = await ensureGameplaySessionFundingForMining(chainModule);
    if (!ready) return { submitted: false, reason: "session-funding-cancelled" };
    logEntry = appendChainEventLog("info", gameText("main.chainLog.minePending", "Mining submitted, awaiting confirmation"), gameText("main.chainLog.minePendingDetail", "Submitting {coords} to devnet", { coords }), { block });
    return chainModule.recordBlockBreakOnChain(block, selectedHotbarSlot);
  }).then((result) => {
    if (!result?.submitted) {
      const reason = chainSubmitReasonLabel(result?.reason);
      if (result?.reason === "already-mined") {
        logEntry = updateChainEventLog(logEntry, "warn", gameText("main.chainLog.alreadyMined", "Block already recorded"), gameText("main.chainLog.mineSkippedDetail", "{coords}: {reason}", { coords, reason }));
        scheduleChainEventLogRemoval(logEntry);
        return;
      }
      restoreMinedBlockAfterSubmitFailure(block);
      logEntry = updateChainEventLog(logEntry, "warn", gameText("main.chainLog.mineSkipped", "Mining sync skipped"), gameText("main.chainLog.mineSkippedDetail", "{coords}: {reason}", { coords, reason }));
      scheduleChainEventLogRemoval(logEntry);
      return;
    }
    updateChainEventLog(logEntry, "success", gameText("main.chainLog.mineSubmitted", "Mining confirmed"), gameText("main.chainLog.signature", "{coords}: {signature}", {
      coords,
      signature: shortSignature(result.signature),
    }));
    animateChainBlockToBackpack(logEntry);
    void refreshGameplaySessionHud({ force: true });
    void refreshEquippedBackpack({ force: true });
  }).catch((error) => {
    console.warn("Failed to record block break on NiceChunk chunk PDA", error);
    const kind = isBlockAlreadyMinedError(error) ? "warn" : "error";
    const title = isBlockAlreadyMinedError(error)
      ? gameText("main.chainLog.alreadyMined", "Block already recorded")
      : gameText("main.chainLog.mineFailed", "Mining transaction failed");
    if (!isBlockAlreadyMinedError(error)) restoreMinedBlockAfterSubmitFailure(block);
    if (!logEntry) {
      const failedLogEntry = appendChainEventLog(kind, title, gameText("main.chainLog.mineFailedDetail", "{coords}: {reason}", {
        coords,
        reason: readableChainError(error),
      }), { block });
      scheduleChainEventLogRemoval(failedLogEntry);
      return;
    }
    logEntry = updateChainEventLog(logEntry, kind, title, gameText("main.chainLog.mineFailedDetail", "{coords}: {reason}", {
      coords,
      reason: readableChainError(error),
    }));
    scheduleChainEventLogRemoval(logEntry);
  });
}

function restoreMinedBlockAfterSubmitFailure(block) {
  if (!block?.key || !removedBlocks.has(block.key)) return;
  removedBlocks.delete(block.key);
  blockDamage.delete(block.key);
  worldState.dynamicWater.delete(block.key);
  solidBlocks.add(block.key);
  rebuildChunksAroundBlock(block);
}

function submitPlacedBlockToChain(target, type) {
  if (!isNicechunkChainFeatureEnabled()) return;
  loadNicechunkChainModule().then(({ recordBlockPlacementOnChain }) => {
    return recordBlockPlacementOnChain(target, type, selectedHotbarSlot);
  }).catch((error) => {
    console.warn("Failed to record block placement on NiceChunk chunk PDA", error);
  });
}

function appendChainEventLog(kind, title, detail, options = {}) {
  if (!chainEventLog) return;
  const row = document.createElement("div");
  row.className = "chain-event-row";
  row.dataset.kind = kind;
  if (options.block?.type) {
    row.append(createChainEventBlockPreview(options.block.type, { block: options.block }));
  }
  const copy = document.createElement("div");
  copy.className = "chain-event-copy";
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const detailEl = document.createElement("span");
  detailEl.textContent = detail;
  copy.append(titleEl, detailEl);
  row.append(copy);
  chainEventLog.prepend(row);
  while (chainEventLog.children.length > chainEventLogMaxRows) {
    removeChainEventLogRow(chainEventLog.lastElementChild);
  }
  return row;
}

function createChainEventBlockPreview(blockType, {
  className = "chain-event-block-preview",
  canvasClassName = "chain-event-block-canvas",
  rotating = true,
  block = null,
  immediate = false,
} = {}) {
  const preview = document.createElement("div");
  preview.className = className;
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = canvasClassName;
  previewCanvas.width = chainBlockPreviewSize;
  previewCanvas.height = chainBlockPreviewSize;
  preview.append(previewCanvas);

  if (!rotating && !immediate) {
    const previewItem = queueStaticBlockPreviewRender({ canvas: previewCanvas, blockType, block });
    preview.__nicechunkCleanup = () => {
      previewItem.cleanup();
    };
    return preview;
  }

  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  previewCamera.position.set(2.45, 1.9, 2.7);
  previewCamera.lookAt(0, 0, 0);
  previewScene.add(new THREE.HemisphereLight(0xf4fbff, 0x526044, 2.8));
  const keyLight = new THREE.DirectionalLight(0xfff2bf, 2.2);
  keyLight.position.set(-3.4, 4.2, 3.8);
  previewScene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7be8ff, 0.5);
  fillLight.position.set(3, 2, -2);
  previewScene.add(fillLight);

  const mesh = createBlockPreviewObject(blockType, block);
  previewScene.add(mesh);

  const previewItem = registerChainBlockPreviewRender({
    canvas: previewCanvas,
    scene: previewScene,
    camera: previewCamera,
    mesh,
    rotating,
  });
  preview.__nicechunkCleanup = () => {
    previewItem.cleanup();
  };
  return preview;
}

function createBlockPreviewObject(blockType, block = null) {
  const type = materials[blockType] ? blockType : "stone";
  const group = new THREE.Group();
  group.name = `block-preview:${type}`;

  if (isShortWaterPreviewType(type)) {
    const mesh = createPreviewMesh(type, block);
    mesh.position.y = -1 / 6;
    mesh.scale.set(1, 2 / 3, 1);
    group.add(mesh);
    return group;
  }

  if (type === "lava") {
    const mesh = createPreviewMesh(type, block);
    mesh.scale.set(1.12, 1, 1.12);
    group.add(mesh);
    return group;
  }

  if (isSurfacePlanePreviewType(type)) {
    addPreviewPlane(group, type, block, 0, 0.02, 0, 0.68, 0.46, 0.35);
    addPreviewPlane(group, type, block, 0, 0.03, 0, 0.46, 0.68, -0.35);
    return group;
  }

  if (type === "reed") {
    addPreviewBox(group, "reedStem", block, -0.12, 0.08, 0.02, 0.08, 0.78, 0.08);
    addPreviewBox(group, "reedTip", block, -0.12, 0.55, 0.02, 0.12, 0.18, 0.12);
    addPreviewBox(group, "reedStem", block, 0.12, 0.02, -0.04, 0.08, 0.62, 0.08);
    return group;
  }

  if (type === "mushroom") {
    addPreviewBox(group, "mushroomStem", block, 0, -0.12, 0, 0.14, 0.38, 0.14);
    addPreviewBox(group, "mushroomCap", block, 0, 0.12, 0, 0.48, 0.16, 0.48);
    return group;
  }

  if (type === "cactus") {
    addPreviewBox(group, "cactus", block, 0, 0, 0, 0.48, 1.18, 0.48);
    addPreviewBox(group, "cactus", block, -0.38, 0.08, 0, 0.22, 0.52, 0.22);
    addPreviewBox(group, "cactus", block, 0.38, 0.2, 0, 0.22, 0.46, 0.22);
    return group;
  }

  if (isBushPreviewType(type)) {
    const branch = type === "deadBush" ? "deadWood" : type === "snowBush" ? "pineTrunk" : "trunkDark";
    addPreviewBox(group, branch, block, -0.16, -0.06, 0.02, 0.12, 0.58, 0.12, 0.3);
    addPreviewBox(group, branch, block, 0.15, -0.1, -0.04, 0.1, 0.52, 0.1, -0.34);
    addPreviewBox(group, type, block, 0, 0.16, 0, 0.82, 0.58, 0.62);
    addPreviewBox(group, type, block, -0.16, 0.3, 0.12, 0.46, 0.4, 0.42);
    return group;
  }

  if (type === "coral" || type === "deadCoral") {
    addPreviewBox(group, type, block, 0, -0.16, 0, 0.18, 0.74, 0.18);
    addPreviewBox(group, type, block, -0.18, 0.06, 0, 0.14, 0.44, 0.14, -0.55);
    addPreviewBox(group, type, block, 0.2, 0.12, 0.02, 0.14, 0.38, 0.14, 0.55);
    return group;
  }

  if (type === "shellBed") {
    addPreviewPlane(group, type, block, 0, -0.22, 0, 0.82, 0.62, 0.2);
    addPreviewBox(group, "shellBed", block, -0.2, -0.08, 0.12, 0.22, 0.12, 0.14);
    addPreviewBox(group, "shellBed", block, 0.2, -0.1, -0.08, 0.18, 0.1, 0.16);
    return group;
  }

  const mesh = createPreviewMesh(type, block);
  group.add(mesh);
  return group;
}

function createPreviewMesh(type, block = null) {
  const mesh = new THREE.Mesh(geometryByType[type] ?? geometryByType.stone, previewMaterial(type, block));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function addPreviewBox(group, type, block, x, y, z, sx, sy, sz, yaw = 0) {
  const mesh = createPreviewMesh(type, block);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.y = yaw;
  group.add(mesh);
}

function addPreviewPlane(group, type, block, x, y, z, sx, sz, yaw = 0) {
  const mesh = createPreviewMesh(type, block);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, 1, sz);
  mesh.rotation.y = yaw;
  group.add(mesh);
}

function previewMaterial(type, block = null) {
  const base = materials[type] ?? materials.stone;
  const material = base.clone();
  if (material.color && block && Number.isFinite(block.x) && Number.isFinite(block.y) && Number.isFinite(block.z)) {
    const tint = blockTint(type, block.x, block.y, block.z);
    material.color.multiply(new THREE.Color(tint[0], tint[1], tint[2]));
  }
  material.fog = false;
  return material;
}

function isShortWaterPreviewType(type) {
  return type === "water" || type === "swampWater" || type === "toxicWater";
}

function isSurfacePlanePreviewType(type) {
  return [
    "grassPlant",
    "dryGrass",
    "swampGrass",
    "moss",
    "lichen",
    "vine",
    "glowMycelium",
    "seaweed",
    "aquaticPlant",
    "shoreDamp",
    "shoreFoam",
  ].includes(type);
}

function isBushPreviewType(type) {
  return type === "bush" || type === "deadBush" || type === "snowBush" || type === "thorn";
}

const chainBlockPreviewSize = 144;
const chainBlockPreviewRenderSize = 144;
const chainBlockPreviewItems = new Set();
const staticBlockPreviewQueue = [];
const staticBlockPreviewCache = new Map();
const staticBlockPreviewCacheMax = 220;
const staticBlockPreviewFrameBudget = 4;
let chainBlockPreviewFrame = 0;
let chainBlockPreviewRenderer = null;
let chainBlockPreviewCanvas = null;
let staticBlockPreviewFrame = 0;
let staticBlockPreviewState = null;

function getChainBlockPreviewRenderer() {
  if (chainBlockPreviewRenderer) return chainBlockPreviewRenderer;
  chainBlockPreviewCanvas = document.createElement("canvas");
  chainBlockPreviewCanvas.width = chainBlockPreviewSize;
  chainBlockPreviewCanvas.height = chainBlockPreviewSize;
  chainBlockPreviewCanvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    chainBlockPreviewRenderer = null;
  });
  chainBlockPreviewRenderer = new THREE.WebGLRenderer({
    canvas: chainBlockPreviewCanvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  chainBlockPreviewRenderer.setClearColor(0x000000, 0);
  chainBlockPreviewRenderer.setPixelRatio(1);
  chainBlockPreviewRenderer.setSize(chainBlockPreviewRenderSize, chainBlockPreviewRenderSize, false);
  return chainBlockPreviewRenderer;
}

function registerChainBlockPreviewRender({ canvas, scene, camera, mesh, rotating = true }) {
  const item = {
    canvas,
    context: canvas.getContext("2d", { alpha: true }),
    scene,
    camera,
    mesh,
    rotating,
    active: true,
    cleanup() {
      if (!item.active) return;
      item.active = false;
      chainBlockPreviewItems.delete(item);
      disposePreviewObject(item.mesh);
    },
  };
  chainBlockPreviewItems.add(item);
  if (!chainBlockPreviewFrame) {
    chainBlockPreviewFrame = requestAnimationFrame(renderChainBlockPreviews);
  }
  return item;
}

function queueStaticBlockPreviewRender({ canvas, blockType, block = null }) {
  const item = {
    canvas,
    blockType,
    block,
    cacheKey: staticBlockPreviewCacheKey(blockType, block),
    active: true,
    cleanup() {
      item.active = false;
    },
  };

  const cached = staticBlockPreviewCache.get(item.cacheKey);
  if (cached) {
    drawStaticBlockPreviewCache(canvas, cached);
    return item;
  }

  staticBlockPreviewQueue.push(item);
  if (!staticBlockPreviewFrame) {
    staticBlockPreviewFrame = requestAnimationFrame(renderQueuedStaticBlockPreviews);
  }
  return item;
}

function renderQueuedStaticBlockPreviews() {
  staticBlockPreviewFrame = 0;
  let rendered = 0;

  while (staticBlockPreviewQueue.length && rendered < staticBlockPreviewFrameBudget) {
    const item = staticBlockPreviewQueue.shift();
    if (!item?.active || !item.canvas?.isConnected) continue;

    const cached = staticBlockPreviewCache.get(item.cacheKey);
    if (cached) {
      drawStaticBlockPreviewCache(item.canvas, cached);
      continue;
    }

    const snapshot = renderStaticBlockPreviewSnapshot(item.blockType, item.block);
    if (!snapshot) continue;
    rememberStaticBlockPreview(item.cacheKey, snapshot);
    drawStaticBlockPreviewCache(item.canvas, snapshot);
    rendered++;
  }

  if (staticBlockPreviewQueue.length) {
    staticBlockPreviewFrame = requestAnimationFrame(renderQueuedStaticBlockPreviews);
  }
}

function renderStaticBlockPreviewSnapshot(blockType, block = null) {
  const state = getStaticBlockPreviewState();
  const object = createBlockPreviewObject(blockType, block);
  object.rotation.x = -0.28;
  object.rotation.y = 0.72;
  object.rotation.z = 0.04;
  state.scene.add(object);

  const renderer = getChainBlockPreviewRenderer();
  renderer.render(state.scene, state.camera);
  state.scene.remove(object);
  disposePreviewObject(object);

  const snapshot = document.createElement("canvas");
  snapshot.width = chainBlockPreviewSize;
  snapshot.height = chainBlockPreviewSize;
  const context = snapshot.getContext("2d", { alpha: true });
  if (!context) return null;
  context.clearRect(0, 0, snapshot.width, snapshot.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(
    chainBlockPreviewCanvas,
    0,
    0,
    chainBlockPreviewRenderSize,
    chainBlockPreviewRenderSize,
    0,
    0,
    snapshot.width,
    snapshot.height,
  );
  return snapshot;
}

function getStaticBlockPreviewState() {
  if (staticBlockPreviewState) return staticBlockPreviewState;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  camera.position.set(2.45, 1.9, 2.7);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xf4fbff, 0x526044, 2.8));
  const keyLight = new THREE.DirectionalLight(0xfff2bf, 2.2);
  keyLight.position.set(-3.4, 4.2, 3.8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7be8ff, 0.5);
  fillLight.position.set(3, 2, -2);
  scene.add(fillLight);

  staticBlockPreviewState = { scene, camera };
  return staticBlockPreviewState;
}

function drawStaticBlockPreviewCache(canvas, snapshot) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
}

function rememberStaticBlockPreview(cacheKey, snapshot) {
  if (staticBlockPreviewCache.has(cacheKey)) staticBlockPreviewCache.delete(cacheKey);
  staticBlockPreviewCache.set(cacheKey, snapshot);
  while (staticBlockPreviewCache.size > staticBlockPreviewCacheMax) {
    const oldestKey = staticBlockPreviewCache.keys().next().value;
    staticBlockPreviewCache.delete(oldestKey);
  }
}

function staticBlockPreviewCacheKey(blockType, block = null) {
  if (!block || !Number.isFinite(block.x) || !Number.isFinite(block.y) || !Number.isFinite(block.z)) {
    return `${blockType}:base`;
  }
  return `${blockType}:${block.x}:${block.y}:${block.z}`;
}

function disposePreviewObject(object) {
  object?.traverse?.((child) => {
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
}

function renderChainBlockPreviews() {
  chainBlockPreviewFrame = 0;
  if (!chainBlockPreviewItems.size) return;

  const previewRenderer = getChainBlockPreviewRenderer();
  for (const item of chainBlockPreviewItems) {
    if (!item.active || !item.canvas.isConnected || !item.context) {
      item.cleanup();
      continue;
    }
    item.mesh.rotation.x = -0.28;
    item.mesh.rotation.y = item.rotating ? item.mesh.rotation.y + 0.042 : 0.72;
    item.mesh.rotation.z = 0.04;
    previewRenderer.render(item.scene, item.camera);
    item.context.clearRect(0, 0, item.canvas.width, item.canvas.height);
    item.context.drawImage(
      chainBlockPreviewCanvas,
      0,
      0,
      chainBlockPreviewRenderSize,
      chainBlockPreviewRenderSize,
      0,
      0,
      item.canvas.width,
      item.canvas.height,
    );
    if (!item.rotating) item.cleanup();
  }

  if (chainBlockPreviewItems.size) {
    chainBlockPreviewFrame = requestAnimationFrame(renderChainBlockPreviews);
  }
}

function removeChainEventLogRow(row) {
  row?.querySelector(".chain-event-block-preview")?.__nicechunkCleanup?.();
  row?.remove();
}

function updateChainEventLog(row, kind, title, detail) {
  if (!row) {
    return appendChainEventLog(kind, title, detail);
  }
  row.dataset.kind = kind;
  const titleEl = row.querySelector("strong");
  const detailEl = row.querySelector("span");
  if (titleEl) titleEl.textContent = title;
  if (detailEl) detailEl.textContent = detail;
  return row;
}

function scheduleChainEventLogRemoval(row, delay = chainEventFailureRemovalMs) {
  if (!row) return;
  window.setTimeout(() => removeChainEventLogRow(row), delay);
}

function animateChainBlockToBackpack(row) {
  const preview = row?.querySelector(".chain-event-block-preview");
  if (!preview) {
    window.setTimeout(() => removeChainEventLogRow(row), 1200);
    return;
  }
  row.querySelector(".chain-event-copy")?.classList.add("hidden-during-fly");
  const target = getBackpackHotbarElement() ?? hotbar;
  const from = preview.getBoundingClientRect();
  const to = target?.getBoundingClientRect();
  if (!from.width || !to?.width) {
    window.setTimeout(() => removeChainEventLogRow(row), 1200);
    return;
  }
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  preview.style.left = `${from.left}px`;
  preview.style.top = `${from.top}px`;
  preview.style.width = `${from.width}px`;
  preview.style.height = `${from.height}px`;
  preview.style.setProperty("--fly-x", `${dx}px`);
  preview.style.setProperty("--fly-y", `${dy}px`);
  preview.classList.add("fly-to-backpack");
  document.body.append(preview);
  preview.addEventListener("animationend", (event) => {
    if (event.target !== preview) return;
    preview.__nicechunkCleanup?.();
    preview.remove();
    row?.remove();
  }, { once: true });
}

function getBackpackHotbarElement() {
  const index = findBackpackHotbarSlotIndex();
  if (index === null) return null;
  return hotbar?.querySelector(`[data-slot="${index}"]`) ?? null;
}

function formatBlockCoords(block) {
  return `${block.x},${block.y},${block.z}`;
}

function shortSignature(signature) {
  if (!signature) return gameText("main.chainLog.noSignature", "no signature");
  return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
}

function chainSubmitReasonLabel(reason) {
  if (reason === "wallet-unavailable") return gameText("main.chainLog.walletUnavailable", "wallet unavailable");
  if (reason === "chain-sync-disabled") return gameText("main.chainLog.chainDisabledReason", "chain sync disabled");
  if (reason === "already-mined") return gameText("main.chainLog.alreadyMinedReason", "already mined");
  if (reason === "session-funding-cancelled") return gameText("main.chainLog.sessionFundingCancelled", "session funding cancelled");
  if (reason === "no-backpack") return gameText("main.chainLog.noBackpack", "no backpack equipped");
  if (reason === "backpack-full") return gameText("main.chainLog.backpackFull", "backpack full");
  if (reason === "listing-unavailable") return gameText("main.market.listingUnavailable", "listing unavailable");
  if (reason === "self-purchase") return gameText("main.market.selfPurchase", "cannot buy your own listing");
  if (reason === "nck-token-missing") return gameText("main.market.nckTokenMissing", "wallet has no NCK token account");
  return reason || gameText("main.chainLog.unknownReason", "unknown reason");
}

function isBlockAlreadyMinedError(error) {
  const text = `${error?.message ?? ""} ${error?.transactionMessage ?? ""} ${(error?.transactionLogs ?? []).join(" ")}`;
  return text.includes("0x18b9") || text.includes("already_mined") || text.includes("BlockAlreadyMined");
}

function readableChainError(error) {
  if (isBlockAlreadyMinedError(error)) return gameText("main.chainLog.alreadyMinedReason", "already mined");
  const message = error?.transactionMessage || error?.message || String(error);
  if (message === "Unexpected error") return gameText("main.chainLog.walletUnexpectedError", "wallet returned an unexpected error");
  return message.replace(/\s+/g, " ").slice(0, 140);
}

function isUnbreakableBlock(block) {
  return block?.type === "bedrock" || block?.type === "water" || block?.type === "swampWater" || block?.type === "toxicWater" || block?.y <= 0;
}

function createMiningHitFromSelectedBlock(block) {
  const feetY = playerFeetBlockY();
  const sameColumn = block.x === Math.round(player.position.x) && block.z === Math.round(player.position.z);
  const normal =
    sameColumn && block.y !== feetY
      ? new THREE.Vector3(0, block.y > feetY ? -1 : 1, 0)
      : avatarForward().multiplyScalar(-1);
  const center = new THREE.Vector3(block.x, block.y, block.z);
  return {
    block,
    point: center.clone().addScaledVector(normal, 0.5),
    normal,
  };
}

function createMiningContact(hit) {
  const normal = hit.normal.clone().normalize();
  const center = new THREE.Vector3(hit.block.x, hit.block.y, hit.block.z);
  return {
    block: hit.block,
    normal,
    planePoint: center.addScaledVector(normal, 0.5),
  };
}

function createMiningDebug() {
  const material = new THREE.MeshBasicMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(cubeGeometry, material, miningDebugCellCount());
  mesh.name = "miningDebugArea";
  mesh.visible = false;
  return mesh;
}

function miningDebugCellCount() {
  const width = miningHorizontalRadius * 2 + 1;
  const height = miningReachDown + miningReachUp + 1;
  return width * width * height;
}

function updateMiningDebug() {
  miningDebug.visible = debugMiningEnabled;
  if (!debugMiningEnabled) return;

  const playerCellX = Math.round(player.position.x);
  const playerCellZ = Math.round(player.position.z);
  const feetY = playerFeetBlockY();
  const transform = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(0.96, 0.96, 0.96);
  let index = 0;

  for (let y = feetY - miningReachDown; y <= feetY + miningReachUp; y++) {
    for (let z = playerCellZ - miningHorizontalRadius; z <= playerCellZ + miningHorizontalRadius; z++) {
      for (let x = playerCellX - miningHorizontalRadius; x <= playerCellX + miningHorizontalRadius; x++) {
        transform.compose(new THREE.Vector3(x, y, z), rotation, scale);
        miningDebug.setMatrixAt(index, transform);
        index++;
      }
    }
  }

  miningDebug.count = index;
  miningDebug.instanceMatrix.needsUpdate = true;
}

function rebuildChunkForBlock(block) {
  const chunkX = Math.floor(block.x / chunkSize);
  const chunkZ = Math.floor(block.z / chunkSize);
  rebuildChunkByKey(chunkKey(chunkX, chunkZ));
}

function rebuildChunksAroundBlock(block) {
  const chunkX = Math.floor(block.x / chunkSize);
  const chunkZ = Math.floor(block.z / chunkSize);
  for (let z = chunkZ - 1; z <= chunkZ + 1; z++) {
    for (let x = chunkX - 1; x <= chunkX + 1; x++) {
      const minX = x * chunkSize;
      const minZ = z * chunkSize;
      const nearX = block.x >= minX - 1 && block.x <= minX + chunkSize;
      const nearZ = block.z >= minZ - 1 && block.z <= minZ + chunkSize;
      if (nearX && nearZ) rebuildChunkByKey(chunkKey(x, z));
    }
  }
}

function rebuildChunkByKey(key) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  refreshKnownChunkByKey(key);
  pendingChunkKeys = pendingChunkKeys.filter((pendingKey) => pendingKey !== key);
  pendingPreloadChunkKeys = pendingPreloadChunkKeys.filter((pendingKey) => pendingKey !== key);
  pendingChunkRefreshKeys = pendingChunkRefreshKeys.filter((pendingKey) => pendingKey !== key);
  const current = generatedChunks.get(key);
  if (current) {
    world.remove(current);
    disposeGroup(current);
    generatedChunks.delete(key);
  }
  const preloaded = preloadedChunks.get(key);
  if (preloaded) {
    preloadedChunks.delete(key);
    disposeGroup(preloaded);
  }
  if (isChunkInRenderRange(chunkX, chunkZ)) {
    generatedChunks.set(key, createChunk(chunkX, chunkZ, true, chunkDetailModeForChunk(chunkX, chunkZ)));
  } else if (isChunkInPreloadRange(chunkX, chunkZ)) {
    preloadedChunks.set(key, createChunk(chunkX, chunkZ, false, "surface"));
  }
  updateMinimap(true);
}

function isChunkKeyInRenderRange(key) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  return isChunkInRenderRange(chunkX, chunkZ);
}

function isChunkKeyInPreloadRange(key) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  return isChunkInPreloadRange(chunkX, chunkZ);
}

function isChunkInRenderRange(chunkX, chunkZ) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  return Math.abs(chunkX - centerChunkX) <= renderDistance && Math.abs(chunkZ - centerChunkZ) <= renderDistance;
}

function isChunkInPreloadRange(chunkX, chunkZ) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  return Math.abs(chunkX - centerChunkX) <= preloadDistance && Math.abs(chunkZ - centerChunkZ) <= preloadDistance;
}

function disposeGroup(group) {
  releaseGeneratedSolidRefs(group);
  group.traverse((object) => {
    if (typeof object.dispose === "function") object.dispose();
  });
  group.clear();
}

function releaseGeneratedSolidRefs(group) {
  const solidKeys = group.userData.solidKeys;
  if (!solidKeys || !worldState.generatedSolidRefs) return;
  for (const key of solidKeys) {
    const nextCount = (worldState.generatedSolidRefs.get(key) ?? 1) - 1;
    if (nextCount > 0) {
      worldState.generatedSolidRefs.set(key, nextCount);
      continue;
    }
    worldState.generatedSolidRefs.delete(key);
    if (!placedBlocks.has(key)) solidBlocks.delete(key);
  }
  solidKeys.clear();
}

function flowWaterFromBreak(block) {
  const changedChunks = simulateWaterFlow(worldState, block);
  for (const key of changedChunks) rebuildChunkByKey(key);
}

function spawnHitParticles(block, point, normal, damage) {
  const count = damage >= 3 ? 16 : 9;
  for (let i = 0; i < count; i++) {
    const particle = createBreakParticle(block.type);
    particle.position.copy(point).addScaledVector(normal, 0.06);
    particle.velocity = normal
      .clone()
      .multiplyScalar(3 + Math.random() * 3)
      .add(new THREE.Vector3((Math.random() - 0.5) * 2.8, Math.random() * 2.2, (Math.random() - 0.5) * 2.8));
    particle.life = 0.42 + Math.random() * 0.22;
    scene.add(particle);
    breakParticles.push(particle);
  }
}

function spawnBreakParticles(block) {
  const center = new THREE.Vector3(block.x, block.y, block.z);
  for (let i = 0; i < 18; i++) {
    const particle = createBreakParticle(block.type);
    particle.position.copy(center).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
    particle.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      2 + Math.random() * 4,
      (Math.random() - 0.5) * 5,
    );
    particle.life = 0.55 + Math.random() * 0.35;
    scene.add(particle);
    breakParticles.push(particle);
  }
}

function createBreakParticle(type) {
  const particle = new THREE.Mesh(cubeGeometry, materials[type] ?? materials.dirt);
  const size = 0.1 + Math.random() * 0.12;
  particle.scale.set(size, size, size);
  particle.castShadow = true;
  return particle;
}

function updateBreakParticles(dt) {
  for (let i = breakParticles.length - 1; i >= 0; i--) {
    const particle = breakParticles[i];
    particle.life -= dt;
    particle.velocity.y -= gravity * 0.7 * dt;
    particle.position.addScaledVector(particle.velocity, dt);
    particle.rotation.x += dt * 7;
    particle.rotation.y += dt * 5;
    particle.scale.multiplyScalar(1 - dt * 0.8);
    if (particle.life <= 0) {
      scene.remove(particle);
      breakParticles.splice(i, 1);
    }
  }
}

function updateCrackMarker() {
  const contact = player.miningContact;
  if (!contact || !blockDamage.has(contact.block.key)) {
    crackMarker.visible = false;
    return;
  }

  const damage = blockDamage.get(contact.block.key);
  crackMarker.visible = true;
  crackMarker.position.set(contact.block.x, contact.block.y, contact.block.z);
  crackMarker.scale.setScalar(0.75 + damage * 0.18);
  crackMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), contact.normal);
}

function isSolidCell(x, y, z) {
  return querySolidCell(worldState, x, y, z);
}

function surfaceHeight(x, z) {
  return querySurfaceHeight(worldState, x, z);
}

function placePlayerOnGround(resetHorizontal = true) {
  if (resetHorizontal) {
    player.position.x = 0;
    player.position.z = 0;
  }
  player.position.y = Math.max(player.position.y, surfaceHeight(player.position.x, player.position.z) + 1.01);
  avatar.position.copy(player.position);
}

function vectorFromPlayerState(state) {
  if (!state?.position) return null;
  if (state.position instanceof THREE.Vector3) return state.position.clone();
  const { x, y, z } = state.position;
  if (![x, y, z].every(Number.isFinite)) return null;
  return new THREE.Vector3(x, y, z);
}

function loadSavedPlayerState() {
  try {
    const raw = localStorage.getItem(playerPositionStorageKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    const x = Number(data.x);
    const y = Number(data.y);
    const z = Number(data.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const groundY = surfaceHeight(x, z) + 1.01;
    const position = new THREE.Vector3(x, Number.isFinite(y) ? Math.max(y, groundY) : groundY, z);
    const yaw = Number.isFinite(Number(data.yaw)) ? Number(data.yaw) : Math.PI * 0.25;
    const rawPitch = Number(data.cameraPitch);
    const cameraPitch = Number.isFinite(rawPitch) ? THREE.MathUtils.clamp(rawPitch, -0.92, 0.42) : -0.42;
    return { position, yaw, cameraPitch };
  } catch {
    return null;
  }
}

function savePlayerPosition(force = false) {
  const now = performance.now();
  if (!force && now - playerPositionSaveState.lastSaveAt < playerPositionSaveMs) return;
  const payload = JSON.stringify({
    version: 1,
    x: roundForStorage(player.position.x),
    y: roundForStorage(player.position.y),
    z: roundForStorage(player.position.z),
    yaw: roundForStorage(player.yaw),
    cameraPitch: roundForStorage(player.cameraPitch),
    savedAt: Date.now(),
  });
  if (!force && payload === playerPositionSaveState.lastPayload) return;
  try {
    localStorage.setItem(playerPositionStorageKey, payload);
    playerPositionSaveState.lastSaveAt = now;
    playerPositionSaveState.lastPayload = payload;
  } catch {
    playerPositionSaveState.lastSaveAt = now;
  }
}

function roundForStorage(value) {
  return Math.round(value * 1000) / 1000;
}

function updateMinimap(force = false) {
  const now = performance.now();
  if (!force && now - minimapState.lastDrawAt < minimapUpdateMs) return;
  minimapState.lastDrawAt = now;

  drawMinimap(minimapCanvas, minimapContext, minimapScale, player.position.x, player.position.z);
  if (minimapState.expanded) {
    drawMinimap(largeMinimapCanvas, largeMinimapContext, minimapState.largeScale, minimapState.viewX, minimapState.viewZ);
    updateMapGuardianStatus();
  }
  saveKnownChunksToStorage();
}

function drawMinimap(targetCanvas, targetContext, scale, viewX, viewZ) {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const centerX = width / 2;
  const centerZ = height / 2;
  targetContext.clearRect(0, 0, width, height);
  targetContext.fillStyle = "#10150f";
  targetContext.fillRect(0, 0, width, height);
  targetContext.imageSmoothingEnabled = false;

  const minWorldX = viewX - centerX / scale;
  const maxWorldX = viewX + centerX / scale;
  const minWorldZ = viewZ - centerZ / scale;
  const maxWorldZ = viewZ + centerZ / scale;
  const minChunkX = Math.floor(minWorldX / chunkSize);
  const maxChunkX = Math.floor(maxWorldX / chunkSize);
  const minChunkZ = Math.floor(minWorldZ / chunkSize);
  const maxChunkZ = Math.floor(maxWorldZ / chunkSize);

  for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      const data = knownChunks.get(chunkKey(chunkX, chunkZ));
      if (!data) continue;
      const drawX1 = Math.floor(centerX + (chunkX * chunkSize - viewX) * scale);
      const drawZ1 = Math.floor(centerZ + (chunkZ * chunkSize - viewZ) * scale);
      const drawX2 = Math.ceil(centerX + ((chunkX + 1) * chunkSize - viewX) * scale);
      const drawZ2 = Math.ceil(centerZ + ((chunkZ + 1) * chunkSize - viewZ) * scale);
      targetContext.drawImage(data.tile, drawX1, drawZ1, drawX2 - drawX1, drawZ2 - drawZ1);
    }
  }

  const playerX = centerX + (player.position.x - viewX) * scale;
  const playerZ = centerZ + (player.position.z - viewZ) * scale;
  if (playerX > -20 && playerX < width + 20 && playerZ > -20 && playerZ < height + 20) {
    drawMinimapPlayer(targetContext, playerX, playerZ, targetCanvas === largeMinimapCanvas ? 1.7 : 1);
  }
}

function chunkHasGuardianCoverage(chunkX, chunkZ) {
  return guardianMapCoverageState.guardians.some((guardian) => guardianCoversChunk(guardian, chunkX, chunkZ));
}

function updateGuardianSceneFog() {
  if (!guardianMapCoverageState.loaded) return;
  const chunk = playerChunkFromPosition(player.position);
  const currentChunkKey = `${chunk.x},${chunk.z}`;
  if (
    guardianSceneFogState.chunkKey === currentChunkKey &&
    guardianFogVolumeState.chunkKey === currentChunkKey &&
    guardianFogVolumeState.coverageVersion === guardianMapCoverageState.version &&
    guardianSceneFogState.active !== null
  ) {
    return;
  }
  const active = !chunkHasGuardianCoverage(chunk.x, chunk.z);
  const nearbyFogCount = updateGuardianFogVolumes(chunk, currentChunkKey);
  guardianSceneFogState.chunkKey = currentChunkKey;
  guardianSceneFogState.active = active;
  scene.fog = active ? guardianSceneFog : nearbyFogCount > 0 ? guardianAreaFog : normalSceneFog;
  scene.background = active ? guardianFogSkyColor : normalSkyColor;
}

function updateGuardianFogVolumes(centerChunk, currentChunkKey) {
  if (
    guardianFogVolumeState.chunkKey === currentChunkKey &&
    guardianFogVolumeState.coverageVersion === guardianMapCoverageState.version
  ) {
    return guardianFogVolumeMesh.count;
  }
  let count = 0;
  for (let chunkZ = centerChunk.z - guardianFogVolumeRadius; chunkZ <= centerChunk.z + guardianFogVolumeRadius; chunkZ++) {
    for (let chunkX = centerChunk.x - guardianFogVolumeRadius; chunkX <= centerChunk.x + guardianFogVolumeRadius; chunkX++) {
      if (chunkHasGuardianCoverage(chunkX, chunkZ)) continue;
      if (count + 1 > guardianFogVolumeMaxInstances) break;
      const fogSeed = guardianFogVolumeSeed(chunkX, chunkZ);
      const offsetX = ((fogSeed & 255) / 255 - 0.5) * chunkSize * 0.38;
      const offsetZ = (((fogSeed >>> 8) & 255) / 255 - 0.5) * chunkSize * 0.38;
      const worldX = (chunkX + 0.5) * chunkSize + offsetX;
      const worldZ = (chunkZ + 0.5) * chunkSize + offsetZ;
      const worldY = terrainHeight(worldX, worldZ) + 1 + guardianFogVolumeHeight * 0.5;
      const rotationY = ((fogSeed >>> 16) / 65535) * Math.PI;
      setGuardianFogVolumeInstance(count++, worldX, worldY, worldZ, rotationY);
    }
  }
  guardianFogVolumeMesh.count = count;
  guardianFogVolumeMesh.instanceMatrix.needsUpdate = true;
  guardianFogVolumeState.chunkKey = currentChunkKey;
  guardianFogVolumeState.coverageVersion = guardianMapCoverageState.version;
  return count;
}

function setGuardianFogVolumeInstance(index, x, y, z, rotationY) {
  guardianFogVolumeTransform.position.set(x, y, z);
  guardianFogVolumeTransform.rotation.set(0, rotationY, 0);
  guardianFogVolumeTransform.updateMatrix();
  guardianFogVolumeMesh.setMatrixAt(index, guardianFogVolumeTransform.matrix);
}

function guardianFogVolumeSeed(chunkX, chunkZ) {
  let seed = Math.imul(chunkX ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(chunkZ ^ 0xc2b2ae35, 0x27d4eb2d);
  seed ^= seed >>> 15;
  seed = Math.imul(seed, 0x2c1b3c6d);
  seed ^= seed >>> 12;
  return seed >>> 0;
}

function drawMinimapPlayer(targetContext, centerX, centerZ, size = 1) {
  const direction = avatarForward();
  targetContext.save();
  targetContext.translate(centerX, centerZ);
  targetContext.rotate(Math.atan2(direction.x, -direction.z));
  targetContext.scale(size, size);
  targetContext.fillStyle = "#fff6cf";
  targetContext.strokeStyle = "#1c1711";
  targetContext.lineWidth = 2;
  targetContext.beginPath();
  targetContext.moveTo(0, -8);
  targetContext.lineTo(6, 7);
  targetContext.lineTo(0, 4);
  targetContext.lineTo(-6, 7);
  targetContext.closePath();
  targetContext.stroke();
  targetContext.fill();
  targetContext.restore();
}

function openLargeMap() {
  minimapState.expanded = true;
  minimapState.viewX = player.position.x;
  minimapState.viewZ = player.position.z;
  mapOverlay.classList.add("open");
  mapOverlay.setAttribute("aria-hidden", "false");
  updateMapTeleportInputs();
  setMapTeleportStatus("");
  void refreshGuardianMapCoverage({ force: true });
  updateMapGuardianStatus();
  updateMinimap(true);
}

function updateMapTeleportInputs() {
  if (mapTeleportX) mapTeleportX.value = player.position.x.toFixed(1);
  if (mapTeleportZ) mapTeleportZ.value = player.position.z.toFixed(1);
}

function handleMapTeleportSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  const x = Number.parseFloat(mapTeleportX?.value ?? "");
  const z = Number.parseFloat(mapTeleportZ?.value ?? "");
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    setMapTeleportStatus(gameText("main.mapTeleport.invalid", "Enter valid coordinates"));
    return;
  }
  teleportPlayerToWorld(x, z);
}

function teleportPlayerToWorld(x, z) {
  clearAutoMove();
  keys.clear();
  player.velocity.set(0, 0, 0);
  player.position.set(x, surfaceHeight(x, z) + 1.01, z);
  player.grounded = true;
  player.moving = false;
  avatar.position.copy(player.position);
  cameraFocusReady = false;
  minimapState.viewX = x;
  minimapState.viewZ = z;
  generateAround(player.position);
  buildPendingChunks();
  generateCloudsAround(player.position);
  savePlayerPosition(true);
  updateHud();
  updateMinimap(true);
  updateGuardianSceneFog();
  updateMapTeleportInputs();
  setMapTeleportStatus(gameText("main.mapTeleport.done", "Teleported"));
  void ensureGuardianConnectionForPosition({ force: true });
}

function setMapTeleportStatus(message) {
  if (mapTeleportStatus) mapTeleportStatus.textContent = message;
}

async function refreshGuardianMapCoverage({ force = false } = {}) {
  const now = performance.now();
  if (guardianMapCoverageState.loading) return;
  if (!force && guardianMapCoverageState.loaded && now - guardianMapCoverageState.lastLoadAt < guardianMapCoverageRefreshMs) return;
  guardianMapCoverageState.loading = true;
  try {
    const guardians = await guardianRegistryResolver.loadGuardians({ force });
    guardianMapCoverageState.guardians = guardians;
    guardianMapCoverageState.loaded = true;
    guardianMapCoverageState.lastLoadAt = performance.now();
    guardianMapCoverageState.version += 1;
    guardianSceneFogState.active = null;
    updateGuardianSceneFog();
    if (minimapState.expanded) updateMinimap(true);
  } catch (error) {
    console.warn("Failed to load NiceChunk Guardian map coverage", error);
  } finally {
    guardianMapCoverageState.loading = false;
  }
}

function syncGuardianMapCoverageFromResolver() {
  if (!guardianRegistryResolver.isLoaded()) return;
  guardianMapCoverageState.guardians = guardianRegistryResolver.getCachedGuardians();
  guardianMapCoverageState.loaded = true;
  guardianMapCoverageState.lastLoadAt = performance.now();
  guardianMapCoverageState.version += 1;
  guardianSceneFogState.active = null;
  updateGuardianSceneFog();
}

function updateMapGuardianStatus() {
  if (!mapGuardianStatus) return;
  const chunk = playerChunkFromPosition(player.position);
  const guardian = guardianConnectionState.guardian;
  if (guardian && guardianCoversChunk(guardian, chunk.x, chunk.z)) {
    mapGuardianStatus.textContent = gameText(
      "main.mapGuardian.active",
      "Guardian: {endpoint} | chunk {chunkX},{chunkZ} | range {minX}..{maxX}, {minZ}..{maxZ}",
      {
        endpoint: guardianConnectionState.endpoint || guardianEndpointLabel(guardian),
        chunkX: chunk.x,
        chunkZ: chunk.z,
        minX: guardian.minChunkX,
        maxX: guardian.maxChunkX,
        minZ: guardian.minChunkY,
        maxZ: guardian.maxChunkY,
      },
    );
    return;
  }
  if (guardianConnectionState.resolving) {
    mapGuardianStatus.textContent = gameText("main.mapGuardian.resolvingForChunk", "Guardian: resolving for chunk {chunkX},{chunkZ}", {
      chunkX: chunk.x,
      chunkZ: chunk.z,
    });
    return;
  }
  mapGuardianStatus.textContent = gameText("main.mapGuardian.none", "Guardian: none for chunk {chunkX},{chunkZ}", {
    chunkX: chunk.x,
    chunkZ: chunk.z,
  });
}

function guardianEndpointLabel(guardian) {
  if (!guardian?.host) return "";
  const scheme = guardian.useTls ? "wss" : "ws";
  return `${scheme}://${guardian.host}:${guardian.port}/ws`;
}

function closeLargeMap() {
  minimapState.expanded = false;
  stopLargeMapDrag();
  mapOverlay.classList.remove("open");
  mapOverlay.setAttribute("aria-hidden", "true");
}

function handleLargeMapPointerDown(event) {
  if (!minimapState.expanded) return;
  event.preventDefault();
  event.stopPropagation();
  largeMapDrag.active = true;
  largeMapDrag.pointerId = event.pointerId;
  largeMapDrag.startX = event.clientX;
  largeMapDrag.startY = event.clientY;
  largeMapDrag.viewX = minimapState.viewX;
  largeMapDrag.viewZ = minimapState.viewZ;
  largeMinimapCanvas.setPointerCapture?.(event.pointerId);
  largeMinimapCanvas.closest(".map-modal")?.classList.add("dragging");
}

function handleLargeMapPointerMove(event) {
  if (!largeMapDrag.active || event.pointerId !== largeMapDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  minimapState.viewX = largeMapDrag.viewX - (event.clientX - largeMapDrag.startX) / minimapState.largeScale;
  minimapState.viewZ = largeMapDrag.viewZ - (event.clientY - largeMapDrag.startY) / minimapState.largeScale;
  clampLargeMapView();
  updateMinimap(true);
}

function handleLargeMapWheel(event) {
  if (!minimapState.expanded) return;
  event.preventDefault();
  event.stopPropagation();

  const rect = largeMinimapCanvas.getBoundingClientRect();
  const canvasX = ((event.clientX - rect.left) / rect.width) * largeMinimapCanvas.width;
  const canvasZ = ((event.clientY - rect.top) / rect.height) * largeMinimapCanvas.height;
  const centerX = largeMinimapCanvas.width / 2;
  const centerZ = largeMinimapCanvas.height / 2;
  const beforeX = minimapState.viewX + (canvasX - centerX) / minimapState.largeScale;
  const beforeZ = minimapState.viewZ + (canvasZ - centerZ) / minimapState.largeScale;
  const zoom = Math.exp(-event.deltaY * 0.0016);

  minimapState.largeScale = THREE.MathUtils.clamp(
    minimapState.largeScale * zoom,
    largeMinimapMinScale,
    largeMinimapMaxScale,
  );
  minimapState.viewX = beforeX - (canvasX - centerX) / minimapState.largeScale;
  minimapState.viewZ = beforeZ - (canvasZ - centerZ) / minimapState.largeScale;
  markKnownMapDirty();
  clampLargeMapView();
  updateMinimap(true);
}

function handleLargeMapPointerUp(event) {
  if (!largeMapDrag.active || event.pointerId !== largeMapDrag.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  stopLargeMapDrag();
}

function stopLargeMapDrag() {
  largeMapDrag.active = false;
  largeMapDrag.pointerId = null;
  largeMinimapCanvas.closest(".map-modal")?.classList.remove("dragging");
}

function clampLargeMapView() {
  if (!knownChunks.size) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const data of knownChunks.values()) {
    minX = Math.min(minX, data.chunkX * chunkSize);
    maxX = Math.max(maxX, (data.chunkX + 1) * chunkSize);
    minZ = Math.min(minZ, data.chunkZ * chunkSize);
    maxZ = Math.max(maxZ, (data.chunkZ + 1) * chunkSize);
  }

  const marginX = largeMinimapCanvas.width / minimapState.largeScale * 0.45;
  const marginZ = largeMinimapCanvas.height / minimapState.largeScale * 0.45;
  minimapState.viewX = THREE.MathUtils.clamp(minimapState.viewX, minX - marginX, maxX + marginX);
  minimapState.viewZ = THREE.MathUtils.clamp(minimapState.viewZ, minZ - marginZ, maxZ + marginZ);
}

function updateHud() {
  updateAccountHud();
  const chunk = playerChunkFromPosition(player.position);
  const worldCoordText = `${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`;
  const chunkCoordText = `${chunk.x}, ${chunk.z}`;
  positionLabel.textContent = worldCoordText;
  if (minimapWorldCoord) minimapWorldCoord.textContent = worldCoordText;
  if (minimapChunkCoord) minimapChunkCoord.textContent = chunkCoordText;
  chunksLabel.textContent = gameText("main.chunks", "{active}/{known} chunks", {
    active: generatedChunks.size,
    known: knownChunks.size,
  });
  fpsLabel.textContent = gameText("main.fps", "{fps} FPS", { fps: fpsState.value });
}

function updateAccountHud() {
  const session = getGameSession();
  accountName.textContent = session.username || gameText("main.account.guest", "Guest");
  accountLevel.textContent = gameText("main.account.level", "Lv. {level}", { level: normalizedLevel() });
  accountTitle.textContent = localStorage.getItem("nicechunk.title") || gameText("main.account.defaultTitle", "Novice");
  accountWallet.textContent = formatWalletAddress(session.walletAddress);
  if (accountSessionBalance) {
    if (gameplaySessionStatus?.balanceLamports !== null && Number.isFinite(gameplaySessionStatus?.balanceLamports)) {
      accountSessionBalance.textContent = gameText("main.account.sessionBalance", "Session: {balance} SOL", {
        balance: formatSolAmount(gameplaySessionStatus.balanceLamports / 1_000_000_000),
      });
    } else {
      accountSessionBalance.textContent = gameText("main.account.sessionNotFunded", "Session: not funded");
    }
  }
}

function normalizedLevel() {
  const level = Number(localStorage.getItem("nicechunk.level") || "1");
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
}

function formatWalletAddress(address) {
  if (!address) return gameText("main.account.notConnected", "Not connected");
  return address.length > 10 ? `${address.slice(0, 8)}...` : address;
}

function formatSolAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  if (amount >= 10) return amount.toFixed(2).replace(/\.?0+$/, "");
  if (amount >= 1) return amount.toFixed(3).replace(/\.?0+$/, "");
  return amount.toFixed(4).replace(/\.?0+$/, "");
}

function updateFps() {
  fpsState.frames += 1;
  const now = performance.now();
  const elapsed = (now - fpsState.lastTime) / 1000;
  if (elapsed > 0) {
    fpsState.value = Math.max(1, Math.round(fpsState.frames / elapsed));
  }
  if (elapsed >= 0.5) {
    fpsState.frames = 0;
    fpsState.lastTime = now;
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeProfilePreview();
}
