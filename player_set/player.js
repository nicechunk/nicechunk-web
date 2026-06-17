import * as THREE from "three";
import { initI18n, t } from "./i18n.js";

const canvas = document.querySelector("#preview");
const baseCharacterSelect = document.querySelector("#baseCharacter");
const boxSelect = document.querySelector("#boxSelect");
const boxName = document.querySelector("#boxName");
const boxColor = document.querySelector("#boxColor");
const chainCode = document.querySelector("#chainCode");
const byteSize = document.querySelector("#byteSize");
const chainOutput = document.querySelector(".chain-output");
const toggleCode = document.querySelector("#toggleCode");
const toggleDataMode = document.querySelector("#toggleDataMode");
const textureMode = document.querySelector("#textureMode");
const faceSelect = document.querySelector("#faceSelect");
const paintColor = document.querySelector("#paintColor");
const paintBoard = document.querySelector("#paintBoard");
const paintCtx = paintBoard.getContext("2d");
const gridSize = document.querySelector("#gridSize");

await initI18n();

const faces = ["right", "left", "top", "bottom", "front", "back"];
const faceLabels = {
  front: "player.face.front",
  back: "player.face.back",
  left: "player.face.left",
  right: "player.face.right",
  top: "player.face.top",
  bottom: "player.face.bottom",
};
const chainPalette = [
  "#151414",
  "#2b2520",
  "#3f2918",
  "#2b1b11",
  "#4d3424",
  "#7c392f",
  "#b2774f",
  "#c99061",
  "#d8a171",
  "#f0c28f",
  "#d6a84a",
  "#f2d36b",
  "#294a7c",
  "#1d335c",
  "#3f65a3",
  "#6e93d6",
  "#216966",
  "#2e8b86",
  "#58b6a8",
  "#8dd9ca",
  "#2f6b38",
  "#72b957",
  "#a6db67",
  "#e8e4c9",
  "#ffffff",
  "#bfc4bd",
  "#777d74",
  "#3f463c",
  "#ce4d4d",
  "#e08343",
  "#7d55c7",
  "#2ba9d6",
];

const vectorDictionaryBits = 6;
const sgp3PositionDictionary = [
  [0, 155, 0],
  [0, 162, -26],
  [0, 102, -27],
  [0, 102, -31],
  [0, 245, 0],
  [-18, 253, -46],
  [18, 253, -46],
  [0, 239, -47],
  [0, 222, -47],
  [0, 292, -2],
  [0, 261, 46],
  [-47, 262, 0],
  [47, 262, 0],
  [-22, 277, -48],
  [16, 278, -48],
  [-64, 179, 0],
  [-64, 153, -1],
  [-64, 127, 0],
  [64, 179, 0],
  [64, 153, -1],
  [64, 127, 0],
  [-23, 81, 0],
  [-23, 21, -3],
  [23, 81, 0],
  [23, 21, -3],
  [0, 146, 42],
  [0, 191, 40],
  [0, 164, 62],
  [0, 122, 63],
  [-45, 128, 43],
  [45, 128, 43],
  [-27, 162, -31],
  [-64, 151, -1],
  [64, 151, -1],
  [27, 162, -31],
  [-28, 198, 16],
  [28, 198, 16],
  [-64, 145, -20],
  [-64, 145, -23],
  [-64, 145, -25],
  [-14, 205, -28],
  [14, 205, -28],
  [-64, 110, -19],
  [64, 110, -19],
  [-23, 93, -20],
  [23, 93, -20],
  [-23, 45, -3],
  [23, 45, -3],
];
const sgp3SizeDictionary = [
  [84, 114, 46],
  [50, 72, 5],
  [90, 13, 6],
  [16, 16, 7],
  [86, 86, 86],
  [11, 11, 5],
  [12, 16, 5],
  [28, 6, 5],
  [94, 18, 94],
  [94, 50, 12],
  [12, 50, 82],
  [28, 18, 12],
  [34, 20, 12],
  [34, 50, 38],
  [36, 10, 40],
  [32, 42, 34],
  [36, 76, 36],
  [40, 42, 46],
  [20, 20, 8],
  [78, 84, 34],
  [72, 14, 30],
  [64, 26, 6],
  [46, 28, 6],
  [12, 30, 26],
  [12, 90, 5],
  [12, 14, 30],
  [36, 6, 40],
  [34, 8, 4],
  [20, 14, 4],
  [14, 8, 3],
  [20, 12, 5],
  [22, 8, 5],
  [22, 50, 5],
  [42, 12, 48],
];

const defaultCharacter = {
  v: 1,
  unit: 100,
  boxes: [
    box("body", "#2e8b86", [0, 155, 0], [84, 114, 46]),
    box("shirt_panel", "#58b6a8", [0, 162, -26], [50, 72, 5]),
    box("collar_l", "#216966", [-14, 205, -28], [20, 12, 5]),
    box("collar_r", "#216966", [14, 205, -28], [20, 12, 5]),
    box("belt", "#4d3424", [0, 102, -27], [90, 13, 6]),
    box("buckle", "#d6a84a", [0, 102, -31], [16, 16, 7]),
    box("head", "#c99061", [0, 245, 0], [86, 86, 86]),
    box("eye_l", "#151414", [-18, 253, -46], [11, 11, 5]),
    box("eye_r", "#151414", [18, 253, -46], [11, 11, 5]),
    box("nose", "#b2774f", [0, 239, -47], [12, 16, 5]),
    box("mouth", "#7c392f", [0, 222, -47], [28, 6, 5]),
    box("hair_top", "#3f2918", [0, 292, -2], [94, 18, 94]),
    box("hair_back", "#2b1b11", [0, 261, 46], [94, 50, 12]),
    box("hair_left", "#3f2918", [-47, 262, 0], [12, 50, 82]),
    box("hair_right", "#3f2918", [47, 262, 0], [12, 50, 82]),
    box("bang_l", "#3f2918", [-22, 277, -48], [28, 18, 12]),
    box("bang_r", "#2b1b11", [16, 278, -48], [34, 20, 12]),
    box("arm_l_sleeve", "#216966", [-64, 179, 0], [34, 50, 38]),
    box("arm_l_cuff", "#58b6a8", [-64, 151, -1], [36, 6, 40]),
    box("hand_l", "#c99061", [-64, 127, 0], [32, 42, 34]),
    box("knuckle_l", "#b2774f", [-64, 110, -19], [22, 8, 5]),
    box("watch_band", "#2b2520", [-64, 145, -20], [34, 8, 4]),
    box("watch_case", "#d6a84a", [-64, 145, -23], [20, 14, 4]),
    box("watch_face", "#2ba9d6", [-64, 145, -25], [14, 8, 3]),
    box("arm_r_sleeve", "#216966", [64, 179, 0], [34, 50, 38]),
    box("arm_r_cuff", "#58b6a8", [64, 151, -1], [36, 6, 40]),
    box("hand_r", "#c99061", [64, 127, 0], [32, 42, 34]),
    box("knuckle_r", "#b2774f", [64, 110, -19], [22, 8, 5]),
    box("leg_l", "#294a7c", [-23, 81, 0], [36, 76, 36]),
    box("pant_stripe_l", "#1d335c", [-23, 93, -20], [22, 50, 5]),
    box("boot_l", "#2b2520", [-23, 21, -3], [40, 42, 46]),
    box("boot_lip_l", "#4d3424", [-23, 45, -3], [42, 12, 48]),
    box("leg_r", "#294a7c", [23, 81, 0], [36, 76, 36]),
    box("pant_stripe_r", "#1d335c", [23, 93, -20], [22, 50, 5]),
    box("boot_r", "#2b2520", [23, 21, -3], [40, 42, 46]),
    box("boot_lip_r", "#4d3424", [23, 45, -3], [42, 12, 48]),
    box("backpack_body", "#4d3424", [0, 146, 42], [78, 84, 34]),
    box("backpack_top", "#b2774f", [0, 191, 40], [72, 14, 30]),
    box("backpack_flap", "#3f463c", [0, 164, 62], [64, 26, 6]),
    box("backpack_pocket", "#b2774f", [0, 122, 63], [46, 28, 6]),
    box("backpack_side_l", "#3f463c", [-45, 128, 43], [12, 30, 26]),
    box("backpack_side_r", "#3f463c", [45, 128, 43], [12, 30, 26]),
    box("backpack_strap_l", "#2b2520", [-27, 162, -31], [12, 90, 5]),
    box("backpack_strap_r", "#2b2520", [27, 162, -31], [12, 90, 5]),
    box("backpack_shoulder_l", "#2b2520", [-28, 198, 16], [12, 14, 30]),
    box("backpack_shoulder_r", "#2b2520", [28, 198, 16], [12, 14, 30]),
  ],
};

