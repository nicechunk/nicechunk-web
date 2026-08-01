import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import { createHomeWorldScene, HOME_WORLD_SECTION_VIEWS } from "./chunkjs-world-scene.js";

const languageStorageKey = "nicechunk.language";
const localeVersionPrefix = "nicechunk.home.locale.version.";
const localeDataPrefix = "nicechunk.home.locale.data.";
const supportedLanguages = new Set(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());

const container = document.querySelector("#scrollContainer");
const sections = [...document.querySelectorAll(".snap-section")];
const dots = [...document.querySelectorAll(".side-dot")];
const header = document.querySelector("#siteHeader");
const homeWorldCanvas = document.querySelector("#homeWorldCanvas");
const seedChunkCanvas = document.querySelector("#seedChunkCanvas");
const seedValue = document.querySelector("#seedValue");
const watcherNetworkCanvas = document.querySelector("#watcherNetworkCanvas");
const walletAction = document.querySelector("#walletAction");
const languagePicker = document.querySelector(".home-language");
const languageTrigger = document.querySelector(".home-language-trigger");
const languageCurrent = document.querySelector(".home-language-current");
const languageMenu = document.querySelector(".home-language-menu");
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
let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || "en";
let activeSectionIndex = 0;
let homeWorldScene = null;

initHome();

async function initHome() {
  setSiteLoadingProgress(32);
  homeWorldScene = createHomeWorldScene(homeWorldCanvas);
  homeWorldScene.focus(HOME_WORLD_SECTION_VIEWS[activeSectionIndex], { immediate: true });
  dictionary = await loadHomeDictionary(activeLanguage);
  setSiteLoadingProgress(58);
  applyHomeTranslations(document);
  updateWalletAction();
  setupLanguageSwitcher();
  setupSectionObserver();
  setupNavigation();
  setupMobileSectionPaging();
  setupSeedChunkAnimation(seedChunkCanvas, seedValue);
  setupWatcherNetworkAnimation(watcherNetworkCanvas);
  setSiteLoadingProgress(82);
  await Promise.race([homeWorldScene.ready, delay(1_800)]);
  finishSiteLoading();
}

async function loadHomeDictionary(language) {
  const cachedVersion = localStorage.getItem(localeVersionKey(language));
  const cachedRaw = localStorage.getItem(localeDataKey(language));
  if (cachedVersion === buildVersion && cachedRaw) {
    try {
      return JSON.parse(cachedRaw);
    } catch (_error) {
      localStorage.removeItem(localeVersionKey(language));
      localStorage.removeItem(localeDataKey(language));
    }
  }

  const response = await fetch(`/home/locales/${language}.json?v=${encodeURIComponent(buildVersion)}`, { cache: "no-store" });
  if (!response.ok && language !== "en") return loadHomeDictionary("en");
  if (!response.ok) return {};
  const data = await response.json();
  try {
    localStorage.setItem(localeVersionKey(language), buildVersion);
    localStorage.setItem(localeDataKey(language), JSON.stringify(data));
  } catch (_error) {
    localStorage.removeItem(localeDataKey(language));
  }
  return data;
}

function applyHomeTranslations(root) {
  const title = homeText("meta.title");
  if (title) document.title = title;

  root.querySelectorAll("[data-home-i18n]").forEach((element) => {
    const value = homeText(element.dataset.homeI18n);
    if (value) element.textContent = value;
  });

  root.querySelectorAll("[data-home-i18n-aria-label]").forEach((element) => {
    const value = homeText(element.dataset.homeI18nAriaLabel);
    if (value) element.setAttribute("aria-label", value);
  });
}

