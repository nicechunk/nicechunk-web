import * as THREE from "three";
import {
  appendGreedyVoxelGeometry,
  appendSolidCuboidGeometry,
} from "./render/voxelGreedyMesh.js";

export const forgedItemsStorageKey = "nicechunk.forged.items";
export const latestForgedItemStorageKey = "nicechunk.forged.latest";
export const forgedLoadoutRefreshStorageKey = "nicechunk.forged.loadout.refresh";
export const forgeCodePrefix = "NCF1.";

const voxelGrid = { x: 14, y: 10, z: 14 };
const legacyAppearanceVersion = 3;
const forgeAppearanceVersion = 4;
const forgeEquipmentVersion = 5;
const forgeGripPoseVersion = 6;
const forgeGripNormalVersion = 7;
const forgeCompactStatsVersion = 8;
const forgeSolidShortcutVersion = 9;
const forgeZeroOffsetVersion = 10;
const forgeDefaultColorVersion = 11;
const forgeCutBoxSolidVersion = 12;
const forgeExtrudedMaskSolidVersion = 13;
const forgePaintVersion = 14;
const appearanceGrid = { x: 24, y: 24, z: 24 };
const avatarHandGripSize = new THREE.Vector3(0.34, 0.42, 0.32);
const avatarGripHandAnchor = new THREE.Vector3(0, -0.99, 0);
const gripGestureRotationStepRadians = Math.PI / 2;
const gripContactConformDepth = avatarHandGripSize.z * 0.55;
const gripHandEmbedDepth = Math.min(avatarHandGripSize.z * 0.22, gripContactConformDepth * 0.45);
const equipmentAttributeKeys = [
  "hardness",
  "durability",
  "toughness",
  "ductility",
  "brittleness",
  "density",
  "heatResistance",
  "corrosionResistance",
  "conductivity",
  "thermalConductivity",
  "magnetism",
  "workability",
];
const forgedResources = {
  iron: { color: 0x9ca4a2 },
  copper: { color: 0xb96d45 },
  tin: { color: 0xc8cfbd },
  coal: { color: 0x2d2b28 },
  handle: { color: 0x7b5438, role: "grip" },
};
const resourceIds = Object.keys(forgedResources);
const forgedItemPreviewDataUrlCache = new Map();

export function saveForgedItem(codeOrBytes) {
  const bytes = forgeCodeToBytes(codeOrBytes);
  const code = forgeBytesToCode(bytes);
  const item = {
    id: `forged-${Date.now().toString(36)}`,
    bytes: Array.from(bytes),
    byteLength: bytes.length,
    savedAt: Date.now(),
  };
  const items = loadForgedItems().filter((entry) => entry.code !== code);
  items.push(item);
  const capped = items.slice(-24);
  localStorage.setItem(forgedItemsStorageKey, JSON.stringify(capped));
  localStorage.setItem(latestForgedItemStorageKey, JSON.stringify(item));
  return normalizeForgedItem(item);
}

export function notifyForgedLoadoutRefresh(codeOrBytes, detail = {}) {
  if (typeof localStorage === "undefined") return;
  const item = normalizeForgedItem(codeOrBytes);
  localStorage.setItem(forgedLoadoutRefreshStorageKey, JSON.stringify({
    at: Date.now(),
    code: item?.code ?? "",
    byteLength: item?.byteLength ?? 0,
    signature: detail.signature ?? "",
    slot: detail.slot ?? null,
  }));
}

export function loadForgedItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(forgedItemsStorageKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeForgedItem).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function loadLatestForgedItem() {
  try {
    const latest = JSON.parse(localStorage.getItem(latestForgedItemStorageKey) || "null");
    const normalized = normalizeForgedItem(latest);
    if (normalized) return normalized;
  } catch {
    // Fall back to the list below.
  }
  const items = loadForgedItems();
  return items.at(-1) ?? null;
}

export function forgeCodeToBytes(codeOrBytes) {
  if (codeOrBytes instanceof Uint8Array) return new Uint8Array(codeOrBytes);
  if (Array.isArray(codeOrBytes)) return Uint8Array.from(codeOrBytes);
  if (Array.isArray(codeOrBytes?.bytes)) return Uint8Array.from(codeOrBytes.bytes);
  if (codeOrBytes?.bytes instanceof Uint8Array) return new Uint8Array(codeOrBytes.bytes);
  if (typeof codeOrBytes?.code === "string") return forgeCodeToBytes(codeOrBytes.code);
  const encoded = String(codeOrBytes || "").startsWith(forgeCodePrefix)
    ? String(codeOrBytes).slice(forgeCodePrefix.length)
    : String(codeOrBytes || "");
  return base64UrlToBytes(encoded);
}

export function forgeBytesToCode(bytes) {
  return `${forgeCodePrefix}${bytesToBase64Url(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? []))}`;
}

function normalizeForgedItem(entry) {
  try {
    const bytes = forgeCodeToBytes(entry);
    if (!bytes.length) return null;
    return {
      ...entry,
      bytes: Array.from(bytes),
      byteLength: bytes.length,
      code: forgeBytesToCode(bytes),
    };
  } catch {
    return null;
  }
}