const femaleCharacter = createFemaleCharacter();
const compressedBaseCharacters = {
  male: defaultCharacter,
  female: femaleCharacter,
};
const baseCharacters = {
  ...compressedBaseCharacters,
  male_explorer: createGeneratedCharacter({
    skin: "#d8a171",
    hair: "#3f2918",
    hairDark: "#2b1b11",
    hairLight: "#5a3320",
    hairStyle: "short",
    jacket: "#0f6f69",
    jacketDark: "#0d5552",
    shirt: "#e8e4c9",
    pants: "#2b2520",
    pantsDark: "#1d1712",
    boot: "#3a2618",
    bootDark: "#1d1712",
    accent: "#58b6a8",
    belt: "#5b351f",
    buckle: "#d6a84a",
    backpack: "#4d3424",
    backpackDark: "#2b1b11",
    backpackLight: "#6c452b",
    body: "male",
    accessory: "wristGems",
  }),
  male_scout: createGeneratedCharacter({
    skin: "#d8a171",
    hair: "#c58a38",
    hairDark: "#8a5a24",
    hairLight: "#d6a84a",
    hairStyle: "swept",
    jacket: "#1d335c",
    jacketDark: "#142541",
    shirt: "#e8e4c9",
    pants: "#2b2520",
    pantsDark: "#151414",
    boot: "#5a3320",
    bootDark: "#2b1b11",
    accent: "#e08343",
    belt: "#5b351f",
    buckle: "#bfc4bd",
    backpack: "#8a5a24",
    backpackDark: "#4d3424",
    backpackLight: "#c58a38",
    body: "male",
    accessory: "scarf",
  }),
  female_ponytail: createGeneratedCharacter({
    skin: "#d8a171",
    hair: "#3f2918",
    hairDark: "#2b1b11",
    hairLight: "#5a3320",
    hairStyle: "ponytail",
    jacket: "#0f6f69",
    jacketDark: "#0d5552",
    shirt: "#e8e4c9",
    pants: "#2b2520",
    pantsDark: "#1d1712",
    boot: "#3a2618",
    bootDark: "#1d1712",
    accent: "#58b6a8",
    belt: "#5b351f",
    buckle: "#d6a84a",
    backpack: "#8a5a24",
    backpackDark: "#4d3424",
    backpackLight: "#c58a38",
    body: "femaleShorts",
    accessory: "wristGems",
  }),
  female_engineer: createGeneratedCharacter({
    skin: "#d8a171",
    hair: "#a34f24",
    hairDark: "#6f321c",
    hairLight: "#c15f2e",
    hairStyle: "bob",
    jacket: "#6b49b8",
    jacketDark: "#4b347f",
    shirt: "#e8e4c9",
    pants: "#2b2520",
    pantsDark: "#1d1712",
    boot: "#4d3424",
    bootDark: "#2b1b11",
    accent: "#9b7ac8",
    belt: "#8a5a24",
    buckle: "#d6a84a",
    backpack: "#3f65a3",
    backpackDark: "#294a7c",
    backpackLight: "#6e93d6",
    body: "femalePants",
    accessory: "toolbelt",
  }),
  guardian: createGuardianCharacter(),
};

const sgp3PresetBits = 7;
const sgp3BoxPresets = createPresetBoxes(compressedBaseCharacters);

let activeBaseCharacter = "male";
let character = cloneBaseCharacter(activeBaseCharacter);
let selected = 0;
const meshes = new Map();
let painting = false;
let dataMode = "chain";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8e8);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xf6fbff, 0x536642, 2.2));
const sun = new THREE.DirectionalLight(0xfff0bd, 2.1);
sun.position.set(-6, 9, 5);
sun.castShadow = true;
scene.add(sun);

const frontFill = new THREE.DirectionalLight(0xeaf8ff, 1.2);
frontFill.position.set(3, 5, -7);
scene.add(frontFill);

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(4.4, 0.08, 4.4),
  new THREE.MeshLambertMaterial({ color: 0x72b957 }),
);
floor.position.y = -0.06;
floor.receiveShadow = true;
scene.add(floor);

const root = new THREE.Group();
scene.add(root);

const cube = new THREE.BoxGeometry(1, 1, 1);
let yaw = Math.PI - 0.35;
let pitch = 0.05;
let dragging = false;
let lastX = 0;
let lastY = 0;

canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  yaw += (event.clientX - lastX) * 0.008;
  pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.004, -0.45, 0.6);
  lastX = event.clientX;
  lastY = event.clientY;
});

canvas.addEventListener("pointerup", () => {
  dragging = false;
});

document.querySelector("#resetView").addEventListener("click", () => {
  yaw = Math.PI - 0.35;
  pitch = 0.05;
});

baseCharacterSelect.addEventListener("change", () => {
  activeBaseCharacter = baseCharacters[baseCharacterSelect.value] ? baseCharacterSelect.value : "male";
  character = cloneBaseCharacter(activeBaseCharacter);
  selected = 0;
  syncAll();
});

document.querySelector("#addBox").addEventListener("click", () => {
  character.boxes.push(box("new_box", "#ffffff", [0, 160, -55], [20, 20, 8]));
  selected = character.boxes.length - 1;
  syncAll();
});

document.querySelector("#duplicateBox").addEventListener("click", () => {
  const copy = structuredClone(currentBox());
  copy.n = `${copy.n}_copy`;
  copy.p[0] += 8;
  character.boxes.push(copy);
  selected = character.boxes.length - 1;
  syncAll();
});

document.querySelector("#deleteBox").addEventListener("click", () => {
  if (character.boxes.length <= 1) return;
  character.boxes.splice(selected, 1);
  selected = Math.max(0, selected - 1);
  syncAll();
});

document.querySelector("#resetCharacter").addEventListener("click", () => {
  character = cloneBaseCharacter(activeBaseCharacter);
  selected = 0;
  syncAll();
});

toggleCode.addEventListener("click", () => {
  toggleCodeDrawer();
});

document.querySelector(".output-head").addEventListener("click", () => {
  toggleCodeDrawer(false);
});

toggleDataMode.addEventListener("click", (event) => {
  event.stopPropagation();
  dataMode = dataMode === "chain" ? "json" : "chain";
  writeCode();
});

boxSelect.addEventListener("change", () => {
  selected = Number(boxSelect.value);
  syncPanel();
});

boxName.addEventListener("input", () => {
  currentBox().n = boxName.value.trim() || "box";
  syncSelect();
  writeCode();
});

boxColor.addEventListener("input", () => {
  currentBox().c = boxColor.value;
  renderCharacter();
  drawPaintBoard();
  writeCode();
});

textureMode.addEventListener("change", () => {
  const part = currentBox();
  if (textureMode.value === "paint") ensureFaceTexture(part, faceSelect.value);
  if (textureMode.value === "solid" && part.t) delete part.t[faceSelect.value];
  cleanupEmptyTextures(part);
  renderCharacter();
  drawPaintBoard();
  writeCode();
});

faceSelect.addEventListener("change", () => {
  textureMode.value = currentBox().t?.[faceSelect.value] ? "paint" : "solid";
  drawPaintBoard();
});

document.querySelector("#fillFace").addEventListener("click", () => {
  const tex = ensureFaceTexture(currentBox(), faceSelect.value);
  tex.p.fill(paintColor.value);
  textureMode.value = "paint";
  renderCharacter();
  drawPaintBoard();
  writeCode();
});

document.querySelector("#clearFace").addEventListener("click", () => {
  const part = currentBox();
  if (part.t) delete part.t[faceSelect.value];
  cleanupEmptyTextures(part);
  textureMode.value = "solid";
  renderCharacter();
  drawPaintBoard();
  writeCode();
});

