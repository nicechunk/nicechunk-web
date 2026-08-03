import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  decodeHomeWorldTerrain,
  unpackHomeWorldTerrainChunk,
} from "../home/home-world-terrain.js";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArguments(process.argv.slice(2));
const sourcePath = resolve(options.input || resolve(PROJECT_ROOT, "public/media/home-world-terrain-v1.bin"));
const bundlePath = resolve(options.bundle || resolve(PROJECT_ROOT, "public/media/home-world-terrain-ncm4-v1.ncm4b"));
const reportPath = resolve(options.report || resolve(PROJECT_ROOT, "public/media/home-world-terrain-ncm4-v1-report.json"));
const minerPath = await resolveMiner(options.miner || process.env.NICECHUNK_MINER_BIN);
const workspace = await mkdtemp(resolve(tmpdir(), "nicechunk-home-ncm4-"));

try {
  const sourceBytes = await readFile(sourcePath);
  const terrain = decodeHomeWorldTerrain(sourceBytes);
  const chunks = [...terrain.chunks.values()].sort(compareChunks);
  const bounds = findVerticalBounds(terrain, chunks);
  const records = [];

  for (const [index, chunk] of chunks.entries()) {
    const deltas = unpackHomeWorldTerrainChunk(terrain, chunk.chunkX, chunk.chunkZ);
    const runs = terrainRuns(deltas, chunk, bounds.minY);
    const ncm3Bytes = encodeNcm3Projection(runs, bounds.height);
    const stem = `${String(index).padStart(3, "0")}-${chunk.chunkX}-${chunk.chunkZ}`;
    const source = resolve(workspace, `${stem}.ncm3`);
    const candidate = resolve(workspace, `${stem}.nc4p`);
    await writeFile(source, ncm3Bytes);

    const encoded = runMiner([
      "--json", "ncm4", "encode", source,
      "--profile", "building",
      "--out", candidate,
    ]);
    const verified = runMiner([
      "--json", "ncm4", "verify",
      "--source", source,
      "--candidate", candidate,
      "--profile", "building",
    ]);
    if (!verified.exact || verified.mismatchCount !== 0) {
      throw new Error(`NCM4 verification mismatch for homepage chunk ${chunk.chunkX},${chunk.chunkZ}.`);
    }

    const candidateBytes = await readFile(candidate);
    records.push(Object.freeze({
      chunkX: chunk.chunkX,
      chunkZ: chunk.chunkZ,
      deltaCount: deltas.length / 4,
      runCount: runs.length,
      ncm3Bytes: ncm3Bytes.length,
      ncm4Bytes: candidateBytes.length,
      semanticRoot: verified.targetSemanticRoot,
      encodingHash: verified.candidateEncodingHash,
      exact: verified.exact,
      mismatchCount: verified.mismatchCount,
      acceptedAgainstNcm3: verified.accepted,
      candidateBytes,
      fixedHeaderBytes: encoded.fixedHeaderBytes,
      profileHeaderBytes: encoded.profileHeaderBytes,
      bodyBytes: encoded.bodyBytes,
      residualBytes: encoded.residualBytes,
    }));
  }

  const bundleBytes = encodeBundle(records, bounds.minY, bounds.height);
  verifyBundle(bundleBytes, records, bounds.minY, bounds.height);
  const report = createReport({
    terrain,
    sourceBytes,
    bundleBytes,
    records,
    bounds,
    minerVersion: runMinerVersion(),
  });

  await Promise.all([
    writeAtomic(bundlePath, bundleBytes),
    writeAtomic(reportPath, Buffer.from(`${JSON.stringify(report, null, 2)}\n`)),
  ]);
  console.log(JSON.stringify({ bundle: bundlePath, report: reportPath, ...report.summary }, null, 2));
} finally {
  await rm(workspace, { recursive: true, force: true });
}

