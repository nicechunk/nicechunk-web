import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { initI18n, t } from "../src/i18n.js";
import { parseVox } from "../src/vox/ncm.js";

const FUNCTION_CODEC_ID = "0";
const GLOBAL_PALETTE_ID = "G0";
const GLOBAL_PALETTE = createGlobalPalette();
const DEFAULT_MERGE_STRATEGY = { seedAxes: ["z", "y", "x"], growAxes: ["w", "d", "h"] };
const POW_BATCH_MS = 24;
const POW_LOG_LIMIT = 80;

const els = {
  sourceCanvas: document.querySelector("#sourceScene"),
  functionCanvas: document.querySelector("#functionScene"),
  powCanvas: document.querySelector("#powScene"),
  status: document.querySelector("#buildStatus"),
  fileInput: document.querySelector("#voxFile"),
  dropZone: document.querySelector("#dropZone"),
  compute: document.querySelector("#computeFunction"),
  optimize: document.querySelector("#optimizeFunction"),
  exprBytesRange: document.querySelector("#exprBytesRange"),
  basisRange: document.querySelector("#basisRange"),
  scaleRange: document.querySelector("#scaleRange"),
  sourceBadge: document.querySelector("#sourceBadge"),
  functionBadge: document.querySelector("#functionBadge"),
  powBadge: document.querySelector("#powBadge"),
  gridMetric: document.querySelector("#gridMetric"),
  coefMetric: document.querySelector("#coefMetric"),
  voxelMetric: document.querySelector("#voxelMetric"),
  storageMetric: document.querySelector("#storageMetric"),
  paletteStrip: document.querySelector("#paletteStrip"),
  formula: document.querySelector("#formulaBlock"),
  algorithm: document.querySelector("#algorithmBlock"),
  coefBlock: document.querySelector("#coefBlock"),
  copyGene: document.querySelector("#copyGene"),
  startPow: document.querySelector("#startPow"),
  stopPow: document.querySelector("#stopPow"),
  powHashrate: document.querySelector("#powHashrate"),
  powAttempts: document.querySelector("#powAttempts"),
  powBest: document.querySelector("#powBest"),
  powBytes: document.querySelector("#powBytes"),
  powLog: document.querySelector("#powLog"),
  steps: [...document.querySelectorAll("#steps li")],
};

const sourceViewer = createViewer(els.sourceCanvas, 0x111515);
const functionViewer = createViewer(els.functionCanvas, 0x101417);
const powViewer = createViewer(els.powCanvas, 0x121416);
const state = {
  source: null,
  palette: [],
  basis: [],
  functionVoxels: 0,
  payload: "",
  payloadBytes: 0,
  strategyName: "",
  pow: createPowState(),
};

await initI18n();
setupEvents();
renderEmptyState();
animate();

window.addEventListener("nicechunk:languagechange", () => {
  document.title = t("ncmFourier.page.title");
  if (!state.source) renderEmptyState();
  else renderPanels();
});

function setupEvents() {
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];
    if (file) await loadVoxFile(file);
  });

  els.compute.addEventListener("click", computeFunctionModel);
  els.optimize.addEventListener("click", optimizeFunctionModel);
  els.startPow.addEventListener("click", startPowDemo);
  els.stopPow.addEventListener("click", () => stopPowDemo(t("ncmFourier.pow.stopped")));
  els.exprBytesRange.addEventListener("input", () => {
    if (!state.pow.running) els.powBytes.textContent = `${Number(els.exprBytesRange.value)} B`;
  });
  els.basisRange.addEventListener("input", () => {
    if (state.basis.length) computeFunctionModel();
  });
  els.scaleRange.addEventListener("input", () => {
    if (state.source) renderSourceModel();
    if (state.basis.length) renderFunctionModel();
    if (state.pow.best.boxes.length) renderPowModel();
  });
  els.copyGene.addEventListener("click", copyFunction);

  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragging"));
  els.dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) await loadVoxFile(file);
  });

  window.addEventListener("resize", resizeAll, { passive: true });
}

