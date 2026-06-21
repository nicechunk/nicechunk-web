import * as THREE from "three";
import "../src/site-header.css";
import "../src/site-ui.js";
import { initI18n, t } from "../src/i18n.js";
import { createAvatar } from "../src/render/avatar.js";

const canvas = document.querySelector("#mineCanvas");
const miningShell = document.querySelector(".mining-shell");
const playerName = document.querySelector("#playerName");
const playerLevel = document.querySelector("#playerLevel");
const playerTitle = document.querySelector("#playerTitle");
const playerWallet = document.querySelector("#playerWallet");
const cpuInfo = document.querySelector("#cpuInfo");
const memoryInfo = document.querySelector("#memoryInfo");
const activeCount = document.querySelector("#activeCount");
const contractAddress = document.querySelector("#contractAddress");
const totalHashrate = document.querySelector("#totalHashrate");
const avgBlockTime = document.querySelector("#avgBlockTime");
const caveDepth = document.querySelector("#caveDepth");
const totalBlocks = document.querySelector("#totalBlocks");
const minedBlocks = document.querySelector("#minedBlocks");
const remainingBlocks = document.querySelector("#remainingBlocks");
const minerList = document.querySelector("#minerList");
const toolHotbar = document.querySelector("#toolHotbar");

const storageKeys = {
  walletAddress: "nicechunk.walletAddress",
  username: "nicechunk.username",
  walletName: "nicechunk.walletName",
};
const caveContractAddress = "MineCave7mQx9nV6y4T8pK2rL5sD3fH1aZcB0gE";
const worldBlockSize = 1;
const emptyTunnelDepth = 10;
const mineFaceZ = 0;
const exitPlaneZ = 24.6;
const mineGridColumns = 9;
const mineGridRows = 5;
const totalMineBlockCount = 10000;
const blocksPerMineLayer = mineGridColumns * mineGridRows;
const mineLayerCount = Math.ceil(totalMineBlockCount / blocksPerMineLayer);
const renderedMineLayerCount = 8;
const caveStartZ = mineFaceZ - (renderedMineLayerCount + 2) * worldBlockSize;
const caveEndZ = Math.ceil(exitPlaneZ);

const toolSlots = [
  { id: "iron_pickaxe", labelKey: "main.item.iron_pickaxe", iconClass: "tool-pickaxe", action: "mine" },
  { id: "drill", labelKey: "mining.tools.drill", iconClass: "tool-drill", action: "select" },
  { id: "scanner", labelKey: "mining.tools.scanner", iconClass: "tool-scanner", action: "select" },
  { id: "lantern", labelKey: "mining.tools.lantern", iconClass: "tool-lantern", action: "select" },
  { id: "hammer", labelKey: "mining.tools.hammer", iconClass: "tool-hammer", action: "select" },
  null,
  null,
  null,
  null,
];

const statusKeys = ["mining.userStatus.drilling", "mining.userStatus.hauling", "mining.userStatus.scanning", "mining.userStatus.resting", "mining.userStatus.mining"];
const virtualMiners = Array.from({ length: 99 }, (_, index) => {
  const hashrate = 420 + ((index * 137) % 1280);
  return {
    name: `Miner ${String(index + 2).padStart(3, "0")}`,
    statusKey: statusKeys[index % statusKeys.length],
    hashrate,
    blocks: 12 + ((index * 11) % 86),
  };
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1f211b);
scene.fog = new THREE.Fog(0x1f211b, 28, 78);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xf4fbff, 0x5c4a30, 2.2);
scene.add(hemi);

const lantern = new THREE.PointLight(0xffd46b, 6.2, 64, 1.15);
lantern.position.set(0, 5.8, 6);
lantern.castShadow = true;
scene.add(lantern);

const sideGlow = new THREE.PointLight(0x88e2ff, 3.4, 38, 1.35);
sideGlow.position.set(-6, 3.2, -3);
scene.add(sideGlow);

const oreGlow = new THREE.PointLight(0x4fc3ff, 3.1, 34, 1.35);
oreGlow.position.set(0, 3.4, mineFaceZ + 0.8);
scene.add(oreGlow);

const exitLight = new THREE.PointLight(0xffefbd, 5.8, 54, 1.08);
exitLight.position.set(-2.8, 4.6, exitPlaneZ + 1.2);
scene.add(exitLight);

