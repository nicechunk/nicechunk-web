import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const languageStorageKey = "nicechunk.language";
const localeVersionPrefix = "nicechunk.home.locale.version.";
const localeDataPrefix = "nicechunk.home.locale.data.";
const supportedLanguages = new Set(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());

const container = document.querySelector("#scrollContainer");
const sections = [...document.querySelectorAll(".snap-section")];
const dots = [...document.querySelectorAll(".side-dot")];
const header = document.querySelector("#siteHeader");
const shaderCanvas = document.querySelector("#voxelShader");
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
let mainnetIndex = null;
let activeSectionIndex = 0;

initHome();

async function initHome() {
  setSiteLoadingProgress(32);
  dictionary = await loadHomeDictionary(activeLanguage);
  setSiteLoadingProgress(58);
  applyHomeTranslations(document);
  updateWalletAction();
  setupLanguageSwitcher();
  setupSectionObserver();
  setupNavigation();
  setupMobileSectionPaging();
  setupShader(shaderCanvas, container);
  setupSeedChunkAnimation(seedChunkCanvas, seedValue);
  setupWatcherNetworkAnimation(watcherNetworkCanvas);
  finishSiteLoading();
}

async function loadHomeDictionary(language) {
  const mainnet = await fetchMainnetIndex();
  const locale = mainnet?.homeI18n?.locales?.[language];
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

  const url = locale?.url || `/home/locales/${language}.json`;
  const version = locale?.version || buildVersion;
  const response = await fetch(`${url}?v=${encodeURIComponent(version)}`, { cache: "no-store" });
  if (!response.ok && language !== "en") return loadHomeDictionary("en");
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

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = sections.indexOf(entry.target);
        setActiveSection(index);
      });
    },
    { root: container, threshold: 0.56 },
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
  sections.forEach((section, sectionIndex) => section.classList.toggle("active", sectionIndex === index));
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === index));
  header?.classList.toggle("scrolled", index > 0);
}

function setupShader(canvas, scrollRoot) {
  if (!canvas || !scrollRoot) return;
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    canvas.classList.add("shader-unavailable");
    return;
  }

  const vertexSource = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const fragmentSource = `
precision highp float;

varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_scrollProgress;
uniform vec2 u_mouse;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 uv = v_texCoord;
  vec2 center = (uv - 0.5) * 2.0;
  center.x *= u_resolution.x / u_resolution.y;

  vec3 blue = vec3(0.0, 0.639, 1.0);
  vec3 green = vec3(0.549, 1.0, 0.0);
  vec3 bg = vec3(0.047, 0.055, 0.071);

  float p = u_scrollProgress;
  float transition = abs(fract(p + 0.5) - 0.5) * 2.0;
  float snap = smoothstep(0.0, 1.0, 1.0 - transition);
  float zoom = mix(5.0, 20.0, snap);
  if (p < 0.85) {
    zoom = mix(1.0, 15.0, smoothstep(0.0, 1.0, p));
  }

  vec2 mouse = (u_mouse / u_resolution - 0.5) * 2.0;
  mouse.x *= u_resolution.x / u_resolution.y;
  vec2 pan = vec2(p * 3.0, p * 1.5) + vec2(u_time * 0.05, u_time * 0.03) + mouse * 0.08;
  vec2 grid = (center / zoom) * 8.0 + pan;
  vec2 id = floor(grid);
  vec2 f = fract(grid) - 0.5;

  float wave = sin(u_time * 0.8 + length(id) * 0.3) * 0.5 + 0.5;
  float box = sdBox(f, vec2(0.42 + wave * 0.04));
  float mask = smoothstep(0.01, 0.0, box);
  float edge = smoothstep(0.02, 0.0, abs(box));

  vec3 cube = mix(blue * 0.2, blue, wave);
  if (random(id + 13.0) > 0.85) {
    cube = mix(green * 0.2, green, wave);
  }

  vec3 color = mix(bg, cube, mask);
  color += edge * cube * 1.5;
  color += transition * blue * 0.05;
  color *= 1.0 - length(center * 0.4);

  gl_FragColor = vec4(color, 1.0);
}`;

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    time: gl.getUniformLocation(program, "u_time"),
    resolution: gl.getUniformLocation(program, "u_resolution"),
    scroll: gl.getUniformLocation(program, "u_scrollProgress"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
  };
  const mouse = { x: 0, y: 0 };
  let scrollProgress = 0;

  const syncSize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.floor(width * scale);
    const nextHeight = Math.floor(height * scale);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  };

  window.addEventListener("resize", syncSize);
  window.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width;
    mouse.y = (1 - (event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height;
  });
  scrollRoot.addEventListener("scroll", () => {
    scrollProgress = scrollRoot.scrollTop / Math.max(scrollRoot.clientHeight, 1);
  });

  syncSize();
  render(0);

  function render(time) {
    syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time * 0.001);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.scroll, scrollProgress);
    gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
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
