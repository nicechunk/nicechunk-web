export function appendGreedyVoxelGeometry({
  grid,
  dims,
  solid,
  offset = zeroOffset,
  color = null,
  faceColor = null,
  positions,
  normals,
  colors = null,
}) {
  const gridSize = [grid.x, grid.y, grid.z];
  const dimsSize = [dims.x, dims.y, dims.z];
  const offsetValues = [offset.x ?? 0, offset.y ?? 0, offset.z ?? 0];
  const usesFaceColors = typeof faceColor === "function";
  const defaultColorEntry = usesFaceColors ? colorEntryFor(color) : null;
  for (let axis = 0; axis < 3; axis++) {
    const tangentAxes = [0, 1, 2].filter((item) => item !== axis);
    const uAxis = tangentAxes[0];
    const vAxis = tangentAxes[1];
    const width = gridSize[uAxis];
    const height = gridSize[vAxis];
    for (const side of [1, -1]) {
      for (let layer = 0; layer < gridSize[axis]; layer++) {
        const mask = usesFaceColors ? new Array(width * height) : new Uint8Array(width * height);
        for (let v = 0; v < height; v++) {
          for (let u = 0; u < width; u++) {
            const cell = [0, 0, 0];
            cell[axis] = layer;
            cell[uAxis] = u;
            cell[vAxis] = v;
            if (!solidCellValue(solid, grid, cell[0], cell[1], cell[2])) continue;
            const neighbor = [...cell];
            neighbor[axis] += side;
            if (solidCellValue(solid, grid, neighbor[0], neighbor[1], neighbor[2])) continue;
            mask[u + width * v] = usesFaceColors
              ? colorEntryFor(faceColor({
                  axis,
                  side: side > 0 ? 1 : 0,
                  sign: side,
                  layer,
                  cell,
                  u,
                  v,
                }), defaultColorEntry)
              : 1;
          }
        }
        const options = {
          mask,
          width,
          height,
          axis,
          side,
          layer,
          uAxis,
          vAxis,
          gridSize,
          dimsSize,
          offsetValues,
          positions,
          normals,
          colors,
        };
        if (usesFaceColors) appendGreedyColorMaskFaces(options);
        else appendGreedyBinaryMaskFaces({ ...options, color });
      }
    }
  }
}

export function appendSolidCuboidGeometry({ dims, offset = zeroOffset, color, positions, normals, colors }) {
  const x0 = offset.x - dims.x * 0.5;
  const x1 = offset.x + dims.x * 0.5;
  const y0 = offset.y - dims.y * 0.5;
  const y1 = offset.y + dims.y * 0.5;
  const z0 = offset.z - dims.z * 0.5;
  const z1 = offset.z + dims.z * 0.5;
  const faces = [
    { n: [1, 0, 0], c: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { n: [-1, 0, 0], c: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]] },
    { n: [0, 1, 0], c: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]] },
    { n: [0, -1, 0], c: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { n: [0, 0, 1], c: [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]] },
    { n: [0, 0, -1], c: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]] },
  ];
  for (const face of faces) pushMeshFace({ positions, normals, colors, corners: face.c, normal: face.n, color });
}

const zeroOffset = { x: 0, y: 0, z: 0 };

function appendGreedyBinaryMaskFaces(options) {
  const { mask, width, height } = options;
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const index = u + width * v;
      if (!mask[index]) continue;
      let rectWidth = 1;
      while (u + rectWidth < width && mask[u + rectWidth + width * v]) rectWidth++;
      let rectHeight = 1;
      scanHeight:
      while (v + rectHeight < height) {
        for (let offsetU = 0; offsetU < rectWidth; offsetU++) {
          if (!mask[u + offsetU + width * (v + rectHeight)]) break scanHeight;
        }
        rectHeight++;
      }
      for (let y = 0; y < rectHeight; y++) {
        for (let x = 0; x < rectWidth; x++) mask[u + x + width * (v + y)] = 0;
      }
      appendGreedyFace(options, u, v, rectWidth, rectHeight);
    }
  }
}