function createReport({ terrain, sourceBytes, bundleBytes, records, bounds, minerVersion }) {
  const ncm3Bytes = sum(records, "ncm3Bytes");
  const ncm4Bytes = sum(records, "ncm4Bytes");
  const mappedDeltas = sum(records, "deltaCount");
  const mappedRuns = sum(records, "runCount");
  const exactChunks = records.filter((record) => record.exact && record.mismatchCount === 0).length;
  const aggregateSemanticRoot = aggregateRoot(records);
  const largerBytesAgainstNcht = ncm4Bytes - sourceBytes.length;
  const selectedRepresentation = ncm4Bytes < sourceBytes.length ? "ncm4-projection" : "NCHT-v1";
  const summary = Object.freeze({
    sourceBytes: sourceBytes.length,
    sourceGzipBytes: gzipSync(sourceBytes, { level: 9 }).length,
    genericNcm3Bytes: ncm3Bytes,
    ncm4RecordBytes: ncm4Bytes,
    bundleBytes: bundleBytes.length,
    bundleGzipBytes: gzipSync(bundleBytes, { level: 9 }).length,
    ncm4SavedBytesAgainstNcm3: ncm3Bytes - ncm4Bytes,
    ncm4SavedPercentAgainstNcm3: percent(ncm3Bytes - ncm4Bytes, ncm3Bytes),
    ncm4LargerBytesAgainstNcht: largerBytesAgainstNcht,
    ncm4LargerPercentAgainstNcht: percent(largerBytesAgainstNcht, sourceBytes.length),
    exactChunks,
    chunkCount: records.length,
    mismatchCount: records.reduce((total, record) => total + record.mismatchCount, 0),
    mappedDeltas,
    mappedRuns,
    selectedRepresentation,
    aggregateSemanticRoot,
  });

  if (mappedDeltas !== terrain.deltaCount || mappedRuns !== terrain.runCount || exactChunks !== records.length) {
    throw new Error("NCM4 homepage benchmark did not preserve every source delta and run.");
  }

  return Object.freeze({
    schema: "nicechunk.home.terrain-ncm4-research.v1",
    source: Object.freeze({
      format: "NCHT-v1",
      bytes: sourceBytes.length,
      gzipBytes: summary.sourceGzipBytes,
      sha256: sha256(sourceBytes),
      fingerprint: terrain.fingerprint,
      chunks: terrain.chunks.size,
      deltas: terrain.deltaCount,
      runs: terrain.runCount,
      palette: Array.from(terrain.palette),
      bounds: Object.freeze({ minY: bounds.minY, maxY: bounds.maxY }),
    }),
    projection: Object.freeze({
      format: "NCM4B-v1",
      ncm4Format: "ncm4-pouw-v1",
      profile: "building",
      mapping: "Each source blockId is stored as material blockId + 1, preserving explicit air clears as material 1.",
      minerVersion,
      bundleSha256: sha256(bundleBytes),
      ...summary,
    }),
    decision: Object.freeze({
      accepted: selectedRepresentation === "ncm4-projection",
      selectedRepresentation,
      reason: selectedRepresentation === "ncm4-projection"
        ? "The candidate is exact and smaller than the incumbent."
        : "The candidate is exact but larger than the incumbent, so PoUW retains NCHT-v1.",
    }),
    caveat: "This is a reversible research projection of homepage material deltas into standard NCM4 building records, not the current ChunkBroken-only NCM4 terrain profile.",
    summary,
    chunks: records.map(({ candidateBytes, ...record }) => record),
  });
}

function findVerticalBounds(terrain, chunks) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const chunk of chunks) {
    const deltas = unpackHomeWorldTerrainChunk(terrain, chunk.chunkX, chunk.chunkZ);
    for (let offset = 0; offset < deltas.length; offset += 4) {
      minY = Math.min(minY, deltas[offset + 1]);
      maxY = Math.max(maxY, deltas[offset + 1]);
    }
  }
  if (!Number.isInteger(minY) || !Number.isInteger(maxY) || minY > maxY) {
    throw new Error("Homepage terrain has no benchmarkable deltas.");
  }
  return Object.freeze({ minY, maxY, height: maxY - minY + 1 });
}

function terrainRuns(deltas, chunk, minY) {
  const columns = Array.from({ length: 16 * 16 }, () => []);
  for (let offset = 0; offset < deltas.length; offset += 4) {
    const localX = deltas[offset] - chunk.chunkX * 16;
    const localY = deltas[offset + 1] - minY;
    const localZ = deltas[offset + 2] - chunk.chunkZ * 16;
    const material = deltas[offset + 3] + 1;
    columns[localZ * 16 + localX].push({ localX, localY, localZ, material });
  }

  const runs = [];
  for (const column of columns) {
    column.sort((left, right) => left.localY - right.localY);
    let active = null;
    for (const voxel of column) {
      if (active && active.material === voxel.material && active.localY + active.length === voxel.localY) {
        active.length += 1;
      } else {
        if (active) runs.push(active);
        active = { ...voxel, length: 1 };
      }
    }
    if (active) runs.push(active);
  }
  return runs;
}