const exitSpot = new THREE.SpotLight(0xffefbd, 7.8, 72, Math.PI / 9, 0.55, 1.1);
exitSpot.position.set(-4.2, 6.3, exitPlaneZ + 2.6);
exitSpot.target.position.set(-4.2, -0.2, 14.2);
exitSpot.castShadow = true;
scene.add(exitSpot, exitSpot.target);

const ceilingFill = new THREE.DirectionalLight(0xffefbd, 1.45);
ceilingFill.position.set(4, 10, 8);
scene.add(ceilingFill);

const world = new THREE.Group();
scene.add(world);

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const lightPatchGeometry = new THREE.PlaneGeometry(4.2, 7.2);
lightPatchGeometry.rotateX(-Math.PI / 2);
const lightBeamGeometry = new THREE.CylinderGeometry(0.25, 1.35, 12.4, 4, 1, true);
const oreMeshes = [];
const colliders = [];
const particles = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const keys = new Set();
const clock = new THREE.Clock();

const materials = {
  floor: voxelMaterial(0x4a493e, 0.1),
  wall: voxelMaterial(0x5a584b, 0.08),
  darkWall: voxelMaterial(0x3f4037, 0.08),
  ore: voxelMaterial(0x3fc7ff, 0.18),
  oreCore: voxelMaterial(0xffdf74, 0.12),
  oreGold: voxelMaterial(0xf2d36b, 0.08),
  oreSilver: voxelMaterial(0xdde5e5, 0.04),
  oreBrass: voxelMaterial(0xc99634, 0.08),
  oreIron: voxelMaterial(0xb56948, 0.08),
  oreDiamond: voxelMaterial(0x68e8ff, 0.04),
  support: voxelMaterial(0x5f3e25, 0.08),
  rail: voxelMaterial(0x777d74, 0.04),
  skin: voxelMaterial(0xc99061, 0.06),
  skinShade: voxelMaterial(0xb2774f, 0.06),
  shirt: voxelMaterial(0x2e8b86, 0.08),
  shirtDark: voxelMaterial(0x216966, 0.06),
  shirtLight: voxelMaterial(0x58b6a8, 0.06),
  pants: voxelMaterial(0x294a7c, 0.05),
  pantsDark: voxelMaterial(0x1d3157, 0.04),
  boots: voxelMaterial(0x2b2520, 0.05),
  boot: voxelMaterial(0x2b2520, 0.04),
  belt: voxelMaterial(0x4d3424, 0.04),
  buckle: voxelMaterial(0xd6a84a, 0.04),
  backpack: voxelMaterial(0x6c5842, 0.08),
  backpackDark: voxelMaterial(0x3f352b, 0.06),
  backpackLight: voxelMaterial(0x8a7355, 0.07),
  backpackStrap: voxelMaterial(0x2b2520, 0.05),
  watchBand: voxelMaterial(0x1d1712, 0.04),
  watchCase: voxelMaterial(0xd6a84a, 0.04),
  watchFace: voxelMaterial(0x2ba9d6, 0.03),
  grass: voxelMaterial(0x62a744, 0.18),
  pickHandle: voxelMaterial(0x6d4a2d, 0.04),
  pickHead: voxelMaterial(0xbfc4bd, 0.04),
  toolHandle: voxelMaterial(0x6d4a2d, 0.04),
  toolHead: voxelMaterial(0x9ea6a8, 0.04),
  toolEdge: voxelMaterial(0xe6eceb, 0.02),
  hair: voxelMaterial(0x3f2918, 0.05),
  hairShade: voxelMaterial(0x2b1b11, 0.04),
  eye: voxelMaterial(0x151414, 0.0),
  mouth: voxelMaterial(0x7c392f, 0.0),
  exitGlow: new THREE.MeshBasicMaterial({ color: 0xffefbd, transparent: true, opacity: 0.68 }),
  exitBeam: new THREE.MeshBasicMaterial({ color: 0xffefbd, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  exitFloorLight: new THREE.MeshBasicMaterial({ color: 0xffefbd, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide }),
};

const state = {
  minedBlocks: 0,
  remainingBlocks: totalMineBlockCount,
  yaw: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  pointerDownX: 0,
  pointerDownY: 0,
  pointerDownAt: 0,
  playerPosition: new THREE.Vector3(0, 0.5, 10),
  playerVelocity: new THREE.Vector3(),
  avatarYaw: 0,
  cameraPitch: -0.22,
  grounded: true,
  mineCooldown: 0,
  miningSwing: 0,
  moving: false,
  selectedToolSlot: 0,
  exiting: false,
  statusKey: "mining.status.ready",
};
const miningSwingDuration = 520;
const cameraPitchMin = -0.72;
const cameraPitchMax = 0.38;
const avatarGroundOffset = 0.5;
const playerRadius = 0.36;
const playerBodyTopOffset = 1;
const gravity = 24;
const jumpImpulse = 9.2;
const playerSpeed = 10.5;
const playerSprintSpeed = 16.5;
const caveSurfaceHeight = -0.51;
const miningReachDown = 2;
const miningReachUp = 4;
const miningHorizontalReach = 4.8;

const player = createPlayer();
scene.add(player);

await initI18n();
canvas.focus();
buildCave();
updateProfileHud();
updateSystemHud();
renderToolHotbar();
renderMinerList();
updateMiningHud();
resize();
animate();

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", resize);
window.addEventListener("nicechunk:languagechange", () => {
  updateProfileHud();
  updateSystemHud();
  renderToolHotbar();
  renderMinerList();
  updateMiningHud();
});

function handleKeyDown(event) {
  if (/^Digit[1-9]$/.test(event.code)) {
    selectTool(Number(event.code.slice(5)) - 1);
    return;
  }
  keys.add(event.code);
  if (event.code === "KeyE") mineNearestOre();
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  state.dragging = true;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.pointerDownX = event.clientX;
  state.pointerDownY = event.clientY;
  state.pointerDownAt = performance.now();
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  const dx = event.clientX - state.lastX;
  const dy = event.clientY - state.lastY;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.yaw -= dx * 0.006;
  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - dy * 0.003, cameraPitchMin, cameraPitchMax);
});
canvas.addEventListener("pointerup", (event) => {
  state.dragging = false;
  canvas.releasePointerCapture(event.pointerId);
  const moved = Math.hypot(event.clientX - state.pointerDownX, event.clientY - state.pointerDownY);
  const elapsed = performance.now() - state.pointerDownAt;
  if (event.button === 0 && moved < 14 && elapsed < 620) mineNearestOre();
});
canvas.addEventListener("pointercancel", () => {
  state.dragging = false;
});

