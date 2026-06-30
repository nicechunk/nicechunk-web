import * as THREE from "three";

export const forgedItemsStorageKey = "nicechunk.forged.items";
export const latestForgedItemStorageKey = "nicechunk.forged.latest";
export const forgeCodePrefix = "NCF1.";

const voxelGrid = { x: 14, y: 10, z: 14 };
const legacyAppearanceVersion = 3;
const forgeAppearanceVersion = 4;
const appearanceGrid = { x: 24, y: 24, z: 24 };
const forgedResources = {
  iron: { color: 0x9ca4a2 },
  copper: { color: 0xb96d45 },
  tin: { color: 0xc8cfbd },
  coal: { color: 0x2d2b28 },
  handle: { color: 0x7b5438, role: "grip" },
};
const resourceIds = Object.keys(forgedResources);

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
  if (version === legacyAppearanceVersion || version === forgeAppearanceVersion) return readAppearanceBlueprint(reader, version);
  const componentCount = reader.read(5);
  const components = [];
  for (let index = 0; index < componentCount; index++) {
    const resourceId = resourceIds[reader.read(3)] ?? "iron";
    const dims = new THREE.Vector3(
      readQuantizedUnsigned(reader, 8, 64),
      readQuantizedUnsigned(reader, 8, 64),
      readQuantizedUnsigned(reader, 8, 64),
    );
    const offset = new THREE.Vector3(
      readQuantizedSigned(reader, 10, 64),
      readQuantizedSigned(reader, 10, 64),
      readQuantizedSigned(reader, 10, 64),
    );
    const hasGripOffset = version >= 2 && reader.read(1) === 1;
    const gripOffset = hasGripOffset
      ? new THREE.Vector3(
          readQuantizedSigned(reader, 10, 64),
          readQuantizedSigned(reader, 10, 64),
          readQuantizedSigned(reader, 10, 64),
        )
      : null;
    components.push({
      resourceId,
      role: gripOffset ? "grip" : forgedResources[resourceId]?.role,
      dims,
      offset,
      grid: { ...voxelGrid },
      gripOffset,
      solid: readSolidRuns(reader, voxelGrid.x * voxelGrid.y * voxelGrid.z),
    });
  }
  return { version, components };
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
  mesh.userData.grip = blueprint.appearance?.gripOffset?.clone?.() ?? gripForComponents(blueprint.components ?? []);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
  const quadCount = reader.read(12);
  const quads = [];
  let coordinatePalette = null;
  if (version !== legacyAppearanceVersion && reader.read(1) === 1) {
    const coordinateCount = reader.read(5);
    coordinatePalette = [];
    for (let index = 0; index < coordinateCount; index++) coordinatePalette.push(reader.read(5));
  }
  for (let index = 0; index < quadCount; index++) {
    quads.push(version === legacyAppearanceVersion ? readLegacyAppearanceQuad(reader) : readCompressedAppearanceQuad(reader, coordinatePalette));
  }
  return {
    version,
    appearance: {
      dims,
      grid: { ...appearanceGrid },
      quads,
      gripOffset,
    },
  };
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

function readCompressedAppearanceQuad(reader, coordinatePalette = null) {
  if (reader.read(1) === 0) {
    return {
      ...readAppearanceQuadHeader(reader, coordinatePalette),
      u0: 0,
      u1: appearanceGrid.x,
      v0: 0,
      v1: appearanceGrid.x,
    };
  }
  const isGeneral = reader.read(1) === 1;
  const quad = readAppearanceQuadHeader(reader, coordinatePalette);
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

function readAppearanceQuadHeader(reader, coordinatePalette = null) {
  return {
    axis: reader.read(2),
    side: reader.read(1),
    resourceId: resourceIds[reader.read(3)] ?? "iron",
    plane: readAppearanceCoord(reader, coordinatePalette),
  };
}

function readAppearanceCoord(reader, coordinatePalette = null) {
  if (!coordinatePalette) return reader.read(5);
  return coordinatePalette[reader.read(bitsForPalette(coordinatePalette))] ?? 0;
}

function bitsForPalette(coordinatePalette) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(1, coordinatePalette.length))));
}

export function equipForgedItemOnAvatar({ avatar, code, currentMesh = null, scale = 0.52 }) {
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
  // Equip pose: handle bottom (-Y) points back (+Z), and item front (+X) points down (-Y).
  const frontAxis = new THREE.Vector3(0, -1, 0);
  const gripAxis = new THREE.Vector3(0, 0, -1);
  const rightAxis = new THREE.Vector3().crossVectors(frontAxis, gripAxis);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frontAxis, gripAxis, rightAxis));
  const gripOffset = grip.clone().multiplyScalar(scale).applyQuaternion(mesh.quaternion);
  mesh.position.copy(handPalmAnchor).sub(gripOffset);
  rightArm.add(mesh);
  return mesh;
}

export function gripForComponents(components) {
  const explicitGrip = components.find((component) => component.gripOffset);
  if (explicitGrip) return explicitGrip.gripOffset.clone();
  return null;
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
    const color = new THREE.Color(forgedResources[quad.resourceId]?.color ?? forgedResources.iron.color);
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
  const cell = {
    x: dims.x / grid.x,
    y: dims.y / grid.y,
    z: dims.z / grid.z,
  };
  const color = new THREE.Color(forgedResources[component.resourceId]?.color ?? forgedResources.iron.color);
  const dirs = [
    { n: [1, 0, 0], neighbor: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
    { n: [-1, 0, 0], neighbor: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { n: [0, 1, 0], neighbor: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], neighbor: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], neighbor: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
    { n: [0, 0, -1], neighbor: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  ];

  for (let z = 0; z < grid.z; z++) {
    for (let y = 0; y < grid.y; y++) {
      for (let x = 0; x < grid.x; x++) {
        if (component.solid[voxelIndex(grid, x, y, z)] !== 1) continue;
        for (const dir of dirs) {
          const [nx, ny, nz] = dir.neighbor;
          if (isComponentSolid(component, x + nx, y + ny, z + nz)) continue;
          const face = dir.corners.map(([cx, cy, cz]) => ([
            offset.x - dims.x * 0.5 + (x + cx) * cell.x,
            offset.y - dims.y * 0.5 + (y + cy) * cell.y,
            offset.z - dims.z * 0.5 + (z + cz) * cell.z,
          ]));
          pushColoredFace(positions, normals, colors, face, dir.n, color);
        }
      }
    }
  }
}

function isComponentSolid(component, x, y, z) {
  const { grid } = component;
  if (x < 0 || y < 0 || z < 0 || x >= grid.x || y >= grid.y || z >= grid.z) return false;
  return component.solid[voxelIndex(grid, x, y, z)] === 1;
}

function voxelIndex(grid, x, y, z) {
  return x + grid.x * (y + grid.y * z);
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

function readQuantizedSigned(reader, bits, scale) {
  const value = reader.read(bits);
  const sign = 1 << (bits - 1);
  return (value >= sign ? value - (1 << bits) : value) / scale;
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
