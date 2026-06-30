import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const languageStorageKey = "nicechunk.language";
const localeVersionPrefix = "nicechunk.roadmap.locale.version.";
const localeDataPrefix = "nicechunk.roadmap.locale.data.";
const supportedLanguages = new Set(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());

const languagePicker = document.querySelector(".roadmap-language");
const languageTrigger = document.querySelector(".roadmap-language-trigger");
const languageCurrent = document.querySelector(".roadmap-language-current");
const languageMenu = document.querySelector(".roadmap-language-menu");
const gridCanvas = document.querySelector("#roadmapGridCanvas");
const heroBadges = document.querySelector("#heroBadges");
const heroSignals = document.querySelector("#heroSignals");
const credibilityStats = document.querySelector("#credibilityStats");
const phaseTimeline = document.querySelector("#phaseTimeline");
const currentChecklist = document.querySelector("#currentChecklist");
const futureGrid = document.querySelector("#futureGrid");
const trustGrid = document.querySelector("#trustGrid");
const confidenceList = document.querySelector("#confidenceList");
const securityList = document.querySelector("#securityList");
const riskGrid = document.querySelector("#riskGrid");
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

let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || "en";
let dictionary = {};

initRoadmap();

async function initRoadmap() {
  setSiteLoadingProgress(32);
  dictionary = await loadRoadmapDictionary(activeLanguage);
  setSiteLoadingProgress(58);
  applyTranslations(document);
  renderContent();
  setupLanguageSwitcher();
  setupScrollLinks();
  setupGridAnimation(gridCanvas);
  finishSiteLoading();
}

async function loadRoadmapDictionary(language) {
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

  const response = await fetch(`/roadmap/locales/${language}.json?v=${encodeURIComponent(buildVersion)}`, { cache: "no-store" });
  if (!response.ok && language !== "en") return loadRoadmapDictionary("en");
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

function applyTranslations(root) {
  const title = text("meta.title");
  if (title) document.title = title;

  root.querySelectorAll("[data-roadmap-i18n]").forEach((element) => {
    const value = text(element.dataset.roadmapI18n);
    if (value) element.textContent = value;
  });

  root.querySelectorAll("[data-roadmap-i18n-aria-label]").forEach((element) => {
    const value = text(element.dataset.roadmapI18nAriaLabel);
    if (value) element.setAttribute("aria-label", value);
  });

  root.querySelectorAll("[data-roadmap-i18n-content]").forEach((element) => {
    const value = text(element.dataset.roadmapI18nContent);
    if (value) element.setAttribute("content", value);
  });

  document.documentElement.lang = activeLanguage;
}

function renderContent() {
  renderBadges();
  renderSignals();
  renderCredibilityStats();
  renderTimeline();
  renderCurrentChecklist();
  renderFutureGrid();
  renderTrustGrid();
  renderConfidenceList();
  renderSecurityList();
  renderRiskGrid();
}

function renderBadges() {
  renderList(heroBadges, list("hero.badges"), (label) => {
    const item = document.createElement("li");
    item.textContent = label;
    return item;
  });
}

function renderSignals() {
  renderList(heroSignals, list("hero.signals"), (signal) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = signal.label;
    const value = document.createElement("strong");
    value.textContent = signal.value;
    row.append(label, value);
    return row;
  });
}

function renderCredibilityStats() {
  renderList(credibilityStats, list("credibility.stats"), (stat) => {
    const card = document.createElement("article");
    card.className = "stat-card";
    card.innerHTML = `<span></span><strong></strong><p></p>`;
    card.querySelector("span").textContent = stat.label;
    card.querySelector("strong").textContent = stat.value;
    card.querySelector("p").textContent = stat.description;
    return card;
  });
}

function renderTimeline() {
  renderList(phaseTimeline, list("phases"), (phase) => {
    const card = document.createElement("article");
    card.className = `phase-card ${phase.status || "planned"}`;
    card.innerHTML = `
      <div class="phase-top">
        <span></span>
        <b></b>
      </div>
      <h3></h3>
      <p class="phase-period"></p>
      <p class="phase-summary"></p>
      <div class="confidence-bar"><i></i></div>
      <div class="phase-columns">
        <div><strong></strong><ul></ul></div>
        <div><strong></strong><ul></ul></div>
      </div>
    `;
    card.querySelector(".phase-top span").textContent = phase.phase;
    card.querySelector(".phase-top b").textContent = phase.statusLabel;
    card.querySelector("h3").textContent = phase.title;
    card.querySelector(".phase-period").textContent = phase.period;
    card.querySelector(".phase-summary").textContent = phase.summary;
    card.querySelector(".confidence-bar i").style.width = `${phase.confidence || 0}%`;
    const [goalsColumn, deliverablesColumn] = card.querySelectorAll(".phase-columns > div");
    goalsColumn.querySelector("strong").textContent = text("timeline.goalsLabel");
    deliverablesColumn.querySelector("strong").textContent = text("timeline.deliverablesLabel");
    appendBullets(goalsColumn.querySelector("ul"), phase.goals);
    appendBullets(deliverablesColumn.querySelector("ul"), phase.deliverables);
    return card;
  });
}

function renderCurrentChecklist() {
  renderList(currentChecklist, list("current.checklist"), (label) => {
    const item = document.createElement("li");
    item.textContent = label;
    return item;
  });
}

function renderFutureGrid() {
  renderCardGrid(futureGrid, list("future.items"));
}

function renderTrustGrid() {
  renderCardGrid(trustGrid, list("trust.items"));
}

