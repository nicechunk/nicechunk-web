import { chunkSize, minBuildY } from "./config.js";
import { canonicalAboveSurfaceBlocksInArea, canonicalRenderTypeAt, canonicalSurfaceHeightAt, canonicalWaterLevelAt, setCanonicalWorldConfig } from "./canonicalResource.js";
import { blockKey, parseCellKey } from "./keys.js";

const cubeHalfSize = 0.5;
const waterVisualHeightScale = 2 / 3;
const waterVisualCenterOffset = -1 / 6;
const cavityNeighborOffsets = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function buildChunkRenderData({ chunkX, chunkZ, detailMode = "surface", worldConfig = null, removedKeys = [], placedEntries = [], dynamicWaterKeys = [] } = {}) {
  if (worldConfig) setCanonicalWorldConfig(worldConfig);

  const removed = new Set(removedKeys);
  const placed = new Map(placedEntries);
  const dynamicWater = new Set(dynamicWaterKeys);
  const surfaceAt = createSurfaceReader();
  const fullDetail = detailMode === "full";
  const treeDetail = detailMode !== "surface";
  const retainCollisionKeys = detailMode === "full" || detailMode === "decorated";
  const terrainColumnDepth = fullDetail ? 2 : 0;
  const byType = new Map();
  const waterInstances = [];
  const solidKeys = new Set();
  const minX = chunkX * chunkSize;
  const maxX = minX + chunkSize - 1;
  const minZ = chunkZ * chunkSize;
  const maxZ = minZ + chunkSize - 1;
  const aboveSurfaceByColumn = treeDetail ? createAboveSurfaceColumnMap(canonicalAboveSurfaceBlocksInArea({ minX, maxX, minZ, maxZ })) : null;

  for (let localZ = 0; localZ < chunkSize; localZ += 1) {
    for (let localX = 0; localX < chunkSize; localX += 1) {
      const x = minX + localX;
      const z = minZ + localZ;
      const height = surfaceAt(x, z);
      const columnStart = exposedColumnStart(x, z, height, terrainColumnDepth, surfaceAt);

      for (let y = Math.max(minBuildY, columnStart); y <= height; y += 1) {
        const key = blockKey(x, y, z);
        if (placed.has(key) && !removed.has(key)) continue;
        const type = canonicalRenderTypeAt({ x, y, z });
        if (!type || removed.has(key)) continue;
        addVoxel(byType, solidKeys, x, y, z, type, key);
      }

      if (treeDetail) {
        const waterLevel = canonicalWaterLevelAt({ x, z, surface: height });
        const underwater = waterLevel !== null && waterLevel > height;
        if (!underwater && !removed.has(blockKey(x, height, z))) {
          addAboveSurfaceColumnVoxels(aboveSurfaceByColumn, byType, solidKeys, removed, placed, x, z);
        }
      }

      const waterY = canonicalWaterLevelAt({ x, z, surface: height });
      if (waterY !== null && waterY > height) {
        waterInstances.push({ x, y: waterY, z, type: "water" });
      }
    }
  }

  for (const [key, type] of placed) {
    if (removed.has(key)) continue;
    const [x, y, z] = parseCellKey(key);
    if (Math.floor(x / chunkSize) !== chunkX || Math.floor(z / chunkSize) !== chunkZ) continue;
    if (isNonSolidVisualType(type)) {
      waterInstances.push({ x, y, z, type });
    } else {
      addVoxel(byType, solidKeys, x, y, z, type, key);
    }
  }

  for (const key of dynamicWater) {
    if (removed.has(key)) continue;
    const [x, y, z] = parseCellKey(key);
    if (Math.floor(x / chunkSize) !== chunkX || Math.floor(z / chunkSize) !== chunkZ) continue;
    waterInstances.push({ x, y, z, type: "water" });
  }

  addRemovedBlockCavityShell({ byType, solidKeys, chunkX, chunkZ, removed, placed });

  const chunkMeshSolidKeys = new Set();
  for (const entries of byType.values()) {
    for (const entry of entries) chunkMeshSolidKeys.add(entry.key);
  }

  const meshes = [];
  const transfer = [];
  for (const [type, entries] of byType) {
    const mesh = createVisibleVoxelMesh(entries, chunkMeshSolidKeys, removed, placed, surfaceAt);
    if (!mesh) continue;
    mesh.type = type;
    meshes.push(mesh);
    transfer.push(mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer);
  }

  const instances = buildWaterInstances(waterInstances);
  for (const item of instances) transfer.push(item.matrices.buffer);

  return {
    chunkX,
    chunkZ,
    detailMode,
    meshes,
    instances,
    solidKeys: retainCollisionKeys ? Array.from(solidKeys) : [],
    transfer,
  };
}