paintBoard.addEventListener("pointerdown", (event) => {
  painting = true;
  paintBoard.setPointerCapture(event.pointerId);
  paintCell(event);
});

paintBoard.addEventListener("pointermove", (event) => {
  if (painting) paintCell(event);
});

paintBoard.addEventListener("pointerup", () => {
  painting = false;
});

createVectorControls("positionControls", "p", ["x", "y", "z"], -180, 340, 1);
createVectorControls("scaleControls", "s", ["w", "h", "d"], 1, 160, 1);
createVectorControls("rotationControls", "r", ["rx", "ry", "rz"], -180, 180, 1);

window.addEventListener("nicechunk:playerSetLanguageChange", () => {
  updateCodeButtons();
  drawPaintBoard();
});
window.addEventListener("resize", resize);
syncAll();
resize();
animate();

function box(n, c, p, s, r = [0, 0, 0]) {
  return { n, c, p, s, r };
}

function cloneBaseCharacter(key) {
  return structuredClone(baseCharacters[key] ?? defaultCharacter);
}

function createPresetBoxes(sources) {
  const seen = new Set();
  const presets = [];
  Object.values(sources).forEach((source) => {
    source.boxes.forEach((part) => {
      const key = JSON.stringify([part.c, part.p, part.s, part.r]);
      if (seen.has(key)) return;
      seen.add(key);
      presets.push({
        n: part.n,
        c: part.c,
        p: [...part.p],
        s: [...part.s],
        r: [...part.r],
      });
    });
  });
  return presets;
}

function createFemaleCharacter() {
  const next = structuredClone(defaultCharacter);
  updatePart(next, "body", { c: "#7d55c7", p: [0, 154, 0], s: [74, 108, 42] });
  updatePart(next, "shirt_panel", { c: "#b2774f", p: [0, 162, -25], s: [44, 70, 5] });
  updatePart(next, "collar_l", { c: "#f2d36b", p: [-13, 205, -28], s: [18, 11, 5] });
  updatePart(next, "collar_r", { c: "#f2d36b", p: [13, 205, -28], s: [18, 11, 5] });
  updatePart(next, "belt", { c: "#2b2520", p: [0, 105, -27], s: [78, 12, 6] });
  updatePart(next, "buckle", { c: "#d6a84a", p: [0, 105, -31], s: [14, 14, 7] });
  updatePart(next, "mouth", { c: "#ce4d4d", p: [0, 222, -47], s: [24, 6, 5] });
  updatePart(next, "hair_top", { c: "#2b1b11", p: [0, 292, -2], s: [98, 18, 96] });
  updatePart(next, "hair_back", { c: "#2b1b11", p: [0, 241, 48], s: [98, 96, 14] });
  updatePart(next, "hair_left", { c: "#3f2918", p: [-50, 242, 0], s: [14, 92, 82] });
  updatePart(next, "hair_right", { c: "#3f2918", p: [50, 242, 0], s: [14, 92, 82] });
  updatePart(next, "bang_l", { c: "#3f2918", p: [-24, 278, -48], s: [34, 22, 12] });
  updatePart(next, "bang_r", { c: "#2b1b11", p: [18, 278, -48], s: [36, 22, 12] });
  updatePart(next, "arm_l_sleeve", { c: "#7d55c7", p: [-58, 178, 0], s: [30, 48, 34] });
  updatePart(next, "arm_l_cuff", { c: "#f2d36b", p: [-58, 151, -1], s: [32, 6, 36] });
  updatePart(next, "hand_l", { p: [-58, 127, 0], s: [28, 40, 30] });
  updatePart(next, "knuckle_l", { p: [-58, 110, -18], s: [20, 8, 5] });
  updatePart(next, "watch_band", { p: [-58, 145, -20], s: [30, 8, 4] });
  updatePart(next, "watch_case", { p: [-58, 145, -23], s: [18, 14, 4] });
  updatePart(next, "watch_face", { p: [-58, 145, -25], s: [12, 8, 3] });
  updatePart(next, "arm_r_sleeve", { c: "#7d55c7", p: [58, 178, 0], s: [30, 48, 34] });
  updatePart(next, "arm_r_cuff", { c: "#f2d36b", p: [58, 151, -1], s: [32, 6, 36] });
  updatePart(next, "hand_r", { p: [58, 127, 0], s: [28, 40, 30] });
  updatePart(next, "knuckle_r", { p: [58, 110, -18], s: [20, 8, 5] });
  updatePart(next, "leg_l", { c: "#1d335c", p: [-19, 80, 0], s: [30, 74, 32] });
  updatePart(next, "pant_stripe_l", { c: "#294a7c", p: [-19, 92, -19], s: [18, 48, 5] });
  updatePart(next, "boot_l", { p: [-19, 21, -3], s: [34, 42, 42] });
  updatePart(next, "boot_lip_l", { p: [-19, 45, -3], s: [36, 12, 44] });
  updatePart(next, "leg_r", { c: "#1d335c", p: [19, 80, 0], s: [30, 74, 32] });
  updatePart(next, "pant_stripe_r", { c: "#294a7c", p: [19, 92, -19], s: [18, 48, 5] });
  updatePart(next, "boot_r", { p: [19, 21, -3], s: [34, 42, 42] });
  updatePart(next, "boot_lip_r", { p: [19, 45, -3], s: [36, 12, 44] });
  updatePart(next, "backpack_body", { c: "#3f463c", p: [0, 146, 40], s: [68, 78, 30] });
  updatePart(next, "backpack_top", { c: "#b2774f", p: [0, 189, 39], s: [62, 14, 28] });
  updatePart(next, "backpack_flap", { p: [0, 164, 58], s: [56, 24, 6] });
  updatePart(next, "backpack_pocket", { p: [0, 122, 58], s: [40, 26, 6] });
  updatePart(next, "backpack_side_l", { p: [-39, 128, 40], s: [10, 28, 24] });
  updatePart(next, "backpack_side_r", { p: [39, 128, 40], s: [10, 28, 24] });
  updatePart(next, "backpack_strap_l", { p: [-23, 162, -30], s: [10, 88, 5] });
  updatePart(next, "backpack_strap_r", { p: [23, 162, -30], s: [10, 88, 5] });
  updatePart(next, "backpack_shoulder_l", { p: [-25, 198, 14], s: [10, 14, 28] });
  updatePart(next, "backpack_shoulder_r", { p: [25, 198, 14], s: [10, 14, 28] });
  next.boxes.push(
    box("skirt_front", "#7d55c7", [0, 99, -27], [82, 36, 7]),
    box("skirt_back", "#5b3b9f", [0, 99, 25], [82, 36, 7]),
    box("skirt_left", "#6b49b8", [-44, 99, 0], [7, 36, 46]),
    box("skirt_right", "#6b49b8", [44, 99, 0], [7, 36, 46]),
  );
  return next;
}