function voxelMaterial(color, roughness) {
  const material = new THREE.MeshLambertMaterial({ color });
  material.fog = true;
  material.userData.roughness = roughness;
  return material;
}

function buildCave() {
  const floorGroup = new THREE.Group();
  for (let z = caveStartZ; z <= caveEndZ; z += 2) {
    for (let x = -10; x <= 10; x += 2) {
      const heightOffset = noise2(x, z) * 0.18;
        addBlock(floorGroup, x, -0.6 + heightOffset, z, 2, 0.8, 2, materials.floor);
        const exitOpening = z >= 18 && Math.abs(x) <= 4;
        if ((Math.abs(x) >= 10 || z >= 18) && !exitOpening) {
          const wallHeight = 3 + Math.abs(noise2(z, x)) * 2.5;
          addBlock(floorGroup, x, wallHeight * 0.5 - 0.4, z, 2, wallHeight, 2, wallMaterial(x, z), { collidable: true });
        }
      if (Math.abs(x) >= 8 && z % 4 === 0) addBlock(floorGroup, x, 5.7, z, 2, 1.4, 2, materials.darkWall, { collidable: true });
    }
  }
  world.add(floorGroup);

  for (let z = caveStartZ + 2; z <= 16; z += 7) {
    addSupport(z);
  }

  addBlock(world, -1.7, -0.08, 4, 0.22, 0.12, 24, materials.rail);
  addBlock(world, 1.7, -0.08, 4, 0.22, 0.12, 24, materials.rail);
  for (let z = -6; z <= 17; z += 2.5) {
    addBlock(world, 0, -0.04, z, 4.2, 0.1, 0.28, materials.support);
  }

  addMineFace();
  addMineSideBlockers();
  state.remainingBlocks = totalMineBlockCount;

  addBlock(world, 0, 2.8, exitPlaneZ, 7.2, 5.2, 0.16, materials.exitGlow);
  addExitLightGeometry();
}

function addMineFace() {
  const oreTypes = ["oreGold", "oreSilver", "oreBrass", "oreIron", "oreDiamond"];
  for (let layer = 0; layer < Math.min(renderedMineLayerCount, mineLayerCount); layer += 1) {
    for (let row = 0; row < mineGridRows; row += 1) {
      for (let col = 0; col < mineGridColumns; col += 1) {
        const block = addOreBlock({ row, col, layer, oreTypes });
        if (!block) return;
      }
    }
  }
}