export function decodeForgeCode(codeOrBytes) {
  const reader = new BitReader(forgeCodeToBytes(codeOrBytes));
  const version = reader.read(4);
  if (version >= forgeEquipmentVersion) {
    const equipmentStats = readEquipmentStats(reader, version);
    if (reader.read(1) === 1) {
      const blueprint = readAppearanceBlueprint(reader, version);
      return { ...blueprint, equipmentStats };
    }
    return { version, equipmentStats, components: readComponentBlueprint(reader, version) };
  }
  if (version === legacyAppearanceVersion || version === forgeAppearanceVersion) return readAppearanceBlueprint(reader, version);
  return { version, components: readComponentBlueprint(reader, version) };
}

function readComponentBlueprint(reader, version) {
  const componentCount = reader.read(5);
  const components = [];
  for (let index = 0; index < componentCount; index++) {
    const resourceId = resourceIds[reader.read(3)] ?? "iron";
    const color = version >= forgeEquipmentVersion ? readComponentColor(reader, resourceId, version) : new THREE.Color(forgedResources[resourceId]?.color ?? forgedResources.iron.color);
    const dims = new THREE.Vector3(
      readQuantizedUnsigned(reader, 8, 64),
      readQuantizedUnsigned(reader, 8, 64),
      readQuantizedUnsigned(reader, 8, 64),
    );
    const offset = readComponentOffset(reader, version);
    const hasGripOffset = version >= 2 && reader.read(1) === 1;
    const gripOffset = hasGripOffset
      ? new THREE.Vector3(
          readQuantizedSigned(reader, 10, 64),
          readQuantizedSigned(reader, 10, 64),
          readQuantizedSigned(reader, 10, 64),
        )
      : null;
    const storedGripNormal = gripOffset && version >= forgeGripNormalVersion ? readGripNormal(reader) : null;
    const gripPose = gripOffset && version >= forgeGripPoseVersion ? readGripPose(reader) : null;
    const solid = readComponentSolid(reader, voxelGrid.x * voxelGrid.y * voxelGrid.z, version);
    const component = {
      resourceId,
      role: gripOffset ? "grip" : forgedResources[resourceId]?.role,
      color,
      dims,
      offset,
      grid: { ...voxelGrid },
      gripOffset,
      gripAngle: gripPose?.angle ?? 0,
      solid,
    };
    if (version >= forgePaintVersion) component.paintQuads = readComponentPaintQuads(reader, component);
    component.gripNormal = gripOffset ? storedGripNormal ?? deriveGripNormalForComponent(component, gripOffset) : null;
    components.push(component);
  }
  return components;
}

function readEquipmentStats(reader, version = forgeEquipmentVersion) {
  if (version >= forgeCompactStatsVersion) {
    const massGrams = reader.read(16) * 5;
    const volumeCm3 = reader.read(16);
    const attributes = {};
    for (const key of equipmentAttributeKeys) attributes[key] = compactAttributeToScore(reader.read(6));
    const densityKgM3 = deriveDensityKgM3FromMassVolume(massGrams, volumeCm3);
    return {
      massGrams,
      volumeCm3,
      densityKgM3,
      attributes,
      massKg: roundPhysicalValue(massGrams / 1000, 4),
      volumeM3: roundPhysicalValue(volumeCm3 / 1_000_000, 8),
    };
  }
  const massGrams = reader.read(22);
  const volumeCm3 = reader.read(22);
  const densityKgM3 = reader.read(14);
  const attributes = {};
  for (const key of equipmentAttributeKeys) attributes[key] = clampScore(reader.read(7));
  return {
    massGrams,
    volumeCm3,
    densityKgM3,
    attributes,
    massKg: roundPhysicalValue(massGrams / 1000, 4),
    volumeM3: roundPhysicalValue(volumeCm3 / 1_000_000, 8),
  };
}

function compactAttributeToScore(value) {
  return clampScore(Math.round(Math.max(0, Math.min(63, Number(value) || 0)) * 100 / 63));
}