async function loadVoxFile(file) {
  try {
    stopPowDemo();
    setStatus(t("ncmFourier.status.loading"));
    const bytes = await file.arrayBuffer();
    const vox = parseVox(bytes);
    const model = vox.models[0];
    if (!model || !model.voxels.length) throw new Error("VOX file does not contain voxel data.");
    state.source = normalizeModel(model, file.name);
    state.palette = buildPalette(state.source.voxels);
    state.basis = [];
    state.functionVoxels = 0;
    state.payload = "";
    state.payloadBytes = 0;
    state.strategyName = "";
    state.pow = createPowState();
    renderSourceModel();
    clearPowModel();
    renderPanels();
    renderPowEmpty();
    setActiveStep("sample");
    els.compute.disabled = false;
    els.optimize.disabled = false;
    els.startPow.disabled = false;
    setStatus(t("ncmFourier.status.loaded"));
  } catch (error) {
    setStatus(t("ncmFourier.status.failed", { reason: error.message }));
  }
}

function startPowDemo() {
  if (!state.source || state.pow.running) return;
  state.pow = {
    ...createPowState(),
    running: true,
    target: createTargetSet(state.source.voxels),
    seed: (Date.now() ^ state.source.voxels.length ^ state.source.hash.length) >>> 0,
    startedAt: performance.now(),
    lastUpdateAt: performance.now(),
  };
  els.startPow.disabled = true;
  els.stopPow.disabled = false;
  appendPowLog(t("ncmFourier.pow.started", { hash: state.source.hash, voxels: state.source.voxels.length }));
  runPowBatch();
}

function stopPowDemo(message = "") {
  if (!state.pow.running) return;
  state.pow.running = false;
  els.startPow.disabled = !state.source;
  els.stopPow.disabled = true;
  if (message) appendPowLog(message);
}

function runPowBatch() {
  if (!state.pow.running) return;
  const batchStart = performance.now();
  while (performance.now() - batchStart < POW_BATCH_MS) {
    state.pow.seed = (state.pow.seed + 1) >>> 0;
    const candidate = createPowCandidate(state.pow.seed);
    const score = scorePowCandidate(candidate, state.pow.target);
    state.pow.attempts += 1;
    if (isBetterPowScore(score, candidate, state.pow.best)) {
      state.pow.best = { ...score, boxes: candidate.boxes, expr: candidate.expr, bytes: candidate.bytes, seed: state.pow.seed, proof: candidate.proof };
      renderPowModel();
      appendPowLog(
        t("ncmFourier.pow.bestLog", {
          seed: state.pow.seed.toString(36),
          score: formatPercent(score.ratio),
          hit: score.hit,
          union: score.union,
          bytes: candidate.bytes,
          proof: candidate.proof,
          expr: candidate.expr,
        }),
      );
    }
  }

  const now = performance.now();
  if (now - state.pow.lastUpdateAt >= 160) {
    state.pow.lastUpdateAt = now;
    renderPowStats();
  }
  requestAnimationFrame(runPowBatch);
}

function createPowCandidate(seed) {
  const rng = createRng(seed);
  const size = state.source.size;
  const exprBytes = Number(els.exprBytesRange.value) || 8;
  const colors = state.palette.length ? state.palette.map((entry) => entry.index) : [0];
  const boxes = [];
  const boxBudget = Math.max(1, Math.floor((exprBytes - 2) / 2));
  const boxCount = 1 + (seed % Math.min(12, boxBudget));
  for (let index = 0; index < boxCount; index += 1) {
    const colorIndex = colors[Math.floor(rng() * colors.length)] ?? 0;
    const x = Math.floor(rng() * size.x);
    const y = Math.floor(rng() * size.y);
    const z = Math.floor(rng() * size.z);
    const w = 1 + Math.floor(rng() * Math.max(1, size.x - x));
    const d = 1 + Math.floor(rng() * Math.max(1, size.y - y));
    const h = 1 + Math.floor(rng() * Math.max(1, size.z - z));
    boxes.push({ x, y, z, w, d, h, colorIndex, color: GLOBAL_PALETTE[colorIndex] });
  }
  const expr = createFixedLengthExpression(seed, exprBytes);
  return { seed, expr, boxes, bytes: exprBytes, proof: hashText(`${state.source.hash}|${expr}`) };
}

