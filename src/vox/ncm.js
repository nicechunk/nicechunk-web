const defaultPalette = [
  0x00000000, 0xffffffff, 0xccffff, 0x99ffff, 0x66ffff, 0x33ffff, 0x00ffff, 0xffccff,
  0xccccff, 0x99ccff, 0x66ccff, 0x33ccff, 0x00ccff, 0xff99ff, 0xcc99ff, 0x9999ff,
  0x6699ff, 0x3399ff, 0x0099ff, 0xff66ff, 0xcc66ff, 0x9966ff, 0x6666ff, 0x3366ff,
  0x0066ff, 0xff33ff, 0xcc33ff, 0x9933ff, 0x6633ff, 0x3333ff, 0x0033ff, 0xff00ff,
  0xcc00ff, 0x9900ff, 0x6600ff, 0x3300ff, 0x0000ff, 0xffffcc, 0xccffcc, 0x99ffcc,
  0x66ffcc, 0x33ffcc, 0x00ffcc, 0xffcccc, 0xcccccc, 0x99cccc, 0x66cccc, 0x33cccc,
  0x00cccc, 0xff99cc, 0xcc99cc, 0x9999cc, 0x6699cc, 0x3399cc, 0x0099cc, 0xff66cc,
  0xcc66cc, 0x9966cc, 0x6666cc, 0x3366cc, 0x0066cc, 0xff33cc, 0xcc33cc, 0x9933cc,
  0x6633cc, 0x3333cc, 0x0033cc, 0xff00cc, 0xcc00cc, 0x9900cc, 0x6600cc, 0x3300cc,
  0x0000cc, 0xffff99, 0xccff99, 0x99ff99, 0x66ff99, 0x33ff99, 0x00ff99, 0xffcc99,
  0xcccc99, 0x99cc99, 0x66cc99, 0x33cc99, 0x00cc99, 0xff9999, 0xcc9999, 0x999999,
  0x669999, 0x339999, 0x009999, 0xff6699, 0xcc6699, 0x996699, 0x666699, 0x336699,
  0x006699, 0xff3399, 0xcc3399, 0x993399, 0x663399, 0x333399, 0x003399, 0xff0099,
  0xcc0099, 0x990099, 0x660099, 0x330099, 0x000099, 0xffff66, 0xccff66, 0x99ff66,
  0x66ff66, 0x33ff66, 0x00ff66, 0xffcc66, 0xcccc66, 0x99cc66, 0x66cc66, 0x33cc66,
  0x00cc66, 0xff9966, 0xcc9966, 0x999966, 0x669966, 0x339966, 0x009966, 0xff6666,
  0xcc6666, 0x996666, 0x666666, 0x336666, 0x006666, 0xff3366, 0xcc3366, 0x993366,
  0x663366, 0x333366, 0x003366, 0xff0066, 0xcc0066, 0x990066, 0x660066, 0x330066,
  0x000066, 0xffff33, 0xccff33, 0x99ff33, 0x66ff33, 0x33ff33, 0x00ff33, 0xffcc33,
  0xcccc33, 0x99cc33, 0x66cc33, 0x33cc33, 0x00cc33, 0xff9933, 0xcc9933, 0x999933,
  0x669933, 0x339933, 0x009933, 0xff6633, 0xcc6633, 0x996633, 0x666633, 0x336633,
  0x006633, 0xff3333, 0xcc3333, 0x993333, 0x663333, 0x333333, 0x003333, 0xff0033,
  0xcc0033, 0x990033, 0x660033, 0x330033, 0x000033, 0xffff00, 0xccff00, 0x99ff00,
  0x66ff00, 0x33ff00, 0x00ff00, 0xffcc00, 0xcccc00, 0x99cc00, 0x66cc00, 0x33cc00,
  0x00cc00, 0xff9900, 0xcc9900, 0x999900, 0x669900, 0x339900, 0x009900, 0xff6600,
  0xcc6600, 0x996600, 0x666600, 0x336600, 0x006600, 0xff3300, 0xcc3300, 0x993300,
  0x663300, 0x333300, 0x003300, 0xff0000, 0xcc0000, 0x990000, 0x660000, 0x330000,
  0x0000ee, 0x0000dd, 0x0000bb, 0x0000aa, 0x000088, 0x000077, 0x000055, 0x000044,
  0x000022, 0x000011, 0x00ee00, 0x00dd00, 0x00bb00, 0x00aa00, 0x008800, 0x007700,
  0x005500, 0x004400, 0x002200, 0x001100, 0xee0000, 0xdd0000, 0xbb0000, 0xaa0000,
  0x880000, 0x770000, 0x550000, 0x440000, 0x220000, 0x110000, 0xeeeeee, 0xdddddd,
  0xbbbbbb, 0xaaaaaa, 0x888888, 0x777777, 0x555555, 0x444444, 0x222222, 0x111111,
].map((value) => `#${(value >>> 8).toString(16).padStart(6, "0")}`);

