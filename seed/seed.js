import "./style.css";
import "../src/site-header.css";
import bs58 from "bs58";
import nacl from "tweetnacl";
import * as THREE from "three";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import { persistConnectedWallet } from "../src/walletSession.js";
import { assertNicechunkWalletNetwork, solanaClusterLabel } from "../src/solanaNetwork.js";

const languageStorageKey = "nicechunk.language";
const seedWalletStorageKey = "nicechunk.seed.wallet";
const seedEntryStorageKey = "nicechunk.seed.entry";
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());
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
const languageCodes = new Set(plannedLanguages.map((language) => language.code));
const dictionaryCache = new Map();

const languagePicker = document.querySelector(".seed-language");
const languageTrigger = document.querySelector(".seed-language-trigger");
const languageCurrent = document.querySelector(".seed-language-current");
const languageMenu = document.querySelector(".seed-language-menu");
const statusList = document.querySelector("#seedStatusList");
const walletValue = document.querySelector("#seedWalletValue");
const entryId = document.querySelector("#seedEntryId");
const consoleState = document.querySelector("#seedConsoleState");
const statusMessage = document.querySelector("#seedStatusMessage");
const faqList = document.querySelector("#seedFaqList");

let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || "en";
let dictionary = {};
let fallbackDictionary = {};
let selectedWallet = null;
let seedState = {
  provider: null,
  wallet: localStorage.getItem(seedWalletStorageKey) || "",
  walletName: "",
  challenge: null,
  entry: readStoredEntry(),
  busy: false,
  error: "",
};

void initSeedPage();

async function initSeedPage() {
  setSiteLoadingProgress(34);
  dictionary = await loadDictionary(activeLanguage);
  applyTranslations(document);
  setupLanguageSwitcher();
  setupSeedActions();
  initSeedVisuals();
  renderStatus();
  renderFaq();
  if (seedState.wallet) void refreshEntryStatus(seedState.wallet);
  setSiteLoadingProgress(88);
  finishSiteLoading();
}

function initSeedVisuals() {
  initSeedShader();
  initSeedVoxelCore();
}