function scorePowCandidate(candidate, target) {
  const seen = new Set();
  let hit = 0;
  for (const voxel of expandBasisToVoxels(candidate.boxes)) {
    const key = voxelKey(voxel.x, voxel.y, voxel.z);
    const value = `${key},${voxel.colorIndex}`;
    if (seen.has(value)) continue;
    seen.add(value);
    if (target.exact.has(value)) hit += 1;
  }
  const extra = Math.max(0, seen.size - hit);
  const missing = Math.max(0, target.exact.size - hit);
  const union = target.exact.size + seen.size - hit;
  const ratio = union ? hit / union : 0;
  const score = Math.round(ratio * 1000000) - missing - extra;
  return { hit, missing, extra, union, score, ratio };
}

function isBetterPowScore(score, candidate, best) {
  return (
    score.ratio > best.ratio ||
    (score.ratio === best.ratio && score.score > best.score) ||
    (score.ratio === best.ratio && score.score === best.score && candidate.bytes < best.bytes)
  );
}

function createTargetSet(voxels) {
  return {
    exact: new Set(voxels.map((voxel) => `${voxel.x},${voxel.y},${voxel.z},${voxel.colorIndex}`)),
  };
}

function createFixedLengthExpression(seed, byteLength) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";
  const chars = ["1", ":"];
  let value = seed >>> 0;
  while (chars.length < byteLength) {
    value = (Math.imul(value ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
    chars.push(alphabet[value & 0x3f]);
  }
  return chars.slice(0, byteLength).join("");
}

function renderPowStats() {
  const elapsed = Math.max(1, performance.now() - state.pow.startedAt);
  const hashrate = (state.pow.attempts / elapsed) * 1000;
  els.powHashrate.textContent = `${formatNumber(hashrate)} H/s`;
  els.powAttempts.textContent = formatInteger(state.pow.attempts);
  els.powBest.textContent = formatPercent(state.pow.best.ratio);
  els.powBadge.textContent = formatPercent(state.pow.best.ratio);
  els.powBytes.textContent = state.pow.best.bytes === Infinity ? `${Number(els.exprBytesRange.value) || 8} B` : formatBytes(state.pow.best.bytes);
}

function appendPowLog(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  state.pow.logs.unshift(line);
  state.pow.logs = state.pow.logs.slice(0, POW_LOG_LIMIT);
  els.powLog.textContent = state.pow.logs.join("\n");
}

function normalizeModel(model, name) {
  const size = {
    x: Math.max(1, model.size?.x ?? 1),
    y: Math.max(1, model.size?.y ?? 1),
    z: Math.max(1, model.size?.z ?? 1),
  };
  const voxels = model.voxels.map((voxel) => {
    const globalColor = nearestGlobalColor(normalizeColor(voxel.color));
    return {
      x: voxel.x,
      y: voxel.y,
      z: voxel.z,
      color: globalColor.color,
      colorIndex: globalColor.index,
    };
  });
  return { name, size, voxels, hash: hashVoxels(size, voxels) };
}

function buildPalette(voxels) {
  const counts = new Map();
  for (const voxel of voxels) counts.set(voxel.colorIndex, (counts.get(voxel.colorIndex) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([globalIndex, count]) => ({ index: globalIndex, color: GLOBAL_PALETTE[globalIndex], count }));
}

function computeFunctionModel() {
  if (!state.source) return;
  setStatus(t("ncmFourier.status.computing"));
  setActiveStep("fit");
  const maxBasis = Number(els.basisRange.value) || 512;
  const result = createCandidate(DEFAULT_MERGE_STRATEGY, maxBasis);
  applyCandidate(result);
  setActiveStep(state.basis.length === result.fullBasisCount ? "bake" : "rebuild");
  setStatus(state.basis.length === result.fullBasisCount ? t("ncmFourier.status.computedExact") : t("ncmFourier.status.computedBudget"));
}

function optimizeFunctionModel() {
  if (!state.source) return;
  setStatus(t("ncmFourier.status.optimizing"));
  setActiveStep("fit");
  const maxBasis = Number(els.basisRange.value) || 512;
  const candidates = createOptimizationStrategies().map((strategy) => createCandidate(strategy, maxBasis));
  const exactCandidates = candidates.filter((candidate) => candidate.functionVoxels === state.source.voxels.length);
  const pool = exactCandidates.length ? exactCandidates : candidates;
  const best = pool.sort(compareCandidates)[0];
  applyCandidate(best);
  setActiveStep(best.functionVoxels === state.source.voxels.length ? "bake" : "rebuild");
  setStatus(
    best.functionVoxels === state.source.voxels.length
      ? t("ncmFourier.status.optimized", { count: candidates.length })
      : t("ncmFourier.status.optimizedBudget", { count: candidates.length }),
  );
}

function createCandidate(strategy, maxBasis) {
  const merged = mergeSameColorVoxels(state.source.voxels, strategy);
  const basis = selectBasis(merged, maxBasis);
  const functionVoxels = basis.reduce((sum, box) => sum + box.w * box.d * box.h, 0);
  const payload = createFunctionPayload(basis);
  return {
    basis,
    functionVoxels,
    payload,
    fullBasisCount: merged.length,
    strategyName: `${strategy.seedAxes.join("")}/${strategy.growAxes.join("")}`,
  };
}

function applyCandidate(candidate) {
  state.basis = candidate.basis;
  state.functionVoxels = candidate.functionVoxels;
  state.payload = candidate.payload.text;
  state.payloadBytes = candidate.payload.bytes;
  state.strategyName = candidate.strategyName;
  renderFunctionModel();
  renderPanels();
}

function selectBasis(boxes, maxBasis) {
  return [...boxes]
    .sort((a, b) => b.w * b.d * b.h - a.w * a.d * a.h || a.colorIndex - b.colorIndex)
    .slice(0, maxBasis)
    .sort(compareBoxes);
}

function compareCandidates(a, b) {
  return (
    a.payload.bytes - b.payload.bytes ||
    a.basis.length - b.basis.length ||
    b.functionVoxels - a.functionVoxels ||
    a.strategyName.localeCompare(b.strategyName)
  );
}

function createOptimizationStrategies() {
  const seedOrders = permutations(["x", "y", "z"]);
  const growOrders = permutations(["w", "d", "h"]);
  return seedOrders.flatMap((seedAxes) => growOrders.map((growAxes) => ({ seedAxes, growAxes })));
}

function mergeSameColorVoxels(voxels, strategy = DEFAULT_MERGE_STRATEGY) {
  const occupied = new Map();
  const visited = new Set();
  for (const voxel of voxels) occupied.set(voxelKey(voxel.x, voxel.y, voxel.z), voxel.colorIndex);
  const sorted = [...voxels].sort((a, b) => compareVoxels(a, b, strategy.seedAxes));
  const boxes = [];
  for (const voxel of sorted) {
    const key = voxelKey(voxel.x, voxel.y, voxel.z);
    if (visited.has(key)) continue;
    const colorIndex = voxel.colorIndex;
    const box = growBox(occupied, visited, colorIndex, voxel, strategy.growAxes);
    markRect(visited, box.x, box.y, box.z, box.w, box.d, box.h);
    boxes.push(box);
  }
  return boxes;
}

function growBox(occupied, visited, colorIndex, voxel, growAxes) {
  const box = {
    x: voxel.x,
    y: voxel.y,
    z: voxel.z,
    w: 1,
    d: 1,
    h: 1,
    color: GLOBAL_PALETTE[colorIndex],
    colorIndex,
  };
  for (const axis of growAxes) {
    while (canGrowBox(occupied, visited, colorIndex, box, axis)) box[axis] += 1;
  }
  return box;
}

function canGrowBox(occupied, visited, colorIndex, box, axis) {
  const next = { ...box, [axis]: box[axis] + 1 };
  return hasRect(occupied, visited, colorIndex, next.x, next.y, next.z, next.w, next.d, next.h);
}

function hasRect(occupied, visited, colorIndex, x, y, z, w, d, h) {
  for (let dz = 0; dz < h; dz += 1) {
    for (let dy = 0; dy < d; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        const key = voxelKey(x + dx, y + dy, z + dz);
        if (visited.has(key) || occupied.get(key) !== colorIndex) return false;
      }
    }
  }
  return true;
}

function markRect(visited, x, y, z, w, d, h) {
  for (let dz = 0; dz < h; dz += 1) {
    for (let dy = 0; dy < d; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) visited.add(voxelKey(x + dx, y + dy, z + dz));
    }
  }
}

