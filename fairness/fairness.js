import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import * as THREE from "three";
import { terrainProfile, setWorldSeed } from "../src/world/generator.js";
import { BiomeType, WorldMapBlock } from "../src/world/blocks.js";
import { createChunkGroup } from "../src/world/chunks.js";
import { chunkSize, seaLevel } from "../src/world/config.js";
import { createWorldGeometryByType } from "../src/world/rendering.js";

const languageStorageKey = "nicechunk.language";
const localeVersionPrefix = "nicechunk.fairness.locale.version.";
const localeDataPrefix = "nicechunk.fairness.locale.data.";
const supportedLanguages = new Set(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());
const generationVersion = "voxel-seeded-terrain-v2";
const ruleVersion = "fairness-alpha-001";

const backdropCanvas = document.querySelector("#fairnessBackdrop");
const heroCanvas = document.querySelector("#fairnessWorldCanvas");
const chunkCanvas = document.querySelector("#chunkCanvas");
const seedInput = document.querySelector("#seedInput");
const chunkXInput = document.querySelector("#chunkXInput");
const chunkZInput = document.querySelector("#chunkZInput");
const randomChunkButton = document.querySelector("#randomChunkButton");
const heightHash = document.querySelector("#heightHash");
const biomeHash = document.querySelector("#biomeHash");
const chunkCommitment = document.querySelector("#chunkCommitment");
const ruleVersionLabel = document.querySelector("#ruleVersionLabel");
const blockCountLabel = document.querySelector("#blockCountLabel");
const chunkStats = document.querySelector("#chunkStats");
const mineSeed = document.querySelector("#mineSeed");
const mineBlock = document.querySelector("#mineBlock");
const mineNonce = document.querySelector("#mineNonce");
const miningResult = document.querySelector("#miningResult");
const languagePicker = document.querySelector(".language-switch");
const languageTrigger = document.querySelector(".language-trigger");
const languageCurrent = document.querySelector(".language-current");
const languageMenu = document.querySelector(".language-menu");
const lockButtons = [...document.querySelectorAll("[data-lock-field]")];
const plannedLanguages = [
  { code: "en", englishName: "English", nativeName: "English", enabled: true },
  { code: "es", englishName: "Spanish", nativeName: "Español", enabled: true },
  { code: "fr", englishName: "French", nativeName: "Français", enabled: true },
  { code: "de", englishName: "German", nativeName: "Deutsch", enabled: true },
  { code: "ja", englishName: "Japanese", nativeName: "Japanese", enabled: true },
  { code: "ru", englishName: "Russian", nativeName: "Русский", enabled: true },
  { code: "ko", englishName: "Korean", nativeName: "한국어", enabled: true },
  { code: "zh-Hant", englishName: "Traditional Chinese", nativeName: "Traditional Chinese", enabled: true },
  { code: "zh-Hans", englishName: "Simplified Chinese", nativeName: "Simplified Chinese", enabled: true },
];

let dictionary = {};
let mainnetIndex = null;
let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || "en";
let chunkPreview = null;
const lockedFields = {
  seed: false,
  chunkX: false,
  chunkZ: false,
};

initFairness();

async function initFairness() {
  setSiteLoadingProgress(32);
  dictionary = await loadFairnessDictionary(activeLanguage);
  setSiteLoadingProgress(58);
  applyTranslations(document);
  setupLanguageSwitcher();
  setupScrollLinks();
  setupBackdrop(backdropCanvas);
  setupHeroAnimation(heroCanvas);
  setupChunkVerifier();
  setupMiningVerifier();
  finishSiteLoading();
}