function createAboveSurfaceColumnMap(blocks) {
  const byColumn = new Map();
  for (const block of blocks) {
    let byZ = byColumn.get(block.x);
    if (!byZ) {
      byZ = new Map();
      byColumn.set(block.x, byZ);
    }
    if (!byZ.has(block.z)) byZ.set(block.z, []);
    byZ.get(block.z).push(block);
  }
  return byColumn;
}

function addAboveSurfaceColumnVoxels(aboveSurfaceByColumn, byType, solidKeys, removed, placed, x, z) {
  const blocks = aboveSurfaceByColumn?.get(x)?.get(z);
  if (!blocks?.length) return false;
  let added = false;
  for (const block of blocks) {
    const key = blockKey(block.x, block.y, block.z);
    if (removed.has(key) || (placed.has(key) && !removed.has(key))) continue;
    addVoxel(byType, solidKeys, block.x, block.y, block.z, block.type, key);
    added = true;
  }
  return added;
}

function addVoxel(byType, solidKeys, x, y, z, type, key) {
  if (!type || isNonSolidVisualType(type)) return;
  if (!byType.has(type)) byType.set(type, []);
  byType.get(type).push({ x, y, z, type, key });
  solidKeys.add(key);
}

function addRemovedBlockCavityShell({ byType, solidKeys, chunkX, chunkZ, removed, placed }) {
  if (!removed.size) return;
  const minX = chunkX * chunkSize;
  const maxX = minX + chunkSize - 1;
  const minZ = chunkZ * chunkSize;
  const maxZ = minZ + chunkSize - 1;

  for (const removedKey of removed) {
    const [rx, ry, rz] = parseCellKey(removedKey);
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz)) continue;

    for (const [dx, dy, dz] of cavityNeighborOffsets) {
      const x = rx + dx;
      const y = ry + dy;
      const z = rz + dz;
      if (x < minX || x > maxX || z < minZ || z > maxZ) continue;

      const key = blockKey(x, y, z);
      if (removed.has(key) || placed.has(key) || solidKeys.has(key)) continue;

      const type = canonicalRenderTypeAt({ x, y, z });
      if (!type || isNonSolidVisualType(type)) continue;
      addVoxel(byType, solidKeys, x, y, z, type, key);
    }
  }
}

function buildWaterInstances(waterCells) {
  if (!waterCells.length) return [];
  const byType = new Map();
  for (const cell of waterCells) {
    if (!byType.has(cell.type)) byType.set(cell.type, []);
    byType.get(cell.type).push(cell);
  }
  const out = [];
  for (const [type, cells] of byType) {
    const matrices = new Float32Array(cells.length * 16);
    cells.forEach((cell, index) => writeMatrix(matrices, index * 16, cell.x, cell.y + waterVisualCenterOffset, cell.z, 1, waterVisualHeightScale, 1));
    out.push({ type, matrices, count: cells.length, interactive: false });
  }
  return out;
}

function writeMatrix(out, offset, x, y, z, sx = 1, sy = 1, sz = 1) {
  out[offset + 0] = sx;
  out[offset + 1] = 0;
  out[offset + 2] = 0;
  out[offset + 3] = 0;
  out[offset + 4] = 0;
  out[offset + 5] = sy;
  out[offset + 6] = 0;
  out[offset + 7] = 0;
  out[offset + 8] = 0;
  out[offset + 9] = 0;
  out[offset + 10] = sz;
  out[offset + 11] = 0;
  out[offset + 12] = x;
  out[offset + 13] = y;
  out[offset + 14] = z;
  out[offset + 15] = 1;
}