function addOreBlock({ row, col, layer, oreTypes }) {
  const blockIndex = layer * blocksPerMineLayer + row * mineGridColumns + col;
  if (blockIndex >= totalMineBlockCount) return null;
  const x = (col - Math.floor(mineGridColumns / 2)) * worldBlockSize;
  const y = row * worldBlockSize;
  const z = mineFaceZ - layer * worldBlockSize;
  const rockMaterial = (row + col + layer) % 3 === 0 ? materials.darkWall : materials.wall;
  const block = addBlock(world, x, y, z, worldBlockSize, worldBlockSize, worldBlockSize, rockMaterial, { collidable: true });
  block.userData.ore = true;
  block.userData.amount = 1;
  block.userData.row = row;
  block.userData.col = col;
  block.userData.depthLayer = layer;
  oreMeshes.push(block);
  block.userData.veins = addOreVeins(block.position, oreTypes[blockIndex % oreTypes.length], blockIndex);
  return block;
}

function addMineSideBlockers() {
  const sideDepth = renderedMineLayerCount + 2;
  const sideCenterZ = mineFaceZ - (sideDepth - 1) * 0.5;
  const sideHeight = mineGridRows + 1.4;
  addBlock(world, -5.45, sideHeight * 0.5 - 0.45, sideCenterZ, 1, sideHeight, sideDepth, materials.darkWall, { collidable: true });
  addBlock(world, 5.45, sideHeight * 0.5 - 0.45, sideCenterZ, 1, sideHeight, sideDepth, materials.darkWall, { collidable: true });
}

function addOreVeins(position, materialKey, seed) {
  const veins = [];
  const veinCount = 2 + (seed % 3);
  for (let i = 0; i < veinCount; i += 1) {
    const offsetX = (((seed * 17 + i * 11) % 90) / 100 - 0.45) * 0.74;
    const offsetY = (((seed * 23 + i * 7) % 82) / 100 - 0.36) * 0.68;
    const width = 0.18 + (((seed + i * 5) % 4) * 0.055);
    const height = 0.16 + (((seed + i * 3) % 3) * 0.06);
    const vein = addBlock(world, position.x + offsetX, position.y + offsetY, position.z + 0.515, width, height, 0.045, materials[materialKey]);
    vein.rotation.z = ((seed + i) % 2 === 0 ? 1 : -1) * (0.12 + ((seed + i) % 4) * 0.08);
    veins.push(vein);
  }
  return veins;
}

function addExitLightGeometry() {
  const patch = new THREE.Mesh(lightPatchGeometry, materials.exitFloorLight);
  patch.position.set(-4.2, -0.16, 14.4);
  patch.rotation.z = 0.05;
  patch.renderOrder = 1;
  world.add(patch);

  const beam = new THREE.Mesh(lightBeamGeometry, materials.exitBeam);
  const start = new THREE.Vector3(-4.2, 4.4, exitPlaneZ + 0.25);
  const end = new THREE.Vector3(-4.2, 0.08, 14.4);
  const direction = end.clone().sub(start).normalize();
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  beam.renderOrder = 2;
  world.add(beam);
}

function addSupport(z) {
  addBlock(world, -7.5, 2.95, z, 0.7, 6.3, 0.7, materials.support, { collidable: true });
  addBlock(world, 7.5, 2.95, z, 0.7, 6.3, 0.7, materials.support, { collidable: true });
  addBlock(world, 0, 6.05, z, 16.2, 0.65, 0.75, materials.support, { collidable: true });
}

function wallMaterial(x, z) {
  return Math.abs(noise2(x * 0.7, z * 0.7)) > 0.38 ? materials.darkWall : materials.wall;
}