function initSeedShader() {
  const canvas = document.querySelector("#seedShaderCanvas");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) return;
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = v_uv;
      vec2 centered = uv - 0.5;
      float vignette = smoothstep(0.82, 0.16, length(centered));
      vec3 color = vec3(0.012, 0.025, 0.052);
      color += vec3(0.0, 0.22, 0.32) * (0.5 + 0.5 * sin(uv.x * 4.2 + u_time * 0.18)) * 0.22;
      color += vec3(0.08, 0.12, 0.02) * (0.5 + 0.5 * cos(uv.y * 5.0 - u_time * 0.12)) * 0.08;
      for (float i = 0.0; i < 3.0; i++) {
        float scale = mix(120.0, 420.0, i / 2.0);
        vec2 cell = floor((uv + vec2(u_time * 0.003 * (i + 1.0), 0.0)) * scale);
        float h = hash(cell);
        if (h > 0.994) {
          float blink = 0.35 + 0.65 * sin(u_time * (0.8 + h * 5.0));
          color += vec3(0.0, 0.95, 1.0) * blink * (h - 0.994) * 115.0;
        }
      }
      float beam = smoothstep(0.012, 0.0, abs(centered.x * 0.56 + centered.y - 0.04 * sin(u_time * 0.4)));
      color += vec3(0.0, 0.72, 0.92) * beam * 0.08;
      gl_FragColor = vec4(color * vignette, 0.86);
    }
  `;
  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!program || !vertexShader || !fragmentShader) return;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeUniform = gl.getUniformLocation(program, "u_time");
  const resolutionUniform = gl.getUniformLocation(program, "u_resolution");

  const render = (time) => {
    const width = Math.max(1, Math.floor(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)));
    const height = Math.max(1, Math.floor(canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 1.5)));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform1f(timeUniform, time * 0.001);
    gl.uniform2f(resolutionUniform, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function initSeedVoxelCore() {
  const canvas = document.querySelector("#seedVoxelCanvas");
  const stage = document.querySelector(".seed-voxel-backdrop");
  if (!canvas || !stage) return;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0.55, 7.2);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

  const core = new THREE.Group();
  scene.add(core);
  const box = new THREE.BoxGeometry(0.86, 0.86, 0.86);
  const cyan = new THREE.MeshPhongMaterial({
    color: 0x00f0ff,
    emissive: 0x003744,
    shininess: 90,
    transparent: true,
    opacity: 0.82,
  });
  const lime = new THREE.MeshPhongMaterial({
    color: 0xccff00,
    emissive: 0x263300,
    shininess: 80,
    transparent: true,
    opacity: 0.78,
  });
  const gold = new THREE.MeshPhongMaterial({
    color: 0xffd700,
    emissive: 0x3d2f00,
    shininess: 100,
    transparent: true,
    opacity: 0.86,
  });

  const size = 5;
  const spacing = 1.03;
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let z = 0; z < size; z += 1) {
        const distance = Math.abs(x - 2) + Math.abs(y - 2) + Math.abs(z - 2);
        const keep = distance < 5 && ((x * 13 + y * 7 + z * 5) % 4 !== 0 || distance < 2);
        if (!keep) continue;
        const material = distance < 2 ? gold : (x + y + z) % 5 === 0 ? lime : cyan;
        const mesh = new THREE.Mesh(box, material);
        mesh.position.set((x - 2) * spacing, (y - 2) * spacing, (z - 2) * spacing);
        mesh.userData.float = (x * 17 + y * 11 + z * 5) * 0.08;
        mesh.userData.baseY = mesh.position.y;
        core.add(mesh);
      }
    }
  }
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  const key = new THREE.PointLight(0x00f0ff, 2.2, 34);
  key.position.set(5, 6, 7);
  scene.add(key);
  const rim = new THREE.PointLight(0xccff00, 1.2, 28);
  rim.position.set(-6, -3, 6);
  scene.add(rim);

  const resize = () => {
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    core.position.set(camera.aspect > 1.15 ? 2.95 : 0.45, camera.aspect > 1.15 ? 0.42 : -0.82, 0);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const animate = (time) => {
    const seconds = time * 0.001;
    core.rotation.x = 0.52 + Math.sin(seconds * 0.32) * 0.08;
    core.rotation.y = seconds * 0.42;
    core.rotation.z = Math.sin(seconds * 0.22) * 0.05;
    core.scale.setScalar((camera.aspect > 1.15 ? 1.42 : 1.04) + Math.sin(seconds * 1.2) * 0.025);
    core.children.forEach((child) => {
      if (child.isMesh) child.position.y = child.userData.baseY + Math.sin(seconds * 2 + child.userData.float) * 0.035;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function applyTranslations(root) {
  const title = text("meta.title");
  if (title) document.title = title;
  root.querySelectorAll("[data-seed-i18n]").forEach((element) => {
    const value = text(element.dataset.seedI18n);
    if (value) element.textContent = value;
  });
  root.querySelectorAll("[data-seed-i18n-aria-label]").forEach((element) => {
    const value = text(element.dataset.seedI18nAriaLabel);
    if (value) element.setAttribute("aria-label", value);
  });
  root.querySelectorAll("[data-seed-i18n-content]").forEach((element) => {
    const value = text(element.dataset.seedI18nContent);
    if (value) element.setAttribute("content", value);
  });
  document.documentElement.lang = activeLanguage;
}

function text(path) {
  return path.split(".").reduce((current, part) => (current && Object.hasOwn(current, part) ? current[part] : undefined), dictionary)
    ?? path.split(".").reduce((current, part) => (current && Object.hasOwn(current, part) ? current[part] : undefined), fallbackDictionary)
    ?? "";
}

function setupLanguageSwitcher() {
  renderLanguageMenu();
  updateLanguagePicker();
  languageTrigger?.addEventListener("click", () => setLanguageMenuOpen(!languagePicker?.classList.contains("open")));
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
      option.className = "seed-language-option language-option";
      option.type = "button";
      option.dataset.seedLanguage = language.code;
      option.setAttribute("role", "option");
      option.innerHTML = `
        <span class="language-option-name"></span>
        <span class="language-option-native"></span>
        <span class="language-option-status"></span>
      `;
      option.querySelector(".language-option-name").textContent = language.englishName;
      option.querySelector(".language-option-native").textContent = language.nativeName;
      option.addEventListener("click", async () => {
        const nextLanguage = normalizeLanguage(option.dataset.seedLanguage);
        if (!nextLanguage) return;
        activeLanguage = nextLanguage;
        dictionary = await loadDictionary(activeLanguage);
        localStorage.setItem(languageStorageKey, activeLanguage);
        applyTranslations(document);
        renderStatus();
        renderFaq();
        updateLanguagePicker();
        setLanguageMenuOpen(false);
      });
      return option;
    }),
  );
}

function updateLanguagePicker() {
  const active = plannedLanguages.find((language) => language.code === activeLanguage) || plannedLanguages[0];
  if (languageCurrent) languageCurrent.textContent = `${active.englishName} (${active.nativeName})`;
  languageMenu?.querySelectorAll(".seed-language-option").forEach((option) => {
    const selected = option.dataset.seedLanguage === activeLanguage;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
    const status = option.querySelector(".language-option-status");
    if (status) status.textContent = selected ? text("language.active") : "";
  });
}

function setLanguageMenuOpen(open) {
  languagePicker?.classList.toggle("open", open);
  languageTrigger?.setAttribute("aria-expanded", String(open));
}

async function loadDictionary(language) {
  const normalized = normalizeLanguage(language) || "en";
  if (dictionaryCache.has(normalized)) return dictionaryCache.get(normalized);
  const response = await fetch(`/seed/locales/${normalized}.json?v=${encodeURIComponent(buildVersion)}`, { cache: "no-store" });
  if (!response.ok) {
    if (normalized !== "en") return loadDictionary("en");
    return {};
  }
  const nextDictionary = await response.json();
  dictionaryCache.set(normalized, nextDictionary);
  if (normalized === "en") fallbackDictionary = nextDictionary;
  return nextDictionary;
}

function setupSeedActions() {
  document.querySelectorAll("[data-seed-action='connect-wallet']").forEach((button) => {
    button.addEventListener("click", () => connectSeedWallet());
  });
  document.querySelectorAll("[data-seed-action='join-whitelist']").forEach((button) => {
    button.addEventListener("click", () => joinSeedWhitelist());
  });
}

async function connectSeedWallet() {
  if (seedState.busy) return;
  const wallet = detectWallets()[0];
  if (!wallet) {
    setSeedError("No Solana wallet detected. Install Phantom, Solflare, or Backpack, then retry.");
    return;
  }
  selectedWallet = wallet;
  setBusy(true, "CONNECTING WALLET", `Opening ${wallet.name} authorization...`);
  try {
    const result = await wallet.provider.connect();
    const publicKey = publicKeyToString(result?.publicKey || wallet.provider.publicKey);
    if (!publicKey) throw new Error("Missing wallet public key.");
    await ensureSeedWalletNetwork(wallet.provider);
    persistConnectedWallet({ walletAddress: publicKey, walletName: wallet.name });
    localStorage.setItem(seedWalletStorageKey, publicKey);
    seedState = { ...seedState, provider: wallet.provider, wallet: publicKey, walletName: wallet.name, error: "" };
    await refreshEntryStatus(publicKey);
    setSeedMessage("WALLET CONNECTED", "Wallet connected. Sign the whitelist proof to store your registration.");
  } catch (error) {
    setSeedError(readableSeedError(error));
  } finally {
    setBusy(false);
    renderStatus();
  }
}

async function joinSeedWhitelist() {
  if (seedState.busy) return;
  if (!seedState.wallet || !seedState.provider) await connectSeedWallet();
  if (!seedState.wallet || !seedState.provider) return;
  if (typeof seedState.provider.signMessage !== "function") {
    setSeedError("This wallet does not expose signMessage. Open the page inside Phantom, Solflare, or Backpack.");
    return;
  }

  setBusy(true, "REQUESTING PROOF", "Preparing a one-time whitelist proof for your wallet...");
  try {
    const challenge = await apiPost("/api/seed/challenge", {
      wallet: seedState.wallet,
      walletName: seedState.walletName || selectedWallet?.name || "Solana Wallet",
      origin: window.location.origin,
    });
    seedState.challenge = challenge;
    setSeedMessage("SIGNATURE REQUIRED", "Sign the whitelist proof. This does not authorize a transaction or transfer funds.");
    const encodedMessage = new TextEncoder().encode(challenge.message);
    const signResult = await seedState.provider.signMessage(encodedMessage, "utf8");
    const signature = signatureToBytes(signResult);
    if (!signature?.length) throw new Error("Missing wallet signature.");
    if (!nacl.sign.detached.verify(encodedMessage, signature, bs58.decode(seedState.wallet))) {
      throw new Error("Local wallet signature verification failed.");
    }
    setSeedMessage("SUBMITTING REGISTRATION", "Signature verified locally. Submitting your seed user registration...");
    const result = await apiPost("/api/seed/join", {
      wallet: seedState.wallet,
      walletName: seedState.walletName || selectedWallet?.name || "Solana Wallet",
      nonce: challenge.nonce,
      message: challenge.message,
      signature: bs58.encode(signature),
    });
    seedState.entry = result.entry;
    localStorage.setItem(seedEntryStorageKey, JSON.stringify(result.entry));
    setSeedMessage("REGISTRATION RECEIVED", text("status.registeredMessage") || "Your registration has been received. Please follow campaign announcements.");
  } catch (error) {
    setSeedError(readableSeedError(error));
  } finally {
    setBusy(false);
    renderStatus();
  }
}

async function refreshEntryStatus(wallet) {
  if (!wallet) return;
  try {
    const response = await fetch(`/api/seed/status?wallet=${encodeURIComponent(wallet)}`, { headers: { accept: "application/json" } });
    const payload = await response.json();
    if (payload?.entry) {
      seedState.entry = payload.entry;
      localStorage.setItem(seedEntryStorageKey, JSON.stringify(payload.entry));
    }
  } catch (error) {
    console.warn("Failed to refresh seed whitelist status", error);
  } finally {
    renderStatus();
  }
}

function detectWallets() {
  const candidates = [
    { id: "phantom", name: "Phantom", provider: window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null) },
    { id: "solflare", name: "Solflare", provider: window.solflare || (window.solana?.isSolflare ? window.solana : null) },
    { id: "backpack", name: "Backpack", provider: window.backpack?.solana || (window.solana?.isBackpack ? window.solana : null) },
    { id: "solana", name: "Solana Wallet", provider: window.solana },
  ];
  const seen = new Set();
  return candidates.filter((wallet) => {
    if (!wallet.provider || typeof wallet.provider.connect !== "function") return false;
    if (seen.has(wallet.provider)) return false;
    seen.add(wallet.provider);
    return true;
  });
}

async function ensureSeedWalletNetwork(provider) {
  await assertNicechunkWalletNetwork(provider, {
    requestSwitch: true,
    onStatus: ({ type, requiredCluster }) => {
      if (type === "switching") setSeedMessage("SWITCHING NETWORK", `Switching wallet to Solana ${solanaClusterLabel(requiredCluster)}...`);
      if (type === "ready") setSeedMessage("NETWORK VERIFIED", `Wallet network: Solana ${solanaClusterLabel(requiredCluster)}.`);
    },
  });
}

async function apiPost(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const reason = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(reason);
  }
  return payload;
}

function renderStatus() {
  const walletConnected = Boolean(seedState.wallet);
  const registered = Boolean(seedState.entry?.id || seedState.entry?.wallet);
  if (walletValue) {
    walletValue.textContent = walletConnected ? formatAddress(seedState.wallet) : text("status.notConnected") || "Not connected";
    walletValue.classList.toggle("connected", walletConnected);
    walletValue.title = seedState.wallet || "";
  }
  if (entryId) {
    entryId.textContent = registered
      ? `${text("status.entryPrefix") || "Registration"} #${seedState.entry.id ?? "registered"} · ${seedState.entry.status ?? "registered"}`
      : text("status.noEntry") || "No registration record yet";
  }
  if (consoleState) {
    consoleState.textContent = seedState.busy
      ? consoleState.textContent
      : registered
        ? "REGISTRATION STORED"
        : walletConnected
          ? "WALLET VERIFIED"
          : "WAITING FOR WALLET";
  }
  if (!seedState.busy && statusMessage) {
    statusMessage.textContent = seedState.error || (registered
      ? text("status.registeredMessage") || "Your registration has been received. Please follow campaign announcements."
      : walletConnected
        ? text("status.walletConnectedMessage") || "Wallet connected. Sign the whitelist proof to submit your registration."
        : text("status.note") || "Connect a Solana wallet, sign a whitelist proof, and submit your registration.");
  }
  if (!statusList) return;
  const statusCopy = Array.isArray(dictionary.status?.states) ? dictionary.status.states : (fallbackDictionary.status?.states ?? []);
  const rows = [
    { done: walletConnected, copy: statusCopy[0] },
    { done: registered, copy: statusCopy[2] },
    { done: registered, copy: statusCopy[3] },
  ];
  statusList.replaceChildren(...rows.map((item) => {
    const row = document.createElement("div");
    row.className = "seed-status-row";
    row.classList.toggle("done", item.done);
    row.innerHTML = `
      <span class="seed-status-dot" aria-hidden="true"></span>
      <div>
        <strong></strong>
        <p></p>
      </div>
    `;
    row.querySelector("strong").textContent = item.copy?.label || "";
    row.querySelector("p").textContent = item.done ? item.copy?.done || "" : item.copy?.idle || "";
    return row;
  }));
  document.querySelectorAll("[data-seed-action]").forEach((button) => {
    button.disabled = seedState.busy;
  });
}

