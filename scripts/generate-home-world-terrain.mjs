import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import {
  COASTAL_STAGE_BOUNDS,
  COASTAL_WATER_MARGIN,
  MINING_TARGET,
  PRESENTATION_GROUND_Y,
  PRESENTATION_LANDMASSES,
  PRESENTATION_PLANTS,
  PRESENTATION_RELIEF,
  PRESENTATION_TREES,
  PRESENTATION_WATER_BED_Y,
  PRESENTATION_WATER_Y,
  STRUCTURE_LAYOUT,
  WESTERN_BAY,
} from "../home/home-world-layout.js";

const FORMAT_VERSION = 1;
const HEADER_BYTES = 40;
const CHUNK_SIZE = 16;
const COLUMN_COUNT = CHUNK_SIZE * CHUNK_SIZE;
const MAX_PALETTE_SIZE = 16;
const MAX_RUNS_PER_COLUMN = 15;
const MAX_RUN_LENGTH = 32;
const MAX_ENCODED_Y = 127;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const options = parseArguments(process.argv.slice(2));
const chunkSource = resolve(options.chunkSource || process.env.NICECHUNK_CHUNKJS_SOURCE || resolve(PROJECT_ROOT, "chunk.js"));
const output = resolve(options.output || resolve(PROJECT_ROOT, "public/media/home-world-terrain-v1.bin"));
await assertChunkSource(chunkSource);

const [worldGenerator, blockRegistry, buildingParser] = await Promise.all([
  import(pathToFileURL(resolve(chunkSource, "world/world-generator.js"))),
  import(pathToFileURL(resolve(chunkSource, "world/block-registry.js"))),
  import(pathToFileURL(resolve(chunkSource, "construction/building-parser.js"))),
]);

const { BLOCK_ID } = blockRegistry;
const definitions = await loadStructureDefinitions();
const worldConfig = worldGenerator.createWorldGeneratorConfig({
  worldSeed: worldGenerator.MAINNET_WORLD_SEED,
  generationVersion: worldGenerator.DEFAULT_GENERATION_VERSION,
});
const deltas = createPresentationDeltas({
  BLOCK_ID,
  definitions,
  parseNcm3Building: buildingParser.parseNcm3Building,
  terrainSurfaceHeight: (worldX, worldZ) => worldGenerator.terrainSurfaceHeight(worldConfig, worldX, worldZ),
});
const encoded = encodeTerrain(deltas, {
  generationVersion: worldGenerator.DEFAULT_GENERATION_VERSION,
  fingerprint: layoutFingerprint(worldGenerator, definitions),
});
const compressed = gzipSync(encoded.bytes, { level: 9 });
const compressedOutput = `${output}.gz`;