function renderSourceModel() {
  if (!state.source) return;
  renderInstancedBoxes(sourceViewer, {
    size: state.source.size,
    boxes: state.source.voxels.map((voxel) => ({ ...voxel, w: 1, d: 1, h: 1 })),
    palette: state.palette,
    scale: Number(els.scaleRange.value) / 100,
  });
}

function renderFunctionModel() {
  if (!state.source) return;
  renderInstancedBoxes(functionViewer, {
    size: state.source.size,
    boxes: expandBasisToVoxels(state.basis),
    palette: state.palette,
    scale: Number(els.scaleRange.value) / 100,
  });
}

function renderPowModel() {
  if (!state.source || !state.pow.best.boxes.length) return;
  renderInstancedBoxes(powViewer, {
    size: state.source.size,
    boxes: expandBasisToVoxels(state.pow.best.boxes),
    palette: state.palette,
    scale: Number(els.scaleRange.value) / 100,
  });
}

function clearPowModel() {
  disposeGroup(powViewer.root);
  powViewer.root.clear();
  powViewer.fitKey = "";
}

function expandBasisToVoxels(basis) {
  const voxels = [];
  for (const box of basis) {
    for (let dz = 0; dz < box.h; dz += 1) {
      for (let dy = 0; dy < box.d; dy += 1) {
        for (let dx = 0; dx < box.w; dx += 1) {
          voxels.push({
            x: box.x + dx,
            y: box.y + dy,
            z: box.z + dz,
            w: 1,
            d: 1,
            h: 1,
            color: box.color,
            colorIndex: box.colorIndex,
          });
        }
      }
    }
  }
  return voxels;
}