function renderFaq() {
  if (!faqList) return;
  const items = Array.isArray(dictionary.faq?.items) ? dictionary.faq.items : (fallbackDictionary.faq?.items ?? []);
  faqList.replaceChildren(
    ...items.map((item, index) => {
      const details = document.createElement("details");
      if (index === 0) details.open = true;
      details.innerHTML = `
        <summary></summary>
        <p></p>
      `;
      details.querySelector("summary").textContent = item.question;
      details.querySelector("p").textContent = item.answer;
      return details;
    }),
  );
}

function setBusy(busy, state = "", message = "") {
  seedState.busy = busy;
  document.body.classList.toggle("seed-busy", busy);
  if (state && consoleState) consoleState.textContent = state;
  if (message && statusMessage) statusMessage.textContent = message;
  renderStatus();
}

function setSeedMessage(state, message) {
  seedState.error = "";
  if (state && consoleState) consoleState.textContent = state;
  if (message && statusMessage) statusMessage.textContent = message;
}

function setSeedError(message) {
  seedState.error = message || "Seed registration failed.";
  if (consoleState) consoleState.textContent = "ACTION REQUIRED";
  if (statusMessage) statusMessage.textContent = seedState.error;
  renderStatus();
}

function publicKeyToString(publicKey) {
  return typeof publicKey?.toString === "function" ? publicKey.toString() : String(publicKey || "");
}

