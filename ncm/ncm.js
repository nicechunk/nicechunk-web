import * as THREE from "three";
import { initI18n, t } from "../src/i18n.js";
import { decodeNcm, voxToNcm } from "../src/vox/ncm.js";
import "./style.css";
import "../src/site-header.css";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const samples = [
  {
    key: "girl",
    labelKey: "ncm.samples.girl",
    url: "/media/vox/chr_peasant_girl_orangehair.ncm",
  },
  {
    key: "guy",
    labelKey: "ncm.samples.guy",
    url: "/media/vox/chr_peasant_guy_blackhair.ncm",
  },
];

const fileInput = document.querySelector("#voxFile");
const mergeMode = document.querySelector("#mergeMode");
const targetHeight = document.querySelector("#targetHeight");
const sampleList = document.querySelector("#sampleList");
const statsGrid = document.querySelector("#statsGrid");
const output = document.querySelector("#ncmOutput");
const statusLine = document.querySelector("#statusLine");
const copyButton = document.querySelector("#copyNcm");
const downloadButton = document.querySelector("#downloadNcm");
const loadSampleButton = document.querySelector("#loadSample");
const resetViewButton = document.querySelector("#resetView");
const previewTitle = document.querySelector("#previewTitle");
const canvas = document.querySelector("#ncmPreview");
const ncmDnaFrame = document.querySelector("#ncmDnaFrame");
const ncmDnaFrameShell = document.querySelector("#ncmDnaFrameShell");
const loadNcmDnaFrameButton = document.querySelector("#loadNcmDnaFrame");
const maxVoxFileBytes = 8 * 1024 * 1024;
const minTargetHeight = 80;
const maxTargetHeight = 900;

let currentNcm = "";
let currentFilename = "nicechunk-model.ncm";
let lastVoxBuffer = null;
let yaw = -0.55;
let pitch = 0.18;
let distance = 5.2;
let dragging = false;
let lastPointer = [0, 0];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101924);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const modelRoot = new THREE.Group();
scene.add(modelRoot);
scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x1a2718, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 7, 4);
keyLight.castShadow = true;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x8cff00, 0.75);
rimLight.position.set(-4, 4, -5);
scene.add(rimLight);

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(5, 0.05, 5),
  new THREE.MeshLambertMaterial({ color: 0x162316 }),
);
ground.position.y = -0.04;
ground.receiveShadow = true;
scene.add(ground);

setSiteLoadingProgress(34);
await initI18n();
setSiteLoadingProgress(58);
renderSamples();
renderEmptyStats();
setupEvents();
await loadSample(samples[0]);
finishSiteLoading();
animate();

window.addEventListener("nicechunk:languagechange", () => {
  document.title = t("ncm.page.title");
  renderSamples();
  updateStatus(t("ncm.status.ready"));
});

function setupEvents() {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) await convertFile(file);
  });

  mergeMode.addEventListener("change", reconvertLastVox);
  targetHeight.addEventListener("change", reconvertLastVox);
  loadSampleButton.addEventListener("click", () => loadSample(samples[0]));
  copyButton.addEventListener("click", copyNcm);
  downloadButton.addEventListener("click", downloadNcm);
  resetViewButton.addEventListener("click", () => {
    yaw = -0.55;
    pitch = 0.18;
    distance = 5.2;
  });

  const dropZone = document.querySelector(".drop-zone");
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
  dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) await convertFile(file);
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastPointer = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    yaw += (event.clientX - lastPointer[0]) * 0.008;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastPointer[1]) * 0.004, -0.55, 0.8);
    lastPointer = [event.clientX, event.clientY];
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.003, 2.2, 10);
  }, { passive: false });
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("message", resizeNcmDnaFrame);
  loadNcmDnaFrameButton?.addEventListener("click", loadNcmDnaFrame);
}

function loadNcmDnaFrame() {
  if (!ncmDnaFrame?.dataset.src || ncmDnaFrame.hasAttribute("src")) return;
  ncmDnaFrameShell?.removeAttribute("hidden");
  ncmDnaFrame.src = ncmDnaFrame.dataset.src;
  loadNcmDnaFrameButton?.setAttribute("disabled", "true");
}

function resizeNcmDnaFrame(event) {
  if (!ncmDnaFrame || event.origin !== window.location.origin || event.source !== ncmDnaFrame.contentWindow) return;
  if (event.data?.type !== "nicechunk:ncm-dna-height") return;
  const nextHeight = Math.ceil(Number(event.data.height) || 0);
  if (nextHeight < 600) return;
  ncmDnaFrame.style.height = `${nextHeight + 8}px`;
}

function renderSamples() {
  sampleList.replaceChildren(
    ...samples.map((sample) => {
      const button = document.createElement("button");
      button.type = "button";
      const label = document.createElement("strong");
      label.textContent = t(sample.labelKey);
      const badge = document.createElement("span");
      badge.textContent = "NCM";
      button.append(label, badge);
      button.addEventListener("click", () => loadSample(sample));
      return button;
    }),
  );
}