function renderInstancedBoxes(viewer, { size, boxes, palette, scale }) {
  disposeGroup(viewer.root);
  viewer.root.clear();
  if (!boxes.length) return;

  const byColor = new Map();
  for (const box of boxes) {
    const color = normalizeColor(box.color);
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(box);
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const center = { x: (size.x - 1) / 2, y: (size.y - 1) / 2, z: (size.z - 1) / 2 };
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const unit = (2.3 / maxDim) * scale;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();

  for (const [color, colorBoxes] of byColor.entries()) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.56,
      metalness: 0.08,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, colorBoxes.length);
    colorBoxes.forEach((box, index) => {
      const sx = Math.max(1, box.w) * unit * 0.96;
      const sy = Math.max(1, box.h) * unit * 0.96;
      const sz = Math.max(1, box.d) * unit * 0.96;
      const px = (box.x + (box.w - 1) / 2 - center.x) * unit;
      const py = (box.z + (box.h - 1) / 2 - center.z) * unit;
      const pz = (center.y - (box.y + (box.d - 1) / 2)) * unit;
      matrix.compose(new THREE.Vector3(px, py, pz), quat, new THREE.Vector3(sx, sy, sz));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    viewer.root.add(mesh);
  }

  const fitKey = `${size.x},${size.y},${size.z},${scale}`;
  if (viewer.fitKey !== fitKey) {
    fitCamera(viewer, size, unit);
    viewer.fitKey = fitKey;
  }
  renderPalette(palette);
}

function renderPanels() {
  const source = state.source;
  if (!source) {
    renderEmptyState();
    return;
  }

  els.sourceBadge.textContent = t("ncmFourier.badges.voxels", { value: source.voxels.length });
  els.functionBadge.textContent = state.basis.length
    ? t("ncmFourier.badges.basis", { value: state.basis.length })
    : t("ncmFourier.badges.waiting");
  els.gridMetric.textContent = `${source.size.x}x${source.size.y}x${source.size.z}`;
  els.coefMetric.textContent = String(state.basis.length);
  els.voxelMetric.textContent = state.basis.length ? `${state.functionVoxels}/${source.voxels.length}` : "0";
  els.storageMetric.textContent = state.basis.length ? formatBytes(state.payloadBytes) : "0 B";
  renderPalette(state.palette);

  els.formula.textContent = state.basis.length
    ? state.payload
    : t("ncmFourier.formula.empty");

  els.algorithm.textContent = state.basis.length
    ? createAlgorithmText()
    : t("ncmFourier.algorithm.empty");

  els.coefBlock.textContent = state.basis.length
    ? state.basis
        .slice(0, 48)
        .map((box, index) => `B${String(index).padStart(3, "0")} g${box.colorIndex} box(${box.x},${box.y},${box.z}; ${box.w},${box.d},${box.h})`)
        .join("\n")
    : t("ncmFourier.coefficients.empty");
}

function renderPalette(palette) {
  els.paletteStrip.replaceChildren(
    ...palette.slice(0, 64).map((entry) => {
      const swatch = document.createElement("div");
      swatch.className = "palette-swatch";
      swatch.style.background = entry.color;
      swatch.title = `${entry.index}: ${entry.color} (${entry.count})`;
      return swatch;
    }),
  );
}

function renderEmptyState() {
  setStatus(t("ncmFourier.status.ready"));
  els.sourceBadge.textContent = t("ncmFourier.badges.noVoxels");
  els.functionBadge.textContent = t("ncmFourier.badges.waiting");
  els.powBadge.textContent = "0%";
  els.gridMetric.textContent = "-";
  els.coefMetric.textContent = "0";
  els.voxelMetric.textContent = "0";
  els.storageMetric.textContent = "0 B";
  els.paletteStrip.replaceChildren();
  els.formula.textContent = t("ncmFourier.formula.empty");
  els.algorithm.textContent = t("ncmFourier.algorithm.empty");
  els.coefBlock.textContent = t("ncmFourier.coefficients.empty");
  clearPowModel();
  renderPowEmpty();
}

function renderPowEmpty() {
  els.startPow.disabled = !state.source;
  els.stopPow.disabled = true;
  els.powHashrate.textContent = "0 H/s";
  els.powAttempts.textContent = "0";
  els.powBest.textContent = "0%";
  els.powBadge.textContent = "0%";
  els.powBytes.textContent = `${Number(els.exprBytesRange.value) || 8} B`;
  els.powLog.textContent = t("ncmFourier.pow.empty");
}

function createFunctionPayload(basis = state.basis) {
  if (!state.source) return { text: "", bytes: 0 };
  const bytes = [];
  writeVar(bytes, state.source.size.x);
  writeVar(bytes, state.source.size.y);
  writeVar(bytes, state.source.size.z);
  writeVar(bytes, basis.length);
  for (const box of basis) {
    bytes.push(box.colorIndex & 0xff);
    writeVar(bytes, box.x);
    writeVar(bytes, box.y);
    writeVar(bytes, box.z);
    writeVar(bytes, box.w);
    writeVar(bytes, box.d);
    writeVar(bytes, box.h);
  }
  const raw = Uint8Array.from(bytes);
  return { text: `${FUNCTION_CODEC_ID}:${base64UrlEncode(raw)}`, bytes: raw.byteLength };
}

function createAlgorithmText() {
  return [
    `${FUNCTION_CODEC_ID}=BOX1/${GLOBAL_PALETTE_ID}/RGB332`,
    "B64=[sx,sy,sz,n,{c,x,y,z,w,d,h}*n]",
    "V=LEB128,c=u8",
    `D:voxel(x+dx,y+dy,z+dz)=${GLOBAL_PALETTE_ID}[c]`,
    `O=${state.strategyName || "zyx/wdh"}`,
  ].join("\n");
}

async function copyFunction() {
  try {
    await navigator.clipboard.writeText(els.formula.textContent);
    els.copyGene.textContent = t("ncmFourier.formula.copied");
    setTimeout(() => {
      els.copyGene.textContent = t("ncmFourier.formula.copy");
    }, 1200);
  } catch {
    els.copyGene.textContent = t("ncmFourier.formula.copyFailed");
  }
}

function createViewer(canvas, background) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(3.2, 2.4, 4.1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xeafff7, 0x243434, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(4, 5, 3);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x6ee7b7, 0.75);
  rimLight.position.set(-3, 2, -4);
  scene.add(rimLight);
  const root = new THREE.Group();
  scene.add(root);
  const grid = new THREE.GridHelper(2.5, 10, 0x37504a, 0x243333);
  grid.position.y = -1.15;
  scene.add(grid);
  return { canvas, scene, camera, renderer, controls, root, fitKey: "" };
}