function renderConfidenceList() {
  renderList(confidenceList, list("confidence.items"), (item) => {
    const row = document.createElement("article");
    row.className = "confidence-row";
    row.innerHTML = `
      <div><strong></strong><span></span></div>
      <b></b>
      <i><em></em></i>
    `;
    row.querySelector("strong").textContent = item.stage;
    row.querySelector("span").textContent = item.reason;
    row.querySelector("b").textContent = `${item.confidence}%`;
    row.querySelector("em").style.width = `${item.confidence}%`;
    return row;
  });
}

function renderSecurityList() {
  renderList(securityList, list("security.items"), (label) => {
    const item = document.createElement("li");
    item.textContent = label;
    return item;
  });
}

function renderRiskGrid() {
  renderList(riskGrid, list("risks.items"), (risk) => {
    const card = document.createElement("article");
    card.className = "risk-card";
    card.innerHTML = `<span></span><h3></h3><p></p><strong></strong>`;
    card.querySelector("span").textContent = risk.impact;
    card.querySelector("h3").textContent = risk.risk;
    card.querySelector("p").textContent = risk.response;
    card.querySelector("strong").textContent = text("risks.responseLabel");
    return card;
  });
}

function renderCardGrid(target, items) {
  renderList(target, items, (item, index) => {
    const card = document.createElement("article");
    card.className = "info-card";
    card.innerHTML = `<span></span><strong></strong><p></p>`;
    card.querySelector("span").textContent = String(index + 1).padStart(2, "0");
    card.querySelector("strong").textContent = item.title;
    card.querySelector("p").textContent = item.body;
    return card;
  });
}

function appendBullets(target, items = []) {
  target.replaceChildren(
    ...items.map((label) => {
      const item = document.createElement("li");
      item.textContent = label;
      return item;
    }),
  );
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
      option.className = "roadmap-language-option";
      option.type = "button";
      option.role = "option";
      option.dataset.roadmapLanguage = language.code;
      option.disabled = !language.enabled;
      option.innerHTML = `
        <span class="roadmap-language-option-name"></span>
        <span class="roadmap-language-option-native"></span>
        <span class="roadmap-language-option-status"></span>
      `;
      option.querySelector(".roadmap-language-option-name").textContent = language.englishName;
      option.querySelector(".roadmap-language-option-native").textContent = `(${language.nativeName})`;
      option.querySelector(".roadmap-language-option-status").textContent = language.enabled ? "" : "Coming Soon";
      option.addEventListener("click", async () => {
        const nextLanguage = normalizeLanguage(option.dataset.roadmapLanguage);
        if (!nextLanguage || nextLanguage === activeLanguage) {
          setLanguageMenuOpen(false);
          return;
        }
        activeLanguage = nextLanguage;
        localStorage.setItem(languageStorageKey, activeLanguage);
        dictionary = await loadRoadmapDictionary(activeLanguage);
        applyTranslations(document);
        renderContent();
        updateLanguagePicker();
        setLanguageMenuOpen(false);
      });
      return option;
    }),
  );
}

function updateLanguagePicker() {
  const active = plannedLanguages.find((language) => language.code === activeLanguage) ?? plannedLanguages[0];
  if (languageCurrent) languageCurrent.textContent = `${active.englishName} (${active.nativeName})`;
  languageMenu?.querySelectorAll(".roadmap-language-option").forEach((option) => {
    const selected = option.dataset.roadmapLanguage === activeLanguage;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setLanguageMenuOpen(open) {
  languagePicker?.classList.toggle("open", open);
  languageTrigger?.setAttribute("aria-expanded", String(open));
}

function setupScrollLinks() {
  document.querySelectorAll("[data-roadmap-scroll]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.getElementById(link.dataset.roadmapScroll || "");
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${target.id}`);
    });
  });
}

function setupGridAnimation(canvas) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  window.addEventListener("resize", resize);
  resize();

  function render(time) {
    resize();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0c0e12";
    context.fillRect(0, 0, width, height);

    const unit = 32;
    const offset = (time * 0.018) % unit;
    context.lineWidth = 1;
    for (let x = -unit; x < width + unit; x += unit) {
      context.strokeStyle = "rgba(0, 163, 255, 0.055)";
      context.beginPath();
      context.moveTo(x + offset, 0);
      context.lineTo(x + offset, height);
      context.stroke();
    }
    for (let y = -unit; y < height + unit; y += unit) {
      context.strokeStyle = "rgba(140, 255, 0, 0.042)";
      context.beginPath();
      context.moveTo(0, y + offset * 0.5);
      context.lineTo(width, y + offset * 0.5);
      context.stroke();
    }

    for (let i = 0; i < 40; i += 1) {
      const x = ((i * 137 + time * 0.018) % (width + 140)) - 70;
      const y = (Math.sin(time * 0.00045 + i) * 0.5 + 0.5) * height;
      const size = 2 + ((i * 7) % 4);
      context.fillStyle = i % 4 === 0 ? "rgba(140, 255, 0, 0.22)" : "rgba(0, 163, 255, 0.18)";
      context.fillRect(x, y, size, size);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

function renderList(target, items, factory) {
  if (!target) return;
  target.replaceChildren(...(items || []).map(factory));
}

function list(path) {
  const value = text(path);
  return Array.isArray(value) ? value : [];
}

function text(path) {
  return path.split(".").reduce((value, part) => (value && Object.hasOwn(value, part) ? value[part] : undefined), dictionary) ?? "";
}

function localeVersionKey(language) {
  return `${localeVersionPrefix}${language}`;
}

function localeDataKey(language) {
  return `${localeDataPrefix}${language}`;
}

function normalizeLanguage(language) {
  if (!language) return "";
  const normalized = String(language).trim();
  if (supportedLanguages.has(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg" || lower === "zh-hans") return "zh-Hans";
  return lower === "en" ? "en" : "";
}