function createGeneratedCharacter(config) {
  const female = config.body.startsWith("female");
  const shorts = config.body === "femaleShorts";
  const boxes = [
    box("core_head", config.skin, [0, 236, -4], [86, 76, 78]),
    box("face_panel", "#f0c28f", [0, 232, -48], [74, 56, 6]),
    box("ear_l", "#f0c28f", [-48, 226, -22], [10, 24, 18]),
    box("ear_r", "#f0c28f", [48, 226, -22], [10, 24, 18]),
    box("eye_l", "#151414", [-20, 238, -53], [11, 14, 5]),
    box("eye_r", "#151414", [22, 238, -53], [11, 14, 5]),
    box("nose", "#c99061", [2, 224, -54], [13, 17, 5]),
    box("mouth", "#7c392f", [4, 207, -54], [30, 7, 5]),
    box("core_neck", "#f0c28f", [0, 184, -10], [28, 28, 28]),
    box("core_body", config.shirt, [0, 143, 0], [female ? 66 : 72, 94, 42]),
    box("shirt_front", config.shirt, [0, 146, -28], [female ? 52 : 56, 84, 8]),
    box("jacket_l", config.jacket, [-29, 154, -25], [26, 92, 12]),
    box("jacket_r", config.jacketDark, [30, 154, -25], [26, 92, 12]),
    box("jacket_side_l", config.jacketDark, [-42, 149, 0], [14, 82, 42]),
    box("jacket_side_r", config.jacketDark, [43, 149, 0], [14, 82, 42]),
    box("jacket_collar_l", config.jacket, [-18, 191, -34], [22, 22, 10]),
    box("jacket_collar_r", config.jacketDark, [20, 191, -34], [22, 22, 10]),
    box("core_arm_l", config.skin, [-62, 96, -2], [26, 34, 28]),
    box("core_arm_r", config.skin, [62, 96, -2], [26, 34, 28]),
    box("sleeve_l", config.jacket, [-62, 151, -2], [28, 58, 34]),
    box("sleeve_r", config.jacketDark, [62, 151, -2], [28, 58, 34]),
    box("sleeve_cuff_l", config.accent, [-62, 119, -2], [32, 10, 36]),
    box("sleeve_cuff_r", config.accent, [62, 119, -2], [32, 10, 36]),
    box("core_hand_l", "#f0c28f", [-62, 73, -2], [24, 28, 24]),
    box("core_hand_r", "#f0c28f", [62, 73, -2], [24, 28, 24]),
    box("belt", config.belt, [0, 94, -26], [78, 15, 8]),
    box("belt_buckle", config.buckle, [0, 94, -32], [18, 22, 8]),
    box(shorts ? "shorts_l" : "pants_l", config.pants, [-21, 72, -8], [32, shorts ? 44 : 80, 40]),
    box(shorts ? "shorts_r" : "pants_r", config.pantsDark, [22, 72, -8], [32, shorts ? 44 : 80, 40]),
    box("core_leg_l", shorts ? "#d8a171" : config.pants, [-22, 33, -2], [28, shorts ? 58 : 78, 28]),
    box("core_leg_r", shorts ? "#d8a171" : config.pantsDark, [22, 33, -2], [28, shorts ? 58 : 78, 28]),
    box("core_foot_l", config.boot, [-22, 24, -1], [34, 48, 42]),
    box("core_foot_r", config.boot, [22, 24, -1], [34, 48, 42]),
    box("boot_cuff_l", config.accent, [-22, 50, -22], [36, 12, 8]),
    box("boot_cuff_r", config.accent, [22, 50, -22], [36, 12, 8]),
    box("boot_sole_l", config.bootDark, [-22, 6, -7], [38, 12, 50]),
    box("boot_sole_r", config.bootDark, [22, 6, -7], [38, 12, 50]),
    box("backpack_body", config.backpack, [0, 143, 50], [82, 100, 28]),
    box("backpack_top", config.backpackLight, [0, 196, 46], [72, 28, 26]),
    box("backpack_flap", config.backpackDark, [0, 153, 68], [62, 48, 8]),
    box("backpack_pocket", config.backpackLight, [0, 105, 68], [44, 34, 8]),
    box("backpack_side_l", config.backpackDark, [-47, 136, 50], [12, 58, 24]),
    box("backpack_side_r", config.backpackDark, [47, 136, 50], [12, 58, 24]),
    box("strap_l", config.belt, [-28, 150, -34], [12, 94, 7]),
    box("strap_r", config.belt, [28, 150, -34], [12, 94, 7]),
  ];

  boxes.push(...createGeneratedHair(config));
  boxes.push(...createGeneratedAccessory(config));
  return { v: 1, unit: 100, boxes: boxes.slice(0, 63) };
}

function createGeneratedHair(config) {
  const longHair = config.hairStyle === "ponytail" || config.hairStyle === "bob";
  const sideY = longHair ? 226 : 238;
  const sideHeight = longHair ? 62 : 38;
  const backY = longHair ? 232 : 240;
  const backHeight = longHair ? 78 : 42;
  const hair = [
    box("hair_cap", config.hair, [0, 276, -6], [92, 24, 84]),
    box("hair_front", config.hair, [0, 256, -48], [80, 22, 12]),
    box("bang_l", config.hairLight, [-24, 250, -53], [28, 28, 10]),
    box("bang_r", config.hair, [25, 250, -53], [30, 26, 10]),
    box("hair_side_l", config.hairDark, [-47, sideY, -6], [14, sideHeight, 68]),
    box("hair_side_r", config.hairDark, [48, sideY, -6], [14, Math.max(34, sideHeight - 4), 64]),
    box("hair_back_panel", config.hairDark, [0, backY, 43], [90, backHeight, 16]),
  ];

  if (config.hairStyle === "short") {
    hair.push(box("hair_back_low", config.hairDark, [0, 203, 42], [70, 24, 14]));
  }
  if (config.hairStyle === "swept") {
    hair.push(
      box("swept_front_high", config.hairLight, [-10, 270, -50], [58, 18, 12]),
      box("swept_front_low", config.hair, [-18, 253, -54], [44, 20, 10]),
      box("sideburn_l", config.hairDark, [-46, 208, -34], [12, 34, 18]),
    );
  }
  if (config.hairStyle === "ponytail") {
    hair.push(
      box("ponytail_root", config.hair, [-46, 252, 54], [36, 40, 34]),
      box("ponytail_mid", config.hair, [-66, 218, 58], [38, 74, 34]),
      box("ponytail_tip", config.hairDark, [-66, 178, 52], [28, 34, 28]),
      box("hair_tie", "#9c3d2e", [-38, 266, 48], [34, 18, 22]),
      box("long_lock_l", config.hairDark, [-36, 190, -36], [14, 54, 16]),
      box("long_lock_r", config.hairDark, [38, 192, -36], [14, 50, 16]),
    );
  }
  if (config.hairStyle === "bob") {
    hair.push(
      box("bob_left_low", config.hairDark, [-43, 197, -4], [16, 58, 58]),
      box("bob_right_low", config.hairDark, [44, 197, -4], [16, 58, 58]),
      box("bob_back_low", config.hairDark, [0, 195, 42], [84, 58, 16]),
      box("bob_top_highlight", config.hairLight, [0, 291, -4], [82, 12, 76]),
    );
  }
  return hair;
}

function createGeneratedAccessory(config) {
  if (config.accessory === "scarf") {
    return [
      box("scarf_wrap", config.accent, [0, 181, -34], [48, 20, 12]),
      box("scarf_tail_l", config.accent, [-9, 161, -37], [18, 38, 10]),
      box("scarf_tail_r", "#c86a25", [10, 151, -38], [18, 28, 10]),
      box("wrist_band_l", config.bootDark, [-62, 111, -3], [34, 16, 34]),
      box("wrist_band_r", config.bootDark, [62, 111, -3], [34, 16, 34]),
    ];
  }
  if (config.accessory === "toolbelt") {
    return [
      box("tool_pouch_l", "#8a5a24", [-37, 69, -30], [20, 38, 12]),
      box("tool_pouch_r", "#8a5a24", [38, 70, -30], [22, 34, 12]),
      box("tool_handle_l", "#bfc4bd", [-38, 93, -38], [10, 32, 8]),
      box("tool_head_l", "#777d74", [-38, 105, -45], [22, 10, 8]),
      box("wrist_band_l", "#4d3424", [-62, 111, -3], [34, 16, 34]),
      box("wrist_band_r", "#4d3424", [62, 111, -3], [34, 16, 34]),
    ];
  }
  return [
    box("wrist_band_l", config.belt, [-62, 111, -3], [34, 16, 34]),
    box("wrist_band_r", config.belt, [62, 111, -3], [34, 16, 34]),
    box("wrist_gem_l", config.accent, [-62, 111, -22], [16, 16, 6]),
    box("wrist_gem_r", config.accent, [62, 111, -22], [16, 16, 6]),
  ];
}