function fitCamera(viewer, size, unit) {
  const radius = Math.max(size.x, size.y, size.z) * unit * 0.9;
  viewer.controls.target.set(0, 0, 0);
  viewer.camera.position.set(radius * 1.55, radius * 1.1, radius * 1.95);
  viewer.camera.near = 0.05;
  viewer.camera.far = Math.max(20, radius * 8);
  viewer.camera.updateProjectionMatrix();
}

function animate() {
  for (const viewer of [sourceViewer, functionViewer, powViewer]) {
    viewer.controls.update();
    resizeViewer(viewer);
    viewer.renderer.render(viewer.scene, viewer.camera);
  }
  requestAnimationFrame(animate);
}

function resizeAll() {
  resizeViewer(sourceViewer);
  resizeViewer(functionViewer);
  resizeViewer(powViewer);
}

function resizeViewer(viewer) {
  const rect = viewer.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * viewer.renderer.getPixelRatio()));
  const height = Math.max(1, Math.round(rect.height * viewer.renderer.getPixelRatio()));
  if (viewer.canvas.width !== width || viewer.canvas.height !== height) {
    viewer.renderer.setSize(rect.width, rect.height, false);
    viewer.camera.aspect = rect.width / Math.max(1, rect.height);
    viewer.camera.updateProjectionMatrix();
  }
}