export function parseVox(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readId(bytes, 0) !== "VOX ") throw new Error("Invalid VOX file header.");
  const version = view.getInt32(4, true);
  const models = [];
  let activeModel = null;
  let palette = null;

  function parseChunks(start, end) {
    let offset = start;
    while (offset + 12 <= end) {
      const id = readId(bytes, offset);
      const contentSize = view.getUint32(offset + 4, true);
      const childrenSize = view.getUint32(offset + 8, true);
      const contentStart = offset + 12;
      const contentEnd = contentStart + contentSize;
      const childrenEnd = contentEnd + childrenSize;

      if (id === "SIZE") {
        activeModel = {
          size: {
            x: view.getInt32(contentStart, true),
            y: view.getInt32(contentStart + 4, true),
            z: view.getInt32(contentStart + 8, true),
          },
          voxels: [],
        };
        models.push(activeModel);
      } else if (id === "XYZI") {
        if (!activeModel) {
          activeModel = { size: { x: 0, y: 0, z: 0 }, voxels: [] };
          models.push(activeModel);
        }
        const count = view.getUint32(contentStart, true);
        activeModel.voxels = Array.from({ length: count }, (_, index) => {
          const base = contentStart + 4 + index * 4;
          return { x: bytes[base], y: bytes[base + 1], z: bytes[base + 2], colorIndex: bytes[base + 3] };
        });
      } else if (id === "RGBA") {
        palette = Array.from({ length: 256 }, (_, index) => {
          const base = contentStart + index * 4;
          return rgbToHex(bytes[base], bytes[base + 1], bytes[base + 2]);
        });
      }

      if (childrenSize > 0) parseChunks(contentEnd, childrenEnd);
      offset = childrenEnd;
    }
  }

  parseChunks(8, bytes.byteLength);
  const resolvedPalette = palette ?? defaultPalette;
  return {
    version,
    models: models.map((model) => ({
      ...model,
      voxels: model.voxels.map((voxel) => ({
        ...voxel,
        color: resolvedPalette[Math.max(0, voxel.colorIndex - 1)] ?? "#ffffff",
      })),
    })),
    palette: resolvedPalette,
  };
}

export function voxToNcm(input, options = {}) {
  const vox = parseVox(input);
  const model = vox.models[options.modelIndex ?? 0];
  if (!model) throw new Error("VOX file does not contain a model.");
  const mode = options.mode ?? "merge";
  const targetHeight = Number(options.targetHeight) || 300;
  const scale = Number(options.scale) || Math.max(1, Math.round(targetHeight / Math.max(1, model.size.z)));
  const cuboids = mode === "raw" ? rawVoxelBoxes(model.voxels) : mergeVoxelBoxes(model.voxels);
  const boxes = cuboidsToCharacterBoxes(cuboids, model.size, scale, mode);
  return {
    ncm: encodeNcmVox({ size: model.size, scale, cuboids }),
    character: { v: 1, unit: 100, boxes },
    source: {
      version: vox.version,
      size: model.size,
      voxelCount: model.voxels.length,
      boxCount: boxes.length,
    },
  };
}