function createGuardianCharacter() {
  const teal = "#216966";
  const tealDark = "#0d5552";
  const tealDeep = "#1d335c";
  const tealLight = "#58b6a8";
  const gold = "#d6a84a";
  const goldLight = "#f2d36b";
  const brown = "#4d3424";
  const brownDark = "#2b2520";
  const skin = "#c99061";
  const skinLight = "#f0c28f";
  const cyan = "#2ba9d6";
  const cyanLight = "#8dd9ca";
  const black = "#151414";

  return {
    v: 1,
    unit: 100,
    boxes: [
      box("guardian_head", skin, [0, 236, -4], [84, 76, 76]),
      box("guardian_face_panel", skinLight, [0, 232, -48], [70, 54, 6]),
      box("guardian_eye_l", black, [-19, 238, -53], [12, 14, 5]),
      box("guardian_eye_r", black, [21, 238, -53], [12, 14, 5]),
      box("guardian_brow_l", brownDark, [-20, 252, -54], [24, 7, 5]),
      box("guardian_brow_r", brownDark, [22, 252, -54], [24, 7, 5]),
      box("guardian_nose", "#b2774f", [1, 222, -54], [13, 16, 5]),
      box("guardian_mouth", "#7c392f", [2, 206, -54], [30, 6, 5]),
      box("guardian_neck", skin, [0, 185, -8], [28, 28, 28]),

      box("hood_cap", tealDark, [0, 281, -4], [92, 28, 86]),
      box("hood_front", teal, [0, 257, -51], [86, 26, 12]),
      box("hood_left", tealDark, [-49, 230, -4], [16, 90, 78]),
      box("hood_right", tealDark, [50, 230, -4], [16, 90, 78]),
      box("hood_back", tealDark, [0, 228, 42], [92, 92, 16]),
      box("hood_low_back", teal, [0, 184, 42], [80, 28, 16]),
      box("hood_front_shadow_l", tealDeep, [-36, 230, -56], [10, 50, 7]),
      box("hood_front_shadow_r", tealDeep, [37, 230, -56], [10, 50, 7]),
      box("hood_cheek_trim_l", gold, [-47, 220, -54], [7, 58, 7]),
      box("hood_cheek_trim_r", gold, [48, 220, -54], [7, 58, 7]),
      box("headband_front", gold, [0, 260, -58], [90, 12, 8]),
      box("headband_left", gold, [-52, 258, -8], [8, 12, 72]),
      box("headband_right", gold, [53, 258, -8], [8, 12, 72]),
      box("headband_back", gold, [0, 258, 47], [82, 12, 8]),
      box("headband_top_glint", goldLight, [0, 268, -59], [74, 5, 5]),
      box("forehead_gem_frame", gold, [0, 250, -62], [28, 30, 8]),
      box("forehead_gem", cyan, [0, 250, -67], [18, 18, 5]),
      box("forehead_gem_core", cyanLight, [0, 250, -71], [10, 10, 3]),

      box("torso_core", teal, [0, 145, 0], [78, 100, 44]),
      box("torso_shadow_l", tealDark, [-31, 148, -26], [18, 86, 10]),
      box("torso_shadow_r", tealDark, [32, 148, -26], [18, 86, 10]),
      box("robe_front", tealLight, [0, 146, -31], [42, 88, 8]),
      box("robe_front_dark_l", tealDark, [-27, 136, -32], [16, 82, 7]),
      box("robe_front_dark_r", tealDark, [28, 136, -32], [16, 82, 7]),
      box("collar_l", brown, [-18, 192, -36], [22, 26, 10], [0, 0, -18]),
      box("collar_r", brown, [20, 192, -36], [22, 26, 10], [0, 0, 18]),
      box("collar_gold_l", gold, [-30, 185, -39], [8, 34, 7], [0, 0, -20]),
      box("collar_gold_r", gold, [32, 185, -39], [8, 34, 7], [0, 0, 20]),
      box("necklace_chain_l", brownDark, [-13, 178, -43], [8, 34, 6], [0, 0, -24]),
      box("necklace_chain_r", brownDark, [15, 178, -43], [8, 34, 6], [0, 0, 24]),
      box("gold_trim_chest_l", gold, [-25, 166, -38], [9, 86, 7], [0, 0, -10]),
      box("gold_trim_chest_r", gold, [26, 166, -38], [9, 86, 7], [0, 0, 10]),
      box("chest_gem_frame", gold, [0, 154, -43], [36, 42, 8]),
      box("chest_gem", cyan, [0, 154, -49], [26, 28, 6]),
      box("chest_gem_core", cyanLight, [0, 154, -54], [14, 16, 4]),
      box("chest_gem_glow_top", cyanLight, [0, 176, -48], [20, 5, 5]),
      box("chest_gem_glow_bottom", cyanLight, [0, 132, -48], [20, 5, 5]),
      box("chest_gem_glow_l", cyanLight, [-22, 154, -48], [5, 20, 5]),
      box("chest_gem_glow_r", cyanLight, [22, 154, -48], [5, 20, 5]),
      box("belt", brown, [0, 96, -27], [88, 16, 8]),
      box("belt_left_wrap", brownDark, [-48, 96, -3], [8, 16, 42]),
      box("belt_right_wrap", brownDark, [49, 96, -3], [8, 16, 42]),
      box("belt_buckle", gold, [0, 96, -34], [26, 24, 8]),
      box("belt_buckle_gem", tealLight, [0, 96, -40], [14, 12, 5]),

      box("shoulder_l_frame", gold, [-61, 181, -4], [42, 22, 52]),
      box("shoulder_l_plate", tealDark, [-61, 184, -8], [30, 18, 38]),
      box("shoulder_l_edge", goldLight, [-61, 169, -20], [46, 8, 14]),
      box("shoulder_l_side_gold", gold, [-82, 180, -4], [7, 28, 48]),
      box("shoulder_l_inner_shadow", tealDeep, [-56, 171, -25], [22, 10, 12]),
      box("shoulder_r_frame", gold, [62, 181, -4], [42, 22, 52]),
      box("shoulder_r_plate", tealDark, [62, 184, -8], [30, 18, 38]),
      box("shoulder_r_edge", goldLight, [62, 169, -20], [46, 8, 14]),
      box("shoulder_r_side_gold", gold, [83, 180, -4], [7, 28, 48]),
      box("shoulder_r_inner_shadow", tealDeep, [57, 171, -25], [22, 10, 12]),
      box("sleeve_l_upper", teal, [-66, 142, -4], [30, 56, 34]),
      box("sleeve_r_upper", tealDark, [66, 142, -4], [30, 56, 34]),
      box("sleeve_l_side_shadow", tealDeep, [-79, 139, -3], [7, 50, 30]),
      box("sleeve_r_side_shadow", tealDeep, [80, 139, -3], [7, 50, 30]),
      box("sleeve_l_trim", gold, [-66, 113, -16], [34, 9, 14]),
      box("sleeve_r_trim", gold, [66, 113, -16], [34, 9, 14]),
      box("bracer_l", brown, [-66, 93, -4], [34, 28, 34]),
      box("bracer_r", brown, [66, 93, -4], [34, 28, 34]),
      box("bracer_l_gold", gold, [-66, 105, -22], [28, 7, 6]),
      box("bracer_r_gold", gold, [66, 105, -22], [28, 7, 6]),
      box("bracer_l_teal_band", tealLight, [-66, 89, -22], [24, 6, 6]),
      box("bracer_r_teal_band", tealLight, [66, 89, -22], [24, 6, 6]),
      box("bracer_r_gem_frame", gold, [66, 95, -24], [20, 20, 6]),
      box("bracer_r_gem", cyan, [66, 95, -29], [12, 12, 4]),
      box("hand_l", skin, [-66, 69, -4], [26, 26, 26]),
      box("hand_r", skin, [66, 69, -4], [26, 26, 26]),

      box("robe_skirt_front", teal, [0, 70, -28], [80, 70, 8]),
      box("robe_skirt_back", tealDark, [0, 70, 28], [78, 70, 8]),
      box("robe_skirt_left", tealDark, [-43, 70, 0], [8, 70, 48]),
      box("robe_skirt_right", tealDark, [44, 70, 0], [8, 70, 48]),
      box("robe_center_panel", tealLight, [0, 55, -35], [38, 64, 8]),
      box("robe_center_gold_l", gold, [-23, 55, -39], [7, 68, 6]),
      box("robe_center_gold_r", gold, [24, 55, -39], [7, 68, 6]),
      box("robe_bottom_trim", gold, [0, 19, -39], [50, 8, 7]),
      box("robe_side_gold_l", gold, [-39, 52, -33], [7, 56, 6]),
      box("robe_side_gold_r", gold, [40, 52, -33], [7, 56, 6]),
      box("robe_left_low_panel", tealDark, [-47, 42, -8], [10, 58, 36], [0, 0, -8]),
      box("robe_right_low_panel", tealDark, [48, 42, -8], [10, 58, 36], [0, 0, 8]),
      box("robe_symbol_top", cyan, [0, 57, -45], [18, 11, 5], [0, 0, 45]),
      box("robe_symbol_mid", tealLight, [0, 43, -45], [22, 18, 5]),
      box("robe_symbol_low", cyan, [0, 30, -45], [16, 10, 5]),
      box("leg_l", brownDark, [-22, 35, -2], [30, 72, 30]),
      box("leg_r", brown, [23, 35, -2], [30, 72, 30]),
      box("boot_l", brownDark, [-22, 11, -5], [38, 30, 44]),
      box("boot_r", brownDark, [23, 11, -5], [38, 30, 44]),
      box("boot_l_gem", tealLight, [-22, 28, -30], [24, 8, 6]),
      box("boot_r_gem", tealLight, [23, 28, -30], [24, 8, 6]),

      box("side_pouch_l", brown, [-44, 62, -31], [22, 36, 12]),
      box("side_pouch_l_flap", gold, [-44, 79, -38], [12, 10, 6]),
      box("side_pouch_r", brownDark, [45, 64, 31], [18, 34, 12]),
      box("back_cape_top", tealDark, [0, 158, 53], [86, 40, 10]),
      box("back_cape_mid", tealDark, [0, 101, 56], [94, 96, 12]),
      box("back_cape_low", teal, [0, 34, 54], [74, 58, 10]),
      box("back_cape_gold_l", gold, [-39, 86, 64], [8, 124, 7]),
      box("back_cape_gold_r", gold, [40, 86, 64], [8, 124, 7]),

      box("staff_grip_top_hand", brown, [-93, 88, -12], [24, 32, 24]),
      box("staff_shaft_low", brownDark, [-112, 52, -14], [12, 106, 12]),
      box("staff_shaft_high", brownDark, [-112, 150, -14], [12, 108, 12]),
      box("staff_base", gold, [-112, -4, -14], [26, 14, 26]),
      box("staff_base_cap", gold, [-112, 8, -14], [18, 10, 18]),
      box("staff_ring_low", gold, [-112, 103, -14], [24, 9, 24]),
      box("staff_ring_mid", gold, [-112, 124, -14], [22, 9, 22]),
      box("staff_ring_mid_glint", goldLight, [-112, 128, -27], [18, 5, 5]),
      box("staff_ring_high", gold, [-112, 198, -14], [30, 12, 30]),
      box("staff_neck", tealLight, [-112, 214, -14], [14, 24, 14]),
      box("staff_head_left", tealDark, [-127, 228, -14], [16, 50, 14], [0, 0, -28]),
      box("staff_head_right", teal, [-97, 228, -14], [16, 50, 14], [0, 0, 28]),
      box("staff_head_left_tip", tealLight, [-134, 247, -24], [9, 18, 8], [0, 0, -28]),
      box("staff_head_right_tip", tealLight, [-90, 247, -24], [9, 18, 8], [0, 0, 28]),
      box("staff_head_frame", gold, [-112, 260, -14], [46, 48, 18]),
      box("staff_head_side_l", gold, [-139, 260, -14], [12, 36, 16]),
      box("staff_head_side_r", gold, [-85, 260, -14], [12, 36, 16]),
      box("staff_head_top_cap", goldLight, [-112, 286, -14], [32, 10, 16]),
      box("staff_head_bottom_cap", gold, [-112, 234, -14], [30, 10, 16]),
      box("staff_crystal_outer", cyan, [-112, 260, -25], [28, 28, 8]),
      box("staff_crystal_inner", cyanLight, [-112, 260, -32], [16, 16, 5]),
      box("staff_crystal_top", cyanLight, [-112, 276, -25], [18, 8, 8]),
      box("staff_crystal_bottom", cyanLight, [-112, 244, -25], [18, 8, 8]),
      box("staff_crystal_left", cyanLight, [-128, 260, -25], [8, 18, 8]),
      box("staff_crystal_right", cyanLight, [-96, 260, -25], [8, 18, 8]),
    ],
  };
}

