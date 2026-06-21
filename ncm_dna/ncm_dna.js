import { currentLanguage, initI18n, t } from "../src/i18n.js";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import { decodeNcm } from "../src/vox/ncm.js";
import {
  DEFAULT_SEARCH_CONFIG,
  NCM_AVATAR_SAMPLE_URL,
  decodeGene,
  decodeDnaSeed,
  encodeGene,
  estimateGeneSize,
  estimateRawSize,
  formatRatio,
  geneFromDnaSeed,
  generateRawVariation,
  growGene,
  hashModel,
  ncmBoxesToCuboids,
  randomGeneFromSeed,
  scoreModelMatch,
} from "./ncmDnaEngine.js";
import { createNcmDnaRenderer } from "./ncmDnaRenderer.js";
import "./style.css";

const els = {
  targetSeed: document.querySelector("#targetSeed"),
  targetSource: document.querySelector("#targetSource"),
  targetOrnaments: document.querySelector("#targetOrnaments"),
  generateTarget: document.querySelector("#generateTarget"),
  randomTarget: document.querySelector("#randomTarget"),
  revealHiddenGene: document.querySelector("#revealHiddenGene"),
  hiddenGeneCode: document.querySelector("#hiddenGeneCode"),
  searchMode: document.querySelector("#searchMode"),
  threadSelect: document.querySelector("#threadSelect"),
  maxCandidates: document.querySelector("#maxCandidates"),
  maxSeedLength: document.querySelector("#maxSeedLength"),
  startSearch: document.querySelector("#startSearch"),
  continuousSearch: document.querySelector("#continuousSearch"),
  pauseSearch: document.querySelector("#pauseSearch"),
  stopSearch: document.querySelector("#stopSearch"),
  resetSearch: document.querySelector("#resetSearch"),
  bestGeneCode: document.querySelector("#bestGeneCode"),
  bestSeedCode: document.querySelector("#bestSeedCode"),
  copyGene: document.querySelector("#copyGene"),
  copySeed: document.querySelector("#copySeed"),
  growGeneButton: document.querySelector("#growGeneButton"),
  growSeedButton: document.querySelector("#growSeedButton"),
  geneInput: document.querySelector("#geneInput"),
  seedInput: document.querySelector("#seedInput"),
  viewerMode: document.querySelector("#viewerMode"),
  renderMode: document.querySelector("#renderMode"),
  wireframeToggle: document.querySelector("#wireframeToggle"),
  resetCamera: document.querySelector("#resetCamera"),
  metricGrid: document.querySelector("#metricGrid"),
  searchLog: document.querySelector("#searchLog"),
  canvas: document.querySelector("#dnaViewer"),
};

const renderer = createNcmDnaRenderer(els.canvas);
const hardwareThreads = navigator.hardwareConcurrency || 2;
let workers = [];
let workerProgress = new Map();
let workerStatus = "idle";
let hiddenGene = null;
let targetModel = [];
let targetHash = "";
let bestModel = [];
let bestHash = "";
let bestGeneCode = "";
let bestSeedCode = "";
let latestProgress = null;
let paused = false;
let wireframe = false;
const logEntries = [];

setSiteLoadingProgress(30);
setupEvents();
await initI18n();
setSiteLoadingProgress(64);
await generateTarget();
setControlsEnabled(true);
finishSiteLoading();

window.addEventListener("nicechunk:languagechange", () => {
  document.title = t("ncmDna.page.title");
  renderMetrics();
  renderHiddenGene();
  renderSearchLog();
  els.pauseSearch.textContent = paused ? t("ncmDna.search.resume") : t("ncmDna.search.pause");
});

function setupEvents() {
  els.generateTarget.addEventListener("click", generateTarget);
  els.randomTarget.addEventListener("click", () => {
    els.targetSeed.value = randomSeed();
    generateTarget();
  });
  els.revealHiddenGene.addEventListener("change", renderHiddenGene);
  els.startSearch.addEventListener("click", startSearch);
  els.continuousSearch.addEventListener("click", () => startSearch({ continuous: true }));
  els.pauseSearch.addEventListener("click", togglePause);
  els.stopSearch.addEventListener("click", stopSearch);
  els.resetSearch.addEventListener("click", resetSearch);
  els.copyGene.addEventListener("click", copyGene);
  els.copySeed.addEventListener("click", copySeed);
  els.growGeneButton.addEventListener("click", growGeneFromInput);
  els.growSeedButton.addEventListener("click", growSeedFromInput);
  els.viewerMode.addEventListener("change", () => renderer.setView(els.viewerMode.value));
  els.renderMode.addEventListener("change", () => renderer.setMode(els.renderMode.value));
  els.wireframeToggle.addEventListener("click", () => {
    wireframe = !wireframe;
    els.wireframeToggle.classList.toggle("active", wireframe);
    renderer.setWireframe(wireframe);
  });
  els.resetCamera.addEventListener("click", renderer.resetCamera);
}