await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.tmp-${process.pid}`;
const compressedTemporary = `${compressedOutput}.tmp-${process.pid}`;
try {
  await Promise.all([
    writeFile(temporary, encoded.bytes),
    writeFile(compressedTemporary, compressed),
  ]);
  await rename(temporary, output);
  await rename(compressedTemporary, compressedOutput);
} finally {
  await Promise.all([
    rm(temporary, { force: true }),
    rm(compressedTemporary, { force: true }),
  ]);
}

console.log(JSON.stringify({
  output,
  bytes: encoded.bytes.byteLength,
  sha256: createHash("sha256").update(encoded.bytes).digest("hex"),
  compressedOutput,
  compressedBytes: compressed.byteLength,
  compressedSha256: createHash("sha256").update(compressed).digest("hex"),
  chunks: encoded.chunkCount,
  deltas: encoded.deltaCount,
  runs: encoded.runCount,
  palette: encoded.palette,
  fingerprint: encoded.fingerprint,
}, null, 2));

function createPresentationDeltas({ BLOCK_ID: blocks, definitions: structureDefinitions, parseNcm3Building, terrainSurfaceHeight }) {
  const deltas = new Map();
  const surfaceHeights = new Map();
  const surfaceKey = (worldX, worldZ) => `${worldX},${worldZ}`;
  const put = (worldX, worldY, worldZ, blockId) => {
    if (worldX < COASTAL_STAGE_BOUNDS.minX || worldX > COASTAL_STAGE_BOUNDS.maxX
      || worldZ < COASTAL_STAGE_BOUNDS.minZ || worldZ > COASTAL_STAGE_BOUNDS.maxZ) return;
    deltas.set(`${worldX},${worldY},${worldZ}`, { worldX, worldY, worldZ, blockId });
  };
  const addWaterColumn = (x, z) => {
    const sourceY = terrainSurfaceHeight(x, z);
    surfaceHeights.set(surfaceKey(x, z), PRESENTATION_WATER_BED_Y);
    put(x, PRESENTATION_WATER_BED_Y, z, blocks.sand);
    for (let y = PRESENTATION_WATER_BED_Y + 1; y <= PRESENTATION_WATER_Y; y += 1) put(x, y, z, blocks.water);
    for (let y = PRESENTATION_WATER_Y + 1; y <= Math.max(PRESENTATION_WATER_Y + 1, sourceY + 8); y += 1) {
      put(x, y, z, blocks.air);
    }
  };
  const addLandColumn = (x, z, targetY, topBlockId, clearDecorations = true) => {
    const sourceY = terrainSurfaceHeight(x, z);
    surfaceHeights.set(surfaceKey(x, z), targetY);
    for (let y = Math.min(sourceY + 1, targetY); y < targetY; y += 1) put(x, y, z, blocks.dirt);
    put(x, targetY, z, topBlockId);
    const clearTop = clearDecorations ? sourceY + 8 : Math.max(sourceY, targetY);
    for (let y = targetY + 1; y <= clearTop; y += 1) put(x, y, z, blocks.air);
  };

  for (let z = COASTAL_STAGE_BOUNDS.minZ; z <= COASTAL_STAGE_BOUNDS.maxZ; z += 1) {
    for (let x = COASTAL_STAGE_BOUNDS.minX; x <= COASTAL_STAGE_BOUNDS.maxX; x += 1) {
      const landDistance = Math.min(...PRESENTATION_LANDMASSES.map((landmass) => ellipseDistance(x, z, landmass)));
      const riverDistance = presentationRiverDistance(x, z);
      const bayDistance = ellipseDistance(x, z, WESTERN_BAY);
      const edgeDistance = presentationEdgeDistance(x, z);
      if (landDistance > 0 || riverDistance <= 0 || bayDistance <= 0 || edgeDistance <= 0) {
        addWaterColumn(x, z);
        continue;
      }
      const shoreDistance = Math.min(-landDistance, riverDistance, bayDistance, edgeDistance);
      if (shoreDistance <= 4.25) addLandColumn(x, z, PRESENTATION_WATER_Y + 1, blocks.sand);
      else addLandColumn(
        x,
        z,
        PRESENTATION_GROUND_Y + presentationReliefRise(x, z, shoreDistance),
        blocks.grass,
      );
    }
  }

  for (const spec of STRUCTURE_LAYOUT) {
    const definition = structureDefinitions.get(spec.id);
    const building = parseNcm3Building(definition.ncm.code, { id: spec.id });
    const width = spec.quarterTurns % 2 === 0 ? building.size.x : building.size.z;
    const depth = spec.quarterTurns % 2 === 0 ? building.size.z : building.size.x;
    const groundY = spec.surfaceY - 1;
    for (let z = spec.minZ; z < spec.minZ + depth; z += 1) {
      for (let x = spec.minX; x < spec.minX + width; x += 1) {
        const sourceY = terrainSurfaceHeight(x, z);
        if (spec.siteMode === "water") addWaterColumn(x, z);
        else if (spec.siteMode !== "bridge") addLandColumn(x, z, groundY, blocks.grass);
        const clearFromY = spec.siteMode === "water" ? PRESENTATION_WATER_Y + 1 : PRESENTATION_GROUND_Y + 1;
        for (let y = clearFromY; y <= Math.max(sourceY + 14, clearFromY); y += 1) put(x, y, z, blocks.air);
      }
    }
  }

  const miningSurfaceY = surfaceHeights.get(surfaceKey(MINING_TARGET.x, MINING_TARGET.z)) ?? PRESENTATION_GROUND_Y;
  put(MINING_TARGET.x, miningSurfaceY, MINING_TARGET.z, blocks.coal);
  for (const tree of PRESENTATION_TREES) {
    const treeSurfaceY = surfaceHeights.get(surfaceKey(tree.x, tree.z)) ?? PRESENTATION_GROUND_Y;
    const crownY = treeSurfaceY + tree.height;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const distance = Math.abs(dx) + Math.abs(dz) + Math.max(0, Math.abs(dy) - 1);
          if (distance > 4 || (dx === 0 && dz === 0 && dy < 1)) continue;
          put(tree.x + dx, crownY + dy, tree.z + dz, blocks.leaves);
        }
      }
    }
    for (let y = treeSurfaceY + 1; y <= crownY + 1; y += 1) put(tree.x, y, tree.z, blocks.trunk);
  }
  for (const plant of PRESENTATION_PLANTS) {
    const plantSurfaceY = surfaceHeights.get(surfaceKey(plant.x, plant.z)) ?? PRESENTATION_GROUND_Y;
    put(plant.x, plantSurfaceY + 1, plant.z, blocks[plant.block]);
  }
  return Array.from(deltas.values());
}

function encodeTerrain(deltas, { generationVersion, fingerprint }) {
  const minChunkX = Math.floor(COASTAL_STAGE_BOUNDS.minX / CHUNK_SIZE);
  const maxChunkX = Math.floor(COASTAL_STAGE_BOUNDS.maxX / CHUNK_SIZE);
  const minChunkZ = Math.floor(COASTAL_STAGE_BOUNDS.minZ / CHUNK_SIZE);
  const maxChunkZ = Math.floor(COASTAL_STAGE_BOUNDS.maxZ / CHUNK_SIZE);
  const width = maxChunkX - minChunkX + 1;
  const depth = maxChunkZ - minChunkZ + 1;
  const palette = Array.from(new Set(deltas.map((delta) => delta.blockId))).sort((a, b) => a - b);
  if (palette.length > MAX_PALETTE_SIZE || palette.some((blockId) => !Number.isInteger(blockId) || blockId < 0 || blockId > 255)) {
    throw new Error("Homepage terrain palette exceeds the compact format limits.");
  }
  const paletteIndex = new Map(palette.map((blockId, index) => [blockId, index]));
  const chunkColumns = new Map();
  for (const delta of deltas) {
    const chunkX = Math.floor(delta.worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(delta.worldZ / CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    let columns = chunkColumns.get(key);
    if (!columns) {
      columns = Array.from({ length: COLUMN_COUNT }, () => []);
      chunkColumns.set(key, columns);
    }
    const localX = delta.worldX - chunkX * CHUNK_SIZE;
    const localZ = delta.worldZ - chunkZ * CHUNK_SIZE;
    columns[localZ * CHUNK_SIZE + localX].push([delta.worldY, delta.blockId]);
  }

  const chunkBuffers = [];
  let runCount = 0;
  for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      const columns = chunkColumns.get(`${chunkX},${chunkZ}`);
      if (!columns) throw new Error(`Homepage terrain generation missed chunk ${chunkX},${chunkZ}.`);
      const counts = Buffer.alloc(COLUMN_COUNT / 2);
      const tokens = [];
      for (let column = 0; column < columns.length; column += 1) {
        const values = columns[column].sort((a, b) => a[0] - b[0]);
        const runs = splitRuns(values);
        if (runs.length > MAX_RUNS_PER_COLUMN) {
          throw new Error(`Homepage terrain column ${chunkX},${chunkZ}:${column} has too many runs.`);
        }
        if (column & 1) counts[column >>> 1] |= runs.length << 4;
        else counts[column >>> 1] |= runs.length;
        for (const run of runs) {
          const index = paletteIndex.get(run.blockId);
          if (run.startY < 0 || run.startY > MAX_ENCODED_Y || run.length < 1 || run.length > MAX_RUN_LENGTH) {
            throw new Error("Homepage terrain run exceeds the compact coordinate limits.");
          }
          tokens.push((run.startY << 9) | ((run.length - 1) << 4) | index);
        }
      }
      const tokenBytes = Buffer.alloc(tokens.length * 2);
      tokens.forEach((token, index) => tokenBytes.writeUInt16LE(token, index * 2));
      chunkBuffers.push(counts, tokenBytes);
      runCount += tokens.length;
    }
  }

  const header = Buffer.alloc(HEADER_BYTES);
  header.write("NCHT", 0, "ascii");
  header.writeUInt8(FORMAT_VERSION, 4);
  header.writeUInt8(generationVersion, 5);
  header.writeUInt8(CHUNK_SIZE, 6);
  header.writeUInt8(palette.length, 7);
  header.writeInt16LE(minChunkX, 8);
  header.writeInt16LE(minChunkZ, 10);
  header.writeUInt8(width, 12);
  header.writeUInt8(depth, 13);
  header.writeUInt32LE(runCount, 14);
  header.writeUInt32LE(deltas.length, 18);
  Buffer.from(fingerprint, "hex").copy(header, 22, 0, 16);
  const bytes = Buffer.concat([header, Buffer.from(palette), ...chunkBuffers]);
  return {
    bytes,
    chunkCount: width * depth,
    deltaCount: deltas.length,
    runCount,
    palette,
    fingerprint,
  };
}

function splitRuns(values) {
  const combined = [];
  for (const [worldY, blockId] of values) {
    const previous = combined.at(-1);
    if (previous && previous.blockId === blockId && previous.startY + previous.length === worldY) previous.length += 1;
    else combined.push({ startY: worldY, length: 1, blockId });
  }
  const runs = [];
  for (const run of combined) {
    let startY = run.startY;
    let remaining = run.length;
    while (remaining > 0) {
      const length = Math.min(MAX_RUN_LENGTH, remaining);
      runs.push({ startY, length, blockId: run.blockId });
      startY += length;
      remaining -= length;
    }
  }
  return runs;
}

function presentationRiverDistance(x, z) {
  const amount = clamp(
    (z - COASTAL_STAGE_BOUNDS.minZ) / (COASTAL_STAGE_BOUNDS.maxZ - COASTAL_STAGE_BOUNDS.minZ),
    0,
    1,
  );
  const centerX = 2446 + Math.sin(amount * Math.PI * 2) * 4;
  const halfWidth = 8.5 + Math.sin(amount * Math.PI) * 1.5;
  return Math.abs(x - centerX) - halfWidth;
}

function presentationEdgeDistance(x, z) {
  return Math.min(
    x - COASTAL_STAGE_BOUNDS.minX,
    COASTAL_STAGE_BOUNDS.maxX - x,
    z - COASTAL_STAGE_BOUNDS.minZ,
    COASTAL_STAGE_BOUNDS.maxZ - z,
  ) - COASTAL_WATER_MARGIN;
}

function presentationReliefRise(x, z, shoreDistance) {
  const shoreBlend = smoothstep(
    PRESENTATION_RELIEF.shoreFadeStart,
    PRESENTATION_RELIEF.shoreFadeEnd,
    shoreDistance,
  );
  let rise = 0;
  for (const hill of PRESENTATION_RELIEF.hills) {
    const distance = Math.hypot((x - hill.x) / hill.radiusX, (z - hill.z) / hill.radiusZ);
    rise += Math.max(0, 1 - distance) * hill.height;
  }
  const blended = Math.min(PRESENTATION_RELIEF.maxRise, rise * shoreBlend);
  if (blended >= 1.25) return 2;
  if (blended >= 0.35) return 1;
  return 0;
}

function ellipseDistance(x, z, ellipse) {
  const normalized = Math.hypot((x - ellipse.x) / ellipse.radiusX, (z - ellipse.z) / ellipse.radiusZ);
  return (normalized - 1) * Math.min(ellipse.radiusX, ellipse.radiusZ);
}

function layoutFingerprint(worldGenerator, definitions) {
  const payload = {
    formatVersion: FORMAT_VERSION,
    worldSeed: worldGenerator.MAINNET_WORLD_SEED,
    generationVersion: worldGenerator.DEFAULT_GENERATION_VERSION,
    bounds: COASTAL_STAGE_BOUNDS,
    waterMargin: COASTAL_WATER_MARGIN,
    groundY: PRESENTATION_GROUND_Y,
    waterY: PRESENTATION_WATER_Y,
    waterBedY: PRESENTATION_WATER_BED_Y,
    landmasses: PRESENTATION_LANDMASSES,
    relief: PRESENTATION_RELIEF,
    bay: WESTERN_BAY,
    miningTarget: MINING_TARGET,
    trees: PRESENTATION_TREES,
    plants: PRESENTATION_PLANTS,
    structures: STRUCTURE_LAYOUT.map((spec) => ({ ...spec, ncm: definitions.get(spec.id).ncm.code })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

async function loadStructureDefinitions() {
  const definitions = new Map();
  for (const spec of STRUCTURE_LAYOUT) {
    definitions.set(spec.id, JSON.parse(await readFile(resolve(PROJECT_ROOT, spec.definitionPath), "utf8")));
  }
  return definitions;
}

async function assertChunkSource(source) {
  try {
    await Promise.all([
      access(resolve(source, "world/world-generator.js")),
      access(resolve(source, "world/block-registry.js")),
      access(resolve(source, "construction/building-parser.js")),
    ]);
  } catch {
    throw new Error("Chunk.js source is required; pass --chunk-source or NICECHUNK_CHUNKJS_SOURCE.");
  }
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--chunk-source") parsed.chunkSource = args[++index];
    else if (argument === "--output") parsed.output = args[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}