export function voxModelToBoxes(model, options = {}) {
  const mode = options.mode ?? "merge";
  const targetHeight = Number(options.targetHeight) || 300;
  const scale = Number(options.scale) || Math.max(1, Math.round(targetHeight / Math.max(1, model.size.z)));
  const sourceBoxes = mode === "raw" ? rawVoxelBoxes(model.voxels) : mergeVoxelBoxes(model.voxels);
  return cuboidsToCharacterBoxes(sourceBoxes, model.size, scale, mode);
}

function cuboidsToCharacterBoxes(sourceBoxes, size, scale, mode = "merge") {
  const centerX = (size.x - 1) / 2;
  const centerY = (size.y - 1) / 2;
  return sourceBoxes.map((part, index) => {
    const minX = part.x;
    const minY = part.y;
    const minZ = part.z;
    const maxX = part.x + part.w - 1;
    const maxY = part.y + part.d - 1;
    const maxZ = part.z + part.h - 1;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    return {
      n: `${mode}_${String(index).padStart(4, "0")}`,
      c: part.color,
      p: [
        Math.round((cx - centerX) * scale),
        Math.round((cz + 0.5) * scale),
        Math.round((centerY - cy) * scale),
      ],
      s: [
        Math.max(1, Math.round(part.w * scale)),
        Math.max(1, Math.round(part.h * scale)),
        Math.max(1, Math.round(part.d * scale)),
      ],
      r: [0, 0, 0],
    };
  });
}

export function encodeNcm(character) {
  const palette = [];
  const paletteIndex = new Map();
  const writer = [];
  writeAscii(writer, "NCM1");
  writeVar(writer, character.boxes.length);
  for (const box of character.boxes) {
    const color = normalizeColor(box.c);
    if (!paletteIndex.has(color)) {
      paletteIndex.set(color, palette.length);
      palette.push(color);
    }
  }
  writeVar(writer, palette.length);
  for (const color of palette) writeRgb(writer, color);
  for (const box of character.boxes) {
    writeVar(writer, paletteIndex.get(normalizeColor(box.c)) ?? 0);
    writeSignedVar(writer, box.p[0]);
    writeSignedVar(writer, box.p[1]);
    writeSignedVar(writer, box.p[2]);
    writeVar(writer, box.s[0]);
    writeVar(writer, box.s[1]);
    writeVar(writer, box.s[2]);
  }
  return `NCM1:${base64UrlEncode(Uint8Array.from(writer))}`;
}

export function decodeNcm(code) {
  const text = String(code ?? "").trim();
  if (/^NCM2:/i.test(text)) return decodeNcmVox(text);
  if (/^[A-Z0-9]+:/i.test(text) && !/^NCM1:/i.test(text)) {
    throw new Error("Unsupported NCM format prefix.");
  }

  const raw = base64UrlDecode(text.replace(/^NCM1:/i, ""));
  const reader = createByteReader(raw);
  const magic = readAscii(reader, 4);
  if (magic !== "NCM1") throw new Error("Invalid NCM header.");
  const count = readVar(reader);
  const paletteCount = readVar(reader);
  const palette = Array.from({ length: paletteCount }, () => rgbToHex(reader.read(), reader.read(), reader.read()));
  const boxes = Array.from({ length: count }, (_, index) => {
    const color = palette[readVar(reader)] ?? "#ffffff";
    return {
      n: `ncm_${String(index).padStart(4, "0")}`,
      c: color,
      p: [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)],
      s: [readVar(reader), readVar(reader), readVar(reader)],
      r: [0, 0, 0],
    };
  });
  return { v: 1, unit: 100, boxes };
}