function addBlock(parent, x, y, z, sx, sy, sz, material, options = {}) {
  const mesh = new THREE.Mesh(cubeGeometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (options.collidable) mesh.userData.collider = addCollider(mesh);
  return mesh;
}

function addCollider(mesh) {
  const collider = {
    mesh,
    minX: mesh.position.x - mesh.scale.x * 0.5,
    maxX: mesh.position.x + mesh.scale.x * 0.5,
    minY: mesh.position.y - mesh.scale.y * 0.5,
    maxY: mesh.position.y + mesh.scale.y * 0.5,
    minZ: mesh.position.z - mesh.scale.z * 0.5,
    maxZ: mesh.position.z + mesh.scale.z * 0.5,
  };
  colliders.push(collider);
  return collider;
}

function createPlayer() {
  const avatar = createAvatar({ THREE, cubeGeometry, materials });
  avatar.position.copy(state.playerPosition);
  avatar.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return avatar;
}

function updateProfileHud() {
  const username = localStorage.getItem(storageKeys.username) || t("main.account.guest");
  const walletAddress = localStorage.getItem(storageKeys.walletAddress) || "";
  const walletName = localStorage.getItem(storageKeys.walletName) || "";
  playerName.textContent = username;
  playerLevel.textContent = t("main.account.level", { level: 1 });
  playerTitle.textContent = t("mining.player.title");
  playerWallet.textContent = walletAddress ? `${walletName || t("mining.player.wallet")} ${formatAddress(walletAddress)}` : t("main.account.notConnected");
}

function updateSystemHud() {
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  cpuInfo.textContent = cores ? t("mining.system.cores", { count: cores }) : t("mining.system.unknown");
  memoryInfo.textContent = memory ? t("mining.system.memoryGb", { value: memory }) : t("mining.system.unknown");
}

function renderToolHotbar() {
  toolHotbar.replaceChildren(
    ...toolSlots.map((tool, index) => {
      const button = document.createElement("button");
      button.className = `tool-slot${index === state.selectedToolSlot ? " selected" : ""}${tool ? "" : " empty"}`;
      button.type = "button";
      button.dataset.slot = String(index);
      if (!tool) {
        button.disabled = true;
        button.setAttribute("aria-label", t("main.hotbarSlot.empty", { slot: index + 1 }));
        return button;
      }

      const label = t("mining.tools.slot", { slot: index + 1, item: t(tool.labelKey) });
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = `<span class="tool-icon ${tool.iconClass}" aria-hidden="true"></span>`;
      button.addEventListener("click", () => selectTool(index));
      return button;
    }),
  );
}

function selectTool(index) {
  const tool = toolSlots[index];
  if (!tool) return;
  state.selectedToolSlot = index;
  renderToolHotbar();
}

function renderMinerList() {
  const username = localStorage.getItem(storageKeys.username) || t("main.account.guest");
  const miners = [{ name: username, statusKey: "mining.userStatus.mining", hashrate: localHashrate(), blocks: state.minedBlocks }, ...virtualMiners];
  activeCount.textContent = String(miners.length);
  minerList.replaceChildren(
    ...miners.map((miner) => {
      const row = document.createElement("div");
      row.className = "miner-row";
      const initials = miner.name.trim().slice(0, 2).toUpperCase() || "--";
      row.innerHTML = `
        <span class="miner-badge" aria-hidden="true">${escapeHtml(initials)}</span>
        <span>
          <span class="miner-name">${escapeHtml(miner.name)}</span>
          <span class="miner-status">${escapeHtml(t(miner.statusKey))}</span>
        </span>
        <strong class="miner-yield">${escapeHtml(formatHashrate(miner.hashrate))}</strong>
      `;
      return row;
    }),
  );
}

function updateMiningHud() {
  const total = totalMiningHashrate();
  contractAddress.textContent = formatAddress(caveContractAddress);
  contractAddress.title = caveContractAddress;
  totalHashrate.textContent = formatHashrate(total);
  avgBlockTime.textContent = t("mining.panel.seconds", { value: averageBlockSeconds(total) });
  caveDepth.textContent = t("mining.panel.meters", { value: caveDepthMeters() });
  totalBlocks.textContent = formatInteger(totalMineBlockCount);
  minedBlocks.textContent = String(state.minedBlocks);
  remainingBlocks.textContent = formatInteger(state.remainingBlocks);
}

function caveDepthMeters() {
  return totalMineBlockCount;
}

function localHashrate() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  return Math.round(cores * 95 + memory * 42);
}

function totalMiningHashrate() {
  return virtualMiners.reduce((sum, miner) => sum + miner.hashrate, localHashrate());
}

function averageBlockSeconds(hashrate) {
  return Math.max(8, Math.round(920000 / Math.max(hashrate, 1)));
}

function formatHashrate(value) {
  if (value >= 1000) return t("mining.panel.hashrateKh", { value: (value / 1000).toFixed(1) });
  return t("mining.panel.hashrateH", { value });
}