function deriveDensityKgM3FromMassVolume(massGrams, volumeCm3) {
  if (volumeCm3 <= 0 || massGrams <= 0) return 0;
  return Math.max(0, Math.min(0x3fff, Math.round(massGrams * 1000 / volumeCm3)));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function roundPhysicalValue(value, decimals = 3) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function createForgedItemMesh(code, materialOptions = {}) {
  const blueprint = decodeForgeCode(code);
  const geometry = blueprint.appearance
    ? buildAppearanceGeometry(blueprint.appearance)
    : buildCompoundGeometry(blueprint.components);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.45,
    ...materialOptions,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.forgeBlueprint = blueprint;
  mesh.userData.equipmentStats = blueprint.equipmentStats ?? null;
  const gripPlacement = gripPlacementForBlueprint(blueprint);
  mesh.userData.grip = gripPlacement?.offset ?? null;
  mesh.userData.gripNormal = gripPlacement?.normal ?? null;
  mesh.userData.gripAngle = gripPlacement?.angle ?? 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createForgedItemPreviewElement(codeOrBytes, {
  className = "forged-item-render-preview",
  size = 96,
  title = "",
} = {}) {
  if (typeof document === "undefined") return null;
  const dataUrl = forgedItemPreviewDataUrl(codeOrBytes, size);
  if (!dataUrl) return null;
  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.src = dataUrl;
  if (title) image.title = title;
  return image;
}

function forgedItemPreviewDataUrl(codeOrBytes, size = 96) {
  let code;
  try {
    code = forgeBytesToCode(forgeCodeToBytes(codeOrBytes));
  } catch (_error) {
    return "";
  }
  const pixelSize = Math.max(32, Math.min(192, Math.round(Number(size) || 96)));
  const cacheKey = `${pixelSize}:${code}`;
  if (forgedItemPreviewDataUrlCache.has(cacheKey)) return forgedItemPreviewDataUrlCache.get(cacheKey);

  let renderer = null;
  let mesh = null;
  try {
    const canvas = document.createElement("canvas");
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    renderer.setSize(pixelSize, pixelSize, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2528, 2.4));
    const keyLight = new THREE.DirectionalLight(0xfff0bd, 2.1);
    keyLight.position.set(2.5, 3.4, 4.2);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x7eefff, 0.9);
    rimLight.position.set(-3.2, 2.2, -2.6);
    scene.add(rimLight);

    mesh = createForgedItemMesh(code, { roughness: 0.62, metalness: 0.5 });
    const root = new THREE.Group();
    root.add(mesh);
    scene.add(root);

    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const span = bounds.getSize(new THREE.Vector3());
    root.position.sub(center);
    const maxSpan = Math.max(span.x, span.y, span.z, 0.001);
    root.scale.setScalar(1.82 / maxSpan);

    const camera = new THREE.OrthographicCamera(-1.58, 1.58, 1.58, -1.58, 0.01, 20);
    camera.position.set(2.6, 2.1, 3.15);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/png");
    forgedItemPreviewDataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn("Failed to render forged item preview", error);
    forgedItemPreviewDataUrlCache.set(cacheKey, "");
    return "";
  } finally {
    disposePreviewMesh(mesh);
    renderer?.dispose?.();
  }
}

function disposePreviewMesh(object) {
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
}

function readAppearanceBlueprint(reader, version) {
  const dims = new THREE.Vector3(
    readQuantizedUnsigned(reader, 9, 32),
    readQuantizedUnsigned(reader, 9, 32),
    readQuantizedUnsigned(reader, 9, 32),
  );
  const hasGripOffset = reader.read(1) === 1;
  const gripOffset = hasGripOffset
    ? new THREE.Vector3(
        readQuantizedSigned(reader, 11, 64),
        readQuantizedSigned(reader, 11, 64),
        readQuantizedSigned(reader, 11, 64),
      )
    : null;
  const storedGripNormal = gripOffset && version >= forgeGripNormalVersion ? readGripNormal(reader) : null;
  const gripPose = gripOffset && version >= forgeGripPoseVersion ? readGripPose(reader) : null;
  const quadCount = reader.read(12);
  const quads = [];
  let coordinatePalette = null;
  if (version !== legacyAppearanceVersion && reader.read(1) === 1) {
    const coordinateCount = reader.read(5);
    coordinatePalette = [];
    for (let index = 0; index < coordinateCount; index++) coordinatePalette.push(reader.read(5));
  }
  for (let index = 0; index < quadCount; index++) {
    quads.push(version === legacyAppearanceVersion ? readLegacyAppearanceQuad(reader) : readCompressedAppearanceQuad(reader, coordinatePalette, version >= forgeEquipmentVersion));
  }
  const gripNormal = gripOffset ? storedGripNormal ?? deriveGripNormalForAppearance({ dims, quads }, gripOffset) : null;
  return {
    version,
    appearance: {
      dims,
      grid: { ...appearanceGrid },
      quads,
      gripOffset,
      gripNormal,
      gripAngle: gripPose?.angle ?? 0,
    },
  };
}

function readGripPose(reader) {
  return {
    angle: gripStepToAngle(reader.read(2)),
  };
}

function readGripNormal(reader) {
  const packed = reader.read(3);
  const axis = Math.min(2, packed >> 1);
  const sign = packed & 1 ? 1 : -1;
  const normal = new THREE.Vector3();
  normal.setComponent(axis, sign);
  return normal;
}

function readLegacyAppearanceQuad(reader) {
  return {
    axis: reader.read(2),
    side: reader.read(1),
    resourceId: resourceIds[reader.read(3)] ?? "iron",
    plane: reader.read(5),
    u0: reader.read(5),
    u1: reader.read(5),
    v0: reader.read(5),
    v1: reader.read(5),
  };
}

function readCompressedAppearanceQuad(reader, coordinatePalette = null, includeColor = false) {
  if (reader.read(1) === 0) {
    return {
      ...readAppearanceQuadHeader(reader, coordinatePalette, includeColor),
      u0: 0,
      u1: appearanceGrid.x,
      v0: 0,
      v1: appearanceGrid.x,
    };
  }
  const isGeneral = reader.read(1) === 1;
  const quad = readAppearanceQuadHeader(reader, coordinatePalette, includeColor);
  if (isGeneral) {
    return {
      ...quad,
      u0: readAppearanceCoord(reader, coordinatePalette),
      u1: readAppearanceCoord(reader, coordinatePalette),
      v0: readAppearanceCoord(reader, coordinatePalette),
      v1: readAppearanceCoord(reader, coordinatePalette),
    };
  }
  const rangeIsV = reader.read(1) === 1;
  const start = readAppearanceCoord(reader, coordinatePalette);
  const end = readAppearanceCoord(reader, coordinatePalette);
  return {
    ...quad,
    u0: rangeIsV ? 0 : start,
    u1: rangeIsV ? appearanceGrid.x : end,
    v0: rangeIsV ? start : 0,
    v1: rangeIsV ? end : appearanceGrid.x,
  };
}