function encodeNcm3Projection(runs, height) {
  const parts = [Buffer.from([1]), varint(16), varint(height), varint(16), varint(runs.length)];
  for (const run of runs) {
    parts.push(
      Buffer.from([1]),
      varint(run.material),
      varint(run.localX),
      varint(run.localY),
      varint(run.localZ),
      varint(0),
      varint(run.length - 1),
      varint(0),
    );
  }
  return Buffer.concat(parts);
}

function encodeBundle(records, minY, height) {
  const parts = [Buffer.from("NC4B"), Buffer.from([1]), u16(records.length), i16(minY), Buffer.from([height])];
  for (const record of records) {
    parts.push(i16(record.chunkX), i16(record.chunkZ), u32(record.candidateBytes.length), record.candidateBytes);
  }
  return Buffer.concat(parts);
}

function verifyBundle(bundle, records, minY, height) {
  if (bundle.subarray(0, 4).toString("ascii") !== "NC4B" || bundle[4] !== 1) {
    throw new Error("NCM4 homepage bundle header is invalid.");
  }
  if (bundle.readUInt16LE(5) !== records.length || bundle.readInt16LE(7) !== minY || bundle[9] !== height) {
    throw new Error("NCM4 homepage bundle metadata does not match the projection.");
  }
  let offset = 10;
  for (const record of records) {
    const chunkX = bundle.readInt16LE(offset);
    const chunkZ = bundle.readInt16LE(offset + 2);
    const length = bundle.readUInt32LE(offset + 4);
    offset += 8;
    const candidate = bundle.subarray(offset, offset + length);
    if (chunkX !== record.chunkX || chunkZ !== record.chunkZ || !candidate.equals(record.candidateBytes)) {
      throw new Error(`NCM4 homepage bundle record ${record.chunkX},${record.chunkZ} is invalid.`);
    }
    if (candidate.subarray(0, 4).toString("ascii") !== "NC4P") {
      throw new Error(`NCM4 homepage bundle record ${record.chunkX},${record.chunkZ} has no NC4P header.`);
    }
    offset += length;
  }
  if (offset !== bundle.length) throw new Error("NCM4 homepage bundle has trailing data.");
}

function aggregateRoot(records) {
  const hash = createHash("sha256");
  hash.update("NICECHUNK:HOME:TERRAIN:NCM4-BUNDLE:V1\0");
  for (const record of records) {
    hash.update(i16(record.chunkX));
    hash.update(i16(record.chunkZ));
    hash.update(Buffer.from(record.semanticRoot, "hex"));
  }
  return hash.digest("hex");
}

function runMiner(argumentsList) {
  const result = spawnSync(minerPath, argumentsList, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`nicechunk-miner ${argumentsList.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function runMinerVersion() {
  const result = spawnSync(minerPath, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Unable to read nicechunk-miner version: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function resolveMiner(requested) {
  const candidates = [
    requested,
    resolve(PROJECT_ROOT, "../miner/target/release/nicechunk-miner"),
    resolve(PROJECT_ROOT, "miner/target/release/nicechunk-miner"),
  ].filter(Boolean).map((candidate) => resolve(candidate));
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next explicit/local candidate.
    }
  }
  throw new Error("nicechunk-miner was not found. Pass --miner <path> or set NICECHUNK_MINER_BIN.");
}

async function writeAtomic(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function parseArguments(argumentsList) {
  const parsed = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--input") parsed.input = argumentsList[++index];
    else if (argument === "--bundle") parsed.bundle = argumentsList[++index];
    else if (argument === "--report") parsed.report = argumentsList[++index];
    else if (argument === "--miner") parsed.miner = argumentsList[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}

function compareChunks(left, right) {
  return left.chunkZ - right.chunkZ || left.chunkX - right.chunkX;
}

function sum(records, key) {
  return records.reduce((total, record) => total + record[key], 0);
}

function percent(numerator, denominator) {
  return Number(((numerator / Math.max(1, denominator)) * 100).toFixed(4));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function varint(value) {
  const bytes = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining) byte |= 0x80;
    bytes.push(byte);
  } while (remaining);
  return Buffer.from(bytes);
}

function u16(value) {
  const output = Buffer.alloc(2);
  output.writeUInt16LE(value);
  return output;
}

function i16(value) {
  const output = Buffer.alloc(2);
  output.writeInt16LE(value);
  return output;
}

function u32(value) {
  const output = Buffer.alloc(4);
  output.writeUInt32LE(value);
  return output;
}