function homeText(path) {
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
      option.className = "home-language-option";
      option.type = "button";
      option.role = "option";
      option.dataset.homeLanguage = language.code;
      option.disabled = !language.enabled;
      option.innerHTML = `
        <span class="home-language-option-name"></span>
        <span class="home-language-option-native"></span>
        <span class="home-language-option-status"></span>
      `;
      option.querySelector(".home-language-option-name").textContent = language.englishName;
      option.querySelector(".home-language-option-native").textContent = `(${language.nativeName})`;
      option.querySelector(".home-language-option-status").textContent = language.enabled ? "" : "Coming Soon";
      option.addEventListener("click", async () => {
        const nextLanguage = normalizeLanguage(option.dataset.homeLanguage);
        if (!nextLanguage || nextLanguage === activeLanguage) {
          setLanguageMenuOpen(false);
          return;
        }
        activeLanguage = nextLanguage;
        localStorage.setItem(languageStorageKey, activeLanguage);
        dictionary = await loadHomeDictionary(activeLanguage);
        applyHomeTranslations(document);
        updateWalletAction();
        updateLanguagePicker();
        setLanguageMenuOpen(false);
      });
      return option;
    }),
  );
}

function updateLanguagePicker() {
  document.documentElement.lang = activeLanguage;
  const active = plannedLanguages.find((language) => language.code === activeLanguage) ?? plannedLanguages[0];
  if (languageCurrent) languageCurrent.textContent = `${active.englishName} (${active.nativeName})`;
  languageMenu?.querySelectorAll(".home-language-option").forEach((option) => {
    const selected = option.dataset.homeLanguage === activeLanguage;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setLanguageMenuOpen(open) {
  languagePicker?.classList.toggle("open", open);
  languageTrigger?.setAttribute("aria-expanded", String(open));
}

function updateWalletAction() {
  if (!walletAction) return;
  const walletAddress = localStorage.getItem("nicechunk.walletAddress") || "";
  if (!walletAddress) {
    walletAction.textContent = homeText("hero.connectWallet") || "Connect Wallet";
    walletAction.href = "/login/";
    return;
  }

  walletAction.textContent = formatWallet(walletAddress);
  walletAction.href = "/play/";
}

function setupSectionObserver() {
  if (!container || !sections.length) return;
  const visibility = new Map(sections.map((section) => [section, 0]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      const [mostVisible, ratio] = [...visibility.entries()]
        .sort((left, right) => right[1] - left[1])[0] || [];
      if (!mostVisible || ratio < 0.15) return;
      setActiveSection(sections.indexOf(mostVisible));
    },
    { root: container, threshold: [0.15, 0.3, 0.5, 0.7] },
  );

  sections.forEach((section) => observer.observe(section));
}

function setupNavigation() {
  dots.forEach((dot) => {
    dot.addEventListener("click", () => scrollToSection(Number(dot.dataset.sectionIndex || 0)));
  });

  document.querySelectorAll("[data-scroll-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToSection(Number(link.dataset.scrollTarget || 0));
    });
  });
}

function setupMobileSectionPaging() {
  if (!container || !sections.length) return;

  const mobileQuery = window.matchMedia("(max-width: 680px)");
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let consumed = false;
  let lockedUntil = 0;

  container.addEventListener("touchstart", (event) => {
    if (!mobileQuery.matches || shouldIgnorePagingGesture(event.target)) return;
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
    consumed = false;
  }, { passive: true });

  container.addEventListener("touchmove", (event) => {
    if (!tracking || !mobileQuery.matches) return;
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absY < 18 || absY < absX * 1.2) return;

    event.preventDefault();
    if (consumed || Date.now() < lockedUntil || absY < 46) return;

    consumed = true;
    lockedUntil = Date.now() + 560;
    const direction = deltaY < 0 ? 1 : -1;
    scrollToSection(activeSectionIndex + direction);
  }, { passive: false });

  container.addEventListener("touchend", () => {
    tracking = false;
    consumed = false;
  }, { passive: true });

  container.addEventListener("touchcancel", () => {
    tracking = false;
    consumed = false;
  }, { passive: true });
}

