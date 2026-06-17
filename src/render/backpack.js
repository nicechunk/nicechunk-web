import * as THREE from "three";

export const backpackMaterialSpecs = {
  backpack: [0x6c5842, 0.08],
  backpackDark: [0x3f352b, 0.06],
  backpackLight: [0x8a7355, 0.07],
  backpackStrap: [0x2b2520, 0.05],
};

export const backpackPartSpecs = [
  { name: "backpackBody", material: "backpack", position: [0, 1.46, 0.42], scale: [0.78, 0.84, 0.34] },
  { name: "backpackTopRoll", material: "backpackLight", position: [0, 1.91, 0.4], scale: [0.72, 0.14, 0.3] },
  { name: "backpackFlap", material: "backpackDark", position: [0, 1.64, 0.615], scale: [0.64, 0.26, 0.055] },
  { name: "backpackPocket", material: "backpackLight", position: [0, 1.22, 0.63], scale: [0.46, 0.28, 0.06] },
  { name: "leftBackpackSidePocket", material: "backpackDark", position: [-0.45, 1.28, 0.43], scale: [0.12, 0.3, 0.26] },
  { name: "rightBackpackSidePocket", material: "backpackDark", position: [0.45, 1.28, 0.43], scale: [0.12, 0.3, 0.26] },
  { name: "leftBackpackStrap", material: "backpackStrap", position: [-0.27, 1.62, -0.31], scale: [0.12, 0.9, 0.05] },
  { name: "rightBackpackStrap", material: "backpackStrap", position: [0.27, 1.62, -0.31], scale: [0.12, 0.9, 0.05] },
  { name: "leftBackpackShoulder", material: "backpackStrap", position: [-0.28, 1.98, 0.16], scale: [0.12, 0.14, 0.3] },
  { name: "rightBackpackShoulder", material: "backpackStrap", position: [0.28, 1.98, 0.16], scale: [0.12, 0.14, 0.3] },
];

const backpackCenter = new THREE.Vector3(0, 1.55, 0.3);
let backpackPreviewState = null;

export function createBackpackMaterials(materialFactory = (color) => new THREE.MeshLambertMaterial({ color })) {
  return Object.fromEntries(
    Object.entries(backpackMaterialSpecs).map(([key, [color, roughness]]) => [
      key,
      materialFactory(color, roughness, key),
    ]),
  );
}

export function addBackpackParts({ THREE: Three = THREE, cubeGeometry, materials, parent, centered = false }) {
  const group = centered ? new Three.Group() : parent;
  const offset = centered ? backpackCenter : null;
  if (centered) {
    group.name = "backpackModel";
    parent.add(group);
  }

  for (const part of backpackPartSpecs) {
    const mesh = new Three.Mesh(cubeGeometry, materials[part.material]);
    mesh.name = part.name;
    const position = new Three.Vector3(...part.position);
    if (offset) position.sub(offset);
    mesh.position.copy(position);
    mesh.scale.set(...part.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function createBackpackModel({ THREE: Three = THREE, cubeGeometry, materials, centered = true }) {
  const group = new Three.Group();
  addBackpackParts({ THREE: Three, cubeGeometry, materials, parent: group, centered });
  return group;
}

export function createBackpackPreviewCanvas({ className = "item-backpack-render", size = 88 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.width = size;
  canvas.height = size;
  canvas.setAttribute("aria-hidden", "true");
  renderBackpackPreviewToCanvas(canvas, { size });
  return canvas;
}

export function renderBackpackPreviewToCanvas(canvas, { size = 88, pixelRatio = 2 } = {}) {
  const state = getBackpackPreviewState();
  const targetSize = Math.max(48, Math.round(size * pixelRatio));
  const outputContext = canvas.getContext("2d");
  if (!outputContext) return false;

  canvas.width = targetSize;
  canvas.height = targetSize;
  state.renderer.setSize(targetSize, targetSize, false);
  state.backpack.rotation.set(0, 0, 0);
  state.renderer.render(state.scene, state.camera);
  outputContext.clearRect(0, 0, targetSize, targetSize);
  outputContext.drawImage(state.renderer.domElement, 0, 0, targetSize, targetSize);
  if (!canvasHasVisiblePixels(outputContext, targetSize)) {
    renderBackpackFallbackToCanvas(outputContext, targetSize);
  }
  return true;
}

function renderBackpackFallbackToCanvas(context, size) {
  context.clearRect(0, 0, size, size);
  const unit = size * 0.58;
  const centerX = size * 0.5;
  const centerY = size * 0.58;
  const depthOffset = size * 0.08;
  const orderedParts = [...backpackPartSpecs].sort((a, b) => a.position[2] - b.position[2]);

  for (const part of orderedParts) {
    const color = backpackMaterialSpecs[part.material]?.[0] ?? backpackMaterialSpecs.backpack[0];
    const x = centerX + (part.position[0] - backpackCenter.x) * unit - part.scale[0] * unit * 0.5;
    const y = centerY - (part.position[1] - backpackCenter.y) * unit - part.scale[1] * unit * 0.5 - (part.position[2] - backpackCenter.z) * depthOffset;
    const width = Math.max(2, part.scale[0] * unit);
    const height = Math.max(2, part.scale[1] * unit);
    const shade = part.position[2] >= backpackCenter.z ? 1.08 : 0.72;
    drawFallbackBox(context, x, y, width, height, color, shade);
  }
}

function drawFallbackBox(context, x, y, width, height, color, shade = 1) {
  const radius = Math.max(1, Math.min(width, height) * 0.08);
  context.fillStyle = colorToCss(scaleColor(color, shade));
  context.strokeStyle = "rgba(0, 0, 0, 0.36)";
  context.lineWidth = Math.max(1, width * 0.035);
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(255, 255, 255, 0.12)";
  context.fillRect(x + width * 0.08, y + height * 0.08, width * 0.22, Math.max(1, height * 0.08));
  context.fillStyle = "rgba(0, 0, 0, 0.16)";
  context.fillRect(x + width * 0.72, y + height * 0.18, Math.max(1, width * 0.12), height * 0.68);
}

function canvasHasVisiblePixels(context, size) {
  const data = context.getImageData(0, 0, size, size).data;
  for (let index = 3; index < data.length; index += 16) {
    if (data[index] > 0) return true;
  }
  return false;
}

function colorToCss(color) {
  return `#${Math.max(0, Math.min(0xffffff, color | 0)).toString(16).padStart(6, "0")}`;
}

function scaleColor(color, amount) {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 255) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 255) * amount)));
  const b = Math.max(0, Math.min(255, Math.round((color & 255) * amount)));
  return (r << 16) | (g << 8) | b;
}

function getBackpackPreviewState() {
  if (backpackPreviewState) return backpackPreviewState;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.1, 3.35);
  camera.lookAt(0, 0.02, 0);
  scene.add(new THREE.HemisphereLight(0xf4fbff, 0x5f4c3a, 2.7));
  const keyLight = new THREE.DirectionalLight(0xfff2bf, 2.4);
  keyLight.position.set(-2.8, 3.2, 3.4);
  scene.add(keyLight);

  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = createBackpackMaterials((color, _roughness, name) => {
    const material = new THREE.MeshLambertMaterial({ color });
    material.name = `backpack-preview:${name}`;
    return material;
  });
  const backpack = createBackpackModel({ THREE, cubeGeometry, materials, centered: true });
  backpack.scale.setScalar(1.25);
  scene.add(backpack);

  backpackPreviewState = { renderer, scene, camera, backpack };
  return backpackPreviewState;
}