function readAppearanceQuadHeader(reader, coordinatePalette = null, includeColor = false) {
  const axis = reader.read(2);
  const side = reader.read(1);
  const resourceId = resourceIds[reader.read(3)] ?? "iron";
  const quad = {
    axis,
    side,
    resourceId,
    plane: readAppearanceCoord(reader, coordinatePalette),
  };
  if (includeColor) quad.color = `#${readQuantizedColor(reader).getHexString()}`;
  return quad;
}

function readAppearanceCoord(reader, coordinatePalette = null) {
  if (!coordinatePalette) return reader.read(5);
  return coordinatePalette[reader.read(bitsForPalette(coordinatePalette))] ?? 0;
}

function bitsForPalette(coordinatePalette) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, coordinatePalette.length))));
}

export function equipForgedItemOnAvatar({ avatar, code, currentMesh = null, scale = 1 }) {
  const { rightArm } = avatar?.userData?.limbs ?? {};
  if (!rightArm) return null;
  const itemCode = code ? forgeBytesToCode(forgeCodeToBytes(code)) : "";
  if (currentMesh?.userData.code === itemCode) {
    currentMesh.visible = Boolean(code);
    return currentMesh;
  }
  if (currentMesh) {
    rightArm.remove(currentMesh);
    currentMesh.geometry?.dispose?.();
    currentMesh.material?.dispose?.();
  }
  if (!itemCode) return null;

  const mesh = createForgedItemMesh(code);
  const grip = mesh.userData.grip;
  if (!grip) {
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
    return null;
  }
  const handPalmAnchor = new THREE.Vector3(0, -0.8, -0.02);
  mesh.name = "equippedForgedItem";
  mesh.userData.code = itemCode;
  mesh.scale.setScalar(scale);
  const gripNormal = mesh.userData.gripNormal;
  if (gripNormal) {
    const gripBasis = gripSurfaceBasis(gripNormal, mesh.userData.gripAngle ?? 0);
    const { handSide, handFront, handApproach } = avatarPalmDownGripBasis();
    const sourceMatrix = new THREE.Matrix4().makeBasis(gripBasis.side, gripBasis.front, gripBasis.approach);
    const targetMatrix = new THREE.Matrix4().makeBasis(handSide, handFront, handApproach);
    mesh.quaternion.setFromRotationMatrix(targetMatrix.multiply(sourceMatrix.invert()));
    const gripOffset = grip.clone().multiplyScalar(scale).applyQuaternion(mesh.quaternion);
    const embeddedAnchor = avatarGripHandAnchor.clone().add(handApproach.clone().multiplyScalar(gripHandEmbedDepth));
    mesh.position.copy(embeddedAnchor).sub(gripOffset);
  } else {
    // Legacy forge codes only stored a grip point, so keep the original fixed pose.
    const frontAxis = new THREE.Vector3(0, -1, 0);
    const gripAxis = new THREE.Vector3(0, 0, -1);
    const rightAxis = new THREE.Vector3().crossVectors(frontAxis, gripAxis);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frontAxis, gripAxis, rightAxis));
    const gripOffset = grip.clone().multiplyScalar(scale).applyQuaternion(mesh.quaternion);
    mesh.position.copy(handPalmAnchor).sub(gripOffset);
  }
  rightArm.add(mesh);
  return mesh;
}

export function gripForComponents(components) {
  return gripPlacementForComponents(components)?.offset ?? null;
}

function gripPlacementForBlueprint(blueprint) {
  if (blueprint.appearance?.gripOffset) {
    return {
      offset: blueprint.appearance.gripOffset.clone(),
      normal: blueprint.appearance.gripNormal?.clone?.() ?? null,
      angle: blueprint.appearance.gripAngle ?? 0,
    };
  }
  return gripPlacementForComponents(blueprint.components ?? []);
}

function gripPlacementForComponents(components) {
  const explicitGrip = components.find((component) => component.gripOffset);
  if (!explicitGrip) return null;
  return {
    offset: explicitGrip.gripOffset.clone(),
    normal: explicitGrip.gripNormal?.clone?.() ?? null,
    angle: explicitGrip.gripAngle ?? 0,
  };
}

