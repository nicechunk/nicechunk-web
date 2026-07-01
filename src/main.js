import * as THREE from "three";
import "./styles.css";
import "./polyfills.js";
import { applyWorldConfigFromChain, chunkSize, cloudSectorSize, maxBuildY, maxTerrainHeight, minBuildY, renderDistance, seaLevel } from "./world/config.js";
import { setWorldSeed } from "./world/generator.js";
import {
  canonicalAboveSurfaceBlocksInArea,
  canonicalRenderTypeAt,
  canonicalSurfaceHeightAt,
  canonicalTreeFellBlocks,
  canonicalWaterLevelAt,
  setCanonicalWorldConfig,
} from "./world/canonicalResource.js";
import { defaultWorldSeed, persistPlayWorldSeed } from "./world/seedStorage.js";
import { renderTypeForBlock, WORLD_MAP_BLOCK_DEBUG_COLOR, WorldMapBlock } from "./world/blocks.js";
import { blockKey, chunkKey, parseCellKey } from "./world/keys.js";
import { createWorldState, surfaceHeight as querySurfaceHeight } from "./world/state.js";
import { flowWaterFromBreak as simulateWaterFlow, hasWaterAt } from "./world/fluid.js";
import { blockTint, createChunkGroup, createCloudSectorGroup, generatedBlockTypeAt } from "./world/chunks.js";
import { createAvatar, createAvatarMaterials } from "./render/avatar.js";
import { updateAvatarMotion, startAvatarHandSwing } from "./player/avatarMotion.js";
import { createWorldGeometryByType, createWorldMaterials } from "./world/rendering.js";
import { updateProceduralMaterialTime } from "./render/proceduralMaterials.js";
import {
  createResourceBlockPreviewCanvas,
  createResourceMaterialPreviewCanvas,
} from "./render/resourcePreview.js";
import { initI18n, t } from "./i18n.js";
import {
  createNiceChunkGuardianClient,
  getNiceChunkGuardianSpawnState,
  markGuardianSpawnForSession,
  shouldUseGuardianSpawnForSession,
} from "./guardianClient.js";
import { createGuardianRegistryResolver, guardianCoversChunk } from "./guardianRegistry.js";
import {
  createForgedItemPreviewElement,
  equipForgedItemOnAvatar,
  forgedItemsStorageKey,
  forgedLoadoutRefreshStorageKey,
  forgeBytesToCode,
  forgeCodeToBytes,
  latestForgedItemStorageKey,
  loadLatestForgedItem,
} from "./forgedItems.js";
import {
  backpackSlotIndex,
  consumePendingForgedHotbarItems,
  createBackpackSlot,
  createHotbarItems,
  createInitialHotbarSlots,
  forgedHotbarQueueStorageKey,
  hotbarItemAt as itemAtHotbarSlot,
  hotbarSlotsStorageKey,
  hotbarSlotAt as slotAtHotbarIndex,
  hotbarSlotCount,
  isReservedHotbarSlot,
  loadStoredHotbarSlots,
  maxStackSize,
  renderHotbarSlots,
  saveHotbarSlots,
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
  rpcConfigChangedEventName,
  rpcErrorEventName,
  saveHeliusApiKey,
} from "./rpcConfig.js";
import { getBlockAtlasEntry } from "./data/blockAtlas.js";
import smeltingRules, {
  deriveSmeltingMaterialProperties,
  createSmeltingInputCounts,
  findBestSmeltingRecipeForKeys,
  missingSmeltingInputs,
  recipeRequirements,
  smeltingRecipeInputMultiplier,
  smeltingMaterialBaseAttributes,
  smeltingMaterialById,
  smeltingFuelForRawKey,
  smeltingFuelForMaterialId,
  smeltingHeatTierByTier,
  smeltingMaterialIdForItemCode,
  smeltingMaterialIdForInputKey,
  smeltingMaterialInputKey,
  smeltingMergeRecipeIdForMaterialId,
  smeltingMergeRecipeTableIdForMaterialId,
  smeltingRecipeIdForMaterialId,
  smeltingRecipeTableIdForMaterialId,
  smeltingRecipeYieldBps,
  smeltingSkillOutputBpsForLevel,
  smeltingTopAttributeEntries,
} from "./data/smeltingRules.js";

const appRoot = document.querySelector("#app");
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
const profileSkillsGrid = document.querySelector("#profileSkillsGrid");
const profileSkillDetail = document.querySelector("#profileSkillDetail");
const profileEquipmentList = document.querySelector("#profileEquipmentList");
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
const profileRpcValue = document.querySelector("#profileRpcValue");
const profileRpcHint = document.querySelector("#profileRpcHint");
const profileRpcAction = document.querySelector("#profileRpcAction");
const mobileJoystick = document.querySelector("#mobileJoystick");
const mobileJoystickKnob = document.querySelector("#mobileJoystickKnob");
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
const marketRefresh = document.querySelector("#marketRefresh");
const marketSearch = document.querySelector("#marketSearch");
const marketSort = document.querySelector("#marketSort");
const marketCurrencyFilter = document.querySelector("#marketCurrencyFilter");
const marketSearchMeta = document.querySelector("#marketSearchMeta");
const marketStatus = document.querySelector("#marketStatus");
const marketCategoryButtons = document.querySelectorAll("[data-market-category]");
const marketListingGrid = document.querySelector("#marketListingGrid");
const marketListingPager = document.querySelector("#marketListingPager");
const marketInventoryGrid = document.querySelector("#marketInventoryGrid");
const marketListingForm = document.querySelector("#marketListingForm");
const marketListingCategory = document.querySelector("#marketListingCategory");
const marketListingCurrency = document.querySelector("#marketListingCurrency");
const marketListingPrice = document.querySelector("#marketListingPrice");
const marketCreateListing = document.querySelector("#marketCreateListing");
const marketSelectedItem = document.querySelector("#marketSelectedItem");
const marketFormStatus = document.querySelector("#marketFormStatus");
const marketOrdersGrid = document.querySelector("#marketOrdersGrid");
const marketOrdersPager = document.querySelector("#marketOrdersPager");
const smeltingPhone = document.querySelector("#smeltingPhone");
const smeltingOverlay = document.querySelector("#smeltingOverlay");
const smeltingPanel = document.querySelector("#smeltingPanel");
const smeltingClose = document.querySelector("#smeltingClose");
const smeltingBackpack = document.querySelector("#smeltingBackpack");
const smeltingMode = document.querySelector("#smeltingMode");
const smeltingResourceGrid = document.querySelector("#smeltingResourceGrid");
const smeltingInputSlot = document.querySelector("#smeltingInputSlot");
const smeltingFuelSlot = document.querySelector("#smeltingFuelSlot");
const smeltingOutput = document.querySelector("#smeltingOutput");
const smeltingStatus = document.querySelector("#smeltingStatus");
const smeltingStart = document.querySelector("#smeltingStart");
const smeltingProgressValue = document.querySelector("#smeltingProgressValue");
const smeltingProgressBar = document.querySelector("#smeltingProgressBar");
const smeltingHeatCore = document.querySelector("#smeltingHeatCore");
const smeltingFlameShader = document.querySelector("#smeltingFlameShader");
const smeltingThreeCore = document.querySelector("#smeltingThreeCore");
const smeltingMobileTabs = document.querySelectorAll("[data-smelting-mobile-tab]");
const smeltingResourceFilters = document.querySelectorAll("[data-smelting-filter]");
const smeltingRecipeFilters = document.querySelectorAll("[data-smelting-recipe-filter]");
const smeltingRecipeList = document.querySelector("#smeltingRecipeList");
const smeltingMobileActionDrawer = document.querySelector("#smeltingMobileActionDrawer");
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

function syncGameChromeState() {
  if (!appRoot) return;
  const backpackOpen = Boolean(backpackPanel && !backpackPanel.hidden);
  const marketOpen = Boolean(marketPanel && !marketPanel.hidden);
  const smeltingOpen = Boolean(smeltingPanel && !smeltingPanel.hidden);
  const profileOpen = Boolean(profilePanel && !profilePanel.hidden);
  const modalOpen = backpackOpen || marketOpen || smeltingOpen || profileOpen;
  const loadingVisible = Boolean(gameLoadingOverlay && !gameLoadingComplete && !gameLoadingOverlay.hidden);
  const loadingActive = loadingVisible && !modalOpen;

  appRoot.classList.toggle("game-loading-active", loadingActive);
  appRoot.classList.toggle("game-loading-modal-bypass", loadingVisible && modalOpen);
  appRoot.classList.toggle("game-modal-backpack-open", backpackOpen);
  appRoot.classList.toggle("game-modal-market-open", marketOpen);
  appRoot.classList.toggle("game-modal-smelting-open", smeltingOpen);
  appRoot.classList.toggle("game-modal-profile-open", profileOpen);
}

let i18nReady = false;
let runtimeUiReady = false;
let firstGameFrameRendered = false;
let gameLoadingComplete = false;
let startupChunkTotal = 0;

syncGameChromeState();

const startupWorldConfigTimeoutMs = 15000;
const startupChainSyncTimeoutMs = 5200;
const startupLoadingMaxWaitMs = 16000;

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
    body: "Fetching the game interface dictionary.",
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

window.setTimeout(() => {
  if (gameLoadingComplete) return;
  if (!runtimeUiReady && !firstGameFrameRendered) return;
  console.warn("NiceChunk startup loading exceeded the visual wait budget; continuing with background world generation.");
  finishGameLoading();
}, startupLoadingMaxWaitMs);

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
  resetBackpackGridRenderState();
  renderBackpackPanel();
  resetSmeltingRenderSignatures();
  scheduleSmeltingPanelUpdate();
  updateHud(true);
  updateProfilePanelDetails();
  renderResourceDebugFeed();
  updateMapGuardianStatus();
  updateCurrentGameLoadingText();
  updateRpcConfigStatusText();
}

function resetBackpackGridRenderState() {
  backpackPreviewHydrationToken += 1;
  backpackGridRenderState.capacity = 0;
  backpackGridRenderState.signatures = [];
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

const profileSkillMaxLevel = 10;
const profileSkillXpRequirementMultiplier = 10;
const profileSkillStoragePrefix = "nicechunk.playerSkills.";
const profileSkillXpStoragePrefix = "nicechunk.playerSkillXp.";
let profileChainSkillXpOwner = "";
let profileChainSkillXp = null;
let profileChainSkillXpPromise = null;
let profileChainSkillXpRequestId = 0;

function formatSkillNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return "0";
  return value
    .toFixed(decimals)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function createPercentMetric(value) {
  return formatSkillNumber(value, value % 1 === 0 ? 0 : 1);
}

function createProfileSkillMetric(key, fallback, params = {}) {
  return { key, fallback, params };
}

function formatProfileSkillXp(value) {
  const numeric = Math.max(0, Math.round(Number(value) || 0));
  return numeric.toLocaleString();
}

function profileSkillSvg(skillId) {
  const svg = {
    precisionGathering: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 18l9-5 9 5-9 5-9-5z"/><path d="M7 18v6l9 5 9-5v-6"/><path d="M16 13v10"/><circle cx="21.5" cy="10.5" r="4.5"/><path d="M25 14l4 4"/></svg>',
    burden: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 11h12l3 5v11H7V16l3-5z"/><path d="M12 11V9a4 4 0 0 1 8 0v2"/><path d="M11 18h10"/><path d="M16 18v7"/></svg>',
    smelting: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 27h10l3-8H8l3 8z"/><path d="M16 4c4 4-2 6 2 10 1-3 4-4 5-7 5 7 1 13-7 13-6 0-9-5-5-11 1 3 3 4 5 5-2-4-1-7 0-10z"/></svg>',
    forging: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 24h22"/><path d="M10 20h12l3 4H7l3-4z"/><path d="M18 5l7 7-3 3-7-7 3-3z"/><path d="M15 8L7 16"/></svg>',
    craftsmanship: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5v4"/><path d="M16 23v4"/><path d="M5 16h4"/><path d="M23 16h4"/><path d="M8.5 8.5l2.8 2.8"/><path d="M20.7 20.7l2.8 2.8"/><path d="M23.5 8.5l-2.8 2.8"/><path d="M11.3 20.7l-2.8 2.8"/><circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2.7"/></svg>',
    swiftness: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 22h11l5 4H10c-3 0-5-1-5-3 0-1 1-1 3-1z"/><path d="M17 22l-2-9 6 3 3-4"/><path d="M4 10h8"/><path d="M3 15h7"/><path d="M5 20h5"/></svg>',
    exploration: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/><path d="M20 8l-2 10-6 6 2-10 6-6z"/><circle cx="16" cy="16" r="2"/><path d="M16 2v4"/><path d="M16 26v4"/><path d="M2 16h4"/><path d="M26 16h4"/></svg>',
    stamina: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 27S5 20 5 12a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 8-11 15-11 15z"/><path d="M15 9l-3 7h5l-2 7 6-10h-5l2-4z"/></svg>',
    strength: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 20h20"/><path d="M8 16v8"/><path d="M24 16v8"/><path d="M12 14c1-5 7-5 8 0"/><path d="M12 14v5h8v-5"/><path d="M16 19v6"/></svg>',
    appraisal: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 13l5-6h4l5 6-7 10-7-10z"/><path d="M9 13h14"/><path d="M14 7l2 6 2-6"/><circle cx="12" cy="21" r="5"/><path d="M15.5 24.5l5 5"/></svg>',
  };
  return svg[skillId] ?? '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="10"/><path d="M16 9v14"/><path d="M9 16h14"/></svg>';
}

function createProfileSkillIcon(skill) {
  const icon = document.createElement("span");
  icon.className = "profile-skill-icon";
  icon.innerHTML = profileSkillSvg(skill.id);
  return icon;
}

function profileEquipmentSvg(slotId) {
  const svg = {
    head: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 14c0-5 3-9 7-9s7 4 7 9v6l-3 5h-8l-3-5v-6z"/><path d="M10 16h12"/><path d="M12 21h8"/></svg>',
    face: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 12c3-2 5-3 8-3s5 1 8 3l-2 9c-2 3-4 5-6 5s-4-2-6-5l-2-9z"/><path d="M11 16h4"/><path d="M17 16h4"/><path d="M13 22h6"/></svg>',
    shoulder: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 18c2-6 5-9 10-9s8 3 10 9"/><path d="M8 18l-3 6h8l3-6"/><path d="M24 18l3 6h-8l-3-6"/><path d="M13 12h6"/></svg>',
    wrist: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 6l10 3-2 8-10-3 2-8z"/><path d="M9 14l10 3-2 9-10-3 2-9z"/><path d="M12 19l5 1.5"/></svg>',
    chest: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 8l7-3 7 3 3 17-10 4-10-4 3-17z"/><path d="M16 5v24"/><path d="M10 15h12"/></svg>',
    back: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 5h10l4 6v14l-5 3h-8l-5-3V11l4-6z"/><path d="M11 5v8"/><path d="M21 5v8"/><path d="M10 17h12"/></svg>',
    leftHand: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 6v10"/><path d="M14 7v10"/><path d="M10 10v8"/><path d="M22 10v9"/><path d="M9 18c0 6 3 10 8 10 4 0 7-3 7-8v-4"/></svg>',
    rightHand: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M14 6v10"/><path d="M18 7v10"/><path d="M22 10v8"/><path d="M10 10v9"/><path d="M23 18c0 6-3 10-8 10-4 0-7-3-7-8v-4"/></svg>',
    legs: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 5h10l2 8-3 14h-6l-3-14 0-8z"/><path d="M16 13v14"/><path d="M11 13h10"/></svg>',
    feet: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 18h7l2 5v3H5v-3l4-5z"/><path d="M20 18h5l3 5v3H17v-3l3-5z"/><path d="M6 26h22"/></svg>',
    backpack: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 10h12l3 5v12H7V15l3-5z"/><path d="M12 10V8a4 4 0 0 1 8 0v2"/><path d="M11 18h10"/><path d="M16 18v7"/></svg>',
  };
  return svg[slotId] ?? '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 8h16v16H8z"/><path d="M8 16h16"/><path d="M16 8v16"/></svg>';
}

function createProfileEquipmentIcon(entry) {
  const icon = document.createElement("span");
  icon.className = "profile-equipment-icon";
  if (entry.previewCode) {
    const preview = createForgedItemPreviewElement(entry.previewCode, {
      className: "profile-equipment-render",
      size: 128,
      title: entry.value,
    });
    if (preview) {
      icon.classList.add("rendered");
      icon.append(preview);
      return icon;
    }
  }
  icon.innerHTML = profileEquipmentSvg(entry.id);
  return icon;
}

const playerSkillDefinitions = [
  {
    id: "precisionGathering",
    tone: "green",
    xpBase: 90,
    xpGrowth: 1.52,
    metrics(level) {
      const percent = Math.min(100, 10 + level * 10);
      const nextPercent = Math.min(100, 10 + Math.min(profileSkillMaxLevel, level + 1) * 10);
      return {
        current: createProfileSkillMetric("main.profile.skills.precisionGathering.current", "{percent}% gathered · {liters} L per resource block", {
          percent: createPercentMetric(percent),
          liters: formatSkillNumber(percent / 100, 2),
        }),
        next: createProfileSkillMetric("main.profile.skills.precisionGathering.next", "Next level: {percent}% · {liters} L per block", {
          percent: createPercentMetric(nextPercent),
          liters: formatSkillNumber(nextPercent / 100, 2),
        }),
        max: createProfileSkillMetric("main.profile.skills.precisionGathering.max", "Max: 100% · 1 L per resource block", {}),
        formula: createProfileSkillMetric("main.profile.skills.precisionGathering.formula", "min(100%, 10% + Lv x 10%); one resource block is 0.1m x 0.1m x 0.1m = 1 L", {}),
      };
    },
  },
  {
    id: "burden",
    tone: "amber",
    xpBase: 130,
    xpGrowth: 1.58,
    metrics(level) {
      const kg = 30 + level * 10;
      const nextKg = 30 + Math.min(profileSkillMaxLevel, level + 1) * 10;
      return {
        current: createProfileSkillMetric("main.profile.skills.burden.current", "{kg} kg safe carry capacity", { kg }),
        next: createProfileSkillMetric("main.profile.skills.burden.next", "Next level: {kg} kg", { kg: nextKg }),
        max: createProfileSkillMetric("main.profile.skills.burden.max", "Max: 130 kg safe carry capacity", {}),
        formula: createProfileSkillMetric("main.profile.skills.burden.formula", "30 kg + Lv x 10 kg", {}),
      };
    },
  },
  {
    id: "smelting",
    tone: "red",
    xpBase: 120,
    xpGrowth: 1.56,
    metrics(level) {
      const yieldPercent = Math.min(100, 70 + level * 3);
      const lossPercent = Math.max(0, 30 - level * 3);
      const nextYield = Math.min(100, 70 + Math.min(profileSkillMaxLevel, level + 1) * 3);
      const nextLoss = Math.max(0, 30 - Math.min(profileSkillMaxLevel, level + 1) * 3);
      return {
        current: createProfileSkillMetric("main.profile.skills.smelting.current", "{yieldPercent}% yield · {lossPercent}% loss", {
          yieldPercent,
          lossPercent,
        }),
        next: createProfileSkillMetric("main.profile.skills.smelting.next", "Next level: {yieldPercent}% yield · {lossPercent}% loss", {
          yieldPercent: nextYield,
          lossPercent: nextLoss,
        }),
        max: createProfileSkillMetric("main.profile.skills.smelting.max", "Max: 100% yield · 0% loss", {}),
        formula: createProfileSkillMetric("main.profile.skills.smelting.formula", "Yield = 70% + Lv x 3%; loss = 30% - Lv x 3%", {}),
      };
    },
  },
  {
    id: "forging",
    tone: "steel",
    xpBase: 140,
    xpGrowth: 1.6,
    metrics(level) {
      const bonus = level * 5;
      const nextBonus = Math.min(profileSkillMaxLevel, level + 1) * 5;
      return {
        current: createProfileSkillMetric("main.profile.skills.forging.current", "+{bonus}% forged item durability", { bonus }),
        next: createProfileSkillMetric("main.profile.skills.forging.next", "Next level: +{bonus}% durability", { bonus: nextBonus }),
        max: createProfileSkillMetric("main.profile.skills.forging.max", "Max: +50% durability", {}),
        formula: createProfileSkillMetric("main.profile.skills.forging.formula", "Durability bonus = Lv x 5%", {}),
      };
    },
  },
  {
    id: "craftsmanship",
    tone: "cyan",
    xpBase: 180,
    xpGrowth: 1.66,
    metrics(level) {
      const tier = 1 + Math.floor(level / 2);
      const nextTier = 1 + Math.floor(Math.min(profileSkillMaxLevel, level + 1) / 2);
      return {
        current: createProfileSkillMetric("main.profile.skills.craftsmanship.current", "Process tier {tier} available", { tier }),
        next: createProfileSkillMetric("main.profile.skills.craftsmanship.next", "Next level: process tier {tier}", { tier: nextTier }),
        max: createProfileSkillMetric("main.profile.skills.craftsmanship.max", "Max: process tier 6", {}),
        formula: createProfileSkillMetric("main.profile.skills.craftsmanship.formula", "Tier = 1 + floor(Lv / 2); unlocks advanced craft methods", {}),
      };
    },
  },
  {
    id: "swiftness",
    tone: "blue",
    xpBase: 110,
    xpGrowth: 1.5,
    metrics(level) {
      const speed = 100 + level * 3;
      const nextSpeed = 100 + Math.min(profileSkillMaxLevel, level + 1) * 3;
      return {
        current: createProfileSkillMetric("main.profile.skills.swiftness.current", "{speed}% movement speed", { speed }),
        next: createProfileSkillMetric("main.profile.skills.swiftness.next", "Next level: {speed}% movement speed", { speed: nextSpeed }),
        max: createProfileSkillMetric("main.profile.skills.swiftness.max", "Max: 130% movement speed", {}),
        formula: createProfileSkillMetric("main.profile.skills.swiftness.formula", "Speed = 100% + Lv x 3%", {}),
      };
    },
  },
  {
    id: "exploration",
    tone: "violet",
    xpBase: 125,
    xpGrowth: 1.57,
    metrics(level) {
      const chance = level * 10;
      const nextChance = Math.min(profileSkillMaxLevel, level + 1) * 10;
      return {
        current: createProfileSkillMetric("main.profile.skills.exploration.current", "+{chance}% rare extra-drop roll weight", { chance }),
        next: createProfileSkillMetric("main.profile.skills.exploration.next", "Next level: +{chance}% rare roll weight", { chance: nextChance }),
        max: createProfileSkillMetric("main.profile.skills.exploration.max", "Max: +100% rare extra-drop roll weight", {}),
        formula: createProfileSkillMetric("main.profile.skills.exploration.formula", "Rare roll weight bonus = Lv x 10%; extra drops gain 1 XP when triggered", {}),
      };
    },
  },
  {
    id: "stamina",
    tone: "lime",
    xpBase: 105,
    xpGrowth: 1.5,
    metrics(level) {
      const reduction = level * 4;
      const nextReduction = Math.min(profileSkillMaxLevel, level + 1) * 4;
      return {
        current: createProfileSkillMetric("main.profile.skills.stamina.current", "{reduction}% lower mining and movement fatigue", { reduction }),
        next: createProfileSkillMetric("main.profile.skills.stamina.next", "Next level: {reduction}% lower fatigue", { reduction: nextReduction }),
        max: createProfileSkillMetric("main.profile.skills.stamina.max", "Max: 40% lower fatigue", {}),
        formula: createProfileSkillMetric("main.profile.skills.stamina.formula", "Fatigue cost reduction = Lv x 4%", {}),
      };
    },
  },
  {
    id: "strength",
    tone: "orange",
    xpBase: 145,
    xpGrowth: 1.59,
    metrics(level) {
      const liftKg = 8 + level * 4;
      const nextLiftKg = 8 + Math.min(profileSkillMaxLevel, level + 1) * 4;
      return {
        current: createProfileSkillMetric("main.profile.skills.strength.current", "{kg} kg one-hand lift control", { kg: liftKg }),
        next: createProfileSkillMetric("main.profile.skills.strength.next", "Next level: {kg} kg one-hand control", { kg: nextLiftKg }),
        max: createProfileSkillMetric("main.profile.skills.strength.max", "Max: 48 kg one-hand lift control", {}),
        formula: createProfileSkillMetric("main.profile.skills.strength.formula", "Grip lift control = 8 kg + Lv x 4 kg; later combines mass, gravity and torque", {}),
      };
    },
  },
  {
    id: "appraisal",
    tone: "gold",
    xpBase: 160,
    xpGrowth: 1.62,
    metrics(level) {
      const traits = 2 + level;
      const nextTraits = 2 + Math.min(profileSkillMaxLevel, level + 1);
      return {
        current: createProfileSkillMetric("main.profile.skills.appraisal.current", "Reveals {traits} material traits", { traits }),
        next: createProfileSkillMetric("main.profile.skills.appraisal.next", "Next level: reveals {traits} traits", { traits: nextTraits }),
        max: createProfileSkillMetric("main.profile.skills.appraisal.max", "Max: reveals 12 material traits", {}),
        formula: createProfileSkillMetric("main.profile.skills.appraisal.formula", "Visible traits = 2 + Lv; supports rare materials and civilization rules", {}),
      };
    },
  },
];

let selectedProfileSkillId = playerSkillDefinitions[0]?.id ?? "";

function profileSkillStorageKey() {
  const session = getGameSession();
  const owner = session.walletAddress || session.username || "guest";
  return `${profileSkillStoragePrefix}${owner}`;
}

function loadProfileSkillLevels() {
  try {
    const raw = window.localStorage.getItem(profileSkillStorageKey()) || window.localStorage.getItem("nicechunk.playerSkills");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function profileSkillXpStorageKey() {
  const session = getGameSession();
  const owner = session.walletAddress || session.username || "guest";
  return `${profileSkillXpStoragePrefix}${owner}`;
}

function loadProfileSkillXp() {
  try {
    const raw = window.localStorage.getItem(profileSkillXpStorageKey()) || window.localStorage.getItem("nicechunk.playerSkillXp");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function profileSkillLevel(levels, skillId) {
  const raw = Number(levels?.[skillId] ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.round(clampNumber(raw, 0, profileSkillMaxLevel));
}

function profileSkillExperienceRequirement(skill, level) {
  if (level >= profileSkillMaxLevel) return 0;
  const nextLevel = Math.max(1, Math.min(profileSkillMaxLevel, level + 1));
  return Math.round((skill.xpBase ?? 100) * profileSkillXpRequirementMultiplier * Math.pow(nextLevel, skill.xpGrowth ?? 1.55));
}

function profileSkillTotalExperienceForLevel(skill, level) {
  let total = 0;
  const capped = Math.max(0, Math.min(profileSkillMaxLevel, Math.round(level)));
  for (let previousLevel = 0; previousLevel < capped; previousLevel += 1) {
    total += profileSkillExperienceRequirement(skill, previousLevel);
  }
  return total;
}

function profileSkillExperienceProgress(skill, level, xpBySkill) {
  const minimumTotal = profileSkillTotalExperienceForLevel(skill, level);
  const rawTotal = Number(xpBySkill?.[skill.id] ?? minimumTotal);
  const total = Number.isFinite(rawTotal) ? Math.max(0, Math.round(rawTotal)) : minimumTotal;
  const required = profileSkillExperienceRequirement(skill, level);
  if (level >= profileSkillMaxLevel) {
    return {
      total,
      current: 0,
      required: 0,
      label: gameText("main.profile.skillXpMax", "Total XP {xp}", { xp: formatProfileSkillXp(total) }),
    };
  }
  const current = Math.max(0, Math.min(required, total - minimumTotal));
  return {
    total,
    current,
    required,
    label: gameText("main.profile.skillXpProgress", "XP {current}/{required}", {
      current: formatProfileSkillXp(current),
      required: formatProfileSkillXp(required),
    }),
  };
}

function profileSkillLevelFromXp(skill, xp) {
  const total = Math.max(0, Math.round(Number(xp) || 0));
  let level = 0;
  for (let nextLevel = 1; nextLevel <= profileSkillMaxLevel; nextLevel += 1) {
    if (total < profileSkillTotalExperienceForLevel(skill, nextLevel)) break;
    level = nextLevel;
  }
  return level;
}

function profileSkillEffectiveLevel(levels, skill, xpBySkill) {
  if (Number.isFinite(Number(xpBySkill?.[skill.id]))) {
    return profileSkillLevelFromXp(skill, xpBySkill[skill.id]);
  }
  return profileSkillLevel(levels, skill.id);
}

function profileSkillTierLabel(skill, targetLevel) {
  const previousLevel = Math.max(0, Math.min(profileSkillMaxLevel - 1, targetLevel - 1));
  return gameText("main.profile.skillXpTier", "Lv.{level}: {xp} XP", {
    level: targetLevel,
    xp: formatProfileSkillXp(profileSkillExperienceRequirement(skill, previousLevel)),
  });
}

function profileSkillText(metric) {
  return gameText(metric.key, metric.fallback, metric.params);
}

function appendProfileSkillMetric(parent, className, labelKey, labelFallback, text) {
  const item = document.createElement("div");
  item.className = className;
  const label = document.createElement("span");
  label.textContent = gameText(labelKey, labelFallback);
  const value = document.createElement("strong");
  value.textContent = text;
  item.append(label, value);
  parent.append(item);
}

function appendProfileSkillDetailMetric(parent, labelKey, labelFallback, text, className = "") {
  appendProfileSkillMetric(parent, `profile-skill-metric ${className}`.trim(), labelKey, labelFallback, text);
}

function renderProfileSkillDetail(skill, level, metrics, xpProgress) {
  if (!profileSkillDetail) return;
  profileSkillDetail.hidden = false;
  profileSkillDetail.dataset.skillTone = skill.tone;
  profileSkillDetail.replaceChildren();

  const header = document.createElement("header");
  header.className = "profile-skill-detail-header";
  header.append(createProfileSkillIcon(skill));
  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = gameText(`main.profile.skills.${skill.id}.name`, skill.id);
  const levelLabel = document.createElement("span");
  levelLabel.textContent = gameText("main.profile.skillLevel", "Lv. {level}/{max}", { level, max: profileSkillMaxLevel });
  const xpLabel = document.createElement("small");
  xpLabel.className = "profile-skill-xp-inline";
  xpLabel.textContent = xpProgress.label;
  titleWrap.append(title, levelLabel, xpLabel);
  header.append(titleWrap);

  const description = document.createElement("p");
  description.className = "profile-skill-detail-description";
  description.textContent = gameText(`main.profile.skills.${skill.id}.description`, "");

  const progress = document.createElement("div");
  progress.className = "profile-skill-progress profile-skill-detail-progress";
  const progressFill = document.createElement("span");
  progressFill.style.width = `${(level / profileSkillMaxLevel) * 100}%`;
  progress.append(progressFill);

  const metricsGrid = document.createElement("div");
  metricsGrid.className = "profile-skill-detail-metrics";
  appendProfileSkillDetailMetric(metricsGrid, "main.profile.skillCurrent", "Current", profileSkillText(metrics.current), "profile-skill-current");
  appendProfileSkillDetailMetric(
    metricsGrid,
    level >= profileSkillMaxLevel ? "main.profile.skillMaxed" : "main.profile.skillNext",
    level >= profileSkillMaxLevel ? "Max level" : "Next",
    level >= profileSkillMaxLevel ? gameText("main.profile.skillMaxed", "Max level") : profileSkillText(metrics.next),
  );
  appendProfileSkillDetailMetric(metricsGrid, "main.profile.skillCap", "Cap", profileSkillText(metrics.max));
  appendProfileSkillDetailMetric(metricsGrid, "main.profile.skillFormula", "Rule", profileSkillText(metrics.formula), "profile-skill-formula");

  const xpPanel = document.createElement("section");
  xpPanel.className = "profile-skill-xp-panel";
  const xpTitle = document.createElement("h4");
  xpTitle.textContent = gameText("main.profile.skillXpTitle", "Experience");
  const xpSource = document.createElement("p");
  xpSource.textContent = gameText(`main.profile.skills.${skill.id}.xpSource`, "");
  const xpTierTitle = document.createElement("strong");
  xpTierTitle.textContent = gameText("main.profile.skillXpTiers", "Upgrade XP tiers");
  const xpTiers = document.createElement("div");
  xpTiers.className = "profile-skill-xp-tiers";
  Array.from({ length: profileSkillMaxLevel }, (_entry, index) => index + 1).forEach((targetLevel) => {
    const tier = document.createElement("span");
    tier.textContent = profileSkillTierLabel(skill, targetLevel);
    xpTiers.append(tier);
  });
  xpPanel.append(xpTitle, xpSource, xpTierTitle, xpTiers);

  profileSkillDetail.append(header, description, progress, metricsGrid, xpPanel);
  profileSkillDetail.scrollTop = 0;
}

function renderProfileSkills() {
  if (!profileSkillsGrid) return;
  const levels = loadProfileSkillLevels();
  const xpBySkill = {
    ...loadProfileSkillXp(),
    ...(profileChainSkillXp ?? {}),
  };
  if (!playerSkillDefinitions.some((skill) => skill.id === selectedProfileSkillId)) {
    selectedProfileSkillId = playerSkillDefinitions[0]?.id ?? "";
  }
  profileSkillsGrid.replaceChildren();
  for (const skill of playerSkillDefinitions) {
    const level = profileSkillEffectiveLevel(levels, skill, xpBySkill);
    const progress = (level / profileSkillMaxLevel) * 100;
    const metrics = skill.metrics(level);
    const xpProgress = profileSkillExperienceProgress(skill, level, xpBySkill);
    const selected = skill.id === selectedProfileSkillId;
    const card = document.createElement("button");
    card.className = "profile-skill-card profile-skill-row";
    card.type = "button";
    card.dataset.skillTone = skill.tone;
    card.classList.toggle("active", selected);
    card.setAttribute("aria-pressed", String(selected));
    card.addEventListener("click", () => {
      selectedProfileSkillId = skill.id;
      renderProfileSkills();
    });

    const head = document.createElement("div");
    head.className = "profile-skill-card-head";
    const icon = createProfileSkillIcon(skill);
    const titleWrap = document.createElement("div");
    titleWrap.className = "profile-skill-title";
    const title = document.createElement("h3");
    title.textContent = gameText(`main.profile.skills.${skill.id}.name`, skill.id);
    const levelLabel = document.createElement("span");
    levelLabel.textContent = gameText("main.profile.skillLevel", "Lv. {level}/{max}", { level, max: profileSkillMaxLevel });
    titleWrap.append(title, levelLabel);
    head.append(icon, titleWrap);

    const progressTrack = document.createElement("div");
    progressTrack.className = "profile-skill-progress";
    const progressFill = document.createElement("span");
    progressFill.style.width = `${progress}%`;
    progressTrack.append(progressFill);
    card.append(head, progressTrack);
    profileSkillsGrid.append(card);
    if (selected) renderProfileSkillDetail(skill, level, metrics, xpProgress);
  }
}

function invalidateProfileChainSkillXp() {
  profileChainSkillXpOwner = "";
  profileChainSkillXp = null;
  profileChainSkillXpPromise = null;
  profileChainSkillXpRequestId += 1;
}

function refreshProfileChainSkillXp({ force = false } = {}) {
  if (!profilePanel || profilePanel.hidden) return;
  if (!isNicechunkChainFeatureEnabled()) return;
  const session = getGameSession();
  const owner = session.walletAddress;
  if (!owner) {
    invalidateProfileChainSkillXp();
    return;
  }
  if (!force && profileChainSkillXpOwner === owner && profileChainSkillXp) return;
  if (profileChainSkillXpPromise && profileChainSkillXpOwner === owner) return;
  profileChainSkillXpOwner = owner;
  const requestId = profileChainSkillXpRequestId + 1;
  profileChainSkillXpRequestId = requestId;
  profileChainSkillXpPromise = loadNicechunkChainModule()
    .then((chainModule) => chainModule.fetchPlayerProgress?.(owner))
    .then((progress) => {
      if (profileChainSkillXpRequestId !== requestId || profileChainSkillXpOwner !== owner) return;
      profileChainSkillXp = {
        precisionGathering: Math.max(0, Math.round(Number(progress?.precisionGatheringXp) || 0)),
        smelting: Math.max(0, Math.round(Number(progress?.smeltingXp) || 0)),
        exploration: Math.max(0, Math.round(Number(progress?.explorationXp) || 0)),
      };
      if (profilePanel && !profilePanel.hidden) renderProfileSkills();
    })
    .catch((error) => {
      console.warn("Failed to load NiceChunk player progress", error);
    })
    .finally(() => {
      if (profileChainSkillXpRequestId === requestId) profileChainSkillXpPromise = null;
    });
}

function withStartupTimeout(promise, timeoutMs, label) {
  let timeoutId = 0;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

async function initializeWorldConfig() {
  setGameLoadingStage("worldConfig", 28);
  try {
    const { loadGlobalConfig } = await import("./chain/nicechunkChain.js");
    const config = await withStartupTimeout(loadGlobalConfig(), startupWorldConfigTimeoutMs, "world-config");
    applyWorldConfigFromChain(config);
    const worldSeed = config.worldSeedHex ?? bufferToHex(config.worldSeed);
    setWorldSeed(worldSeed);
    setCanonicalWorldConfig(config);
    persistPlayWorldSeed(worldSeed);
    pendingWorldMapSeed = worldSeed;
    if (activeWorldMapSignature) setActiveWorldMapSignature(worldSeed);
    window.NiceChunkWorldConfig = config;
  } catch (error) {
    console.warn("NiceChunk world config refresh unavailable; using bundled world config", error);
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
  syncGameChromeState();
  window.setTimeout(() => {
    gameLoadingOverlay?.classList.add("loaded");
    syncGameChromeState();
  }, 220);
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
    updateProfileRpcDetails();
    if (rpcConfigPanel) rpcConfigPanel.hidden = true;
  });

  rpcConfigDismiss?.addEventListener("click", () => {
    if (rpcConfigPanel) rpcConfigPanel.hidden = true;
  });

  window.addEventListener(rpcConfigChangedEventName, () => {
    if (rpcConfigApiKey) rpcConfigApiKey.value = getStoredHeliusApiKey();
    updateProfileRpcDetails();
  });
}

function showRpcConfigPanel(statusKey, statusFallback, statusParams = {}) {
  rpcConfigState.statusKey = statusKey;
  rpcConfigState.statusFallback = statusFallback;
  rpcConfigState.statusParams = statusParams;
  if (rpcConfigApiKey) rpcConfigApiKey.value = getStoredHeliusApiKey();
  updateRpcConfigStatusText();
  if (rpcConfigPanel) rpcConfigPanel.hidden = false;
}

function updateRpcConfigStatusText(extraParams = {}) {
  if (!rpcConfigStatus || !rpcConfigState.statusKey) return;
  const params = { ...rpcConfigState.statusParams, ...extraParams };
  rpcConfigStatus.textContent = gameText(rpcConfigState.statusKey, rpcConfigState.statusFallback, params);
}

let pendingWorldMapSeed = defaultWorldSeed;
let activeWorldMapSignature = "";
const startupWorldConfigPromise = initializeWorldConfig();
setGameLoadingStage("engine", 42);

const coarsePointerMedia = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)") : null;
let mobileViewport = Boolean(coarsePointerMedia?.matches) || window.innerWidth <= 760;
const scene = new THREE.Scene();
const normalSkyColor = new THREE.Color(0x8fc8e8);
const guardianFogSkyColor = new THREE.Color(0x34383b);
const normalSceneFog = new THREE.Fog(0x8fc8e8, 52, 160);
const guardianSceneFog = new THREE.FogExp2(0x3b3f42, 0.034);
const guardianAreaFog = new THREE.Fog(0x7a7f82, 28, 102);
scene.background = normalSkyColor;
scene.fog = normalSceneFog;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.035, 1300);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xeef8ff, 0x6d7b45, 2.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4c2, 2.1);
sun.position.set(-26, 42, 18);
sun.castShadow = false;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
scene.add(sun);

const generatedChunks = new Map();
const preloadedChunks = new Map();
const placeholderChunks = new Map();
const placeholderBatchGroup = new THREE.Group();
placeholderBatchGroup.name = "chunk-placeholder-batch";
const chunkWorkerBuilds = new Map();
const chunkWorkerBuildsById = new Map();
const chunkRenderDataCache = new Map();
const pendingChunkCommits = [];
let pendingChunkCommitCursor = 0;
let pendingChunkKeys = [];
let pendingPreloadChunkKeys = [];
let pendingPlaceholderChunkKeys = [];
const pendingPlaceholderChunkKeySet = new Set();
let pendingChunkRebuildKeys = [];
let pendingChunkRefreshKeys = [];
let lastChunkRenderCommitAt = -Infinity;
let placeholderBatchNeedsMaintenance = false;
let lastPlaceholderMaintenanceAt = -Infinity;
const chunkViewState = {
  centerKey: "",
};
const knownChunks = new Map();
const chunkChainSync = new Map();
const chunkChainSyncBatchSize = 50;
const chunkChainSyncRetryMs = 8000;
const chunkChainViewportRescanMs = 750;
const movementChainQuietWindowMs = 1200;
const miningChainQuietWindowMs = 8000;
const chainSyncStorageKey = "nicechunk.chainSync";
const chainEventLogMaxRows = 6;
const chainEventSuccessRemovalMs = 6_000;
const chainEventFailureRemovalMs = 30_000;
let nicechunkChainModulePromise = null;
let chunkWorkers = [];
let nextChunkWorkerIndex = 0;
let chunkWorkerRequestId = 0;
let chunkChainViewportCenterKey = "";
let chunkChainViewportLastScanAt = 0;
let chunkChainViewportLoading = false;
let realtimeChunkSubscription = null;
let realtimeChunkKey = null;
let realtimeChunkAppliedSequence = 0;
let gameplaySessionStatus = null;
let gameplaySessionStatusLoading = false;
let gameplaySessionStatusLastLoadedAt = 0;
let lastMovementInteractionAt = -Infinity;
let lastMiningInteractionAt = -Infinity;
let equippedBackpackStatus = null;
let equippedBackpackLoading = false;
let equippedBackpackLastLoadedAt = 0;
let sessionFundingDialogResolve = null;
const generatedCloudSectors = new Map();
const cloudUpdateState = { sectorX: null, sectorZ: null };
const worldState = createWorldState();
const { solidBlocks, removedBlocks, pendingMinedBlocks, placedBlocks, blockDamage } = worldState;
const breakParticles = [];
const fallingTreeResourceBlocks = [];
const breakParticlePools = new Map();
const fallingTreeResourcePools = new Map();
const dirtyBreakParticlePools = new Set();
const dirtyFallingTreeResourcePools = new Set();
const surfaceHeightFrameCache = new Map();
const worldEditIndex = {
  version: -1,
  removedByChunk: new Map(),
  pendingByChunk: new Map(),
  placedByChunk: new Map(),
  dynamicWaterByChunk: new Map(),
  scopedCache: new Map(),
};
let worldQueryFrameId = 0;
let surfaceHeightCacheFrameId = -1;
let worldEditVersion = 0;
const clock = new THREE.Clock();
const world = new THREE.Group();
scene.add(world);
world.add(placeholderBatchGroup);
const clouds = new THREE.Group();
clouds.name = "clouds";
scene.add(clouds);
const clickRaycaster = new THREE.Raycaster();
const previewRaycaster = new THREE.Raycaster();
const raycastPointerVector = new THREE.Vector2();
const raycastHitNormal = new THREE.Vector3();
const greedyHitInsidePoint = new THREE.Vector3();
const raycastHits = [];
const clickRaycastFar = 96;
const clickRaycastChunkRadius = Math.ceil(clickRaycastFar / chunkSize) + 1;
const placementPreviewRaycastFar = 36;
const placementPreviewRaycastChunkRadius = 2;
let placementPreviewPointer = null;
let placementPreviewFrame = 0;

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const breakParticleTransform = new THREE.Object3D();
const fallingTreeResourceTransform = new THREE.Object3D();
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
const hotbarSlots = loadStoredHotbarSlots() ?? createInitialHotbarSlots();
const backpackSlotTotal = 50;
const backpackDemoSlots = createInitialBackpackSlots();
const backpackSlotCache = {
  signature: "",
  slots: [],
};
const availableBackpackSlotCache = {
  signature: "",
  slots: [],
};
const backpackPreviewInitialCountDesktop = 16;
const backpackPreviewInitialCountMobile = 8;
const backpackPreviewBatchSizeDesktop = 8;
const backpackPreviewBatchSizeMobile = 4;
let backpackPreviewHydrationToken = 0;
let backpackSelectedSourceItemId = "";
const backpackDiscardingSlotIndexes = new Set();
const backpackSelectedSlotIndexes = new Set();
let backpackSelectionMode = false;
let backpackDiscardingBatch = false;
let backpackContextMenu = null;
const backpackGridRenderState = {
  capacity: 0,
  signatures: [],
};
const marketListedSourceIdCache = {
  signature: "",
  ids: new Set(),
};
let latestForgedItem = null;
let onChainForgedLoadoutItem = null;
let onChainForgedLoadoutLoading = false;
let onChainForgedLoadoutLastLoadedAt = 0;
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
    handlePickaxeClick(hit, event.pointerType);
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
const marketCategories = ["all", "raw", "equipment", "building", "clothing"];
const marketPageSizeByTab = {
  browse: 12,
  orders: 12,
};
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
    category: "clothing",
    currency: "NCK",
    price: "3.20",
    iconType: "clothing",
    source: "sample",
  },
];
const marketPageState = {
  browse: 1,
  orders: 1,
};
const marketSortOptions = ["newest", "oldest", "price-asc", "price-desc"];
const marketCurrencyOptions = ["all", "NCK", "SOL"];
let marketSelectedCategory = "all";
let marketSelectedSort = "newest";
let marketSelectedCurrency = "all";
let marketSelectedListingItem = null;
let marketDetailDialog = null;
let marketDetailState = {
  listing: null,
  order: false,
  tabName: null,
};
let marketListingSubmitting = false;
let marketCancelingListingId = null;
let marketBuyingListingId = null;
let marketChainListings = [];
let marketChainListingsLoading = false;
let marketChainListingsLoadedAt = 0;
let marketChainListingsFilterKey = "";
let marketChainListingsError = null;
let marketChainListingsRefreshPending = false;
const smeltingProgressDurationMs = 3200;
const smeltingInputSourceItemIds = [];
const smeltingFuelSourceItemIds = [];
let smeltingProgressTimer = null;
let smeltingProgressStartedAt = 0;
let smeltingProgress = 0;
let smeltingState = "idle";
let smeltingActiveInputSlots = [];
let smeltingActiveFuelSlots = [];
let smeltingLastStatusText = "";
let smeltingLastStartText = "";
let smeltingLastProgressValue = "";
let smeltingResourceRenderSignature = "";
let smeltingFuelRenderSignature = "";
let smeltingWorkbenchRenderSignature = "";
let smeltingOutputRenderSignature = "";
let smeltingUpdateFrame = 0;
let smeltingDeferredRefreshFrame = 0;
let smeltingDeferredRefreshTimer = 0;
let smeltingResourceRenderToken = 0;
let smeltingMobileTab = "backpack";
let smeltingMobileSelectedSourceItemId = "";
let smeltingMobileResourceFilter = "all";
let smeltingMobileRecipeFilter = "all";
let smeltingRecipeRenderSignature = "";
let smeltingMobileDrawerSignature = "";
let smeltingFlameVisuals = null;
let smeltingFlameAnimationFrame = 0;
let smeltingFlameIntensity = 0.08;

const playerPositionStorageKey = "nicechunk.playerPosition.v1";
const playerPositionStorageVersion = 2;
const maxSavedPlayerHeightAboveGround = 2;
const currentSession = getGameSession();
const savedPlayerState = loadSavedPlayerState();
const guardianSpawnState = shouldUseGuardianSpawnForSession(currentSession)
  ? getNiceChunkGuardianSpawnState({ chunkSize, surfaceHeight })
  : null;
if (guardianSpawnState) markGuardianSpawnForSession(currentSession);
const initialPlayerState = guardianSpawnState ?? savedPlayerState;
const player = {
  position: vectorFromPlayerState(initialPlayerState) ?? new THREE.Vector3(0, surfaceHeight(0, 0) + 1.01, 0),
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
  miningPreviousToolBoxCount: 0,
  miningToolSlot: null,
};

const avatarGroundOffset = 0.5;
const playerRadius = 0.36;
const playerBodyTopOffset = 1;
const gravity = 24;
const jumpImpulse = 9.2;
const stepBlockEpsilon = 0.08;
const autoStepHeight = 1.08;
const autoJumpHeight = 1.65;
const playerGroundProbeDepth = 8;
const playerCollisionRecoveryLift = 3.25;
const playerCollisionRecoverySearchRadius = 3;
const playerFallRecoveryDepth = 18;
const autoJumpRetryMs = 420;
const autoJumpCommitMs = 760;
const autoDirectPathSampleSpacing = 0.35;
const autoPathSearchRadius = 72;
const autoPathMaxNodes = 1800;
const miningSwingDuration = 260;
const miningStandDistance = 1.28;
const miningCollisionStartProgress = 0.22;
const miningBlockCollisionPadding = 0.06;
const miningReachBlockHalfDiagonal = Math.sqrt(3) * 0.5;
const miningReachDefaultToolRadius = 1.15;
const miningReachMinimumRadius = 0.18;
const miningToolGripAnchor = new THREE.Vector3(0, -0.99, 0);
const miningReachScratchBox = new THREE.Box3();
const miningReachScratchCenter = new THREE.Vector3();
const miningReachScratchGrip = new THREE.Vector3();
const miningReachScratchCorner = new THREE.Vector3();
const miningReachScratchSphere = new THREE.Sphere();
const miningToolCurrentBoxPool = Array.from({ length: 4 }, () => new THREE.Box3());
const miningToolCurrentBoxes = [];
const miningToolPreviousBoxPool = Array.from({ length: 4 }, () => new THREE.Box3());
const miningToolBlockBox = new THREE.Box3();
const miningToolSweptBox = new THREE.Box3();
const miningToolWorldScale = new THREE.Vector3();
const miningToolHitCenter = new THREE.Vector3();
const placementReach = 3;
const lowPowerChunkLoading = isMobileViewport();
const visualCloudRenderRadius = lowPowerChunkLoading ? 160 : 256;
const initialChunkRadius = 1;
const chunkBuildBudget = lowPowerChunkLoading ? 4 : 10;
const chunkBuildBudgetMs = lowPowerChunkLoading ? 8 : 14;
const chunkWorkerPoolSize = Math.max(1, Math.min(lowPowerChunkLoading ? 2 : 6, (navigator.hardwareConcurrency ?? 4) - 1));
const maxChunkWorkerBuilds = chunkWorkerPoolSize;
const maxChunkRenderDataCacheEntries = lowPowerChunkLoading ? 48 : 128;
const chunkCommitBudget = lowPowerChunkLoading ? 2 : 8;
const chunkCommitBudgetMs = lowPowerChunkLoading ? 6 : 12;
const movingChunkCommitBudget = lowPowerChunkLoading ? 2 : 3;
const movingChunkCommitBudgetMs = lowPowerChunkLoading ? 4.5 : 8;
const chunkCommitScanLimit = lowPowerChunkLoading ? 48 : 96;
const movingChunkCommitScanLimit = lowPowerChunkLoading ? 64 : 160;
const chunkRenderCommitIntervalMs = lowPowerChunkLoading ? 48 : 16;
const movingChunkRenderCommitIntervalMs = lowPowerChunkLoading ? 80 : 32;
const placeholderChunkBuildBudget = lowPowerChunkLoading ? 8 : 16;
const placeholderChunkBuildBudgetMs = lowPowerChunkLoading ? 3 : 5;
const placeholderTopYOffset = 0.49;
const placeholderMaintenanceDelayMs = lowPowerChunkLoading ? 260 : 160;
const placeholderMaintenanceIntervalMs = lowPowerChunkLoading ? 320 : 180;
const movingPlaceholderRadius = renderDistance;
const preemptiveChunkRefreshBudget = 1;
const earlyDistantDetailRefreshRadius = lowPowerChunkLoading ? 3 : 4;
const maxBreakParticles = lowPowerChunkLoading ? 48 : 120;
const preloadDistance = renderDistance + 3;
const preloadChunkBuildBudget = lowPowerChunkLoading ? 2 : 4;
const movingPreloadChunkBuildBudget = lowPowerChunkLoading ? 1 : 2;
const chunkRefreshBudget = lowPowerChunkLoading ? 2 : 5;
const startupChunkLoadRadius = initialChunkRadius;
const maxFallingTreeResourceBlocks = lowPowerChunkLoading ? 96 : 220;
const fallingTreeResourceLifetime = 3.2;
const supportCollapseHorizontalRadius = lowPowerChunkLoading ? 5 : 7;
const supportCollapseDownReach = 8;
const supportCollapseUpReach = lowPowerChunkLoading ? 14 : 20;
const supportCollapseMaxBlocks = lowPowerChunkLoading ? 24 : 48;
const cameraPitchMin = -0.92;
const cameraPitchMax = 0.42;
const headPitchMin = -0.48;
const headPitchMax = 0.52;
const minimapScale = 1;
const largeMinimapMinScale = 0.35;
const largeMinimapMaxScale = 6;
const minimapUpdateMs = 120;
const minimapStorageKey = "nicechunk.knownMap.v1";
const minimapStorageVersion = 2;
const maxStoredKnownChunks = 1200;
const playerPositionSaveMs = 1000;
const minimapState = { lastDrawAt: 0, expanded: false, largeScale: 1 };
const minimapSaveState = { dirty: false, lastSaveAt: 0 };
const playerPositionSaveState = { lastSaveAt: 0, lastPayload: "" };
const knownChunkRestoreState = { pending: [], loading: false };
activeWorldMapSignature = worldMapSignature(pendingWorldMapSeed);
const largeMapDrag = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  viewX: 0,
  viewZ: 0,
};

const keys = new Set();
if (canvas) canvas.tabIndex = 0;
const mobileJoystickState = {
  active: false,
  pointerId: null,
  centerX: 0,
  centerY: 0,
  x: 0,
  y: 0,
};
const mobileJoystickRadius = 48;
const mobileJoystickDeadZone = 0.12;
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
const avatarNameTagMaxChars = 13;
const avatarNameTagCanvasMaxWidth = 512;
const avatarNameTagCanvasMinWidth = 176;
const avatarNameTagCanvasHeight = 112;
const avatarNameTagOffsetY = 3.48;
const avatarNameTagWorldPosition = new THREE.Vector3();
let localChatBubble = null;
const profilePreview = createProfilePreview();
const cameraFocus = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraDesiredPosition = new THREE.Vector3();
const cameraResolvedPosition = new THREE.Vector3();
const cameraSamplePosition = new THREE.Vector3();
const cameraLookTarget = new THREE.Vector3();
const cameraRayDirection = new THREE.Vector3();
const cameraOcclusionState = { blocked: false };
const playerInputVector = new THREE.Vector3();
const playerMoveForwardVector = new THREE.Vector3();
const playerMoveRightVector = new THREE.Vector3();
const playerMoveDirectionVector = new THREE.Vector3();
const playerAutoMoveVector = new THREE.Vector3();
const playerCollisionPushVector = new THREE.Vector3();
let cameraFocusReady = false;
let firstPersonCamera = false;
const firstPersonEyeHeight = 1.95;
const firstPersonCameraBackDistance = 0.34;
const firstPersonViewmodelOffset = new THREE.Vector3(0.74, 0.1, -1.52);
const firstPersonRightArmPose = {
  pitchOffset: 0.54,
  yawOffset: -0.18,
  rollOffset: -0.22,
};
const firstPersonRightArmPoseEuler = new THREE.Euler(
  firstPersonRightArmPose.pitchOffset,
  firstPersonRightArmPose.yawOffset,
  firstPersonRightArmPose.rollOffset,
);
const firstPersonRightArmPoseQuaternion = new THREE.Quaternion().setFromEuler(firstPersonRightArmPoseEuler);
const firstPersonViewmodelWorldPosition = new THREE.Vector3();
const firstPersonViewmodelMotionQuaternion = new THREE.Quaternion();
const firstPersonViewmodelParentQuaternion = new THREE.Quaternion();
const firstPersonViewmodelParentQuaternionInverse = new THREE.Quaternion();
const firstPersonViewmodelWorldQuaternion = new THREE.Quaternion();
const crackMarker = createCrackMarker();
scene.add(crackMarker);
const placementPreview = createPlacementPreview();
scene.add(placementPreview);
const miningDebug = createMiningDebug();
scene.add(miningDebug);
const fpsState = { frames: 0, lastTime: performance.now(), value: 0 };
const hudTextState = new Map();
const hudRenderState = { lastUpdateAt: -Infinity, signature: "" };
const hudUpdateMs = 100;
const hudAccountRefreshMs = 500;
let hudLastAccountRefreshAt = -Infinity;
let debugMiningEnabled = false;
window.NiceChunkDebugMining = debugMiningEnabled;
let selectedHotbarSlot = 0;
let hotbarDrag = null;
let backpackDrag = null;
let backpackSelectionDrag = null;
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
  if (event.code === "KeyE" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    toggleFirstPersonCamera();
    return;
  }
  if ((event.ctrlKey || event.metaKey || event.altKey) && isManualMovementKey(event.code)) return;
  if (isManualMovementKey(event.code)) {
    event.preventDefault();
    clearAutoMove();
    if (event.repeat && !keys.has(event.code)) return;
  }
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  if (isManualMovementKey(event.code)) event.preventDefault();
  keys.delete(event.code);
});
window.addEventListener("resize", resize);
if (coarsePointerMedia?.addEventListener) {
  coarsePointerMedia.addEventListener("change", refreshMobileViewport);
} else {
  coarsePointerMedia?.addListener?.(refreshMobileViewport);
}
window.addEventListener("focus", () => {
  const changed = syncLatestForgedItemState({ preferLocal: true });
  const queued = syncPendingForgedHotbarItems();
  const reset = resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  if (queued || reset) {
    renderHotbar();
    updateEquippedItem();
  }
  if (changed) updateProfilePanelDetails();
  if (!isMovementChainQuietActive() && !isMiningInteractionActive()) {
    if (profileOverlay && !profileOverlay.hidden) void refreshGameplaySessionHud();
    if (
      (profileOverlay && !profileOverlay.hidden) ||
      (backpackPanel && !backpackPanel.hidden) ||
      (smeltingPanel && !smeltingPanel.hidden) ||
      (marketPanel && !marketPanel.hidden)
    ) {
      void refreshEquippedBackpack();
    }
  }
});
window.addEventListener("blur", clearActiveMovementInput);
window.addEventListener("pagehide", clearActiveMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearActiveMovementInput();
});
window.addEventListener("storage", (event) => {
  if (event.key === hotbarSlotsStorageKey) {
    const stored = loadStoredHotbarSlots();
    if (stored) {
      hotbarSlots.splice(0, hotbarSlots.length, ...stored);
      renderHotbar();
      updateEquippedItem();
    }
    return;
  }
  if (event.key === forgedHotbarQueueStorageKey) {
    if (syncPendingForgedHotbarItems()) {
      renderHotbar();
      updateEquippedItem();
    }
    return;
  }
  if (event.key === forgedLoadoutRefreshStorageKey) {
    refreshForgedHotbarFromLocal();
    return;
  }
  if (event.key !== latestForgedItemStorageKey && event.key !== forgedItemsStorageKey) return;
  refreshForgedHotbarFromLocal();
});
window.addEventListener("beforeunload", () => {
  savePlayerPosition(true);
  saveKnownChunksToStorage(true);
  guardianClient.disconnect();
});
window.setInterval(() => {
  if (isMovementChainQuietActive()) return;
  if (isMiningInteractionActive()) return;
  if (profileOverlay && !profileOverlay.hidden) void refreshGameplaySessionHud();
  if (
    (profileOverlay && !profileOverlay.hidden) ||
    (backpackPanel && !backpackPanel.hidden) ||
    (smeltingPanel && !smeltingPanel.hidden) ||
    (marketPanel && !marketPanel.hidden)
  ) {
    void refreshEquippedBackpack();
  }
}, 30000);
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
profileRpcAction?.addEventListener("click", handleProfileRpcAction);
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
mobileJoystick?.addEventListener("pointerdown", handleMobileJoystickPointerDown, { passive: false });
mobileJoystick?.addEventListener("pointermove", handleMobileJoystickPointerMove, { passive: false });
mobileJoystick?.addEventListener("pointerup", handleMobileJoystickPointerUp, { passive: false });
mobileJoystick?.addEventListener("pointercancel", handleMobileJoystickPointerUp, { passive: false });
backpackOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeBackpackPanel();
});
backpackClose?.addEventListener("click", closeBackpackPanel);
backpackPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
backpackGrid?.addEventListener("pointerdown", handleBackpackPointerDown);
backpackGrid?.addEventListener("pointerover", handleBackpackDetailEvent);
backpackGrid?.addEventListener("focusin", handleBackpackDetailEvent);
backpackGrid?.addEventListener("contextmenu", handleBackpackContextMenu);
backpackPanel?.addEventListener("pointermove", handleBackpackPointerMove);
backpackPanel?.addEventListener("pointerup", handleBackpackPointerUp);
backpackPanel?.addEventListener("pointercancel", handleBackpackPointerCancel);
backpackPanel?.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("pointerdown", (event) => {
  if (!backpackContextMenu || backpackContextMenu.hidden) return;
  if (backpackContextMenu.contains(event.target)) return;
  closeBackpackContextMenu();
});
marketPhone?.addEventListener("click", openMarketPanel);
marketPhone?.addEventListener("pointerdown", (event) => event.stopPropagation());
marketPhone?.addEventListener("pointerup", (event) => event.stopPropagation());
marketOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeMarketPanel();
});
marketClose?.addEventListener("click", closeMarketPanel);
marketRefresh?.addEventListener("click", handleMarketRefreshClick);
marketPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
marketTabs.forEach((tab) => {
  tab.addEventListener("click", () => selectMarketTab(tab.dataset.marketTab || "browse"));
});
marketCategoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.marketCategory || "all";
    marketSelectedCategory = marketCategories.includes(category) ? category : "all";
    closeMarketListingDetails();
    resetMarketPages();
    updateMarketPanel();
  });
});
marketSearch?.addEventListener("input", () => {
  closeMarketListingDetails();
  resetMarketPages();
  updateMarketPanel();
});
marketSort?.addEventListener("change", () => {
  const sort = marketSort.value || "newest";
  marketSelectedSort = marketSortOptions.includes(sort) ? sort : "newest";
  closeMarketListingDetails();
  resetMarketPages();
  updateMarketPanel();
});
marketCurrencyFilter?.addEventListener("change", () => {
  const currency = marketCurrencyFilter.value || "all";
  marketSelectedCurrency = marketCurrencyOptions.includes(currency) ? currency : "all";
  closeMarketListingDetails();
  resetMarketPages();
  updateMarketPanel();
});
marketListingPrice?.addEventListener("input", updateMarketListingDraft);
marketListingCategory?.addEventListener("change", updateMarketListingDraft);
marketListingCurrency?.addEventListener("change", updateMarketListingDraft);
marketListingForm?.addEventListener("submit", handleCreateMarketListing);
smeltingPhone?.addEventListener("click", openSmeltingPanel);
smeltingPhone?.addEventListener("pointerdown", (event) => event.stopPropagation());
smeltingPhone?.addEventListener("pointerup", (event) => event.stopPropagation());
smeltingOverlay?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeSmeltingPanel();
});
smeltingClose?.addEventListener("click", closeSmeltingPanel);
smeltingPanel?.addEventListener("pointerdown", (event) => event.stopPropagation());
smeltingStart?.addEventListener("click", startSmeltingPreview);
smeltingResourceGrid?.addEventListener("click", handleSmeltingResourceGridClick);
smeltingResourceGrid?.addEventListener("dragstart", handleSmeltingResourceDragStart);
setupSmeltingDropZone(smeltingInputSlot, "input");
setupSmeltingDropZone(smeltingFuelSlot, "fuel");
smeltingMobileTabs.forEach((button) => {
  button.addEventListener("click", () => selectSmeltingMobileTab(button.dataset.smeltingMobileTab || "backpack"));
});
smeltingResourceFilters.forEach((button) => {
  button.addEventListener("click", () => {
    smeltingMobileResourceFilter = button.dataset.smeltingFilter || "all";
    resetSmeltingRenderSignatures();
    scheduleSmeltingPanelUpdate();
  });
});
smeltingRecipeFilters.forEach((button) => {
  button.addEventListener("click", () => {
    smeltingMobileRecipeFilter = button.dataset.smeltingRecipeFilter || "all";
    smeltingRecipeRenderSignature = "";
    scheduleSmeltingPanelUpdate();
  });
});
smeltingRecipeList?.addEventListener("click", handleSmeltingRecipeListClick);
smeltingMobileActionDrawer?.addEventListener("click", handleSmeltingMobileDrawerClick);
window.addEventListener("keydown", (event) => {
  if (event.target === chatInput) return;
  if (event.key !== "Escape") return;
  if (marketDetailDialog) {
    const tabName = marketDetailState.tabName || "browse";
    closeMarketListingDetails();
    renderMarketTabPage(tabName);
    return;
  }
  closeBackpackPanel();
  closeProfilePanel();
  closeMarketPanel();
  closeSmeltingPanel();
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
  canvas?.focus?.({ preventScroll: true });
  if (firstPersonCamera) {
    requestFirstPersonPointerLock();
    if (isPrimaryPointer(event)) handleWorldClick(event);
    return;
  }
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
  if (firstPersonCamera) return;
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
  if (firstPersonCamera) return;
  dragging = false;
  activePointerId = null;
});

window.addEventListener("pointermove", (event) => {
  if (firstPersonCamera) {
    if (!isInteractivePointerTarget(event.target)) schedulePlacementPreviewFromCenter();
    return;
  }
  if (!dragging && !isInteractivePointerTarget(event.target)) {
    schedulePlacementPreviewFromPointer(event);
  }
  if (!dragging) return;
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  event.preventDefault();
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  rotateCameraFromMouseDelta(dx, dy);
}, { passive: false });

window.addEventListener("mousemove", (event) => {
  if (!firstPersonCamera || isInteractivePointerTarget(event.target)) return;
  const dx = Number.isFinite(event.movementX) ? event.movementX : 0;
  const dy = Number.isFinite(event.movementY) ? event.movementY : 0;
  if (!dx && !dy) return;
  event.preventDefault();
  rotateCameraFromMouseDelta(dx, dy);
  schedulePlacementPreviewFromCenter();
}, { passive: false });

function rotateCameraFromMouseDelta(dx, dy) {
  player.yaw -= dx * 0.006;
  player.cameraPitch = THREE.MathUtils.clamp(player.cameraPitch - dy * 0.003, cameraPitchMin, cameraPitchMax);
}

function handleMobileJoystickPointerDown(event) {
  if (!isMobileViewport()) return;
  event.preventDefault();
  event.stopPropagation();
  mobileJoystickState.active = true;
  mobileJoystickState.pointerId = event.pointerId;
  const rect = mobileJoystick.getBoundingClientRect();
  mobileJoystickState.centerX = rect.left + rect.width / 2;
  mobileJoystickState.centerY = rect.top + rect.height / 2;
  mobileJoystick.setPointerCapture?.(event.pointerId);
  mobileJoystick.classList.add("active");
  updateMobileJoystickFromPointer(event);
  clearAutoMove();
}

function handleMobileJoystickPointerMove(event) {
  if (!mobileJoystickState.active || event.pointerId !== mobileJoystickState.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  updateMobileJoystickFromPointer(event);
}

function handleMobileJoystickPointerUp(event) {
  if (!mobileJoystickState.active || event.pointerId !== mobileJoystickState.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  resetMobileJoystick();
}

function updateMobileJoystickFromPointer(event) {
  const dx = event.clientX - mobileJoystickState.centerX;
  const dy = event.clientY - mobileJoystickState.centerY;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(distance, mobileJoystickRadius);
  const angle = distance > 0.001 ? Math.atan2(dy, dx) : 0;
  const normalized = distance > 0.001 ? clampedDistance / mobileJoystickRadius : 0;
  const strength = normalized < mobileJoystickDeadZone ? 0 : (normalized - mobileJoystickDeadZone) / (1 - mobileJoystickDeadZone);
  const visualX = Math.cos(angle) * clampedDistance;
  const visualY = Math.sin(angle) * clampedDistance;
  mobileJoystickState.x = strength > 0 ? Math.cos(angle) * strength : 0;
  mobileJoystickState.y = strength > 0 ? Math.sin(angle) * strength : 0;
  if (mobileJoystickKnob) {
    mobileJoystickKnob.style.transform = `translate(calc(-50% + ${visualX}px), calc(-50% + ${visualY}px))`;
  }
}

function resetMobileJoystick() {
  mobileJoystickState.active = false;
  mobileJoystickState.pointerId = null;
  mobileJoystickState.x = 0;
  mobileJoystickState.y = 0;
  mobileJoystick?.classList.remove("active");
  if (mobileJoystickKnob) {
    mobileJoystickKnob.style.transform = "translate(-50%, -50%)";
  }
}

runtimeUiReady = true;
if (i18nReady) refreshRuntimeI18nText();
syncEquippedBackpackSlot();
renderHotbar();
void refreshEquippedBackpack({ force: true });

requestAnimationFrame(startInitialWorld);

async function startInitialWorld() {
  await startupWorldConfigPromise;
  const configuredSavedPlayerState = !guardianSpawnState ? loadSavedPlayerState() : null;
  if (!guardianSpawnState && configuredSavedPlayerState) {
    player.position.copy(configuredSavedPlayerState.position);
    player.yaw = configuredSavedPlayerState.yaw;
    player.cameraPitch = configuredSavedPlayerState.cameraPitch;
  }
  const hasConfiguredInitialPlayerState = Boolean(guardianSpawnState || configuredSavedPlayerState);
  placePlayerOnGround(!hasConfiguredInitialPlayerState);
  prepareStartupChunkLoading(player.position);
  void withStartupTimeout(syncInitialChainViewport(player.position, { updateLoading: false, rebuildChanged: true }), startupChainSyncTimeoutMs, "initial-chain-sync").catch((error) => {
    console.warn("Initial NiceChunk chain sync skipped during startup", error);
  });
  setGameLoadingStage("chunks", 58);
  generateAround(player.position, { force: true });
  generateCloudsAround(player.position);
  startGuardianConnection();
  syncLatestForgedItemState();
  syncPendingForgedHotbarItems();
  resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  renderHotbar();
  selectHotbarSlot(selectedHotbarSlot);
  void refreshGameplaySessionHud({ force: true });
  animate();
  scheduleKnownChunkRestore();
}

async function syncInitialChainViewport(center, { updateLoading = true, rebuildChanged = false } = {}) {
  if (!isNicechunkChainFeatureEnabled()) return;
  const centerChunkX = Math.floor(center.x / chunkSize);
  const centerChunkZ = Math.floor(center.z / chunkSize);
  const chunks = collectSortedViewportChunks(centerChunkX, centerChunkZ, renderDistance);
  if (!chunks.length) return;

  if (updateLoading) {
    setGameLoadingStage("chainSync", 44);
    chunkChainViewportLoading = true;
  }
  const syncStartedAt = performance.now();
  for (const chunk of chunks) {
    const key = chunkKey(chunk.chunkX, chunk.chunkZ);
    const previous = chunkChainSync.get(key);
    chunkChainSync.set(key, {
      key,
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
      loading: true,
      loadedAt: previous?.loadedAt ?? 0,
      failedAt: 0,
      appliedSequence: previous?.appliedSequence ?? 0,
    });
  }
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
        const changed = await applyChunkChainDeltas(deltas, previous?.appliedSequence ?? 0);
        chunkChainSync.set(key, {
          key,
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
          loading: false,
          loadedAt,
          failedAt: 0,
          appliedSequence: Math.max(previous?.appliedSequence ?? 0, maxSequence),
        });
        if (changed && rebuildChanged) rebuildChunkByKey(key);
        else markLoadedChunkForMinimap({ key, chunkX: chunk.chunkX, chunkZ: chunk.chunkZ, refresh: changed });
      }
      const progress = (batchIndex + 1) / totalBatches;
      if (updateLoading) setGameLoadingStage("chainSync", 44 + progress * 12);
    }
    chunkChainViewportCenterKey = chunkKey(centerChunkX, centerChunkZ);
  } catch (error) {
    console.warn("Failed to load initial NiceChunk chunk PDA viewport", error);
    const failedAt = performance.now();
    for (const chunk of chunks) {
      const key = chunkKey(chunk.chunkX, chunk.chunkZ);
      const previous = chunkChainSync.get(key);
      chunkChainSync.set(key, {
        key,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        loading: false,
        loadedAt: previous?.loadedAt ?? 0,
        failedAt,
        appliedSequence: previous?.appliedSequence ?? 0,
      });
    }
  } finally {
    if (updateLoading) chunkChainViewportLoading = false;
    chunkChainViewportLastScanAt = syncStartedAt;
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
  previewRoot.position.set(0, -0.82, 0);
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
    dirty: true,
  };
}

function isInteractivePointerTarget(target) {
  return target instanceof Element && Boolean(target.closest("button, input, select, textarea, a, .mobile-joystick, .market-panel, .market-overlay, .market-phone, .smelting-panel, .smelting-overlay, .smelting-phone, .backpack-panel, .backpack-overlay, .profile-panel, .profile-overlay, .rpc-config-panel, .session-funding-panel, .session-funding-overlay"));
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

function syncLatestForgedItemState({ preferLocal = false } = {}) {
  const localItem = loadLatestForgedItem();
  const item = preferLocal
    ? localItem ?? onChainForgedLoadoutItem
    : onChainForgedLoadoutItem ?? localItem;
  const previousCode = latestForgedItem?.code ?? null;
  const nextCode = item?.code ?? null;
  if (previousCode === nextCode) return false;
  latestForgedItem = item;
  return true;
}

function syncPendingForgedHotbarItems() {
  const selectedWasEmpty = !hotbarSlots[selectedHotbarSlot];
  const result = consumePendingForgedHotbarItems(hotbarSlots, { avoidSlotIndex: selectedHotbarSlot });
  if (selectedWasEmpty && result.addedSlots.includes(selectedHotbarSlot)) {
    const fallback = hotbarSlots.findIndex((slot, index) => index !== selectedHotbarSlot && slot && !isBackpackHotbarSlot(index));
    if (fallback >= 0) selectedHotbarSlot = fallback;
  }
  return result.changed;
}

function refreshForgedHotbarFromLocal() {
  const changed = syncLatestForgedItemState({ preferLocal: true });
  const queued = syncPendingForgedHotbarItems();
  const reset = resetHotbarForResourceSimulation(hotbarSlots, hotbarItems);
  if (queued || reset) {
    renderHotbar();
    updateEquippedItem();
  }
  if (changed) updateProfilePanelDetails();
}

async function refreshPlayerLoadoutForgedItem({ force = false } = {}) {
  if (!isNicechunkChainFeatureEnabled() || !currentSession.walletAddress) return null;
  const now = performance.now();
  if (onChainForgedLoadoutLoading && !force) return onChainForgedLoadoutItem;
  if (!force && now - onChainForgedLoadoutLastLoadedAt < 14000) return onChainForgedLoadoutItem;
  onChainForgedLoadoutLoading = true;
  try {
    const chainModule = await loadNicechunkChainModule();
    const loadout = await chainModule.fetchPlayerLoadout?.(currentSession.walletAddress);
    const rightHandSlot = Number.isInteger(chainModule.playerLoadoutSlotRightHand)
      ? chainModule.playerLoadoutSlotRightHand
      : 7;
    const equippedSlot = loadout?.slots?.find((slot) => slot.slot === rightHandSlot && slot.equipped && slot.code);
    const previousCode = onChainForgedLoadoutItem?.code ?? null;
    let nextItem = null;
    if (equippedSlot?.code) {
      const bytes = Array.from(forgeCodeToBytes(equippedSlot.code));
      nextItem = {
        id: `onchain-forged-${rightHandSlot}`,
        source: "chain-loadout",
        slot: rightHandSlot,
        code: equippedSlot.code,
        bytes,
        byteLength: bytes.length,
        savedAt: Number(loadout?.updatedAt || 0) * 1000 || Date.now(),
        loadout: loadout?.publicKey ?? null,
      };
    }
    onChainForgedLoadoutItem = nextItem;
    onChainForgedLoadoutLastLoadedAt = performance.now();
    if ((nextItem?.code ?? null) !== previousCode) {
      syncLatestForgedItemState();
    }
    return onChainForgedLoadoutItem;
  } catch (error) {
    console.warn("Failed to refresh on-chain forged loadout", error);
    return onChainForgedLoadoutItem;
  } finally {
    onChainForgedLoadoutLoading = false;
  }
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
    itemCount: backpackFilledItemCount(backpack),
  });
  if (isBackpackHotbarSlot(selectedHotbarSlot)) selectFirstSelectableHotbarSlot();
}

function renderHotbar() {
  saveHotbarSlots(hotbarSlots);
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

function profileEquipmentEntries() {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const currentItem = heldItem();
  const currentSlot = heldSlot();
  const emptyValue = gameText("main.profile.equipment.emptySlot", "Empty");
  const emptyDetail = gameText("main.profile.equipment.emptySlotDetail", "No equipment assigned to this slot.");
  const emptySlot = (id, key, fallback) => ({
    id,
    name: gameText(`main.profile.equipment.${key}`, fallback),
    value: emptyValue,
    detail: emptyDetail,
  });
  const rightHandForgedCode = currentItem?.hand === "forged"
    ? (currentSlot?.code ?? currentSlot?.bytes ?? null)
    : null;
  const handValue = currentItem?.id === "empty" ? emptyValue : gameText(currentItem?.labelKey, currentItem?.id ?? "Empty");
  return [
    emptySlot("head", "head", "Head"),
    emptySlot("face", "face", "Face"),
    emptySlot("shoulder", "shoulder", "Shoulder"),
    emptySlot("wrist", "wrist", "Wrist"),
    emptySlot("chest", "chest", "Chest"),
    emptySlot("back", "back", "Back"),
    emptySlot("leftHand", "leftHand", "Left Hand"),
    {
      id: "rightHand",
      name: gameText("main.profile.equipment.rightHand", "Right Hand"),
      value: rightHandForgedCode ? gameText("main.item.forged_item", "Forged Item") : handValue,
      previewCode: rightHandForgedCode,
      detail: rightHandForgedCode
        ? gameText("main.profile.equipment.rightHandForgedDetail", "Equipped forged item. Appearance is rendered from its forged code.")
        : currentSlot
        ? gameText("main.profile.equipment.rightHandDetail", "Hotbar slot {slot}. Current action: {action}.", {
            slot: selectedHotbarSlot + 1,
            action: currentItem?.action ?? "none",
          })
        : gameText("main.profile.equipment.rightHandEmpty", "No item is currently held."),
    },
    emptySlot("legs", "legs", "Legs"),
    emptySlot("feet", "feet", "Feet"),
    {
      id: "backpack",
      name: gameText("main.profile.equipment.backpackSlot", "Backpack"),
      value: backpack
        ? gameText("main.profile.backpackEquipped", "{address} · {count}/{capacity}", {
            address: formatWalletAddress(backpack.publicKey),
            count: backpackFilledItemCount(backpack),
            capacity: backpack.capacity ?? backpackSlotTotal,
          })
        : gameText("main.profile.noBackpack", "No backpack equipped"),
      detail: backpack
        ? gameText("main.profile.equipment.backpackDetail", "Equipped inventory container. Capacity {count}/{capacity}.", {
            count: backpackFilledItemCount(backpack),
            capacity: backpack.capacity ?? backpackSlotTotal,
          })
        : gameText("main.profile.equipment.backpackEmpty", "Buy and equip a backpack before mining persistent resources."),
    },
  ];
}

function renderProfileEquipment() {
  if (!profileEquipmentList) return;
  profileEquipmentList.replaceChildren();
  for (const entry of profileEquipmentEntries()) {
    const item = document.createElement("article");
    item.className = "profile-equipment-item";
    item.dataset.equipment = entry.id;
    item.classList.toggle("has-rendered-preview", Boolean(entry.previewCode));
    const icon = createProfileEquipmentIcon(entry);
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.name;
    const value = document.createElement("span");
    value.textContent = entry.value;
    const detail = document.createElement("small");
    detail.textContent = entry.detail;
    copy.append(title, value, detail);
    item.append(icon, copy);
    profileEquipmentList.append(item);
  }
}

function openProfilePanel() {
  if (!profilePanel || !profileOverlay) return;
  profileOverlay.hidden = false;
  profilePanel.hidden = false;
  profileOverlay.setAttribute("aria-hidden", "false");
  profilePanel.setAttribute("aria-hidden", "false");
  syncGameChromeState();
  setProfileTab(profilePanel.dataset.activeProfileTab || "attributes");
  updateProfilePanelDetails({ forceChainSkillXp: true });
  if (profilePreview) {
    profilePreview.active = true;
    profilePreview.dirty = true;
  }
  resizeProfilePreview();
  renderProfilePreview();
}

function closeProfilePanel() {
  if (!profilePanel || !profileOverlay) return;
  profileOverlay.hidden = true;
  profilePanel.hidden = true;
  profileOverlay.setAttribute("aria-hidden", "true");
  profilePanel.setAttribute("aria-hidden", "true");
  syncGameChromeState();
  if (profilePreview) {
    profilePreview.active = false;
    profilePreview.dragging = false;
    profilePreview.pointerId = null;
  }
  profileModelContainer?.classList.remove("dragging");
}

function updateProfilePanelDetails({ forceChainSkillXp = false } = {}) {
  if (!profilePanel || profilePanel.hidden) return;
  const session = getGameSession();
  const level = 1;
  if (profileName) profileName.textContent = session.username || t("main.account.guest");
  if (profileLevel) profileLevel.textContent = t("main.account.level", { level });
  if (profileTitleValue) profileTitleValue.textContent = t("main.account.defaultTitle");
  if (profileWallet) profileWallet.textContent = session.walletAddress ? formatWalletAddress(session.walletAddress) : t("main.account.notConnected");
  if (profilePosition) profilePosition.textContent = `${Math.round(player.position.x)}, ${Math.round(player.position.y)}, ${Math.round(player.position.z)}`;
  if (profileChunks) profileChunks.textContent = String(knownChunks.size);
  updateProfileRpcDetails();
  updateProfileBackpackDetails();
  renderProfileSkills();
  renderProfileEquipment();
  refreshProfileChainSkillXp({ force: forceChainSkillXp });
}

function handleProfileRpcAction(event) {
  event.preventDefault();
  event.stopPropagation();
  const apiKey = getStoredHeliusApiKey();
  showRpcConfigPanel(
    apiKey ? "main.profile.rpcUpdatePrompt" : "main.profile.rpcSetPrompt",
    apiKey
      ? "Update your Helius API key for NiceChunk chain calls."
      : "Set a Helius API key to avoid public RPC limits.",
  );
  rpcConfigApiKey?.focus();
}

function updateProfileRpcDetails() {
  if (!profilePanel || profilePanel.hidden) return;
  const apiKey = getStoredHeliusApiKey();
  const configured = Boolean(apiKey);
  if (profileRpcValue) {
    profileRpcValue.textContent = configured
      ? gameText("main.profile.rpcKey", "RPCKEY {key}", { key: formatRpcKey(apiKey) })
      : gameText("main.profile.rpcPublic", "Public RPC");
    profileRpcValue.title = configured ? apiKey : getNicechunkRpcUrl();
  }
  if (profileRpcHint) {
    profileRpcHint.textContent = configured
      ? gameText("main.profile.rpcConfigured", "Private RPC key is active for chain calls.")
      : gameText("main.profile.rpcRecommend", "Set a private RPC key for steadier mining.");
  }
  if (profileRpcAction) {
    profileRpcAction.textContent = configured
      ? gameText("main.profile.rpcUpdate", "UPDATE")
      : gameText("main.profile.rpcSet", "Set");
  }
}

function formatRpcKey(apiKey) {
  const key = String(apiKey ?? "").trim();
  if (!key) return "";
  if (key.length <= 10) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function setProfileTab(tabName) {
  const normalizedTabName = tabName === "model" ? "equipment" : tabName;
  const next = ["attributes", "skills", "equipment"].includes(normalizedTabName) ? normalizedTabName : "attributes";
  if (profilePanel) profilePanel.dataset.activeProfileTab = next;
  profileTabs.forEach((tab) => {
    const active = tab.dataset.profileTab === next;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (next === "skills") renderProfileSkills();
  if (next === "equipment") renderProfileEquipment();
  if (next !== "skills") {
    window.requestAnimationFrame(() => {
      resizeProfilePreview();
      renderProfilePreview();
    });
  }
}

function updateProfileBackpackDetails() {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  if (profileBackpackStatus) {
    const itemCount = backpackFilledItemCount(backpack);
    profileBackpackStatus.textContent = backpack
      ? gameText("main.profile.backpackEquipped", "{address} · {count}/{capacity}", {
          address: formatWalletAddress(backpack.publicKey),
          count: itemCount,
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
  const previousBackpackSignature = backpackSlotsSignature(equippedBackpackStatus?.backpack ?? null);
  let backpackDataChanged = false;
  equippedBackpackLoading = true;
  scheduleSmeltingPanelUpdate();
  try {
    const { getEquippedBackpackStatus } = await loadNicechunkChainModule();
    const nextStatus = await getEquippedBackpackStatus();
    const nextBackpackSignature = backpackSlotsSignature(nextStatus?.backpack ?? null);
    backpackDataChanged = nextBackpackSignature !== previousBackpackSignature;
    equippedBackpackStatus = nextStatus;
    equippedBackpackLastLoadedAt = performance.now();
    scheduleBackpackSlotWarmup(equippedBackpackStatus?.backpack ?? null);
    syncEquippedBackpackSlot();
    renderHotbar();
    if (backpackPanel && !backpackPanel.hidden) renderBackpackPanel();
    if (marketPanel && !marketPanel.hidden) updateMarketPanel();
    scheduleSmeltingPanelUpdate();
    updateProfileBackpackDetails();
    return equippedBackpackStatus;
  } catch (error) {
    console.warn("Failed to refresh equipped backpack", error);
    return equippedBackpackStatus;
  } finally {
    equippedBackpackLoading = false;
    updateProfileBackpackDetails();
    if (marketPanel && !marketPanel.hidden) updateMarketPanel();
    scheduleSmeltingPanelUpdate({ reset: backpackDataChanged });
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
    gameplaySessionStatus = await getGameplaySessionStatus({ force });
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
  const status = gameplaySessionStatus;
  if (!status?.publicKey || !Number.isFinite(status?.balanceLamports)) return true;
  const minimumLamports = Number.isFinite(status?.minimumFundingLamports)
    ? status.minimumFundingLamports
    : Math.round(chainModule.getMinimumGameplaySessionFundingSol() * 1_000_000_000);
  const requiredLamports = Math.max(1, minimumLamports);
  const hasUsableBalance = Number.isFinite(status?.balanceLamports) && status.balanceLamports >= requiredLamports;
  if (hasUsableBalance) {
    if (!status?.acknowledged) chainModule.acknowledgeGameplaySessionFunding(currentSession.walletAddress);
    return true;
  }

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
  if (!funded?.funded) {
    appendChainEventLog(
      "error",
      gameText("main.chainLog.sessionFundingFailed", "Session funding failed"),
      funded?.message || chainSubmitReasonLabel(funded?.reason),
    );
    return false;
  }
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
  resetEquippedBackpackUiState();
  clearWalletSession();
  clearLocalSessionAuthorities();
  closeProfilePanel();
  redirectToGameLogin({ redirectPath: "/play/", autoConnect: false });
}

function clearLocalSessionAuthorities() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("nicechunk.session.v1.")) localStorage.removeItem(key);
    if (key.startsWith("nicechunk.equippedBackpack.v1.")) localStorage.removeItem(key);
  }
  localStorage.removeItem("nicechunk.phantomRedirectConnect");
  localStorage.removeItem("nicechunk.walletLoginChallenge");
}

function resetEquippedBackpackUiState() {
  equippedBackpackStatus = null;
  equippedBackpackLoading = false;
  equippedBackpackLastLoadedAt = 0;
  backpackSelectedSourceItemId = "";
  clearBackpackSelectionDragState();
  clearBackpackDragState();
  backpackDiscardingSlotIndexes.clear();
  backpackSelectedSlotIndexes.clear();
  backpackSelectionMode = false;
  backpackDiscardingBatch = false;
  backpackPreviewHydrationToken += 1;
  invalidateBackpackSlotCache();
  syncEquippedBackpackSlot();
  renderHotbar();
  if (backpackPanel && !backpackPanel.hidden) renderBackpackPanel();
  if (marketPanel && !marketPanel.hidden) updateMarketPanel();
  scheduleSmeltingPanelUpdate({ reset: true });
  updateProfileBackpackDetails();
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
  profilePreview.dirty = true;
}

function updateProfilePreviewCamera() {
  if (!profilePreview) return;
  profilePreview.camera.position.set(0, 1.45, profilePreview.distance);
  profilePreview.camera.lookAt(0, 1.28, 0);
}

function renderProfilePreview() {
  if (!profilePreview?.active) return;
  if (profileModelContainer && !profileModelContainer.offsetParent) return;
  resizeProfilePreview();
  if (!profilePreview.dirty && !profilePreview.dragging) return;
  profilePreview.root.rotation.x = profilePreview.rotationX;
  profilePreview.root.rotation.y = profilePreview.rotationY;
  updateProfilePreviewCamera();
  profilePreview.renderer.render(profilePreview.scene, profilePreview.camera);
  profilePreview.dirty = false;
}

function beginProfilePreviewDrag(event) {
  if (!profilePreview || !isPrimaryPointer(event)) return;
  event.preventDefault();
  event.stopPropagation();
  profilePreview.dragging = true;
  profilePreview.pointerId = event.pointerId;
  profilePreview.lastX = event.clientX;
  profilePreview.lastY = event.clientY;
  profilePreview.dirty = true;
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
  profilePreview.dirty = true;
}

function endProfilePreviewDrag(event) {
  if (!profilePreview?.dragging || event.pointerId !== profilePreview.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  profilePreview.dragging = false;
  profilePreview.pointerId = null;
  profilePreview.dirty = true;
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
  profilePreview.dirty = true;
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
  closeMarketPanel();
  closeSmeltingPanel();
  backpackPanel.hidden = false;
  backpackOverlay.hidden = false;
  backpackPanel.setAttribute("aria-hidden", "false");
  backpackOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("backpack-open");
  syncGameChromeState();
  renderBackpackPanel();
  void refreshEquippedBackpack({ force: true });
}

function closeBackpackPanel() {
  if (!backpackPanel || !backpackOverlay) return;
  closeBackpackContextMenu();
  clearBackpackSelectionDragState();
  clearBackpackDragState();
  backpackPanel.hidden = true;
  backpackOverlay.hidden = true;
  backpackPanel.setAttribute("aria-hidden", "true");
  backpackOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("backpack-open");
  syncGameChromeState();
}

function openMarketPanel() {
  if (!marketPanel || !marketOverlay) return;
  closeBackpackPanel();
  closeSmeltingPanel();
  marketPanel.hidden = false;
  marketOverlay.hidden = false;
  marketPanel.setAttribute("aria-hidden", "false");
  marketOverlay.setAttribute("aria-hidden", "false");
  syncGameChromeState();
  selectMarketTab(marketPanel.dataset.activeMarketTab || "browse");
  updateMarketPanel();
  void refreshMarketChainListings({ force: performance.now() - marketChainListingsLoadedAt > 15000 });
}

function closeMarketPanel() {
  if (!marketPanel || !marketOverlay) return;
  closeMarketListingDetails();
  setMarketStatus("");
  marketPanel.hidden = true;
  marketOverlay.hidden = true;
  marketPanel.setAttribute("aria-hidden", "true");
  marketOverlay.setAttribute("aria-hidden", "true");
  syncGameChromeState();
}

function openSmeltingPanel() {
  if (!smeltingPanel || !smeltingOverlay) return;
  closeBackpackPanel();
  closeMarketPanel();
  resetSmeltingRenderSignatures();
  smeltingPanel.hidden = false;
  smeltingOverlay.hidden = false;
  smeltingPanel.setAttribute("aria-hidden", "false");
  smeltingOverlay.setAttribute("aria-hidden", "false");
  syncGameChromeState();
  startSmeltingFlameVisuals();
  if (availableBackpackSlotCache.signature) {
    updateSmeltingPanel();
  } else {
    scheduleSmeltingPanelUpdate();
  }
  scheduleDeferredSmeltingBackpackRefresh({
    force: !equippedBackpackLoading && performance.now() - equippedBackpackLastLoadedAt > 12000,
  });
}

function closeSmeltingPanel() {
  if (!smeltingPanel || !smeltingOverlay) return;
  if (smeltingUpdateFrame) {
    window.cancelAnimationFrame(smeltingUpdateFrame);
    smeltingUpdateFrame = 0;
  }
  smeltingResourceRenderToken += 1;
  cancelDeferredSmeltingBackpackRefresh();
  stopSmeltingProgressTimer();
  if (smeltingState === "running") {
    smeltingState = "idle";
    smeltingProgress = 0;
    updateSmeltingProgressUi();
  }
  stopSmeltingFlameVisuals();
  smeltingPanel.hidden = true;
  smeltingOverlay.hidden = true;
  smeltingPanel.setAttribute("aria-hidden", "true");
  smeltingOverlay.setAttribute("aria-hidden", "true");
  syncGameChromeState();
}

function startSmeltingFlameVisuals() {
  if (!smeltingFlameShader && !smeltingThreeCore) return;
  if (!smeltingFlameVisuals) smeltingFlameVisuals = createSmeltingFlameVisuals();
  if (!smeltingFlameVisuals || smeltingFlameAnimationFrame) return;
  const render = (time = 0) => {
    if (!smeltingPanel || smeltingPanel.hidden || !smeltingFlameVisuals) {
      smeltingFlameAnimationFrame = 0;
      return;
    }
    smeltingFlameVisuals.render(time);
    smeltingFlameAnimationFrame = window.requestAnimationFrame(render);
  };
  smeltingFlameAnimationFrame = window.requestAnimationFrame(render);
}

function stopSmeltingFlameVisuals() {
  if (!smeltingFlameAnimationFrame) return;
  window.cancelAnimationFrame(smeltingFlameAnimationFrame);
  smeltingFlameAnimationFrame = 0;
}

function createSmeltingFlameVisuals() {
  const shader = createSmeltingFlameShader(smeltingFlameShader);
  const core = createSmeltingThreeCore(smeltingThreeCore);
  if (!shader && !core) return null;
  return {
    render(time) {
      shader?.render(time, smeltingFlameIntensity);
      core?.render(time, smeltingFlameIntensity);
    },
  };
}

function createSmeltingFlameShader(shaderCanvas) {
  if (!shaderCanvas) return null;
  const gl = shaderCanvas.getContext("webgl", { alpha: true, antialias: false, preserveDrawingBuffer: false })
    || shaderCanvas.getContext("experimental-webgl", { alpha: true, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform float u_time;
    uniform float u_intensity;
    vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    void main() {
      vec2 uv = v_texCoord;
      float dist = distance(uv, vec2(0.5, 0.52));
      float sphere = smoothstep(0.52, 0.16, dist);
      float inner = smoothstep(0.36, 0.05, dist);
      float n1 = snoise(vec2(uv.x * 3.4, uv.y * 4.4 - u_time * (0.12 + u_intensity * 0.3)));
      float n2 = snoise(vec2(uv.x * 7.2 + u_time * 0.18, uv.y * 8.0 - u_time * (0.2 + u_intensity * 0.6)));
      float n = clamp((n1 + n2 * 0.46) * 0.5 + 0.5, 0.0, 1.0);
      vec3 ember = vec3(0.95, 0.12, 0.02);
      vec3 orange = vec3(1.0, 0.46, 0.04);
      vec3 white = vec3(1.0, 0.9, 0.36);
      vec3 cyan = vec3(0.0, 0.85, 1.0);
      vec3 color = mix(ember, orange, n);
      color = mix(color, white, pow(n, 3.0) * 0.72 * u_intensity);
      color += cyan * exp(-dist * 5.4) * (0.08 + u_intensity * 0.16);
      color *= (0.35 + u_intensity * 0.78) * (0.84 + 0.16 * sin(u_time * 2.2));
      float spark = step(0.965 - u_intensity * 0.03, n) * smoothstep(0.54, 0.28, dist);
      float alpha = clamp((sphere * inner * (0.12 + n * 0.72) * u_intensity) + spark * (0.18 + u_intensity * 0.3), 0.0, 0.92);
      gl_FragColor = vec4(color, alpha);
    }
  `;
  const program = gl.createProgram();
  const vertexShader = compileSmeltingShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileSmeltingShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!program || !vertexShader || !fragmentShader) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeUniform = gl.getUniformLocation(program, "u_time");
  const intensityUniform = gl.getUniformLocation(program, "u_intensity");
  const syncSize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.max(1, Math.floor((shaderCanvas.clientWidth || 256) * ratio));
    const height = Math.max(1, Math.floor((shaderCanvas.clientHeight || 256) * ratio));
    if (shaderCanvas.width !== width || shaderCanvas.height !== height) {
      shaderCanvas.width = width;
      shaderCanvas.height = height;
    }
  };
  return {
    render(time, intensity = 0.08) {
      syncSize();
      gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(timeUniform, time * 0.001);
      gl.uniform1f(intensityUniform, Math.max(0.04, Math.min(1.15, intensity)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

function compileSmeltingShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function createSmeltingThreeCore(container) {
  if (!container) return null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.z = 5;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "smelting-three-canvas";
  container.replaceChildren(renderer.domElement);
  const group = new THREE.Group();
  scene.add(group);
  const coreGeometry = new THREE.SphereGeometry(1.34, 48, 32);
  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0xffaa22,
    emissive: 0xff3a00,
    emissiveIntensity: 0.72,
    specular: 0xffffff,
    shininess: 92,
    transparent: true,
    opacity: 0.88,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);
  const particleCount = 140;
  const particlePositions = new Float32Array(particleCount * 3);
  const particlePhases = [];
  for (let index = 0; index < particleCount; index += 1) {
    const radius = 1.05 + Math.random() * 1.34;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 2.4;
    particlePositions[index * 3] = Math.cos(angle) * radius * (0.56 + Math.random() * 0.34);
    particlePositions[index * 3 + 1] = height;
    particlePositions[index * 3 + 2] = Math.sin(angle) * radius * (0.56 + Math.random() * 0.34);
    particlePhases.push({
      angle,
      radius,
      height,
      speed: 0.32 + Math.random() * 0.9,
      drift: Math.random() * Math.PI * 2,
    });
  }
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute("position", new THREE.Float32BufferAttribute(particlePositions, 3));
  const emberMaterial = new THREE.PointsMaterial({
    color: 0xffa139,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(emberGeometry, emberMaterial);
  group.add(embers);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.72, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff7a18,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(halo);
  scene.add(new THREE.AmbientLight(0xffb15a, 1.6));
  const cyanLight = new THREE.PointLight(0x00f2ff, 6.8, 12);
  cyanLight.position.set(2.2, 1.8, 2.8);
  scene.add(cyanLight);
  const emberLight = new THREE.PointLight(0xff5a12, 5.4, 10);
  emberLight.position.set(-2.4, -1.8, 2.2);
  scene.add(emberLight);
  const syncSize = () => {
    const width = Math.max(1, container.clientWidth || 256);
    const height = Math.max(1, container.clientHeight || 256);
    if (renderer.domElement.width === Math.floor(width * renderer.getPixelRatio())
      && renderer.domElement.height === Math.floor(height * renderer.getPixelRatio())) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  return {
    render(time, intensity = 0.08) {
      syncSize();
      const tSeconds = time * 0.001;
      const safeIntensity = Math.max(0.04, Math.min(1.15, intensity));
      group.rotation.y = tSeconds * (0.28 + safeIntensity * 0.48);
      group.rotation.x = Math.sin(tSeconds * 0.42) * 0.18;
      group.position.y = Math.sin(tSeconds * 1.45) * 0.14;
      const pulse = 0.72 + safeIntensity * 0.32 + Math.sin(tSeconds * (1.6 + safeIntensity * 2.4)) * (0.018 + safeIntensity * 0.035);
      core.scale.setScalar(pulse);
      core.material.opacity = 0.18 + safeIntensity * 0.72;
      core.material.emissiveIntensity = 0.16 + safeIntensity * 0.9;
      halo.scale.setScalar(0.92 + safeIntensity * 0.34 + Math.sin(tSeconds * 1.9) * 0.025);
      halo.material.opacity = 0.035 + safeIntensity * 0.16;
      const positions = emberGeometry.attributes.position.array;
      particlePhases.forEach((particle, index) => {
        const lift = (particle.height + tSeconds * particle.speed * (0.65 + safeIntensity)) % 2.8 - 1.4;
        const angle = particle.angle + tSeconds * (0.18 + particle.speed * 0.16);
        const wobble = Math.sin(tSeconds * particle.speed + particle.drift) * 0.11;
        const radius = particle.radius * (0.48 + safeIntensity * 0.28 + wobble);
        positions[index * 3] = Math.cos(angle) * radius;
        positions[index * 3 + 1] = lift;
        positions[index * 3 + 2] = Math.sin(angle) * radius;
      });
      emberGeometry.attributes.position.needsUpdate = true;
      emberMaterial.opacity = 0.05 + safeIntensity * 0.46;
      emberMaterial.size = 0.035 + safeIntensity * 0.078;
      cyanLight.intensity = 1.4 + safeIntensity * 6.4;
      emberLight.intensity = 1.2 + safeIntensity * 5.3;
      renderer.render(scene, camera);
    },
  };
}

function scheduleDeferredSmeltingBackpackRefresh({ force = false } = {}) {
  cancelDeferredSmeltingBackpackRefresh();
  smeltingDeferredRefreshFrame = window.requestAnimationFrame(() => {
    smeltingDeferredRefreshFrame = 0;
    smeltingDeferredRefreshTimer = window.setTimeout(() => {
      smeltingDeferredRefreshTimer = 0;
      if (!smeltingPanel || smeltingPanel.hidden) return;
      void refreshEquippedBackpack({ force });
    }, 0);
  });
}

function cancelDeferredSmeltingBackpackRefresh() {
  if (smeltingDeferredRefreshFrame) {
    window.cancelAnimationFrame(smeltingDeferredRefreshFrame);
    smeltingDeferredRefreshFrame = 0;
  }
  if (smeltingDeferredRefreshTimer) {
    window.clearTimeout(smeltingDeferredRefreshTimer);
    smeltingDeferredRefreshTimer = 0;
  }
}

function scheduleSmeltingPanelUpdate({ reset = false } = {}) {
  if (reset) resetSmeltingRenderSignatures();
  if (!smeltingPanel || smeltingPanel.hidden) return;
  if (smeltingUpdateFrame) return;
  smeltingUpdateFrame = window.requestAnimationFrame(() => {
    smeltingUpdateFrame = 0;
    updateSmeltingPanel();
  });
}

function updateSmeltingPanel() {
  if (!smeltingPanel || smeltingPanel.hidden) return;
  smeltingPanel.dataset.refreshing = equippedBackpackLoading ? "true" : "false";
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const slots = createAvailableBackpackSlotsFromChain(backpack).filter(Boolean);
  const filledCount = slots.length;
  const capacity = backpack?.capacity ?? backpackSlotTotal;
  reconcileSmeltingSelection(slots);
  const inputSlots = selectedSmeltingSlots(slots, smeltingInputSourceItemIds);
  const fuelSlots = selectedSmeltingSlots(slots, smeltingFuelSourceItemIds).filter(isSmeltingFuelSlot);
  smeltingActiveInputSlots = inputSlots;
  smeltingActiveFuelSlots = fuelSlots;

  if (smeltingBackpack) {
    smeltingBackpack.textContent = backpack
      ? gameText("main.smelting.backpackCount", "{count}/{capacity}", { count: filledCount, capacity })
      : equippedBackpackLoading
      ? gameText("main.smelting.statusSyncing", "Syncing equipped backpack...")
      : gameText("main.smelting.noBackpackShort", "No backpack");
  }
  if (smeltingMode) smeltingMode.textContent = gameText("main.smelting.modePreview", "Local preview");

  updateSmeltingMobileChrome();
  renderSmeltingResourceGrid(slots);
  renderSmeltingWorkbenchSlots(inputSlots, fuelSlots);
  renderSmeltingOutput(inputSlots, fuelSlots);
  renderSmeltingRecipeList(slots, inputSlots, fuelSlots);
  renderSmeltingMobileActionDrawer(slots);
  updateSmeltingProgressUi(inputSlots, fuelSlots);
}

function selectSmeltingMobileTab(tab) {
  const allowed = new Set(["backpack", "recipes", "furnace"]);
  smeltingMobileTab = allowed.has(tab) ? tab : "backpack";
  updateSmeltingMobileChrome();
  if (smeltingMobileTab !== "backpack") {
    smeltingMobileSelectedSourceItemId = "";
    smeltingMobileDrawerSignature = "";
  }
  scheduleSmeltingPanelUpdate();
}

function updateSmeltingMobileChrome() {
  if (smeltingPanel) smeltingPanel.dataset.mobileTab = smeltingMobileTab;
  smeltingMobileTabs.forEach((button) => {
    const active = (button.dataset.smeltingMobileTab || "backpack") === smeltingMobileTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  smeltingResourceFilters.forEach((button) => {
    button.classList.toggle("active", (button.dataset.smeltingFilter || "all") === smeltingMobileResourceFilter);
  });
  smeltingRecipeFilters.forEach((button) => {
    button.classList.toggle("active", (button.dataset.smeltingRecipeFilter || "all") === smeltingMobileRecipeFilter);
  });
}

function reconcileSmeltingSelection(slots) {
  const availableIds = new Set(slots.map((slot) => slot.sourceItemId).filter(Boolean));
  removeUnavailableSmeltingIds(smeltingInputSourceItemIds, availableIds);
  removeUnavailableSmeltingIds(smeltingFuelSourceItemIds, availableIds);
}

function removeUnavailableSmeltingIds(ids, availableIds) {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (!availableIds.has(ids[index])) ids.splice(index, 1);
  }
}

function selectedSmeltingSlots(slots, ids) {
  const byId = new Map(slots.map((slot) => [slot.sourceItemId, slot]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function renderSmeltingResourceGrid(slots) {
  if (!smeltingResourceGrid) return;
  const renderSlots = isMobileViewport() ? filterSmeltingMobileResourceSlots(slots) : slots;
  const signature = smeltingCollectionSignature(renderSlots, null, `resources:${smeltingMobileResourceFilter}`);
  if (signature === smeltingResourceRenderSignature) {
    updateSmeltingCardSelection(smeltingResourceGrid);
    return;
  }
  smeltingResourceRenderSignature = signature;
  const renderToken = ++smeltingResourceRenderToken;
  cleanupSmeltingPreviewTree(smeltingResourceGrid);
  if (!renderSlots.length) {
    const hasBackpack = Boolean(equippedBackpackStatus?.backpack);
    smeltingResourceGrid.replaceChildren(
      equippedBackpackLoading && !equippedBackpackStatus
        ? createSmeltingEmptyState("main.smelting.statusSyncing", "Syncing equipped backpack...")
        : !hasBackpack
        ? createSmeltingEmptyState("main.smelting.noBackpackResources", "Equip a backpack before smelting resources.")
        : createSmeltingEmptyState("main.smelting.noResources", "No mined resources match this filter."),
    );
    return;
  }
  const initialCount = isMobileViewport() ? 28 : 12;
  const firstSlots = renderSlots.slice(0, initialCount);
  const remainingSlots = renderSlots.slice(initialCount);
  smeltingResourceGrid.replaceChildren(...firstSlots.map((slot) => createSmeltingResourceCard(slot)));
  updateSmeltingCardSelection(smeltingResourceGrid);
  appendSmeltingResourceCardsInBatches(remainingSlots, renderToken);
}

function filterSmeltingMobileResourceSlots(slots = []) {
  const selectedRecipeKeys = new Set();
  const currentMatch = smeltingRecipeMatch(smeltingActiveInputSlots);
  recipeRequirements(currentMatch?.recipe).forEach((input) => selectedRecipeKeys.add(input.key));
  return slots.filter((slot) => {
    if (smeltingMobileResourceFilter === "fuel") return isSmeltingFuelSlot(slot);
    if (smeltingMobileResourceFilter === "raw") return !slot.materialId;
    if (smeltingMobileResourceFilter === "ready") {
      return isSmeltingFuelSlot(slot) || selectedRecipeKeys.has(smeltingSlotInputKey(slot)) || Boolean(smeltingRecipeMatch([slot])?.recipe);
    }
    return true;
  });
}

function appendSmeltingResourceCardsInBatches(slots, renderToken) {
  if (!slots.length || !smeltingResourceGrid) return;
  const batchSize = isMobileViewport() ? 16 : 10;
  let cursor = 0;
  const appendNextBatch = () => {
    if (renderToken !== smeltingResourceRenderToken || !smeltingResourceGrid || smeltingPanel?.hidden) return;
    const fragment = document.createDocumentFragment();
    const nextCursor = Math.min(cursor + batchSize, slots.length);
    for (; cursor < nextCursor; cursor += 1) {
      fragment.append(createSmeltingResourceCard(slots[cursor]));
    }
    smeltingResourceGrid.append(fragment);
    updateSmeltingCardSelection(smeltingResourceGrid);
    if (cursor < slots.length) scheduleSmeltingResourceBatch(appendNextBatch);
  };
  scheduleSmeltingResourceBatch(appendNextBatch, 80);
}

function scheduleSmeltingResourceBatch(callback, delayMs = 0) {
  window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout: 180 });
      return;
    }
    window.requestAnimationFrame(callback);
  }, delayMs);
}

function createSmeltingResourceCard(slot) {
  const card = document.createElement("div");
  card.className = "smelting-resource-card";
  card.role = "button";
  card.tabIndex = 0;
  card.draggable = !isMobileViewport();
  card.dataset.sourceItemId = slot.sourceItemId ?? "";
  card.classList.toggle("fuel-compatible", isSmeltingFuelSlot(slot));
  card.append(createSmeltingResourceSwatch(slot));

  const copy = document.createElement("span");
  copy.innerHTML = "<strong></strong><small></small>";
  copy.querySelector("strong").textContent = backpackSlotDisplayName(slot);
  copy.querySelector("small").textContent = smeltingResourceCardMeta(slot);
  card.append(copy);
  if (!isMobileViewport()) card.append(createSmeltingResourceActions(slot));
  syncSmeltingResourceCardState(card);
  return card;
}

function createSmeltingResourceActions(slot) {
  const actions = document.createElement("span");
  actions.className = "smelting-resource-actions";
  actions.setAttribute("aria-hidden", "false");
  actions.append(createSmeltingResourceActionButton("input", "main.smelting.addInput", "Input"));
  if (isSmeltingFuelSlot(slot)) {
    actions.append(createSmeltingResourceActionButton("fuel", "main.smelting.addFuel", "Fuel"));
  }
  return actions;
}

function createSmeltingResourceActionButton(zone, labelKey, fallback) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.smeltingZone = zone;
  button.textContent = gameText(labelKey, fallback);
  return button;
}

function smeltingResourceCardMeta(slot) {
  const fuelProfile = smeltingFuelProfile(slot);
  if (fuelProfile.tier > 0) {
    return `${gameText("main.smelting.fuelHeat", "Heat tier {tier}", { tier: fuelProfile.tier })} · ${formatMassKg(slot?.massKg)}`;
  }
  const size = slot?.volumeMm3 > 0 ? formatVolumeCubeSize(slot.volumeMm3) : formatDimensionsM(slot?.dimensionsM);
  return gameText("main.smelting.resourceMassSize", "{mass} · {size}", {
    mass: formatMassKg(slot?.massKg),
    size,
  });
}

function handleSmeltingResourceGridClick(event) {
  const action = event.target instanceof Element ? event.target.closest("[data-smelting-zone]") : null;
  const card = event.target instanceof Element ? event.target.closest(".smelting-resource-card") : null;
  if (!card || !smeltingResourceGrid?.contains(card) || smeltingState === "running") return;
  if (!isMobileViewport() && card.getAttribute("aria-disabled") === "true") return;
  const sourceItemId = card.dataset.sourceItemId;
  if (!sourceItemId) return;
  event.preventDefault();
  if (isMobileViewport()) {
    smeltingMobileSelectedSourceItemId = sourceItemId;
    renderSmeltingMobileActionDrawer(createAvailableBackpackSlotsFromChain(equippedBackpackStatus?.backpack ?? null).filter(Boolean));
    updateSmeltingCardSelection(smeltingResourceGrid);
    return;
  }
  if (action?.dataset.smeltingZone) {
    addSmeltingSourceToZone(sourceItemId, action.dataset.smeltingZone);
  } else {
    toggleSmeltingInput(sourceItemId);
  }
  resetSmeltingProgressState({ render: false });
  scheduleSmeltingPanelUpdate();
}

smeltingResourceGrid?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target instanceof Element ? event.target.closest(".smelting-resource-card") : null;
  if (!card || !smeltingResourceGrid?.contains(card)) return;
  if (card.getAttribute("aria-disabled") === "true") return;
  event.preventDefault();
  if (isMobileViewport()) {
    smeltingMobileSelectedSourceItemId = card.dataset.sourceItemId || "";
    renderSmeltingMobileActionDrawer(createAvailableBackpackSlotsFromChain(equippedBackpackStatus?.backpack ?? null).filter(Boolean));
    return;
  }
  toggleSmeltingInput(card.dataset.sourceItemId);
  resetSmeltingProgressState({ render: false });
  scheduleSmeltingPanelUpdate();
});

function handleSmeltingResourceDragStart(event) {
  const card = event.target instanceof Element ? event.target.closest(".smelting-resource-card") : null;
  if (!card || !card.dataset.sourceItemId || smeltingState === "running" || card.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData("text/plain", card.dataset.sourceItemId);
  event.dataTransfer.setData("application/x-nicechunk-smelting-source", card.dataset.sourceItemId);
}

function setupSmeltingDropZone(container, zone) {
  if (!container) return;
  container.addEventListener("dragover", (event) => {
    event.preventDefault();
    container.classList.add("drag-over");
    event.dataTransfer.dropEffect = "copy";
  });
  container.addEventListener("dragleave", (event) => {
    if (event.currentTarget === container) container.classList.remove("drag-over");
  });
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    container.classList.remove("drag-over");
    const sourceItemId =
      event.dataTransfer.getData("application/x-nicechunk-smelting-source") ||
      event.dataTransfer.getData("text/plain");
    addSmeltingSourceToZone(sourceItemId, zone);
  });
}

function addSmeltingSourceToZone(sourceItemId, zone) {
  if (!sourceItemId || smeltingState === "running") return;
  if (zone === "fuel") {
    const slot = createAvailableBackpackSlotsFromChain(equippedBackpackStatus?.backpack ?? null)
      .find((candidate) => candidate?.sourceItemId === sourceItemId);
    if (!isSmeltingFuelSlot(slot)) return;
    addUniqueSmeltingId(smeltingFuelSourceItemIds, sourceItemId);
    removeSmeltingId(smeltingInputSourceItemIds, sourceItemId);
  } else {
    addUniqueSmeltingId(smeltingInputSourceItemIds, sourceItemId);
    removeSmeltingId(smeltingFuelSourceItemIds, sourceItemId);
  }
  resetSmeltingProgressState({ render: false });
  scheduleSmeltingPanelUpdate();
}

function toggleSmeltingInput(sourceItemId) {
  if (smeltingInputSourceItemIds.includes(sourceItemId)) {
    removeSmeltingId(smeltingInputSourceItemIds, sourceItemId);
    return;
  }
  addSmeltingSourceToZone(sourceItemId, "input");
}

function addUniqueSmeltingId(ids, sourceItemId) {
  if (!ids.includes(sourceItemId)) ids.push(sourceItemId);
}

function removeSmeltingId(ids, sourceItemId) {
  const index = ids.indexOf(sourceItemId);
  if (index >= 0) ids.splice(index, 1);
}

function isSmeltingSlotSelected(sourceItemId) {
  return smeltingInputSourceItemIds.includes(sourceItemId) || smeltingFuelSourceItemIds.includes(sourceItemId);
}

function updateSmeltingCardSelection(container) {
  if (!container) return;
  container.querySelectorAll(".smelting-resource-card, .smelting-fuel-card").forEach(syncSmeltingResourceCardState);
}

function syncSmeltingResourceCardState(card) {
  const sourceItemId = card?.dataset?.sourceItemId;
  const inputSelected = smeltingInputSourceItemIds.includes(sourceItemId);
  const fuelSelected = smeltingFuelSourceItemIds.includes(sourceItemId);
  const selected = inputSelected || fuelSelected;
  const mobile = isMobileViewport();
  card.classList.toggle("selected", selected);
  card.classList.toggle("input-selected", inputSelected);
  card.classList.toggle("fuel-selected", fuelSelected);
  card.classList.toggle("mobile-inspected", mobile && smeltingMobileSelectedSourceItemId === sourceItemId);
  card.classList.toggle("smelting-resource-card-disabled", selected && !mobile);
  card.setAttribute("aria-pressed", selected ? "true" : "false");
  card.setAttribute("aria-disabled", selected && !mobile ? "true" : "false");
  card.draggable = !selected && !mobile;
  card.tabIndex = selected && !mobile ? -1 : 0;
  card.querySelectorAll("button[data-smelting-zone]").forEach((button) => {
    button.disabled = selected;
  });
}

function findSmeltingCardBySourceId(container, sourceItemId) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return container.querySelector(`[data-source-item-id="${CSS.escape(sourceItemId)}"]`);
  }
  return Array.from(container.querySelectorAll(".smelting-resource-card, .smelting-fuel-card"))
    .find((card) => card.dataset.sourceItemId === sourceItemId) ?? null;
}

function renderSmeltingWorkbenchSlots(inputSlots, fuelSlots) {
  const signature = [
    smeltingLocaleSignature(),
    inputSlots.map(smeltingSlotSignature).join("||"),
    fuelSlots.map(smeltingSlotSignature).join("||"),
  ].join("::");
  if (signature === smeltingWorkbenchRenderSignature) return;
  smeltingWorkbenchRenderSignature = signature;
  renderSmeltingWorkbenchSlot(smeltingInputSlot, inputSlots, "main.smelting.inputSlot", "Input", "main.smelting.dropInputHint", "Drag mined materials here");
  renderSmeltingWorkbenchSlot(smeltingFuelSlot, fuelSlots, "main.smelting.fuelSlot", "Fuel", "main.smelting.dropFuelHint", "Drag fuel blocks here");
}

function renderSmeltingWorkbenchSlot(container, slots, labelKey, fallback, hintKey, hintFallback) {
  if (!container) return;
  cleanupSmeltingPreviewTree(container);
  container.replaceChildren();
  const label = document.createElement("span");
  const labelText = gameText(labelKey, fallback);
  label.textContent = container === smeltingInputSlot && slots.length
    ? gameText("main.smelting.inputSlotMass", "{label} · {mass}", {
        label: labelText,
        mass: formatMassKg(totalSmeltingInputMassKg(slots)),
      })
    : labelText;
  container.append(label);
  if (!slots.length) {
    const hint = document.createElement("em");
    hint.textContent = gameText(hintKey, hintFallback);
    container.append(hint);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "smelting-slot-items";
  slots.forEach((slot) => {
    const item = document.createElement("button");
    item.className = "smelting-slot-item";
    item.type = "button";
    item.dataset.sourceItemId = slot.sourceItemId ?? "";
    item.title = backpackSlotDisplayName(slot);
    item.addEventListener("click", () => {
      if (smeltingState === "running") return;
      removeSmeltingId(container === smeltingFuelSlot ? smeltingFuelSourceItemIds : smeltingInputSourceItemIds, slot.sourceItemId);
      resetSmeltingProgressState({ render: false });
      scheduleSmeltingPanelUpdate();
    });
    item.append(createSmeltingSlotPreview(slot, "smelting-slot-preview", { size: 72 }));
    const name = document.createElement("strong");
    name.textContent = backpackSlotDisplayName(slot);
    item.append(name);
    grid.append(item);
  });
  container.append(grid);
}

function renderSmeltingOutput(inputSlots, fuelSlots) {
  if (!smeltingOutput) return;
  const signature = [
    smeltingLocaleSignature(),
    inputSlots.map(smeltingSlotSignature).join("||"),
    fuelSlots.map(smeltingSlotSignature).join("||"),
  ].join("::");
  if (signature === smeltingOutputRenderSignature) return;
  smeltingOutputRenderSignature = signature;
  cleanupSmeltingPreviewTree(smeltingOutput);
  if (!inputSlots.length) {
    smeltingOutput.replaceChildren(createSmeltingEmptyState("main.smelting.selectInput", "Select a backpack resource to preview output."));
    return;
  }
  const recipe = createSmeltingRecipe(inputSlots, fuelSlots);
  const panel = document.createElement("div");
  panel.className = "smelting-output-card";

  const preview = document.createElement("div");
  preview.className = "smelting-output-preview";
  preview.append(createSmeltingMaterialPreview(recipe, {
    size: chainBlockPreviewSize,
    previewDimensionsM: recipe.outputDimensionsM,
  }));
  const massBadge = document.createElement("span");
  massBadge.className = "smelting-preview-mass";
  const inputMassLabel = gameText("main.smelting.inputMass", "Input mass {mass}", {
    mass: formatMassKg(totalSmeltingInputMassKg(inputSlots)),
  });
  massBadge.textContent = formatMassKg(totalSmeltingInputMassKg(inputSlots));
  massBadge.title = inputMassLabel;
  massBadge.setAttribute("aria-label", inputMassLabel);
  preview.append(massBadge);

  const copy = document.createElement("div");
  copy.className = "smelting-output-copy";
  copy.innerHTML = `
    <strong></strong>
    <p></p>
    <div class="smelting-output-stats"></div>
    <div class="smelting-element-chips"></div>
    <small></small>
  `;
  copy.querySelector("strong").textContent = recipe.name;
  copy.querySelector("p").textContent = recipe.description;
  copy.querySelector("small").textContent = gameText("main.smelting.chainSubmitNotice", "On-chain smelting consumes selected inputs and fuel, then writes the forge material back into your equipped backpack.");
  const stats = copy.querySelector(".smelting-output-stats");
  const statRows = [
    [gameText("main.smelting.requiredHeat", "Required heat"), recipe.heatLabel],
    [gameText("main.smelting.servings", "Servings"), recipe.servingsLabel],
    [gameText("main.smelting.outputSize", "Output size"), recipe.outputSizeLabel],
    [gameText("main.smelting.outputRate", "Output rate"), recipe.yieldRange],
    [gameText("main.smelting.quality", "Quality basis"), recipe.quality],
  ];
  if (recipe.properties) {
    statRows.push(
      [gameText("main.smelting.purity", "Purity"), `${recipe.properties.purity}/100`],
      [gameText("main.smelting.grade", "Grade"), smeltingGradeLabel(recipe.properties.grade)],
      ...smeltingTopAttributeEntries(recipe.properties.attributes, 4).map(([key, value]) => [smeltingAttributeLabel(key), `${value}/100`]),
    );
  }
  statRows.forEach(([label, value]) => {
    const stat = document.createElement("span");
    stat.innerHTML = "<em></em><b></b>";
    stat.querySelector("em").textContent = label;
    stat.querySelector("b").textContent = value;
    stats.append(stat);
  });
  const chips = copy.querySelector(".smelting-element-chips");
  recipe.composition.forEach(([symbol, range]) => {
    const chip = document.createElement("b");
    chip.innerHTML = "<strong></strong><span></span><em></em>";
    chip.querySelector("strong").textContent = symbol;
    chip.querySelector("span").textContent = localizedElementLabel(symbol);
    chip.querySelector("em").textContent = range;
    chips.append(chip);
  });

  panel.append(preview, copy);
  smeltingOutput.replaceChildren(panel);
}

function renderSmeltingRecipeList(slots = [], inputSlots = [], fuelSlots = []) {
  if (!smeltingRecipeList) return;
  const recipeSummaries = smeltingRecipeSummaries(slots, inputSlots, fuelSlots);
  const signature = [
    smeltingLocaleSignature(),
    smeltingMobileRecipeFilter,
    slots.map(smeltingSlotSignature).join("||"),
    inputSlots.map(smeltingSlotSignature).join("||"),
    fuelSlots.map(smeltingSlotSignature).join("||"),
    smeltingInputSourceItemIds.join(","),
  ].join("::");
  if (signature === smeltingRecipeRenderSignature) return;
  smeltingRecipeRenderSignature = signature;
  if (!recipeSummaries.length) {
    smeltingRecipeList.replaceChildren(createSmeltingEmptyState("main.smelting.noRecipeMatch", "No public recipe match for this filter."));
    return;
  }
  smeltingRecipeList.replaceChildren(...recipeSummaries.map((summary) => createSmeltingRecipeCard(summary)));
}

function smeltingRecipeSummaries(slots = [], inputSlots = [], fuelSlots = []) {
  const counts = createSmeltingInputCounts(slots.map(smeltingSlotInputKey).filter(Boolean));
  const selectedCounts = createSmeltingInputCountFromSlots(inputSlots);
  const selectedRecipeId = smeltingRecipeMatch(inputSlots)?.recipe?.id ?? "";
  return (smeltingRules.materials ?? [])
    .map((recipe) => {
      const requirements = recipeRequirements(recipe);
      const maxServings = maxSmeltingRecipeServings(recipe, counts);
      const selectedServings = smeltingRecipeInputMultiplier(recipe, selectedCounts);
      const displayServings = Math.max(1, selectedServings || Math.min(1, maxServings));
      const plan = smeltingRecipeInputPlan(recipe, slots, displayServings);
      const missing = plan.requirements.filter((input) => input.missing > 0);
      const requiredCount = plan.requiredCount;
      const matchedCount = plan.matchedCount;
      const selectedMatchedCount = requirements.reduce((sum, input) => Math.min(input.amount, selectedCounts.get(input.key) ?? 0) + sum, 0);
      const fuelSlot = bestSmeltingFuelSlot(slots, recipe.requiredHeatTier ?? 1, new Set(plan.slots.map((slot) => slot.sourceItemId)));
      const ready = plan.complete && Boolean(fuelSlot);
      const selected = recipe.id === selectedRecipeId && selectedMatchedCount > 0;
      const fuelMissing = missing.length === 0 && !fuelSlot && !fuelSlots.length;
      return {
        recipe,
        requirements: plan.requirements,
        missing,
        matchedCount,
        requiredCount,
        selectedMatchedCount,
        fuelSlot,
        ready,
        selected,
        fuelMissing,
        maxServings,
        selectedServings,
        displayServings,
        plannedInputSlots: plan.slots,
        inputVolumeMm3: plan.inputVolumeMm3,
        outputVolumeMm3: plan.outputVolumeMm3,
      };
    })
    .filter((summary) => {
      if (smeltingMobileRecipeFilter === "ready") return summary.ready;
      if (smeltingMobileRecipeFilter === "missing") return summary.missing.length || summary.fuelMissing;
      if (smeltingMobileRecipeFilter === "fuel") return summary.recipe.forgeUse === "fuel" || summary.recipe.class === "carbon";
      return true;
    })
    .sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return (b.matchedCount / Math.max(1, b.requiredCount)) - (a.matchedCount / Math.max(1, a.requiredCount));
    })
    .slice(0, 36);
}

function smeltingRecipeInputPlan(recipe, slots = [], servings = 1) {
  const normalizedServings = Math.max(1, Math.floor(Number(servings) || 1));
  const used = new Set();
  const selectedSlots = [];
  const requirements = recipeRequirements(recipe).map((input) => {
    const requiredCount = Math.max(1, Number(input.amount) || 1) * normalizedServings;
    const candidates = slots
      .filter((slot) => {
        const sourceItemId = slot?.sourceItemId;
        return sourceItemId && !used.has(sourceItemId) && smeltingSlotInputKey(slot) === input.key;
      })
      .sort(compareSmeltingSlotsByVolume);
    const selected = candidates.slice(0, requiredCount);
    selected.forEach((slot) => {
      used.add(slot.sourceItemId);
      selectedSlots.push(slot);
    });
    const selectedVolumeMm3 = totalSmeltingInputVolumeMm3(selected);
    const availableVolumeMm3 = candidates.reduce((sum, slot) => sum + smeltingSlotVolumeMm3(slot), 0);
    return {
      ...input,
      baseAmount: input.amount,
      amount: requiredCount,
      available: candidates.length,
      selected: selected.length,
      missing: Math.max(0, requiredCount - selected.length),
      selectedVolumeMm3,
      availableVolumeMm3,
    };
  });
  const requiredCount = requirements.reduce((sum, input) => sum + input.amount, 0);
  const matchedCount = requirements.reduce((sum, input) => sum + input.selected, 0);
  const complete = requirements.length > 0 && requirements.every((input) => input.missing <= 0);
  const inputVolumeMm3 = totalSmeltingInputVolumeMm3(selectedSlots);
  return {
    complete,
    requirements,
    requiredCount,
    matchedCount,
    slots: selectedSlots,
    inputVolumeMm3,
    outputVolumeMm3: complete ? smeltingRecipeOutputVolumeMm3(recipe, normalizedServings, selectedSlots) : 0,
  };
}

function compareSmeltingSlotsByVolume(a, b) {
  const volumeDelta = smeltingSlotVolumeMm3(a) - smeltingSlotVolumeMm3(b);
  if (volumeDelta) return volumeDelta;
  return String(a?.sourceItemId ?? "").localeCompare(String(b?.sourceItemId ?? ""));
}

function createSmeltingRecipeCard(summary) {
  const { recipe } = summary;
  const properties = deriveSmeltingMaterialProperties({ material: recipe });
  const card = document.createElement("article");
  card.className = "smelting-recipe-card";
  card.classList.toggle("ready", summary.ready);
  card.classList.toggle("selected", summary.selected);
  card.dataset.recipeId = recipe.id;

  const preview = document.createElement("div");
  preview.className = "smelting-recipe-preview";
  preview.append(createSmeltingMaterialPreview(recipe, {
    size: 72,
    previewDimensionsM: materialCubeDimensionsFromVolume(summary.outputVolumeMm3),
  }));

  const copy = document.createElement("div");
  copy.className = "smelting-recipe-copy";
  const status = smeltingRecipeStatusLabel(summary);
  copy.innerHTML = "<div><strong></strong><span></span></div><p></p><div class=\"smelting-recipe-batch\"></div><div class=\"smelting-recipe-attributes\"></div><div class=\"smelting-recipe-requirements\"></div>";
  copy.querySelector("strong").textContent = smeltingMaterialName(recipe.id);
  copy.querySelector("span").textContent = status;
  copy.querySelector("p").textContent = gameText("main.smelting.recipeProgress", "{matched}/{required} inputs · input {volume} · heat tier {tier}", {
    matched: Math.min(summary.requiredCount, summary.matchedCount),
    required: summary.requiredCount,
    volume: formatSmeltingVolumeMm3(summary.inputVolumeMm3),
    tier: recipe.requiredHeatTier ?? 1,
  });
  const batch = copy.querySelector(".smelting-recipe-batch");
  batch.append(createSmeltingRecipeBatchControl(summary));
  const attrs = copy.querySelector(".smelting-recipe-attributes");
  smeltingTopAttributeEntries(properties.attributes, 4).forEach(([key, value]) => {
    const chip = document.createElement("b");
    chip.textContent = `${smeltingAttributeLabel(key)} ${value}`;
    attrs.append(chip);
  });
  const reqWrap = copy.querySelector(".smelting-recipe-requirements");
  summary.requirements.slice(0, 5).forEach((input) => {
    const chip = document.createElement("b");
    chip.textContent = gameText("main.smelting.recipeRequirementVolume", "{resource} use {used} / have {available}", {
        resource: smeltingInputKeyLabel(input.key),
        used: formatSmeltingVolumeMm3(input.selectedVolumeMm3),
        available: formatSmeltingVolumeMm3(input.availableVolumeMm3),
      });
    chip.title = gameText("main.smelting.recipeRequirement", "{resource} {available}/{amount}", {
      resource: smeltingInputKeyLabel(input.key),
      available: input.selected ?? 0,
      amount: input.amount,
    });
    chip.classList.toggle("missing", (input.selected ?? 0) < input.amount);
    reqWrap.append(chip);
  });

  const action = document.createElement("button");
  action.className = "smelting-recipe-action";
  action.type = "button";
  action.dataset.smeltingRecipeSelect = recipe.id;
  action.dataset.smeltingRecipeServings = String(summary.displayServings);
  action.textContent = summary.ready
    ? gameText("main.smelting.selectRecipe", "Select Recipe")
    : gameText("main.smelting.findInputs", "Find Inputs");

  card.append(preview, copy, action);
  return card;
}

function createSmeltingRecipeBatchControl(summary) {
  const wrap = document.createElement("div");
  wrap.className = "smelting-recipe-batch-control";
  const label = document.createElement("span");
  label.textContent = gameText("main.smelting.recipeServings", "Servings");
  const stepper = document.createElement("span");
  stepper.className = "smelting-recipe-stepper";
  const minus = createSmeltingRecipeServingButton(summary, -1);
  const value = document.createElement("output");
  value.value = String(summary.displayServings);
  value.textContent = gameText("main.smelting.recipeServingsValue", "{count}x", { count: summary.displayServings });
  const plus = createSmeltingRecipeServingButton(summary, 1);
  stepper.append(minus, value, plus);
  const size = document.createElement("small");
  size.textContent = gameText("main.smelting.recipeOutputVolume", "Output volume {volume}", {
    volume: formatSmeltingVolumeMm3(summary.outputVolumeMm3),
  });
  wrap.append(label, stepper, size);
  return wrap;
}

function createSmeltingRecipeServingButton(summary, delta) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.smeltingRecipeServingsDelta = String(delta);
  button.dataset.smeltingRecipeSelect = summary.recipe.id;
  button.dataset.smeltingRecipeServings = String(Math.max(1, Math.min(summary.maxServings || 1, summary.displayServings + delta)));
  button.textContent = delta > 0 ? "+" : "-";
  button.disabled = !summary.ready || summary.maxServings <= 1 || summary.displayServings + delta < 1 || summary.displayServings + delta > summary.maxServings;
  button.setAttribute("aria-label", delta > 0
    ? gameText("main.smelting.increaseServings", "Increase servings")
    : gameText("main.smelting.decreaseServings", "Decrease servings"));
  return button;
}

function smeltingRecipeStatusLabel(summary) {
  if (summary.ready) return gameText("main.smelting.recipeReady", "Ready");
  if (summary.fuelMissing) return gameText("main.smelting.recipeFuelMissing", "Missing fuel");
  if (summary.missing.length) {
    const missingCount = summary.missing.reduce((sum, input) => sum + input.missing, 0);
    return gameText("main.smelting.recipeMissingInputs", "Missing {count} input slots", { count: missingCount });
  }
  return gameText("main.smelting.recipePartial", "Partial match");
}

function handleSmeltingRecipeListClick(event) {
  const button = event.target instanceof Element ? event.target.closest("[data-smelting-recipe-select]") : null;
  if (!button || !smeltingRecipeList?.contains(button) || smeltingState === "running") return;
  event.preventDefault();
  const recipeId = button.dataset.smeltingRecipeSelect;
  const recipe = (smeltingRules.materials ?? []).find((candidate) => candidate.id === recipeId);
  if (!recipe) return;
  const servings = Math.max(1, Math.floor(Number(button.dataset.smeltingRecipeServings) || 1));
  fillSmeltingRecipeFromBackpack(recipe, servings);
}

function fillSmeltingRecipeFromBackpack(recipe, servings = 1) {
  const slots = createAvailableBackpackSlotsFromChain(equippedBackpackStatus?.backpack ?? null).filter(Boolean);
  const maxServings = maxSmeltingRecipeServings(recipe, createSmeltingInputCounts(slots.map(smeltingSlotInputKey).filter(Boolean)));
  const targetServings = Math.max(1, Math.min(Math.max(1, maxServings), Math.floor(Number(servings) || 1)));
  const plan = smeltingRecipeInputPlan(recipe, slots, targetServings);
  const used = new Set();
  smeltingInputSourceItemIds.length = 0;
  smeltingFuelSourceItemIds.length = 0;
  plan.slots.forEach((slot) => {
    if (!slot?.sourceItemId || used.has(slot.sourceItemId)) return;
    smeltingInputSourceItemIds.push(slot.sourceItemId);
    used.add(slot.sourceItemId);
  });
  const fuelSlot = bestSmeltingFuelSlot(slots, recipe.requiredHeatTier ?? 1, used);
  if (fuelSlot?.sourceItemId) smeltingFuelSourceItemIds.push(fuelSlot.sourceItemId);
  smeltingMobileSelectedSourceItemId = "";
  smeltingMobileTab = "furnace";
  resetSmeltingProgressState({ render: false });
  resetSmeltingRenderSignatures();
  scheduleSmeltingPanelUpdate();
}

function maxSmeltingRecipeServings(recipe, counts) {
  const requirements = recipeRequirements(recipe);
  if (!requirements.length) return 0;
  return requirements.reduce((max, input) => {
    const required = Math.max(1, Number(input.amount) || 1);
    const available = counts.get(input.key) ?? 0;
    return Math.min(max, Math.floor(available / required));
  }, Number.POSITIVE_INFINITY) || 0;
}

function bestSmeltingFuelSlot(slots = [], requiredTier = 1, excludedIds = new Set()) {
  return slots
    .filter((slot) => !excludedIds.has(slot.sourceItemId) && smeltingFuelProfile(slot).tier >= requiredTier)
    .sort((a, b) => smeltingFuelProfile(a).tier - smeltingFuelProfile(b).tier)
    [0] ?? null;
}

function renderSmeltingMobileActionDrawer(slots = []) {
  if (!smeltingMobileActionDrawer) return;
  const slot = slots.find((candidate) => candidate?.sourceItemId === smeltingMobileSelectedSourceItemId);
  const signature = [
    smeltingLocaleSignature(),
    smeltingMobileSelectedSourceItemId,
    slot ? smeltingSlotSignature(slot) : "-",
    smeltingInputSourceItemIds.join(","),
    smeltingFuelSourceItemIds.join(","),
    smeltingMobileTab,
  ].join("::");
  if (signature === smeltingMobileDrawerSignature) return;
  smeltingMobileDrawerSignature = signature;
  cleanupSmeltingPreviewTree(smeltingMobileActionDrawer);
  if (!slot || smeltingMobileTab !== "backpack") {
    smeltingMobileActionDrawer.hidden = true;
    smeltingMobileActionDrawer.replaceChildren();
    return;
  }
  const inputSelected = smeltingInputSourceItemIds.includes(slot.sourceItemId);
  const fuelSelected = smeltingFuelSourceItemIds.includes(slot.sourceItemId);
  const isFuel = isSmeltingFuelSlot(slot);
  const coord = slot.record
    ? `${slot.record.worldX ?? "?"}, ${slot.record.worldY ?? "?"}, ${slot.record.worldZ ?? "?"}`
    : gameText("main.smelting.coordinateUnknown", "Coordinate unknown");
  const drawer = document.createElement("div");
  drawer.className = "smelting-mobile-drawer-card";
  drawer.innerHTML = `
    <div class="smelting-mobile-drawer-preview"></div>
    <div class="smelting-mobile-drawer-copy">
      <span></span>
      <strong></strong>
      <small></small>
    </div>
    <button class="smelting-mobile-drawer-close" type="button" data-mobile-smelting-action="close" aria-label="${gameText("main.smelting.closeDrawer", "Close item actions")}">×</button>
    <div class="smelting-mobile-drawer-actions"></div>
  `;
  drawer.querySelector(".smelting-mobile-drawer-preview").append(createSmeltingSlotPreview(slot, "smelting-mobile-slot-preview", { size: 96 }));
  drawer.querySelector("span").textContent = isFuel
    ? gameText("main.smelting.fuelHeat", "Heat tier {tier}", { tier: smeltingFuelProfile(slot).tier })
    : smeltingResourceCardMeta(slot);
  drawer.querySelector("strong").textContent = backpackSlotDisplayName(slot);
  drawer.querySelector("small").textContent = gameText("main.smelting.singleItemCoordinate", "Single slot · {coord}", { coord });
  const actions = drawer.querySelector(".smelting-mobile-drawer-actions");
  actions.append(
    createSmeltingMobileDrawerButton(
      inputSelected ? "remove-input" : "input",
      inputSelected ? gameText("main.smelting.removeInput", "Remove Input") : gameText("main.smelting.addInputFull", "Add Input"),
    ),
    createSmeltingMobileDrawerButton(
      fuelSelected ? "remove-fuel" : "fuel",
      fuelSelected ? gameText("main.smelting.removeFuel", "Remove Fuel") : gameText("main.smelting.useAsFuel", "Use as Fuel"),
      !isFuel,
    ),
    createSmeltingMobileDrawerButton("recipes", gameText("main.smelting.viewRecipes", "View Recipes")),
  );
  smeltingMobileActionDrawer.replaceChildren(drawer);
  smeltingMobileActionDrawer.hidden = false;
}

function createSmeltingMobileDrawerButton(action, label, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mobileSmeltingAction = action;
  button.textContent = label;
  button.disabled = disabled;
  return button;
}

function handleSmeltingMobileDrawerClick(event) {
  const button = event.target instanceof Element ? event.target.closest("[data-mobile-smelting-action]") : null;
  if (!button || !smeltingMobileActionDrawer?.contains(button) || smeltingState === "running") return;
  event.preventDefault();
  const action = button.dataset.mobileSmeltingAction;
  const sourceItemId = smeltingMobileSelectedSourceItemId;
  if (action === "close") {
    smeltingMobileSelectedSourceItemId = "";
    smeltingMobileDrawerSignature = "";
    updateSmeltingCardSelection(smeltingResourceGrid);
    renderSmeltingMobileActionDrawer([]);
    return;
  }
  if (action === "recipes") {
    selectSmeltingMobileTab("recipes");
    return;
  }
  if (!sourceItemId) return;
  if (action === "remove-input") removeSmeltingId(smeltingInputSourceItemIds, sourceItemId);
  if (action === "remove-fuel") removeSmeltingId(smeltingFuelSourceItemIds, sourceItemId);
  if (action === "input") addSmeltingSourceToZone(sourceItemId, "input");
  if (action === "fuel") addSmeltingSourceToZone(sourceItemId, "fuel");
  resetSmeltingProgressState({ render: false });
  resetSmeltingRenderSignatures();
  scheduleSmeltingPanelUpdate();
}

function smeltingCollectionSignature(slots, selectedSourceItemId, scope) {
  return [
    scope,
    smeltingLocaleSignature(),
    selectedSourceItemId ?? "-",
    slots.map(smeltingSlotSignature).join("||"),
  ].join("::");
}

function smeltingSlotSignature(slot) {
  if (!slot) return "-";
  return [
    slot.sourceItemId ?? "",
    slot.atlasKey ?? "",
    slot.blockType ?? "",
    slot.chainIndex ?? "",
    slot.record?.worldX ?? "",
    slot.record?.worldY ?? "",
    slot.record?.worldZ ?? "",
    slot.volumeMm3 ?? "",
    slot.dimensionsM?.width ?? "",
    slot.dimensionsM?.height ?? "",
    slot.dimensionsM?.depth ?? "",
    Number.isFinite(slot.massKg) ? slot.massKg : "",
    slot.meta?.name ?? "",
    slot.meta?.source ?? "",
  ].join("|");
}

function smeltingLocaleSignature() {
  return `${localStorage.getItem("nicechunk.language") ?? "en"}:${i18nReady ? "ready" : "loading"}`;
}

function resetSmeltingRenderSignatures() {
  smeltingResourceRenderSignature = "";
  smeltingFuelRenderSignature = "";
  smeltingWorkbenchRenderSignature = "";
  smeltingOutputRenderSignature = "";
  smeltingRecipeRenderSignature = "";
  smeltingMobileDrawerSignature = "";
}

function cleanupSmeltingPreviewTree(root) {
  root?.querySelectorAll?.("*").forEach((node) => {
    node.__nicechunkCleanup?.();
  });
}

function updateSmeltingProgressUi(inputSlots = smeltingActiveInputSlots, fuelSlots = smeltingActiveFuelSlots) {
  const recipeMatch = smeltingRecipeMatch(inputSlots);
  const recipeReady = isSmeltingRecipeReady(recipeMatch, inputSlots);
  const batchMultiplier = smeltingBatchMultiplier(recipeMatch?.recipe, inputSlots);
  const requiredHeatTier = recipeMatch?.recipe?.requiredHeatTier ?? maxSmeltingRequiredHeatTier(inputSlots);
  const availableFuelTier = maxSmeltingFuelTier(fuelSlots);
  const visualFuelTier = totalSmeltingFuelTier(fuelSlots);
  const heatReady = inputSlots.length && fuelSlots.length ? availableFuelTier >= requiredHeatTier : false;
  const ready = Boolean(inputSlots.length && recipeReady && fuelSlots.length && heatReady && smeltingState !== "running");
  const hasBackpack = Boolean(equippedBackpackStatus?.backpack);
  const waitingForBackpackData = equippedBackpackLoading && !inputSlots.length && !equippedBackpackStatus;
  const uiState = waitingForBackpackData ? "syncing" : !inputSlots.length ? "no-input" : !recipeReady ? "no-recipe" : !fuelSlots.length ? "no-fuel" : !heatReady ? "heat-missing" : smeltingState;
  smeltingFlameIntensity = smeltingFireIntensityForFuelTier(visualFuelTier, smeltingState);
  if (smeltingPanel) {
    smeltingPanel.dataset.smeltingState = uiState;
    smeltingPanel.dataset.heatReady = heatReady ? "true" : "false";
    smeltingPanel.dataset.fuelTier = String(availableFuelTier);
    smeltingPanel.dataset.fuelPower = String(visualFuelTier);
    smeltingPanel.style.setProperty("--smelt-fire-intensity", smeltingFlameIntensity.toFixed(3));
  }
  if (smeltingHeatCore) smeltingHeatCore.dataset.smeltingState = uiState;
  if (smeltingStart) {
    const nextStartText =
      smeltingState === "running"
        ? gameText("main.smelting.running", "Smelting...")
        : gameText("main.smelting.start", "Start Smelting");
    smeltingStart.disabled = !ready;
    if (nextStartText !== smeltingLastStartText || smeltingStart.textContent !== nextStartText) {
      smeltingStart.textContent = nextStartText;
      smeltingLastStartText = nextStartText;
    }
  }
  const progress = smeltingState === "complete" ? 100 : smeltingProgress;
  const progressText = `${Math.round(progress)}%`;
  if (smeltingProgressValue && (progressText !== smeltingLastProgressValue || smeltingProgressValue.textContent !== progressText)) {
    smeltingProgressValue.textContent = progressText;
    smeltingLastProgressValue = progressText;
  }
  if (smeltingProgressBar) smeltingProgressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  if (!smeltingStatus) return;
  let nextStatusText = "";
  if (waitingForBackpackData) {
    nextStatusText = gameText("main.smelting.statusSyncing", "Syncing equipped backpack...");
  } else if (!hasBackpack && !inputSlots.length) {
    nextStatusText = gameText("main.smelting.statusNoBackpack", "Equip a backpack before smelting.");
  } else if (!inputSlots.length) {
    nextStatusText = gameText("main.smelting.statusNoInput", "Select a mined resource.");
  } else if (!recipeReady) {
    nextStatusText = smeltingNoRecipeStatusText(recipeMatch, inputSlots);
  } else if (!fuelSlots.length) {
    nextStatusText = gameText("main.smelting.statusNoFuel", "Add compatible fuel.");
  } else if (!heatReady) {
    nextStatusText = gameText("main.smelting.statusHeatMissingMulti", "Fuel heat tier {fuel} is below required tier {required}.", {
      fuel: availableFuelTier || "-",
      required: requiredHeatTier,
    });
  } else if (smeltingState === "running") {
    nextStatusText = gameText("main.smelting.statusRunning", "Heating resource sample...");
  } else if (smeltingState === "complete") {
    nextStatusText = gameText("main.smelting.statusComplete", "Forge material preview completed.");
  } else {
    nextStatusText = gameText("main.smelting.statusReady", "Ready to preview smelting.");
  }
  if (nextStatusText !== smeltingLastStatusText || smeltingStatus.textContent !== nextStatusText) {
    smeltingStatus.textContent = nextStatusText;
    smeltingLastStatusText = nextStatusText;
  }
}

function smeltingFireIntensityForFuelTier(fuelTier = 0, state = smeltingState) {
  if (!fuelTier) return state === "running" ? 0.16 : 0.08;
  const tierIntensity = 0.2 + Math.min(1, fuelTier / 10) * 0.86;
  const runningBoost = state === "running" ? 0.14 : 0;
  return Math.max(0.08, Math.min(1.12, tierIntensity + runningBoost));
}

function stopSmeltingProgressTimer() {
  if (!smeltingProgressTimer) return;
  window.cancelAnimationFrame(smeltingProgressTimer);
  smeltingProgressTimer = null;
}

function resetSmeltingProgressState({ render = true } = {}) {
  stopSmeltingProgressTimer();
  smeltingState = "idle";
  smeltingProgress = 0;
  smeltingProgressStartedAt = 0;
  if (render) updateSmeltingProgressUi();
}

async function startSmeltingPreview() {
  if (smeltingState === "running") return;
  const slots = createAvailableBackpackSlotsFromChain(equippedBackpackStatus?.backpack ?? null).filter(Boolean);
  const inputSlots = selectedSmeltingSlots(slots, smeltingInputSourceItemIds);
  const fuelSlots = selectedSmeltingSlots(slots, smeltingFuelSourceItemIds).filter(isSmeltingFuelSlot);
  const recipeMatch = smeltingRecipeMatch(inputSlots);
  const recipeReady = isSmeltingRecipeReady(recipeMatch, inputSlots);
  const batchMultiplier = smeltingBatchMultiplier(recipeMatch?.recipe, inputSlots);
  const requiredHeatTier = recipeMatch?.recipe?.requiredHeatTier ?? maxSmeltingRequiredHeatTier(inputSlots);
  const heatReady = inputSlots.length && fuelSlots.length ? maxSmeltingFuelTier(fuelSlots) >= requiredHeatTier : false;
  if (!inputSlots.length || !recipeReady || !fuelSlots.length || !heatReady) {
    scheduleSmeltingPanelUpdate();
    return;
  }
  stopSmeltingProgressTimer();
  smeltingActiveInputSlots = inputSlots;
  smeltingActiveFuelSlots = fuelSlots;
  smeltingState = "running";
  smeltingProgress = 0;
  smeltingProgressStartedAt = performance.now();
  updateSmeltingProgressUi(inputSlots, fuelSlots);
  const tick = () => {
    const elapsed = performance.now() - smeltingProgressStartedAt;
    smeltingProgress = Math.min(92, (elapsed / smeltingProgressDurationMs) * 92);
    updateSmeltingProgressUi(inputSlots, fuelSlots);
    smeltingProgressTimer = window.requestAnimationFrame(tick);
  };
  smeltingProgressTimer = window.requestAnimationFrame(tick);
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.executeSmeltingOnChain({
      recipeId: smeltingOnChainRecipeId(recipeMatch.recipe),
      recipeTableId: smeltingOnChainRecipeTableId(recipeMatch.recipe),
      inputIndexes: inputSlots.map((slot) => slot.chainIndex),
      fuelIndexes: fuelSlots.map((slot) => slot.chainIndex),
      batchMultiplier,
      backpackAddress: equippedBackpackStatus?.backpack?.publicKey ?? null,
    });
    if (!result?.submitted) {
      stopSmeltingProgressTimer();
      smeltingState = "idle";
      smeltingProgress = 0;
      if (smeltingStatus) {
        smeltingStatus.textContent = gameText("main.smelting.submitFailed", "Smelting transaction failed: {reason}", {
          reason: chainSubmitReasonLabel(result?.reason),
        });
        smeltingLastStatusText = smeltingStatus.textContent;
      }
      updateSmeltingProgressUi(inputSlots, fuelSlots);
      return;
    }
    stopSmeltingProgressTimer();
    smeltingProgress = 100;
    smeltingState = "complete";
    smeltingInputSourceItemIds.length = 0;
    smeltingFuelSourceItemIds.length = 0;
    invalidateProfileChainSkillXp();
    await refreshEquippedBackpack({ force: true });
    if (smeltingStatus) {
      smeltingStatus.textContent = gameText("main.smelting.submitComplete", "Smelting confirmed on-chain: {signature}", {
        signature: shortSignature(result.signature),
      });
      smeltingLastStatusText = smeltingStatus.textContent;
    }
    scheduleSmeltingPanelUpdate({ reset: true });
  } catch (error) {
    console.warn("Failed to execute NiceChunk smelting", error);
    stopSmeltingProgressTimer();
    smeltingState = "idle";
    smeltingProgress = 0;
    if (smeltingStatus) {
      smeltingStatus.textContent = gameText("main.smelting.submitFailed", "Smelting transaction failed: {reason}", {
        reason: readableChainError(error),
      });
      smeltingLastStatusText = smeltingStatus.textContent;
    }
    updateSmeltingProgressUi(inputSlots, fuelSlots);
  }
}

function createSmeltingRecipe(inputSlots, fuelSlots) {
  const primarySlot = inputSlots[0] ?? null;
  const atlas = getBlockAtlasEntry(primarySlot?.atlasKey);
  const recipeMatch = smeltingRecipeMatch(inputSlots);
  const recipe = recipeMatch?.recipe ?? null;
  const recipeReady = isSmeltingRecipeReady(recipeMatch, inputSlots);
  const batchMultiplier = smeltingBatchMultiplier(recipe, inputSlots);
  const massKg = totalSmeltingInputMassKg(inputSlots);
  const heatTier = recipe?.requiredHeatTier ?? maxSmeltingRequiredHeatTier(inputSlots);
  const fuelTier = maxSmeltingFuelTier(fuelSlots);
  const heatTierData = smeltingHeatTierByTier(heatTier);
  const properties = recipe
    ? deriveSmeltingMaterialProperties({
        material: recipe,
        inputSlots: smeltingPropertySlots(inputSlots),
        fuelSlots: fuelSlots.map((slot) => ({ ...slot, fuelTier: smeltingFuelProfile(slot).tier })),
        sourceSeed: inputSlots.map((slot) => slot.sourceItemId ?? "").join("|"),
      })
    : null;
  const localizedName = inputSlots.length > 1
    ? smeltingInputBatchLabel(inputSlots)
    : smeltingInputName(primarySlot);
  const outputVolumeMm3 = recipe && batchMultiplier >= 1 ? smeltingRecipeOutputVolumeMm3(recipe, batchMultiplier, inputSlots) : 0;
  return {
    name: recipe ? smeltingMaterialName(recipe.id) : gameText("main.smelting.noRecipeName", "Unmatched batch"),
    description: recipe
      ? smeltingMaterialDescription(recipe, localizedName)
      : gameText("main.smelting.noRecipeDescription", "This selected batch does not match an official NiceChunk smelting recipe yet. Adjust the input blocks to match the public material table.", { resource: localizedName }),
    heatLabel: fuelTier >= heatTier
      ? gameText("main.smelting.heatMet", "Tier {tier} met", { tier: heatTier, temp: heatTierData?.temperatureC ?? "" })
      : gameText("main.smelting.heatMissing", "Tier {required} required, fuel {fuel}", { required: heatTier, fuel: fuelTier || "-" }),
    servingsLabel: recipe && batchMultiplier >= 1
      ? gameText("main.smelting.recipeServingsValue", "{count}x", { count: batchMultiplier })
      : gameText("main.smelting.notReady", "Not ready"),
    outputSizeLabel: outputVolumeMm3 > 0
      ? formatVolumeCubeSize(outputVolumeMm3)
      : gameText("main.backpack.unknownSize", "Unknown"),
    outputVolumeMm3,
    outputDimensionsM: materialCubeDimensionsFromVolume(outputVolumeMm3),
    yieldRange: recipe ? smeltingOutputRateLabel(recipe) : formatMassKg(massKg),
    quality: recipe
      ? recipeReady
        ? gameText("main.smelting.recipeMatched", "Recipe matched: {recipe}", { recipe: smeltingMaterialName(recipe.id) })
        : smeltingNoRecipeStatusText(recipeMatch, inputSlots)
      : gameText("main.smelting.noRecipeMatch", "No public recipe match"),
    composition: (recipe?.composition?.length ? recipe.composition : mergedSmeltingComposition(inputSlots)).slice(0, 7),
    color: smeltingRecipeColor(recipe) ?? atlas?.colors?.[0] ?? "#8bd8ff",
    properties,
  };
}

function maxSmeltingRequiredHeatTier(inputSlots) {
  return smeltingRecipeMatch(inputSlots)?.recipe?.requiredHeatTier ?? 1;
}

function maxSmeltingFuelTier(fuelSlots) {
  return Math.max(0, ...fuelSlots.map((slot) => smeltingFuelProfile(slot).tier));
}

function totalSmeltingFuelTier(fuelSlots) {
  return fuelSlots.reduce((total, slot) => total + Math.max(0, smeltingFuelProfile(slot).tier || 0), 0);
}

function mergedSmeltingComposition(inputSlots) {
  const totals = new Map();
  for (const slot of inputSlots) {
    const atlas = getBlockAtlasEntry(slot?.atlasKey);
    for (const [symbol, range] of atlas?.composition ?? []) {
      const midpoint = smeltingCompositionMidpoint(range);
      totals.set(symbol, (totals.get(symbol) ?? 0) + midpoint);
    }
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([symbol, value]) => [symbol, `~${Math.max(0.1, value / Math.max(1, inputSlots.length)).toFixed(1)}%`]);
}

function smeltingCompositionMidpoint(range) {
  const numbers = String(range).match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length) return 0;
  if (numbers.length === 1) return numbers[0];
  return (numbers[0] + numbers[1]) / 2;
}

function smeltingYieldRangeKg(massKg, materialClass, yieldCount = 1) {
  const mass = Number.isFinite(massKg) && massKg > 0 ? massKg : 1;
  const factor = {
    carbon: [0.16, 0.34],
    fiber: [0.18, 0.42],
    polymer: [0.2, 0.44],
    ceramic: [0.36, 0.7],
    glass: [0.42, 0.74],
    flux: [0.28, 0.56],
    stone: [0.4, 0.78],
    metal: [0.3, 0.62],
    composite: [0.24, 0.58],
  }[materialClass] ?? [0.26, 0.6];
  const yieldScale = Math.max(1, Number(yieldCount) || 1);
  return [mass * factor[0] * yieldScale, mass * factor[1] * yieldScale];
}

function isSmeltingFuelSlot(slot) {
  return smeltingFuelProfile(slot).tier > 0;
}

function smeltingFuelProfile(slot) {
  if (slot?.materialId) {
    const materialFuel = smeltingFuelForMaterialId(slot.materialId);
    if (materialFuel) return { tier: materialFuel.heatTier ?? 0, fuel: materialFuel };
  }
  const key = slot?.atlasKey ?? "";
  const fuel = smeltingFuelForRawKey(key);
  return { tier: fuel?.heatTier ?? 0, fuel };
}

function smeltingInputKeys(inputSlots = []) {
  return inputSlots.map(smeltingSlotInputKey).filter(Boolean);
}

function smeltingSlotInputKey(slot) {
  if (slot?.materialId) return smeltingMaterialInputKey(slot.materialId);
  return slot?.atlasKey ?? "";
}

function createSmeltingInputCountFromSlots(inputSlots = []) {
  return createSmeltingInputCounts(smeltingInputKeys(inputSlots));
}

function smeltingRecipeMatch(inputSlots = []) {
  return findBestSmeltingRecipeForKeys(smeltingInputKeys(inputSlots));
}

function isSmeltingRecipeReady(match, inputSlots = []) {
  if (!match?.recipe || !match.score?.exact) return false;
  return smeltingBatchMultiplier(match.recipe, inputSlots) >= 1;
}

function smeltingBatchMultiplier(recipe, inputSlots = []) {
  return smeltingRecipeInputMultiplier(recipe, createSmeltingInputCountFromSlots(inputSlots));
}

function smeltingOnChainRecipeId(recipe) {
  return recipe?.recipeKind === "merge"
    ? smeltingMergeRecipeIdForMaterialId(recipe.id)
    : smeltingRecipeIdForMaterialId(recipe?.id);
}

function smeltingOnChainRecipeTableId(recipe) {
  return recipe?.recipeKind === "merge"
    ? smeltingMergeRecipeTableIdForMaterialId(recipe.id)
    : smeltingRecipeTableIdForMaterialId(recipe?.id);
}

function smeltingRecipeOutputVolumeMm3(recipe, servings = 1, inputSlots = []) {
  if (!recipe) return 0;
  const inputVolume = inputSlots.length
    ? totalSmeltingInputVolumeMm3(inputSlots)
    : recipeRequirements(recipe).reduce((sum, input) => sum + Math.max(1, Number(input.amount) || 1) * 1_000_000, 0)
      * Math.max(1, Math.floor(Number(servings) || 1));
  const recipeYieldBps = smeltingRecipeYieldBps(recipe);
  const skillOutputBps = smeltingSkillOutputBpsForLevel(currentSmeltingSkillLevelForPreview());
  return Math.max(1, Math.floor(inputVolume * recipeYieldBps / 10_000 * skillOutputBps / 10_000));
}

function totalSmeltingInputVolumeMm3(inputSlots = []) {
  return inputSlots.reduce((sum, slot) => sum + smeltingSlotVolumeMm3(slot), 0);
}

function smeltingSlotVolumeMm3(slot) {
  const explicit = Number(slot?.volumeMm3);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const dimensions = normalizedPreviewDimensions(slot?.dimensionsM);
  if (dimensions) return Math.max(1, Math.floor(dimensions.width * dimensions.height * dimensions.depth * 1_000_000_000));
  const atlas = getBlockAtlasEntry(slot?.atlasKey);
  const atlasVolume = Number(atlas?.physical?.volumeM3);
  if (Number.isFinite(atlasVolume) && atlasVolume > 0) return Math.max(1, Math.floor(atlasVolume * 1_000_000_000));
  return 1_000_000;
}

function currentSmeltingSkillLevelForPreview() {
  const skill = playerSkillDefinitions.find((entry) => entry.id === "smelting");
  if (!skill) return 0;
  return profileSkillEffectiveLevel(loadProfileSkillLevels(), skill, {
    ...loadProfileSkillXp(),
    ...(profileChainSkillXp ?? {}),
  });
}

function smeltingOutputRateLabel(recipe) {
  const recipeYieldPercent = Math.round(smeltingRecipeYieldBps(recipe) / 100);
  const skillOutputBps = smeltingSkillOutputBpsForLevel(currentSmeltingSkillLevelForPreview());
  const skillLossPercent = Math.max(0, Math.round((10_000 - skillOutputBps) / 100));
  return gameText("main.smelting.outputRateValue", "Recipe {recipePercent}% · skill loss {lossPercent}%", {
    recipePercent: recipeYieldPercent,
    lossPercent: skillLossPercent,
  });
}

function totalSmeltingInputMassKg(inputSlots = []) {
  return inputSlots.reduce((sum, slot) => sum + smeltingSlotMassKg(slot), 0);
}

function smeltingSlotMassKg(slot) {
  if (Number.isFinite(slot?.massKg) && slot.massKg > 0) return slot.massKg;
  const density = Number(slot?.densityKgM3) || Number(getBlockAtlasEntry(slot?.atlasKey)?.physical?.densityKgM3);
  const volumeMm3 = smeltingSlotVolumeMm3(slot);
  const volumeMass = materialMassKgFromVolume(volumeMm3, density);
  if (Number.isFinite(volumeMass) && volumeMass > 0) return volumeMass;
  const atlasMass = Number(getBlockAtlasEntry(slot?.atlasKey)?.physical?.massKg);
  return Number.isFinite(atlasMass) && atlasMass > 0 ? atlasMass : 1;
}

function materialDensityKgM3(attributes = null) {
  const densityScore = Number(attributes?.density);
  return Number.isFinite(densityScore) && densityScore > 0 ? densityScore * 100 : null;
}

function materialMassKgFromVolume(volumeMm3, densityKgM3) {
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0 || !Number.isFinite(densityKgM3) || densityKgM3 <= 0) return null;
  return volumeMm3 * 1e-9 * densityKgM3;
}

function materialCubeDimensionsFromVolume(volumeMm3) {
  const volume = Number(volumeMm3);
  if (!Number.isFinite(volume) || volume <= 0) return null;
  const sideMeters = Math.cbrt(volume * 1e-9);
  return { width: sideMeters, height: sideMeters, depth: sideMeters };
}

function smeltingNoRecipeStatusText(match, inputSlots = []) {
  if (!match?.recipe) {
    return gameText("main.smelting.noRecipeMatch", "No public recipe match for this batch.");
  }
  const keys = smeltingInputKeys(inputSlots);
  const missing = missingSmeltingInputs(match.recipe, keys);
  if (missing.length) {
    return gameText("main.smelting.statusRecipeIncomplete", "Recipe candidate {recipe}: missing {missing}.", {
      recipe: smeltingMaterialName(match.recipe.id),
      missing: missing.map(smeltingInputRequirementLabel).join(", "),
    });
  }
  const extra = smeltingExtraInputs(match.recipe, inputSlots);
  if (extra.length) {
    return gameText("main.smelting.statusRecipeExtra", "Recipe candidate {recipe}: remove extra {extra}.", {
      recipe: smeltingMaterialName(match.recipe.id),
      extra: extra.join(", "),
    });
  }
  return gameText("main.smelting.recipeCandidate", "Recipe candidate: {recipe}.", {
    recipe: smeltingMaterialName(match.recipe.id),
  });
}

function smeltingInputRequirementLabel(input) {
  return gameText("main.smelting.missingInputLabel", "{amount}x {resource}", {
    amount: input?.missing ?? input?.amount ?? 1,
    resource: smeltingInputKeyLabel(input?.key),
  });
}

function smeltingInputKeyLabel(key) {
  const materialId = smeltingMaterialIdForInputKey(key);
  if (materialId) return smeltingMaterialName(materialId);
  const atlas = getBlockAtlasEntry(key);
  return localizedBlockResourceName(key, atlas);
}

function smeltingExtraInputs(recipe, inputSlots = []) {
  const required = new Map(recipeRequirements(recipe).map((input) => [input.key, input.amount]));
  const multiplier = smeltingBatchMultiplier(recipe, inputSlots);
  if (multiplier >= 1) return [];
  const counts = createSmeltingInputCountFromSlots(inputSlots);
  return [...counts.entries()]
    .filter(([key, count]) => count > (required.get(key) ?? 0))
    .map(([key, count]) => smeltingInputRequirementLabel({
      key,
      amount: count - (required.get(key) ?? 0),
    }));
}

function smeltingInputName(slot) {
  return backpackSlotDisplayName(slot);
}

function smeltingInputBatchLabel(inputSlots = []) {
  const counts = createSmeltingInputCountFromSlots(inputSlots);
  const names = [...counts.entries()].slice(0, 3).map(([key, count]) => {
    return `${smeltingInputKeyLabel(key)} x${count}`;
  });
  const suffix = counts.size > 3 ? ` +${counts.size - 3}` : "";
  return names.length
    ? `${names.join(", ")}${suffix}`
    : gameText("main.smelting.mixedBatch", "Mixed batch");
}

function smeltingMaterialName(materialId) {
  return gameText(`resourceAtlas.material.item.${materialId}.name`, humanizeSmeltingId(materialId));
}

function smeltingMaterialDescription(recipe, sourceName) {
  return gameText(
    `resourceAtlas.material.item.${recipe.id}.description`,
    "Official forge-ready material produced by the public NiceChunk smelting recipe table from {resource}.",
    { resource: sourceName },
  );
}

function humanizeSmeltingId(id) {
  return String(id || "material")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function smeltingRecipeColor(recipe) {
  if (!recipe) return null;
  const byClass = {
    carbon: "#2b2a24",
    fiber: "#9d8f56",
    polymer: "#bd8a54",
    ceramic: "#c9a16c",
    glass: "#8de8ff",
    flux: "#d8dfbd",
    stone: "#87909b",
    metal: "#c8d2d6",
    composite: "#6bd6c8",
  };
  return byClass[recipe.class] ?? elementPreviewColor(recipe.composition?.[0]?.[0]) ?? "#8bd8ff";
}

function smeltingPropertySlots(slots = []) {
  return slots.map((slot) => {
    const atlas = getBlockAtlasEntry(slot?.atlasKey);
    return {
      ...slot,
      atlas,
      category: atlas?.category,
      composition: atlas?.composition,
      densityKgM3: atlas?.physical?.densityKgM3,
    };
  });
}

function smeltingAttributeLabel(key) {
  return gameText(`main.materialAttributes.${key}`, humanizeSmeltingId(key));
}

function smeltingAttributeLine(key, value) {
  return `${smeltingAttributeLabel(key)} ${value}/100`;
}

function smeltingGradeLabel(grade) {
  return gameText(`main.materialGrade.${grade}`, humanizeSmeltingId(grade));
}

function elementPreviewColor(symbol) {
  return {
    C: "#2b2b2b",
    O: "#9fd8ff",
    H: "#d9f5ff",
    N: "#8aa9ff",
    Si: "#b7a99a",
    Al: "#c9d0d5",
    Fe: "#9b7b63",
    Ca: "#f0eee4",
    K: "#d6c4ff",
    Na: "#d5d9e2",
    Mg: "#d9dde1",
    Cu: "#b66a32",
    S: "#e7cf43",
  }[symbol] ?? null;
}

function createSmeltingSlotPreview(slot, className, { size = chainBlockPreviewSize, previewDimensionsM = previewDimensionsForSlot(slot) } = {}) {
  const wrap = document.createElement("div");
  wrap.className = className;
  wrap.append(
    createChainEventBlockPreview(slot.blockType, {
      className: `${className}-block`,
      canvasClassName: `${className}-canvas`,
      rotating: false,
      block: null,
      immediate: false,
      size,
      previewDimensionsM,
    }),
  );
  return wrap;
}

function createSmeltingResourceSwatch(slot) {
  if (slot?.materialId) {
    const material = slot.material ?? smeltingMaterialById(slot.materialId);
    const wrap = document.createElement("div");
    wrap.className = "smelting-resource-swatch smelting-resource-swatch-material";
    wrap.append(createSmeltingMaterialPreview(material ?? fallbackBackpackItemMaterial(slot), {
      size: 64,
      previewDimensionsM: previewDimensionsForSlot(slot),
    }));
    wrap.setAttribute("aria-hidden", "true");
    return wrap;
  }
  if (!slot?.blockType && (slot?.itemCode != null || slot?.itemRefId != null || slot?.itemPda)) {
    const wrap = document.createElement("div");
    wrap.className = "smelting-resource-swatch smelting-resource-swatch-material";
    wrap.append(createSmeltingMaterialPreview(fallbackBackpackItemMaterial(slot), {
      size: 64,
      previewDimensionsM: previewDimensionsForSlot(slot),
    }));
    wrap.setAttribute("aria-hidden", "true");
    return wrap;
  }
  return createSmeltingSlotPreview(slot, "smelting-resource-swatch", { size: 64 });
}

function createSmeltingMaterialPreview(recipe, { size = chainBlockPreviewSize, previewDimensionsM = null } = {}) {
  const box = document.createElement("div");
  box.className = "smelting-material-preview";
  const canvas = createResourceMaterialPreviewCanvas(recipe, {
    className: "smelting-material-preview-canvas",
    size,
    previewDimensionsM,
  });
  box.append(canvas);
  return box;
}

function createSmeltingEmptyState(key, fallback) {
  const empty = document.createElement("div");
  empty.className = "smelting-empty-state smelting-empty-state-guided";
  const config = smeltingEmptyStateConfig(key);

  const icon = document.createElement("span");
  icon.className = `smelting-empty-icon ${config.iconClass}`;
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "smelting-empty-copy";
  const title = document.createElement("strong");
  title.textContent = gameText(config.titleKey, config.titleFallback);
  const body = document.createElement("p");
  body.textContent = gameText(key, fallback);
  copy.append(title, body);

  const hints = document.createElement("div");
  hints.className = "smelting-empty-hints";
  config.hints.forEach(([hintKey, hintFallback]) => {
    const hint = document.createElement("b");
    hint.textContent = gameText(hintKey, hintFallback);
    hints.append(hint);
  });
  empty.append(icon, copy, hints);
  return empty;
}

function smeltingEmptyStateConfig(key) {
  const configs = {
    "main.smelting.statusSyncing": {
      iconClass: "is-syncing",
      titleKey: "main.smelting.emptySyncTitle",
      titleFallback: "Syncing backpack",
      hints: [
        ["main.smelting.emptyHintReadPda", "Reading PDA"],
        ["main.smelting.emptyHintSlots", "Checking slots"],
      ],
    },
    "main.smelting.noBackpackResources": {
      iconClass: "is-backpack",
      titleKey: "main.smelting.emptyNoBackpackTitle",
      titleFallback: "Backpack required",
      hints: [
        ["main.smelting.emptyHintEquip", "Equip backpack"],
        ["main.smelting.emptyHintMine", "Mine resources"],
      ],
    },
    "main.smelting.noResources": {
      iconClass: "is-resource",
      titleKey: "main.smelting.emptyNoResourcesTitle",
      titleFallback: "No smeltable resources",
      hints: [
        ["main.smelting.emptyHintMine", "Mine resources"],
        ["main.smelting.emptyHintCoordinate", "Coordinate-bound"],
      ],
    },
    "main.smelting.noFuel": {
      iconClass: "is-fuel",
      titleKey: "main.smelting.emptyNoFuelTitle",
      titleFallback: "Fuel missing",
      hints: [
        ["main.smelting.emptyHintWood", "Wood blocks"],
        ["main.smelting.emptyHintBiomass", "Biomass"],
      ],
    },
    "main.smelting.selectInput": {
      iconClass: "is-output",
      titleKey: "main.smelting.emptySelectInputTitle",
      titleFallback: "Awaiting material",
      hints: [
        ["main.smelting.emptyHintSelect", "Select input"],
        ["main.smelting.emptyHintPreview", "Preview output"],
      ],
    },
  };
  return configs[key] ?? {
    iconClass: "is-idle",
    titleKey: "main.smelting.emptyIdleTitle",
    titleFallback: "Station idle",
    hints: [
      ["main.smelting.emptyHintSelect", "Select input"],
      ["main.smelting.emptyHintFuel", "Add fuel"],
    ],
  };
}

function localizedElementLabel(symbol) {
  const normalized = String(symbol || "").trim();
  if (!normalized) return "";
  const label = gameText(`elements.names.${normalized}`, normalized);
  return label === normalized ? normalized : label;
}

function selectMarketTab(tabName) {
  const selected = ["browse", "sell", "orders"].includes(tabName) ? tabName : "browse";
  if (marketPanel?.dataset.activeMarketTab && marketPanel.dataset.activeMarketTab !== selected) {
    closeMarketListingDetails();
  }
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
  alignMarketChainListingCacheWithActiveFilters();
  updateMarketSearchMeta();
  updateMarketRefreshButton();
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
          count: availableBackpackItemCount(backpack),
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

function updateMarketRefreshButton() {
  if (!marketRefresh) return;
  marketRefresh.disabled = marketChainListingsLoading;
  marketRefresh.setAttribute("aria-busy", String(marketChainListingsLoading));
}

function setMarketStatus(message, tone = "info") {
  if (!marketStatus) return;
  marketStatus.textContent = message || "";
  marketStatus.hidden = !message;
  marketStatus.dataset.tone = tone;
}

function setMarketLocalizedStatus(key, fallback, params = {}, tone = "info") {
  const message = gameText(key, fallback, params);
  setMarketStatus(message, tone);
  return message;
}

function setMarketFormLocalizedStatus(key, fallback, params = {}, tone = "info") {
  const message = setMarketLocalizedStatus(key, fallback, params, tone);
  if (marketFormStatus) marketFormStatus.textContent = message;
  return message;
}

function handleMarketRefreshClick(event) {
  event.preventDefault();
  event.stopPropagation();
  closeMarketListingDetails();
  marketChainListingsLoadedAt = 0;
  renderMarketTabPage(marketPanel?.dataset.activeMarketTab || "browse");
  void refreshMarketChainListings({ force: true });
  updateMarketRefreshButton();
}

function updateMarketSearchMeta() {
  if (!marketSearchMeta) return;
  const query = marketSearchQuery();
  const category = marketCategoryLabel(marketSelectedCategory);
  const sort = marketSortLabel(marketSelectedSort);
  const currency = marketCurrencyLabel(marketSelectedCurrency);
  const filterKey = marketChainListingFilterKey(currentMarketChainListingFilters());
  const chainStatus = marketChainListingsLoading
    ? gameText("main.market.chainListingsSyncing", "Syncing chain listings...")
    : marketChainListingsError
      ? gameText("main.market.chainListingsUnavailable", "Chain sync unavailable")
      : marketChainListingsLoadedAt > 0 && filterKey === marketChainListingsFilterKey
        ? gameText("main.market.chainListingsSynced", "Chain listings synced")
        : "";
  const baseMeta = query
    ? gameText("main.market.searchMetaActive", "{category} · {currency} · {sort} · \"{query}\"", { category, currency, sort, query })
    : gameText("main.market.searchMetaIdle", "{category} · {currency} · {sort}", { category, currency, sort });
  marketSearchMeta.textContent = chainStatus ? `${baseMeta} · ${chainStatus}` : baseMeta;
}

function updateMarketCategoryButtons() {
  marketCategoryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.marketCategory === marketSelectedCategory);
  });
}

function renderMarketListings() {
  if (!marketListingGrid) return;
  const listings = sortMarketListings(filterMarketListings([...marketSampleListings, ...loadMergedMarketListings()]));
  const page = paginateMarketItems(listings, "browse");
  renderMarketPagination(marketListingPager, "browse", page);
  if (!listings.length) {
    marketListingGrid.replaceChildren(createMarketEmptyState(
      marketChainListingsLoading
        ? gameText("main.market.loadingListings", "Loading listings...")
        : gameText("main.market.noListings", "No listings match"),
      marketChainListingsError
        ? gameText("main.market.chainListingLoadFailed", "On-chain listings are temporarily unavailable.")
        : gameText("main.market.noListingsMeta", "Try another category or search term."),
      null,
      marketChainListingsLoading
        ? marketEmptyPreset("sync")
        : marketChainListingsError
          ? marketEmptyPreset("chain")
          : marketEmptyPreset("search"),
    ));
    return;
  }
  marketListingGrid.replaceChildren(...page.items.map((listing) => createMarketListingCard(listing, {
    order: false,
    tabName: "browse",
  })));
}

function renderMarketTabPage(tabName) {
  if (tabName === "sell") {
    renderMarketInventory();
    updateMarketListingDraft();
    return;
  }
  if (tabName === "orders") {
    renderMarketOrders();
    return;
  }
  renderMarketListings();
}

function scheduleMarketTabPageRender(tabName) {
  window.setTimeout(() => renderMarketTabPage(tabName), 50);
}

function renderMarketOrders() {
  if (!marketOrdersGrid) return;
  const orders = sortMarketListings(filterMarketListings(loadMarketOrderListings()));
  const page = paginateMarketItems(orders, "orders");
  renderMarketPagination(marketOrdersPager, "orders", page);
  if (!orders.length) {
    marketOrdersGrid.replaceChildren(createMarketEmptyState(
      gameText("main.market.noOrders", "No active orders"),
      gameText("main.market.noOrdersMeta", "Wallet orders will appear here."),
      null,
      marketEmptyPreset("orders"),
    ));
    return;
  }
  marketOrdersGrid.replaceChildren(...page.items.map((listing) => createMarketListingCard(listing, {
    order: true,
    tabName: "orders",
  })));
}

function renderMarketInventory() {
  if (!marketInventoryGrid) return;
  if (marketNeedsChainSourceLockSync()) {
    if (marketChainListingsError) {
      marketInventoryGrid.replaceChildren(createMarketEmptyState(
        gameText("main.market.chainListingLoadFailed", "On-chain listings are temporarily unavailable."),
        gameText("main.market.chainListingsUnavailable", "Chain sync unavailable"),
        {
          label: gameText("main.market.refresh", "Refresh market listings"),
          onClick: () => {
            marketChainListingsLoadedAt = 0;
            renderMarketInventory();
            void refreshMarketChainListings({ force: true });
          },
        },
        marketEmptyPreset("chain"),
      ));
    } else {
      marketInventoryGrid.replaceChildren(createMarketEmptyState(
        gameText("main.market.loadingListings", "Loading listings..."),
        gameText("main.market.chainListingsSyncing", "Syncing chain listings..."),
        null,
        marketEmptyPreset("sync"),
      ));
    }
    return;
  }
  const items = filterMarketInventoryItems(collectMarketSelectableItems());
  if (!items.length) {
    marketInventoryGrid.replaceChildren(createMarketEmptyState(
      gameText("main.market.noInventoryItems", "No listable items"),
      gameText("main.market.noInventoryItemsMeta", "Equip a backpack or keep tools in your hotbar to create listings."),
      null,
      marketEmptyPreset("inventory"),
    ));
    return;
  }
  marketInventoryGrid.replaceChildren(...items.map(createMarketInventoryItemButton));
}

function filterMarketListings(listings) {
  const query = marketSearchQuery();
  return listings.filter((listing) => {
    if (marketSelectedCategory !== "all" && listing.category !== marketSelectedCategory) return false;
    if (marketSelectedCurrency !== "all" && String(listing.currency || "").toUpperCase() !== marketSelectedCurrency) return false;
    if (!query) return true;
    return marketMatchesSearch([
      marketListingName(listing),
      marketListingMeta(listing),
      marketCategoryLabel(listing.category),
      listing.currency,
      listing.price,
      listing.seller,
      listing.listing,
      listing.sourceInventory,
      listing.sourceRecord
        ? `${listing.sourceRecord.worldX},${listing.sourceRecord.worldY},${listing.sourceRecord.worldZ}`
        : "",
    ], query);
  });
}

function filterMarketInventoryItems(items) {
  const query = marketSearchQuery();
  return items.filter((item) => {
    if (marketSelectedCategory !== "all" && item.category !== marketSelectedCategory) return false;
    if (!query) return true;
    return marketMatchesSearch([
      item.name,
      item.meta,
      marketCategoryLabel(item.category),
      item.source,
      item.backpack,
      item.slot?.record
        ? `${item.slot.record.worldX},${item.slot.record.worldY},${item.slot.record.worldZ}`
        : "",
    ], query);
  });
}

function sortMarketListings(listings) {
  const sort = marketSortOptions.includes(marketSelectedSort) ? marketSelectedSort : "newest";
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort((a, b) => {
      const listingA = a.listing;
      const listingB = b.listing;
      if (sort === "price-asc" || sort === "price-desc") {
        const currencyCompare = marketListingCurrencyRank(listingA) - marketListingCurrencyRank(listingB);
        if (currencyCompare !== 0) return currencyCompare;
        const priceCompare = marketListingPriceValue(listingA) - marketListingPriceValue(listingB);
        if (priceCompare !== 0) return sort === "price-asc" ? priceCompare : -priceCompare;
      } else {
        const createdCompare = marketListingCreatedAt(listingA) - marketListingCreatedAt(listingB);
        if (createdCompare !== 0) return sort === "oldest" ? createdCompare : -createdCompare;
      }
      return a.index - b.index;
    })
    .map(({ listing }) => listing);
}

function marketSearchQuery() {
  return String(marketSearch?.value ?? "").trim().toLowerCase();
}

function marketMatchesSearch(parts, query) {
  return parts
    .filter((part) => part !== null && part !== undefined && part !== "")
    .map((part) => String(part))
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function marketSortLabel(sort) {
  const key = {
    newest: "main.market.sortNewest",
    oldest: "main.market.sortOldest",
    "price-asc": "main.market.sortPriceAsc",
    "price-desc": "main.market.sortPriceDesc",
  }[sort] ?? "main.market.sortNewest";
  return gameText(key, "Newest first");
}

function marketCurrencyLabel(currency) {
  if (currency === "NCK") return gameText("main.market.currencyNck", "NCK");
  if (currency === "SOL") return gameText("main.market.currencySol", "SOL");
  return gameText("main.market.currencyAll", "All currencies");
}

function marketListingCreatedAt(listing) {
  const value = Number(listing?.createdAt || 0);
  return Number.isFinite(value) ? value : 0;
}

function marketListingCurrencyRank(listing) {
  const currency = String(listing?.currency || "").toUpperCase();
  if (currency === "NCK") return 0;
  if (currency === "SOL") return 1;
  return 2;
}

function marketListingPriceValue(listing) {
  const baseUnits = Number(listing?.priceBaseUnits);
  if (Number.isFinite(baseUnits) && baseUnits > 0) return baseUnits;
  const value = Number(listing?.price || 0);
  return Number.isFinite(value) ? value : 0;
}

function resetMarketPages(tabName = null) {
  closeMarketListingDetails();
  if (tabName) {
    marketPageState[tabName] = 1;
    return;
  }
  Object.keys(marketPageState).forEach((key) => {
    marketPageState[key] = 1;
  });
}

function paginateMarketItems(items, tabName) {
  const pageSize = marketPageSizeByTab[tabName] ?? 8;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, marketPageState[tabName] || 1), totalPages);
  marketPageState[tabName] = currentPage;
  const startIndex = total ? (currentPage - 1) * pageSize : 0;
  const endIndex = total ? Math.min(total, startIndex + pageSize) : 0;
  return {
    items: items.slice(startIndex, endIndex),
    page: currentPage,
    pageSize,
    total,
    totalPages,
    start: total ? startIndex + 1 : 0,
    end: endIndex,
  };
}

function renderMarketPagination(container, tabName, page) {
  if (!container) return;
  container.hidden = page.total === 0;
  container.replaceChildren();
  if (page.total === 0) return;
  const summary = document.createElement("span");
  summary.textContent = gameText("main.market.pageSummary", "Showing {start}-{end} of {total}", {
    start: page.start,
    end: page.end,
    total: page.total,
  });
  const controls = document.createElement("div");
  controls.className = "market-pagination-controls";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "<";
  previous.disabled = page.page <= 1;
  previous.setAttribute("aria-label", gameText("main.market.previousPage", "Previous page"));
  previous.addEventListener("click", () => {
    closeMarketListingDetails();
    marketPageState[tabName] = Math.max(1, page.page - 1);
    scheduleMarketTabPageRender(tabName);
  });
  const current = document.createElement("strong");
  current.textContent = gameText("main.market.pageIndicator", "Page {page} / {totalPages}", {
    page: page.page,
    totalPages: page.totalPages,
  });
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = ">";
  next.disabled = page.page >= page.totalPages;
  next.setAttribute("aria-label", gameText("main.market.nextPage", "Next page"));
  next.addEventListener("click", () => {
    closeMarketListingDetails();
    marketPageState[tabName] = Math.min(page.totalPages, page.page + 1);
    scheduleMarketTabPageRender(tabName);
  });
  controls.append(previous, current, next);
  container.append(summary, controls);
}

function createMarketListingCard(listing, { order = false, tabName = "browse" } = {}) {
  const selected = marketDetailState.listing?.id === listing.id && marketDetailState.tabName === tabName;
  const card = document.createElement("article");
  card.className = "market-listing-card";
  card.classList.toggle("selected", selected);
  card.dataset.category = listing.category;
  card.dataset.listingId = listing.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-haspopup", "dialog");
  card.setAttribute("aria-expanded", String(selected));
  card.setAttribute("aria-label", gameText("main.market.cardAria", "{name}, {price} {currency}", {
    name: marketListingName(listing),
    price: listing.price,
    currency: listing.currency,
  }));
  card.addEventListener("click", () => openMarketListingDetails(listing, { order, tabName }));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMarketListingDetails(listing, { order, tabName });
  });
  const icon = document.createElement("div");
  icon.className = `market-listing-icon ${marketListingIconType(listing)}`;
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("div");
  copy.className = "market-listing-main";
  const title = document.createElement("strong");
  title.textContent = marketListingName(listing);
  const meta = document.createElement("span");
  meta.textContent = marketCategoryLabel(listing.category);
  copy.append(title, meta);
  const price = document.createElement("b");
  price.className = "market-listing-price";
  price.textContent = `${listing.price} ${listing.currency}`;
  const detailHint = document.createElement("small");
  detailHint.className = "market-listing-hint";
  detailHint.textContent = isOwnMarketListing(listing)
    ? gameText("main.market.ownListing", "Your listing")
    : gameText("main.market.expandDetails", "Details");
  card.append(icon, copy, price, detailHint);
  return card;
}

function openMarketListingDetails(listing, { order = false, tabName = "browse" } = {}) {
  if (!listing) return;
  marketDetailState = { listing, order, tabName };
  renderMarketListingDetailsDialog();
  renderMarketTabPage(tabName);
}

function closeMarketListingDetails() {
  marketDetailDialog?.remove();
  marketDetailDialog = null;
  marketDetailState = { listing: null, order: false, tabName: null };
}

function renderMarketListingDetailsDialog() {
  if (!marketPanel || !marketDetailState.listing) return;
  marketDetailDialog?.remove();
  const listing = marketDetailState.listing;
  const overlay = document.createElement("div");
  overlay.className = "market-detail-overlay";
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) {
      const tabName = marketDetailState.tabName || "browse";
      event.preventDefault();
      event.stopPropagation();
      closeMarketListingDetails();
      renderMarketTabPage(tabName);
    }
  });
  const dialog = document.createElement("section");
  dialog.className = "market-detail-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "false");
  dialog.setAttribute("aria-labelledby", "marketDetailTitle");
  dialog.addEventListener("pointerdown", (event) => event.stopPropagation());
  const header = document.createElement("header");
  header.className = "market-detail-header";
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.textContent = gameText("main.market.detailTitle", "Listing details");
  const title = document.createElement("h3");
  title.id = "marketDetailTitle";
  title.textContent = marketListingName(listing);
  titleWrap.append(eyebrow, title);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "market-detail-close";
  close.textContent = "×";
  close.setAttribute("aria-label", gameText("main.market.detailClose", "Close listing details"));
  close.addEventListener("click", () => {
    const tabName = marketDetailState.tabName || "browse";
    closeMarketListingDetails();
    renderMarketTabPage(tabName);
  });
  header.append(titleWrap, close);
  const summary = document.createElement("div");
  summary.className = "market-detail-summary";
  const icon = document.createElement("div");
  icon.className = `market-listing-icon ${marketListingIconType(listing)}`;
  icon.setAttribute("aria-hidden", "true");
  const summaryCopy = document.createElement("div");
  const meta = document.createElement("span");
  meta.textContent = marketCategoryLabel(listing.category);
  const itemMeta = document.createElement("strong");
  itemMeta.textContent = marketListingMeta(listing);
  summaryCopy.append(meta, itemMeta);
  const price = document.createElement("b");
  price.className = "market-listing-price";
  price.textContent = `${listing.price} ${listing.currency}`;
  summary.append(icon, summaryCopy, price);
  const details = document.createElement("div");
  details.className = "market-listing-details";
  details.append(
    createMarketListingDetailRow(gameText("main.market.detailItem", "Item"), marketListingMeta(listing)),
    createMarketListingDetailRow(gameText("main.market.detailSeller", "Seller"), formatWalletAddress(listing.seller)),
    createMarketListingDetailRow(gameText("main.market.detailSource", "Source"), marketSourceLabel(listing.source)),
    createMarketListingDetailRow(gameText("main.market.detailInventory", "Inventory"), marketListingInventoryLabel(listing)),
  );
  const paymentRequirement = marketPaymentRequirement(listing);
  if (paymentRequirement) {
    details.append(createMarketListingDetailRow(
      gameText("main.market.detailPayment", "Payment"),
      gameText(paymentRequirement.key, paymentRequirement.fallback),
    ));
  }
  const actionDisabledReason = marketDetailState.order || isOwnMarketListing(listing)
    ? marketCancelDisabledReason(listing)
    : marketBuyDisabledReason(listing);
  if (actionDisabledReason) {
    details.append(createMarketListingDetailRow(
      gameText("main.market.detailRequirement", "Requirement"),
      gameText(actionDisabledReason.key, actionDisabledReason.fallback),
    ));
  }
  details.append(createMarketListingActionButton(listing, marketDetailState.order));
  dialog.append(header, summary, details);
  overlay.append(dialog);
  marketPanel.append(overlay);
  marketDetailDialog = overlay;
  requestAnimationFrame(() => close.focus());
}

function createMarketListingActionButton(listing, order = false) {
  const ownListing = order || isOwnMarketListing(listing);
  const action = document.createElement("button");
  action.type = "button";
  action.textContent = ownListing ? gameText("main.market.cancelListing", "Cancel") : gameText("main.market.buy", "Buy");
  action.addEventListener("click", (event) => event.stopPropagation());
  if (ownListing) {
    const isCanceling = marketCancelingListingId === listing.id;
    const disabledReason = marketCancelDisabledReason(listing);
    action.disabled = isCanceling || Boolean(disabledReason);
    action.textContent = isCanceling
      ? gameText("main.market.cancelPending", "Canceling...")
      : gameText("main.market.cancelListing", "Cancel");
    if (disabledReason) {
      action.title = gameText(disabledReason.key, disabledReason.fallback);
    } else if (!isCanceling) {
      action.addEventListener("click", () => handleCancelMarketListing(listing, action));
    }
  } else if (listing.listing && listing.seller) {
    const isBuying = marketBuyingListingId === listing.id;
    const disabledReason = marketBuyDisabledReason(listing);
    action.disabled = isBuying || Boolean(disabledReason);
    action.textContent = isBuying
      ? gameText("main.market.buyPending", "Buying...")
      : gameText("main.market.buy", "Buy");
    if (disabledReason) {
      action.title = gameText(disabledReason.key, disabledReason.fallback);
    } else if (!isBuying) {
      action.addEventListener("click", () => handleBuyMarketListing(listing, action));
    }
  } else {
    action.disabled = true;
    action.title = gameText("main.market.sampleListing", "Sample listing");
  }
  return action;
}

function isOwnMarketListing(listing) {
  const wallet = currentSession.walletAddress;
  return Boolean(wallet && listing?.seller === wallet);
}

function marketPaymentRequirement(listing) {
  const currency = String(listing?.currency || "").toUpperCase();
  if (currency === "NCK") {
    return {
      key: "main.market.paymentNck",
      fallback: "Requires a wallet NCK token account.",
    };
  }
  if (currency === "SOL") {
    return {
      key: "main.market.paymentSol",
      fallback: "Pays from wallet SOL balance.",
    };
  }
  return null;
}

function marketBuyDisabledReason(listing) {
  if (!currentSession.walletAddress) {
    return {
      key: "main.market.buyNeedsWallet",
      fallback: "Connect a wallet to buy this listing.",
    };
  }
  if (listing?.source === "asset") {
    if (!listing.sourceSlot?.itemId) {
      return {
        key: "main.market.buyAssetUnavailable",
        fallback: "Asset metadata is unavailable.",
      };
    }
    if (findMarketAssetDeliveryHotbarIndex() < 0) {
      return {
        key: "main.market.buyNeedsHotbarSlot",
        fallback: "Free one hotbar slot to receive this item.",
      };
    }
    return null;
  }
  if (listing?.source !== "backpack") return null;
  const backpack = equippedBackpackStatus?.backpack ?? null;
  if (!backpack?.publicKey) {
    return {
      key: "main.market.buyNeedsBackpack",
      fallback: "Equip a backpack to buy this listing.",
    };
  }
  if (isBackpackStorageFull(backpack)) {
    return {
      key: "main.market.buyBackpackFull",
      fallback: "Your backpack is full.",
    };
  }
  return null;
}

function marketCancelDisabledReason(listing) {
  const source = listing?.sourceOrigin ?? listing?.source;
  if (source !== "backpack") return null;
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const listingBackpack = listing?.sourceInventory ?? listing?.backpack ?? null;
  if (!backpack?.publicKey || (listingBackpack && backpack.publicKey !== listingBackpack)) return null;
  if (!isBackpackStorageFull(backpack)) return null;
  return {
    key: "main.market.cancelNeedsBackpackSpace",
    fallback: "Free one backpack slot before canceling this listing.",
  };
}

function isBackpackStorageFull(backpack) {
  if (!backpack) return false;
  const capacity = backpack.capacity ?? backpackSlotTotal;
  const itemCount = Number.isFinite(Number(backpack.itemCount))
    ? Number(backpack.itemCount)
    : backpack.records?.length ?? 0;
  return itemCount >= capacity;
}

function findMarketAssetDeliveryHotbarIndex() {
  return hotbarSlots.findIndex((slot, index) => !slot && !isBackpackHotbarSlot(index));
}

function createMarketListingDetailRow(label, value) {
  const row = document.createElement("span");
  const labelEl = document.createElement("em");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value || gameText("main.market.detailUnknown", "Unknown");
  row.append(labelEl, valueEl);
  return row;
}

function marketListingInventoryLabel(listing) {
  if (listing.sourceRecord) {
    return `${listing.sourceRecord.worldX}, ${listing.sourceRecord.worldY}, ${listing.sourceRecord.worldZ}`;
  }
  return listing.sourceInventory ? formatWalletAddress(listing.sourceInventory) : gameText("main.market.detailUnknown", "Unknown");
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

function createMarketEmptyState(title, body, action = null, options = {}) {
  const empty = document.createElement("div");
  empty.className = "market-empty-state market-empty-state-guided";
  empty.dataset.emptyType = options.type ?? "idle";
  const icon = document.createElement("span");
  icon.className = `market-empty-icon ${options.iconClass ?? "is-market"}`;
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("div");
  copy.className = "market-empty-copy";
  const titleEl = document.createElement("strong");
  titleEl.textContent = title;
  const bodyEl = document.createElement("span");
  bodyEl.textContent = body;
  copy.append(titleEl, bodyEl);
  const hints = document.createElement("div");
  hints.className = "market-empty-hints";
  (options.hints ?? marketEmptyPreset("idle").hints).forEach(([key, fallback]) => {
    const chip = document.createElement("b");
    chip.textContent = gameText(key, fallback);
    hints.append(chip);
  });
  empty.append(icon, copy, hints);
  if (action?.label && typeof action.onClick === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    empty.append(button);
  }
  return empty;
}

function marketEmptyPreset(type) {
  const presets = {
    sync: {
      type: "sync",
      iconClass: "is-sync",
      hints: [
        ["main.market.emptyHintChain", "Chain sync"],
        ["main.market.emptyHintPda", "PDA scan"],
      ],
    },
    chain: {
      type: "chain",
      iconClass: "is-chain",
      hints: [
        ["main.market.emptyHintRetry", "Retry sync"],
        ["main.market.emptyHintRpc", "RPC status"],
      ],
    },
    search: {
      type: "search",
      iconClass: "is-search",
      hints: [
        ["main.market.emptyHintFilters", "Adjust filters"],
        ["main.market.emptyHintAll", "Show all"],
      ],
    },
    orders: {
      type: "orders",
      iconClass: "is-orders",
      hints: [
        ["main.market.emptyHintWallet", "Wallet orders"],
        ["main.market.emptyHintSettlement", "NCK / SOL"],
      ],
    },
    inventory: {
      type: "inventory",
      iconClass: "is-inventory",
      hints: [
        ["main.market.emptyHintBackpack", "Equip backpack"],
        ["main.market.emptyHintResources", "Mine resources"],
      ],
    },
    idle: {
      type: "idle",
      iconClass: "is-market",
      hints: [
        ["main.market.emptyHintMarket", "Market terminal"],
        ["main.market.emptyHintOnchain", "On-chain listings"],
      ],
    },
  };
  return presets[type] ?? presets.idle;
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
    setMarketFormLocalizedStatus("main.market.invalidListing", "Select an item and enter a valid price.", {}, "error");
    return;
  }
  marketListingSubmitting = true;
  setMarketFormLocalizedStatus("main.market.listingPending", "Confirm the transaction to create this listing on-chain.");
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
      backpackAddress: equippedBackpackStatus?.backpack?.publicKey ?? null,
    });
    if (!result?.submitted) {
      setMarketFormLocalizedStatus("main.market.listingFailed", "Listing transaction failed: {reason}", {
        reason: chainSubmitReasonLabel(result?.reason),
      }, "error");
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
	      source: result.sourceKind ?? marketSelectedListingItem.source,
	      sourceOrigin: marketSelectedListingItem.source,
	      sourceIndex: marketSelectedListingItem.slotIndex,
	      sourceItemId: marketSelectedListingItem.id,
	      sourceInventory: result.sourceInventory ?? marketSelectedListingItem.backpack ?? equippedBackpackStatus?.backpack?.publicKey ?? null,
	      backpack: marketSelectedListingItem.source === "backpack"
	        ? result.sourceInventory ?? marketSelectedListingItem.backpack ?? equippedBackpackStatus?.backpack?.publicKey ?? null
	        : null,
	      asset: result.asset ?? (result.sourceKind === "asset" ? result.sourceInventory : null),
	      assetId: result.assetId ?? null,
      sourceRecord: marketSelectedListingItem.slot?.record
        ? {
            worldX: marketSelectedListingItem.slot.record.worldX,
            worldY: marketSelectedListingItem.slot.record.worldY,
            worldZ: marketSelectedListingItem.slot.record.worldZ,
          }
        : null,
      sourceSlot: marketSelectedListingItem.source === "hotbar"
        ? {
            itemId: marketSelectedListingItem.slot?.itemId ?? null,
            count: marketSelectedListingItem.slot?.count ?? null,
            bytes: Array.isArray(marketSelectedListingItem.slot?.bytes) ? [...marketSelectedListingItem.slot.bytes] : null,
            byteLength: marketSelectedListingItem.slot?.byteLength ?? null,
            code: marketSelectedListingItem.slot?.code ?? null,
            durability: marketSelectedListingItem.slot?.durability ?? null,
            locked: Boolean(marketSelectedListingItem.slot?.locked),
            savedAt: marketSelectedListingItem.slot?.savedAt ?? null,
          }
        : null,
      createdAt: Date.now(),
    };
    saveMarketListings([listing, ...loadMarketListings()]);
    removeMarketListingSourceFromLocalInventory(listing);
    await refreshEquippedBackpack({ force: true });
    marketSelectedListingItem = null;
    if (marketListingPrice) marketListingPrice.value = "";
    setMarketFormLocalizedStatus("main.market.listingCreated", "Listing created on-chain: {signature}", {
      signature: shortSignature(result.signature),
    }, "success");
    marketChainListingsLoadedAt = 0;
    selectMarketTab("orders");
  } catch (error) {
    console.warn("Failed to create market listing", error);
    setMarketFormLocalizedStatus("main.market.listingFailed", "Listing transaction failed: {reason}", {
      reason: readableChainError(error),
    }, "error");
  } finally {
    marketListingSubmitting = false;
    updateMarketPanel();
  }
}

async function handleCancelMarketListing(listing, action) {
  if (!listing?.id || marketCancelingListingId) return;
  const disabledReason = marketCancelDisabledReason(listing);
  if (disabledReason) {
    setMarketLocalizedStatus(disabledReason.key, disabledReason.fallback, {}, "error");
    if (action) {
      action.disabled = true;
      action.title = gameText(disabledReason.key, disabledReason.fallback);
    }
    return;
  }
  marketCancelingListingId = listing.id;
  if (!listing.listing && !listing.listingId) {
    removeMarketListing(listing);
    restoreMarketListingSourceToLocalInventory(listing);
    closeMarketListingDetails();
    setMarketLocalizedStatus("main.market.cancelCreated", "Listing canceled.", {}, "success");
    updateMarketPanel();
    marketCancelingListingId = null;
    return;
  }
  action.disabled = true;
  action.textContent = gameText("main.market.cancelPending", "Canceling...");
  setMarketLocalizedStatus("main.market.cancelPending", "Canceling...");
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.cancelMarketListingOnChain({
      listing: listing.listing,
      listingId: listing.listingId,
      source: listing.source,
      sourceInventory: listing.sourceInventory ?? listing.backpack,
    });
    if (!result?.submitted) {
      setMarketLocalizedStatus("main.market.cancelFailed", "Cancel transaction failed: {reason}", {
        reason: chainSubmitReasonLabel(result?.reason),
      }, "error");
      action.disabled = false;
      action.textContent = gameText("main.market.cancelListing", "Cancel");
      return;
    }
    removeMarketListing(listing);
    restoreMarketListingSourceToLocalInventory(listing);
    await refreshEquippedBackpack({ force: true });
    closeMarketListingDetails();
    setMarketLocalizedStatus("main.market.cancelCreated", "Listing canceled.", {}, "success");
    updateMarketPanel();
  } catch (error) {
    console.warn("Failed to cancel market listing", error);
    setMarketLocalizedStatus("main.market.cancelFailed", "Cancel transaction failed: {reason}", {
      reason: readableChainError(error),
    }, "error");
    action.disabled = false;
    action.textContent = gameText("main.market.cancelListing", "Cancel");
  } finally {
    marketCancelingListingId = null;
    updateMarketPanel();
  }
}

async function handleBuyMarketListing(listing, action) {
  if (!listing?.id || marketBuyingListingId) return;
  const disabledReason = marketBuyDisabledReason(listing);
  if (disabledReason) {
    setMarketLocalizedStatus(disabledReason.key, disabledReason.fallback, {}, "error");
    if (action) {
      action.disabled = true;
      action.title = gameText(disabledReason.key, disabledReason.fallback);
    }
    return;
  }
  marketBuyingListingId = listing.id;
  action.disabled = true;
  action.textContent = gameText("main.market.buyPending", "Buying...");
  setMarketLocalizedStatus("main.market.buyPending", "Buying...");
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.buyMarketListingOnChain({
      listing,
      buyerBackpackAddress: equippedBackpackStatus?.backpack?.publicKey ?? null,
    });
    if (!result?.submitted) {
      setMarketLocalizedStatus("main.market.buyFailed", "Buy transaction failed: {reason}", {
        reason: chainSubmitReasonLabel(result?.reason),
      }, "error");
      action.disabled = false;
      action.textContent = gameText("main.market.buy", "Buy");
      return;
	    }
    removeMarketListing(listing);
    deliverMarketAssetToLocalInventory(listing);
    await refreshEquippedBackpack({ force: true });
    marketChainListingsLoadedAt = 0;
    await refreshMarketChainListings({ force: true });
    closeMarketListingDetails();
    setMarketLocalizedStatus("main.market.buyCreated", "Purchase confirmed on-chain: {signature}", {
      signature: shortSignature(result.signature),
    }, "success");
    updateMarketPanel();
  } catch (error) {
    console.warn("Failed to buy market listing", error);
    setMarketLocalizedStatus("main.market.buyFailed", "Buy transaction failed: {reason}", {
      reason: readableChainError(error),
    }, "error");
    action.disabled = false;
    action.textContent = gameText("main.market.buy", "Buy");
  } finally {
    marketBuyingListingId = null;
    updateMarketPanel();
  }
}

function removeMarketListingSourceFromLocalInventory(listing) {
  if (!listing) return;
  const origin = listing.sourceOrigin ?? listing.source;
  if (origin === "backpack") {
    removeBackpackRecordFromLocalState(listing);
    return;
  }
  if (origin === "hotbar" && Number.isInteger(listing.sourceIndex)) {
    hotbarSlots[listing.sourceIndex] = null;
    if (selectedHotbarSlot === listing.sourceIndex) selectFirstSelectableHotbarSlot();
    renderHotbar();
  }
}

function restoreMarketListingSourceToLocalInventory(listing) {
  if (!listing) return;
  const origin = listing.sourceOrigin ?? listing.source;
  if (origin === "backpack") {
    restoreBackpackRecordToLocalState(listing);
    return;
  }
  if (origin === "hotbar" && Number.isInteger(listing.sourceIndex) && listing.sourceSlot?.itemId) {
    const current = hotbarSlots[listing.sourceIndex];
    if (!current) {
      hotbarSlots[listing.sourceIndex] = { ...listing.sourceSlot };
      renderHotbar();
    }
  }
}

function deliverMarketAssetToLocalInventory(listing) {
  if (!listing || listing.source !== "asset" || !listing.sourceSlot?.itemId) return;
  const emptyIndex = findMarketAssetDeliveryHotbarIndex();
  if (emptyIndex < 0) return;
  hotbarSlots[emptyIndex] = { ...listing.sourceSlot };
  renderHotbar();
}

function removeBackpackRecordFromLocalState(listing) {
  const backpack = equippedBackpackStatus?.backpack;
  if (!backpack?.records?.length) return;
  const listingSourceIds = new Set(marketListingSourceItemIds(listing));
  const recordIndex = Number.isInteger(listing.sourceIndex)
    ? listing.sourceIndex
    : backpack.records.findIndex((record, index) => (
        listingSourceIds.has(marketBackpackSourceItemId(index, record, backpack.publicKey)) ||
        listingSourceIds.has(marketBackpackSourceItemId(index, record))
      ));
  if (recordIndex < 0 || recordIndex >= backpack.records.length) return;
  backpack.records.splice(recordIndex, 1);
  backpack.itemCount = Math.max(0, Number(backpack.itemCount ?? backpack.records.length + 1) - 1);
  reindexBackpackRecords(backpack);
  invalidateBackpackSlotCache();
  syncEquippedBackpackSlot();
  renderHotbar();
  if (backpackPanel && !backpackPanel.hidden) renderBackpackPanel();
}

function restoreBackpackRecordToLocalState(listing) {
  const backpack = equippedBackpackStatus?.backpack;
  const record = listing.sourceRecord;
  if (!backpack || !record) return;
  const capacity = backpack.capacity ?? backpackSlotTotal;
  if ((backpack.records?.length ?? 0) >= capacity) return;
  backpack.records = [
    ...(backpack.records ?? []),
    {
      index: backpack.records?.length ?? 0,
      worldX: record.worldX,
      worldY: record.worldY,
      worldZ: record.worldZ,
    },
  ];
  backpack.itemCount = Math.min(capacity, Number(backpack.itemCount ?? 0) + 1);
  reindexBackpackRecords(backpack);
  invalidateBackpackSlotCache();
  syncEquippedBackpackSlot();
  renderHotbar();
  if (backpackPanel && !backpackPanel.hidden) renderBackpackPanel();
}

function reindexBackpackRecords(backpack) {
  (backpack?.records ?? []).forEach((record, index) => {
    record.index = index;
  });
}

function invalidateBackpackSlotCache() {
  backpackSlotCache.signature = "";
  backpackSlotCache.slots = [];
  availableBackpackSlotCache.signature = "";
  availableBackpackSlotCache.slots = [];
}

function scheduleBackpackSlotWarmup(backpack) {
  if (!backpack) return;
  const warmup = () => {
    try {
      createAvailableBackpackSlotsFromChain(backpack);
    } catch (error) {
      console.warn("Failed to warm backpack slot cache", error);
    }
  };
  if (window.requestIdleCallback) {
    window.requestIdleCallback(warmup, { timeout: 1200 });
    return;
  }
  window.setTimeout(warmup, 0);
}

function collectMarketSelectableItems() {
  const items = [];
  const listedSourceIds = activeMarketListedSourceIds();
  const backpack = equippedBackpackStatus?.backpack ?? null;
  createAvailableBackpackSlotsFromChain(backpack).forEach((slot) => {
    if (!slot) return;
    const id = slot.sourceItemId;
    if (listedSourceIds.has(id) || listedSourceIds.has(slot.legacySourceItemId)) return;
    items.push({
      id,
      slotIndex: slot.chainIndex,
      source: "backpack",
      backpack: backpack?.publicKey ?? null,
      name: backpackSlotDisplayName(slot),
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
      quantity: Number.isFinite(slot.count) ? Math.max(1, slot.count) : 1,
      slot,
    });
  });
  return items;
}

function marketCategoryForBackpackSlot(slot) {
  const key = slot?.atlasKey || slot?.blockType || "";
  if (["oakLeaf", "oakLog", "leaf", "leaves", "log", "wood", "tree", "grassPlant", "bush"].includes(key)) return "raw";
  if (["stone", "deepStone", "coal", "sand", "sandstone", "gravel", "clay", "dirt", "mud", "dryDirt", "basalt", "ash"].includes(key)) return "building";
  return "raw";
}

function marketCategoryForHotbarItem(slot, item) {
  if (item.kind === "tool" || item.kind === "forged" || item.action === "mine") return "equipment";
  if (item.kind === "plant") return "raw";
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
    clothing: "main.market.categoryClothing",
  }[category] ?? "main.market.categoryAll";
  return t(key);
}

function marketSourceLabel(source) {
  if (source === "asset") return gameText("main.market.sourceAsset", "Asset");
  if (source === "hotbar") return gameText("main.market.sourceHotbar", "Hotbar");
  return gameText("main.market.sourceBackpack", "Backpack");
}

async function refreshMarketChainListings({ force = false } = {}) {
  if (marketChainListingsLoading) {
    marketChainListingsRefreshPending = true;
    return;
  }
  const now = performance.now();
  const filters = currentMarketChainListingFilters();
  const filterKey = marketChainListingFilterKey(filters);
  if (!force && filterKey === marketChainListingsFilterKey && now - marketChainListingsLoadedAt < 30000) return;
  marketChainListingsLoading = true;
  marketChainListingsError = null;
  updateMarketRefreshButton();
  updateMarketSearchMeta();
  renderVisibleMarketContent();
  try {
    const chainModule = await loadNicechunkChainModule();
    const listings = await chainModule.fetchMarketListingsOnChain({
      ...filters,
      sort: marketSelectedSort,
    });
    marketChainListings = Array.isArray(listings) ? listings : [];
    marketChainListingsFilterKey = filterKey;
    marketChainListingsLoadedAt = performance.now();
  } catch (error) {
    console.warn("Failed to load market listings", error);
    marketChainListingsError = error;
  } finally {
    marketChainListingsLoading = false;
    updateMarketRefreshButton();
    updateMarketSearchMeta();
    renderVisibleMarketContent();
    if (marketChainListingsRefreshPending) {
      marketChainListingsRefreshPending = false;
      void refreshMarketChainListings({ force: true });
    }
  }
}

function renderVisibleMarketContent() {
  if (!marketPanel || marketPanel.hidden) return;
  renderMarketListings();
  renderMarketOrders();
  renderMarketInventory();
}

function currentMarketChainListingFilters() {
  const activeTab = marketPanel?.dataset.activeMarketTab || "browse";
  const seller = activeTab === "orders" && currentSession.walletAddress
    ? currentSession.walletAddress
    : null;
  const needsAllListingsForSourceLocks = activeTab === "sell";
  return {
    state: "active",
    seller,
    category: needsAllListingsForSourceLocks
      ? "all"
      : marketCategories.includes(marketSelectedCategory) ? marketSelectedCategory : "all",
    currency: needsAllListingsForSourceLocks
      ? "all"
      : marketCurrencyOptions.includes(marketSelectedCurrency) ? marketSelectedCurrency : "all",
  };
}

function marketChainListingFilterKey(filters) {
  return [
    filters.state || "",
    filters.seller || "",
    filters.category || "all",
    filters.currency || "all",
  ].join(":");
}

function alignMarketChainListingCacheWithActiveFilters() {
  const filterKey = marketChainListingFilterKey(currentMarketChainListingFilters());
  if (filterKey === marketChainListingsFilterKey) return;
  marketChainListings = [];
  marketChainListingsLoadedAt = 0;
}

function marketNeedsChainSourceLockSync() {
  if (marketPanel?.dataset.activeMarketTab !== "sell") return false;
  const filterKey = marketChainListingFilterKey(currentMarketChainListingFilters());
  return filterKey !== marketChainListingsFilterKey || marketChainListingsLoadedAt <= 0;
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
  if (!wallet) return [];
  return loadMergedMarketListings().filter((listing) => {
    return listing.seller === wallet;
  });
}

function normalizeChainMarketListing(listing, localListing = null) {
  const source = listing.source || localListing?.source || "backpack";
  const sourceIndex = Number.isFinite(Number(listing.sourceIndex)) ? Number(listing.sourceIndex) : 0;
  const category = listing.category || localListing?.category || "raw";
  const assetSlot = source === "asset" ? createMarketSlotFromChainAsset(listing.asset) : null;
  const assetItem = assetSlot?.itemId ? hotbarItems[assetSlot.itemId] : null;
  const sourceRecord = listing.sourceRecord || localListing?.sourceRecord || null;
  const sourceInventory = listing.sourceInventory || localListing?.sourceInventory || localListing?.backpack || null;
  return {
    id: `chain-${listing.listing}`,
    seller: listing.seller,
    listing: listing.listing,
    listingId: listing.listingId,
    signature: localListing?.signature,
    programId: listing.programId || localListing?.programId,
    name: localListing?.name || (assetItem ? t(assetItem.labelKey) : gameText("main.market.chainListingName", "On-chain Listing")),
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
    sourceOrigin: localListing?.sourceOrigin ?? localListing?.source ?? source,
    sourceIndex,
    sourceItemId: localListing?.sourceItemId || marketListingSourceItemId({
      source,
      sourceIndex,
      sourceRecord,
      sourceInventory,
      sourceSlot: localListing?.sourceSlot,
    }),
    sourceInventory,
    sourceRecord,
    sourceSlot: localListing?.sourceSlot ?? assetSlot,
    backpack: source === "backpack" ? sourceInventory : null,
    asset: listing.asset || localListing?.asset || null,
    stateLabel: listing.stateLabel,
    buyer: listing.buyer,
    createdAt: Number(listing.createdAt || 0) * 1000 || localListing?.createdAt || Date.now(),
  };
}

function createMarketSlotFromChainAsset(asset) {
  if (!asset?.itemId) return null;
  const item = hotbarItems[asset.itemId] ?? null;
  if (!item) return null;
  if (item.kind === "system") return null;
  if (item.kind === "forged") {
    const bytes = Array.isArray(asset.payload) ? asset.payload.slice(0, asset.payloadLength ?? asset.payload.length) : [];
    if (!bytes.length) return null;
    return {
      itemId: asset.itemId,
      count: 1,
      bytes,
      byteLength: bytes.length,
      code: forgeBytesToCode(bytes),
      savedAt: Date.now(),
    };
  }
  if (item.kind === "tool" || item.action === "mine") {
    return {
      itemId: asset.itemId,
      durability: Math.max(1, Number(asset.durability || 0)),
    };
  }
  return {
    itemId: asset.itemId,
    count: Math.max(1, Number(asset.stackCount || asset.quantity || 1)),
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

function removeMarketListing(listingOrId) {
  const identity = marketListingIdentity(listingOrId);
  saveMarketListings(loadMarketListings().filter((listing) => !marketListingIdentityMatches(listing, identity)));
  marketChainListings = marketChainListings.filter((listing) => !marketListingIdentityMatches(listing, identity));
  marketChainListingsLoadedAt = 0;
}

function marketListingIdentity(listingOrId) {
  if (typeof listingOrId === "string") {
    return {
      id: listingOrId,
      listing: listingOrId.startsWith("chain-") ? listingOrId.slice(6) : "",
      listingId: "",
    };
  }
  return {
    id: listingOrId?.id ?? "",
    listing: listingOrId?.listing ?? "",
    listingId: listingOrId?.listingId != null ? String(listingOrId.listingId) : "",
  };
}

function marketListingIdentityMatches(listing, identity) {
  if (!listing || !identity) return false;
  const listingId = listing.id ?? "";
  const listingPda = listing.listing ?? "";
  const listingSequence = listing.listingId != null ? String(listing.listingId) : "";
  return Boolean(
    (identity.id && listingId === identity.id) ||
      (identity.listing && listingPda === identity.listing) ||
      (identity.listingId && listingSequence === identity.listingId) ||
      (identity.listing && listingId === `chain-${identity.listing}`) ||
      (identity.listingId && listingId === `chain-${identity.listingId}`),
  );
}

function formatMarketPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric >= 1 ? numeric.toFixed(2).replace(/\.?0+$/, "") : numeric.toFixed(6).replace(/\.?0+$/, "");
}

function renderBackpackPanel() {
  if (!backpackGrid || !backpackDetail) return;
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const slots = createAvailableBackpackSlotsFromChain(backpack);
  const capacity = backpack?.capacity ?? backpackSlotTotal;
  const filledSlots = slots.filter(Boolean);
  syncBackpackInteractionSlots(slots, capacity);
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

  const initialPreviewCount = backpackPreviewInitialRenderCount();
  syncBackpackGridSlots(slots, capacity, initialPreviewCount);
  const selectedSlot = backpackSelectedSourceItemId
    ? filledSlots.find((slot) => slot.sourceItemId === backpackSelectedSourceItemId) ?? null
    : null;
  renderBackpackDetail(selectedSlot ?? filledSlots[6] ?? filledSlots[0] ?? null);
}

function syncBackpackGridSlots(slots, capacity, initialPreviewCount) {
  const nextSignatures = Array.from({ length: capacity }, (_, index) => backpackPanelSlotSignature(slots[index], index));
  const capacityChanged = backpackGridRenderState.capacity !== capacity || backpackGrid.children.length !== capacity;
  const scrollTop = backpackGrid.scrollTop;
  if (capacityChanged) {
    backpackPreviewHydrationToken += 1;
    const renderToken = backpackPreviewHydrationToken;
    backpackGrid.replaceChildren(
      ...Array.from({ length: capacity }, (_, index) => createBackpackSlotElement(slots[index], index, {
        renderPreview: index < initialPreviewCount,
      })),
    );
    backpackGridRenderState.capacity = capacity;
    backpackGridRenderState.signatures = nextSignatures;
    scheduleBackpackPreviewHydration(slots, renderToken, initialPreviewCount);
    backpackGrid.scrollTop = scrollTop;
    return;
  }

  const changedIndexes = [];
  nextSignatures.forEach((signature, index) => {
    if (signature === backpackGridRenderState.signatures[index]) return;
    const previous = backpackGrid.children[index] ?? null;
    const next = createBackpackSlotElement(slots[index], index, { renderPreview: index < initialPreviewCount });
    if (previous) {
      previous.replaceWith(next);
    } else {
      backpackGrid.append(next);
    }
    changedIndexes.push(index);
  });

  backpackGridRenderState.signatures = nextSignatures;
  if (changedIndexes.length) {
    backpackPreviewHydrationToken += 1;
    const renderToken = backpackPreviewHydrationToken;
    scheduleBackpackPreviewHydration(slots, renderToken, initialPreviewCount);
  }
  backpackGrid.scrollTop = scrollTop;
}

function backpackPanelSlotSignature(slot, index) {
  if (!slot) return `${index}:empty`;
  return [
    index,
    slot.sourceItemId ?? "",
    slot.itemId ?? "",
    slot.blockType ?? "",
    slot.atlasKey ?? "",
    slot.chainIndex ?? "",
    slot.record?.worldX ?? "",
    slot.record?.worldY ?? "",
    slot.record?.worldZ ?? "",
    slot.meta?.name ?? "",
    slot.meta?.source ?? "",
    slot.volumeMm3 ?? "",
    slot.dimensionsM?.width ?? "",
    slot.dimensionsM?.height ?? "",
    slot.dimensionsM?.depth ?? "",
    Number.isFinite(slot.massKg) ? slot.massKg : "",
  ].join("|");
}

function backpackPreviewInitialRenderCount() {
  return isMobileViewport() ? backpackPreviewInitialCountMobile : backpackPreviewInitialCountDesktop;
}

function backpackPreviewHydrationBatchSize() {
  return isMobileViewport() ? backpackPreviewBatchSizeMobile : backpackPreviewBatchSizeDesktop;
}

function syncBackpackInteractionSlots(slots, capacity) {
  backpackDemoSlots.length = capacity;
  for (let index = 0; index < capacity; index += 1) {
    backpackDemoSlots[index] = slots[index] ?? null;
  }
}

function createBackpackSlotsFromChain(backpack) {
  const signature = backpackSlotsSignature(backpack);
  if (backpackSlotCache.signature === signature) return backpackSlotCache.slots;

  const capacity = backpack?.capacity ?? backpackSlotTotal;
  const slots = Array.from({ length: capacity }, () => null);
  const chainSlots = (backpack?.slots?.length ? backpack.slots : (backpack?.records ?? []).map((record) => ({
    kind: "block",
    quantity: 1,
    resource: record,
    index: record.index,
  }))).slice(0, capacity);
  chainSlots.forEach((chainSlot, index) => {
    if (chainSlot?.kind === "item") {
      const sourceRecord = chainSlot.resource ?? {};
      const materialId = smeltingMaterialIdForItemCode(chainSlot.itemCode);
      const material = materialId ? smeltingMaterialById(materialId) : null;
      const materialProperties = material
        ? deriveSmeltingMaterialProperties({
            material,
            itemCode: chainSlot.itemCode,
            itemId: chainSlot.itemId,
            sourceSeed: `${sourceRecord.worldX ?? 0}:${sourceRecord.worldY ?? 0}:${sourceRecord.worldZ ?? 0}`,
          })
        : null;
      const volumeMm3 = Number(chainSlot.volumeMm3) || 0;
      const densityKgM3 = materialDensityKgM3(materialProperties?.attributes);
      const massKg = materialMassKgFromVolume(volumeMm3, densityKgM3);
      slots[index] = {
        itemId: "backpack_item_ref",
        itemPda: chainSlot.itemPda,
        itemCode: chainSlot.itemCode,
        itemRefId: chainSlot.itemId,
        count: chainSlot.quantity ?? 1,
        volumeMm3,
        densityKgM3,
        massKg,
        dimensionsM: materialCubeDimensionsFromVolume(volumeMm3),
        chainIndex: chainSlot.index ?? index,
        sourceItemId: `backpack:${backpack.publicKey ?? ""}:item:${chainSlot.index ?? index}:${chainSlot.itemPda ?? ""}:${chainSlot.itemId ?? ""}`,
        meta: {
          name: materialId ? smeltingMaterialName(materialId) : gameText("main.backpack.itemRef", "Backpack Item"),
          source: materialProperties
            ? gameText("main.backpack.materialPropertyLine", "{grade} grade · Purity {purity}/100", {
                grade: smeltingGradeLabel(materialProperties.grade),
                purity: materialProperties.purity,
              })
            : chainSlot.itemPda ?? gameText("main.backpack.itemDirectory", "Item directory PDA"),
          elements: [
            gameText("main.backpack.quantityLine", "Quantity {count}", { count: chainSlot.quantity ?? 1 }),
            ...(Number.isFinite(massKg) ? [gameText("main.backpack.massLine", "Mass {mass}", { mass: formatMassKg(massKg) })] : []),
            ...(volumeMm3 > 0 ? [gameText("main.backpack.sizeLine", "Size {size}", { size: formatVolumeCubeSize(volumeMm3) })] : []),
            ...(volumeMm3 > 0 ? [gameText("main.backpack.volumeLine", "Volume {volume}", { volume: formatVolumeMm3(volumeMm3) })] : []),
            materialId
              ? gameText("main.backpack.materialIdLine", "Material {id}", { id: materialId })
              : gameText("main.backpack.itemIdLine", "Item ID {id}", { id: chainSlot.itemId ?? "0" }),
            ...(materialProperties
              ? smeltingTopAttributeEntries(materialProperties.attributes, 5).map(([key, value]) => smeltingAttributeLine(key, value))
              : []),
          ],
        },
        record: sourceRecord,
        slot: chainSlot,
        materialId,
        material,
        materialProperties,
      };
      return;
    }
    const record = chainSlot.resource ?? chainSlot;
    const blockType = blockTypeFromBackpackRecord(record);
    const atlasKey = blockAtlasKeyForRenderType(blockType);
    const atlas = getBlockAtlasEntry(atlasKey);
    const volumeMm3 = Number(chainSlot.volumeMm3) || 0;
    const densityKgM3 = atlas?.physical?.densityKgM3 ?? null;
    const massKg = volumeMm3 > 0
      ? materialMassKgFromVolume(volumeMm3, densityKgM3)
      : atlas?.physical?.massKg ?? null;
    const dimensionsM = volumeMm3 > 0
      ? materialCubeDimensionsFromVolume(volumeMm3)
      : atlas?.physical?.dimensionsM ?? null;
    const volumeM3 = volumeMm3 > 0 ? volumeMm3 * 1e-9 : atlas?.physical?.volumeM3;
    slots[index] = {
      itemId: "backpack_resource",
      blockType,
      atlasKey,
      massKg,
      dimensionsM,
      volumeMm3,
      chainIndex: record.index ?? index,
      sourceItemId: marketBackpackSourceItemId(record.index ?? index, record, backpack.publicKey),
      legacySourceItemId: marketBackpackSourceItemId(record.index ?? index, record),
      meta: {
        name: localizedBlockResourceName(atlasKey, atlas),
        source: `${record.worldX}, ${record.worldY}, ${record.worldZ}`,
        elements: [
          gameText("main.backpack.massLine", "Mass {mass}", { mass: formatMassKg(massKg) }),
          gameText("main.backpack.sizeLine", "Size {size}", { size: formatDimensionsM(dimensionsM) }),
          ...(Number.isFinite(volumeM3) ? [gameText("main.backpack.volumeLine", "Volume {volume}", { volume: formatVolumeM3(volumeM3) })] : []),
          ...(atlas?.composition ?? []).slice(0, 3).map(([symbol, range]) => `${symbol} ${range}`),
        ],
      },
      record,
      slot: chainSlot,
    };
  });
  backpackSlotCache.signature = signature;
  backpackSlotCache.slots = slots;
  return slots;
}

function createAvailableBackpackSlotsFromChain(backpack) {
  const slots = createBackpackSlotsFromChain(backpack);
  const signature = backpackSlotCache.signature;
  if (availableBackpackSlotCache.signature === signature) return availableBackpackSlotCache.slots;
  availableBackpackSlotCache.signature = signature;
  availableBackpackSlotCache.slots = slots;
  return slots;
}

function backpackFilledItemCount(backpack) {
  if (!backpack) return 0;
  const capacity = backpack.capacity ?? backpackSlotTotal;
  const count = Number(backpack.itemCount);
  if (Number.isFinite(count)) return Math.max(0, Math.min(capacity, count));
  return Math.max(0, Math.min(capacity, backpack.records?.length ?? 0));
}

function availableBackpackItemCount(backpack) {
  return backpackFilledItemCount(backpack);
}

function activeMarketListedSourceIds() {
  const signature = marketListedSourceStateSignature();
  if (marketListedSourceIdCache.signature === signature) return marketListedSourceIdCache.ids;
  const ids = new Set();
  [
    ...loadMarketListings(),
    ...marketChainListings.filter((listing) => listing?.stateLabel === "active"),
  ].forEach((listing) => {
    marketListingSourceItemIds(listing).forEach((id) => ids.add(id));
  });
  marketListedSourceIdCache.signature = signature;
  marketListedSourceIdCache.ids = ids;
  return ids;
}

function marketListedSourceStateSignature() {
  const localListings = localStorage.getItem(marketListingStorageKey) || "[]";
  const chainListings = marketChainListings
    .filter((listing) => listing?.stateLabel === "active")
    .map((listing) => [
      listing.id ?? "",
      listing.listing ?? "",
      listing.listingId ?? "",
      marketListingSourceItemIds(listing).join(","),
    ].join("/"))
    .join("|");
  return `${localListings}::${chainListings}`;
}

function marketListingSourceItemId(listing) {
  return marketListingSourceItemIds(listing)[0] ?? "";
}

function marketListingSourceItemIds(listing) {
  const ids = [];
  if (listing?.sourceItemId) ids.push(listing.sourceItemId);
  const source = listing?.sourceOrigin ?? listing?.source;
  const sourceIndex = Number(listing?.sourceIndex);
  if (source === "backpack" && listing?.sourceRecord && Number.isInteger(sourceIndex)) {
    const inventory = listing.sourceInventory ?? listing.backpack ?? null;
    if (inventory) ids.push(marketBackpackSourceItemId(sourceIndex, listing.sourceRecord, inventory));
    ids.push(marketBackpackSourceItemId(sourceIndex, listing.sourceRecord));
  }
  if (source === "hotbar" && listing?.sourceSlot?.itemId && Number.isInteger(sourceIndex)) {
    ids.push(`hotbar-${sourceIndex}-${listing.sourceSlot.itemId}`);
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

function marketBackpackSourceItemId(index, record, inventory = null) {
  const inventoryPart = inventory ? `${inventory}-` : "";
  return `backpack-${inventoryPart}${index}-${record?.worldX ?? 0}-${record?.worldY ?? 0}-${record?.worldZ ?? 0}`;
}

function backpackSlotsSignature(backpack) {
  const localeState = `${localStorage.getItem("nicechunk.language") ?? "en"}:${i18nReady ? "ready" : "loading"}`;
  if (!backpack) return `empty:${localeState}`;
  const records = (backpack.slots?.length ? backpack.slots : (backpack.records ?? []))
    .slice(0, backpack.capacity ?? backpackSlotTotal)
    .map((slot) => {
      const record = slot.resource ?? slot;
      return [
        slot.kind ?? "block",
        slot.quantity ?? 1,
        slot.itemCode ?? 0,
        slot.volumeMm3 ?? 0,
        record.worldX ?? 0,
        record.worldY ?? 0,
        record.worldZ ?? 0,
        slot.itemPda ?? "",
        slot.itemId ?? "",
      ].join(",");
    })
    .join("|");
  return [
    localeState,
    backpack.publicKey ?? "",
    backpack.capacity ?? backpackSlotTotal,
    backpack.itemCount ?? backpack.records?.length ?? 0,
    records,
  ].join(":");
}

function blockTypeFromBackpackRecord(record) {
  if (!record) return "stone";
  if (record.renderType) return record.renderType;
  const key = blockKey(record.worldX, record.worldY, record.worldZ);
  const placedType = placedBlocks.get(key);
  if (placedType) return placedType;
  const canonicalType = canonicalRenderTypeAt({ x: record.worldX, y: record.worldY, z: record.worldZ });
  if (canonicalType) return canonicalType;
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

function backpackSlotDisplayName(slot) {
  if (slot?.materialId) return smeltingMaterialName(slot.materialId);
  const atlasKey = slot?.atlasKey ?? (slot?.blockType ? blockAtlasKeyForRenderType(slot.blockType) : "");
  if (atlasKey) return localizedBlockResourceName(atlasKey, getBlockAtlasEntry(atlasKey));
  return slot?.meta?.name ?? gameText("main.backpack.coordinateResource", "Coordinate Resource");
}

function normalizedMinedLogBlock(block) {
  const canonicalType = canonicalRenderTypeAt({ x: block?.x, y: block?.y, z: block?.z });
  const type = canonicalType ?? block?.type ?? generatedBlockTypeAt(block?.x, block?.y, block?.z) ?? "stone";
  return { ...block, type };
}

function minedResourceNameForBlock(block) {
  const atlasKey = blockAtlasKeyForRenderType(block?.type ?? "stone");
  const atlas = getBlockAtlasEntry(atlasKey);
  return localizedBlockResourceName(atlasKey, atlas);
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

function formatVolumeCubeSize(volumeMm3) {
  return formatDimensionsM(materialCubeDimensionsFromVolume(volumeMm3));
}

function formatDimensionsM(dimensions) {
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  const depth = Number(dimensions?.depth);
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) {
    return gameText("main.backpack.unknownSize", "Unknown");
  }
  return `${formatLengthM(width)} x ${formatLengthM(height)} x ${formatLengthM(depth)}`;
}

function previewDimensionsForSlot(slot) {
  if (!slot) return null;
  const explicit = normalizedPreviewDimensions(slot.dimensionsM);
  if (explicit) return explicit;
  if (Number(slot.volumeMm3) > 0) return materialCubeDimensionsFromVolume(slot.volumeMm3);
  return null;
}

function normalizedPreviewDimensions(dimensions) {
  const width = Number(dimensions?.width);
  const height = Number(dimensions?.height);
  const depth = Number(dimensions?.depth);
  if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0)) return null;
  return { width, height, depth };
}

function formatLengthM(value) {
  if (!Number.isFinite(value) || value <= 0) return gameText("main.backpack.unknownSize", "Unknown");
  if (value >= 1) return `${Number(value.toFixed(2))} m`;
  if (value >= 0.01) return `${Number((value * 100).toFixed(1))} cm`;
  return `${Number((value * 1000).toFixed(1))} mm`;
}

function formatVolumeMm3(volumeMm3) {
  const volumeM3 = Number(volumeMm3) * 1e-9;
  return formatVolumeM3(volumeM3);
}

function formatSmeltingVolumeMm3(volumeMm3) {
  const volume = Number(volumeMm3);
  if (!Number.isFinite(volume)) return gameText("main.backpack.unknownSize", "Unknown");
  if (volume <= 0) return "0 cm3";
  return formatVolumeMm3(volume);
}

function formatVolumeM3(volumeM3) {
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0) return gameText("main.backpack.unknownSize", "Unknown");
  if (volumeM3 >= 1) return `${Math.round(volumeM3)} m3`;
  if (volumeM3 >= 0.001) return `${Math.round(volumeM3 * 1000)} L`;
  return `${Math.round(volumeM3 * 1_000_000)} cm3`;
}

function createBackpackSlotElement(slot, index, { renderPreview = true } = {}) {
  const button = document.createElement("button");
  button.className = "backpack-slot";
  button.type = "button";
  button.dataset.backpackSlot = String(index);
  button.dataset.sourceItemId = slot?.sourceItemId ?? "";
  button.setAttribute("aria-label", slot ? backpackItemLabel(slot) : t("main.backpack.emptySlot", { slot: index + 1 }));
  button.classList.toggle("selected-for-discard", backpackSelectedSlotIndexes.has(index));
  button.classList.toggle("discarding", backpackDiscardingSlotIndexes.has(index));
  button.disabled = backpackDiscardingSlotIndexes.has(index);

  if (!slot) {
    button.classList.add("empty");
    return button;
  }

  const item = hotbarItems[slot.itemId] ?? { kind: "empty", labelKey: "main.item.empty", iconClass: "" };
  button.classList.toggle("resource", item.kind === "resource");
  button.classList.toggle("forged", item.kind === "forged");
  button.append(renderPreview ? createBackpackItemIcon(item, slot) : createBackpackPreviewPlaceholder(slot));
  return button;
}

function createBackpackPreviewPlaceholder(slot) {
  const placeholder = document.createElement("span");
  placeholder.className = slot?.blockType
    ? "backpack-block-preview backpack-preview-pending"
    : "backpack-item-icon backpack-preview-pending";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function scheduleBackpackPreviewHydration(slots, renderToken, startIndex = 0) {
  if (!backpackGrid || !slots?.length) return;
  let cursor = Math.max(0, startIndex);
  const hydrateBatch = () => {
    if (renderToken !== backpackPreviewHydrationToken || !backpackGrid || backpackPanel?.hidden) return;
    let hydrated = 0;
    const batchSize = backpackPreviewHydrationBatchSize();
    while (cursor < slots.length && hydrated < batchSize) {
      hydrateBackpackSlotPreview(slots[cursor], cursor);
      cursor += 1;
      hydrated += 1;
    }
    if (cursor < slots.length) scheduleBackpackPreviewHydrationFrame(hydrateBatch);
  };
  scheduleBackpackPreviewHydrationFrame(hydrateBatch);
}

function scheduleBackpackPreviewHydrationForIndexes(slots, indexes, renderToken, initialPreviewCount) {
  const pendingIndexes = indexes.filter((index) => index >= initialPreviewCount && slots[index]);
  if (!pendingIndexes.length) return;
  let cursor = 0;
  const hydrateBatch = () => {
    if (renderToken !== backpackPreviewHydrationToken || !backpackGrid || backpackPanel?.hidden) return;
    let hydrated = 0;
    const batchSize = backpackPreviewHydrationBatchSize();
    while (cursor < pendingIndexes.length && hydrated < batchSize) {
      const index = pendingIndexes[cursor];
      hydrateBackpackSlotPreview(slots[index], index);
      cursor += 1;
      hydrated += 1;
    }
    if (cursor < pendingIndexes.length) scheduleBackpackPreviewHydrationFrame(hydrateBatch);
  };
  scheduleBackpackPreviewHydrationFrame(hydrateBatch);
}

function scheduleBackpackPreviewHydrationFrame(callback) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 180 });
    return;
  }
  window.requestAnimationFrame(callback);
}

function hydrateBackpackSlotPreview(slot, index) {
  if (!slot || !backpackGrid) return;
  const button = backpackGrid.querySelector(`.backpack-slot[data-backpack-slot="${index}"]`);
  const pending = button?.querySelector(".backpack-preview-pending");
  if (!button || !pending) return;
  const item = hotbarItems[slot.itemId] ?? { kind: "empty", labelKey: "main.item.empty", iconClass: "" };
  pending.replaceWith(createBackpackItemIcon(item, slot));
}

function createBackpackItemIcon(item, slot = null) {
  if (slot?.blockType) {
    return createChainEventBlockPreview(slot.blockType, {
      className: "backpack-block-preview",
      canvasClassName: "backpack-block-canvas",
      rotating: false,
      previewDimensionsM: previewDimensionsForSlot(slot),
    });
  }
  if (slot?.materialId) {
    const material = slot.material ?? smeltingMaterialById(slot.materialId);
    const wrap = document.createElement("span");
    wrap.className = "backpack-material-icon";
    const preview = createSmeltingMaterialPreview(material ?? fallbackBackpackItemMaterial(slot), {
      previewDimensionsM: previewDimensionsForSlot(slot),
    });
    preview.classList.add("backpack-material-preview");
    wrap.append(preview);
    return wrap;
  }
  if (slot?.itemCode != null || slot?.itemRefId != null || slot?.itemPda) {
    const wrap = document.createElement("span");
    wrap.className = "backpack-material-icon";
    const preview = createSmeltingMaterialPreview(fallbackBackpackItemMaterial(slot), {
      previewDimensionsM: previewDimensionsForSlot(slot),
    });
    preview.classList.add("backpack-material-preview");
    wrap.append(preview);
    return wrap;
  }
  const icon = document.createElement("span");
  icon.className = `backpack-item-icon ${item.iconClass ?? ""}`.trim();
  return icon;
}

function fallbackBackpackItemMaterial(slot = null) {
  const seed = `${slot?.itemCode ?? ""}:${slot?.itemRefId ?? ""}:${slot?.itemPda ?? ""}:${slot?.sourceItemId ?? ""}`;
  const hue = hashStringToHue(seed || "backpack-item");
  const color = hslToHex(hue, 62, 58);
  return {
    id: `backpack_item_${slot?.itemCode ?? "unknown"}`,
    class: "composite",
    color,
    composition: [],
  };
}

function hashStringToHue(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = hue < 60
    ? [c, x, 0]
    : hue < 120
      ? [x, c, 0]
      : hue < 180
        ? [0, c, x]
        : hue < 240
          ? [0, x, c]
          : hue < 300
            ? [x, 0, c]
            : [c, 0, x];
  const toHex = (channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function renderBackpackDetail(slot) {
  if (!backpackDetail) return;
  backpackSelectedSourceItemId = slot?.sourceItemId ?? "";
  if (!slot) {
    const empty = document.createElement("div");
    empty.className = "backpack-detail-empty";
    empty.innerHTML = `
      <span class="backpack-detail-empty-icon" aria-hidden="true"></span>
      <strong></strong>
      <p></p>
      <div class="backpack-detail-empty-hints"></div>
    `;
    empty.querySelector("strong").textContent = t("main.backpack.emptyDetailTitle");
    empty.querySelector("p").textContent = t("main.backpack.emptyDetail");
    const hints = empty.querySelector(".backpack-detail-empty-hints");
    [
      t("main.backpack.emptyHintSelect"),
      t("main.backpack.emptyHintInspect"),
      t("main.backpack.emptyHintSmelt"),
    ].forEach((label) => {
      const chip = document.createElement("b");
      chip.textContent = label;
      hints.append(chip);
    });
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
          previewDimensionsM: previewDimensionsForSlot(slot),
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
  copy.querySelector("strong").textContent = backpackSlotDisplayName(slot) || t(item.labelKey);
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
  return backpackSlotDisplayName(slot) || t(item.labelKey);
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
  if (event.button === 2) return;
  closeBackpackContextMenu();
  const slotIndex = backpackSlotIndexFromEvent(event);
  if (slotIndex === null || !backpackDemoSlots[slotIndex] || backpackDiscardingSlotIndexes.has(slotIndex)) return;
  event.preventDefault();
  event.stopPropagation();
  if (backpackSelectionMode) {
    const initiallySelected = backpackSelectedSlotIndexes.has(slotIndex);
    if (!initiallySelected) selectBackpackSlotForDrag(slotIndex);
    backpackSelectionDrag = {
      pointerId: event.pointerId,
      initiallySelected,
      startSlotIndex: slotIndex,
      lastSlotIndex: slotIndex,
      x: event.clientX,
      y: event.clientY,
      active: false,
    };
    backpackGrid?.classList.add("selection-dragging");
    event.target.closest(".backpack-slot")?.setPointerCapture?.(event.pointerId);
    renderBackpackDetail(backpackDemoSlots[slotIndex]);
    return;
  }
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

function handleBackpackDetailEvent(event) {
  const slotIndex = backpackSlotIndexFromEvent(event);
  if (slotIndex === null) return;
  const slot = backpackDemoSlots[slotIndex] ?? null;
  if (slot) renderBackpackDetail(slot);
}

function handleBackpackContextMenu(event) {
  const slotIndex = backpackSlotIndexFromEvent(event);
  if (slotIndex === null) return;
  const slot = backpackDemoSlots[slotIndex] ?? null;
  if (!slot || backpackDiscardingBatch || backpackDiscardingSlotIndexes.has(slotIndex)) return;
  event.preventDefault();
  event.stopPropagation();
  renderBackpackDetail(slot);
  if (backpackSelectionMode && !backpackSelectedSlotIndexes.size) {
    backpackSelectedSlotIndexes.add(slotIndex);
    updateBackpackSlotSelectionClasses();
  }
  openBackpackContextMenu(slotIndex, event.clientX, event.clientY);
}

function openBackpackContextMenu(slotIndex, x, y) {
  const menu = ensureBackpackContextMenu();
  menu.dataset.backpackSlot = String(slotIndex);
  const selectedCount = backpackSelectedSlotIndexes.size;
  const activeBatchCount = backpackSelectionMode ? selectedCount : 0;
  const item = backpackDemoSlots[slotIndex] ?? null;
  const title = menu.querySelector("strong");
  const select = menu.querySelector("button[data-backpack-action='select']");
  const discard = menu.querySelector("button[data-backpack-action='discard']");
  const cancel = menu.querySelector("button[data-backpack-action='cancel-selection']");
  if (title) {
    title.textContent = backpackSelectionMode
      ? gameText("main.backpack.selectedCount", "{count} selected", { count: selectedCount })
      : backpackSlotDisplayName(item);
  }
  if (select) {
    select.hidden = backpackSelectionMode;
    select.textContent = gameText("main.backpack.multiSelect", "Multi Select");
    select.disabled = false;
  }
  if (discard) {
    discard.textContent = backpackSelectionMode
      ? gameText("main.backpack.discardSelected", "Discard Selected")
      : gameText("main.backpack.discard", "Discard");
    discard.disabled = backpackSelectionMode ? activeBatchCount <= 0 : false;
  }
  if (cancel) {
    cancel.hidden = !backpackSelectionMode;
    cancel.textContent = gameText("main.backpack.cancelSelection", "Cancel Selection");
    cancel.disabled = false;
  }
  menu.hidden = false;
  const width = menu.offsetWidth || 180;
  const height = menu.offsetHeight || 92;
  menu.style.left = `${Math.min(Math.max(8, x), window.innerWidth - width - 8)}px`;
  menu.style.top = `${Math.min(Math.max(8, y), window.innerHeight - height - 8)}px`;
}

function ensureBackpackContextMenu() {
  if (backpackContextMenu) return backpackContextMenu;
  const menu = document.createElement("div");
  menu.className = "backpack-context-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <strong></strong>
    <button type="button" data-backpack-action="select"></button>
    <button type="button" data-backpack-action="discard"></button>
    <button type="button" data-backpack-action="cancel-selection"></button>
  `;
  menu.addEventListener("pointerdown", (event) => event.stopPropagation());
  menu.addEventListener("contextmenu", (event) => event.preventDefault());
  menu.querySelector("button[data-backpack-action='select']")?.addEventListener("click", handleBackpackSelectClick);
  menu.querySelector("button[data-backpack-action='discard']")?.addEventListener("click", handleBackpackDiscardClick);
  menu.querySelector("button[data-backpack-action='cancel-selection']")?.addEventListener("click", handleBackpackCancelSelectionClick);
  document.body.append(menu);
  backpackContextMenu = menu;
  return menu;
}

function closeBackpackContextMenu() {
  if (!backpackContextMenu) return;
  backpackContextMenu.hidden = true;
  backpackContextMenu.dataset.backpackSlot = "";
}

function handleBackpackSelectClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const slotIndex = Number(backpackContextMenu?.dataset.backpackSlot);
  closeBackpackContextMenu();
  startBackpackSelection(slotIndex);
}

async function handleBackpackDiscardClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const slotIndex = Number(backpackContextMenu?.dataset.backpackSlot);
  if (backpackSelectionMode) {
    await discardSelectedBackpackSlots();
    return;
  }
  if (Number.isInteger(slotIndex)) await discardBackpackSlot(slotIndex);
}

function handleBackpackCancelSelectionClick(event) {
  event.preventDefault();
  event.stopPropagation();
  cancelBackpackSelection();
}

function startBackpackSelection(slotIndex) {
  backpackSelectionMode = true;
  backpackSelectedSlotIndexes.clear();
  if (Number.isInteger(slotIndex) && backpackDemoSlots[slotIndex]) {
    backpackSelectedSlotIndexes.add(slotIndex);
  }
  updateBackpackSlotSelectionClasses();
}

function cancelBackpackSelection() {
  closeBackpackContextMenu();
  clearBackpackSelectionDragState();
  backpackSelectionMode = false;
  backpackSelectedSlotIndexes.clear();
  updateBackpackSlotSelectionClasses();
}

function toggleBackpackSlotSelection(slotIndex, { keepSelectionMode = false } = {}) {
  if (!backpackDemoSlots[slotIndex] || backpackDiscardingSlotIndexes.has(slotIndex)) return;
  if (backpackSelectedSlotIndexes.has(slotIndex)) {
    backpackSelectedSlotIndexes.delete(slotIndex);
  } else {
    backpackSelectedSlotIndexes.add(slotIndex);
  }
  if (!backpackSelectedSlotIndexes.size && !keepSelectionMode) backpackSelectionMode = false;
  updateBackpackSlotSelectionClasses();
}

function selectBackpackSlotForDrag(slotIndex) {
  if (!backpackDemoSlots[slotIndex] || backpackDiscardingSlotIndexes.has(slotIndex)) return false;
  if (backpackSelectedSlotIndexes.has(slotIndex)) return false;
  backpackSelectedSlotIndexes.add(slotIndex);
  updateBackpackSlotSelectionClasses();
  return true;
}

function updateBackpackSlotSelectionClasses() {
  backpackGrid?.querySelectorAll(".backpack-slot").forEach((slot, index) => {
    slot.classList.toggle("selected-for-discard", backpackSelectedSlotIndexes.has(index));
  });
}

async function discardBackpackSlot(slotIndex) {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const slot = backpackDemoSlots[slotIndex] ?? null;
  if (!backpack?.publicKey || !slot || backpackDiscardingBatch || backpackDiscardingSlotIndexes.has(slotIndex)) return;
  const chainIndex = Number.isInteger(slot.chainIndex) ? slot.chainIndex : slotIndex;
  closeBackpackContextMenu();
  setBackpackSlotsDiscardState([slotIndex], true);
  const block = previewBlockFromSlot(slot);
  let logEntry = appendChainEventLog(
    "info",
    gameText("main.backpack.discardPending", "Discard submitted"),
    gameText("main.backpack.discardPendingDetail", "Removing {item} from backpack", {
      item: backpackSlotDisplayName(slot),
    }),
    { block },
  );
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.discardBackpackResourceAt({
      backpackAddress: backpack.publicKey,
      index: chainIndex,
    });
    if (!result?.submitted) {
      logEntry = updateChainEventLog(logEntry, "warn", gameText("main.backpack.discardSkipped", "Discard skipped"), chainSubmitReasonLabel(result?.reason));
      scheduleChainEventLogRemoval(logEntry);
      return;
    }
    logEntry = updateChainEventLog(logEntry, "success", gameText("main.backpack.discardSubmitted", "Resource discarded"), shortSignature(result.signature));
    scheduleChainEventLogRemoval(logEntry, chainEventSuccessRemovalMs);
    animateBackpackSlotsDiscarded([slotIndex]);
    await refreshEquippedBackpack({ force: true });
  } catch (error) {
    console.warn("Failed to discard backpack resource", error);
    logEntry = updateChainEventLog(logEntry, "error", gameText("main.backpack.discardFailed", "Discard failed"), readableChainError(error));
    scheduleChainEventLogRemoval(logEntry);
  } finally {
    setBackpackSlotsDiscardState([slotIndex], false);
  }
}

async function discardSelectedBackpackSlots() {
  const backpack = equippedBackpackStatus?.backpack ?? null;
  const slotIndexes = Array.from(backpackSelectedSlotIndexes)
    .filter((index) => backpackDemoSlots[index] && !backpackDiscardingSlotIndexes.has(index))
    .sort((a, b) => a - b);
  if (!backpack?.publicKey || !slotIndexes.length || backpackDiscardingBatch) return;
  const chainIndexes = slotIndexes
    .map((index) => backpackDemoSlots[index]?.chainIndex ?? index)
    .filter((index) => Number.isInteger(index));
  if (!chainIndexes.length) return;
  closeBackpackContextMenu();
  backpackDiscardingBatch = true;
  setBackpackSlotsDiscardState(slotIndexes, true);
  const firstSlot = backpackDemoSlots[slotIndexes[0]];
  let logEntry = appendChainEventLog(
    "info",
    gameText("main.backpack.discardBatchPending", "Batch discard submitted"),
    gameText("main.backpack.discardBatchPendingDetail", "Removing {count} resources from backpack", {
      count: slotIndexes.length,
    }),
    { block: previewBlockFromSlot(firstSlot) },
  );
  try {
    const chainModule = await loadNicechunkChainModule();
    const result = await chainModule.discardBackpackResourcesAt({
      backpackAddress: backpack.publicKey,
      indexes: chainIndexes,
    });
    if (!result?.submitted) {
      logEntry = updateChainEventLog(logEntry, "warn", gameText("main.backpack.discardSkipped", "Discard skipped"), chainSubmitReasonLabel(result?.reason));
      scheduleChainEventLogRemoval(logEntry);
      return;
    }
    logEntry = updateChainEventLog(logEntry, "success", gameText("main.backpack.discardBatchSubmitted", "Resources discarded"), gameText("main.backpack.discardBatchSignature", "{count} items: {signature}", {
      count: slotIndexes.length,
      signature: shortSignature(result.signature),
    }));
    scheduleChainEventLogRemoval(logEntry, chainEventSuccessRemovalMs);
    animateBackpackSlotsDiscarded(slotIndexes);
    backpackSelectionMode = false;
    backpackSelectedSlotIndexes.clear();
    await refreshEquippedBackpack({ force: true });
  } catch (error) {
    console.warn("Failed to discard backpack resources", error);
    logEntry = updateChainEventLog(logEntry, "error", gameText("main.backpack.discardFailed", "Discard failed"), readableChainError(error));
    scheduleChainEventLogRemoval(logEntry);
  } finally {
    backpackDiscardingBatch = false;
    setBackpackSlotsDiscardState(slotIndexes, false);
    updateBackpackSlotSelectionClasses();
  }
}

function setBackpackSlotsDiscardState(slotIndexes, discarding) {
  slotIndexes.forEach((slotIndex) => {
    if (discarding) {
      backpackDiscardingSlotIndexes.add(slotIndex);
    } else {
      backpackDiscardingSlotIndexes.delete(slotIndex);
    }
    const button = backpackGrid?.querySelector(`.backpack-slot[data-backpack-slot="${slotIndex}"]`);
    if (!button) return;
    button.classList.toggle("discarding", discarding);
    button.disabled = discarding;
  });
}

function animateBackpackSlotsDiscarded(slotIndexes) {
  const targetRect = chainEventLog?.getBoundingClientRect();
  slotIndexes.forEach((slotIndex, order) => {
    const slot = backpackDemoSlots[slotIndex];
    const source = backpackGrid?.querySelector(`.backpack-slot[data-backpack-slot="${slotIndex}"]`);
    if (!slot || !source) return;
    const from = source.getBoundingClientRect();
    if (!from.width) return;
    const preview = createChainEventBlockPreview(slot.blockType ?? "stone", {
      className: "backpack-discard-fly-preview",
      canvasClassName: "backpack-discard-fly-canvas",
      rotating: false,
      block: previewBlockFromSlot(slot),
      immediate: true,
    });
    const toX = targetRect ? targetRect.left + targetRect.width - 28 : window.innerWidth - 36;
    const toY = targetRect ? targetRect.top + 26 : window.innerHeight - 120;
    preview.style.left = `${from.left + from.width / 2 - 22}px`;
    preview.style.top = `${from.top + from.height / 2 - 22}px`;
    preview.style.setProperty("--discard-fly-x", `${toX - (from.left + from.width / 2)}px`);
    preview.style.setProperty("--discard-fly-y", `${toY - (from.top + from.height / 2)}px`);
    preview.style.animationDelay = `${Math.min(order * 42, 260)}ms`;
    document.body.append(preview);
    preview.addEventListener("animationend", (event) => {
      if (event.target !== preview) return;
      preview.__nicechunkCleanup?.();
      preview.remove();
    }, { once: true });
  });
}

function handleBackpackPointerMove(event) {
  if (backpackSelectionDrag && event.pointerId === backpackSelectionDrag.pointerId) {
    event.preventDefault();
    event.stopPropagation();
    const moved = Math.hypot(event.clientX - backpackSelectionDrag.x, event.clientY - backpackSelectionDrag.y);
    if (moved > 6) backpackSelectionDrag.active = true;
    if (!backpackSelectionDrag.active) return;
    const slotIndex = backpackSlotIndexFromPoint(event.clientX, event.clientY);
    if (slotIndex === null || slotIndex === backpackSelectionDrag.lastSlotIndex) return;
    backpackSelectionDrag.lastSlotIndex = slotIndex;
    if (selectBackpackSlotForDrag(slotIndex)) renderBackpackDetail(backpackDemoSlots[slotIndex]);
    return;
  }
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
  if (backpackSelectionDrag && event.pointerId === backpackSelectionDrag.pointerId) {
    event.preventDefault();
    event.stopPropagation();
    if (!backpackSelectionDrag.active && backpackSelectionDrag.initiallySelected) {
      toggleBackpackSlotSelection(backpackSelectionDrag.startSlotIndex);
    }
    clearBackpackSelectionDragState();
    return;
  }
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
    renderBackpackPanel();
    renderBackpackDetail(backpackDemoSlots[from]);
  }
}

function handleBackpackPointerCancel(event) {
  if (backpackSelectionDrag && event.pointerId === backpackSelectionDrag.pointerId) {
    event.stopPropagation();
    clearBackpackSelectionDragState();
    return;
  }
  if (!backpackDrag || event.pointerId !== backpackDrag.pointerId) return;
  event.stopPropagation();
  clearBackpackDragState();
}

function clearBackpackSelectionDragState() {
  backpackSelectionDrag = null;
  backpackGrid?.classList.remove("selection-dragging");
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
  consumeToolDurabilityAtSlot(selectedHotbarSlot, amount);
}

function consumeToolDurabilityAtSlot(slotIndex, amount = 1) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= hotbarSlots.length) return;
  const slot = hotbarSlots[slotIndex];
  if (!slot || !Number.isFinite(slot.durability)) return;
  slot.durability = Math.max(0, slot.durability - amount);
  if (slot.durability <= 0) hotbarSlots[slotIndex] = null;
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
  beginWorldQueryFrame();
  const dt = Math.min(clock.getDelta(), 0.04);
  updateProceduralMaterialTime(materials, clock.elapsedTime);
  updateFps();
  updatePlayer(dt);
  updateAvatar(dt);
  updateGuardianNetworking();
  updateGuardianRemotePlayers(dt);
  updateAvatarNameTags();
  updateChatBubbles();
  updateMiningToolCollision();
  updateBreakParticles(dt);
  updateFallingTreeResourceBlocks(dt);
  updateCrackMarker();
  updateMiningDebug();
  generateAround(player.position);
  updateChunkChainViewportSync();
  buildPendingChunks();
  processPendingChunkCommits();
  processPlaceholderMaintenance();
  restoreKnownChunksBudgeted();
  generateCloudsAround(player.position);
  updateCamera(dt);
  if (firstPersonCamera && isPlacementAction(heldItem())) updatePlacementPreviewFromCenter();
  updateHud();
  updateMinimap();
  updateGuardianSceneFog();
  savePlayerPosition();
  renderer.render(scene, camera);
  updateDebugRenderInfo();
  renderProfilePreview();
  if (!firstGameFrameRendered) firstGameFrameRendered = true;
  updateStartupChunkLoadingProgress();
}

function updatePlayer(dt) {
  player.moving = false;
  if (resolvePlayerOverlap()) player.moving = false;
  const groundAtStart = playerGroundHeightAt(player.position.x, player.position.z, player.position.y, { allowStepUp: true });
  const canUseGroundControl =
    player.grounded ||
    (Number.isFinite(groundAtStart) && player.position.y <= groundAtStart + 0.04 && player.velocity.y <= 0);
  const input = playerMoveInput();
  const inputLengthSq = input.lengthSq();
  if (inputLengthSq > 0 && player.autoMoveTarget) clearAutoMove();
  let requestedTakeoffDirection = null;
  let requestedTakeoffSpeed = 0;

  if (canUseGroundControl) {
    if (inputLengthSq > 0) {
      const inputStrength = Math.min(1, input.length());
      input.normalize();
      const speed = currentMoveSpeed() * inputStrength;
      const forward = playerMoveForwardVector.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const right = playerMoveRightVector.set(forward.z, 0, -forward.x);
      const movement = playerMoveDirectionVector
        .copy(right)
        .multiplyScalar(input.x)
        .addScaledVector(forward, input.z)
        .normalize();
      requestedTakeoffDirection = movement;
      requestedTakeoffSpeed = speed;
      const stepped = tryMoveHorizontal(movement, speed * dt, { allowStepUp: true });
      const jumped = stepped ? false : tryManualJumpOverObstacle(movement, speed);
      player.moving = stepped || jumped;
      setHorizontalVelocity(movement, player.moving ? speed : 0);
      faceDirection(movement);
    } else if (player.autoMoveTarget) {
      const toTarget = playerAutoMoveVector.set(
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

  const groundBeforeFall = playerGroundHeightAt(player.position.x, player.position.z, player.position.y, { allowStepUp: true });
  const canJump = player.grounded || (Number.isFinite(groundBeforeFall) && player.position.y <= groundBeforeFall + 0.04 && player.velocity.y <= 0);
  if (keys.has("Space") && canJump) {
    if (requestedTakeoffDirection) setHorizontalVelocity(requestedTakeoffDirection, requestedTakeoffSpeed);
    player.velocity.y = jumpImpulse;
    player.grounded = false;
  }

  const previousY = player.position.y;
  player.velocity.y -= gravity * dt;
  player.position.y += player.velocity.y * dt;

  const ground = playerLandingGroundHeightAt(player.position.x, player.position.z, previousY, player.position.y);
  if (player.position.y <= ground && player.velocity.y <= 0) {
    player.position.y = ground;
    player.velocity.y = 0;
    player.grounded = true;
    clearHorizontalVelocity();
  } else {
    player.grounded = false;
  }
  if (!player.grounded && player.position.y < minBuildY - playerFallRecoveryDepth) {
    recoverPlayerToSafeStand("post-fall-depth");
  }

  if (player.moving) markMovementInteraction();
}

function markMovementInteraction() {
  lastMovementInteractionAt = performance.now();
}

function isMovementChainQuietActive() {
  return player.moving || performance.now() - lastMovementInteractionAt < movementChainQuietWindowMs;
}

function playerMoveInput() {
  if (mobileJoystickState.active && isMobileViewport()) {
    return playerInputVector.set(mobileJoystickState.x, 0, mobileJoystickState.y);
  }
  return playerInputVector.set(
    axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft"),
    0,
    axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp"),
  );
}

function isManualMovementKey(code) {
  return code === "KeyW"
    || code === "KeyA"
    || code === "KeyS"
    || code === "KeyD"
    || code === "ArrowUp"
    || code === "ArrowLeft"
    || code === "ArrowDown"
    || code === "ArrowRight"
    || code === "Space";
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

function tryManualJumpOverObstacle(direction, takeoffSpeed) {
  if (!direction || takeoffSpeed <= 0) return false;
  const now = performance.now();
  const currentGround = surfaceHeight(player.position.x, player.position.z) + 1.01;
  const canJump = now >= player.autoJumpReadyAt && (player.grounded || Math.abs(player.position.y - currentGround) < 0.12);
  if (!canJump) return false;
  const obstacle = findManualJumpObstacle(direction, currentGround);
  if (!obstacle) return false;
  setHorizontalVelocity(direction, takeoffSpeed);
  player.velocity.y = Math.max(player.velocity.y, jumpImpulse * 0.92);
  player.grounded = false;
  player.autoJumpReadyAt = now + autoJumpRetryMs;
  return true;
}

function findManualJumpObstacle(direction, currentGround) {
  const perpendicularX = direction.z;
  const perpendicularZ = -direction.x;
  const probeDistances = [0.58, 0.86, 1.16];
  const sideOffsets = [0, playerRadius * 0.72, -playerRadius * 0.72];
  let bestGround = -Infinity;

  for (const distance of probeDistances) {
    for (const sideOffset of sideOffsets) {
      const x = player.position.x + direction.x * distance + perpendicularX * sideOffset;
      const z = player.position.z + direction.z * distance + perpendicularZ * sideOffset;
      const candidateGround = jumpCandidateGroundAt(x, z, currentGround);
      if (candidateGround > bestGround) bestGround = candidateGround;
    }
  }

  const jumpDelta = bestGround - currentGround;
  if (jumpDelta <= stepBlockEpsilon || jumpDelta > autoJumpHeight) return null;
  return { ground: bestGround, delta: jumpDelta };
}

function jumpCandidateGroundAt(x, z, currentGround) {
  const bx = Math.round(x);
  const bz = Math.round(z);
  const minY = Math.max(1, Math.floor(currentGround - 1.01));
  const maxY = Math.ceil(currentGround + autoJumpHeight);
  let bestGround = surfaceHeight(x, z) + 1.01;

  for (let y = minY; y <= maxY; y++) {
    if (!isSolidCell(bx, y, bz)) continue;
    const candidateGround = y + 1.01;
    if (candidateGround <= bestGround) continue;
    if (playerBodyCollides(x, z, candidateGround)) continue;
    bestGround = candidateGround;
  }

  return bestGround;
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
  const currentGround = playerGroundHeightAt(player.position.x, player.position.z, player.position.y, { allowStepUp: true });
  const nextGround = playerGroundHeightAt(x, z, player.position.y, { allowStepUp: options.allowStepUp });
  const groundDelta = Number.isFinite(currentGround) && Number.isFinite(nextGround) ? nextGround - currentGround : -Infinity;
  const nearGround = player.grounded || (Number.isFinite(currentGround) && Math.abs(player.position.y - currentGround) < 0.12);
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
  return recoverPlayerCollisionState({ reason: "frame" });
}

function recoverPlayerAfterSolidMutation(blocks) {
  const normalized = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!normalized.length) return false;
  if (!restoredBlocksTouchPlayerRecoveryArea(normalized)) return false;
  return recoverPlayerCollisionState({ reason: "solid-mutation", forceGroundSnap: true, allowNearbySearch: true });
}

function restoredBlocksTouchPlayerRecoveryArea(blocks) {
  const minX = player.position.x - playerRadius - 0.08;
  const maxX = player.position.x + playerRadius + 0.08;
  const minZ = player.position.z - playerRadius - 0.08;
  const maxZ = player.position.z + playerRadius + 0.08;
  const minY = Math.floor(player.position.y - 1.35);
  const maxY = Math.floor(player.position.y + playerBodyTopOffset + 0.35);
  return blocks.some((block) => {
    if (!block) return false;
    return (
      block.x + 0.5 >= minX &&
      block.x - 0.5 <= maxX &&
      block.z + 0.5 >= minZ &&
      block.z - 0.5 <= maxZ &&
      block.y >= minY &&
      block.y <= maxY
    );
  });
}

function recoverPlayerCollisionState({ forceGroundSnap = false, allowNearbySearch = false } = {}) {
  if (recoverInvalidPlayerState()) return true;
  if (player.position.y < minBuildY - playerFallRecoveryDepth) {
    return recoverPlayerToSafeStand("fall-depth");
  }

  let changed = false;
  if (playerBodyCollides(player.position.x, player.position.z, player.position.y)) {
    changed = resolvePlayerVerticalOverlap() || changed;
    if (playerBodyCollides(player.position.x, player.position.z, player.position.y)) {
      changed = resolvePlayerHorizontalOverlap() || changed;
    }
    if (allowNearbySearch && playerBodyCollides(player.position.x, player.position.z, player.position.y)) {
      changed = recoverPlayerToSafeStand("overlap-search") || changed;
    }
  }

  if (forceGroundSnap) {
    changed = snapPlayerToRestoredGround() || changed;
  }

  if (changed) stabilizePlayerAfterCollisionRecovery();
  return changed;
}

function recoverInvalidPlayerState() {
  const positionOk = [player.position.x, player.position.y, player.position.z].every(Number.isFinite);
  const velocityOk = [player.velocity.x, player.velocity.y, player.velocity.z].every(Number.isFinite);
  const yawOk = Number.isFinite(player.yaw);
  const pitchOk = Number.isFinite(player.cameraPitch);
  if (positionOk && velocityOk && yawOk && pitchOk) return false;

  const safeX = Number.isFinite(player.position.x) ? player.position.x : 0;
  const safeZ = Number.isFinite(player.position.z) ? player.position.z : 0;
  player.yaw = yawOk ? player.yaw : Math.PI * 0.25;
  player.cameraPitch = pitchOk ? THREE.MathUtils.clamp(player.cameraPitch, cameraPitchMin, cameraPitchMax) : -0.42;
  player.position.set(safeX, surfaceHeight(safeX, safeZ) + 1.01, safeZ);
  stabilizePlayerAfterCollisionRecovery();
  return true;
}

function resolvePlayerVerticalOverlap() {
  const escapeY = playerVerticalEscapeHeightAt(player.position.x, player.position.z, player.position.y);
  if (!Number.isFinite(escapeY)) return false;
  if (escapeY <= player.position.y + 0.001) return false;
  if (escapeY - player.position.y > playerCollisionRecoveryLift) return false;
  if (playerBodyCollides(player.position.x, player.position.z, escapeY)) return false;
  player.position.y = escapeY;
  return true;
}

function playerVerticalEscapeHeightAt(x, z, y) {
  const minX = x - playerRadius;
  const maxX = x + playerRadius;
  const minZ = z - playerRadius;
  const maxZ = z + playerRadius;
  const firstBlockX = Math.floor(minX + 0.5);
  const lastBlockX = Math.floor(maxX + 0.5);
  const firstBlockZ = Math.floor(minZ + 0.5);
  const lastBlockZ = Math.floor(maxZ + 0.5);
  const firstBodyY = Math.floor(y) - 1;
  const lastBodyY = Math.floor(y) + playerBodyTopOffset;
  let highestSolidY = -Infinity;

  for (let bx = firstBlockX; bx <= lastBlockX; bx++) {
    for (let bz = firstBlockZ; bz <= lastBlockZ; bz++) {
      for (let by = firstBodyY; by <= lastBodyY; by++) {
        if (!isSolidCell(bx, by, bz)) continue;
        const overlapX = Math.min(maxX - (bx - 0.5), bx + 0.5 - minX);
        const overlapZ = Math.min(maxZ - (bz - 0.5), bz + 0.5 - minZ);
        if (overlapX <= 0 || overlapZ <= 0) continue;
        highestSolidY = Math.max(highestSolidY, by);
      }
    }
  }

  return Number.isFinite(highestSolidY) ? highestSolidY + 1.01 : -Infinity;
}

function resolvePlayerHorizontalOverlap() {
  let changed = false;
  for (let i = 0; i < 8; i++) {
    const push = playerBodyCollisionPush(player.position.x, player.position.z, player.position.y);
    if (push.lengthSq() === 0) return changed;
    if (![push.x, push.z].every(Number.isFinite)) return changed;
    const length = Math.hypot(push.x, push.z);
    if (length > 0.72) push.multiplyScalar(0.72 / length);
    player.position.x += push.x;
    player.position.z += push.z;
    changed = true;
  }
  return changed;
}

function snapPlayerToRestoredGround() {
  const ground = playerGroundHeightAt(player.position.x, player.position.z, player.position.y + autoStepHeight, { allowStepUp: true });
  if (!Number.isFinite(ground)) return false;
  if (ground <= player.position.y + 0.001) return false;
  if (ground - player.position.y > playerCollisionRecoveryLift) return false;
  if (playerBodyCollides(player.position.x, player.position.z, ground)) return false;
  player.position.y = ground;
  return true;
}

function recoverPlayerToSafeStand(reason = "unknown") {
  const safe = findNearestSafePlayerStand(player.position.x, player.position.z, player.position.y);
  if (safe) {
    player.position.set(safe.x, safe.y, safe.z);
    stabilizePlayerAfterCollisionRecovery();
    return true;
  }

  const fallbackX = Number.isFinite(player.position.x) ? player.position.x : 0;
  const fallbackZ = Number.isFinite(player.position.z) ? player.position.z : 0;
  player.position.set(fallbackX, surfaceHeight(fallbackX, fallbackZ) + 1.01, fallbackZ);
  stabilizePlayerAfterCollisionRecovery();
  console.warn(`Recovered player collision state with fallback ground placement: ${reason}`);
  return true;
}

function findNearestSafePlayerStand(originX, originZ, referenceY) {
  const baseX = Number.isFinite(originX) ? originX : 0;
  const baseZ = Number.isFinite(originZ) ? originZ : 0;
  const baseY = Number.isFinite(referenceY) ? referenceY : surfaceHeight(baseX, baseZ) + 1.01;
  const minBlockY = Math.max(minBuildY, Math.floor(baseY - playerGroundProbeDepth - 1.01));
  const maxBlockY = Math.min(maxBuildY, Math.floor(baseY + playerCollisionRecoveryLift - 1.01));
  let best = null;
  let bestScore = Infinity;

  for (let dz = -playerCollisionRecoverySearchRadius; dz <= playerCollisionRecoverySearchRadius; dz += 1) {
    for (let dx = -playerCollisionRecoverySearchRadius; dx <= playerCollisionRecoverySearchRadius; dx += 1) {
      const candidateX = baseX + dx;
      const candidateZ = baseZ + dz;
      const ground = playerGroundHeightInBlockRangeAt(candidateX, candidateZ, minBlockY, maxBlockY);
      if (!Number.isFinite(ground)) continue;
      if (playerBodyCollides(candidateX, candidateZ, ground)) continue;
      const horizontalScore = dx * dx + dz * dz;
      const verticalScore = Math.abs(ground - baseY) * 0.35;
      const score = horizontalScore + verticalScore;
      if (score >= bestScore) continue;
      best = { x: candidateX, y: ground, z: candidateZ };
      bestScore = score;
    }
  }

  return best;
}

function stabilizePlayerAfterCollisionRecovery() {
  clearAutoMove();
  clearHorizontalVelocity();
  player.velocity.y = 0;
  player.grounded = true;
  player.moving = false;
  cameraFocusReady = false;
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
  const push = playerCollisionPushVector.set(0, 0, 0);

  for (let bx = firstBlockX; bx <= lastBlockX; bx++) {
    for (let bz = firstBlockZ; bz <= lastBlockZ; bz++) {
      for (let by = firstBodyY; by <= lastBodyY; by++) {
        if (!isSolidCell(bx, by, bz)) continue;

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
  resetFirstPersonViewmodelPose();
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
  if (firstPersonCamera) avatar.rotation.y = player.yaw;
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
    setAvatarNameTag(remoteAvatar, resolveGuardianAvatarName(remotePlayer, entry));
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
  setAvatarNameTag(entry.avatar, resolveGuardianAvatarName(remotePlayer, entry));
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
  disposeAvatarNameTag(entry.avatar);
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
  pendingMinedBlocks.delete(key);
  blockDamage.delete(key);
  solidBlocks.delete(key);
  placedBlocks.delete(key);
  invalidateWorldQueryCache();
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

function resolveLocalAvatarName() {
  const session = getGameSession();
  return session.username || session.walletAddress || gameText("main.account.guest", "Guest");
}

function resolveGuardianAvatarName(remotePlayer = {}, entry = null) {
  const explicitName = String(
    remotePlayer.username ||
    remotePlayer.name ||
    remotePlayer.displayName ||
    remotePlayer.ownerName ||
    "",
  ).trim();
  if (explicitName) return explicitName;
  const ownerKey = normalizeGuardianOwnerKey(remotePlayer) || entry?.ownerKey || "";
  if (ownerKey) return ownerKey;
  const ownerHash = normalizeGuardianOwnerHash(remotePlayer.ownerHash) || entry?.ownerHash || 0;
  if (ownerHash) return `P-${ownerHash.toString(16)}`;
  return `P-${remotePlayer.localPlayerId || "0"}`;
}

function formatAvatarNameLabel(value) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  const fallback = gameText("main.account.guest", "Guest");
  const chars = Array.from(raw || fallback);
  if (chars.length <= avatarNameTagMaxChars) return chars.join("");
  return `${chars.slice(0, 6).join("")}...${chars.slice(-4).join("")}`;
}

function setAvatarNameTag(targetAvatar, name) {
  if (!targetAvatar) return null;
  if (targetAvatar === avatar) {
    disposeAvatarNameTag(targetAvatar);
    return null;
  }
  const label = formatAvatarNameLabel(name);
  if (targetAvatar.userData.nameTag && targetAvatar.userData.nameTagText === label) {
    syncAvatarNameTagPosition(targetAvatar.userData.nameTag);
    return targetAvatar.userData.nameTag;
  }
  disposeAvatarNameTag(targetAvatar);
  const sprite = createAvatarNameTagSprite(label);
  sprite.name = "avatarNameTag";
  sprite.userData.targetAvatar = targetAvatar;
  scene.add(sprite);
  targetAvatar.userData.nameTag = sprite;
  targetAvatar.userData.nameTagText = label;
  targetAvatar.userData.nameTagEnabled = true;
  syncAvatarNameTagPosition(sprite);
  return sprite;
}

function createAvatarNameTagSprite(label) {
  const canvas = document.createElement("canvas");
  canvas.width = avatarNameTagCanvasMaxWidth;
  canvas.height = avatarNameTagCanvasHeight;
  let context = canvas.getContext("2d");
  context.font = "800 44px Inter, system-ui, sans-serif";
  const textWidth = context.measureText(label).width;
  const width = Math.ceil(THREE.MathUtils.clamp(textWidth + 44, avatarNameTagCanvasMinWidth, avatarNameTagCanvasMaxWidth));
  canvas.width = width;
  canvas.height = avatarNameTagCanvasHeight;
  context = canvas.getContext("2d");
  context.clearRect(0, 0, width, avatarNameTagCanvasHeight);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "800 44px Inter, system-ui, sans-serif";
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 3;
  context.fillStyle = "rgba(255, 255, 255, 0.86)";
  context.fillText(label, width / 2, avatarNameTagCanvasHeight / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  const widthScale = 3.2 * (width / avatarNameTagCanvasMaxWidth);
  sprite.scale.set(widthScale, 0.72, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function setAvatarNameTagVisible(targetAvatar, visible) {
  if (targetAvatar === avatar) {
    disposeAvatarNameTag(targetAvatar);
    return;
  }
  const sprite = targetAvatar?.userData?.nameTag;
  if (!sprite) return;
  targetAvatar.userData.nameTagEnabled = Boolean(visible);
  syncAvatarNameTagPosition(sprite);
}

function updateAvatarNameTags() {
  disposeAvatarNameTag(avatar);
  for (const entry of guardianRemotePlayers.values()) {
    syncAvatarNameTagPosition(entry.avatar?.userData?.nameTag);
  }
}

function syncAvatarNameTagPosition(sprite) {
  const targetAvatar = sprite?.userData?.targetAvatar;
  if (!sprite || !targetAvatar) return;
  targetAvatar.getWorldPosition(avatarNameTagWorldPosition);
  sprite.position.set(
    avatarNameTagWorldPosition.x,
    avatarNameTagWorldPosition.y + avatarNameTagOffsetY,
    avatarNameTagWorldPosition.z,
  );
  const enabled = targetAvatar.userData.nameTagEnabled !== false;
  const firstPersonLocal = targetAvatar === avatar && firstPersonCamera;
  sprite.visible = enabled && !firstPersonLocal && targetAvatar.visible !== false;
}

function disposeAvatarNameTag(targetAvatar) {
  const sprite = targetAvatar?.userData?.nameTag;
  if (!sprite) return;
  sprite.parent?.remove(sprite);
  sprite.material?.map?.dispose?.();
  sprite.material?.dispose?.();
  targetAvatar.userData.nameTag = null;
  targetAvatar.userData.nameTagText = "";
  targetAvatar.userData.nameTagEnabled = true;
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

function toggleFirstPersonCamera() {
  setFirstPersonCameraEnabled(!firstPersonCamera);
}

function setFirstPersonCameraEnabled(enabled) {
  firstPersonCamera = Boolean(enabled);
  cameraFocusReady = false;
  dragging = false;
  activePointerId = null;
  document.body.classList.toggle("first-person-camera", firstPersonCamera);
  if (firstPersonCamera) {
    requestFirstPersonPointerLock();
    schedulePlacementPreviewFromCenter();
  } else {
    releaseFirstPersonPointerLock();
  }
}

function requestFirstPersonPointerLock() {
  if (!firstPersonCamera || !canvas || document.pointerLockElement === canvas) return;
  try {
    const lockResult = canvas.requestPointerLock?.();
    if (lockResult && typeof lockResult.catch === "function") lockResult.catch(() => {});
  } catch {
    // Pointer lock is best-effort; first-person mouse movement still works while the cursor is over the game.
  }
}

function releaseFirstPersonPointerLock() {
  if (document.pointerLockElement !== canvas) return;
  try {
    document.exitPointerLock?.();
  } catch {
    // Ignore browser-specific pointer lock release failures.
  }
}

function resetFirstPersonViewmodelPose() {
  const { rightArm } = avatar.userData.limbs ?? {};
  if (!rightArm) return;
  rightArm.position.set(0.64, 2.05, 0);
  rightArm.rotation.y = 0;
  rightArm.getObjectByName("rightArmSleeve")?.scale.set(0.34, 0.5, 0.38);
  rightArm.getObjectByName("rightArmCuff")?.scale.set(0.36, 0.06, 0.4);
  rightArm.getObjectByName("rightArmHand")?.scale.set(0.32, 0.42, 0.34);
  rightArm.getObjectByName("rightArmKnuckle")?.scale.set(0.22, 0.08, 0.05);
}

function syncFirstPersonAvatarParts() {
  avatar.visible = true;
  disposeAvatarNameTag(avatar);
  const { head, leftArm, rightArm, leftLeg, rightLeg } = avatar.userData.limbs ?? {};
  const torso = avatar.getObjectByName("torso");
  if (head) head.visible = !firstPersonCamera;
  if (torso) torso.visible = !firstPersonCamera;
  if (leftArm) leftArm.visible = !firstPersonCamera;
  if (leftLeg) leftLeg.visible = !firstPersonCamera;
  if (rightLeg) rightLeg.visible = !firstPersonCamera;
  if (!rightArm) return;
  rightArm.visible = true;
  const rightArmSleeve = rightArm.getObjectByName("rightArmSleeve");
  const rightArmCuff = rightArm.getObjectByName("rightArmCuff");
  if (rightArmSleeve) rightArmSleeve.visible = true;
  if (rightArmCuff) rightArmCuff.visible = true;
}

function applyFirstPersonViewmodelPose() {
  const { rightArm } = avatar.userData.limbs ?? {};
  if (!rightArm) return;
  rightArm.getObjectByName("rightArmSleeve")?.scale.set(0.13, 0.24, 0.16);
  rightArm.getObjectByName("rightArmCuff")?.scale.set(0.18, 0.045, 0.2);
  rightArm.getObjectByName("rightArmHand")?.scale.set(0.25, 0.32, 0.27);
  rightArm.getObjectByName("rightArmKnuckle")?.scale.set(0.17, 0.06, 0.04);
  firstPersonViewmodelMotionQuaternion.copy(rightArm.quaternion);
  firstPersonViewmodelWorldPosition.copy(firstPersonViewmodelOffset).applyMatrix4(camera.matrixWorld);
  avatar.updateMatrixWorld(true);
  avatar.worldToLocal(firstPersonViewmodelWorldPosition);
  rightArm.position.copy(firstPersonViewmodelWorldPosition);
  avatar.getWorldQuaternion(firstPersonViewmodelParentQuaternion);
  firstPersonViewmodelParentQuaternionInverse.copy(firstPersonViewmodelParentQuaternion).invert();
  firstPersonViewmodelWorldQuaternion
    .copy(camera.quaternion)
    .multiply(firstPersonRightArmPoseQuaternion)
    .multiply(firstPersonViewmodelMotionQuaternion);
  rightArm.quaternion.copy(firstPersonViewmodelParentQuaternionInverse.multiply(firstPersonViewmodelWorldQuaternion));
}

function updateCamera(dt = 1 / 60) {
  syncFirstPersonAvatarParts();
  if (firstPersonCamera) {
    const eyePosition = cameraFocus.set(
      player.position.x,
      player.position.y + firstPersonEyeHeight,
      player.position.z,
    );
    const horizontal = Math.cos(player.cameraPitch);
    cameraRayDirection.set(
      -Math.sin(player.yaw) * horizontal,
      Math.sin(player.cameraPitch),
      -Math.cos(player.yaw) * horizontal,
    ).normalize();
    cameraOffset.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(firstPersonCameraBackDistance);
    camera.position.copy(eyePosition).add(cameraOffset);
    cameraLookTarget.copy(camera.position).addScaledVector(cameraRayDirection, 8);
    camera.lookAt(cameraLookTarget);
    camera.updateMatrixWorld(true);
    applyFirstPersonViewmodelPose();
    cameraFocusReady = true;
    return;
  }

  const mobileCamera = isMobileViewport();
  const desiredFocus = cameraSamplePosition.set(
    player.position.x,
    player.position.y + (mobileCamera ? 2.05 : 1.5),
    player.position.z,
  );
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
  cameraOffset.set(
    Math.sin(player.yaw) * horizontal,
    Math.sin(-player.cameraPitch) * distance + (mobileCamera ? 3.8 : 2.1),
    Math.cos(player.yaw) * horizontal,
  );
  cameraDesiredPosition.copy(cameraFocus).add(cameraOffset);
  resolveCameraOcclusion(cameraFocus, cameraDesiredPosition, cameraResolvedPosition);
  const positionAlpha = 1 - Math.exp(-dt * 9);
  camera.position.lerp(cameraResolvedPosition, positionAlpha);
  camera.lookAt(cameraFocus);
}

function resolveCameraOcclusion(focus, desiredPosition, resolvedPosition) {
  const distance = cameraRayDirection.subVectors(desiredPosition, focus).length();
  if (distance <= 0.001) {
    resolvedPosition.copy(desiredPosition);
    return;
  }

  cameraRayDirection.normalize();
  let safeDistance = distance;
  const samples = cameraOcclusionState.blocked
    ? (lowPowerChunkLoading ? 12 : 16)
    : 8;
  const startDistance = Math.min(1.2, distance * 0.22);
  let blocked = false;
  for (let i = 1; i <= samples; i++) {
    const sampleDistance = startDistance + ((distance - startDistance) * i) / samples;
    cameraSamplePosition.copy(focus).addScaledVector(cameraRayDirection, sampleDistance);
    if (!isCameraBlockedAt(cameraSamplePosition)) continue;
    safeDistance = Math.max(1.25, sampleDistance - 0.58);
    blocked = true;
    break;
  }
  cameraOcclusionState.blocked = blocked;

  resolvedPosition.copy(focus).addScaledVector(cameraRayDirection, safeDistance);
}

function isCameraBlockedAt(position) {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  const z = Math.round(position.z);
  if (Math.abs(x - player.position.x) < 1 && Math.abs(z - player.position.z) < 1 && y <= player.position.y + 1) {
    return false;
  }
  return isSolidCell(x, y, z);
}

function isMobileViewport() {
  return mobileViewport;
}

function computeMobileViewport() {
  return Boolean(coarsePointerMedia?.matches) || window.innerWidth <= 760;
}

function refreshMobileViewport() {
  const next = computeMobileViewport();
  const changed = next !== mobileViewport;
  mobileViewport = next;
  if (changed && !next) resetMobileJoystick();
  return changed;
}

function generateAround(center, { force = false } = {}) {
  const cx = Math.floor(center.x / chunkSize);
  const cz = Math.floor(center.z / chunkSize);
  const centerKey = chunkKey(cx, cz);
  if (!force && chunkViewState.centerKey === centerKey) return;
  chunkViewState.centerKey = centerKey;

  const visibleKeys = collectChunkKeys(cx, cz, renderDistance);
  const preloadKeys = collectChunkKeys(cx, cz, preloadDistance);
  const synchronousChunkRadius = force ? initialChunkRadius : 0;
  const nextPending = [];
  const nextPreload = [];
  let placeholderBatchDirty = false;

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
      if (Math.abs(x - cx) <= synchronousChunkRadius && Math.abs(z - cz) <= synchronousChunkRadius) {
        generatedChunks.set(key, createChunk(x, z, true, chunkDetailModeForChunk(x, z)));
      } else {
        if (force && !placeholderChunks.has(key) && !pendingPlaceholderChunkKeySet.has(key)) {
          placeholderChunks.set(key, createPlaceholderChunkData(x, z));
          placeholderBatchDirty = true;
        } else {
          queuePlaceholderChunk(key);
        }
        nextPending.push(key);
      }
    }
  }
  if (placeholderBatchDirty) rebuildPlaceholderBatch();
  pendingChunkKeys = mergePendingChunkKeys(pendingChunkKeys, nextPending, visibleKeys, cx, cz);
  pendingPlaceholderChunkKeys = sortPendingPlaceholderChunkKeys(pendingPlaceholderChunkKeys, visibleKeys, cx, cz);
  pendingChunkRefreshKeys = sortPendingChunkRefreshKeys(pendingChunkRefreshKeys, visibleKeys, cx, cz);

  for (const [key, group] of generatedChunks) {
    if (visibleKeys.has(key)) continue;
    world.remove(group);
    generatedChunks.delete(key);
    if (preloadKeys.has(key)) {
      const oldPreloaded = preloadedChunks.get(key);
      if (oldPreloaded && oldPreloaded !== group) disposeGroup(oldPreloaded);
      preloadedChunks.set(key, group);
    } else {
      disposeGroup(group);
    }
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

  let placeholderCleanupDirty = false;
  for (const [key] of placeholderChunks) {
    if (
      visibleKeys.has(key) &&
      !generatedChunks.has(key) &&
      isChunkKeyInActivePlaceholderRange(key, cx, cz)
    ) continue;
    placeholderChunks.delete(key);
    pendingPlaceholderChunkKeySet.delete(key);
    placeholderCleanupDirty = true;
  }
  if (placeholderCleanupDirty) rebuildPlaceholderBatch();

  cancelChunkWorkerBuildsOutside(preloadKeys);
}

function buildPendingChunks() {
  const start = performance.now();
  const moving = isPlayerActivelyMovingForChunkWork();
  buildPendingPlaceholderChunks(start);
  if (!moving) processPendingChunkRefreshes(start, { preemptive: true });
  let built = 0;
  while (pendingChunkKeys.length && built < chunkBuildBudget && performance.now() - start < chunkBuildBudgetMs) {
    const key = pendingChunkKeys.shift();
    if (generatedChunks.has(key) || !isChunkKeyInRenderRange(key)) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const detailMode = initialChunkDetailModeForMissingChunk(chunkX, chunkZ);
    const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode, target: "generated" });
    if (requestState === "defer") {
      pendingChunkKeys.unshift(key);
      break;
    }
    if (!requestState) {
      const group = createChunk(chunkX, chunkZ, true, detailMode);
      generatedChunks.set(key, group);
      queueChunkDetailRefreshIfNeeded(key, group, chunkDetailModeForChunk(chunkX, chunkZ));
    }
    built++;
  }

  let rebuilt = 0;
  while (
    pendingChunkRebuildKeys.length &&
    rebuilt < chunkRefreshBudget &&
    performance.now() - start < chunkBuildBudgetMs
  ) {
    const key = pendingChunkRebuildKeys.shift();
    const [chunkX, chunkZ] = key.split(",").map(Number);
    if (isChunkInRenderRange(chunkX, chunkZ)) {
      const detailMode = chunkDetailModeForChunk(chunkX, chunkZ);
      const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode, target: "refresh" });
      if (requestState === "defer") {
        pendingChunkRebuildKeys.unshift(key);
        break;
      }
      if (!requestState) replaceChunkSynchronously(key, chunkX, chunkZ, true, detailMode);
      rebuilt++;
      continue;
    }
    if (isChunkInPreloadRange(chunkX, chunkZ)) {
      const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode: "distant", target: "preload" });
      if (requestState === "defer") {
        pendingChunkRebuildKeys.unshift(key);
        break;
      }
      if (!requestState) replaceChunkSynchronously(key, chunkX, chunkZ, false, "distant");
      rebuilt++;
      continue;
    }
    rebuilt++;
  }

  processPendingChunkRefreshes(start, { upgradesOnly: moving });

  let preloaded = 0;
  const preloadBudget = moving ? movingPreloadChunkBuildBudget : preloadChunkBuildBudget;
  while (
    !pendingChunkKeys.length &&
    !pendingChunkRefreshKeys.length &&
    pendingPreloadChunkKeys.length &&
    preloaded < preloadBudget &&
    performance.now() - start < chunkBuildBudgetMs
  ) {
    const key = pendingPreloadChunkKeys.shift();
    if (generatedChunks.has(key) || preloadedChunks.has(key) || !isChunkKeyInPreloadRange(key)) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode: "distant", target: "preload" });
    if (requestState === "defer") {
      pendingPreloadChunkKeys.unshift(key);
      break;
    }
    if (!requestState) {
      preloadedChunks.set(key, createChunk(chunkX, chunkZ, false, "distant"));
    }
    preloaded++;
  }
}

function processPendingChunkRefreshes(start, { preemptive = false, upgradesOnly = false } = {}) {
  let refreshed = 0;
  const budget = upgradesOnly ? 1 : preemptive ? preemptiveChunkRefreshBudget : chunkRefreshBudget;
  while (
    pendingChunkRefreshKeys.length &&
    refreshed < budget &&
    performance.now() - start < chunkBuildBudgetMs
  ) {
    const key = pendingChunkRefreshKeys[0];
    if (pendingChunkKeys.length && !canRefreshPreemptMissingChunks(key)) break;
    if (preemptive && !canRefreshPreemptMissingChunks(key)) break;
    pendingChunkRefreshKeys.shift();
    if (!isChunkKeyInRenderRange(key)) continue;
    const current = generatedChunks.get(key);
    if (!current) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const detailMode = chunkDetailModeForChunk(chunkX, chunkZ);
    if (current.userData.detailMode === detailMode) continue;
    if (isLowerChunkDetailMode(detailMode, current.userData.detailMode)) continue;
    if (upgradesOnly && !isHigherChunkDetailMode(detailMode, current.userData.detailMode)) continue;
    const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode, target: "refresh" });
    if (requestState === "defer") {
      pendingChunkRefreshKeys.unshift(key);
      break;
    }
    if (!requestState) {
      world.remove(current);
      disposeGroup(current);
      generatedChunks.delete(key);
      generatedChunks.set(key, createChunk(chunkX, chunkZ, true, detailMode));
    }
    refreshed++;
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

function sortPendingPlaceholderChunkKeys(keys, visibleKeys, centerChunkX, centerChunkZ) {
  const unique = new Set();
  const sorted = [];
  for (const key of keys) {
    if (unique.has(key) || generatedChunks.has(key) || preloadedChunks.has(key) || placeholderChunks.has(key) || !visibleKeys.has(key)) {
      pendingPlaceholderChunkKeySet.delete(key);
      continue;
    }
    unique.add(key);
    sorted.push(key);
  }
  sorted.sort((a, b) => chunkDistanceScore(a, centerChunkX, centerChunkZ) - chunkDistanceScore(b, centerChunkX, centerChunkZ));
  return sorted;
}

function queuePlaceholderChunk(key) {
  if (generatedChunks.has(key) || preloadedChunks.has(key) || placeholderChunks.has(key) || pendingPlaceholderChunkKeySet.has(key)) return;
  pendingPlaceholderChunkKeySet.add(key);
  pendingPlaceholderChunkKeys.push(key);
}

function isChunkKeyInActivePlaceholderRange(key, centerChunkX = currentCenterChunkX(), centerChunkZ = currentCenterChunkZ()) {
  if (!isPlayerActivelyMovingForChunkWork()) return true;
  const [chunkX, chunkZ] = key.split(",").map(Number);
  return Math.abs(chunkX - centerChunkX) <= movingPlaceholderRadius &&
    Math.abs(chunkZ - centerChunkZ) <= movingPlaceholderRadius;
}

function buildPendingPlaceholderChunks(start) {
  let built = 0;
  let dirty = false;
  while (
    pendingPlaceholderChunkKeys.length &&
    built < placeholderChunkBuildBudget &&
    performance.now() - start < placeholderChunkBuildBudgetMs
  ) {
    const key = pendingPlaceholderChunkKeys.shift();
    pendingPlaceholderChunkKeySet.delete(key);
    if (
      generatedChunks.has(key) ||
      preloadedChunks.has(key) ||
      placeholderChunks.has(key) ||
      !isChunkKeyInRenderRange(key) ||
      !isChunkKeyInActivePlaceholderRange(key)
    ) continue;
    const [chunkX, chunkZ] = key.split(",").map(Number);
    const placeholder = createPlaceholderChunkData(chunkX, chunkZ);
    placeholderChunks.set(key, placeholder);
    dirty = true;
    built++;
  }
  if (dirty) rebuildPlaceholderBatch();
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
  removePlaceholderChunk(key);
  preloadedChunks.delete(key);
  if (group.userData.detailMode !== detailMode) {
    world.add(group);
    generatedChunks.set(key, group);
    queueChunkDetailRefreshIfNeeded(key, group, detailMode);
    return;
  }
  world.add(group);
  generatedChunks.set(key, group);
}

function createPlaceholderChunkData(chunkX, chunkZ) {
  const byType = new Map();
  const waterCells = [];
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;

  for (let localZ = 0; localZ < chunkSize; localZ += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const x = minX + localX;
      const z = minZ + localZ;
      const y = surfaceHeight(x, z);
      const type = canonicalRenderTypeAt({ x, y, z }) || "grass";
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push({ x, y, z });
      if (y < seaLevel) waterCells.push({ x, y: seaLevel, z });
    }
  }

  return { chunkX, chunkZ, byType, waterCells };
}

function rebuildPlaceholderBatch() {
  disposePlaceholderBatch();
  const cellsByType = new Map();
  for (const placeholder of placeholderChunks.values()) {
    for (const [type, cells] of placeholder.byType) {
      if (!cellsByType.has(type)) cellsByType.set(type, []);
      cellsByType.get(type).push(...cells);
    }
    if (placeholder.waterCells?.length) {
      if (!cellsByType.has("water")) cellsByType.set("water", []);
      cellsByType.get("water").push(...placeholder.waterCells.map((cell) => ({ ...cell, yOffset: 0.18 })));
    }
  }
  for (const [type, cells] of cellsByType) {
    const material = materials[type] ?? materials.grass ?? materials.dirt;
    const mesh = createPlaceholderSurfaceMesh(cells, material);
    if (mesh) {
      mesh.userData.meshType = type;
      placeholderBatchGroup.add(mesh);
    }
  }
}

function disposePlaceholderBatch() {
  for (const child of [...placeholderBatchGroup.children]) {
    placeholderBatchGroup.remove(child);
    child.geometry?.dispose?.();
    if (typeof child.dispose === "function") child.dispose();
  }
  placeholderBatchGroup.clear();
  placeholderBatchNeedsMaintenance = false;
}

function createPlaceholderSurfaceMesh(cells, material, yOffset = placeholderTopYOffset) {
  if (!cells?.length || !material) return null;
  const positions = [];
  const normals = [];
  const indices = [];
  appendGreedyPlaceholderTopQuads(cells, yOffset, positions, normals, indices);
  if (!indices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.userData.chunkOwned = true;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), 1));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.raycast = () => {};
  return mesh;
}

function appendGreedyPlaceholderTopQuads(cells, defaultYOffset, positions, normals, indices) {
  const groups = new Map();
  for (const cell of cells) {
    const y = cell.y + (cell.yOffset ?? defaultYOffset);
    const planeKey = String(y);
    let group = groups.get(planeKey);
    if (!group) {
      group = { y, rows: new Map(), minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
      groups.set(planeKey, group);
    }
    let row = group.rows.get(cell.z);
    if (!row) {
      row = new Set();
      group.rows.set(cell.z, row);
    }
    row.add(cell.x);
    group.minX = Math.min(group.minX, cell.x);
    group.maxX = Math.max(group.maxX, cell.x);
    group.minZ = Math.min(group.minZ, cell.z);
    group.maxZ = Math.max(group.maxZ, cell.z);
  }

  for (const group of groups.values()) appendGreedyPlaceholderPlane(group, positions, normals, indices);
}

function appendGreedyPlaceholderPlane(group, positions, normals, indices) {
  const visited = new Map();
  for (let z = group.minZ; z <= group.maxZ; z += 1) {
    for (let x = group.minX; x <= group.maxX; x += 1) {
      if (hasVisitedPlaceholderCell(visited, x, z) || !hasPlaceholderCell(group, x, z)) continue;

      let width = 1;
      while (hasPlaceholderCell(group, x + width, z) && !hasVisitedPlaceholderCell(visited, x + width, z)) width += 1;

      let depth = 1;
      growDepth: while (z + depth <= group.maxZ) {
        for (let dx = 0; dx < width; dx += 1) {
          if (!hasPlaceholderCell(group, x + dx, z + depth) || hasVisitedPlaceholderCell(visited, x + dx, z + depth)) {
            break growDepth;
          }
        }
        depth += 1;
      }

      for (let dz = 0; dz < depth; dz += 1) {
        for (let dx = 0; dx < width; dx += 1) addVisitedPlaceholderCell(visited, x + dx, z + dz);
      }
      appendPlaceholderTopRect(positions, normals, indices, x, x + width - 1, group.y, z, z + depth - 1);
    }
  }
}

function hasPlaceholderCell(group, x, z) {
  return group.rows.get(z)?.has(x) ?? false;
}

function hasVisitedPlaceholderCell(visited, x, z) {
  return visited.get(z)?.has(x) ?? false;
}

function addVisitedPlaceholderCell(visited, x, z) {
  let row = visited.get(z);
  if (!row) {
    row = new Set();
    visited.set(z, row);
  }
  row.add(x);
}

function appendPlaceholderTopQuad(positions, normals, indices, x, y, z) {
  appendPlaceholderTopRect(positions, normals, indices, x, x, y, z, z);
}

function appendPlaceholderTopRect(positions, normals, indices, minX, maxX, y, minZ, maxZ) {
  const index = positions.length / 3;
  positions.push(
    minX - 0.5, y, minZ - 0.5,
    maxX + 0.5, y, minZ - 0.5,
    maxX + 0.5, y, maxZ + 0.5,
    minX - 0.5, y, maxZ + 0.5,
  );
  normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
  indices.push(index, index + 2, index + 1, index, index + 3, index + 2);
}

function queueChunkDetailRefreshIfNeeded(key, group, detailMode) {
  if (group.userData.detailMode === detailMode) return;
  if (isLowerChunkDetailMode(detailMode, group.userData.detailMode)) return;
  if (pendingChunkRefreshKeys.includes(key)) return;
  pendingChunkRefreshKeys.push(key);
}

function isLowerChunkDetailMode(nextMode, currentMode) {
  return chunkDetailRank(nextMode) > chunkDetailRank(currentMode);
}

function isHigherChunkDetailMode(nextMode, currentMode) {
  return chunkDetailRank(nextMode) < chunkDetailRank(currentMode);
}

function chunkDetailRank(mode) {
  if (mode === "full") return 0;
  if (mode === "decorated") return 1;
  if (mode === "distant") return 2;
  return 3;
}

function initialChunkDetailModeForMissingChunk(chunkX, chunkZ) {
  return chunkDetailModeForChunk(chunkX, chunkZ);
}

function canRefreshPreemptMissingChunks(key) {
  if (!key) return false;
  const [chunkX, chunkZ] = key.split(",").map(Number);
  const mode = chunkDetailModeForChunk(chunkX, chunkZ);
  if (mode === "full" || mode === "decorated") return true;
  return mode === "distant" && chunkDistanceScore(key, currentCenterChunkX(), currentCenterChunkZ()) <= earlyDistantDetailRefreshRadius;
}

function sortPendingChunkRefreshKeys(keys, visibleKeys, centerChunkX, centerChunkZ) {
  const unique = new Set();
  const sorted = [];
  for (const key of keys) {
    if (unique.has(key) || !visibleKeys.has(key)) continue;
    unique.add(key);
    sorted.push(key);
  }
  sorted.sort((a, b) => chunkDetailPriorityScore(a, centerChunkX, centerChunkZ) - chunkDetailPriorityScore(b, centerChunkX, centerChunkZ));
  return sorted;
}

function chunkDetailPriorityScore(key, centerChunkX, centerChunkZ) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  const mode = chunkDetailModeForChunk(chunkX, chunkZ);
  const modeScore = mode === "full" ? 0 : mode === "decorated" ? 100 : mode === "distant" ? 200 : 300;
  return modeScore + chunkDistanceScore(key, centerChunkX, centerChunkZ);
}

function chunkDetailModeForChunk(chunkX, chunkZ) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const dx = Math.abs(chunkX - centerChunkX);
  const dz = Math.abs(chunkZ - centerChunkZ);
  if (dx === 0 && dz === 0) return "full";
  if (dx <= 1 && dz <= 1) return "decorated";
  if (dx <= renderDistance && dz <= renderDistance) return "distant";
  return "surface";
}

function chunkDistanceScore(key, centerChunkX, centerChunkZ) {
  const [chunkX, chunkZ] = key.split(",").map(Number);
  return Math.hypot(chunkX - centerChunkX, chunkZ - centerChunkZ);
}

function currentCenterChunkX() {
  return Math.floor(player.position.x / chunkSize);
}

function currentCenterChunkZ() {
  return Math.floor(player.position.z / chunkSize);
}

function generateCloudsAround(center) {
  const radiusInSectors = Math.ceil(visualCloudRenderRadius / cloudSectorSize);
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
      if (Math.hypot(sectorCenterX - center.x, sectorCenterZ - center.z) > visualCloudRenderRadius + cloudSectorSize) continue;

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
  if (isBlockReachableByHeldEquipment(hit.block)) {
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
  if (firstPersonCamera) return pickBlockAtScreenCenter(clickRaycaster, {
    far: clickRaycastFar,
    targets: nearbyGeneratedChunkGroups(clickRaycastChunkRadius),
  });
  return pickBlockAtClientPoint(event.clientX, event.clientY, clickRaycaster, {
    far: clickRaycastFar,
    targets: nearbyGeneratedChunkGroups(clickRaycastChunkRadius),
  });
}

function pickBlockAtClientPoint(clientX, clientY, raycaster, options = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return pickBlockAtNormalizedPointer(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
    raycaster,
    options,
  );
}

function pickBlockAtScreenCenter(raycaster, options = {}) {
  return pickBlockAtNormalizedPointer(0, 0, raycaster, options);
}

function pickBlockAtNormalizedPointer(x, y, raycaster, options = {}) {
  raycastPointerVector.set(x, y);
  raycaster.setFromCamera(raycastPointerVector, camera);
  raycaster.far = options.far ?? 120;
  const targets = options.targets ?? world.children;
  if (!targets.length) return null;
  raycastHits.length = 0;
  raycaster.intersectObjects(targets, true, raycastHits);

  for (const hit of raycastHits) {
    const normal = hit.face?.normal ? raycastHitNormal.copy(hit.face.normal) : raycastHitNormal.set(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld);
    const blocks = hit.object.userData.blocks;
    const block = hit.object.userData.greedyVoxelMesh
      ? blockFromGreedyVoxelHit(hit, normal)
      : Number.isInteger(hit.instanceId)
        ? blocks?.[hit.instanceId]
        : hit.object.userData.faceBlocks?.[hit.faceIndex];
    if (!block || removedBlocks.has(block.key) || pendingMinedBlocks.has(block.key)) continue;
    return { block, point: hit.point.clone(), normal: normal.clone() };
  }

  return null;
}

function nearbyGeneratedChunkGroups(radius = placementPreviewRaycastChunkRadius) {
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const groups = [];
  for (let z = centerChunkZ - radius; z <= centerChunkZ + radius; z++) {
    for (let x = centerChunkX - radius; x <= centerChunkX + radius; x++) {
      const group = generatedChunks.get(chunkKey(x, z));
      if (group) groups.push(group);
    }
  }
  return groups;
}

function blockFromGreedyVoxelHit(hit, normal) {
  if (!hit?.point || !normal) return null;
  const inside = greedyHitInsidePoint.copy(hit.point).addScaledVector(normal, -0.01);
  const x = Math.round(inside.x);
  const y = Math.round(inside.y);
  const z = Math.round(inside.z);
  const key = blockKey(x, y, z);
  const type = hit.object.userData.meshType;
  if (!type) return null;
  return { x, y, z, type, key };
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
  pendingMinedBlocks.delete(key);
  blockDamage.delete(key);
  placedBlocks.set(key, type);
  solidBlocks.add(key);
  invalidateWorldQueryCache();
  startHandSwing();
  rebuildChunksAroundBlock(target);
  updatePlacementPreview(target, true);
  submitPlacedBlockToChain(target, type);
  return true;
}

function schedulePlacementPreviewFromPointer(event) {
  if (!isPlacementAction(heldItem())) {
    placementPreview.visible = false;
    placementPreviewPointer = null;
    return;
  }
  if (firstPersonCamera) {
    schedulePlacementPreviewFromCenter();
    return;
  }
  placementPreviewPointer = { clientX: event.clientX, clientY: event.clientY };
  if (placementPreviewFrame) return;
  placementPreviewFrame = requestAnimationFrame(() => {
    placementPreviewFrame = 0;
    const pointer = placementPreviewPointer;
    placementPreviewPointer = null;
    if (!pointer) return;
    updatePlacementPreviewFromPoint(pointer.clientX, pointer.clientY);
  });
}

function schedulePlacementPreviewFromCenter() {
  if (!isPlacementAction(heldItem())) {
    placementPreview.visible = false;
    placementPreviewPointer = null;
    return;
  }
  placementPreviewPointer = { center: true };
  if (placementPreviewFrame) return;
  placementPreviewFrame = requestAnimationFrame(() => {
    placementPreviewFrame = 0;
    const pointer = placementPreviewPointer;
    placementPreviewPointer = null;
    if (!pointer) return;
    updatePlacementPreviewFromCenter();
  });
}

function updatePlacementPreviewFromPoint(clientX, clientY) {
  if (!isPlacementAction(heldItem())) {
    placementPreview.visible = false;
    return;
  }
  const hit = pickBlockAtClientPoint(clientX, clientY, previewRaycaster, {
    far: placementPreviewRaycastFar,
    targets: nearbyGeneratedChunkGroups(),
  });
  const target = placementTargetFromHit(hit);
  updatePlacementPreview(target, canPlaceBlockAt(target));
}

function updatePlacementPreviewFromCenter() {
  if (!isPlacementAction(heldItem())) {
    placementPreview.visible = false;
    return;
  }
  const hit = pickBlockAtScreenCenter(previewRaycaster, {
    far: placementPreviewRaycastFar,
    targets: nearbyGeneratedChunkGroups(),
  });
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
  if (!isSolidCell(target.x, target.y - 1, target.z)) {
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
  invalidateWorldQueryCache();
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
  const ground = playerGroundHeightAt(x, z, player.position.y, { allowStepUp: true });
  if (!Number.isFinite(ground)) return false;
  return playerBodyCollides(x, z, ground);
}

function isWaterVisualBlock(block) {
  return block?.type === "water" || block?.type === "swampWater" || block?.type === "toxicWater";
}

function isBlockInMiningArea(block) {
  if (isMiningBlockedByWater(block)) return false;
  return isBlockReachableByHeldEquipment(block);
}

function isBlockReachableByHeldEquipment(block) {
  if (isMiningBlockedByWater(block)) return false;
  const reach = miningEquipmentReachSphere();
  if (!reach) return false;
  const blockCenter = miningReachScratchCenter.set(block.x, block.y, block.z);
  return reach.center.distanceToSquared(blockCenter) <= reach.radius * reach.radius;
}

function miningEquipmentReachSphere() {
  avatar.updateMatrixWorld(true);
  const item = heldItem();
  if (item.hand === "forged" && equippedForgedMesh?.visible) {
    return miningReachSphereForObject(equippedForgedMesh, equippedForgedMesh.userData.grip);
  }

  const { rightArm, rightTool } = avatar.userData.limbs ?? {};
  if (item.hand !== "pickaxe" || !rightArm || !rightTool?.visible) return null;
  rightArm.localToWorld(miningReachScratchGrip.copy(miningToolGripAnchor));
  const boxes = miningToolCollisionBoxes();
  if (!boxes.length) {
    return miningReachScratchSphere.set(miningReachScratchGrip.clone(), miningReachDefaultToolRadius);
  }
  miningReachScratchBox.makeEmpty();
  for (const box of boxes) miningReachScratchBox.union(box);
  const radius = Math.max(miningReachMinimumRadius, miningReachRadiusFromBox(miningReachScratchBox, miningReachScratchGrip));
  return miningReachScratchSphere.set(miningReachScratchGrip.clone(), radius);
}

function miningReachSphereForObject(object, gripLocal = null) {
  const gripWorld = miningReachScratchGrip;
  if (gripLocal?.isVector3) {
    object.localToWorld(gripWorld.copy(gripLocal));
    const localRadius = miningReachLocalRadiusForObject(object, gripLocal);
    if (Number.isFinite(localRadius)) {
      object.getWorldScale(miningToolWorldScale);
      const scale = Math.max(Math.abs(miningToolWorldScale.x), Math.abs(miningToolWorldScale.y), Math.abs(miningToolWorldScale.z), 0.001);
      const radius = Math.max(miningReachMinimumRadius, localRadius * scale + miningReachBlockHalfDiagonal + miningBlockCollisionPadding);
      return miningReachScratchSphere.set(gripWorld.clone(), radius);
    }
  } else {
    const box = objectWorldBox(object, miningReachScratchBox);
    if (!box) return null;
    box.getCenter(gripWorld);
  }
  const box = objectWorldBox(object, miningReachScratchBox);
  if (!box) return null;
  const radius = Math.max(miningReachMinimumRadius, miningReachRadiusFromBox(box, gripWorld));
  return miningReachScratchSphere.set(gripWorld.clone(), radius);
}

function miningReachLocalRadiusForObject(object, originLocal) {
  const geometry = object?.isMesh ? object.geometry : null;
  if (!geometry || !originLocal?.isVector3) return NaN;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) return NaN;
  const cached = object.userData.miningReachLocalRadius;
  if (Number.isFinite(cached) && object.userData.miningReachOrigin === originLocal) return cached;
  const radius = miningReachCornerRadiusFromBox(box, originLocal);
  object.userData.miningReachLocalRadius = radius;
  object.userData.miningReachOrigin = originLocal;
  return radius;
}

function miningReachRadiusFromBox(box, origin) {
  return miningReachCornerRadiusFromBox(box, origin) + miningReachBlockHalfDiagonal + miningBlockCollisionPadding;
}

function miningReachCornerRadiusFromBox(box, origin) {
  if (!box || box.isEmpty()) return 0;
  let radiusSq = 0;
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        miningReachScratchCorner.set(
          ix ? box.max.x : box.min.x,
          iy ? box.max.y : box.min.y,
          iz ? box.max.z : box.min.z,
        );
        radiusSq = Math.max(radiusSq, origin.distanceToSquared(miningReachScratchCorner));
      }
    }
  }
  return Math.sqrt(radiusSq);
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

function requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode, target }) {
  const current = chunkWorkerBuilds.get(key);
  if (current?.detailMode === detailMode && current?.target === target) return true;
  if (current) cancelChunkWorkerBuild(key);

  const scopedEdits = chunkScopedWorldEdits(chunkX, chunkZ);
  if (scopedEdits.pendingKeys.length) return false;
  const worldConfig = serializableWorldConfig();
  const cacheKey = chunkRenderDataCacheKey({ chunkX, chunkZ, detailMode, worldConfig, scopedEdits });
  const cached = getCachedChunkRenderData(cacheKey);
  if (cached) {
    queueChunkRenderCommit({ key, chunkX, chunkZ, detailMode, target, cacheKey }, cached, { cache: false });
    return true;
  }

  const worker = nextAvailableChunkWorker();
  if (!worker) return false;
  if (activeChunkWorkerBuildCount() >= maxChunkWorkerBuilds) return "defer";
  const requestId = ++chunkWorkerRequestId;
  const request = { requestId, key, chunkX, chunkZ, detailMode, target, worker, cacheKey };
  chunkWorkerBuilds.set(key, request);
  chunkWorkerBuildsById.set(requestId, request);
  worker.activeBuilds += 1;
  worker.postMessage({
    requestId,
    payload: {
      chunkX,
      chunkZ,
      detailMode,
      worldConfig,
      removedKeys: scopedEdits.removedKeys,
      placedEntries: scopedEdits.placedEntries,
      dynamicWaterKeys: scopedEdits.dynamicWaterKeys,
    },
  });
  return true;
}

function chunkRenderDataCacheKey({ chunkX, chunkZ, detailMode, worldConfig, scopedEdits }) {
  return [
    chunkX,
    chunkZ,
    detailMode,
    worldConfigSignature(worldConfig),
    cellKeySignature(scopedEdits.removedKeys),
    cellKeySignature(scopedEdits.pendingKeys),
    cellEntrySignature(scopedEdits.placedEntries),
    cellKeySignature(scopedEdits.dynamicWaterKeys),
  ].join("|");
}

function worldConfigSignature(config) {
  if (!config) return "default";
  const seed = config.worldSeedHex ?? (Array.isArray(config.worldSeed) ? config.worldSeed.join(",") : "");
  return `${seed}:${config.minBuildY ?? ""}:${config.maxBuildY ?? ""}:${config.maxTerrainHeight ?? ""}:${config.seaLevel ?? ""}`;
}

function cellKeySignature(keys) {
  return [...keys].sort().join(";");
}

function cellEntrySignature(entries) {
  return [...entries].map(([key, value]) => `${key}:${value}`).sort().join(";");
}

function getCachedChunkRenderData(cacheKey) {
  const cached = chunkRenderDataCache.get(cacheKey);
  if (!cached) return null;
  chunkRenderDataCache.delete(cacheKey);
  chunkRenderDataCache.set(cacheKey, cached);
  return cached;
}

function cacheChunkRenderData(cacheKey, result) {
  if (!cacheKey || !result) return;
  chunkRenderDataCache.delete(cacheKey);
  chunkRenderDataCache.set(cacheKey, result);
  while (chunkRenderDataCache.size > maxChunkRenderDataCacheEntries) {
    const oldestKey = chunkRenderDataCache.keys().next().value;
    if (!oldestKey) break;
    chunkRenderDataCache.delete(oldestKey);
  }
}

function chunkScopedWorldEdits(chunkX, chunkZ) {
  ensureWorldEditIndex();
  const cacheKey = `${chunkX},${chunkZ}`;
  const cached = worldEditIndex.scopedCache.get(cacheKey);
  if (cached) return cached;

  const minX = chunkX * chunkSize - 1;
  const maxX = minX + chunkSize + 1;
  const minZ = chunkZ * chunkSize - 1;
  const maxZ = minZ + chunkSize + 1;
  const edits = {
    removedKeys: collectIndexedCellKeysByXZ(worldEditIndex.removedByChunk, minX, maxX, minZ, maxZ),
    pendingKeys: collectIndexedCellKeysByXZ(worldEditIndex.pendingByChunk, minX, maxX, minZ, maxZ),
    placedEntries: collectIndexedCellEntriesByXZ(worldEditIndex.placedByChunk, minX, maxX, minZ, maxZ),
    dynamicWaterKeys: collectIndexedCellKeysByXZ(worldEditIndex.dynamicWaterByChunk, minX, maxX, minZ, maxZ),
  };
  worldEditIndex.scopedCache.set(cacheKey, edits);
  return edits;
}

function ensureWorldEditIndex() {
  if (worldEditIndex.version === worldEditVersion) return;
  worldEditIndex.version = worldEditVersion;
  worldEditIndex.removedByChunk = indexCellKeysByChunk(removedBlocks);
  worldEditIndex.pendingByChunk = indexCellKeysByChunk(pendingMinedBlocks.keys());
  worldEditIndex.placedByChunk = indexCellEntriesByChunk(placedBlocks);
  worldEditIndex.dynamicWaterByChunk = indexCellKeysByChunk(worldState.dynamicWater ?? []);
  worldEditIndex.scopedCache.clear();
}

function indexCellKeysByChunk(keys) {
  const byChunk = new Map();
  for (const key of keys) {
    const [x, , z] = parseCellKey(key);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const bucketKey = chunkKey(Math.floor(x / chunkSize), Math.floor(z / chunkSize));
    if (!byChunk.has(bucketKey)) byChunk.set(bucketKey, []);
    byChunk.get(bucketKey).push(key);
  }
  return byChunk;
}

function indexCellEntriesByChunk(entries) {
  const byChunk = new Map();
  for (const [key, value] of entries) {
    const [x, , z] = parseCellKey(key);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const bucketKey = chunkKey(Math.floor(x / chunkSize), Math.floor(z / chunkSize));
    if (!byChunk.has(bucketKey)) byChunk.set(bucketKey, []);
    byChunk.get(bucketKey).push([key, value]);
  }
  return byChunk;
}

function collectIndexedCellKeysByXZ(index, minX, maxX, minZ, maxZ) {
  const out = [];
  forEachChunkBucketInXZ(minX, maxX, minZ, maxZ, (bucketKey) => {
    for (const key of index.get(bucketKey) ?? []) {
      const [x, , z] = parseCellKey(key);
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) out.push(key);
    }
  });
  return out;
}

function collectIndexedCellEntriesByXZ(index, minX, maxX, minZ, maxZ) {
  const out = [];
  forEachChunkBucketInXZ(minX, maxX, minZ, maxZ, (bucketKey) => {
    for (const [key, value] of index.get(bucketKey) ?? []) {
      const [x, , z] = parseCellKey(key);
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) out.push([key, value]);
    }
  });
  return out;
}

function forEachChunkBucketInXZ(minX, maxX, minZ, maxZ, visit) {
  const minChunkX = Math.floor(minX / chunkSize);
  const maxChunkX = Math.floor(maxX / chunkSize);
  const minChunkZ = Math.floor(minZ / chunkSize);
  const maxChunkZ = Math.floor(maxZ / chunkSize);
  for (let z = minChunkZ; z <= maxChunkZ; z++) {
    for (let x = minChunkX; x <= maxChunkX; x++) {
      visit(chunkKey(x, z));
    }
  }
}

function nextAvailableChunkWorker() {
  const workers = ensureChunkWorkerPool();
  if (!workers?.length) return null;
  let best = workers[nextChunkWorkerIndex % workers.length];
  for (const worker of workers) {
    if ((worker.activeBuilds ?? 0) < (best.activeBuilds ?? 0)) best = worker;
  }
  nextChunkWorkerIndex = (workers.indexOf(best) + 1) % workers.length;
  return best;
}

function ensureChunkWorkerPool() {
  if (chunkWorkers.length) return chunkWorkers;
  if (typeof Worker === "undefined") return null;
  try {
    chunkWorkers = Array.from({ length: chunkWorkerPoolSize }, () => {
      const worker = new Worker(new URL("./world/chunkWorker.js", import.meta.url), { type: "module" });
      worker.activeBuilds = 0;
      worker.onmessage = handleChunkWorkerMessage;
      worker.onerror = (event) => {
        console.warn("Chunk worker failed", event.message ?? event);
        disableChunkWorkers();
      };
      return worker;
    });
    return chunkWorkers;
  } catch (error) {
    console.warn("Chunk worker unavailable", error);
    disableChunkWorkers();
    return null;
  }
}

function activeChunkWorkerBuildCount() {
  return chunkWorkers.reduce((sum, worker) => sum + (worker.activeBuilds ?? 0), 0);
}

function disableChunkWorkers() {
  for (const worker of chunkWorkers) worker.terminate();
  chunkWorkers = [];
  nextChunkWorkerIndex = 0;
  chunkWorkerBuilds.clear();
  chunkWorkerBuildsById.clear();
}

function handleChunkWorkerMessage(event) {
  const { requestId, ok, result, error } = event.data ?? {};
  const request = chunkWorkerBuildsById.get(requestId);
  if (!request) return;
  if (request.worker) request.worker.activeBuilds = Math.max(0, (request.worker.activeBuilds ?? 1) - 1);
  chunkWorkerBuildsById.delete(requestId);
  if (request.cancelled) return;
  if (chunkWorkerBuilds.get(request.key)?.requestId === requestId) {
    chunkWorkerBuilds.delete(request.key);
  }
  if (!ok) {
    console.warn("Chunk worker build failed", error);
    fallbackChunkWorkerBuild(request);
    return;
  }
  queueChunkRenderCommit(request, result);
}

function fallbackChunkWorkerBuild(request) {
  const { key, chunkX, chunkZ, detailMode, target } = request;
  if (target === "preload") {
    if (!generatedChunks.has(key) && isChunkInPreloadRange(chunkX, chunkZ)) {
      replaceChunkSynchronously(key, chunkX, chunkZ, false, detailMode);
    }
    return;
  }
  if (!isChunkInRenderRange(chunkX, chunkZ)) return;
  const group = replaceChunkSynchronously(key, chunkX, chunkZ, true, detailMode);
  queueChunkDetailRefreshIfNeeded(key, group, chunkDetailModeForChunk(chunkX, chunkZ));
}

function replaceChunkSynchronously(key, chunkX, chunkZ, attach, detailMode) {
  if (attach) removePlaceholderChunk(key);
  const current = generatedChunks.get(key);
  if (current) {
    world.remove(current);
    disposeGroup(current);
    generatedChunks.delete(key);
  }
  const preloaded = preloadedChunks.get(key);
  if (preloaded) {
    preloadedChunks.delete(key);
    if (preloaded !== current) disposeGroup(preloaded);
  }
  const group = createChunk(chunkX, chunkZ, attach, detailMode);
  if (attach) generatedChunks.set(key, group);
  else preloadedChunks.set(key, group);
  return group;
}

function queueChunkRenderCommit(request, result, options = {}) {
  if (!request || !result) return;
  pendingChunkCommits.push({
    request,
    result,
    cache: options.cache !== false,
  });
}

function processPendingChunkCommits() {
  if (!pendingChunkCommits.length) return;
  const start = performance.now();
  const moving = isPlayerActivelyMovingForChunkCommit();
  const commitIntervalMs = moving ? movingChunkRenderCommitIntervalMs : chunkRenderCommitIntervalMs;
  if (start - lastChunkRenderCommitAt < commitIntervalMs) return;
  const commitBudget = moving ? movingChunkCommitBudget : chunkCommitBudget;
  const commitBudgetMs = moving ? movingChunkCommitBudgetMs : chunkCommitBudgetMs;
  let committed = 0;
  compactPendingChunkCommits({ force: moving });
  discardLeadingCancelledChunkCommits();
  pruneSkippedChunkCommits({ moving });
  while (
    pendingChunkCommitCursor < pendingChunkCommits.length &&
    committed < commitBudget &&
    performance.now() - start < commitBudgetMs
  ) {
    const entryIndex = selectPendingChunkCommitIndex(moving);
    if (entryIndex < 0) break;
    const entry = pendingChunkCommits[entryIndex];
    pendingChunkCommits[entryIndex] = pendingChunkCommits[pendingChunkCommitCursor];
    pendingChunkCommits[pendingChunkCommitCursor] = entry;
    pendingChunkCommitCursor++;
    if (!entry || entry.request.cancelled) continue;
    if (shouldSkipChunkRenderCommit(entry, { moving })) continue;
    if (entry.cache) cacheChunkRenderData(entry.request.cacheKey, entry.result);
    commitChunkRenderData(entry.request, entry.result);
    committed++;
    lastChunkRenderCommitAt = performance.now();
  }
  compactPendingChunkCommits();
}

function selectPendingChunkCommitIndex(moving) {
  let bestIndex = -1;
  let bestScore = Infinity;
  const scanLimit = moving ? movingChunkCommitScanLimit : chunkCommitScanLimit;
  const end = Math.min(pendingChunkCommits.length, pendingChunkCommitCursor + scanLimit);
  for (let index = pendingChunkCommitCursor; index < end; index++) {
    const entry = pendingChunkCommits[index];
    const score = chunkCommitPriorityScore(entry, { moving });
    if (score >= bestScore) continue;
    bestScore = score;
    bestIndex = index;
  }
  return bestIndex;
}

function discardLeadingCancelledChunkCommits() {
  while (
    pendingChunkCommitCursor < pendingChunkCommits.length &&
    pendingChunkCommits[pendingChunkCommitCursor]?.request?.cancelled
  ) {
    pendingChunkCommitCursor++;
  }
}

function pruneSkippedChunkCommits({ moving = false } = {}) {
  if (pendingChunkCommitCursor >= pendingChunkCommits.length) return;
  let writeIndex = pendingChunkCommitCursor;
  for (let index = pendingChunkCommitCursor; index < pendingChunkCommits.length; index++) {
    const entry = pendingChunkCommits[index];
    if (shouldSkipChunkRenderCommit(entry, { moving })) continue;
    pendingChunkCommits[writeIndex] = entry;
    writeIndex++;
  }
  pendingChunkCommits.length = writeIndex;
}

function shouldSkipChunkRenderCommit(entry, { moving = false } = {}) {
  const request = entry?.request;
  if (!request || request.cancelled) return true;
  const current = generatedChunks.get(request.key);
  return Boolean(current && isLowerChunkDetailMode(request.detailMode, current.userData.detailMode));
}

function chunkCommitPriorityScore(entry, { moving = false } = {}) {
  const request = entry?.request;
  if (!request || request.cancelled) return Infinity;
  const { chunkX, chunkZ, target } = request;
  if (!Number.isFinite(chunkX) || !Number.isFinite(chunkZ)) return Infinity;
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const distance = Math.max(Math.abs(chunkX - centerChunkX), Math.abs(chunkZ - centerChunkZ));
  const targetWeight = target === "generated" ? 0 : target === "refresh" ? renderDistance * 2 + 1 : renderDistance * 3 + 1;
  return distance + targetWeight;
}

function isPlayerActivelyMovingForChunkWork() {
  return player.moving || Boolean(player.autoMoveTarget) || hasManualMovementInput();
}

function isPlayerActivelyMovingForChunkCommit() {
  return isPlayerActivelyMovingForChunkWork();
}

function hasManualMovementInput() {
  if (mobileJoystickState.active && isMobileViewport()) {
    return Math.abs(mobileJoystickState.x) > 0.001 || Math.abs(mobileJoystickState.y) > 0.001;
  }
  return keys.has("KeyW")
    || keys.has("KeyA")
    || keys.has("KeyS")
    || keys.has("KeyD")
    || keys.has("ArrowUp")
    || keys.has("ArrowLeft")
    || keys.has("ArrowDown")
    || keys.has("ArrowRight");
}

function clearActiveMovementInput() {
  keys.clear();
  clearHorizontalVelocity();
  clearAutoMove();
  resetMobileJoystick();
}

function updateDebugRenderInfo() {
  if (!window.NiceChunkDebugRenderEnabled) return;
  const decorationInstances = debugChunkDecorationInstances();
  window.NiceChunkDebugRender = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    generatedChunks: generatedChunks.size,
    preloadedChunks: preloadedChunks.size,
    placeholderChunks: placeholderChunks.size,
    placeholderMaintenance: placeholderBatchNeedsMaintenance,
    pendingChunkCommits: Math.max(0, pendingChunkCommits.length - pendingChunkCommitCursor),
    activeChunkBuilds: activeChunkWorkerBuildCount(),
    cloudSectors: generatedCloudSectors.size,
    decorationInstances: decorationInstances.total,
    decorationInstanceTypes: decorationInstances.byType,
  };
}

function debugChunkDecorationInstances() {
  const byType = {};
  let total = 0;
  for (const group of generatedChunks.values()) {
    group.traverse((child) => {
      if (!child.isInstancedMesh) return;
      const type = child.userData?.meshType;
      if (!isDebugDecorationInstanceType(type)) return;
      const count = child.count ?? child.instanceMatrix?.count ?? 0;
      byType[type] = (byType[type] ?? 0) + count;
      total += count;
    });
  }
  return { total, byType };
}

function isDebugDecorationInstanceType(type) {
  return Boolean(type) && type !== "water" && type !== "swampWater" && type !== "toxicWater";
}

function compactPendingChunkCommits({ force = false } = {}) {
  if (pendingChunkCommitCursor === 0) return;
  if (!force && pendingChunkCommitCursor < 32 && pendingChunkCommitCursor < pendingChunkCommits.length) return;
  pendingChunkCommits.splice(0, pendingChunkCommitCursor);
  pendingChunkCommitCursor = 0;
}

function queuePlaceholderMaintenance() {
  placeholderBatchNeedsMaintenance = true;
}

function processPlaceholderMaintenance() {
  if (!placeholderBatchNeedsMaintenance) return;
  if (placeholderChunks.size === 0) {
    lastPlaceholderMaintenanceAt = performance.now();
    disposePlaceholderBatch();
    return;
  }
  if (pendingChunkCommits.length - pendingChunkCommitCursor > 0) return;
  if (activeChunkWorkerBuildCount() > 0 && pendingChunkKeys.length > 0) return;
  const now = performance.now();
  if (now - lastChunkRenderCommitAt < placeholderMaintenanceDelayMs) return;
  if (now - lastPlaceholderMaintenanceAt < placeholderMaintenanceIntervalMs) return;
  lastPlaceholderMaintenanceAt = now;
  rebuildPlaceholderBatch();
}

function commitChunkRenderData(request, result) {
  const { key, chunkX, chunkZ, detailMode, target } = request;
  if (result?.detailMode !== detailMode) return;

  if (target === "preload") {
    if (generatedChunks.has(key) || !isChunkInPreloadRange(chunkX, chunkZ)) return;
    const current = preloadedChunks.get(key);
    if (current) disposeGroup(current);
    preloadedChunks.set(key, createChunkGroupFromRenderData(result));
    return;
  }

  if (!isChunkInRenderRange(chunkX, chunkZ)) return;
  const desiredMode = chunkDetailModeForChunk(chunkX, chunkZ);
  if (detailMode !== desiredMode && target !== "generated" && isLowerChunkDetailMode(detailMode, desiredMode)) return;
  const current = generatedChunks.get(key);
  if (current && isLowerChunkDetailMode(detailMode, current.userData.detailMode)) {
    if (current.userData.detailMode !== desiredMode) queueChunkDetailRefreshIfNeeded(key, current, desiredMode);
    return;
  }
  if (
    target === "refresh" &&
    current &&
    isPlayerActivelyMovingForChunkWork() &&
    isLowerChunkDetailMode(detailMode, current.userData.detailMode)
  ) return;
  removePlaceholderChunk(key);

  if (current) {
    world.remove(current);
    disposeGroup(current);
    generatedChunks.delete(key);
  }
  const preloaded = preloadedChunks.get(key);
  if (preloaded) {
    preloadedChunks.delete(key);
    if (preloaded !== current) disposeGroup(preloaded);
  }
  const group = createChunkGroupFromRenderData(result);
  world.add(group);
  generatedChunks.set(key, group);
  if (group.userData.detailMode !== desiredMode) queueChunkDetailRefreshIfNeeded(key, group, desiredMode);
}

function serializableWorldConfig() {
  const config = window.NiceChunkWorldConfig ?? null;
  if (!config) return null;
  return {
    worldSeed: config.worldSeed ? Array.from(config.worldSeed) : undefined,
    worldSeedHex: config.worldSeedHex,
    minBuildY: config.minBuildY,
    maxBuildY: config.maxBuildY,
    maxTerrainHeight: config.maxTerrainHeight,
    seaLevel: config.seaLevel,
  };
}

function createChunkGroupFromRenderData(data) {
  const group = new THREE.Group();
  group.name = `chunk:${data.chunkX},${data.chunkZ}`;
  group.userData.detailMode = data.detailMode;
  group.userData.solidKeys = new Set(data.solidKeys ?? []);
  retainGeneratedSolidRefs(group.userData.solidKeys);
  const castChunkShadows = chunkDetailCastsShadows(data.detailMode);
  const receiveChunkShadows = chunkDetailReceivesShadows(data.detailMode);

  for (const meshData of data.meshes ?? []) {
    const geometry = new THREE.BufferGeometry();
    geometry.userData.chunkOwned = true;
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[meshData.type] ?? materials.stone);
    mesh.castShadow = castChunkShadows && chunkTypeUsesShadows(meshData.type);
    mesh.receiveShadow = receiveChunkShadows && chunkTypeReceivesShadows(meshData.type);
    mesh.userData.blocks = [];
    mesh.userData.greedyVoxelMesh = true;
    mesh.userData.meshType = meshData.type;
    group.add(mesh);
  }

  const matrix = new THREE.Matrix4();
  for (const instanceData of data.instances ?? []) {
    const geometry = geometryByType[instanceData.type] ?? geometryByType.water;
    const material = materials[instanceData.type] ?? materials.water;
    const mesh = new THREE.InstancedMesh(geometry, material, instanceData.count);
    for (let index = 0; index < instanceData.count; index += 1) {
      matrix.fromArray(instanceData.matrices, index * 16);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.castShadow = castChunkShadows && chunkTypeUsesShadows(instanceData.type);
    mesh.receiveShadow = receiveChunkShadows && chunkTypeReceivesShadows(instanceData.type);
    updateInstancedMeshBounds(mesh);
    mesh.raycast = () => {};
    mesh.userData.blocks = [];
    mesh.userData.meshType = instanceData.type;
    group.add(mesh);
  }

  return group;
}

function chunkDetailCastsShadows(detailMode) {
  return detailMode === "full" || detailMode === "decorated";
}

function chunkDetailReceivesShadows(detailMode) {
  return detailMode === "full" || detailMode === "decorated";
}

function chunkTypeUsesShadows(type) {
  return type !== "water" && type !== "swampWater" && type !== "toxicWater" && type !== "lava" && type !== "shoreDamp" && type !== "shoreFoam";
}

function chunkTypeReceivesShadows(type) {
  return type !== "shoreDamp" && type !== "shoreFoam" && type !== "water" && type !== "swampWater" && type !== "toxicWater";
}

function updateInstancedMeshBounds(mesh) {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere?.();
  mesh.computeBoundingBox?.();
}

function retainGeneratedSolidRefs(keys) {
  if (!keys || !worldState.generatedSolidRefs) return;
  for (const key of keys) {
    solidBlocks.add(key);
    worldState.generatedSolidRefs.set(key, (worldState.generatedSolidRefs.get(key) ?? 0) + 1);
  }
}

function updateChunkChainViewportSync() {
  if (!isNicechunkChainFeatureEnabled()) return;
  if (chunkChainViewportLoading) return;
  if (isMiningInteractionActive()) return;
  const centerChunkX = Math.floor(player.position.x / chunkSize);
  const centerChunkZ = Math.floor(player.position.z / chunkSize);
  const centerKey = chunkKey(centerChunkX, centerChunkZ);
  const centerUnchanged = centerKey === chunkChainViewportCenterKey;

  const now = performance.now();
  if (centerUnchanged && now - chunkChainViewportLastScanAt < chunkChainViewportRescanMs) return;
  chunkChainViewportLastScanAt = now;

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
        else markLoadedChunkForMinimap(chunk);
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
      if (pendingMinedBlocks.delete(key)) changed = true;
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
      if (pendingMinedBlocks.delete(key)) changed = true;
      removedBlocks.delete(key);
      blockDamage.delete(key);
      placedBlocks.set(key, renderType);
      solidBlocks.add(key);
    }
  }
  if (changed) invalidateWorldQueryCache();
  return changed;
}

function updateRealtimeChunkSubscription() {
  if (realtimeChunkSubscription) realtimeChunkSubscription();
  realtimeChunkSubscription = null;
  realtimeChunkKey = null;
  realtimeChunkAppliedSequence = 0;
}

function markLoadedChunkForMinimap({ key = "", chunkX, chunkZ, refresh = false } = {}) {
  const resolvedKey = key || chunkKey(chunkX, chunkZ);
  if ((!Number.isFinite(chunkX) || !Number.isFinite(chunkZ)) && resolvedKey) {
    [chunkX, chunkZ] = resolvedKey.split(",").map(Number);
  }
  if (!Number.isFinite(chunkX) || !Number.isFinite(chunkZ)) return;
  if (refresh) refreshKnownChunkByKey(resolvedKey);
  else ensureKnownChunk(chunkX, chunkZ);
  minimapState.lastDrawAt = 0;
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
  const data = { chunkX, chunkZ, tile, context, pixels: "" };
  refreshKnownChunkData(data);
  return data;
}

function createKnownChunkDataFromStorage(chunkX, chunkZ, pixels) {
  const tile = document.createElement("canvas");
  tile.width = chunkSize;
  tile.height = chunkSize;
  const context = tile.getContext("2d", { willReadFrequently: true });
  const data = { chunkX, chunkZ, tile, context, pixels };
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
  const aboveSurfaceByColumn = createMinimapAboveSurfaceColumnMap(data.chunkX, data.chunkZ);
  for (let localZ = 0; localZ < chunkSize; localZ++) {
    for (let localX = 0; localX < chunkSize; localX++) {
      const x = data.chunkX * chunkSize + localX;
      const z = data.chunkZ * chunkSize + localZ;
      const color = minimapCellColor(x, z, aboveSurfaceByColumn);
      const offset = (localZ * chunkSize + localX) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  data.context.putImageData(image, 0, 0);
  data.pixels = imageDataToHex(image);
  markKnownMapDirty();
}

function markKnownMapDirty() {
  minimapSaveState.dirty = true;
}

function worldMapSignature(seed) {
  return [
    String(seed || defaultWorldSeed),
    chunkSize,
    minBuildY,
    maxBuildY,
    maxTerrainHeight,
    seaLevel,
  ].join(":");
}

function setActiveWorldMapSignature(seed) {
  const nextSignature = worldMapSignature(seed);
  if (nextSignature === activeWorldMapSignature) return;
  activeWorldMapSignature = nextSignature;
  knownChunks.clear();
  knownChunkRestoreState.pending = [];
  knownChunkRestoreState.loading = false;
  minimapState.lastDrawAt = 0;
  minimapSaveState.dirty = true;
  try {
    localStorage.removeItem(minimapStorageKey);
  } catch {
    // The map can still be rebuilt from generated chunks when storage is unavailable.
  }
}

function scheduleKnownChunkRestore() {
  window.setTimeout(queueKnownChunkRestore, 0);
}

function queueKnownChunkRestore() {
  try {
    const raw = localStorage.getItem(minimapStorageKey);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (!stored || stored.version !== minimapStorageVersion || stored.worldSignature !== activeWorldMapSignature || !stored.chunks) {
      localStorage.removeItem(minimapStorageKey);
      return;
    }

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
        pixels: data.pixels || imageDataToHex(data.context.getImageData(0, 0, chunkSize, chunkSize)),
      };
    }
    localStorage.setItem(
      minimapStorageKey,
      JSON.stringify({
        version: minimapStorageVersion,
        worldSignature: activeWorldMapSignature,
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

function createMinimapAboveSurfaceColumnMap(chunkX, chunkZ) {
  const minX = chunkX * chunkSize;
  const minZ = chunkZ * chunkSize;
  const blocks = canonicalAboveSurfaceBlocksInArea({
    minX,
    maxX: minX + chunkSize - 1,
    minZ,
    maxZ: minZ + chunkSize - 1,
  });
  const byColumn = new Map();
  for (const block of blocks) {
    let byZ = byColumn.get(block.x);
    if (!byZ) {
      byZ = new Map();
      byColumn.set(block.x, byZ);
    }
    if (!byZ.has(block.z)) byZ.set(block.z, []);
    byZ.get(block.z).push(block);
  }
  return byColumn;
}

function minimapCellColor(x, z, aboveSurfaceByColumn = null) {
  const surfaceY = canonicalSurfaceHeightAt({ x, z });
  const waterLevel = canonicalWaterLevelAt({ x, z, surface: surfaceY });
  let topY = surfaceY;
  let topType = canonicalRenderTypeAt({ x, y: topY, z }) ?? WorldMapBlock.Grass;
  if (waterLevel !== null && waterLevel > topY) {
    topY = waterLevel;
    topType = "water";
  }

  const canonicalSurfaceKey = blockKey(x, surfaceY, z);
  if (removedBlocks.has(canonicalSurfaceKey)) {
    const fallback = highestCanonicalVisibleBlockBelow(x, surfaceY - 1, z);
    topY = fallback.y;
    topType = fallback.type;
  }

  const aboveSurface = highestMinimapAboveSurfaceBlock(aboveSurfaceByColumn, x, z, topY);
  if (aboveSurface) {
    topY = aboveSurface.y;
    topType = aboveSurface.type;
  }

  for (const [key, type] of placedBlocks) {
    if (removedBlocks.has(key)) continue;
    const [px, py, pz] = key.split(",").map(Number);
    if (px === x && pz === z && py >= topY) {
      topY = py;
      topType = type;
    }
  }

  for (const key of worldState.dynamicWater) {
    if (removedBlocks.has(key)) continue;
    const [wx, wy, wz] = key.split(",").map(Number);
    if (wx === x && wz === z && wy >= topY) {
      topY = wy;
      topType = "water";
    }
  }

  return minimapColorForType(topType, topY);
}

function highestMinimapAboveSurfaceBlock(aboveSurfaceByColumn, x, z, topY) {
  const blocks = aboveSurfaceByColumn?.get(x)?.get(z);
  if (!blocks?.length) return null;
  let best = null;
  for (const block of blocks) {
    if (!block?.type || block.y < topY) continue;
    const key = blockKey(block.x, block.y, block.z);
    if (removedBlocks.has(key)) continue;
    if (placedBlocks.has(key) && !removedBlocks.has(key)) continue;
    if (!best || block.y > best.y) best = block;
  }
  return best;
}

function highestCanonicalVisibleBlockBelow(x, startY, z) {
  for (let y = startY; y >= minBuildY; y--) {
    const key = blockKey(x, y, z);
    if (removedBlocks.has(key)) continue;
    const type = canonicalRenderTypeAt({ x, y, z });
    if (type) return { y, type };
  }
  return { y: minBuildY, type: WorldMapBlock.Bedrock };
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
    pineTrunk: [90, 58, 37],
    deadWood: [74, 58, 42],
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
  markMiningInteraction();
  if (targetBlock) player.selectedBlock = targetBlock;
  if (!player.selectedBlock || !isBlockInMiningArea(player.selectedBlock)) return false;
  if (isUnbreakableBlock(player.selectedBlock)) return false;
  if (pendingMinedBlocks.has(player.selectedBlock.key)) return false;
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
  player.miningPreviousToolBoxCount = 0;
  player.miningToolSlot = selectedHotbarSlot;
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
  markMiningInteraction();
  if (pendingMinedBlocks.has(hit.block.key)) return false;
  sendGuardianDig(hit.block, 1);
  consumeToolDurabilityAtSlot(player.miningToolSlot);
  const miningPlan = createMiningPlanForBlock(hit.block);
  const nextDamage = (blockDamage.get(hit.block.key) ?? 0) + 1;
  const requiredDamage = debugMiningEnabled ? 1 : miningPlan.requiredDamage;
  blockDamage.set(hit.block.key, nextDamage);
  player.miningContact = createMiningContact(hit);
  spawnHitParticles(hit.block, hit.point, hit.normal, nextDamage);

  if (nextDamage >= requiredDamage) {
    const minedBlocks = miningPlan.blocks;
    if (!markMinedBlocksPending(minedBlocks)) return false;
    player.miningContact = null;
    crackMarker.visible = false;
    spawnBreakParticles(hit.block);
    rebuildChunksAroundBlocks(minedBlocks);
    submitMinedBlockToChain(hit.block, miningPlan);
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

function markMiningInteraction() {
  lastMiningInteractionAt = performance.now();
}

function isMiningInteractionActive() {
  const now = performance.now();
  return player.miningSwing > now || now - lastMiningInteractionAt < miningChainQuietWindowMs;
}

function updateMiningToolCollision() {
  const now = performance.now();
  const remaining = Math.max(0, player.miningSwing - now);
  if (remaining <= 0) {
    player.miningPreviousToolBoxes = null;
    player.miningPreviousToolBoxCount = 0;
    player.miningTargetHit = null;
    player.miningToolSlot = null;
    return;
  }
  if (player.miningHitDone || !player.selectedBlock) return;
  if (isMiningBlockedByWater(player.selectedBlock) || isUnbreakableBlock(player.selectedBlock)) return;
  if (removedBlocks.has(player.selectedBlock.key) || pendingMinedBlocks.has(player.selectedBlock.key) || !isSolidCell(player.selectedBlock.x, player.selectedBlock.y, player.selectedBlock.z)) return;

  const progress = 1 - remaining / miningSwingDuration;
  if (progress < miningCollisionStartProgress) {
    player.miningPreviousToolBoxes = null;
    player.miningPreviousToolBoxCount = 0;
    return;
  }

  avatar.updateMatrixWorld(true);
  const boxes = miningToolCollisionBoxes();
  if (!boxes.length) {
    player.miningPreviousToolBoxes = null;
    player.miningPreviousToolBoxCount = 0;
    return;
  }

  const previousBoxes = player.miningPreviousToolBoxes;
  const previousBoxCount = player.miningPreviousToolBoxCount;
  const blockBox = blockCollisionBox(player.selectedBlock, miningBlockCollisionPadding, miningToolBlockBox);
  for (let index = 0; index < boxes.length; index++) {
    const sweptBox = miningToolSweptBox.copy(boxes[index]);
    if (previousBoxes?.[index] && index < previousBoxCount) sweptBox.union(previousBoxes[index]);
    if (!sweptBox.intersectsBox(blockBox)) continue;
    player.miningHitDone = true;
    player.miningPreviousToolBoxes = null;
    player.miningPreviousToolBoxCount = 0;
    applyMiningDamage(createToolCollisionMiningHit(player.selectedBlock, sweptBox));
    player.miningToolSlot = null;
    return;
  }
  storeMiningPreviousToolBoxes(boxes);
}

function miningToolCollisionBoxes() {
  miningToolCurrentBoxes.length = 0;
  const item = heldItem();
  if (item.hand === "forged" && equippedForgedMesh?.visible) {
    const box = objectWorldBox(equippedForgedMesh, miningToolCurrentBoxPool[0]);
    if (box) miningToolCurrentBoxes.push(box);
    return miningToolCurrentBoxes;
  }

  const { rightTool } = avatar.userData.limbs;
  if (item.hand !== "pickaxe" || !rightTool?.visible) return [];
  const toolParts = ["toolHead", "toolTipTop", "toolTipBottom"];
  for (let index = 0; index < toolParts.length; index++) {
    const box = objectWorldBox(rightTool.getObjectByName(toolParts[index]), miningToolCurrentBoxPool[index]);
    if (box) miningToolCurrentBoxes.push(box);
  }
  return miningToolCurrentBoxes;
}

function storeMiningPreviousToolBoxes(boxes) {
  const previous = player.miningPreviousToolBoxes ?? miningToolPreviousBoxPool;
  for (let index = 0; index < boxes.length; index++) previous[index].copy(boxes[index]);
  player.miningPreviousToolBoxes = previous;
  player.miningPreviousToolBoxCount = boxes.length;
}

function objectWorldBox(object, target = new THREE.Box3()) {
  if (!object) return null;
  if (object.isMesh && object.geometry) {
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const localBox = object.geometry.boundingBox;
    if (!localBox || localBox.isEmpty()) return null;
    target.copy(localBox).applyMatrix4(object.matrixWorld);
  } else {
    target.setFromObject(object);
  }
  return target.isEmpty() ? null : target;
}

function blockCollisionBox(block, padding = 0, target = new THREE.Box3()) {
  return target.set(
    miningReachScratchCenter.set(block.x - 0.5 - padding, block.y - 0.5 - padding, block.z - 0.5 - padding),
    miningReachScratchCorner.set(block.x + 0.5 + padding, block.y + 0.5 + padding, block.z + 0.5 + padding),
  );
}

function createToolCollisionMiningHit(block, toolBox) {
  const targetHit = player.miningTargetHit?.block?.key === block.key ? player.miningTargetHit : createMiningHitFromSelectedBlock(block);
  const point = clampPointToBox(toolBox.getCenter(miningToolHitCenter), blockCollisionBox(block, 0, miningToolBlockBox));
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

function createMiningPlanForBlock(block) {
  const treeBlocks = collectTreeFellBlocksForMining(block);
  if (treeBlocks.length) {
    return {
      blocks: treeBlocks,
      collapseBlocks: [],
      rewardBlocks: [],
      requiredDamage: Math.max(1, treeBlocks.length),
    };
  }
  const collapseBlocks = collectSupportCollapseBlocksAfterMining(block);
  return {
    blocks: [block, ...collapseBlocks],
    collapseBlocks,
    rewardBlocks: selectSupportCollapseRewardBlocks(collapseBlocks),
    requiredDamage: 3,
  };
}

function collectSupportCollapseBlocksAfterMining(originBlock) {
  if (!originBlock?.key) return [];
  const plannedRemoved = new Set([originBlock.key]);
  const collapsed = [];
  const bounds = supportCollapseBounds(originBlock);
  let changed = true;
  while (changed && collapsed.length < supportCollapseMaxBlocks) {
    changed = false;
    const starts = supportCollapseCandidateStarts(plannedRemoved, bounds);
    const scanned = new Set();
    for (const start of starts) {
      if (scanned.has(start.key) || plannedRemoved.has(start.key)) continue;
      const component = traceSupportComponent(start, plannedRemoved, bounds, scanned);
      if (!component.length || component.supported) continue;
      for (const block of component.blocks) {
        if (plannedRemoved.has(block.key)) continue;
        plannedRemoved.add(block.key);
        collapsed.push(block);
        changed = true;
        if (collapsed.length >= supportCollapseMaxBlocks) break;
      }
      if (collapsed.length >= supportCollapseMaxBlocks) break;
    }
    if (collapsed.length < supportCollapseMaxBlocks) {
      const isolatedBlocks = collectIsolatedSupportCollapseBlocks(plannedRemoved, bounds, supportCollapseMaxBlocks - collapsed.length);
      for (const block of isolatedBlocks) {
        if (plannedRemoved.has(block.key)) continue;
        plannedRemoved.add(block.key);
        collapsed.push(block);
        changed = true;
        if (collapsed.length >= supportCollapseMaxBlocks) break;
      }
    }
  }
  return collapsed;
}

function supportCollapseBounds(originBlock) {
  return {
    minX: originBlock.x - supportCollapseHorizontalRadius,
    maxX: originBlock.x + supportCollapseHorizontalRadius,
    minY: originBlock.y - supportCollapseDownReach,
    maxY: originBlock.y + supportCollapseUpReach,
    minZ: originBlock.z - supportCollapseHorizontalRadius,
    maxZ: originBlock.z + supportCollapseHorizontalRadius,
  };
}

function supportCollapseCandidateStarts(plannedRemoved, bounds) {
  const starts = [];
  const seen = new Set();
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const block = supportCollapseBlockAt(x, y, z, plannedRemoved, bounds);
        if (!block || seen.has(block.key)) continue;
        seen.add(block.key);
        starts.push(block);
      }
    }
  }
  return starts;
}

const supportFaceOffsets = Object.freeze([
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]);

function traceSupportComponent(start, plannedRemoved, bounds, scanned) {
  const queue = [start];
  const blocks = [];
  const local = new Set([start.key]);
  let supported = false;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const block = queue[cursor];
    scanned.add(block.key);
    blocks.push(block);
    if (isSupportAnchoredBlock(block)) supported = true;
    for (const [dx, dy, dz] of supportFaceOffsets) {
      const nx = block.x + dx;
      const ny = block.y + dy;
      const nz = block.z + dz;
      if (!isWithinSupportCollapseBounds(nx, ny, nz, bounds)) {
        supported = true;
        continue;
      }
      const next = supportCollapseBlockAt(nx, ny, nz, plannedRemoved, bounds);
      if (!next) {
        if (isSupportAnchorCell(nx, ny, nz, plannedRemoved)) supported = true;
        continue;
      }
      if (local.has(next.key)) continue;
      local.add(next.key);
      queue.push(next);
    }
  }
  return { blocks, supported };
}

function supportCollapseBlockAt(x, y, z, plannedRemoved, bounds) {
  if (!isWithinSupportCollapseBounds(x, y, z, bounds)) return null;
  const key = blockKey(x, y, z);
  if (plannedRemoved.has(key) || removedBlocks.has(key) || pendingMinedBlocks.has(key)) return null;
  const type = supportCollapseTypeAt(x, y, z, key);
  if (!type || isNonMiningSupportType(type)) return null;
  if (!isAuthoritativeSolidCell(x, y, z)) return null;
  return { x, y, z, type, key };
}

function isSupportAnchorCell(x, y, z, plannedRemoved) {
  const key = blockKey(x, y, z);
  if (plannedRemoved.has(key) || removedBlocks.has(key) || pendingMinedBlocks.has(key)) return false;
  const type = supportCollapseTypeAt(x, y, z, key);
  return type === "bedrock";
}

function collectIsolatedSupportCollapseBlocks(plannedRemoved, bounds, limit) {
  const isolated = [];
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        if (isolated.length >= limit) return isolated;
        const block = supportCollapseBlockAt(x, y, z, plannedRemoved, bounds);
        if (!block || hasSupportFaceConnection(block, plannedRemoved)) continue;
        isolated.push(block);
      }
    }
  }
  return isolated;
}

function hasSupportFaceConnection(block, plannedRemoved) {
  for (const [dx, dy, dz] of supportFaceOffsets) {
    const x = block.x + dx;
    const y = block.y + dy;
    const z = block.z + dz;
    const key = blockKey(x, y, z);
    if (plannedRemoved.has(key) || removedBlocks.has(key) || pendingMinedBlocks.has(key)) continue;
    if (isAuthoritativeSolidCell(x, y, z)) return true;
  }
  return false;
}

function supportCollapseTypeAt(x, y, z, key = blockKey(x, y, z)) {
  return placedBlocks.get(key) || canonicalRenderTypeAt({ x, y, z });
}

function isWithinSupportCollapseBounds(x, y, z, bounds) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY &&
    z >= bounds.minZ &&
    z <= bounds.maxZ
  );
}

function isSupportAnchoredBlock(block) {
  if (block.y <= minBuildY) return true;
  return false;
}

function isTreeBlockType(type) {
  return type === "trunk" || type === "trunkDark" || type === "pineTrunk" || type === "leaves" || type === "leavesDark" || type === "leavesLight" || type === "leavesTeal" || type === "leavesWarm" || type === "pineLeaves" || type === "snowLeaves";
}

function isNonMiningSupportType(type) {
  return type === "water" || type === "swampWater" || type === "toxicWater" || type === "lava" || type === "bedrock";
}

function selectSupportCollapseRewardBlocks(blocks) {
  const normalized = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!normalized.length) return [];
  if (normalized.length === 1) return normalized;
  const count = Math.max(1, Math.floor(normalized.length * 0.3));
  return [...normalized]
    .sort((a, b) => supportCollapseRewardScore(a) - supportCollapseRewardScore(b))
    .slice(0, count);
}

function supportCollapseRewardScore(block) {
  const x = Math.imul((Number(block.x) | 0) ^ 0x45d9f3b, 0x27d4eb2d);
  const y = Math.imul((Number(block.y) | 0) ^ 0x165667b1, 0x85ebca6b);
  const z = Math.imul((Number(block.z) | 0) ^ 0x9e3779b9, 0xc2b2ae35);
  return (x ^ y ^ z) >>> 0;
}

function collectTreeFellBlocksForMining(block) {
  const canonicalType = canonicalRenderTypeAt({ x: block?.x, y: block?.y, z: block?.z });
  const type = canonicalType ?? block?.type;
  if (type !== "trunk" && type !== "pineTrunk") return [];
  const candidates = canonicalTreeFellBlocks(block)
    .map((treeBlock) => ({
      ...treeBlock,
      key: treeBlock.key ?? blockKey(treeBlock.x, treeBlock.y, treeBlock.z),
    }))
    .filter((treeBlock) => {
      if (!treeBlock?.key || removedBlocks.has(treeBlock.key) || pendingMinedBlocks.has(treeBlock.key)) return false;
      if (placedBlocks.has(treeBlock.key)) return false;
      return true;
    });
  return connectedUpperTreeBlocksFrom(block, candidates);
}

function connectedUpperTreeBlocksFrom(originBlock, candidates) {
  if (!originBlock?.key || !Array.isArray(candidates) || !candidates.length) return [];
  const originY = Math.trunc(Number(originBlock.y) || 0);
  const byKey = new Map(candidates
    .filter((block) => Number.isFinite(block?.x) && Number.isFinite(block?.y) && Number.isFinite(block?.z) && block.y >= originY)
    .map((block) => [block.key ?? blockKey(block.x, block.y, block.z), block]));
  const originKey = originBlock.key ?? blockKey(originBlock.x, originBlock.y, originBlock.z);
  if (!byKey.has(originKey)) return [];

  const visited = new Set([originKey]);
  const queue = [originKey];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = byKey.get(queue[cursor]);
    if (!current) continue;
    for (let dy = 0; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const nextKey = blockKey(current.x + dx, current.y + dy, current.z + dz);
          if (visited.has(nextKey) || !byKey.has(nextKey)) continue;
          visited.add(nextKey);
          queue.push(nextKey);
        }
      }
    }
  }
  return candidates.filter((block) => visited.has(block.key ?? blockKey(block.x, block.y, block.z)));
}

function isTreeFellMiningBatch(originBlock, minedBlocks) {
  if (!Array.isArray(minedBlocks) || minedBlocks.length <= 1) return false;
  const canonicalType = canonicalRenderTypeAt({ x: originBlock?.x, y: originBlock?.y, z: originBlock?.z });
  const type = canonicalType ?? originBlock?.type;
  return type === "trunk" || type === "pineTrunk";
}

function markMinedBlockPending(block) {
  if (!block?.key || removedBlocks.has(block.key)) return false;
  pendingMinedBlocks.set(block.key, {
    block: { x: block.x, y: block.y, z: block.z, type: block.type, key: block.key },
    startedAt: performance.now(),
  });
  blockDamage.delete(block.key);
  markWorldEditsChanged();
  return true;
}

function markMinedBlocksPending(blocks) {
  const normalized = Array.isArray(blocks) && blocks.length ? blocks : [];
  if (!normalized.length) return false;
  const marked = [];
  for (const block of normalized) {
    if (!markMinedBlockPending(block)) {
      marked.forEach((markedBlock) => restorePendingMinedBlock(markedBlock));
      recoverPlayerAfterSolidMutation(marked);
      return false;
    }
    marked.push(block);
  }
  return true;
}

function finalizePendingMinedBlock(block) {
  if (!block?.key) return false;
  pendingMinedBlocks.delete(block.key);
  blockDamage.delete(block.key);
  removedBlocks.add(block.key);
  solidBlocks.delete(block.key);
  invalidateWorldQueryCache();
  rebuildChunksAroundBlock(block);
  flowWaterFromBreak(block);
  sendGuardianDig(block, 3);
  return true;
}

function finalizePendingMinedBlocks(blocks) {
  const normalized = Array.isArray(blocks) && blocks.length ? blocks : [];
  let changed = false;
  for (const block of normalized) {
    if (finalizePendingMinedBlock(block)) changed = true;
  }
  return changed;
}

function restorePendingMinedBlock(block) {
  if (!block?.key || !pendingMinedBlocks.has(block.key)) return false;
  pendingMinedBlocks.delete(block.key);
  blockDamage.delete(block.key);
  solidBlocks.add(block.key);
  invalidateWorldQueryCache();
  rebuildChunksAroundBlock(block);
  return true;
}

function restorePendingMinedBlocks(blocks) {
  const normalized = Array.isArray(blocks) && blocks.length ? blocks : [];
  let changed = false;
  for (const block of normalized) {
    if (restorePendingMinedBlock(block)) changed = true;
  }
  if (changed) recoverPlayerAfterSolidMutation(normalized);
  return changed;
}

function rebuildChunksAroundBlocks(blocks) {
  const normalized = Array.isArray(blocks) && blocks.length ? blocks : [];
  const rebuilt = new Set();
  for (const block of normalized) {
    const key = `${Math.floor(block.x / chunkSize)},${Math.floor(block.z / chunkSize)},${block.y}`;
    if (rebuilt.has(key)) continue;
    rebuilt.add(key);
    rebuildChunksAroundBlock(block);
  }
}

function submitMinedBlockToChain(block, miningPlanOrBlocks = [block]) {
  const pendingBlocks = Array.isArray(miningPlanOrBlocks)
    ? (miningPlanOrBlocks.length ? miningPlanOrBlocks : [block])
    : (Array.isArray(miningPlanOrBlocks?.blocks) && miningPlanOrBlocks.blocks.length ? miningPlanOrBlocks.blocks : [block]);
  const collapseBlocks = Array.isArray(miningPlanOrBlocks?.collapseBlocks) ? miningPlanOrBlocks.collapseBlocks : [];
  const collapseRewardBlocks = Array.isArray(miningPlanOrBlocks?.rewardBlocks) ? miningPlanOrBlocks.rewardBlocks : [];
  const useTreeFell = isTreeFellMiningBatch(block, pendingBlocks);
  const useSupportCollapse = !useTreeFell && collapseBlocks.length > 0;
  const coords = formatBlockCoords(block);
  const pendingLogBlock = normalizedMinedLogBlock(block);
  const pendingResource = minedResourceNameForBlock(pendingLogBlock);
  if (!isNicechunkChainFeatureEnabled()) {
    finalizePendingMinedBlocks(pendingBlocks);
    const row = appendChainEventLog("warn", gameText("main.chainLog.mineSkipped", "Mining sync skipped"), gameText("main.chainLog.disabled", "On-chain sync is disabled for {resource} at {coords}", { coords, resource: pendingResource }), { block: pendingLogBlock });
    scheduleChainEventLogRemoval(row);
    return;
  }
  let logEntry = null;
  loadNicechunkChainModule().then(async (chainModule) => {
    const ready = await ensureGameplaySessionFundingForMining(chainModule);
    if (!ready) return { submitted: false, reason: "session-funding-cancelled" };
    logEntry = appendChainEventLog("info", gameText("main.chainLog.minePending", "Mining submitted, awaiting confirmation"), gameText("main.chainLog.minePendingDetail", "Submitting {resource} at {coords} to devnet", { coords, resource: pendingResource }), { block: pendingLogBlock });
    const options = {
      backpackAddress: equippedBackpackStatus?.backpack?.publicKey ?? null,
      backpackItemCount: equippedBackpackStatus?.backpack?.itemCount ?? null,
      backpackCapacity: equippedBackpackStatus?.backpack?.capacity ?? null,
    };
    if (useTreeFell) return chainModule.recordTreeFellOnChain(block, selectedHotbarSlot, options);
    if (useSupportCollapse && typeof chainModule.recordSupportCollapseOnChain === "function") {
      return chainModule.recordSupportCollapseOnChain(block, {
        collapseBlocks,
        rewardBlocks: collapseRewardBlocks,
        toolSlot: selectedHotbarSlot,
        ...options,
      });
    }
    return chainModule.recordBlockBreakOnChain(block, selectedHotbarSlot, options);
  }).then((result) => {
    const resultLogBlock = normalizedMinedLogBlock(result?.block ?? pendingLogBlock);
    const resource = minedResourceNameForBlock(resultLogBlock);
    if (!result?.submitted) {
      const reason = chainSubmitReasonLabel(result?.reason);
      if (result?.reason === "already-mined") {
        finalizePendingMinedBlocks(pendingBlocks);
        logEntry = updateChainEventLog(logEntry, "warn", gameText("main.chainLog.alreadyMined", "Block already recorded"), gameText("main.chainLog.mineSkippedDetail", "{resource} at {coords}: {reason}", { coords, reason, resource }), { block: resultLogBlock });
        scheduleChainEventLogRemoval(logEntry);
        return;
      }
      restoreMinedBlocksAfterSubmitFailure(pendingBlocks);
      logEntry = updateChainEventLog(logEntry, "warn", gameText("main.chainLog.mineSkipped", "Mining sync skipped"), gameText("main.chainLog.mineSkippedDetail", "{resource} at {coords}: {reason}", { coords, reason, resource }), { block: resultLogBlock });
      scheduleChainEventLogRemoval(logEntry);
      return;
    }
    finalizePendingMinedBlocks(pendingBlocks);
    if (useTreeFell) spawnFallingTreeResourceBlocks(pendingBlocks, block);
    else if (useSupportCollapse) spawnFallingTreeResourceBlocks(collapseBlocks, block);
    updateChainEventLog(logEntry, "success", gameText("main.chainLog.mineSubmitted", "Mining confirmed"), gameText("main.chainLog.signature", "{resource} at {coords}: {signature}", {
      coords,
      resource,
      signature: shortSignature(result.signature),
    }), { block: resultLogBlock });
    animateChainBlockToBackpack(logEntry);
    invalidateProfileChainSkillXp();
    void refreshEquippedBackpack({ force: true });
  }).catch((error) => {
    console.warn("Failed to record block break on NiceChunk chunk PDA", error);
    const kind = isBlockAlreadyMinedError(error) ? "warn" : "error";
    const title = isBlockAlreadyMinedError(error)
      ? gameText("main.chainLog.alreadyMined", "Block already recorded")
      : gameText("main.chainLog.mineFailed", "Mining transaction failed");
    if (isBlockAlreadyMinedError(error)) finalizePendingMinedBlocks(pendingBlocks);
    else restoreMinedBlocksAfterSubmitFailure(pendingBlocks);
    if (!logEntry) {
      const failedLogEntry = appendChainEventLog(kind, title, gameText("main.chainLog.mineFailedDetail", "{resource} at {coords}: {reason}", {
        coords,
        resource: pendingResource,
        reason: readableChainError(error),
      }), { block: pendingLogBlock });
      scheduleChainEventLogRemoval(failedLogEntry);
      return;
    }
    logEntry = updateChainEventLog(logEntry, kind, title, gameText("main.chainLog.mineFailedDetail", "{resource} at {coords}: {reason}", {
      coords,
      resource: pendingResource,
      reason: readableChainError(error),
    }), { block: pendingLogBlock });
    scheduleChainEventLogRemoval(logEntry);
  });
}

function restoreMinedBlocksAfterSubmitFailure(blocks) {
  const normalized = Array.isArray(blocks) && blocks.length ? blocks : [];
  if (restorePendingMinedBlocks(normalized)) return;
  normalized.forEach((block) => restoreMinedBlockAfterSubmitFailure(block));
}

function restoreMinedBlockAfterSubmitFailure(block) {
  if (!block?.key) return;
  if (restorePendingMinedBlock(block)) return;
  if (!removedBlocks.has(block.key)) return;
  removedBlocks.delete(block.key);
  pendingMinedBlocks.delete(block.key);
  blockDamage.delete(block.key);
  clearDynamicWaterNearBlock(block);
  solidBlocks.add(block.key);
  invalidateWorldQueryCache();
  rebuildChunksAroundBlock(block);
  recoverPlayerAfterSolidMutation([block]);
}

function clearDynamicWaterNearBlock(block, radius = 4) {
  if (!block || !worldState.dynamicWater?.size) return;
  const changedChunks = new Set();
  const minY = Math.max(1, block.y - radius);
  const maxY = block.y + 2;
  for (let x = block.x - radius; x <= block.x + radius; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = block.z - radius; z <= block.z + radius; z++) {
        const key = blockKey(x, y, z);
        if (!worldState.dynamicWater.delete(key)) continue;
        changedChunks.add(chunkKey(Math.floor(x / chunkSize), Math.floor(z / chunkSize)));
      }
    }
  }
  if (changedChunks.size) markWorldEditsChanged();
  for (const key of changedChunks) rebuildChunkByKey(key);
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
  size = chainBlockPreviewSize,
  previewDimensionsM = null,
} = {}) {
  const preview = document.createElement("div");
  preview.className = className;
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = canvasClassName;
  previewCanvas.width = size;
  previewCanvas.height = size;
  preview.append(previewCanvas);

  if (!rotating && !immediate) {
    const sharedCanvas = createResourceBlockPreviewCanvas(blockType, {
      className: canvasClassName,
      size,
      previewDimensionsM,
    });
    previewCanvas.replaceWith(sharedCanvas);
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
let chainBlockPreviewFrame = 0;
let chainBlockPreviewRenderer = null;
let chainBlockPreviewCanvas = null;

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

function disposePreviewObject(object) {
  object?.traverse?.((child) => {
    if (child.geometry?.userData?.disposeWithPreview) child.geometry.dispose();
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

function updateChainEventLog(row, kind, title, detail, options = {}) {
  if (!row) {
    return appendChainEventLog(kind, title, detail, options);
  }
  row.dataset.kind = kind;
  if (options.block?.type) {
    row.querySelector(".chain-event-block-preview")?.__nicechunkCleanup?.();
    row.querySelector(".chain-event-block-preview")?.remove();
    row.prepend(createChainEventBlockPreview(options.block.type, { block: options.block }));
  }
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
  if (reason === "session-funding-failed") return gameText("main.chainLog.sessionFundingFailed", "session funding failed");
  if (reason === "no-backpack") return gameText("main.chainLog.noBackpack", "no backpack equipped");
  if (reason === "backpack-full") return gameText("main.chainLog.backpackFull", "backpack full");
  if (reason === "unmineable-block") return gameText("main.chainLog.unmineableBlock", "unmineable block");
  if (reason === "not-tree-trunk") return gameText("main.chainLog.notTreeTrunk", "not a tree trunk");
  if (reason === "invalid-backpack-index") return gameText("main.backpack.invalidIndex", "invalid backpack slot");
  if (reason === "listing-unavailable") return gameText("main.market.listingUnavailable", "listing unavailable");
  if (reason === "self-purchase") return gameText("main.market.selfPurchase", "cannot buy your own listing");
  if (reason === "nck-token-missing") return gameText("main.market.nckTokenMissing", "wallet has no NCK token account");
  return reason || gameText("main.chainLog.unknownReason", "unknown reason");
}

function isBlockAlreadyMinedError(error) {
  const text = `${error?.message ?? ""} ${error?.transactionMessage ?? ""} ${(error?.transactionLogs ?? []).join(" ")} ${(error?.nicechunkLogs ?? []).join(" ")}`;
  return text.includes("0x18b9") || text.includes("already_mined") || text.includes("BlockAlreadyMined");
}

function readableChainError(error) {
  if (isBlockAlreadyMinedError(error)) return gameText("main.chainLog.alreadyMinedReason", "already mined");
  const logs = `${(error?.transactionLogs ?? []).join(" ")} ${(error?.nicechunkLogs ?? []).join(" ")}`;
  if (logs.includes("exceeded CUs meter")) return gameText("main.chainLog.computeExceeded", "transaction compute limit exceeded");
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
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "miningEquipmentReachDebug";
  mesh.visible = false;
  return mesh;
}

function updateMiningDebug() {
  if (!debugMiningEnabled) {
    miningDebug.visible = false;
    return;
  }

  const reach = miningEquipmentReachSphere();
  miningDebug.visible = Boolean(reach);
  if (!reach) return;

  miningDebug.position.copy(reach.center);
  miningDebug.scale.setScalar(reach.radius);
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
  cancelChunkWorkerBuild(key);
  pendingChunkKeys = pendingChunkKeys.filter((pendingKey) => pendingKey !== key);
  pendingPreloadChunkKeys = pendingPreloadChunkKeys.filter((pendingKey) => pendingKey !== key);
  pendingChunkRebuildKeys = pendingChunkRebuildKeys.filter((pendingKey) => pendingKey !== key);
  pendingChunkRefreshKeys = pendingChunkRefreshKeys.filter((pendingKey) => pendingKey !== key);
  if (isChunkInRenderRange(chunkX, chunkZ)) {
    const detailMode = chunkDetailModeForChunk(chunkX, chunkZ);
    const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode, target: "refresh" });
    if (requestState === "defer") {
      pendingChunkRebuildKeys.unshift(key);
    } else if (!requestState) {
      replaceChunkSynchronously(key, chunkX, chunkZ, true, detailMode);
    }
  } else if (isChunkInPreloadRange(chunkX, chunkZ)) {
    const requestState = requestChunkWorkerBuild({ key, chunkX, chunkZ, detailMode: "distant", target: "preload" });
    if (requestState === "defer") {
      pendingChunkRebuildKeys.unshift(key);
    } else if (!requestState) {
      replaceChunkSynchronously(key, chunkX, chunkZ, false, "distant");
    }
  } else {
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
  }
  updateMinimap(true);
}

function cancelChunkWorkerBuild(key) {
  const request = chunkWorkerBuilds.get(key);
  if (request) {
    request.cancelled = true;
    chunkWorkerBuilds.delete(key);
  }
  cancelQueuedChunkCommitsByKey(key);
}

function cancelChunkWorkerBuildsOutside(allowedKeys) {
  for (const [key, request] of chunkWorkerBuilds) {
    if (allowedKeys.has(key)) continue;
    request.cancelled = true;
    chunkWorkerBuilds.delete(key);
  }
  cancelQueuedChunkCommitsOutside(allowedKeys);
}

function cancelQueuedChunkCommitsByKey(key) {
  for (const entry of pendingChunkCommits) {
    if (entry.request?.key === key) entry.request.cancelled = true;
  }
}

function cancelQueuedChunkCommitsOutside(allowedKeys) {
  for (const entry of pendingChunkCommits) {
    const key = entry.request?.key;
    if (key && !allowedKeys.has(key)) entry.request.cancelled = true;
  }
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

function removePlaceholderChunk(key) {
  pendingPlaceholderChunkKeySet.delete(key);
  if (!placeholderChunks.has(key)) return;
  placeholderChunks.delete(key);
  queuePlaceholderMaintenance();
}

function disposeGroup(group) {
  releaseGeneratedSolidRefs(group);
  group.traverse((object) => {
    if (object.geometry?.userData?.chunkOwned) object.geometry.dispose();
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
  if (changedChunks.size) markWorldEditsChanged();
  for (const key of changedChunks) rebuildChunkByKey(key);
}

function spawnFallingTreeResourceBlocks(blocks, originBlock = null) {
  const normalized = Array.isArray(blocks) ? blocks.filter((block) => block?.key) : [];
  if (!normalized.length) return;
  const origin = originBlock
    ? new THREE.Vector3(originBlock.x, originBlock.y, originBlock.z)
    : new THREE.Vector3(normalized[0].x, normalized[0].y, normalized[0].z);
  for (const block of normalized) {
    while (fallingTreeResourceBlocks.length >= maxFallingTreeResourceBlocks) {
      const oldest = fallingTreeResourceBlocks.shift();
      if (oldest) removeFallingTreeResourceFromPool(oldest);
    }
    const type = block.type ?? canonicalRenderTypeAt({ x: block.x, y: block.y, z: block.z }) ?? "trunk";
    const position = new THREE.Vector3(
      block.x + (Math.random() - 0.5) * 0.06,
      block.y + (Math.random() - 0.5) * 0.06,
      block.z + (Math.random() - 0.5) * 0.06,
    );
    const outward = position.clone().sub(origin);
    outward.y = 0;
    if (outward.lengthSq() > 0.001) outward.normalize();
    const resourceBlock = {
      type,
      pool: null,
      poolIndex: -1,
      position,
      velocity: new THREE.Vector3(
        outward.x * (0.65 + Math.random() * 0.55) + (Math.random() - 0.5) * 0.35,
        0.35 + Math.random() * 1.25,
        outward.z * (0.65 + Math.random() * 0.55) + (Math.random() - 0.5) * 0.35,
      ),
      rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
      angularVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 5.5,
        (Math.random() - 0.5) * 5.5,
        (Math.random() - 0.5) * 5.5,
      ),
      baseScale: type.includes("leaves") || type.includes("Leaves") ? 0.86 : 0.96,
      scale: 1,
      life: fallingTreeResourceLifetime + Math.random() * 0.55,
      restY: fallingTreeResourceRestY(block),
      bounces: 0,
      settledFor: 0,
    };
    resourceBlock.scale = resourceBlock.baseScale;
    addFallingTreeResourceToPool(resourceBlock);
    fallingTreeResourceBlocks.push(resourceBlock);
  }
}

function fallingTreeResourceRestY(block) {
  const x = Math.round(block.x);
  const z = Math.round(block.z);
  return surfaceHeight(x, z) + 1;
}

function updateFallingTreeResourceBlocks(dt) {
  for (let i = fallingTreeResourceBlocks.length - 1; i >= 0; i--) {
    const block = fallingTreeResourceBlocks[i];
    block.life -= dt;
    block.velocity.y -= gravity * 0.92 * dt;
    block.position.addScaledVector(block.velocity, dt);
    block.rotation.x += block.angularVelocity.x * dt;
    block.rotation.y += block.angularVelocity.y * dt;
    block.rotation.z += block.angularVelocity.z * dt;

    if (block.position.y <= block.restY) {
      block.position.y = block.restY;
      if (Math.abs(block.velocity.y) > 1.05 && block.bounces < 3) {
        const bounce = 0.36 - block.bounces * 0.07;
        block.velocity.y = Math.abs(block.velocity.y) * bounce;
        block.velocity.x *= 0.62;
        block.velocity.z *= 0.62;
        block.angularVelocity.multiplyScalar(0.72);
        block.bounces += 1;
      } else {
        block.velocity.set(0, 0, 0);
        block.angularVelocity.multiplyScalar(0.5);
        block.settledFor += dt;
      }
    }

    if (block.settledFor > 0) {
      const shrink = THREE.MathUtils.clamp((block.settledFor - 0.22) / 0.85, 0, 1);
      block.scale = block.baseScale * (1 - shrink);
    } else if (block.life < 0.7) {
      block.scale = block.baseScale * THREE.MathUtils.clamp(block.life / 0.7, 0, 1);
    }

    if (block.life <= 0 || block.scale <= 0.025) {
      markFallingTreeResourcePoolDirty(block.pool);
      removeFallingTreeResourceFromPool(block);
      fallingTreeResourceBlocks.splice(i, 1);
      continue;
    }
    markFallingTreeResourcePoolDirty(block.pool);
  }
  flushDirtyFallingTreeResourcePools();
}

function fallingTreeResourcePool(type) {
  const key = materials[type] ? type : "trunk";
  let pool = fallingTreeResourcePools.get(key);
  if (pool) return pool;
  const mesh = new THREE.InstancedMesh(cubeGeometry, materials[key] ?? materials.trunk ?? materials.dirt, maxFallingTreeResourceBlocks);
  mesh.name = `falling-tree-resources:${key}`;
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  pool = { key, mesh, blocks: [] };
  fallingTreeResourcePools.set(key, pool);
  scene.add(mesh);
  return pool;
}

function addFallingTreeResourceToPool(block) {
  const pool = fallingTreeResourcePool(block.type);
  block.pool = pool;
  block.poolIndex = pool.blocks.length;
  pool.blocks.push(block);
  pool.mesh.count = pool.blocks.length;
  markFallingTreeResourcePoolDirty(pool);
}

function removeFallingTreeResourceFromPool(block) {
  const pool = block?.pool;
  if (!pool) return;
  const index = block.poolIndex;
  if (index < 0 || index >= pool.blocks.length) return;
  const lastIndex = pool.blocks.length - 1;
  const last = pool.blocks[lastIndex];
  if (index !== lastIndex) {
    pool.blocks[index] = last;
    last.poolIndex = index;
  }
  pool.blocks.pop();
  pool.mesh.count = pool.blocks.length;
  pool.mesh.instanceMatrix.needsUpdate = true;
  block.pool = null;
  block.poolIndex = -1;
  markFallingTreeResourcePoolDirty(pool);
}

function markFallingTreeResourcePoolDirty(pool) {
  if (pool) dirtyFallingTreeResourcePools.add(pool);
}

function flushDirtyFallingTreeResourcePools() {
  if (!dirtyFallingTreeResourcePools.size) return;
  for (const pool of dirtyFallingTreeResourcePools) updateFallingTreeResourcePool(pool);
  dirtyFallingTreeResourcePools.clear();
}

function updateFallingTreeResourcePool(pool) {
  if (!pool) return;
  for (let index = 0; index < pool.blocks.length; index++) {
    const block = pool.blocks[index];
    fallingTreeResourceTransform.position.copy(block.position);
    fallingTreeResourceTransform.rotation.copy(block.rotation);
    fallingTreeResourceTransform.scale.setScalar(Math.max(0.01, block.scale));
    fallingTreeResourceTransform.updateMatrix();
    pool.mesh.setMatrixAt(index, fallingTreeResourceTransform.matrix);
  }
  pool.mesh.count = pool.blocks.length;
  pool.mesh.instanceMatrix.needsUpdate = true;
}

function spawnHitParticles(block, point, normal, damage) {
  const count = breakParticleCount(damage >= 3 ? 16 : 9);
  for (let i = 0; i < count; i++) {
    const particle = createBreakParticle(block.type, point.x, point.y, point.z);
    particle.position.copy(point).addScaledVector(normal, 0.06);
    particle.velocity = normal
      .clone()
      .multiplyScalar(3 + Math.random() * 3)
      .add(new THREE.Vector3((Math.random() - 0.5) * 2.8, Math.random() * 2.2, (Math.random() - 0.5) * 2.8));
    particle.life = 0.42 + Math.random() * 0.22;
    addBreakParticle(particle);
  }
}

function spawnBreakParticles(block) {
  const center = new THREE.Vector3(block.x, block.y, block.z);
  const count = breakParticleCount(18);
  for (let i = 0; i < count; i++) {
    const particle = createBreakParticle(block.type, center.x, center.y, center.z);
    particle.position.copy(center).add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
    particle.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      2 + Math.random() * 4,
      (Math.random() - 0.5) * 5,
    );
    particle.life = 0.55 + Math.random() * 0.35;
    addBreakParticle(particle);
  }
}

function createBreakParticle(type, x = 0, y = 0, z = 0) {
  const size = 0.1 + Math.random() * 0.12;
  return {
    type,
    pool: null,
    poolIndex: -1,
    position: new THREE.Vector3(x, y, z),
    velocity: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: size,
    life: 0,
  };
}

function breakParticleCount(baseCount) {
  return lowPowerChunkLoading ? Math.ceil(baseCount * 0.6) : baseCount;
}

function addBreakParticle(particle) {
  while (breakParticles.length >= maxBreakParticles) {
    const oldest = breakParticles.shift();
    if (oldest) removeBreakParticleFromPool(oldest);
  }
  addBreakParticleToPool(particle);
  breakParticles.push(particle);
}

function updateBreakParticles(dt) {
  for (let i = breakParticles.length - 1; i >= 0; i--) {
    const particle = breakParticles[i];
    particle.life -= dt;
    particle.velocity.y -= gravity * 0.7 * dt;
    particle.position.addScaledVector(particle.velocity, dt);
    particle.rotation.x += dt * 7;
    particle.rotation.y += dt * 5;
    particle.scale *= 1 - dt * 0.8;
    if (particle.life <= 0) {
      markBreakParticlePoolDirty(particle.pool);
      removeBreakParticleFromPool(particle);
      breakParticles.splice(i, 1);
      continue;
    }
    markBreakParticlePoolDirty(particle.pool);
  }
  flushDirtyBreakParticlePools();
}

function breakParticlePool(type) {
  const key = materials[type] ? type : "dirt";
  let pool = breakParticlePools.get(key);
  if (pool) return pool;
  const mesh = new THREE.InstancedMesh(cubeGeometry, materials[key] ?? materials.dirt, maxBreakParticles);
  mesh.name = `break-particles:${key}`;
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  pool = { key, mesh, particles: [] };
  breakParticlePools.set(key, pool);
  scene.add(mesh);
  return pool;
}

function addBreakParticleToPool(particle) {
  const pool = breakParticlePool(particle.type);
  particle.pool = pool;
  particle.poolIndex = pool.particles.length;
  pool.particles.push(particle);
  pool.mesh.count = pool.particles.length;
  markBreakParticlePoolDirty(pool);
}

function removeBreakParticleFromPool(particle) {
  const pool = particle?.pool;
  if (!pool) return;
  const index = particle.poolIndex;
  if (index < 0 || index >= pool.particles.length) return;
  const lastIndex = pool.particles.length - 1;
  const last = pool.particles[lastIndex];
  if (index !== lastIndex) {
    pool.particles[index] = last;
    last.poolIndex = index;
  }
  pool.particles.pop();
  pool.mesh.count = pool.particles.length;
  pool.mesh.instanceMatrix.needsUpdate = true;
  particle.pool = null;
  particle.poolIndex = -1;
  markBreakParticlePoolDirty(pool);
}

function markBreakParticlePoolDirty(pool) {
  if (pool) dirtyBreakParticlePools.add(pool);
}

function flushDirtyBreakParticlePools() {
  if (!dirtyBreakParticlePools.size) return;
  for (const pool of dirtyBreakParticlePools) updateBreakParticlePool(pool);
  dirtyBreakParticlePools.clear();
}

function updateBreakParticlePool(pool) {
  if (!pool) return;
  for (let index = 0; index < pool.particles.length; index++) {
    const particle = pool.particles[index];
    breakParticleTransform.position.copy(particle.position);
    breakParticleTransform.rotation.copy(particle.rotation);
    breakParticleTransform.scale.setScalar(Math.max(0.01, particle.scale));
    breakParticleTransform.updateMatrix();
    pool.mesh.setMatrixAt(index, breakParticleTransform.matrix);
  }
  pool.mesh.count = pool.particles.length;
  pool.mesh.instanceMatrix.needsUpdate = true;
}

function updateCrackMarker() {
  const contact = player.miningContact;
  if (!contact || !blockDamage.has(contact.block.key)) {
    crackMarker.visible = false;
    return;
  }

  const damage = blockDamage.get(contact.block.key);
  const requiredDamage = debugMiningEnabled ? 1 : createMiningPlanForBlock(contact.block).requiredDamage;
  const progress = THREE.MathUtils.clamp(damage / Math.max(1, requiredDamage), 0, 1);
  crackMarker.visible = true;
  crackMarker.position.set(contact.block.x, contact.block.y, contact.block.z);
  crackMarker.scale.setScalar(0.75 + progress * 0.54);
  crackMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), contact.normal);
}

function isSolidCell(x, y, z) {
  return isAuthoritativeSolidCell(x, y, z);
}

function isAuthoritativeSolidCell(x, y, z) {
  const blockX = Math.trunc(Number(x) || 0);
  const blockY = Math.trunc(Number(y) || 0);
  const blockZ = Math.trunc(Number(z) || 0);
  const key = blockKey(blockX, blockY, blockZ);
  if (removedBlocks.has(key) || pendingMinedBlocks.has(key)) return false;
  if (placedBlocks.has(key)) return true;
  if (worldState.dynamicWater?.has(key)) return false;
  const type = canonicalRenderTypeAt({ x: blockX, y: blockY, z: blockZ });
  return isSolidRenderType(type);
}

function isSolidRenderType(type) {
  return Boolean(type) &&
    type !== "water" &&
    type !== "swampWater" &&
    type !== "toxicWater";
}

function playerGroundHeightAt(x, z, referenceY = player.position.y, options = {}) {
  const stepAllowance = options.allowStepUp ? autoStepHeight : 0.08;
  const maxBlockY = Math.floor(referenceY + stepAllowance - 1.01);
  const minBlockY = Math.max(minBuildY, Math.floor(referenceY - playerGroundProbeDepth - 1.01));
  return playerGroundHeightInBlockRangeAt(x, z, minBlockY, maxBlockY);
}

function playerLandingGroundHeightAt(x, z, previousY, nextY) {
  if (!Number.isFinite(previousY) || !Number.isFinite(nextY)) return playerGroundHeightAt(x, z, nextY);
  const upperY = Math.max(previousY, nextY);
  const lowerY = Math.min(previousY, nextY);
  const maxBlockY = Math.floor(upperY + 0.12 - 1.01);
  const minBlockY = Math.max(minBuildY, Math.floor(lowerY - playerGroundProbeDepth - 1.01));
  return playerGroundHeightInBlockRangeAt(x, z, minBlockY, maxBlockY);
}

function playerGroundHeightInBlockRangeAt(x, z, minBlockY, maxBlockY) {
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  for (let y = maxBlockY; y >= minBlockY; y -= 1) {
    if (!isSolidCell(blockX, y, blockZ)) continue;
    const groundY = y + 1.01;
    if (playerBodyCollides(x, z, groundY)) continue;
    return groundY;
  }

  return -Infinity;
}

function surfaceHeight(x, z) {
  if (surfaceHeightCacheFrameId !== worldQueryFrameId) {
    surfaceHeightFrameCache.clear();
    surfaceHeightCacheFrameId = worldQueryFrameId;
  }
  const blockX = Math.round(x);
  const blockZ = Math.round(z);
  const key = `${blockX},${blockZ}`;
  const cached = surfaceHeightFrameCache.get(key);
  if (cached !== undefined) return cached;
  const height = querySurfaceHeight(worldState, blockX, blockZ);
  surfaceHeightFrameCache.set(key, height);
  return height;
}

function beginWorldQueryFrame() {
  worldQueryFrameId++;
}

function invalidateWorldQueryCache() {
  surfaceHeightFrameCache.clear();
  surfaceHeightCacheFrameId = worldQueryFrameId;
  markWorldEditsChanged();
}

function markWorldEditsChanged() {
  worldEditVersion++;
}

function placePlayerOnGround(resetHorizontal = true) {
  if (resetHorizontal) {
    player.position.x = 0;
    player.position.z = 0;
  }
  player.position.y = surfaceHeight(player.position.x, player.position.z) + 1.01;
  player.velocity.y = 0;
  player.grounded = true;
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
    if (!data || (data.version !== 1 && data.version !== playerPositionStorageVersion)) return null;
    if (data.version === playerPositionStorageVersion && data.worldSignature !== currentPlayerWorldSignature()) return null;
    const x = Number(data.x);
    const y = Number(data.y);
    const z = Number(data.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const groundY = surfaceHeight(x, z) + 1.01;
    const position = new THREE.Vector3(x, normalizeSavedPlayerY(y, groundY), z);
    const yaw = Number.isFinite(Number(data.yaw)) ? Number(data.yaw) : Math.PI * 0.25;
    const rawPitch = Number(data.cameraPitch);
    const cameraPitch = Number.isFinite(rawPitch) ? THREE.MathUtils.clamp(rawPitch, -0.92, 0.42) : -0.42;
    return { position, yaw, cameraPitch, worldSignature: data.worldSignature ?? currentPlayerWorldSignature() };
  } catch {
    return null;
  }
}

function savePlayerPosition(force = false) {
  const now = performance.now();
  if (!force && now - playerPositionSaveState.lastSaveAt < playerPositionSaveMs) return;
  const payload = JSON.stringify({
    version: playerPositionStorageVersion,
    worldSignature: currentPlayerWorldSignature(),
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

function normalizeSavedPlayerY(savedY, groundY) {
  if (!Number.isFinite(savedY)) return groundY;
  if (savedY < groundY) return groundY;
  if (savedY > groundY + maxSavedPlayerHeightAboveGround) return groundY;
  return savedY;
}

function currentPlayerWorldSignature() {
  return activeWorldMapSignature || worldMapSignature(pendingWorldMapSeed);
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
      const worldY = surfaceHeight(worldX, worldZ) + 1 + guardianFogVolumeHeight * 0.5;
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
  generateAround(player.position, { force: true });
  buildPendingChunks();
  generateCloudsAround(player.position);
  savePlayerPosition(true);
  updateHud(true);
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

function updateHud(force = false) {
  updateAccountHud();
  const now = performance.now();
  const chunk = playerChunkFromPosition(player.position);
  const worldX = Math.round(player.position.x * 10) / 10;
  const worldZ = Math.round(player.position.z * 10) / 10;
  const signature = [
    worldX,
    worldZ,
    chunk.x,
    chunk.z,
    generatedChunks.size,
    knownChunks.size,
    fpsState.value,
  ].join("|");
  if (!force && signature === hudRenderState.signature) return;
  if (!force && now - hudRenderState.lastUpdateAt < hudUpdateMs) return;
  hudRenderState.signature = signature;
  hudRenderState.lastUpdateAt = now;

  const worldCoordText = `${worldX.toFixed(1)}, ${worldZ.toFixed(1)}`;
  const chunkCoordText = `${chunk.x}, ${chunk.z}`;
  setTextIfChanged(positionLabel, worldCoordText);
  setTextIfChanged(minimapWorldCoord, worldCoordText);
  setTextIfChanged(minimapChunkCoord, chunkCoordText);
  setTextIfChanged(chunksLabel, gameText("main.chunks", "{active}/{known} chunks", {
    active: generatedChunks.size,
    known: knownChunks.size,
  }));
  setTextIfChanged(fpsLabel, gameText("main.fps", "{fps} FPS", { fps: fpsState.value }));
}

function updateAccountHud() {
  const now = performance.now();
  if (now - hudLastAccountRefreshAt < hudAccountRefreshMs) return;
  hudLastAccountRefreshAt = now;
  const session = getGameSession();
  disposeAvatarNameTag(avatar);
  setTextIfChanged(accountName, session.username || gameText("main.account.guest", "Guest"));
  setTextIfChanged(accountLevel, gameText("main.account.level", "Lv. {level}", { level: normalizedLevel() }));
  setTextIfChanged(accountTitle, localStorage.getItem("nicechunk.title") || gameText("main.account.defaultTitle", "Novice"));
  setTextIfChanged(accountWallet, formatWalletAddress(session.walletAddress));
  if (accountSessionBalance) {
    if (gameplaySessionStatus?.balanceLamports !== null && Number.isFinite(gameplaySessionStatus?.balanceLamports)) {
      setTextIfChanged(accountSessionBalance, gameText("main.account.sessionBalance", "Session: {balance} SOL", {
        balance: formatSolAmount(gameplaySessionStatus.balanceLamports / 1_000_000_000),
      }));
    } else {
      setTextIfChanged(accountSessionBalance, gameText("main.account.sessionNotFunded", "Session: not funded"));
    }
  }
}

function setTextIfChanged(element, text) {
  if (!element) return;
  if (hudTextState.get(element) === text) return;
  hudTextState.set(element, text);
  element.textContent = text;
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
  if (elapsed < 0.5) return;
  fpsState.value = Math.max(1, Math.round(fpsState.frames / elapsed));
  fpsState.frames = 0;
  fpsState.lastTime = now;
}

function resize() {
  refreshMobileViewport();
  if (!isMobileViewport()) resetMobileJoystick();
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizeProfilePreview();
}

function renderPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.5 : 2);
}