async function loadSample(sample) {
  try {
    updateStatus(t("ncm.status.loadingSample"));
    const response = await fetch(`${sample.url}?v=${encodeURIComponent(typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : Date.now())}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ncm = (await response.text()).trim();
    lastVoxBuffer = null;
    currentFilename = `${sample.key}.ncm`;
    setNcmResult(ncm, {
      name: t(sample.labelKey),
      source: { voxelCount: "-", boxCount: decodeNcm(ncm).boxes.length, size: { x: 32, y: 32, z: 32 } },
    });
    updateStatus(t("ncm.status.sampleLoaded"));
  } catch (error) {
    updateStatus(t("ncm.status.failed", { reason: error.message }));
  }
}

async function convertFile(file) {
  try {
    validateVoxFile(file);
    updateStatus(t("ncm.status.converting"));
    lastVoxBuffer = await file.arrayBuffer();
    currentFilename = file.name.replace(/\.vox$/i, ".ncm") || "nicechunk-model.ncm";
    convertBuffer(lastVoxBuffer, file.name);
  } catch (error) {
    updateStatus(t("ncm.status.failed", { reason: error.message }));
  }
}

function reconvertLastVox() {
  if (!lastVoxBuffer) return;
  convertBuffer(lastVoxBuffer, currentFilename.replace(/\.ncm$/i, ".vox"));
}

function convertBuffer(buffer, name) {
  const result = voxToNcm(buffer, {
    mode: mergeMode.value,
    targetHeight: getTargetHeight(),
  });
  setNcmResult(result.ncm, { name, source: result.source });
  updateStatus(t("ncm.status.converted"));
}

function validateVoxFile(file) {
  if (!/\.vox$/i.test(file.name)) throw new Error("Please select a MagicaVoxel .vox file.");
  if (file.size > maxVoxFileBytes) throw new Error("The selected VOX file is larger than the 8 MiB browser converter limit.");
}

function getTargetHeight() {
  const parsed = Number(targetHeight.value);
  const safe = Number.isFinite(parsed) ? parsed : 300;
  const clamped = THREE.MathUtils.clamp(Math.round(safe), minTargetHeight, maxTargetHeight);
  if (String(clamped) !== targetHeight.value) targetHeight.value = String(clamped);
  return clamped;
}

function setNcmResult(ncm, details) {
  currentNcm = ncm;
  output.value = ncm;
  const character = decodeNcm(ncm);
  renderModel(character.boxes);
  renderStats(details.source, ncm);
  previewTitle.textContent = details.name || t("ncm.preview.titleLoaded");
}

function renderModel(boxes) {
  modelRoot.clear();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materialCache = new Map();
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  boxes.forEach((part) => {
    const material = materialCache.get(part.c) ?? new THREE.MeshLambertMaterial({ color: part.c });
    materialCache.set(part.c, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(part.p[0] / 100, part.p[1] / 100, part.p[2] / 100);
    mesh.scale.set(part.s[0] / 100, part.s[1] / 100, part.s[2] / 100);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    modelRoot.add(mesh);
    bounds.minX = Math.min(bounds.minX, mesh.position.x - mesh.scale.x / 2);
    bounds.maxX = Math.max(bounds.maxX, mesh.position.x + mesh.scale.x / 2);
    bounds.minY = Math.min(bounds.minY, mesh.position.y - mesh.scale.y / 2);
    bounds.maxY = Math.max(bounds.maxY, mesh.position.y + mesh.scale.y / 2);
    bounds.minZ = Math.min(bounds.minZ, mesh.position.z - mesh.scale.z / 2);
    bounds.maxZ = Math.max(bounds.maxZ, mesh.position.z + mesh.scale.z / 2);
  });

  const center = new THREE.Vector3(
    (bounds.minX + bounds.maxX) / 2 || 0,
    (bounds.minY + bounds.maxY) / 2 || 1.5,
    (bounds.minZ + bounds.maxZ) / 2 || 0,
  );
  modelRoot.position.set(-center.x, -bounds.minY, -center.z);
  distance = THREE.MathUtils.clamp(Math.max(bounds.maxY - bounds.minY, bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.8, 3.2, 8);
}

function renderEmptyStats() {
  renderStats({ voxelCount: "-", boxCount: "-", size: { x: "-", y: "-", z: "-" } }, "");
}

function renderStats(source, ncm) {
  const stats = [
    [source.voxelCount ?? "-", t("ncm.stats.voxels")],
    [source.boxCount ?? "-", t("ncm.stats.boxes")],
    [ncm ? String(ncm.length) : "-", t("ncm.stats.chars")],
    [`${source.size?.x ?? "-"}x${source.size?.y ?? "-"}x${source.size?.z ?? "-"}`, t("ncm.stats.size")],
  ];
  statsGrid.replaceChildren(
    ...stats.map(([value, label]) => {
      const card = document.createElement("article");
      const valueNode = document.createElement("strong");
      valueNode.textContent = String(value);
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      card.append(valueNode, labelNode);
      return card;
    }),
  );
}

async function copyNcm() {
  if (!currentNcm) return;
  await navigator.clipboard.writeText(currentNcm).then(
    () => updateStatus(t("ncm.status.copied")),
    () => updateStatus(t("ncm.status.copyFailed")),
  );
}

function downloadNcm() {
  if (!currentNcm) return;
  const blob = new Blob([`${currentNcm}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = currentFilename;
  link.click();
  URL.revokeObjectURL(url);
  updateStatus(t("ncm.status.downloaded"));
}

function updateStatus(text) {
  statusLine.textContent = text;
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  camera.position.set(Math.sin(yaw) * distance, 1.55 + Math.sin(pitch) * distance * 0.7, Math.cos(yaw) * distance);
  camera.lookAt(0, 1.45, 0);
  modelRoot.rotation.y += 0.002;
  renderer.render(scene, camera);
}

function resize() {
  const width = canvas.clientWidth || 1;
  const height = canvas.clientHeight || 1;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
}