function disposeGroup(group) {
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function setStatus(message) {
  els.status.textContent = message;
}

function setActiveStep(step) {
  for (const item of els.steps) item.classList.toggle("active", item.dataset.step === step);
}

function compareVoxels(a, b, axes) {
  if (a.colorIndex !== b.colorIndex) return a.colorIndex - b.colorIndex;
  for (const axis of axes) {
    if (a[axis] !== b[axis]) return a[axis] - b[axis];
  }
  return a.x - b.x || a.y - b.y || a.z - b.z;
}

function compareBoxes(a, b) {
  return a.z - b.z || a.y - b.y || a.x - b.x || a.colorIndex - b.colorIndex || a.w - b.w || a.d - b.d || a.h - b.h;
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    return permutations(rest).map((items) => [value, ...items]);
  });
}

function hashVoxels(size, voxels) {
  const text = [
    `${size.x},${size.y},${size.z}`,
    ...voxels
      .map((voxel) => `${voxel.x},${voxel.y},${voxel.z},${voxel.colorIndex}`)
      .sort(),
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function voxelKey(x, y, z) {
  return `${x},${y},${z}`;
}

function normalizeColor(color) {
  const value = String(color || "#ffffff").toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : "#ffffff";
}

function createGlobalPalette() {
  const colors = [];
  for (let r = 0; r < 8; r += 1) {
    for (let g = 0; g < 8; g += 1) {
      for (let b = 0; b < 4; b += 1) {
        colors.push(
          rgbToHex(
            Math.round((r / 7) * 255),
            Math.round((g / 7) * 255),
            Math.round((b / 3) * 255),
          ),
        );
      }
    }
  }
  return colors;
}

function nearestGlobalColor(color) {
  const { r, g, b } = hexToRgb(color);
  const ri = Math.max(0, Math.min(7, Math.round((r / 255) * 7)));
  const gi = Math.max(0, Math.min(7, Math.round((g / 255) * 7)));
  const bi = Math.max(0, Math.min(3, Math.round((b / 255) * 3)));
  const index = ri * 32 + gi * 4 + bi;
  return { index, color: GLOBAL_PALETTE[index] };
}

function writeVar(bytes, value) {
  let current = Math.max(0, Number(value) | 0);
  while (current >= 0x80) {
    bytes.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }
  bytes.push(current);
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hexToRgb(color) {
  const value = Number.parseInt(normalizeColor(color).slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function createPowState() {
  return {
    running: false,
    attempts: 0,
    seed: 0,
    startedAt: 0,
    lastUpdateAt: 0,
    target: null,
    logs: [],
    best: {
      score: -Infinity,
      ratio: 0,
      hit: 0,
      missing: 0,
      extra: 0,
      bytes: Infinity,
      boxes: [],
      expr: "",
      seed: 0,
      proof: "",
    },
  };
}

function createRng(seed) {
  let stateValue = seed >>> 0;
  return () => {
    stateValue = (stateValue + 0x6d2b79f5) >>> 0;
    let value = stateValue;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function formatBytes(value) {
  return value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value} B`;
}

function formatNumber(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatInteger(value) {
  return Math.round(value).toLocaleString("en-US");
}

function formatPercent(value) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}