function deriveGripNormalForComponent(component, gripOffset) {
  if (!component?.solid || !component?.grid || !component?.dims || !gripOffset) return null;
  const localPoint = gripOffset.clone().sub(component.offset ?? new THREE.Vector3());
  const dirs = [
    { normal: new THREE.Vector3(1, 0, 0), neighbor: [1, 0, 0] },
    { normal: new THREE.Vector3(-1, 0, 0), neighbor: [-1, 0, 0] },
    { normal: new THREE.Vector3(0, 1, 0), neighbor: [0, 1, 0] },
    { normal: new THREE.Vector3(0, -1, 0), neighbor: [0, -1, 0] },
    { normal: new THREE.Vector3(0, 0, 1), neighbor: [0, 0, 1] },
    { normal: new THREE.Vector3(0, 0, -1), neighbor: [0, 0, -1] },
  ];
  let best = null;
  let bestScore = Infinity;
  for (let z = 0; z < component.grid.z; z++) {
    for (let y = 0; y < component.grid.y; y++) {
      for (let x = 0; x < component.grid.x; x++) {
        if (!isComponentSolid(component, x, y, z)) continue;
        for (const dir of dirs) {
          const [nx, ny, nz] = dir.neighbor;
          if (isComponentSolid(component, x + nx, y + ny, z + nz)) continue;
          const surfacePoint = componentSurfacePointForCell(component, [x, y, z], dir.normal, localPoint);
          const score = surfacePoint.distanceToSquared(localPoint);
          if (score < bestScore) {
            bestScore = score;
            best = dir.normal.clone();
          }
        }
      }
    }
  }
  return best;
}

function componentSurfacePointForCell(component, cell, normal, referencePoint) {
  const normalAxis = dominantAxis(normal);
  const sign = Math.sign(normal.getComponent(normalAxis)) || 1;
  const dims = [component.dims.x, component.dims.y, component.dims.z];
  const grid = [component.grid.x, component.grid.y, component.grid.z];
  const coordinate = [referencePoint.x, referencePoint.y, referencePoint.z];
  const axes = [0, 1, 2].filter((axis) => axis !== normalAxis);
  for (const axis of axes) {
    const min = -dims[axis] * 0.5 + cell[axis] * dims[axis] / grid[axis];
    const max = -dims[axis] * 0.5 + (cell[axis] + 1) * dims[axis] / grid[axis];
    coordinate[axis] = THREE.MathUtils.clamp(coordinate[axis], min, max);
  }
  coordinate[normalAxis] = -dims[normalAxis] * 0.5 +
    (sign > 0 ? cell[normalAxis] + 1 : cell[normalAxis]) * dims[normalAxis] / grid[normalAxis];
  return new THREE.Vector3(coordinate[0], coordinate[1], coordinate[2]);
}

function deriveGripNormalForAppearance(appearance, gripOffset) {
  if (!appearance?.dims || !gripOffset) return null;
  let best = null;
  let bestScore = Infinity;
  for (const quad of appearance.quads ?? []) {
    const candidate = nearestPointOnAppearanceQuad(appearance.dims, quad, gripOffset);
    if (!candidate) continue;
    const score = candidate.point.distanceToSquared(gripOffset);
    if (score < bestScore) {
      bestScore = score;
      best = candidate.normal;
    }
  }
  return best;
}

function nearestPointOnAppearanceQuad(dims, quad, point) {
  const axis = quad.axis;
  const uAxis = axis === 0 ? 1 : 0;
  const vAxis = axis === 2 ? 1 : 2;
  const values = [point.x, point.y, point.z];
  const dimsArray = [dims.x, dims.y, dims.z];
  const gridArray = [appearanceGrid.x, appearanceGrid.y, appearanceGrid.z];
  const axisValue = -dimsArray[axis] * 0.5 + (quad.plane / gridArray[axis]) * dimsArray[axis];
  const uMin = -dimsArray[uAxis] * 0.5 + (quad.u0 / gridArray[uAxis]) * dimsArray[uAxis];
  const uMax = -dimsArray[uAxis] * 0.5 + (quad.u1 / gridArray[uAxis]) * dimsArray[uAxis];
  const vMin = -dimsArray[vAxis] * 0.5 + (quad.v0 / gridArray[vAxis]) * dimsArray[vAxis];
  const vMax = -dimsArray[vAxis] * 0.5 + (quad.v1 / gridArray[vAxis]) * dimsArray[vAxis];
  values[axis] = axisValue;
  values[uAxis] = THREE.MathUtils.clamp(values[uAxis], uMin, uMax);
  values[vAxis] = THREE.MathUtils.clamp(values[vAxis], vMin, vMax);
  const normal = new THREE.Vector3();
  normal.setComponent(axis, quad.side ? 1 : -1);
  return { point: new THREE.Vector3(values[0], values[1], values[2]), normal };
}

function dominantAxis(vector) {
  const values = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  return values[0] >= values[1] && values[0] >= values[2] ? 0 : values[1] >= values[2] ? 1 : 2;
}

function gripStepToAngle(step = 0) {
  return (step & 3) * gripGestureRotationStepRadians;
}

function normalizeGripAngle(angle) {
  const value = Number(angle) || 0;
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}

function gripSurfaceBasis(normal, angle = 0) {
  const approach = normal.clone().normalize();
  let front;
  if (Math.abs(approach.y) < 0.75) {
    front = new THREE.Vector3(0, 1, 0);
  } else {
    front = new THREE.Vector3(0, 0, -Math.sign(approach.y) || -1);
  }
  front.sub(approach.clone().multiplyScalar(front.dot(approach)));
  if (front.lengthSq() < 0.0001) front.set(1, 0, 0);
  front.normalize();
  if (angle) front.applyAxisAngle(approach, normalizeGripAngle(angle)).normalize();
  const side = new THREE.Vector3().crossVectors(front, approach).normalize();
  return { side, front, approach };
}