export const ncmRigBoneIds = [
  "root",
  "hips",
  "torso",
  "chest",
  "neck",
  "head",
  "left_upper_arm",
  "left_lower_arm",
  "left_hand",
  "right_upper_arm",
  "right_lower_arm",
  "right_hand",
  "left_upper_leg",
  "left_lower_leg",
  "left_foot",
  "right_upper_leg",
  "right_lower_leg",
  "right_foot",
  "backpack",
  "accessory",
];

export function encodeNcmRigCharacter({ character, baseCharacter, baseIndex = 0, groups = [], boneIds = ncmRigBoneIds }) {
  const bytes = [];
  writeVar(bytes, 1);
  writeVar(bytes, baseIndex);

  const baseBoxes = baseCharacter?.boxes ?? [];
  const boxes = character?.boxes ?? [];
  const sameBoxCount = baseBoxes.length === boxes.length;
  writeVar(bytes, sameBoxCount ? 0 : 1);

  if (sameBoxCount) {
    const changes = boxes
      .map((part, index) => ({ index, change: diffBox(part, baseBoxes[index]) }))
      .filter((entry) => entry.change.mask !== 0);
    writeVar(bytes, changes.length);
    for (const { index, change } of changes) {
      writeVar(bytes, index);
      writeVar(bytes, change.mask);
      if (change.mask & 1) writeRgb(bytes, change.color);
      if (change.mask & 2) change.position.forEach((value) => writeSignedVar(bytes, value));
      if (change.mask & 4) change.size.forEach((value) => writeVar(bytes, value));
      if (change.mask & 8) change.rotation.forEach((value) => writeSignedVar(bytes, value));
      if (change.mask & 16) writeTinyString(bytes, change.name);
    }
  } else {
    writeVar(bytes, boxes.length);
    const palette = [];
    const paletteIndex = new Map();
    for (const part of boxes) {
      const color = normalizeColor(part.c);
      if (!paletteIndex.has(color)) {
        paletteIndex.set(color, palette.length);
        palette.push(color);
      }
    }
    writeVar(bytes, palette.length);
    for (const color of palette) writeRgb(bytes, color);
    for (const part of boxes) {
      writeTinyString(bytes, part.n || "");
      writeVar(bytes, paletteIndex.get(normalizeColor(part.c)) ?? 0);
      part.p.forEach((value) => writeSignedVar(bytes, value));
      part.s.forEach((value) => writeVar(bytes, value));
      part.r.forEach((value) => writeSignedVar(bytes, value));
    }
  }

  const normalizedGroups = normalizeRigGroups(groups, boxes.length, boneIds);
  writeVar(bytes, normalizedGroups.length);
  for (const group of normalizedGroups) {
    writeVar(bytes, Math.max(0, boneIds.indexOf(group.bone)));
    writeTinyString(bytes, group.name || group.bone || "");
    group.pivot.forEach((value) => writeSignedVar(bytes, value));
    writeVar(bytes, group.parts.length);
    let previous = 0;
    for (const index of group.parts) {
      writeVar(bytes, index - previous);
      previous = index;
    }
  }

  return `NCR1:${base64UrlEncode(Uint8Array.from(bytes))}`;
}