function setControlsEnabled(enabled) {
  [
    els.generateTarget,
    els.randomTarget,
    els.startSearch,
    els.continuousSearch,
    els.pauseSearch,
    els.stopSearch,
    els.resetSearch,
    els.copyGene,
    els.copySeed,
    els.growGeneButton,
    els.growSeedButton,
    els.wireframeToggle,
    els.resetCamera,
  ].forEach((control) => {
    control.disabled = !enabled;
  });
}

async function generateTarget() {
  stopSearch();
  const seed = els.targetSeed.value.trim() || "nicechunk-dna-001";
  const ornaments = els.targetOrnaments.value === "on";
  if (els.targetSource.value === "ncm-character") {
    hiddenGene = null;
    targetModel = await loadNcmCharacterTarget();
    els.searchMode.value = "seed-search";
  } else {
    hiddenGene = randomGeneFromSeed(seed, { ornaments });
    const baseModel = growGene(hiddenGene);
    targetModel = els.targetSource.value === "raw" ? generateRawVariation(baseModel, seed) : baseModel;
  }
  targetHash = hashModel(targetModel);
  bestModel = [];
  bestHash = "";
  bestGeneCode = "";
  bestSeedCode = "";
  latestProgress = null;
  workerStatus = "idle";
  paused = false;
  els.bestGeneCode.value = "";
  els.bestSeedCode.value = "";
  els.geneInput.value = "";
  els.seedInput.value = "";
  renderer.setModels(targetModel, []);
  renderer.setSearchLog([]);
  renderer.setView("target");
  els.viewerMode.value = "target";
  renderHiddenGene();
  renderMetrics();
  addLog("ncmDna.log.targetGenerated", { hash: targetHash });
}

async function loadNcmCharacterTarget() {
  const response = await fetch(`${NCM_AVATAR_SAMPLE_URL}?v=0.1.63`);
  if (!response.ok) throw new Error(`NCM sample request failed: ${response.status}`);
  const character = decodeNcm((await response.text()).trim());
  const cuboids = ncmBoxesToCuboids(character.boxes);
  addLog("ncmDna.log.ncmTargetLoaded", { boxes: cuboids.length });
  return cuboids;
}

function startSearch(options = {}) {
  stopSearch();
  workerStatus = "running";
  paused = false;
  workerProgress = new Map();
  renderer.setSearchLog([]);
  els.viewerMode.value = "compare";
  renderer.setView("compare");
  const continuous = Boolean(options.continuous);
  const mode = continuous ? "seed-search" : els.searchMode.value;
  if (continuous) els.searchMode.value = "seed-search";
  const workerCount = continuous ? getThreadCount() : 1;
  const baseConfig = {
    ...DEFAULT_SEARCH_CONFIG,
    mode,
    continuous,
    reportEvery: continuous ? 2500 : DEFAULT_SEARCH_CONFIG.reportEvery,
    maxCandidates: Number(els.maxCandidates.value) || DEFAULT_SEARCH_CONFIG.maxCandidates,
    maxSeedLength: normalizedMaxSeedLength(),
    threads: els.threadSelect.value,
    seedSpecies: seedSpeciesForCurrentTarget(),
    randomSalt: `${Date.now()}:${Math.random()}`,
  };
  workers = Array.from({ length: workerCount }, (_, workerIndex) => {
    const nextWorker = new Worker(new URL("./ncmDnaSearchWorker.js", import.meta.url), { type: "module" });
    nextWorker.addEventListener("message", (event) => handleWorkerMessage(workerIndex, event));
    nextWorker.addEventListener("error", (event) => {
      workerStatus = "stopped";
      addLog("ncmDna.log.workerError", { message: event.message });
      renderMetrics();
    });
    nextWorker.postMessage({
      type: "start",
      payload: {
        targetModel,
        targetHash,
        config: {
          ...baseConfig,
          workerIndex,
          workerCount,
        },
      },
    });
    return nextWorker;
  });
  addLog(continuous ? "ncmDna.log.continuousStarted" : "ncmDna.log.searchStarted", { threadsValue: workerCount });
  renderMetrics();
}