function avatarPalmDownGripBasis() {
  const handApproach = new THREE.Vector3(0, 1, 0);
  const handFront = new THREE.Vector3(0, 0, -1);
  const handSide = new THREE.Vector3().crossVectors(handFront, handApproach).normalize();
  return { handSide, handFront, handApproach };
}

function buildCompoundGeometry(components) {
  const positions = [];
  const normals = [];
  const colors = [];
  for (const component of components) appendComponentGeometry(component, positions, normals, colors);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function buildAppearanceGeometry(appearance) {
  const positions = [];
  const normals = [];
  const colors = [];
  for (const quad of appearance.quads ?? []) {
    const color = new THREE.Color(quad.color ?? forgedResources[quad.resourceId]?.color ?? forgedResources.iron.color);
    pushAppearanceQuad(positions, normals, colors, appearance.dims, quad, color);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

function pushAppearanceQuad(positions, normals, colors, dims, quad, color) {
  const axis = quad.axis;
  const uAxis = axis === 0 ? 1 : 0;
  const vAxis = axis === 2 ? 1 : 2;
  const makePoint = (u, v) => {
    const values = [0, 0, 0];
    values[axis] = quad.plane;
    values[uAxis] = u;
    values[vAxis] = v;
    return new THREE.Vector3(
      -dims.x * 0.5 + (values[0] / appearanceGrid.x) * dims.x,
      -dims.y * 0.5 + (values[1] / appearanceGrid.y) * dims.y,
      -dims.z * 0.5 + (values[2] / appearanceGrid.z) * dims.z,
    );
  };
  const p00 = makePoint(quad.u0, quad.v0);
  const p10 = makePoint(quad.u1, quad.v0);
  const p11 = makePoint(quad.u1, quad.v1);
  const p01 = makePoint(quad.u0, quad.v1);
  let corners = [];
  if (axis === 0) corners = quad.side ? [p00, p10, p11, p01] : [p01, p11, p10, p00];
  if (axis === 1) corners = quad.side ? [p01, p11, p10, p00] : [p00, p10, p11, p01];
  if (axis === 2) corners = quad.side ? [p10, p11, p01, p00] : [p00, p01, p11, p10];
  const normal = [0, 0, 0];
  normal[axis] = quad.side ? 1 : -1;
  pushColoredFace(positions, normals, colors, corners.map((point) => point.toArray()), normal, color);
}

function appendComponentGeometry(component, positions, normals, colors) {
  const { grid, dims, offset } = component;
  const color = component.color?.clone?.() ?? new THREE.Color(component.color ?? forgedResources[component.resourceId]?.color ?? forgedResources.iron.color);
  if (componentIsFullySolid(component) && !componentHasPaint(component)) {
    appendSolidCuboidGeometry({ dims, offset, color, positions, normals, colors });
    return;
  }
  appendGreedyVoxelGeometry({
    grid,
    dims,
    solid: component.solid,
    offset,
    color,
    faceColor: componentHasPaint(component) ? paintedFaceColor(component, color) : null,
    positions,
    normals,
    colors,
  });
}

function componentHasPaint(component) {
  return (Array.isArray(component?.paintQuads) && component.paintQuads.length > 0) ||
    (Array.isArray(component?.paint) && component.paint.length > 0);
}

function paintedFaceColor(component, fallbackColor) {
  const resolveColor = component.paintQuads?.length
    ? componentPaintQuadResolver(component)
    : componentPaintRecordResolver(component);
  return ({ axis, side, cell }) => resolveColor(axis, side, cell) ?? fallbackColor;
}

function componentPaintRecordResolver(component) {
  const lookup = new Map();
  for (const record of component?.paint ?? []) {
    if (!validPaintRecord(record, component.grid)) continue;
    lookup.set(paintFaceKey(record.axis, record.side, [record.x, record.y, record.z]), paintRecordColor(record));
  }
  return (axis, side, cell) => lookup.get(paintFaceKey(axis, side, cell)) ?? null;
}

function componentPaintQuadResolver(component) {
  const planes = new Map();
  for (const quad of component?.paintQuads ?? []) {
    if (!validPaintQuad(quad, component.grid)) continue;
    const key = paintPlaneKey(quad.axis, quad.side, quad.plane);
    const entries = planes.get(key) ?? [];
    entries.push({
      ...quad,
      color: paintRecordColor(quad),
    });
    planes.set(key, entries);
  }
  return (axis, side, cell) => {
    const plane = side ? cell[axis] + 1 : cell[axis];
    const quads = planes.get(paintPlaneKey(axis, side, plane));
    if (!quads?.length) return null;
    const tangentAxes = [0, 1, 2].filter((item) => item !== axis);
    const u = cell[tangentAxes[0]];
    const v = cell[tangentAxes[1]];
    for (let index = quads.length - 1; index >= 0; index--) {
      const quad = quads[index];
      if (u >= quad.u0 && u < quad.u1 && v >= quad.v0 && v < quad.v1) return quad.color;
    }
    return null;
  };
}

function validPaintQuad(quad, grid = voxelGrid) {
  if (!Number.isInteger(quad?.axis) || quad.axis < 0 || quad.axis > 2) return false;
  if (quad.side !== 0 && quad.side !== 1) return false;
  const axisSize = grid[axisKey(quad.axis)];
  const tangentAxes = [0, 1, 2].filter((axis) => axis !== quad.axis);
  const uSize = grid[axisKey(tangentAxes[0])];
  const vSize = grid[axisKey(tangentAxes[1])];
  return Number.isInteger(quad.plane) &&
    Number.isInteger(quad.u0) &&
    Number.isInteger(quad.u1) &&
    Number.isInteger(quad.v0) &&
    Number.isInteger(quad.v1) &&
    quad.plane >= 0 &&
    quad.plane <= axisSize &&
    quad.u0 >= 0 &&
    quad.u0 < quad.u1 &&
    quad.u1 <= uSize &&
    quad.v0 >= 0 &&
    quad.v0 < quad.v1 &&
    quad.v1 <= vSize;
}

function paintPlaneKey(axis, side, plane) {
  return `${axis}:${side}:${plane}`;
}

function validPaintRecord(record, grid = voxelGrid) {
  return Number.isInteger(record?.axis) &&
    record.axis >= 0 &&
    record.axis <= 2 &&
    (record.side === 0 || record.side === 1) &&
    Number.isInteger(record.x) &&
    Number.isInteger(record.y) &&
    Number.isInteger(record.z) &&
    record.x >= 0 &&
    record.y >= 0 &&
    record.z >= 0 &&
    record.x < grid.x &&
    record.y < grid.y &&
    record.z < grid.z;
}

function paintRecordColor(record) {
  return record.color instanceof THREE.Color
    ? record.color
    : new THREE.Color(record.color ?? 0xffffff);
}

function paintFaceKey(axis, side, cell) {
  return `${axis}:${side}:${cell[0]}:${cell[1]}:${cell[2]}`;
}

function componentIsFullySolid(component) {
  const total = (component?.grid?.x ?? 0) * (component?.grid?.y ?? 0) * (component?.grid?.z ?? 0);
  if (!total || component?.solid?.length !== total) return false;
  for (const value of component.solid) if (value !== 1) return false;
  return true;
}

function isComponentSolid(component, x, y, z) {
  const { grid } = component;
  if (x < 0 || y < 0 || z < 0 || x >= grid.x || y >= grid.y || z >= grid.z) return false;
  return component.solid[voxelIndex(grid, x, y, z)] === 1;
}

function solidCellValue(solid, grid, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= grid.x || y >= grid.y || z >= grid.z) return false;
  return solid[voxelIndex(grid, x, y, z)] === 1;
}

function voxelIndex(grid, x, y, z) {
  return x + grid.x * (y + grid.y * z);
}

function axisKey(axis) {
  return ["x", "y", "z"][axis];
}

function pushColoredFace(positions, normals, colors, corners, normal, color) {
  const order = [0, 1, 2, 0, 2, 3];
  for (const index of order) {
    positions.push(...corners[index]);
    normals.push(...normal);
    colors.push(color.r, color.g, color.b);
  }
}

function readQuantizedUnsigned(reader, bits, scale) {
  return reader.read(bits) / scale;
}

function readComponentOffset(reader, version) {
  if (version >= forgeZeroOffsetVersion && reader.read(1) === 1) {
    return new THREE.Vector3();
  }
  return new THREE.Vector3(
    readQuantizedSigned(reader, 10, 64),
    readQuantizedSigned(reader, 10, 64),
    readQuantizedSigned(reader, 10, 64),
  );
}

function readQuantizedSigned(reader, bits, scale) {
  const value = reader.read(bits);
  const sign = 1 << (bits - 1);
  return (value >= sign ? value - (1 << bits) : value) / scale;
}

function readQuantizedColor(reader) {
  const value = reader.read(12);
  return new THREE.Color(
    ((value >> 8) & 0xf) / 15,
    ((value >> 4) & 0xf) / 15,
    (value & 0xf) / 15,
  );
}

function readComponentColor(reader, resourceId, version) {
  if (version >= forgeDefaultColorVersion && reader.read(1) === 1) {
    return new THREE.Color(forgedResources[resourceId]?.color ?? forgedResources.iron.color);
  }
  return readQuantizedColor(reader);
}

function readComponentSolid(reader, total, version) {
  if (version >= forgeExtrudedMaskSolidVersion) {
    const mode = reader.read(2);
    if (mode === 1) return new Uint8Array(total).fill(1);
    if (mode === 2) return readSolidCutBoxes(reader, total, voxelGrid);
    if (mode === 3) return readSolidExtrudedMask(reader, total, voxelGrid);
    return readSolidRuns(reader, total);
  }
  if (version >= forgeCutBoxSolidVersion) {
    const mode = reader.read(2);
    if (mode === 1) return new Uint8Array(total).fill(1);
    if (mode === 2) return readSolidCutBoxes(reader, total, voxelGrid);
    return readSolidRuns(reader, total);
  }
  if (version >= forgeSolidShortcutVersion && reader.read(1) === 1) {
    return new Uint8Array(total).fill(1);
  }
  return readSolidRuns(reader, total);
}

function readComponentPaintQuads(reader, component) {
  const quads = [];
  const quadCount = reader.read(11);
  for (let index = 0; index < quadCount; index++) {
    const axis = Math.min(2, reader.read(2));
    const side = reader.read(1);
    const plane = reader.read(4);
    const u0 = reader.read(4);
    const u1 = reader.read(4);
    const v0 = reader.read(4);
    const v1 = reader.read(4);
    const color = colorStringFromQuantized(reader.read(12));
    const quad = normalizePaintQuad(component, { axis, side, plane, u0, u1, v0, v1, color });
    if (quad) quads.push(quad);
  }
  return quads;
}

function normalizePaintQuad(component, quad) {
  const tangentAxes = [0, 1, 2].filter((axis) => axis !== quad.axis);
  const uAxis = tangentAxes[0];
  const vAxis = tangentAxes[1];
  const gridSize = [component.grid.x, component.grid.y, component.grid.z];
  const cellAxisValue = quad.side ? quad.plane - 1 : quad.plane;
  if (cellAxisValue < 0 || cellAxisValue >= gridSize[quad.axis]) return null;
  const uStart = Math.max(0, Math.min(gridSize[uAxis], quad.u0));
  const uEnd = Math.max(uStart, Math.min(gridSize[uAxis], quad.u1));
  const vStart = Math.max(0, Math.min(gridSize[vAxis], quad.v0));
  const vEnd = Math.max(vStart, Math.min(gridSize[vAxis], quad.v1));
  if (uEnd <= uStart || vEnd <= vStart) return null;
  return {
    axis: quad.axis,
    side: quad.side,
    plane: quad.plane,
    u0: uStart,
    u1: uEnd,
    v0: vStart,
    v1: vEnd,
    color: quad.color,
  };
}

function colorStringFromQuantized(value) {
  const hex = (channel) => {
    const expanded = channel * 17;
    return expanded.toString(16).padStart(2, "0");
  };
  return `#${hex((value >> 8) & 0xf)}${hex((value >> 4) & 0xf)}${hex(value & 0xf)}`;
}

function readSolidExtrudedMask(reader, total, grid = voxelGrid) {
  const axis = Math.min(2, reader.read(2));
  const tangentAxes = [0, 1, 2].filter((item) => item !== axis);
  const width = grid[axisKey(tangentAxes[0])];
  const height = grid[axisKey(tangentAxes[1])];
  const layers = grid[axisKey(axis)];
  const mask = readSolidMaskRuns(reader, width * height);
  const solid = new Uint8Array(total);
  for (let layer = 0; layer < layers; layer++) {
    for (let v = 0; v < height; v++) {
      for (let u = 0; u < width; u++) {
        const cell = [0, 0, 0];
        cell[axis] = layer;
        cell[tangentAxes[0]] = u;
        cell[tangentAxes[1]] = v;
        solid[voxelIndex(grid, cell[0], cell[1], cell[2])] = mask[u + width * v];
      }
    }
  }
  return solid;
}

function readSolidMaskRuns(reader, total) {
  const mask = new Uint8Array(total);
  let value = reader.read(1);
  const runCount = reader.read(8);
  let cursor = 0;
  for (let index = 0; index < runCount; index++) {
    const length = reader.read(8);
    mask.fill(value, cursor, Math.min(total, cursor + length));
    cursor += length;
    value = value ? 0 : 1;
  }
  return mask;
}

function readSolidCutBoxes(reader, total, grid = voxelGrid) {
  const solid = new Uint8Array(total).fill(1);
  const boxCount = reader.read(5);
  for (let index = 0; index < boxCount; index++) {
    const box = {
      x: reader.read(4),
      y: reader.read(4),
      z: reader.read(4),
      sx: reader.read(4),
      sy: reader.read(4),
      sz: reader.read(4),
    };
    for (let z = box.z; z < Math.min(grid.z, box.z + box.sz); z++) {
      for (let y = box.y; y < Math.min(grid.y, box.y + box.sy); y++) {
        for (let x = box.x; x < Math.min(grid.x, box.x + box.sx); x++) solid[voxelIndex(grid, x, y, z)] = 0;
      }
    }
  }
  return solid;
}

function readSolidRuns(reader, total) {
  const solid = new Uint8Array(total);
  let value = reader.read(1);
  const runCount = reader.read(11);
  let cursor = 0;
  for (let index = 0; index < runCount; index++) {
    const length = reader.read(11);
    solid.fill(value, cursor, Math.min(total, cursor + length));
    cursor += length;
    value = value ? 0 : 1;
  }
  return solid;
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitOffset = 0;
  }

  read(bits) {
    let value = 0;
    for (let index = 0; index < bits; index++) {
      const byte = this.bytes[Math.floor(this.bitOffset / 8)] ?? 0;
      const bit = (byte >> (7 - (this.bitOffset % 8))) & 1;
      value = (value << 1) | bit;
      this.bitOffset++;
    }
    return value;
  }
}