export function decodeNcmRigCharacter(code, baseCharacters = [], boneIds = ncmRigBoneIds) {
  const raw = base64UrlDecode(String(code).replace(/^NCR1:/i, ""));
  const reader = createByteReader(raw);
  const version = readVar(reader);
  if (version !== 1) throw new Error("Unsupported NCR version.");
  const baseIndex = readVar(reader);
  const baseCharacter = baseCharacters[baseIndex] ?? { v: 1, unit: 100, boxes: [] };
  const mode = readVar(reader);
  let boxes = (baseCharacter.boxes ?? []).map((part) => structuredClonePart(part));

  if (mode === 0) {
    const changes = readVar(reader);
    for (let index = 0; index < changes; index++) {
      const partIndex = readVar(reader);
      const mask = readVar(reader);
      boxes[partIndex] ??= { n: `part_${partIndex}`, c: "#ffffff", p: [0, 0, 0], s: [1, 1, 1], r: [0, 0, 0] };
      if (mask & 1) boxes[partIndex].c = rgbToHex(reader.read(), reader.read(), reader.read());
      if (mask & 2) boxes[partIndex].p = [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)];
      if (mask & 4) boxes[partIndex].s = [readVar(reader), readVar(reader), readVar(reader)];
      if (mask & 8) boxes[partIndex].r = [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)];
      if (mask & 16) boxes[partIndex].n = readTinyString(reader);
    }
  } else {
    const count = readVar(reader);
    const paletteCount = readVar(reader);
    const palette = Array.from({ length: paletteCount }, () => rgbToHex(reader.read(), reader.read(), reader.read()));
    boxes = Array.from({ length: count }, () => ({
      n: readTinyString(reader),
      c: palette[readVar(reader)] ?? "#ffffff",
      p: [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)],
      s: [readVar(reader), readVar(reader), readVar(reader)],
      r: [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)],
    }));
  }

  const groupCount = readVar(reader);
  const groups = Array.from({ length: groupCount }, () => {
    const bone = boneIds[readVar(reader)] ?? "root";
    const name = readTinyString(reader);
    const pivot = [readSignedVar(reader), readSignedVar(reader), readSignedVar(reader)];
    const partCount = readVar(reader);
    const parts = [];
    let previous = 0;
    for (let index = 0; index < partCount; index++) {
      previous += readVar(reader);
      parts.push(previous);
    }
    return { name, bone, pivot, parts };
  });

  return { v: 1, unit: baseCharacter.unit ?? 100, boxes, rig: { baseIndex, groups } };
}

function diffBox(part, basePart) {
  let mask = 0;
  const color = normalizeColor(part?.c);
  const position = (part?.p ?? [0, 0, 0]).map(Math.round);
  const size = (part?.s ?? [1, 1, 1]).map((value) => Math.max(1, Math.round(value)));
  const rotation = (part?.r ?? [0, 0, 0]).map(Math.round);
  const name = String(part?.n ?? "");
  if (normalizeColor(basePart?.c) !== color) mask |= 1;
  if (!sameArray(position, basePart?.p ?? [])) mask |= 2;
  if (!sameArray(size, basePart?.s ?? [])) mask |= 4;
  if (!sameArray(rotation, basePart?.r ?? [])) mask |= 8;
  if (String(basePart?.n ?? "") !== name) mask |= 16;
  return { mask, color, position, size, rotation, name };
}

function normalizeRigGroups(groups, maxParts, boneIds) {
  return (groups ?? [])
    .map((group) => ({
      name: String(group.name || group.bone || "group").slice(0, 48),
      bone: boneIds.includes(group.bone) ? group.bone : "root",
      pivot: (group.pivot ?? [0, 0, 0]).map((value) => Math.round(value)),
      parts: [...new Set(group.parts ?? [])]
        .map((value) => Math.round(value))
        .filter((value) => value >= 0 && value < maxParts)
        .sort((a, b) => a - b),
    }))
    .filter((group) => group.parts.length);
}

function structuredClonePart(part) {
  return {
    n: part.n,
    c: part.c,
    p: [...part.p],
    s: [...part.s],
    r: [...(part.r ?? [0, 0, 0])],
  };
}

function sameArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function encodeNcmVox({ size, scale, cuboids }) {
  const palette = [];
  const paletteIndex = new Map();
  for (const cuboid of cuboids) {
    const color = normalizeColor(cuboid.color);
    if (!paletteIndex.has(color)) {
      paletteIndex.set(color, palette.length);
      palette.push(color);
    }
  }

  const bytes = [];
  writeVar(bytes, size.x);
  writeVar(bytes, size.y);
  writeVar(bytes, size.z);
  writeVar(bytes, scale);
  writeVar(bytes, cuboids.length);
  writeVar(bytes, palette.length);
  for (const color of palette) writeRgb(bytes, color);

  const bitWriter = createBitWriter();
  const colorBits = bitWidth(Math.max(0, palette.length - 1));
  const xBits = bitWidth(Math.max(0, size.x - 1));
  const yBits = bitWidth(Math.max(0, size.y - 1));
  const zBits = bitWidth(Math.max(0, size.z - 1));
  for (const cuboid of cuboids) {
    bitWriter.write(paletteIndex.get(normalizeColor(cuboid.color)) ?? 0, colorBits);
    bitWriter.write(cuboid.x, xBits);
    bitWriter.write(cuboid.y, yBits);
    bitWriter.write(cuboid.z, zBits);
    bitWriter.write(Math.max(0, cuboid.w - 1), xBits);
    bitWriter.write(Math.max(0, cuboid.h - 1), zBits);
    bitWriter.write(Math.max(0, cuboid.d - 1), yBits);
  }

  bytes.push(...bitWriter.finish());
  return `NCM2:${base64UrlEncode(Uint8Array.from(bytes))}`;
}

function decodeNcmVox(code) {
  const raw = base64UrlDecode(String(code).replace(/^NCM2:/i, ""));
  const reader = createByteReader(raw);
  const size = { x: readVar(reader), y: readVar(reader), z: readVar(reader) };
  const scale = readVar(reader);
  const count = readVar(reader);
  const paletteCount = readVar(reader);
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error("Invalid NCM2 model size.");
  if (scale <= 0) throw new Error("Invalid NCM2 scale.");
  if (paletteCount <= 0) throw new Error("Invalid NCM2 palette.");
  const palette = Array.from({ length: paletteCount }, () => rgbToHex(reader.read(), reader.read(), reader.read()));
  const bitReader = createBitReader(raw, reader.offset());
  const colorBits = bitWidth(Math.max(0, palette.length - 1));
  const xBits = bitWidth(Math.max(0, size.x - 1));
  const yBits = bitWidth(Math.max(0, size.y - 1));
  const zBits = bitWidth(Math.max(0, size.z - 1));
  const cuboids = Array.from({ length: count }, () => {
    const color = palette[bitReader.read(colorBits)] ?? "#ffffff";
    return {
      color,
      x: bitReader.read(xBits),
      y: bitReader.read(yBits),
      z: bitReader.read(zBits),
      w: bitReader.read(xBits) + 1,
      h: bitReader.read(zBits) + 1,
      d: bitReader.read(yBits) + 1,
    };
  });
  return { v: 1, unit: 100, boxes: cuboidsToCharacterBoxes(cuboids, size, scale, "ncm") };
}

function rawVoxelBoxes(voxels) {
  return voxels.map((voxel) => ({ x: voxel.x, y: voxel.y, z: voxel.z, w: 1, h: 1, d: 1, color: voxel.color }));
}

function mergeVoxelBoxes(voxels) {
  const occupied = new Map();
  const visited = new Set();
  for (const voxel of voxels) occupied.set(voxelKey(voxel.x, voxel.y, voxel.z), voxel.color);
  const sorted = [...voxels].sort((a, b) => a.color.localeCompare(b.color) || a.z - b.z || a.y - b.y || a.x - b.x);
  const boxes = [];
  for (const voxel of sorted) {
    const startKey = voxelKey(voxel.x, voxel.y, voxel.z);
    if (visited.has(startKey)) continue;
    const color = voxel.color;
    let w = 1;
    while (hasRect(occupied, visited, color, voxel.x, voxel.y, voxel.z, w + 1, 1, 1)) w++;
    let d = 1;
    while (hasRect(occupied, visited, color, voxel.x, voxel.y, voxel.z, w, 1, d + 1)) d++;
    let h = 1;
    while (hasRect(occupied, visited, color, voxel.x, voxel.y, voxel.z, w, h + 1, d)) h++;
    markRect(visited, voxel.x, voxel.y, voxel.z, w, h, d);
    boxes.push({ x: voxel.x, y: voxel.y, z: voxel.z, w, h, d, color });
  }
  return boxes;
}