function togglePause() {
  if (!workers.length) return;
  paused = !paused;
  workerStatus = paused ? "paused" : "running";
  workers.forEach((worker) => worker.postMessage({ type: paused ? "pause" : "resume" }));
  els.pauseSearch.textContent = paused ? t("ncmDna.search.resume") : t("ncmDna.search.pause");
  addLog(paused ? "ncmDna.log.searchPaused" : "ncmDna.log.searchResumed");
  renderMetrics();
}

function stopSearch() {
  if (!workers.length) return;
  workers.forEach((worker) => {
    worker.postMessage({ type: "stop" });
    worker.terminate();
  });
  workers = [];
  workerStatus = "stopped";
  paused = false;
  els.pauseSearch.textContent = t("ncmDna.search.pause");
}

function resetSearch() {
  stopSearch();
  bestModel = [];
  bestHash = "";
  bestGeneCode = "";
  bestSeedCode = "";
  latestProgress = null;
  workerProgress = new Map();
  workerStatus = "idle";
  els.bestGeneCode.value = "";
  els.bestSeedCode.value = "";
  els.geneInput.value = "";
  els.seedInput.value = "";
  renderer.setModels(targetModel, []);
  renderer.setSearchLog([]);
  renderMetrics();
  addLog("ncmDna.log.searchReset");
}

function handleWorkerMessage(workerIndex, event) {
  const { type, payload } = event.data ?? {};
  if (type === "status") {
    workerStatus = payload.status;
    renderMetrics();
    return;
  }
  if (type === "error") {
    workerStatus = "stopped";
    addLog("ncmDna.log.workerError", { message: payload.message });
    renderMetrics();
    return;
  }
  if (payload) applyProgress(workerIndex, payload);
  if (type === "best") addLog("ncmDna.log.best", { scoreValue: payload.bestMatchScore, gene: payload.bestGeneCode });
  if (type === "success") {
    workerStatus = "success";
    addLog("ncmDna.log.success", { candidatesValue: payload.candidatesTested });
    if (!payload.continuous) stopWorkerAfterSuccess();
  }
}

function applyProgress(workerIndex, progress) {
  workerProgress.set(workerIndex, progress);
  const aggregate = aggregateWorkerProgress(progress);
  const currentScore = latestProgress?.bestMatchScore ?? -1;
  const incomingScore = progress.bestMatchScore ?? -1;
  const currentSize = latestProgress?.bestGeneSize ?? Infinity;
  const incomingSize = progress.bestGeneSize ?? Infinity;
  const betterBest = progress.bestGeneCode && (incomingScore > currentScore || (incomingScore === currentScore && incomingSize < currentSize));
  latestProgress = betterBest ? { ...progress, ...aggregate } : { ...(latestProgress ?? {}), ...aggregate };
  workerStatus = progress.status ?? workerStatus;
  if (betterBest) {
    bestGeneCode = progress.bestGeneCode || bestGeneCode;
    bestHash = progress.bestHash || bestHash;
    bestModel = progress.bestModel?.length ? progress.bestModel : bestModel;
    bestSeedCode = progress.bestSeedCode ?? "";
  }
  if (bestGeneCode) {
    els.bestGeneCode.value = bestGeneCode;
    els.geneInput.value = bestGeneCode;
  }
  if (bestSeedCode) {
    els.bestSeedCode.value = bestSeedCode;
    els.seedInput.value = bestSeedCode;
  } else if (betterBest) {
    els.bestSeedCode.value = "";
    els.seedInput.value = "";
  }
  renderer.setModels(targetModel, bestModel);
  renderer.setSearchLog(latestProgress?.recentSeedCodes ?? []);
  renderMetrics();
}

function aggregateWorkerProgress(fallback) {
  const values = [...workerProgress.values()];
  const candidates = values.reduce((sum, item) => sum + (item.candidatesTested || 0), 0);
  const speed = values.reduce((sum, item) => sum + (item.candidatesPerSecond || 0), 0);
  const generation = values.reduce((sum, item) => sum + (item.generationCount || 0), 0);
  const elapsedMs = Math.max(...values.map((item) => item.elapsedMs || 0), fallback.elapsedMs || 0);
  const recentSeedCodes = values.flatMap((item) => item.recentSeedCodes ?? []).sort(compareSeedLogLine).slice(-20);
  return {
    candidatesTested: candidates || fallback.candidatesTested || 0,
    candidatesPerSecond: speed || fallback.candidatesPerSecond || 0,
    generationCount: generation || fallback.generationCount || 0,
    elapsedMs,
    recentSeedCodes,
  };
}