function shouldIgnorePagingGesture(target) {
  return Boolean(
    target?.closest?.("a, button, input, textarea, select, [role='listbox'], .home-language-menu, .site-nav, .top-nav"),
  ) || document.documentElement.classList.contains("site-mobile-menu-open");
}

function scrollToSection(index) {
  const clampedIndex = Math.max(0, Math.min(sections.length - 1, index));
  sections[clampedIndex]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setActiveSection(index) {
  activeSectionIndex = Math.max(0, Math.min(sections.length - 1, index));
  sections.forEach((section, sectionIndex) => section.classList.toggle("active", sectionIndex === activeSectionIndex));
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === activeSectionIndex));
  header?.classList.toggle("scrolled", activeSectionIndex > 0);
  const view = HOME_WORLD_SECTION_VIEWS[activeSectionIndex];
  if (homeWorldCanvas?.dataset.sceneView !== view) homeWorldScene?.focus(view);
}

function setupSeedChunkAnimation(canvas, seedElement) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  let seed = 0x4e434b;
  let chunk = createChunk(seed);
  let nextSeedAt = 0;
  let revealStart = 0;

  const resize = () => syncCanvasSize(canvas);

  window.addEventListener("resize", resize);
  resize();
  renderSeedChunk(0);

  function renderSeedChunk(time) {
    if (!nextSeedAt || time >= nextSeedAt) {
      seed = nextSeed(seed);
      chunk = createChunk(seed);
      revealStart = time;
      nextSeedAt = time + 3200;
      if (seedElement) seedElement.textContent = `NCK-${seed.toString(16).toUpperCase().padStart(8, "0").slice(-8)}`;
    }

    resize();
    drawSeedChunk(context, canvas, chunk, Math.min((time - revealStart) / 1100, 1), time * 0.001);
    requestAnimationFrame(renderSeedChunk);
  }
}

function createChunk(seed) {
  const size = 12;
  const random = mulberry32(seed);
  const hills = Array.from({ length: 7 }, () => ({
    x: random() * (size - 1),
    y: random() * (size - 1),
    radius: 2.2 + random() * 5.2,
    height: 1.2 + random() * 5.6,
  }));
  const moistureCenter = { x: random() * size, y: random() * size };
  const sandCenter = { x: random() * size, y: random() * size };
  const forestCenter = { x: random() * size, y: random() * size };

  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      let height = 1.2;
      for (const hill of hills) {
        const distance = Math.hypot(x - hill.x, y - hill.y);
        const falloff = Math.max(0, 1 - distance / hill.radius);
        height += falloff * falloff * hill.height;
      }
      height += (random() - 0.5) * 0.55;
      const level = Math.max(0, Math.round(height));
      const moisture = 1 - Math.min(Math.hypot(x - moistureCenter.x, y - moistureCenter.y) / 9, 1);
      const sand = 1 - Math.min(Math.hypot(x - sandCenter.x, y - sandCenter.y) / 7.5, 1);
      const forest = 1 - Math.min(Math.hypot(x - forestCenter.x, y - forestCenter.y) / 6.5, 1);
      const ore = random() > 0.93 && level > 2;
      let terrain = "grass";
      if (level <= 1 && moisture > 0.42) terrain = "water";
      else if (sand > 0.5 && level < 5) terrain = "sand";
      else if (level > 6) terrain = "snow";
      else if (forest > 0.45 && level > 1) terrain = "forest";
      return { height: terrain === "water" ? 1 : level, terrain, ore };
    }),
  );
}