function hasRect(occupied, visited, color, x, y, z, w, h, d) {
  for (let dz = 0; dz < h; dz++) {
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const key = voxelKey(x + dx, y + dy, z + dz);
        if (visited.has(key) || occupied.get(key) !== color) return false;
      }
    }
  }
  return true;
}

function markRect(visited, x, y, z, w, h, d) {
  for (let dz = 0; dz < h; dz++) {
    for (let dy = 0; dy < d; dy++) {
      for (let dx = 0; dx < w; dx++) visited.add(voxelKey(x + dx, y + dy, z + dz));
    }
  }
}

function voxelKey(x, y, z) {
  return `${x},${y},${z}`;
}

function readId(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function writeAscii(bytes, value) {
  for (let index = 0; index < value.length; index++) bytes.push(value.charCodeAt(index));
}

function readAscii(reader, length) {
  let text = "";
  for (let index = 0; index < length; index++) text += String.fromCharCode(reader.read());
  return text;
}

function writeRgb(bytes, color) {
  const normalized = normalizeColor(color);
  bytes.push(parseInt(normalized.slice(1, 3), 16), parseInt(normalized.slice(3, 5), 16), parseInt(normalized.slice(5, 7), 16));
}

function rgbToHex(r, g, b) {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function normalizeColor(color) {
  const value = String(color || "#ffffff").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : "#ffffff";
}

function writeVar(bytes, value) {
  let next = Math.max(0, Math.round(value));
  while (next > 127) {
    bytes.push((next & 127) | 128);
    next = Math.floor(next / 128);
  }
  bytes.push(next);
}

function readVar(reader) {
  let value = 0;
  let shift = 0;
  while (true) {
    const byte = reader.read();
    value |= (byte & 127) << shift;
    if ((byte & 128) === 0) return value;
    shift += 7;
  }
}

function writeSignedVar(bytes, value) {
  const next = Math.round(value);
  writeVar(bytes, next < 0 ? Math.abs(next) * 2 - 1 : next * 2);
}

function readSignedVar(reader) {
  const value = readVar(reader);
  return value & 1 ? -((value + 1) / 2) : value / 2;
}

function writeTinyString(bytes, value) {
  const raw = new TextEncoder().encode(String(value ?? ""));
  writeVar(bytes, raw.length);
  bytes.push(...raw);
}

function readTinyString(reader) {
  const length = readVar(reader);
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index++) bytes[index] = reader.read();
  return new TextDecoder().decode(bytes);
}

function bitWidth(maxValue) {
  return Math.max(1, Math.floor(Math.log2(Math.max(0, maxValue))) + 1);
}

function createBitWriter() {
  const bytes = [];
  let current = 0;
  let used = 0;
  return {
    write(value, bits) {
      const safe = Math.max(0, Math.round(value));
      for (let bit = 0; bit < bits; bit++) {
        current |= ((safe >> bit) & 1) << used;
        used++;
        if (used !== 8) continue;
        bytes.push(current);
        current = 0;
        used = 0;
      }
    },
    finish() {
      if (used) bytes.push(current);
      return bytes;
    },
  };
}

function createBitReader(raw, startOffset = 0) {
  let byteIndex = startOffset;
  let used = 0;
  return {
    read(bits) {
      let value = 0;
      for (let bit = 0; bit < bits; bit++) {
        if (byteIndex >= raw.length) throw new Error("Unexpected end of NCM bitstream.");
        value |= ((raw[byteIndex] >> used) & 1) << bit;
        used++;
        if (used !== 8) continue;
        byteIndex++;
        used = 0;
      }
      return value;
    },
  };
}

function createByteReader(raw) {
  let offset = 0;
  return {
    read() {
      if (offset >= raw.length) throw new Error("Unexpected end of NCM data.");
      return raw[offset++];
    },
    offset() {
      return offset;
    },
  };
}

function base64UrlEncode(raw) {
  if (typeof Buffer !== "undefined") return Buffer.from(raw).toString("base64url");
  let binary = "";
  raw.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(text) {
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(text, "base64url"));
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