function createVisibleVoxelMesh(entries, chunkMeshSolidKeys, removed, placed, surfaceAt) {
  const positions = [];
  const normals = [];
  const indices = [];
  const occlusionMemo = new Map();
  const faceGroups = new Map();

  for (const entry of entries) {
    if (removed.has(entry.key)) continue;
    for (let faceIndex = 0; faceIndex < voxelFaces.length; faceIndex += 1) {
      const face = voxelFaces[faceIndex];
      if (isVoxelFaceOccluded(chunkMeshSolidKeys, removed, placed, occlusionMemo, surfaceAt, entry.x + face.dx, entry.y + face.dy, entry.z + face.dz)) continue;
      addGreedyFaceCell(faceGroups, faceIndex, entry.x, entry.y, entry.z);
    }
  }

  for (const group of faceGroups.values()) appendGreedyFaceGroup(group, positions, normals, indices);
  if (!indices.length) return null;
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: indices.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
  };
}

function isVoxelFaceOccluded(chunkMeshSolidKeys, removed, placed, occlusionMemo, surfaceAt, x, y, z) {
  const key = blockKey(x, y, z);
  if (removed.has(key)) return false;
  if (chunkMeshSolidKeys.has(key)) return true;
  const placedType = placed.get(key);
  if (placedType && !isNonSolidVisualType(placedType)) return true;
  if (occlusionMemo.has(key)) return occlusionMemo.get(key);
  const occluded = y <= surfaceAt(x, z);
  occlusionMemo.set(key, occluded);
  return occluded;
}

function createSurfaceReader() {
  const cache = new Map();
  return (x, z) => {
    const cachedByZ = cache.get(x);
    const cached = cachedByZ?.get(z);
    if (cached !== undefined) return cached;
    const height = canonicalSurfaceHeightAt({ x, z });
    if (cachedByZ) {
      cachedByZ.set(z, height);
    } else {
      cache.set(x, new Map([[z, height]]));
    }
    return height;
  };
}

function exposedColumnStart(x, z, height, maxDepth, surfaceAt) {
  const neighborFloor = Math.min(
    surfaceAt(x + 1, z),
    surfaceAt(x - 1, z),
    surfaceAt(x, z + 1),
    surfaceAt(x, z - 1),
    surfaceAt(x + 1, z + 1),
    surfaceAt(x - 1, z - 1),
    surfaceAt(x + 1, z - 1),
    surfaceAt(x - 1, z + 1),
  );
  return Math.max(minBuildY, Math.min(height - maxDepth, neighborFloor + 1));
}

function addGreedyFaceCell(faceGroups, faceIndex, x, y, z) {
  const cell = greedyFaceCell(faceIndex, x, y, z);
  const groupKey = `${faceIndex}:${cell.plane}`;
  let group = faceGroups.get(groupKey);
  if (!group) {
    group = { faceIndex, plane: cell.plane, cellsByV: new Map(), minU: cell.u, maxU: cell.u, minV: cell.v, maxV: cell.v };
    faceGroups.set(groupKey, group);
  }
  addGreedyCell(group, cell.u, cell.v);
  group.minU = Math.min(group.minU, cell.u);
  group.maxU = Math.max(group.maxU, cell.u);
  group.minV = Math.min(group.minV, cell.v);
  group.maxV = Math.max(group.maxV, cell.v);
}

function addGreedyCell(group, u, v) {
  let row = group.cellsByV.get(v);
  if (!row) {
    row = new Set();
    group.cellsByV.set(v, row);
  }
  row.add(u);
}

function hasGreedyCell(group, u, v) {
  return group.cellsByV.get(v)?.has(u) ?? false;
}