function updatePart(source, name, changes) {
  const part = source.boxes.find((item) => item.n === name);
  if (!part) return;
  if (changes.c) part.c = changes.c;
  if (changes.p) part.p = [...changes.p];
  if (changes.s) part.s = [...changes.s];
  if (changes.r) part.r = [...changes.r];
}

function currentBox() {
  return character.boxes[selected];
}

function createVectorControls(hostId, key, labels, min, max, step) {
  const host = document.querySelector(`#${hostId}`);
  labels.forEach((label, index) => {
    const row = document.createElement("label");
    row.className = "param";
    row.innerHTML = `<span data-i18n="player.axis.${label}">${t(`player.axis.${label}`)}</span><input type="range" min="${min}" max="${max}" step="${step}" /><input type="number" min="${min}" max="${max}" step="${step}" />`;
    const range = row.querySelector('input[type="range"]');
    const number = row.querySelector('input[type="number"]');
    const update = (value) => {
      currentBox()[key][index] = Number(value);
      range.value = value;
      number.value = value;
      renderCharacter();
      writeCode();
    };
    range.addEventListener("input", () => update(range.value));
    number.addEventListener("input", () => update(number.value));
    row.dataset.key = key;
    row.dataset.index = String(index);
    host.appendChild(row);
  });
}

function syncAll() {
  syncSelect();
  syncPanel();
  renderCharacter();
  writeCode();
}

function toggleCodeDrawer(forceOpen = null) {
  const open = forceOpen ?? chainOutput.classList.contains("collapsed");
  chainOutput.classList.toggle("collapsed", !open);
  updateCodeButtons(open);
  toggleCode.setAttribute("aria-expanded", String(open));
}

function updateCodeButtons(open = !chainOutput.classList.contains("collapsed")) {
  toggleCode.textContent = open ? t("player.collapseCode") : t("player.characterCode");
  toggleDataMode.textContent = dataMode === "json" ? t("player.viewChainData") : t("player.viewJson");
}