function drawSeedChunk(context, canvas, chunk, reveal, time) {
  const width = canvas.width;
  const height = canvas.height;
  const size = chunk.length;
  const unit = Math.min(width / 18, height / 13);
  const tileWidth = unit * 1.45;
  const tileHeight = unit * 0.78;
  const blockHeight = unit * 0.56;
  const centerX = width * 0.5 + Math.sin(time * 0.6) * unit * 0.8;
  const startY = height * 0.17 + Math.cos(time * 0.45) * unit * 0.25;

  context.clearRect(0, 0, width, height);
  context.save();
  context.globalAlpha = 0.96;

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

  context.strokeStyle = "rgba(152, 203, 255, 0.13)";
  context.lineWidth = 1;
  strokePolygon(context, top);

  if (cell.terrain === "forest") {
    fillPolygon(context, [[x, y - tileHeight * 0.35], [x + halfWidth * 0.62, y + halfHeight * 0.3], [x, y + tileHeight * 0.88], [x - halfWidth * 0.62, y + halfHeight * 0.3]], "rgba(48, 135, 54, 0.92)");
    fillPolygon(context, [[x, y - tileHeight * 0.12], [x + halfWidth * 0.42, y + halfHeight * 0.36], [x, y + tileHeight * 0.72], [x - halfWidth * 0.42, y + halfHeight * 0.36]], "rgba(92, 183, 70, 0.9)");
  }

  if (cell.ore) {
    context.fillStyle = "rgba(140, 255, 0, 0.92)";
    context.shadowColor = "rgba(140, 255, 0, 0.75)";
    context.shadowBlur = 10;
    context.fillRect(x - 2, y + tileHeight * 0.38, 4, 4);
    context.shadowBlur = 0;
  }
}

function terrainPalette(terrain) {
  const palettes = {
    water: { top: "rgba(34, 146, 214, 0.86)", left: "rgba(16, 78, 128, 0.72)", right: "rgba(22, 96, 150, 0.78)" },
    sand: { top: "#c6a15d", left: "#755a31", right: "#94713d" },
    snow: { top: "#dfefff", left: "#7c96ad", right: "#9fb6ca" },
    forest: { top: "#4e9d42", left: "#2f5f32", right: "#3f7a38" },
    grass: { top: "#78b34a", left: "#3e642d", right: "#537e36" },
  };
  return palettes[terrain] || palettes.grass;
}

function setupWatcherNetworkAnimation(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const resize = () => syncCanvasSize(canvas);
  window.addEventListener("resize", resize);
  resize();
  renderWatcherNetwork(0);

  function renderWatcherNetwork(time) {
    resize();
    drawWatcherNetwork(context, canvas, time * 0.001);
    requestAnimationFrame(renderWatcherNetwork);
  }
}

function drawWatcherNetwork(context, canvas, time) {
  const width = canvas.width;
  const height = canvas.height;
  const unit = Math.min(width / 12, height / 10);
  const tileWidth = unit * 1.05;
  const tileHeight = unit * 0.55;
  const centerX = width * 0.5;
  const centerY = height * 0.45;
  const chunks = [];

  context.clearRect(0, 0, width, height);
  context.save();

  for (let y = -2; y <= 2; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      if (Math.abs(x) + Math.abs(y) > 4) continue;
      const px = centerX + (x - y) * tileWidth * 0.5;
      const py = centerY + (x + y) * tileHeight * 0.5 + unit * 1.1;
      const phase = Math.sin(time * 1.4 + x * 0.9 + y * 1.1) * 0.5 + 0.5;
      chunks.push({ x: px, y: py, phase });
      drawDiamond(context, px, py, tileWidth * 0.92, tileHeight * 0.92, `rgba(0, 163, 255, ${0.08 + phase * 0.08})`, "rgba(152, 203, 255, 0.13)");
    }
  }

  const watcher = { x: centerX, y: centerY - unit * 0.52 };

  for (const chunk of chunks) {
    const alpha = 0.13 + chunk.phase * 0.16;
    drawNetworkLine(context, watcher.x, watcher.y, chunk.x, chunk.y, alpha);
    drawPulse(context, watcher.x, watcher.y, chunk.x, chunk.y, (time * 0.28 + chunk.phase) % 1);
  }

  const orbitCount = 10;
  for (let index = 0; index < orbitCount; index += 1) {
    const angle = time * 0.55 + (Math.PI * 2 * index) / orbitCount;
    const rx = unit * (3.0 + (index % 3) * 0.22);
    const ry = unit * (1.45 + (index % 2) * 0.15);
    const px = watcher.x + Math.cos(angle) * rx;
    const py = watcher.y + Math.sin(angle) * ry;
    context.fillStyle = index % 3 === 0 ? "rgba(140, 255, 0, 0.9)" : "rgba(152, 203, 255, 0.86)";
    context.shadowColor = context.fillStyle;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(px, py, Math.max(2, unit * 0.045), 0, Math.PI * 2);
    context.fill();
  }

  context.shadowBlur = 0;
  drawWatcherCore(context, watcher.x, watcher.y, unit, time);
  context.restore();
}