function appendGreedyColorMaskFaces(options) {
  const { mask, width, height } = options;
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const index = u + width * v;
      const value = mask[index];
      if (!value) continue;
      let rectWidth = 1;
      while (u + rectWidth < width && sameColorEntry(mask[u + rectWidth + width * v], value)) rectWidth++;
      let rectHeight = 1;
      scanHeight:
      while (v + rectHeight < height) {
        for (let offsetU = 0; offsetU < rectWidth; offsetU++) {
          if (!sameColorEntry(mask[u + offsetU + width * (v + rectHeight)], value)) break scanHeight;
        }
        rectHeight++;
      }
      for (let y = 0; y < rectHeight; y++) {
        for (let x = 0; x < rectWidth; x++) mask[u + x + width * (v + y)] = 0;
      }
      appendGreedyFace({ ...options, color: value.color }, u, v, rectWidth, rectHeight);
    }
  }
}

function appendGreedyFace(options, u, v, width, height) {
  const { axis, side, layer, uAxis, vAxis, gridSize, dimsSize, offsetValues, color, positions, normals, colors } = options;
  const min = [0, 0, 0];
  const max = [0, 0, 0];
  const plane = layer + (side > 0 ? 1 : 0);
  min[axis] = plane;
  max[axis] = plane;
  min[uAxis] = u;
  max[uAxis] = u + width;
  min[vAxis] = v;
  max[vAxis] = v + height;
  const bounds = coordinateBoundsForGridRect(min, max, gridSize, dimsSize, offsetValues);
  const normal = [0, 0, 0];
  normal[axis] = side;
  pushMeshFace({
    positions,
    normals,
    colors,
    corners: greedyFaceCorners(axis, side, bounds),
    normal,
    color,
  });
}

function coordinateBoundsForGridRect(min, max, gridSize, dimsSize, offsetValues) {
  const values = [];
  for (let axis = 0; axis < 3; axis++) {
    const origin = offsetValues[axis] - dimsSize[axis] * 0.5;
    const scale = dimsSize[axis] / gridSize[axis];
    values.push(origin + min[axis] * scale, origin + max[axis] * scale);
  }
  return { x0: values[0], x1: values[1], y0: values[2], y1: values[3], z0: values[4], z1: values[5] };
}

function greedyFaceCorners(axis, side, b) {
  if (axis === 0 && side > 0) return [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]];
  if (axis === 0) return [[b.x0, b.y0, b.z1], [b.x0, b.y1, b.z1], [b.x0, b.y1, b.z0], [b.x0, b.y0, b.z0]];
  if (axis === 1 && side > 0) return [[b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0]];
  if (axis === 1) return [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]];
  if (side > 0) return [[b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]];
  return [[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y0, b.z0]];
}

function solidCellValue(solid, grid, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= grid.x || y >= grid.y || z >= grid.z) return false;
  return solid[voxelIndex(grid, x, y, z)] === 1;
}

function voxelIndex(grid, x, y, z) {
  return x + grid.x * (y + grid.y * z);
}

function colorEntryFor(value, fallback = null) {
  if (!value) return fallback ?? { key: "none", color: null };
  const color = value.color ?? value;
  const r = Math.round((color.r ?? 1) * 255);
  const g = Math.round((color.g ?? 1) * 255);
  const b = Math.round((color.b ?? 1) * 255);
  return {
    key: value.key ?? `${r},${g},${b}`,
    color,
  };
}

function sameColorEntry(a, b) {
  return Boolean(a && b && a.key === b.key);
}

function pushMeshFace({ positions, normals, colors = null, corners, normal, color = null }) {
  const order = [0, 1, 2, 0, 2, 3];
  for (const index of order) {
    positions.push(...corners[index]);
    normals.push(...normal);
    if (colors && color) colors.push(color.r, color.g, color.b);
  }
}