function stopWorkerAfterSuccess() {
  if (!workers.length) return;
  workers.forEach((worker) => worker.terminate());
  workers = [];
  paused = false;
}

async function copyGene() {
  const code = els.bestGeneCode.value.trim();
  if (!code) return;
  await navigator.clipboard?.writeText(code);
  addLog("ncmDna.log.copied");
}

async function copySeed() {
  const code = els.bestSeedCode.value.trim();
  if (!code) return;
  await navigator.clipboard?.writeText(code);
  addLog("ncmDna.log.seedCopied");
}

function growSeedFromInput() {
  try {
    stopSearch();
    const code = els.seedInput.value.trim();
    const decoded = decodeDnaSeed(code);
    const gene = geneFromDnaSeed(code, { species: decoded.species, ornaments: true });
    bestSeedCode = decoded.code;
    bestGeneCode = encodeGene(gene);
    bestModel = growGene(gene);
    bestHash = hashModel(bestModel);
    els.bestSeedCode.value = bestSeedCode;
    els.bestGeneCode.value = bestGeneCode;
    els.geneInput.value = bestGeneCode;
    renderer.setModels(targetModel, bestModel);
    els.viewerMode.value = "best";
    renderer.setView("best");
    latestProgress = {
      ...(latestProgress ?? {}),
      bestSeedCode,
      bestGeneCode,
      bestHash,
      bestModel,
      bestGeneSize: estimateGeneSize(bestGeneCode),
      rawModelSize: estimateRawSize(targetModel),
      compressionRatio: estimateRawSize(targetModel) / estimateGeneSize(bestGeneCode),
      bytesSaved: Math.max(0, estimateRawSize(targetModel) - estimateGeneSize(bestGeneCode)),
      bestMatchScore: scoreModelMatch(bestModel, targetModel),
      exactMatch: bestHash === targetHash,
    };
    renderMetrics();
    addLog("ncmDna.log.seedGrown", { hash: bestHash });
  } catch (error) {
    addLog("ncmDna.log.invalidSeed", { message: error.message });
  }
}

function growGeneFromInput() {
  try {
    stopSearch();
    const code = els.geneInput.value.trim();
    const gene = decodeGene(code);
    bestSeedCode = "";
    bestGeneCode = encodeGene(gene);
    bestModel = growGene(gene);
    bestHash = hashModel(bestModel);
    els.bestSeedCode.value = "";
    els.seedInput.value = "";
    els.bestGeneCode.value = bestGeneCode;
    renderer.setModels(targetModel, bestModel);
    els.viewerMode.value = "best";
    renderer.setView("best");
    latestProgress = {
      ...(latestProgress ?? {}),
      bestSeedCode,
      bestGeneCode,
      bestHash,
      bestModel,
      bestGeneSize: estimateGeneSize(bestGeneCode),
      rawModelSize: estimateRawSize(targetModel),
      compressionRatio: estimateRawSize(targetModel) / estimateGeneSize(bestGeneCode),
      bytesSaved: Math.max(0, estimateRawSize(targetModel) - estimateGeneSize(bestGeneCode)),
      bestMatchScore: scoreModelMatch(bestModel, targetModel),
      exactMatch: bestHash === targetHash,
    };
    renderMetrics();
    addLog("ncmDna.log.geneGrown", { hash: bestHash });
  } catch (error) {
    addLog("ncmDna.log.invalidGene", { message: error.message });
  }
}

function renderHiddenGene() {
  els.hiddenGeneCode.hidden = !els.revealHiddenGene.checked;
  els.hiddenGeneCode.textContent = hiddenGene ? encodeGene(hiddenGene) : "";
}