function signatureToBytes(signResult) {
  if (signResult instanceof Uint8Array) return signResult;
  if (signResult?.signature instanceof Uint8Array) return signResult.signature;
  if (Array.isArray(signResult?.signature)) return new Uint8Array(signResult.signature);
  if (Array.isArray(signResult)) return new Uint8Array(signResult);
  return null;
}

function readableSeedError(error) {
  const code = String(error?.code || "");
  if (code.startsWith("nicechunk_network_")) {
    const expected = solanaClusterLabel(error.requiredCluster);
    return `Switch your wallet to Solana ${expected}, then retry.`;
  }
  return error?.message || String(error || "Seed registration failed.");
}

function formatAddress(address) {
  return address && address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-6)}` : address || "";
}

function readStoredEntry() {
  try {
    return JSON.parse(localStorage.getItem(seedEntryStorageKey) || "null");
  } catch {
    return null;
  }
}

function normalizeLanguage(language) {
  if (!language) return "";
  if (language === "zh" || language === "zh-CN" || language === "zh-SG") return "zh-Hans";
  if (language === "zh-TW" || language === "zh-HK" || language === "zh-MO") return "zh-Hant";
  if (languageCodes.has(language)) return language;
  const base = language.split("-")[0];
  return languageCodes.has(base) ? base : "";
}