function mineNearestOre() {
  if (state.mineCooldown > 0) return;
  const tool = toolSlots[state.selectedToolSlot];
  if (tool?.action !== "mine") return;
  state.miningSwing = performance.now() + miningSwingDuration;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(oreMeshes.filter((mesh) => mesh.parent), false);
  const hit = hits.find((entry) => isOreInMiningArea(entry.object));
  const ore = hit?.object ?? findReachableOre();
  if (!ore) {
    state.statusKey = "mining.status.noTarget";
    updateMiningHud();
    return;
  }

  faceBlock(ore);
  state.minedBlocks += 1;
  state.mineCooldown = 0.42;
  state.statusKey = "mining.status.mined";
  spawnOreParticles(ore.position, ore.material.color);
  removeOreBlock(ore);
  renderMinerList();
  updateMiningHud();
}

function removeOreBlock(ore) {
  const nextLayer = ore.userData.depthLayer + renderedMineLayerCount;
  const row = ore.userData.row;
  const col = ore.userData.col;
  ore.userData.veins?.forEach((vein) => vein.parent?.remove(vein));
  ore.parent?.remove(ore);
  removeCollider(ore.userData.collider);
  const index = oreMeshes.indexOf(ore);
  if (index !== -1) oreMeshes.splice(index, 1);
  state.remainingBlocks = Math.max(0, totalMineBlockCount - state.minedBlocks);
  addOreBlock({ row, col, layer: nextLayer, oreTypes: ["oreGold", "oreSilver", "oreBrass", "oreIron", "oreDiamond"] });
}

function removeCollider(collider) {
  const index = colliders.indexOf(collider);
  if (index !== -1) colliders.splice(index, 1);
}

function isOreInMiningArea(ore) {
  if (!ore?.parent) return false;
  const feetY = playerFeetBlockY();
  const horizontalDistance = Math.hypot(ore.position.x - state.playerPosition.x, ore.position.z - state.playerPosition.z);
  return (
    isFrontOre(ore) &&
    horizontalDistance <= miningHorizontalReach &&
    ore.position.y >= feetY - miningReachDown &&
    ore.position.y <= feetY + miningReachUp
  );
}

function isFrontOre(ore) {
  return !oreMeshes.some(
    (candidate) =>
      candidate.parent &&
      candidate !== ore &&
      candidate.userData.row === ore.userData.row &&
      candidate.userData.col === ore.userData.col &&
      candidate.userData.depthLayer < ore.userData.depthLayer,
  );
}

function findReachableOre() {
  const viewForward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  let best = null;
  let bestScore = Infinity;
  for (const ore of oreMeshes) {
    if (!isOreInMiningArea(ore)) continue;
    const toOre = ore.position.clone().sub(state.playerPosition);
    const flatDirection = new THREE.Vector3(toOre.x, 0, toOre.z);
    if (flatDirection.lengthSq() === 0) continue;
    const facing = flatDirection.normalize().dot(viewForward);
    if (facing < 0.25) continue;
    const score = toOre.length() - facing * 0.5;
    if (score < bestScore) {
      best = ore;
      bestScore = score;
    }
  }
  return best;
}

function playerFeetBlockY() {
  return Math.floor(state.playerPosition.y - avatarGroundOffset);
}

function faceDirection(direction) {
  state.avatarYaw = Math.atan2(-direction.x, -direction.z);
  player.rotation.y = state.avatarYaw;
}

function faceBlock(block) {
  const direction = new THREE.Vector3(block.position.x - state.playerPosition.x, 0, block.position.z - state.playerPosition.z);
  if (direction.lengthSq() > 0.0001) faceDirection(direction.normalize());
}

