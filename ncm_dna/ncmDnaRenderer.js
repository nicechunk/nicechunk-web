import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cuboidsToVoxelSet, getBoundingBox, materialColor } from "./ncmDnaEngine.js";

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

export function createNcmDnaRenderer(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d14);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
  camera.position.set(30, 24, 42);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 13, 0);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);
  const searchLogPanel = createSearchLogPanel();
  scene.add(searchLogPanel.mesh);

  const grid = new THREE.GridHelper(44, 22, 0x31465f, 0x172231);
  grid.position.y = -0.02;
  scene.add(grid);
  const axes = new THREE.AxesHelper(9);
  axes.position.set(-18, 0.04, -18);
  scene.add(axes);

  scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x14200f, 2.3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(22, 34, 18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x8cff00, 0.85);
  rimLight.position.set(-18, 22, -24);
  scene.add(rimLight);

  let targetModel = [];
  let bestModel = [];
  let view = "target";
  let mode = "cuboid";
  let wireframe = false;
  let animationFrame = 0;

  function setModels(nextTarget, nextBest = bestModel) {
    targetModel = nextTarget ?? [];
    bestModel = nextBest ?? [];
    redraw();
  }

  function setView(nextView) {
    view = nextView;
    redraw();
  }

  function setMode(nextMode) {
    mode = nextMode;
    redraw();
  }

  function setWireframe(enabled) {
    wireframe = Boolean(enabled);
    redraw();
  }

  function setSearchLog(lines) {
    searchLogPanel.update(lines);
  }

  function clearScene() {
    disposeGroup(modelRoot);
    modelRoot.clear();
  }

  function redraw() {
    clearScene();
    if (view === "best") {
      renderModel(bestModel.length ? bestModel : targetModel, 0);
    } else if (view === "compare") {
      renderModel(targetModel, -13);
      renderModel(bestModel, 13);
    } else if (view === "diff") {
      renderDifference(targetModel, bestModel);
    } else {
      renderModel(targetModel, 0);
    }
  }

  function renderModel(cuboids, offsetX) {
    if (mode === "voxel") {
      renderVoxelized(cuboids, offsetX);
    } else {
      renderCuboids(cuboids, offsetX);
    }
  }

  function renderCuboids(cuboids, offsetX = 0) {
    const box = getBoundingBox(cuboids);
    const originX = (box.minX + box.maxX) / 2;
    const originZ = (box.minZ + box.maxZ) / 2;
    for (const part of cuboids) {
      const material = createMaterial(part.material);
      const mesh = new THREE.Mesh(cubeGeometry, material);
      mesh.position.set(part.x + part.w / 2 - originX + offsetX, part.y + part.h / 2, part.z + part.d / 2 - originZ);
      mesh.scale.set(part.w, part.h, part.d);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      modelRoot.add(mesh);
    }
  }

  function renderVoxelized(cuboids, offsetX = 0) {
    const box = getBoundingBox(cuboids);
    const originX = (box.minX + box.maxX) / 2;
    const originZ = (box.minZ + box.maxZ) / 2;
    for (const part of cuboids) {
      const material = createMaterial(part.material);
      for (let x = part.x; x < part.x + part.w; x += 1) {
        for (let y = part.y; y < part.y + part.h; y += 1) {
          for (let z = part.z; z < part.z + part.d; z += 1) {
            const mesh = new THREE.Mesh(cubeGeometry, material);
            mesh.position.set(x + 0.5 - originX + offsetX, y + 0.5, z + 0.5 - originZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            modelRoot.add(mesh);
          }
        }
      }
    }
  }

  function renderDifference(target, best) {
    const targetSet = cuboidsToVoxelSet(target, false);
    const bestSet = cuboidsToVoxelSet(best, false);
    const sameMaterial = new THREE.MeshLambertMaterial({ color: 0x98cbff, transparent: true, opacity: 0.34, wireframe });
    const missingMaterial = new THREE.MeshLambertMaterial({ color: 0xff5f6e, transparent: true, opacity: 0.72, wireframe });
    const extraMaterial = new THREE.MeshLambertMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.64, wireframe });
    const allKeys = new Set([...targetSet, ...bestSet]);
    const box = getBoundingBox([...target, ...best]);
    const originX = (box.minX + box.maxX) / 2;
    const originZ = (box.minZ + box.maxZ) / 2;
    for (const key of allKeys) {
      const [x, y, z] = key.split(",").map(Number);
      const inTarget = targetSet.has(key);
      const inBest = bestSet.has(key);
      const material = inTarget && inBest ? sameMaterial : inTarget ? missingMaterial : extraMaterial;
      const mesh = new THREE.Mesh(cubeGeometry, material);
      mesh.position.set(x + 0.5 - originX, y + 0.5, z + 0.5 - originZ);
      modelRoot.add(mesh);
    }
  }

  function createMaterial(materialId) {
    return new THREE.MeshLambertMaterial({
      color: materialColor(materialId),
      wireframe,
    });
  }

  function resetCamera() {
    camera.position.set(30, 24, 42);
    controls.target.set(0, 13, 0);
    controls.update();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function animate() {
    animationFrame = requestAnimationFrame(animate);
    resize();
    controls.update();
    renderer.render(scene, camera);
  }

  function destroy() {
    cancelAnimationFrame(animationFrame);
    clearScene();
    searchLogPanel.dispose();
    renderer.dispose();
  }

  redraw();
  animate();

  return {
    setModels,
    setView,
    setMode,
    setWireframe,
    setSearchLog,
    renderCuboids,
    renderVoxelized,
    clearScene,
    resetCamera,
    destroy,
  };
}

function createSearchLogPanel() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(78, 34), material);
  mesh.name = "search-seed-log-panel";
  mesh.position.set(0, 17, -28);

  function update(lines = []) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const recent = lines.slice(-20);
    if (!recent.length) {
      texture.needsUpdate = true;
      return;
    }

    context.save();
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.font = "42px SFMono-Regular, Consolas, monospace";
    context.textBaseline = "top";
    context.shadowColor = "rgba(0, 0, 0, 0.74)";
    context.shadowBlur = 10;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 2;
    const lineHeight = 47;
    const startY = Math.max(22, canvas.height - 36 - recent.length * lineHeight);
    recent.forEach((line, index) => {
      context.fillText(String(line), 42, startY + index * lineHeight, canvas.width - 84);
    });
    context.restore();
    texture.needsUpdate = true;
  }

  update([]);
  function dispose() {
    mesh.geometry.dispose();
    material.dispose();
    texture.dispose();
  }

  return { mesh, update, dispose };
}

function disposeGroup(group) {
  group.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose?.());
  });
}