function renderMetrics() {
  const rawSize = estimateRawSize(targetModel);
  const geneSize = latestProgress?.bestGeneSize ?? (bestGeneCode ? estimateGeneSize(bestGeneCode) : 0);
  const score = latestProgress?.bestMatchScore ?? (bestModel.length ? scoreModelMatch(bestModel, targetModel) : 0);
  const exact = (latestProgress?.exactMatch ?? false) || (bestHash && bestHash === targetHash);
  const metrics = [
    ["status", t("ncmDna.metrics.status"), t(`ncmDna.status.${workerStatus}`)],
    ["candidates", t("ncmDna.metrics.candidates"), formatInteger(latestProgress?.candidatesTested ?? 0)],
    ["speed", t("ncmDna.metrics.speed"), t("ncmDna.metrics.speedValue", { value: formatInteger(latestProgress?.candidatesPerSecond ?? 0) })],
    ["generation", t("ncmDna.metrics.generation"), formatInteger(latestProgress?.generationCount ?? 0)],
    ["geneSize", t("ncmDna.metrics.bestGeneSize"), geneSize ? t("ncmDna.metrics.bytes", { value: geneSize }) : "-"],
    ["rawSize", t("ncmDna.metrics.rawModelSize"), t("ncmDna.metrics.bytes", { value: rawSize })],
    ["ratio", t("ncmDna.metrics.ratio"), geneSize ? formatRatio(rawSize, geneSize) : "-"],
    ["score", t("ncmDna.metrics.score"), formatPercent(score)],
    ["targetHash", t("ncmDna.metrics.targetHash"), targetHash || "-"],
    ["bestHash", t("ncmDna.metrics.bestHash"), bestHash || latestProgress?.bestHash || "-"],
    ["bestSeed", t("ncmDna.metrics.bestSeed"), bestSeedCode || latestProgress?.bestSeedCode || "-"],
    ["seedLength", t("ncmDna.metrics.seedLength"), bestSeedCode ? String(bestSeedCode.length) : "-"],
    ["exact", t("ncmDna.metrics.exact"), exact ? t("ncmDna.common.yes") : t("ncmDna.common.no")],
    ["threads", t("ncmDna.metrics.threads"), threadLabel()],
    ["elapsed", t("ncmDna.metrics.elapsed"), formatElapsed(latestProgress?.elapsedMs ?? 0)],
    ["saved", t("ncmDna.metrics.saved"), geneSize ? t("ncmDna.metrics.bytes", { value: Math.max(0, rawSize - geneSize) }) : "-"],
  ];
  els.metricGrid.replaceChildren(
    ...metrics.map((metric) => {
      const card = document.createElement("article");
      card.className = "metric-card";
      card.dataset.metric = metric[0];
      const label = document.createElement("span");
      label.textContent = metric[1];
      const value = document.createElement("strong");
      value.textContent = metric[2];
      card.append(label, value);
      return card;
    }),
  );
}

function addLog(key, params = {}) {
  logEntries.unshift({ key, params, time: new Date() });
  if (logEntries.length > 18) logEntries.length = 18;
  renderSearchLog();
}

function renderSearchLog() {
  els.searchLog.replaceChildren(
    ...logEntries.map((entry) => {
      const row = document.createElement("div");
      row.textContent = `[${formatLogTime(entry.time)}] ${t(entry.key, formatLogParams(entry.params))}`;
      return row;
    }),
  );
}

function threadLabel() {
  const planned = getThreadCount();
  return t("ncmDna.metrics.threadValue", { value: formatInteger(workers.length || 1), planned: formatInteger(planned) });
}

function getThreadCount() {
  const selected = els.threadSelect.value;
  if (selected === "auto") return Math.max(1, hardwareThreads - 1);
  return Math.max(1, Number(selected) || 1);
}

function randomSeed() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `ncm-dna-${values[0].toString(36)}-${values[1].toString(36)}`;
}

function seedSpeciesForCurrentTarget() {
  return els.targetSource.value === "hidden" || els.targetSource.value === "raw" ? "humanoid" : "ncmAvatar";
}

function normalizedMaxSeedLength() {
  const value = Math.trunc(Number(els.maxSeedLength?.value));
  return Math.max(9, Math.min(64, Number.isFinite(value) ? value : DEFAULT_SEARCH_CONFIG.maxSeedLength));
}

function compareSeedLogLine(a, b) {
  return seedLogLineIndex(a) - seedLogLineIndex(b);
}

function seedLogLineIndex(line) {
  const match = /^#(\d+)/.exec(String(line));
  return match ? Number(match[1]) : 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat(currentLanguage()).format(Math.max(0, Math.round(Number(value) || 0)));
}

function formatPercent(value) {
  return new Intl.NumberFormat(currentLanguage(), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0, Math.min(1, Number(value) || 0)));
}

function formatElapsed(ms) {
  const seconds = Math.floor((Number(ms) || 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatLogTime(time) {
  return new Intl.DateTimeFormat(currentLanguage(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(time);
}

function formatLogParams(params = {}) {
  return {
    ...params,
    threads: params.threadsValue == null ? params.threads : formatInteger(params.threadsValue),
    candidates: params.candidatesValue == null ? params.candidates : formatInteger(params.candidatesValue),
    score: params.scoreValue == null ? params.score : formatPercent(params.scoreValue),
  };
}