function spawnOreParticles(position, color) {
  for (let i = 0; i < 14; i += 1) {
    const mesh = new THREE.Mesh(cubeGeometry, new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(position);
    mesh.scale.setScalar(0.12 + Math.random() * 0.1);
    mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3.2 + 1.2, (Math.random() - 0.5) * 4);
    mesh.userData.life = 0.7 + Math.random() * 0.35;
    particles.push(mesh);
    scene.add(mesh);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  state.mineCooldown = Math.max(0, state.mineCooldown - dt);
  updatePlayer(dt);
  updateParticles(dt);
  updateCamera();
  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  if (state.exiting) {
    updatePlayerAnimation();
    return;
  }
  state.moving = false;
  resolvePlayerOverlap();
  const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const input = new THREE.Vector3(
    axis("KeyD", "ArrowRight") - axis("KeyA", "ArrowLeft"),
    0,
    axis("KeyS", "ArrowDown") - axis("KeyW", "ArrowUp"),
  );
  const ground = surfaceHeight() + 1.01;
  const canUseGroundControl = state.grounded || (state.playerPosition.y <= ground + 0.04 && state.playerVelocity.y <= 0);
  let requestedTakeoffDirection = null;
  let requestedTakeoffSpeed = 0;

  if (canUseGroundControl && input.lengthSq() > 0) {
    input.normalize();
    const movement = right.multiplyScalar(input.x).add(forward.multiplyScalar(input.z)).normalize();
    const speed = currentMoveSpeed();
    requestedTakeoffDirection = movement;
    requestedTakeoffSpeed = speed;
    state.moving = tryMoveHorizontal(movement, speed * dt);
    setHorizontalVelocity(movement, state.moving ? speed : 0);
    faceDirection(movement);
  } else if (canUseGroundControl) {
    clearHorizontalVelocity();
  } else {
    state.moving = applyAirborneHorizontalVelocity(dt);
  }

  const canJump = state.grounded || (state.playerPosition.y <= ground + 0.04 && state.playerVelocity.y <= 0);
  if (keys.has("Space") && canJump) {
    if (requestedTakeoffDirection) setHorizontalVelocity(requestedTakeoffDirection, requestedTakeoffSpeed);
    state.playerVelocity.y = jumpImpulse;
    state.grounded = false;
  }

  state.playerVelocity.y -= gravity * dt;
  state.playerPosition.y += state.playerVelocity.y * dt;

  if (state.playerPosition.y <= ground && state.playerVelocity.y <= 0) {
    state.playerPosition.y = ground;
    state.playerVelocity.y = 0;
    state.grounded = true;
    clearHorizontalVelocity();
  } else {
    state.grounded = false;
  }

  if (state.playerPosition.z >= 15.5 && Math.abs(state.playerPosition.x) <= 4.8) {
    beginExitTransition();
    return;
  }
  updatePlayerAnimation();
  lantern.position.set(state.playerPosition.x, 4.8, state.playerPosition.z + 2.5);
}

function axis(positiveCode, positiveAlt) {
  return keys.has(positiveCode) || keys.has(positiveAlt) ? 1 : 0;
}

function currentMoveSpeed() {
  return keys.has("ShiftLeft") || keys.has("ShiftRight") ? playerSprintSpeed : playerSpeed;
}

function setHorizontalVelocity(direction, speed) {
  if (!direction || speed <= 0) {
    clearHorizontalVelocity();
    return;
  }
  state.playerVelocity.x = direction.x * speed;
  state.playerVelocity.z = direction.z * speed;
}

function clearHorizontalVelocity() {
  state.playerVelocity.x = 0;
  state.playerVelocity.z = 0;
}

function applyAirborneHorizontalVelocity(dt) {
  const vx = state.playerVelocity.x;
  const vz = state.playerVelocity.z;
  if (Math.abs(vx) < 0.001 && Math.abs(vz) < 0.001) return false;

  const nextX = state.playerPosition.x + vx * dt;
  const nextZ = state.playerPosition.z + vz * dt;
  if (moveHorizontalTo(nextX, nextZ)) return true;

  let moved = false;
  if (Math.abs(vx) > 0.001) moved = moveHorizontalTo(nextX, state.playerPosition.z) || moved;
  if (Math.abs(vz) > 0.001) moved = moveHorizontalTo(state.playerPosition.x, nextZ) || moved;
  return moved;
}

function tryMoveHorizontal(direction, distance) {
  const nextX = state.playerPosition.x + direction.x * distance;
  const nextZ = state.playerPosition.z + direction.z * distance;
  if (moveHorizontalTo(nextX, nextZ)) return true;

  let moved = false;
  if (Math.abs(direction.x) > 0.001) moved = moveHorizontalTo(nextX, state.playerPosition.z) || moved;
  if (Math.abs(direction.z) > 0.001) moved = moveHorizontalTo(state.playerPosition.x, nextZ) || moved;
  return moved;
}

function moveHorizontalTo(x, z) {
  const clampedX = THREE.MathUtils.clamp(x, -8.4, 8.4);
  const clampedZ = THREE.MathUtils.clamp(z, caveStartZ - 1.5, 22.5);
  if (playerBodyCollides(clampedX, clampedZ, state.playerPosition.y)) return false;
  state.playerPosition.x = clampedX;
  state.playerPosition.z = clampedZ;
  return true;
}

function surfaceHeight() {
  return caveSurfaceHeight;
}

function playerBodyCollides(x, z, y) {
  return playerBodyCollisionPush(x, z, y).lengthSq() > 0;
}

function resolvePlayerOverlap() {
  for (let i = 0; i < 3; i += 1) {
    const push = playerBodyCollisionPush(state.playerPosition.x, state.playerPosition.z, state.playerPosition.y);
    if (push.lengthSq() === 0) return;
    state.playerPosition.x += push.x;
    state.playerPosition.z += push.z;
  }
}

function playerBodyCollisionPush(x, z, y) {
  const minX = x - playerRadius;
  const maxX = x + playerRadius;
  const minZ = z - playerRadius;
  const maxZ = z + playerRadius;
  const minY = y - 1.01;
  const maxY = y + playerBodyTopOffset;
  const push = new THREE.Vector3();

  for (const collider of colliders) {
    if (!collider.mesh.parent) continue;
    if (minY >= collider.maxY || maxY <= collider.minY || minX >= collider.maxX || maxX <= collider.minX || minZ >= collider.maxZ || maxZ <= collider.minZ) {
      continue;
    }

    const overlapX = Math.min(maxX - collider.minX, collider.maxX - minX);
    const overlapZ = Math.min(maxZ - collider.minZ, collider.maxZ - minZ);
    if (overlapX <= 0 || overlapZ <= 0) continue;

    const centerX = (collider.minX + collider.maxX) * 0.5;
    const centerZ = (collider.minZ + collider.maxZ) * 0.5;
    if (overlapX < overlapZ) {
      push.x += x < centerX ? -overlapX - 0.002 : overlapX + 0.002;
    } else {
      push.z += z < centerZ ? -overlapZ - 0.002 : overlapZ + 0.002;
    }
  }

  return push;
}

function beginExitTransition() {
  if (state.exiting) return;
  state.exiting = true;
  keys.clear();
  miningShell.classList.add("exiting");
  window.setTimeout(() => {
    window.location.href = "/";
  }, 2000);
}

function updatePlayerAnimation() {
  const limbs = player.userData.limbs;
  if (!limbs) return;
  const tNow = performance.now();
  const walkT = tNow * 0.011;
  const walkSwing = state.moving ? Math.sin(walkT) * 0.32 : Math.sin(walkT * 0.25) * 0.03;
  const mineRemaining = Math.max(0, state.miningSwing - tNow);
  const mineProgress = mineRemaining > 0 ? 1 - mineRemaining / miningSwingDuration : 0;
  const miningPose = getMiningPose(mineProgress);
  const { leftArm, rightArm, leftLeg, rightLeg, head } = limbs;

  leftArm.rotation.x = walkSwing;
  rightArm.rotation.z = miningPose.active ? -0.2 : 0;
  rightArm.rotation.x = miningPose.active ? miningPose.armX : -walkSwing;
  leftLeg.rotation.x = -walkSwing;
  rightLeg.rotation.x = walkSwing;
  head.rotation.x = -0.06;
  head.rotation.y = state.moving ? Math.sin(walkT * 0.5) * 0.04 : Math.sin(walkT * 0.2) * 0.025;
  player.position.copy(state.playerPosition);
  player.position.y -= avatarGroundOffset;
  player.position.y += state.moving ? Math.abs(Math.sin(walkT * 0.5)) * 0.035 : 0;
}

function getMiningPose(progress) {
  if (progress <= 0 || progress >= 1) return { active: false, armX: 0 };
  if (progress < 0.2) {
    const raise = easeOut(progress / 0.2);
    return { active: true, armX: THREE.MathUtils.lerp(0.15, 1.95, raise) };
  }
  const strike = easeIn((progress - 0.2) / 0.8);
  return { active: true, armX: THREE.MathUtils.lerp(1.95, 0.38, strike) };
}

function easeOut(value) {
  return 1 - (1 - value) * (1 - value);
}

function easeIn(value) {
  return value * value;
}

function updateCamera() {
  const target = player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  const distance = 8.4;
  const horizontal = Math.cos(state.cameraPitch) * distance;
  const offset = new THREE.Vector3(
    Math.sin(state.yaw) * horizontal,
    Math.sin(-state.cameraPitch) * distance + 2.1,
    Math.cos(state.yaw) * horizontal,
  );
  camera.position.lerp(target.clone().add(offset), 0.14);
  camera.lookAt(target);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.userData.life -= dt;
    particle.userData.velocity.y -= 6 * dt;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.rotation.x += dt * 8;
    particle.rotation.y += dt * 6;
    if (particle.userData.life <= 0) {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function formatAddress(address) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatInteger(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function noise2(x, z) {
  return Math.sin(x * 12.9898 + z * 78.233) * 0.5 + Math.sin(x * 4.21 - z * 9.17) * 0.5;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