function drawWatcherCore(context, x, y, unit, time) {
  const pulse = Math.sin(time * 3) * 0.5 + 0.5;
  drawDiamond(context, x, y + unit * 1.25, unit * 1.9, unit * 0.95, "rgba(140, 255, 0, 0.12)", "rgba(140, 255, 0, 0.35)");

  context.strokeStyle = `rgba(140, 255, 0, ${0.28 + pulse * 0.22})`;
  context.lineWidth = Math.max(1, unit * 0.035);
  context.beginPath();
  context.moveTo(x, y + unit * 1.1);
  context.lineTo(x, y - unit * 0.9);
  context.stroke();

  context.fillStyle = "rgba(12, 14, 18, 0.96)";
  context.strokeStyle = "rgba(0, 163, 255, 0.7)";
  context.lineWidth = Math.max(1, unit * 0.035);
  context.beginPath();
  context.arc(x, y - unit * 0.95, unit * 0.48, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = `rgba(140, 255, 0, ${0.72 + pulse * 0.2})`;
  context.shadowColor = "rgba(140, 255, 0, 0.78)";
  context.shadowBlur = 18 + pulse * 10;
  context.beginPath();
  context.arc(x, y - unit * 0.95, unit * 0.18, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  context.strokeStyle = `rgba(0, 163, 255, ${0.18 + pulse * 0.16})`;
  context.beginPath();
  context.ellipse(x, y - unit * 0.95, unit * (0.9 + pulse * 0.1), unit * (0.36 + pulse * 0.05), time * 0.15, 0, Math.PI * 2);
  context.stroke();
}

function drawNetworkLine(context, fromX, fromY, toX, toY, alpha) {
  const gradient = context.createLinearGradient(fromX, fromY, toX, toY);
  gradient.addColorStop(0, `rgba(140, 255, 0, ${alpha})`);
  gradient.addColorStop(0.55, `rgba(0, 163, 255, ${alpha * 0.75})`);
  gradient.addColorStop(1, "rgba(152, 203, 255, 0.05)");
  context.strokeStyle = gradient;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
}

function drawPulse(context, fromX, fromY, toX, toY, progress) {
  const x = fromX + (toX - fromX) * progress;
  const y = fromY + (toY - fromY) * progress;
  context.fillStyle = "rgba(140, 255, 0, 0.82)";
  context.shadowColor = "rgba(140, 255, 0, 0.75)";
  context.shadowBlur = 10;
  context.beginPath();
  context.arc(x, y, 2.4, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
}

function drawDiamond(context, x, y, width, height, fill, stroke) {
  const points = [
    [x, y - height * 0.5],
    [x + width * 0.5, y],
    [x, y + height * 0.5],
    [x - width * 0.5, y],
  ];
  fillPolygon(context, points, fill);
  context.strokeStyle = stroke;
  context.lineWidth = 1;
  strokePolygon(context, points);
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

function formatWallet(address) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

window.addEventListener("pagehide", () => homeWorldScene?.destroy(), { once: true });