async function loadFairnessDictionary(language) {
  const mainnet = await fetchMainnetIndex();
  const locale = mainnet?.fairnessI18n?.locales?.[language];
  const cachedVersion = localStorage.getItem(localeVersionKey(language));
  const cachedRaw = localStorage.getItem(localeDataKey(language));
  if (locale?.version && cachedVersion === locale.version && cachedRaw) {
    try {
      return JSON.parse(cachedRaw);
    } catch (_error) {
      localStorage.removeItem(localeVersionKey(language));
      localStorage.removeItem(localeDataKey(language));
    }
  }

  const url = locale?.url || `/fairness/locales/${language}.json`;
  const version = locale?.version || buildVersion;
  const response = await fetch(`${url}?v=${encodeURIComponent(version)}`, { cache: "no-store" });
  if (!response.ok && language !== "en") return loadFairnessDictionary("en");
  if (!response.ok) return {};
  const data = await response.json();
  try {
    localStorage.setItem(localeVersionKey(language), version);
    localStorage.setItem(localeDataKey(language), JSON.stringify(data));
  } catch (_error) {
    localStorage.removeItem(localeDataKey(language));
  }
  return data;
}

async function fetchMainnetIndex() {
  if (mainnetIndex) return mainnetIndex;
  mainnetIndex = await fetch(`/mainnet.json?v=${encodeURIComponent(buildVersion)}`, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  return mainnetIndex;
}

function applyTranslations(root) {
  const title = text("meta.title");
  if (title) document.title = title;

  root.querySelectorAll("[data-fairness-i18n]").forEach((element) => {
    const value = text(element.dataset.fairnessI18n);
    if (value) element.textContent = value;
  });

  root.querySelectorAll("[data-fairness-i18n-aria-label]").forEach((element) => {
    const value = text(element.dataset.fairnessI18nAriaLabel);
    if (value) element.setAttribute("aria-label", value);
  });

  document.documentElement.lang = activeLanguage;
}

function text(path) {
  return path.split(".").reduce((value, part) => (value && Object.hasOwn(value, part) ? value[part] : undefined), dictionary) ?? "";
}

function setupLanguageSwitcher() {
  renderLanguageMenu();
  updateLanguagePicker();
  languageTrigger?.addEventListener("click", () => {
    const open = !languagePicker?.classList.contains("open");
    setLanguageMenuOpen(open);
  });
  document.addEventListener("click", (event) => {
    if (!languagePicker?.contains(event.target)) setLanguageMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setLanguageMenuOpen(false);
  });
}

function renderLanguageMenu() {
  if (!languageMenu) return;
  languageMenu.replaceChildren(
    ...plannedLanguages.map((language) => {
      const option = document.createElement("button");
      option.className = "language-option";
      option.type = "button";
      option.role = "option";
      option.dataset.fairnessLanguage = language.code;
      option.disabled = !language.enabled;
      option.innerHTML = `
        <span class="language-option-name"></span>
        <span class="language-option-native"></span>
        <span class="language-option-status"></span>
      `;
      option.querySelector(".language-option-name").textContent = language.englishName;
      option.querySelector(".language-option-native").textContent = `(${language.nativeName})`;
      option.querySelector(".language-option-status").textContent = language.enabled ? "" : "Coming Soon";
      option.addEventListener("click", async () => {
        const nextLanguage = normalizeLanguage(option.dataset.fairnessLanguage);
        if (!nextLanguage || nextLanguage === activeLanguage) {
          setLanguageMenuOpen(false);
          return;
        }
        activeLanguage = nextLanguage;
        localStorage.setItem(languageStorageKey, activeLanguage);
        dictionary = await loadFairnessDictionary(activeLanguage);
        applyTranslations(document);
        updateLockButtons();
        updateLanguagePicker();
        updateChunkVerifier();
        updateMiningVerifier();
        setLanguageMenuOpen(false);
      });
      return option;
    }),
  );
}

function updateLanguagePicker() {
  const active = plannedLanguages.find((language) => language.code === activeLanguage) ?? plannedLanguages[0];
  if (languageCurrent) languageCurrent.textContent = `${active.englishName} (${active.nativeName})`;
  languageMenu?.querySelectorAll(".language-option").forEach((option) => {
    const selected = option.dataset.fairnessLanguage === activeLanguage;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setLanguageMenuOpen(open) {
  languagePicker?.classList.toggle("open", open);
  languageTrigger?.setAttribute("aria-expanded", String(open));
}

function setupScrollLinks() {
  document.querySelectorAll("[data-fairness-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.getElementById(link.dataset.fairnessScroll || "");
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${target.id}`);
    });
  });
}

function setupBackdrop(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const resize = () => syncCanvasSize(canvas);
  window.addEventListener("resize", resize);
  resize();

  function render(time) {
    resize();
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0c0e12";
    context.fillRect(0, 0, width, height);
    context.save();
    context.globalAlpha = 0.36;
    const unit = Math.max(18, Math.min(width, height) / 34);
    for (let y = -1; y < height / unit + 2; y += 1) {
      for (let x = -1; x < width / unit + 2; x += 1) {
        const pulse = Math.sin(time * 0.0007 + x * 0.7 + y * 0.9) * 0.5 + 0.5;
        if ((x + y) % 3 !== 0) continue;
        context.fillStyle = pulse > 0.72 ? "rgba(140, 255, 0, 0.12)" : "rgba(0, 163, 255, 0.08)";
        context.fillRect(x * unit, y * unit, unit * 0.22, unit * 0.22);
      }
    }
    context.restore();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function setupHeroAnimation(canvas) {
  if (!canvas) return;
  let seed = hashString("fairness-hero");
  let chunk = createChunk(seed, 0, 0);
  let started = performance.now();

  function render(time) {
    const elapsed = time - started;
    if (elapsed > 3600) {
      seed = nextSeed(seed);
      chunk = createChunk(seed, seed % 7, seed % 5);
      started = time;
    }
    drawChunk(canvas, chunk, Math.min(elapsed / 1400, 1), time * 0.001);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function setupChunkVerifier() {
  chunkPreview = setupChunkPreview(chunkCanvas);
  [seedInput, chunkXInput, chunkZInput].forEach((input) => input?.addEventListener("input", updateChunkVerifier));
  lockButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.dataset.lockField;
      if (!Object.hasOwn(lockedFields, field)) return;
      lockedFields[field] = !lockedFields[field];
      updateLockButtons();
    });
  });
  updateLockButtons();
  randomChunkButton?.addEventListener("click", () => {
    if (!seedInput || !chunkXInput || !chunkZInput) return;
    if (!lockedFields.seed) seedInput.value = `NCK-${Date.now().toString(36).toUpperCase()}`;
    if (!lockedFields.chunkX) chunkXInput.value = String(Math.floor(Math.random() * 25) - 12);
    if (!lockedFields.chunkZ) chunkZInput.value = String(Math.floor(Math.random() * 25) - 12);
    updateChunkVerifier();
  });
  updateChunkVerifier();
}

function updateChunkVerifier() {
  if (!seedInput || !chunkXInput || !chunkZInput || !chunkCanvas) return;
  const seed = seedInput.value || "nicechunk-mainnet-001";
  const chunkX = Number(chunkXInput.value || 0);
  const chunkZ = Number(chunkZInput.value || 0);
  setWorldSeed(seed);
  const snapshot = createChunkSnapshot(chunkX, chunkZ);
  chunkPreview?.renderChunk({ chunkX, chunkZ, snapshot });
  const terrainPayload = snapshot.cells.map((cell) => `${cell.x}:${cell.z}:${cell.height}:${cell.biome}:${cell.terrain}:${cell.vegetation ?? 0}:${cell.fluid ?? 0}:${cell.waterLevel ?? 0}`).join("|");
  const terrainHash = hashString([seed, chunkX, chunkZ, generationVersion, terrainPayload].join(":"));
  if (heightHash) heightHash.textContent = `${snapshot.minHeight}..${snapshot.maxHeight}`;
  if (biomeHash) biomeHash.textContent = formatTopCounts(snapshot.biomes, 2);
  if (chunkCommitment) chunkCommitment.textContent = formatHash(terrainHash);
  if (ruleVersionLabel) ruleVersionLabel.textContent = generationVersion;
  if (blockCountLabel) blockCountLabel.textContent = String(snapshot.visibleBlocks);
  if (chunkStats) chunkStats.textContent = formatChunkStats(seed, chunkX, chunkZ, snapshot);
}

function updateLockButtons() {
  lockButtons.forEach((button) => {
    const field = button.dataset.lockField;
    const locked = Boolean(lockedFields[field]);
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-pressed", String(locked));
    button.setAttribute("aria-label", lockButtonLabel(field, locked));
    button.innerHTML = locked ? lockIconSvg() : unlockIconSvg();
  });
}

function lockButtonLabel(field, locked) {
  const labelKeys = {
    seed: locked ? "verify.lock.unlockSeed" : "verify.lock.lockSeed",
    chunkX: locked ? "verify.lock.unlockChunkX" : "verify.lock.lockChunkX",
    chunkZ: locked ? "verify.lock.unlockChunkZ" : "verify.lock.lockChunkZ",
  };
  return text(labelKeys[field] ?? "verify.lock.lockSeed");
}

function lockIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

function unlockIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 11V8a5 5 0 0 1 9.4-2.5"/><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

function setupMiningVerifier() {
  [mineSeed, mineBlock, mineNonce].forEach((input) => input?.addEventListener("input", updateMiningVerifier));
  updateMiningVerifier();
}

function updateMiningVerifier() {
  if (!mineSeed || !mineBlock || !mineNonce || !miningResult) return;
  const [blockX = 0, blockY = 0, blockZ = 0] = mineBlock.value
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  const chunkX = Math.floor(blockX / 16);
  const chunkZ = Math.floor(blockZ / 16);
  const payload = [
    mineSeed.value || "nicechunk-mainnet-001",
    generationVersion,
    ruleVersion,
    chunkX,
    chunkZ,
    blockX,
    blockY,
    blockZ,
    Number(mineNonce.value || 0),
  ].join(":");
  const hash = hashString(payload);
  const roll = hash / 0xffffffff;
  const result = roll > 0.965 ? "rare_resource" : roll > 0.78 ? "common_resource" : "base_block";
  miningResult.textContent = JSON.stringify(
    {
      payload,
      hash: formatHash(hash),
      roll: Number(roll.toFixed(6)),
      result,
      note: "Reference proof model, not final settlement.",
    },
    null,
    2,
  );
}

function setupChunkPreview(canvas) {
  if (!canvas) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x05070a, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05070a, 42, 90);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260);
  const pivot = new THREE.Group();
  scene.add(pivot);

  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const waterGeometry = new THREE.PlaneGeometry(1, 1);
  waterGeometry.rotateX(-Math.PI / 2);
  const geometryByType = createWorldGeometryByType({ THREE, cubeGeometry, waterGeometry });
  const materials = createVerifierMaterials(THREE, geometryByType);

  const ambient = new THREE.HemisphereLight(0xbddfff, 0x1a2616, 2.5);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(22, 34, 18);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x5fb8ff, 1.1);
  rimLight.position.set(-26, 18, -22);
  scene.add(rimLight);

  const state = {
    yaw: -Math.PI / 4,
    pitch: 0.52,
    distance: 34,
    targetY: 0,
    currentGroup: null,
    pointers: new Map(),
    lastPinchDistance: null,
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const updateCamera = () => {
    state.pitch = clamp(state.pitch, -0.05, 1.18);
    state.distance = clamp(state.distance, 18, 78);
    const horizontal = Math.cos(state.pitch) * state.distance;
    camera.position.set(Math.sin(state.yaw) * horizontal, Math.sin(state.pitch) * state.distance + state.targetY, Math.cos(state.yaw) * horizontal);
    camera.lookAt(0, state.targetY, 0);
  };

  const render = () => {
    resize();
    updateCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };

  const pointerTarget = canvas.parentElement || canvas;
  pointerTarget.addEventListener("pointerdown", (event) => {
    pointerTarget.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    state.lastPinchDistance = null;
  });
  pointerTarget.addEventListener("pointermove", (event) => {
    const previous = state.pointers.get(event.pointerId);
    if (!previous) return;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.pointers.size >= 2) {
      const [first, second] = [...state.pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (state.lastPinchDistance !== null) state.distance -= (distance - state.lastPinchDistance) * 0.04;
      state.lastPinchDistance = distance;
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    state.yaw -= dx * 0.008;
    state.pitch += dy * 0.006;
  });
  const releasePointer = (event) => {
    state.pointers.delete(event.pointerId);
    state.lastPinchDistance = null;
  };
  pointerTarget.addEventListener("pointerup", releasePointer);
  pointerTarget.addEventListener("pointercancel", releasePointer);
  pointerTarget.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.distance += event.deltaY * 0.025;
    },
    { passive: false },
  );
  window.addEventListener("resize", resize);

  requestAnimationFrame(render);

  return {
    renderChunk({ chunkX, chunkZ, snapshot }) {
      if (state.currentGroup) {
        pivot.remove(state.currentGroup);
        state.currentGroup = null;
      }

      const chunkState = {
        placedBlocks: new Map(),
        removedBlocks: new Set(),
        dynamicWater: new Set(),
        solidBlocks: new Set(),
        generatedSolidRefs: new Map(),
      };
      const group = createChunkGroup({
        THREE,
        chunkX,
        chunkZ,
        state: chunkState,
        geometryByType,
        materials,
        detailMode: "full",
      });

      const chunkCenterX = chunkX * chunkSize + (chunkSize - 1) / 2;
      const chunkCenterZ = chunkZ * chunkSize + (chunkSize - 1) / 2;
      group.position.set(-chunkCenterX, -snapshot.minHeight, -chunkCenterZ);
      state.targetY = Math.max(1, (snapshot.maxHeight - snapshot.minHeight) * 0.5);
      state.distance = 30;
      state.yaw = state.yaw || -Math.PI / 4;
      state.pitch = state.pitch || 0.68;
      state.currentGroup = group;
      pivot.add(group);
      snapshot.visibleBlocks = countVisibleInstances(group);
    },
  };
}

function createChunkSnapshot(chunkX, chunkZ) {
  const cells = [];
  const biomes = new Map();
  const terrains = new Map();
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  let waterCells = 0;
  let minWaterLevel = Infinity;
  let maxWaterLevel = -Infinity;

  for (let localZ = 0; localZ < chunkSize; localZ += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const x = chunkX * chunkSize + localX;
      const z = chunkZ * chunkSize + localZ;
      const profile = terrainProfile(x, z);
      const cell = {
        x,
        z,
        height: profile.height,
        biome: profile.biome,
        terrain: profile.terrain,
        vegetation: profile.vegetation,
        fluid: profile.fluid,
        waterLevel: profile.waterLevel,
      };
      cells.push(cell);
      minHeight = Math.min(minHeight, profile.height);
      maxHeight = Math.max(maxHeight, profile.height);
      incrementCount(biomes, biomeName(profile.biome));
      incrementCount(terrains, blockName(profile.terrain));
      if (profile.fluid) {
        waterCells += 1;
        const waterLevel = profile.waterLevel ?? profile.height;
        minWaterLevel = Math.min(minWaterLevel, waterLevel);
        maxWaterLevel = Math.max(maxWaterLevel, waterLevel);
      }
    }
  }

  return {
    cells,
    biomes,
    terrains,
    minHeight,
    maxHeight,
    waterCells,
    minWaterLevel: Number.isFinite(minWaterLevel) ? minWaterLevel : null,
    maxWaterLevel: Number.isFinite(maxWaterLevel) ? maxWaterLevel : null,
    visibleBlocks: 0,
  };
}

function createVerifierMaterials(THREE, geometryByType) {
  const palette = {
    grass: 0x62a744,
    dirt: 0x8a5a35,
    stone: 0x7d8278,
    deepStone: 0x3f3f46,
    sand: 0xcdbb73,
    sandstone: 0xb58d54,
    gravel: 0x8a8579,
    clay: 0xa77d64,
    mud: 0x4f3828,
    dryDirt: 0x9b6a3c,
    saltFlat: 0xe6e2cf,
    snow: 0xe7f2f5,
    ice: 0xa9d8ff,
    frozenSoil: 0x8c9aa3,
    basalt: 0x2f3033,
    ash: 0x6d6a66,
    bedrock: 0x1e1e24,
    water: 0x377fb9,
    swampWater: 0x3d5f45,
    toxicWater: 0x72c442,
    lava: 0xff5a1f,
    quicksand: 0xb99b55,
    trunk: 0x7a4b28,
    trunkDark: 0x52311f,
    pineTrunk: 0x5a3a25,
    deadWood: 0x4a3a2a,
    giantRoot: 0x5b351f,
    leaves: 0x3f8c3d,
    leavesDark: 0x256c38,
    leavesLight: 0x73b846,
    leavesTeal: 0x1f9b82,
    leavesWarm: 0x6aa242,
    pineLeaves: 0x1d6654,
    snowLeaves: 0xbfd9d8,
    grassPlant: 0x65b84a,
    dryGrass: 0xc2a44e,
    bush: 0x3d8b3d,
    deadBush: 0x8b6a3e,
    cactus: 0x2f9b57,
    reed: 0x8ba94e,
    swampGrass: 0x4f7f3c,
    snowBush: 0xc9d8d2,
    thorn: 0x5d4a34,
    moss: 0x3f8f4a,
    lichen: 0x9ca66b,
    vine: 0x2f7a35,
    glowMycelium: 0x6ef0c2,
    mushroom: 0xb85b5b,
    seaweed: 0x227c5c,
    aquaticPlant: 0x3fa878,
    coral: 0xff7f7f,
    deadCoral: 0x9a8f86,
    shellBed: 0xe4d6b5,
    flowerStem: 0x4d9636,
    flowerRed: 0xd94a4a,
    flowerYellow: 0xf1d04b,
    flowerBlue: 0x5d8ee8,
    flowerWhite: 0xf4f1d8,
    grassTuft: 0x4f9d36,
    dryGrassTuft: 0xb8a85d,
    pebble: 0x8d887a,
    shoreDamp: 0x8f7f4d,
    shoreFoam: 0xdff5d8,
    reedStem: 0x6f9a3d,
    reedTip: 0xb88f4a,
    mushroomStem: 0xe7d5a1,
    mushroomCap: 0xc84b3f,
  };
  const transparentTypes = new Set(["water", "swampWater", "toxicWater", "ice", "lava", "shoreDamp", "shoreFoam", "grassPlant", "dryGrass", "grassTuft", "dryGrassTuft", "moss", "lichen", "vine", "glowMycelium", "shellBed"]);
  const planeTypes = new Set(["lava", "shoreDamp", "shoreFoam", "grassPlant", "dryGrass", "grassTuft", "dryGrassTuft", "swampGrass", "moss", "lichen", "vine", "glowMycelium", "seaweed", "aquaticPlant", "shellBed"]);
  return Object.fromEntries(
    Object.keys(geometryByType).map((type) => {
      const transparent = transparentTypes.has(type);
      const material = new THREE.MeshLambertMaterial({
        color: palette[type] ?? 0x7d8278,
        transparent,
        opacity: type === "water" || type === "swampWater" || type === "toxicWater" ? 0.58 : transparent ? 0.78 : 1,
        depthWrite: !transparent,
        side: planeTypes.has(type) ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (type === "lava") {
        material.emissive = new THREE.Color(0xff2b00);
        material.emissiveIntensity = 0.85;
      }
      return [type, material];
    }),
  );
}

function formatChunkStats(seed, chunkX, chunkZ, snapshot) {
  const waterRange = snapshot.minWaterLevel === null ? text("verify.stats.none") : `${snapshot.minWaterLevel}..${snapshot.maxWaterLevel}`;
  const chunkXLabel = text("verify.demo.chunkX") || "Chunk X";
  const chunkYLabel = text("verify.demo.chunkZ") || "Chunk Y";
  return JSON.stringify(
    {
      [text("verify.stats.seed")]: seed,
      [text("verify.stats.chunk")]: `${chunkXLabel}: ${chunkX}, ${chunkYLabel}: ${chunkZ}`,
      [text("verify.stats.chunkSize")]: `${chunkSize} x ${chunkSize}`,
      [text("verify.stats.seaLevel")]: seaLevel,
      [text("verify.stats.heightRange")]: `${snapshot.minHeight}..${snapshot.maxHeight}`,
      [text("verify.stats.waterLevelRange")]: waterRange,
      [text("verify.stats.waterCells")]: snapshot.waterCells,
      [text("verify.stats.primaryBiomes")]: formatTopCounts(snapshot.biomes, 4),
      [text("verify.stats.primaryBlocks")]: formatTopCounts(snapshot.terrains, 5),
    },
    null,
    2,
  );
}

function countVisibleInstances(group) {
  let count = 0;
  group.traverse((object) => {
    if (object.isInstancedMesh) count += object.count;
  });
  return count;
}

function incrementCount(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatTopCounts(map, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
}

function biomeName(value) {
  return Object.entries(BiomeType).find(([, id]) => id === value)?.[0] ?? `Biome${value}`;
}

function blockName(value) {
  return Object.entries(WorldMapBlock).find(([, id]) => id === value)?.[0] ?? `Block${value}`;
}

function createChunk(seed, chunkX, chunkZ) {
  const size = 12;
  setWorldSeed(`${seed}:${generationVersion}`);

  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const worldX = chunkX * chunkSize + Math.floor((x / size) * chunkSize);
      const worldZ = chunkZ * chunkSize + Math.floor((y / size) * chunkSize);
      const profile = terrainProfile(worldX, worldZ);
      return {
        height: Math.max(1, Math.min(8, Math.round((profile.height - seaLevel) / 4) + 2)),
        terrain: previewTerrainName(profile),
        block: profile.terrain,
        vegetation: profile.vegetation,
        fluid: profile.fluid,
        biome: profile.biome,
      };
    }),
  );
}

function previewTerrainName(profile) {
  if (profile.fluid === WorldMapBlock.Water || profile.fluid === WorldMapBlock.SwampWater || profile.fluid === WorldMapBlock.ToxicWater) return "water";
  if (profile.terrain === WorldMapBlock.Sand || profile.terrain === WorldMapBlock.DryDirt || profile.terrain === WorldMapBlock.Quicksand) return "desert";
  if (profile.terrain === WorldMapBlock.Snow || profile.terrain === WorldMapBlock.Ice || profile.terrain === WorldMapBlock.FrozenSoil) return "snow";
  if ([BiomeType.Forest, BiomeType.Rainforest, BiomeType.Swamp, BiomeType.Wetland].includes(profile.biome)) return "forest";
  return "grassland";
}

function drawChunk(canvas, chunk, reveal, time) {
  const context = canvas.getContext("2d");
  if (!context) return;
  syncCanvasSize(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const size = chunk.length;
  const unit = Math.min(width / 18, height / 13);
  const tileWidth = unit * 1.45;
  const tileHeight = unit * 0.78;
  const blockHeight = unit * 0.56;
  const centerX = width * 0.5 + Math.sin(time * 0.6) * unit * 0.48;
  const startY = height * 0.14 + Math.cos(time * 0.45) * unit * 0.18;

  context.clearRect(0, 0, width, height);
  context.save();
  for (let layer = 0; layer < size * 2 - 1; layer += 1) {
    for (let x = 0; x < size; x += 1) {
      const y = layer - x;
      if (y < 0 || y >= size) continue;
      const cell = chunk[y][x];
      const animatedHeight = Math.max(0.12, cell.height * easeOutCubic(Math.max(0, reveal - (x + y) * 0.012)));
      const isoX = centerX + (x - y) * tileWidth * 0.5;
      const isoY = startY + (x + y) * tileHeight * 0.5 - animatedHeight * blockHeight;
      drawIsoColumn(context, isoX, isoY, tileWidth, tileHeight, animatedHeight * blockHeight, cell);
    }
  }
  context.restore();
}

function drawIsoColumn(context, x, y, tileWidth, tileHeight, columnHeight, cell) {
  const palette = terrainPalette(cell.terrain);
  const halfWidth = tileWidth * 0.5;
  const halfHeight = tileHeight * 0.5;
  const baseY = y + columnHeight;
  const top = [
    [x, y],
    [x + halfWidth, y + halfHeight],
    [x, y + tileHeight],
    [x - halfWidth, y + halfHeight],
  ];
  const left = [
    [x - halfWidth, y + halfHeight],
    [x, y + tileHeight],
    [x, baseY + tileHeight],
    [x - halfWidth, baseY + halfHeight],
  ];
  const right = [
    [x + halfWidth, y + halfHeight],
    [x, y + tileHeight],
    [x, baseY + tileHeight],
    [x + halfWidth, baseY + halfHeight],
  ];
  fillPolygon(context, left, palette.left);
  fillPolygon(context, right, palette.right);
  fillPolygon(context, top, palette.top);
  context.strokeStyle = "rgba(152, 203, 255, 0.14)";
  context.lineWidth = 1;
  strokePolygon(context, top);
  if (cell.terrain === "forest") {
    fillPolygon(context, [[x, y - tileHeight * 0.35], [x + halfWidth * 0.62, y + halfHeight * 0.3], [x, y + tileHeight * 0.88], [x - halfWidth * 0.62, y + halfHeight * 0.3]], "rgba(48, 135, 54, 0.92)");
    fillPolygon(context, [[x, y - tileHeight * 0.12], [x + halfWidth * 0.42, y + halfHeight * 0.36], [x, y + tileHeight * 0.72], [x - halfWidth * 0.42, y + halfHeight * 0.36]], "rgba(92, 183, 70, 0.9)");
  }
}

function terrainPalette(terrain) {
  const palettes = {
    water: { top: "rgba(34, 146, 214, 0.86)", left: "rgba(16, 78, 128, 0.72)", right: "rgba(22, 96, 150, 0.78)" },
    desert: { top: "#c6a15d", left: "#755a31", right: "#94713d" },
    snow: { top: "#dfefff", left: "#7c96ad", right: "#9fb6ca" },
    forest: { top: "#4e9d42", left: "#2f5f32", right: "#3f7a38" },
    grassland: { top: "#78b34a", left: "#3e642d", right: "#537e36" },
  };
  return palettes[terrain] || palettes.grassland;
}

function fillPolygon(context, points, fill) {
  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
  context.closePath();
  context.fill();
}

function strokePolygon(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
  context.closePath();
  context.stroke();
}

function syncCanvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor((rect.width || canvas.clientWidth || 1) * scale));
  const height = Math.max(1, Math.floor((rect.height || canvas.clientHeight || 1) * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function nextSeed(seed) {
  return (Math.imul(seed ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
}

function hashString(input) {
  let hash = 2166136261;
  const textValue = String(input);
  for (let index = 0; index < textValue.length; index += 1) {
    hash ^= textValue.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatHash(value) {
  return `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function easeOutCubic(value) {
  const clamped = Math.min(Math.max(value, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLanguage(language) {
  const value = String(language || "").trim();
  if (supportedLanguages.has(value)) return value;
  const lower = value.toLowerCase();
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-hans") return "zh-Hans";
  return "";
}

function localeVersionKey(language) {
  return `${localeVersionPrefix}${language}`;
}

function localeDataKey(language) {
  return `${localeDataPrefix}${language}`;
}