function greedyFaceCell(faceIndex, x, y, z) {
  switch (faceIndex) {
    case 0: return { plane: x + cubeHalfSize, u: z, v: y };
    case 1: return { plane: x - cubeHalfSize, u: z, v: y };
    case 2: return { plane: y + cubeHalfSize, u: x, v: z };
    case 3: return { plane: y - cubeHalfSize, u: x, v: z };
    case 4: return { plane: z + cubeHalfSize, u: x, v: y };
    default: return { plane: z - cubeHalfSize, u: x, v: y };
  }
}

function appendGreedyFaceGroup(group, positions, normals, indices) {
  const visitedByV = new Map();
  for (let v = group.minV; v <= group.maxV; v += 1) {
    for (let u = group.minU; u <= group.maxU; u += 1) {
      if (hasVisitedGreedyCell(visitedByV, u, v) || !hasGreedyCell(group, u, v)) continue;
      let width = 1;
      while (hasGreedyCell(group, u + width, v) && !hasVisitedGreedyCell(visitedByV, u + width, v)) width += 1;
      let height = 1;
      growHeight: while (v + height <= group.maxV) {
        for (let dx = 0; dx < width; dx += 1) {
          if (!hasGreedyCell(group, u + dx, v + height) || hasVisitedGreedyCell(visitedByV, u + dx, v + height)) break growHeight;
        }
        height += 1;
      }
      for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) addVisitedGreedyCell(visitedByV, u + dx, v + dy);
      appendGreedyQuad(group.faceIndex, group.plane, u - cubeHalfSize, u + width - cubeHalfSize, v - cubeHalfSize, v + height - cubeHalfSize, positions, normals, indices);
    }
  }
}

function hasVisitedGreedyCell(visitedByV, u, v) {
  return visitedByV.get(v)?.has(u) ?? false;
}

function addVisitedGreedyCell(visitedByV, u, v) {
  let row = visitedByV.get(v);
  if (!row) {
    row = new Set();
    visitedByV.set(v, row);
  }
  row.add(u);
}

function appendGreedyQuad(faceIndex, plane, u0, u1, v0, v1, positions, normals, indices) {
  const face = voxelFaces[faceIndex];
  const corners = greedyQuadCorners(faceIndex, plane, u0, u1, v0, v1);
  const vertexOffset = positions.length / 3;
  for (const corner of corners) {
    positions.push(corner[0], corner[1], corner[2]);
    normals.push(face.normal[0], face.normal[1], face.normal[2]);
  }
  indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);
}

function greedyQuadCorners(faceIndex, plane, u0, u1, v0, v1) {
  switch (faceIndex) {
    case 0: return [[plane, v1, u0], [plane, v1, u1], [plane, v0, u1], [plane, v0, u0]];
    case 1: return [[plane, v1, u1], [plane, v1, u0], [plane, v0, u0], [plane, v0, u1]];
    case 2: return [[u0, plane, v1], [u1, plane, v1], [u1, plane, v0], [u0, plane, v0]];
    case 3: return [[u0, plane, v0], [u1, plane, v0], [u1, plane, v1], [u0, plane, v1]];
    case 4: return [[u1, v1, plane], [u0, v1, plane], [u0, v0, plane], [u1, v0, plane]];
    default: return [[u0, v1, plane], [u1, v1, plane], [u1, v0, plane], [u0, v0, plane]];
  }
}

const voxelFaces = [
  { dx: 1, dy: 0, dz: 0, normal: [1, 0, 0] },
  { dx: -1, dy: 0, dz: 0, normal: [-1, 0, 0] },
  { dx: 0, dy: 1, dz: 0, normal: [0, 1, 0] },
  { dx: 0, dy: -1, dz: 0, normal: [0, -1, 0] },
  { dx: 0, dy: 0, dz: 1, normal: [0, 0, 1] },
  { dx: 0, dy: 0, dz: -1, normal: [0, 0, -1] },
];

function isNonSolidVisualType(type) {
  return type === "water" || type === "swampWater" || type === "toxicWater";
}