function syncSelect() {
  boxSelect.innerHTML = "";
  character.boxes.forEach((part, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index} ${part.n}`;
    boxSelect.appendChild(option);
  });
  boxSelect.value = String(selected);
}

function syncPanel() {
  const part = currentBox();
  boxName.value = part.n;
  boxColor.value = part.c;
  textureMode.value = part.t?.[faceSelect.value] ? "paint" : "solid";
  document.querySelectorAll(".param").forEach((row) => {
    const value = part[row.dataset.key][Number(row.dataset.index)];
    row.querySelector('input[type="range"]').value = value;
    row.querySelector('input[type="number"]').value = value;
  });
  drawPaintBoard();
}

function renderCharacter() {
  for (const mesh of meshes.values()) root.remove(mesh);
  meshes.clear();

  for (const part of character.boxes) {
    const material = createMaterials(part);
    const mesh = new THREE.Mesh(cube, material);
    mesh.name = part.n;
    mesh.position.set(part.p[0] / 100, part.p[1] / 100, part.p[2] / 100);
    mesh.scale.set(part.s[0] / 100, part.s[1] / 100, part.s[2] / 100);
    mesh.rotation.set(deg(part.r[0]), deg(part.r[1]), deg(part.r[2]));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    meshes.set(part.n, mesh);
  }
}

function writeCode() {
  const packed = encodeCharacter(character);
  const json = JSON.stringify(toCompactJson(character), null, 2);
  if (dataMode === "json") {
    chainCode.value = json;
    byteSize.textContent = `${new TextEncoder().encode(JSON.stringify(toCompactJson(character))).length} bytes`;
    updateCodeButtons();
    return;
  }
  chainCode.value = packed.code;
  byteSize.textContent = `${packed.bytes} bytes`;
  updateCodeButtons();
}

function toCompactJson(source) {
  return {
    v: source.v,
    u: source.unit,
    b: source.boxes.map((part) => [part.n, part.c, part.p, part.s, part.r, compactTextures(part.t)]),
  };
}

function createMaterials(part) {
  return threeMaterialFaces().map((face) => {
    const tex = part.t?.[face];
    if (!tex) return createPreviewMaterial(part.c);
    return new THREE.MeshLambertMaterial({ map: createCanvasTexture(tex), color: 0xffffff });
  });
}

function createPreviewMaterial(color) {
  const material = new THREE.MeshLambertMaterial({ color });
  if (isGlowColor(color)) {
    material.emissive = new THREE.Color(color);
    material.emissiveIntensity = normalizeColor(color) === "#8dd9ca" ? 0.72 : 0.38;
  }
  return material;
}

function isGlowColor(color) {
  const value = normalizeColor(color);
  return value === "#2ba9d6" || value === "#8dd9ca";
}

function threeMaterialFaces() {
  return ["right", "left", "top", "bottom", "back", "front"];
}

function createCanvasTexture(tex) {
  const source = document.createElement("canvas");
  source.width = tex.w;
  source.height = tex.h;
  const ctx = source.getContext("2d");
  tex.p.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index % tex.w, Math.floor(index / tex.w), 1, 1);
  });
  const texture = new THREE.CanvasTexture(source);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function compactTextures(textures) {
  if (!textures) return null;
  const output = {};
  for (const [face, tex] of Object.entries(textures)) {
    output[face] = [tex.w, tex.h, tex.p];
  }
  return Object.keys(output).length ? output : null;
}

function encodeCharacter(source) {
  if (source.boxes.length > 63) return encodeLosslessCharacter(source);

  const writer = createBitWriter();
  writer.write(clampInt(source.boxes.length, 0, 63), 6);
  let previousColor = null;

  source.boxes.forEach((part) => {
    const exactPreset = findPresetIndex(part, true);
    if (exactPreset !== -1) {
      writer.write(1, 1);
      writer.write(exactPreset, sgp3PresetBits);
      previousColor = nearestPaletteIndex(sgp3BoxPresets[exactPreset].c);
      return;
    }

    writer.write(0, 1);
    const geometryPreset = findPresetIndex(part, false);
    writer.write(geometryPreset === -1 ? 0 : 1, 1);
    if (geometryPreset !== -1) {
      writer.write(geometryPreset, sgp3PresetBits);
      const color = writeColorRef(writer, part.c, previousColor);
      previousColor = color;
      writeTexturePayload(writer, part);
      return;
    }

    const color = nearestPaletteIndex(part.c);
    writeColorRef(writer, part.c, previousColor);
    previousColor = color;
    writeDictionaryVector(writer, part.p, sgp3PositionDictionary, writeRawPosition);
    writeDictionaryVector(writer, part.s, sgp3SizeDictionary, writeRawSize);
    writeOptionalRotation(writer, part.r);
    writeTexturePayload(writer, part);
  });

  const raw = writer.finish();
  return { code: `SGP3:${base64UrlEncode(raw)}`, bytes: raw.byteLength };
}

function decodeCharacter(code) {
  if (/^NCP1:/i.test(code)) return decodeLosslessCharacter(code);

  const reader = createBitReader(base64UrlDecode(code.replace(/^SGP3:/i, "")));
  let previousColor = 0;
  const boxes = Array.from({ length: reader.read(6) }, (_, boxIndex) => {
    if (reader.read(1) === 1) {
      const part = clonePreset(reader.read(sgp3PresetBits));
      previousColor = nearestPaletteIndex(part.c);
      return part;
    }

    const hasGeometryPreset = reader.read(1) === 1;
    const part = hasGeometryPreset ? clonePreset(reader.read(sgp3PresetBits)) : { n: `part_${boxIndex}` };
    const colorIndex = readColorRef(reader, previousColor);
    previousColor = colorIndex;
    part.c = chainPalette[colorIndex] ?? "#ffffff";
    if (!hasGeometryPreset) {
      part.p = readDictionaryVector(reader, sgp3PositionDictionary, readRawPosition);
      part.s = readDictionaryVector(reader, sgp3SizeDictionary, readRawSize);
      part.r = readOptionalRotation(reader);
    }
    readTexturePayload(reader, part);
    return part;
  });

  return { v: 1, unit: 100, boxes };
}

function encodeLosslessCharacter(source) {
  const raw = new TextEncoder().encode(JSON.stringify(toCompactJson(source)));
  return { code: `NCP1:${base64UrlEncode(raw)}`, bytes: raw.byteLength };
}

function decodeLosslessCharacter(code) {
  const compact = JSON.parse(new TextDecoder().decode(base64UrlDecode(code.replace(/^NCP1:/i, ""))));
  return {
    v: compact.v ?? 1,
    unit: compact.u ?? 100,
    boxes: (compact.b ?? []).map(([n, c, p, s, r, t]) => ({
      n,
      c,
      p,
      s,
      r,
      ...(t ? { t: expandCompactTextures(t) } : {}),
    })),
  };
}

function expandCompactTextures(textures) {
  return Object.fromEntries(Object.entries(textures).map(([face, tex]) => [face, { w: tex[0], h: tex[1], p: tex[2] }]));
}

function writeColorRef(writer, color, previousColor) {
  const colorIndex = nearestPaletteIndex(color);
  const sameColor = previousColor === colorIndex;
  writer.write(sameColor ? 1 : 0, 1);
  if (!sameColor) writer.write(colorIndex, 5);
  return colorIndex;
}

function readColorRef(reader, previousColor) {
  return reader.read(1) === 1 ? previousColor : reader.read(5);
}

function writeTexturePayload(writer, part) {
  const textureFaces = compactTextures(part.t) ?? {};
  const mask = threeMaterialFaces().reduce((value, face, index) => value | (textureFaces[face] ? 1 << index : 0), 0);
  writer.write(mask ? 1 : 0, 1);
  if (!mask) return;
  writer.write(mask, 6);
  threeMaterialFaces().forEach((face, index) => {
    const tex = textureFaces[face];
    if (!tex || (mask & (1 << index)) === 0) return;
    writePackedRuns(writer, tex[2].map(nearestPaletteIndex));
  });
}

function readTexturePayload(reader, part) {
  const hasTextures = reader.read(1) === 1;
  const mask = hasTextures ? reader.read(6) : 0;
  threeMaterialFaces().forEach((face, index) => {
    if ((mask & (1 << index)) === 0) return;
    part.t ??= {};
    const [w, h] = faceGridSize(part, face);
    part.t[face] = { w, h, p: readPackedRuns(reader, w * h).map((value) => chainPalette[value] ?? part.c) };
  });
}

function findPresetIndex(part, includeColor) {
  if (includeColor && part.t) return -1;
  return sgp3BoxPresets.findIndex(
    (preset) =>
      (!includeColor || nearestPaletteIndex(preset.c) === nearestPaletteIndex(part.c)) &&
      sameVector(preset.p, part.p) &&
      sameVector(preset.s, part.s) &&
      sameVector(preset.r, part.r),
  );
}

function clonePreset(index) {
  const preset = sgp3BoxPresets[index] ?? sgp3BoxPresets[0];
  return {
    n: preset.n,
    c: preset.c,
    p: [...preset.p],
    s: [...preset.s],
    r: [...preset.r],
  };
}

function sameVector(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function writeDictionaryVector(writer, vector, dictionary, writeRaw) {
  const index = findVectorIndex(dictionary, vector);
  writer.write(index === -1 ? 0 : 1, 1);
  if (index !== -1) {
    writer.write(index, vectorDictionaryBits);
    return;
  }
  writeRaw(writer, vector);
}

function readDictionaryVector(reader, dictionary, readRaw) {
  if (reader.read(1) === 1) {
    return [...(dictionary[reader.read(vectorDictionaryBits)] ?? dictionary[0])];
  }
  return readRaw(reader);
}

function writeRawPosition(writer, vector) {
  vector.forEach((value) => writer.write(clampInt(value + 256, 0, 1023), 10));
}

function readRawPosition(reader) {
  return [reader.read(10) - 256, reader.read(10) - 256, reader.read(10) - 256];
}

function writeRawSize(writer, vector) {
  vector.forEach((value) => writer.write(clampInt(value, 1, 255), 8));
}

function readRawSize(reader) {
  return [reader.read(8), reader.read(8), reader.read(8)];
}

function writeOptionalRotation(writer, rotation) {
  const hasRotation = rotation.some((value) => value !== 0);
  writer.write(hasRotation ? 1 : 0, 1);
  if (!hasRotation) return;
  rotation.forEach((value) => writer.write(clampInt(value + 180, 0, 511), 9));
}

function readOptionalRotation(reader) {
  if (reader.read(1) === 0) return [0, 0, 0];
  return [reader.read(9) - 180, reader.read(9) - 180, reader.read(9) - 180];
}

function findVectorIndex(dictionary, vector) {
  return dictionary.findIndex((entry) => entry.length === vector.length && entry.every((value, index) => value === vector[index]));
}

function nearestPaletteIndex(color) {
  const target = parseColor(color);
  let best = 0;
  let bestDistance = Infinity;
  chainPalette.forEach((entry, index) => {
    const candidate = parseColor(entry);
    const distance =
      (target[0] - candidate[0]) ** 2 + (target[1] - candidate[1]) ** 2 + (target[2] - candidate[2]) ** 2;
    if (distance >= bestDistance) return;
    best = index;
    bestDistance = distance;
  });
  return best;
}

function parseColor(color) {
  const value = normalizeColor(color);
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

function createBitWriter() {
  const bytes = [];
  let current = 0;
  let used = 0;
  return {
    write(value, bits) {
      const safeValue = Math.max(0, Math.round(value));
      for (let i = 0; i < bits; i++) {
        current |= ((safeValue >> i) & 1) << used;
        used++;
        if (used !== 8) continue;
        bytes.push(current);
        current = 0;
        used = 0;
      }
    },
    finish() {
      if (used) bytes.push(current);
      return Uint8Array.from(bytes);
    },
  };
}

function createBitReader(raw) {
  let byteIndex = 0;
  let used = 0;
  return {
    read(bits) {
      let value = 0;
      for (let i = 0; i < bits; i++) {
        value |= (((raw[byteIndex] ?? 0) >> used) & 1) << i;
        used++;
        if (used !== 8) continue;
        byteIndex++;
        used = 0;
      }
      return value;
    },
  };
}

function writePackedRuns(writer, values) {
  const runs = [];
  let index = 0;
  while (index < values.length) {
    const color = values[index];
    let length = 1;
    while (index + length < values.length && values[index + length] === color && length < 16) length++;
    runs.push([length, color]);
    index += length;
  }
  writer.write(clampInt(runs.length - 1, 0, 255), 8);
  runs.forEach(([length, color]) => {
    writer.write(length - 1, 4);
    writer.write(color, 5);
  });
}

function readPackedRuns(reader, size) {
  const runCount = reader.read(8) + 1;
  const values = [];
  for (let i = 0; i < runCount; i++) {
    const length = reader.read(4) + 1;
    const color = reader.read(5);
    for (let j = 0; j < length && values.length < size; j++) values.push(color);
  }
  while (values.length < size) values.push(0);
  return values;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeColor(color) {
  const value = String(color || "#ffffff").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  return "#ffffff";
}

function writeColor(bytes, color) {
  bytes.push(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
}

function readColor(raw, nextOffset) {
  const r = raw[nextOffset()];
  const g = raw[nextOffset()];
  const b = raw[nextOffset()];
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hex(value) {
  return value.toString(16).padStart(2, "0");
}

function writeU16(bytes, value) {
  const next = Math.max(0, Math.min(65535, Math.round(value)));
  bytes.push(next & 255, next >> 8);
}

function readU16(raw, nextOffset) {
  const a = raw[nextOffset()];
  const b = raw[nextOffset()];
  return a | (b << 8);
}

function writeI16(bytes, value) {
  const next = Math.max(-32768, Math.min(32767, Math.round(value)));
  writeU16(bytes, next < 0 ? next + 65536 : next);
}

function readI16(raw, nextOffset) {
  const value = readU16(raw, nextOffset);
  return value > 32767 ? value - 65536 : value;
}

function writeVar(bytes, value) {
  let next = Math.max(0, Math.round(value));
  while (next > 127) {
    bytes.push((next & 127) | 128);
    next >>= 7;
  }
  bytes.push(next);
}

function readVar(raw, nextOffset) {
  let value = 0;
  let shift = 0;
  while (true) {
    const byte = raw[nextOffset()];
    value |= (byte & 127) << shift;
    if ((byte & 128) === 0) return value;
    shift += 7;
  }
}

function writeRuns(bytes, values) {
  if (!values.length) {
    writeVar(bytes, 0);
    return;
  }
  const runs = [];
  let color = values[0];
  let length = 1;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === color) {
      length++;
      continue;
    }
    runs.push([length, color]);
    color = values[i];
    length = 1;
  }
  runs.push([length, color]);
  writeVar(bytes, runs.length);
  runs.forEach(([runLength, colorIndex]) => {
    writeVar(bytes, runLength);
    writeVar(bytes, colorIndex);
  });
}

function readRuns(raw, nextOffset, size) {
  const runs = readVar(raw, nextOffset);
  const values = [];
  for (let i = 0; i < runs; i++) {
    const length = readVar(raw, nextOffset);
    const color = readVar(raw, nextOffset);
    for (let j = 0; j < length && values.length < size; j++) values.push(color);
  }
  while (values.length < size) values.push(0);
  return values;
}

function base64UrlEncode(raw) {
  let binary = "";
  raw.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function faceGridSize(part, face) {
  const [w, h, d] = part.s;
  const cell = 10;
  const dimensions = {
    front: [w, h],
    back: [w, h],
    left: [d, h],
    right: [d, h],
    top: [w, d],
    bottom: [w, d],
  }[face];
  return dimensions.map((value) => THREE.MathUtils.clamp(Math.ceil(value / cell), 1, 16));
}

function ensureFaceTexture(part, face) {
  part.t ??= {};
  const [w, h] = faceGridSize(part, face);
  const current = part.t[face];
  if (current && current.w === w && current.h === h) return current;

  const next = { w, h, p: Array(w * h).fill(part.c) };
  if (current) {
    const copyW = Math.min(w, current.w);
    const copyH = Math.min(h, current.h);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        next.p[y * w + x] = current.p[y * current.w + x];
      }
    }
  }
  part.t[face] = next;
  return next;
}

function cleanupEmptyTextures(part) {
  if (part.t && Object.keys(part.t).length === 0) delete part.t;
}

function drawPaintBoard() {
  const part = currentBox();
  const face = faceSelect.value;
  const [w, h] = faceGridSize(part, face);
  const tex = part.t?.[face];
  const boardSize = 320;
  const cell = boardSize / Math.max(w, h);
  paintBoard.width = boardSize;
  paintBoard.height = boardSize;
  paintCtx.clearRect(0, 0, boardSize, boardSize);
  paintCtx.fillStyle = "#0e120d";
  paintCtx.fillRect(0, 0, boardSize, boardSize);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      paintCtx.fillStyle = tex ? tex.p[y * w + x] : part.c;
      paintCtx.fillRect(x * cell, y * cell, cell, cell);
      paintCtx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      paintCtx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }

  gridSize.textContent = `${t(faceLabels[face])} ${w} x ${h}`;
}

function paintCell(event) {
  const part = currentBox();
  const face = faceSelect.value;
  const tex = ensureFaceTexture(part, face);
  const rect = paintBoard.getBoundingClientRect();
  const cell = paintBoard.width / Math.max(tex.w, tex.h);
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * paintBoard.width / cell);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * paintBoard.height / cell);
  if (x < 0 || y < 0 || x >= tex.w || y >= tex.h) return;
  tex.p[y * tex.w + x] = paintColor.value;
  textureMode.value = "paint";
  renderCharacter();
  drawPaintBoard();
  writeCode();
}

function animate() {
  requestAnimationFrame(animate);
  const radius = 6.3;
  camera.position.set(Math.sin(yaw) * radius, 2.2 + Math.sin(pitch) * 3.2, Math.cos(yaw) * radius);
  camera.lookAt(0, 1.45, 0);
  renderer.render(scene, camera);
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}

function deg(value) {
  return (value * Math.PI) / 180;
}
