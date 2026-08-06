const TERRAIN_MAGIC = "NCHT";
const TERRAIN_FORMAT_VERSION = 1;
const TERRAIN_HEADER_BYTES = 40;
const COLUMN_COUNT = 256;
const PACKED_COLUMN_COUNT_BYTES = COLUMN_COUNT / 2;

export const HOME_WORLD_TERRAIN_URL = "/media/home-world-terrain-v1.bin";
export const HOME_WORLD_TERRAIN_COMPRESSED_URL = `${HOME_WORLD_TERRAIN_URL}.gz`;

export function homeBuildAssetUrl(url, buildVersion = currentHomeBuildVersion()) {
  const source = String(url || "");
  const version = String(buildVersion || "").trim();
  if (!version || version.includes("__NICECHUNK_BUILD_VERSION__")) return source;
  return `${source}${source.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

export async function loadHomeWorldTerrain(url = HOME_WORLD_TERRAIN_URL, {
  compressedUrl = url === HOME_WORLD_TERRAIN_URL ? HOME_WORLD_TERRAIN_COMPRESSED_URL : `${url}.gz`,
  signal,
} = {}) {
  if (typeof DecompressionStream === "function") {
    try {
      const response = await fetchTerrain(compressedUrl, signal);
      const compressed = await response.arrayBuffer();
      const stream = new Response(compressed).body.pipeThrough(new DecompressionStream("gzip"));
      const bytes = await new Response(stream).arrayBuffer();
      return withTransferMetadata(decodeHomeWorldTerrain(bytes), "gzip", compressed.byteLength);
    } catch {
      // The uncompressed file preserves support for older browsers and damaged intermediary caches.
    }
  }

  const response = await fetchTerrain(url, signal);
  const bytes = await response.arrayBuffer();
  return withTransferMetadata(decodeHomeWorldTerrain(bytes), "identity", bytes.byteLength);
}

async function fetchTerrain(url, signal) {
  const response = await fetch(homeBuildAssetUrl(url), {
    cache: "force-cache",
    headers: { Accept: "application/octet-stream" },
    signal,
  });
  if (!response.ok) throw new Error(`Unable to load homepage terrain (${response.status}).`);
  if (!response.body) throw new Error("Homepage terrain response has no body.");
  return response;
}

function currentHomeBuildVersion() {
  if (typeof document === "undefined") return "";
  return document.documentElement?.dataset?.i18nBuildVersion || "";
}

export function decodeHomeWorldTerrain(source) {
  const bytes = source instanceof Uint8Array
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
  if (bytes.byteLength < TERRAIN_HEADER_BYTES) throw new Error("Homepage terrain header is truncated.");
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== TERRAIN_MAGIC) throw new Error("Homepage terrain signature is invalid.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formatVersion = view.getUint8(4);
  if (formatVersion !== TERRAIN_FORMAT_VERSION) {
    throw new Error(`Homepage terrain format ${formatVersion} is unsupported.`);
  }

  const generationVersion = view.getUint8(5);
  const chunkSize = view.getUint8(6);
  const paletteLength = view.getUint8(7);
  const minChunkX = view.getInt16(8, true);
  const minChunkZ = view.getInt16(10, true);
  const width = view.getUint8(12);
  const depth = view.getUint8(13);
  const expectedRunCount = view.getUint32(14, true);
  const expectedDeltaCount = view.getUint32(18, true);
  const fingerprint = hex(bytes.subarray(22, 38));
  if (chunkSize !== 16 || !width || !depth || !paletteLength || paletteLength > 16) {
    throw new Error("Homepage terrain dimensions or palette are invalid.");
  }

  let offset = TERRAIN_HEADER_BYTES;
  if (offset + paletteLength > bytes.byteLength) throw new Error("Homepage terrain palette is truncated.");
  const palette = bytes.slice(offset, offset + paletteLength);
  offset += paletteLength;
  const chunks = new Map();
  let runCount = 0;
  let deltaCount = 0;

  for (let chunkZOffset = 0; chunkZOffset < depth; chunkZOffset += 1) {
    for (let chunkXOffset = 0; chunkXOffset < width; chunkXOffset += 1) {
      if (offset + PACKED_COLUMN_COUNT_BYTES > bytes.byteLength) {
        throw new Error("Homepage terrain column table is truncated.");
      }
      const countsOffset = offset;
      let chunkRunCount = 0;
      for (let index = 0; index < PACKED_COLUMN_COUNT_BYTES; index += 1) {
        const packed = bytes[offset + index];
        chunkRunCount += (packed & 0x0f) + (packed >>> 4);
      }
      offset += PACKED_COLUMN_COUNT_BYTES;
      const runsOffset = offset;
      const runBytes = chunkRunCount * 2;
      if (offset + runBytes > bytes.byteLength) throw new Error("Homepage terrain run table is truncated.");
      let chunkDeltaCount = 0;
      for (let index = 0; index < chunkRunCount; index += 1) {
        const token = view.getUint16(offset + index * 2, true);
        const paletteIndex = token & 0x0f;
        if (paletteIndex >= palette.length) throw new Error("Homepage terrain run references an invalid palette entry.");
        chunkDeltaCount += ((token >>> 4) & 0x1f) + 1;
      }
      offset += runBytes;
      const chunkX = minChunkX + chunkXOffset;
      const chunkZ = minChunkZ + chunkZOffset;
      chunks.set(`${chunkX},${chunkZ}`, Object.freeze({
        chunkX,
        chunkZ,
        countsOffset,
        runsOffset,
        runCount: chunkRunCount,
        deltaCount: chunkDeltaCount,
      }));
      runCount += chunkRunCount;
      deltaCount += chunkDeltaCount;
    }
  }

  if (offset !== bytes.byteLength || runCount !== expectedRunCount || deltaCount !== expectedDeltaCount) {
    throw new Error("Homepage terrain totals do not match its header.");
  }
  return Object.freeze({
    formatVersion,
    generationVersion,
    chunkSize,
    minChunkX,
    minChunkZ,
    width,
    depth,
    runCount,
    deltaCount,
    fingerprint,
    palette,
    bytes,
    view,
    chunks,
  });
}

export function unpackHomeWorldTerrainChunk(terrain, chunkX, chunkZ) {
  const entry = terrain?.chunks?.get?.(`${Math.trunc(chunkX)},${Math.trunc(chunkZ)}`);
  if (!entry) return null;
  const output = new Int32Array(entry.deltaCount * 4);
  let outputOffset = 0;
  let runOffset = entry.runsOffset;
  for (let column = 0; column < COLUMN_COUNT; column += 1) {
    const packedCounts = terrain.bytes[entry.countsOffset + (column >>> 1)];
    const count = column & 1 ? packedCounts >>> 4 : packedCounts & 0x0f;
    const localX = column & 15;
    const localZ = column >>> 4;
    const worldX = entry.chunkX * terrain.chunkSize + localX;
    const worldZ = entry.chunkZ * terrain.chunkSize + localZ;
    for (let run = 0; run < count; run += 1) {
      const token = terrain.view.getUint16(runOffset, true);
      runOffset += 2;
      const startY = token >>> 9;
      const length = ((token >>> 4) & 0x1f) + 1;
      const blockId = terrain.palette[token & 0x0f];
      for (let step = 0; step < length; step += 1) {
        output[outputOffset++] = worldX;
        output[outputOffset++] = startY + step;
        output[outputOffset++] = worldZ;
        output[outputOffset++] = blockId;
      }
    }
  }
  if (runOffset !== entry.runsOffset + entry.runCount * 2 || outputOffset !== output.length) {
    throw new Error(`Homepage terrain chunk ${entry.chunkX},${entry.chunkZ} did not decode completely.`);
  }
  return output;
}

export async function applyHomeWorldTerrain(manager, terrain, {
  txId = "homepage-scene-presentation",
  yieldEvery = 8,
  includeChunkIds = null,
  priorityChunkIds = null,
  onProgress = null,
} = {}) {
  const included = includeChunkIds instanceof Set ? includeChunkIds : null;
  const prioritized = priorityChunkIds instanceof Set ? priorityChunkIds : null;
  const distanceFromCenter = (chunk) => Math.max(
    Math.abs(chunk.chunkX - manager.centerChunkX),
    Math.abs(chunk.chunkZ - manager.centerChunkZ),
  );
  const compareChunks = (left, right) => {
    const priorityOrder = prioritized
      ? Number(!prioritized.has(left.id)) - Number(!prioritized.has(right.id))
      : 0;
    return priorityOrder
      || distanceFromCenter(left) - distanceFromCenter(right)
      || left.chunkZ - right.chunkZ
      || left.chunkX - right.chunkX;
  };
  const chunks = Array.from(manager?.chunks?.values?.() ?? [])
    .filter((chunk) => !included || included.has(chunk.id))
    .sort(compareChunks);
  const totalChunks = chunks.length;
  let appliedChunks = 0;
  let appliedDeltas = 0;
  while (chunks.length) {
    // A section change mutates the shared priority set between yields.
    if (prioritized && appliedChunks > 0) chunks.sort(compareChunks);
    const chunk = chunks.shift();
    const packed = unpackHomeWorldTerrainChunk(terrain, chunk.chunkX, chunk.chunkZ);
    if (!packed) throw new Error(`Homepage terrain is missing chunk ${chunk.id}.`);
    const result = chunk.applyPendingDelta(packed, txId);
    if (!result.applied || result.accepted !== packed.length / 4) {
      throw new Error(`Homepage terrain chunk ${chunk.id} was only partially applied.`);
    }
    appliedChunks += 1;
    appliedDeltas += result.accepted;
    onProgress?.({ chunkId: chunk.id, appliedChunks, appliedDeltas, totalChunks });
    if (yieldEvery > 0 && appliedChunks < totalChunks && appliedChunks % yieldEvery === 0) await yieldMainThread();
  }
  return Object.freeze({ appliedChunks, appliedDeltas });
}

function yieldMainThread() {
  if (typeof globalThis.scheduler?.yield === "function") return globalThis.scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function hex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function withTransferMetadata(terrain, transferEncoding, transferBytes) {
  return Object.freeze({ ...terrain, transferEncoding, transferBytes });
}
