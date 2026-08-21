import { createHash } from "node:crypto";
import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { STRUCTURE_LAYOUT } from "../home/home-world-layout.js";

const ROOF_MATERIAL_ID = 96;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArguments(process.argv.slice(2));
const sourceRoot = resolve(options.sourceRoot || process.env.NICECHUNK_SOURCE_ROOT || PROJECT_ROOT);
const chunkSource = resolve(options.chunkSource || process.env.NICECHUNK_CHUNKJS_SOURCE || resolve(sourceRoot, "chunk.js"));
const snapshot = resolve(options.snapshot || resolve(PROJECT_ROOT, "home/home-world-structure-codes.snapshot.json"));
const output = resolve(options.output || resolve(PROJECT_ROOT, "home/home-world-structure-codes.js"));
const canonicalInputs = [
  resolve(chunkSource, "ncm/blueprint-codec.js"),
  resolve(chunkSource, "construction/building-style-catalog.js"),
  ...STRUCTURE_LAYOUT.map((spec) => resolve(sourceRoot, spec.definitionPath)),
];
const missingCanonicalInputs = await missingFiles(canonicalInputs);
const canonicalSourceRequested = Boolean(
  options.sourceRoot
  || options.chunkSource
  || process.env.NICECHUNK_SOURCE_ROOT
  || process.env.NICECHUNK_CHUNKJS_SOURCE,
);

if (canonicalSourceRequested && missingCanonicalInputs.length) {
  throw new Error(`Canonical structure source is incomplete:\n${missingCanonicalInputs.join("\n")}`);
}

const mode = missingCanonicalInputs.length ? "snapshot" : "canonical";
const entries = mode === "canonical"
  ? await buildCanonicalEntries()
  : await readSnapshotEntries();
validateEntries(entries);
if (mode === "canonical") await writeSnapshot(entries);

const source = [
  `export const HOME_STRUCTURE_ROOF_MATERIAL_ID = ${ROOF_MATERIAL_ID};`,
  "",
  "export const HOME_STRUCTURE_NCM_CODES = Object.freeze({",
  ...entries.flatMap((entry) => [
    `  ${JSON.stringify(entry.key)}: Object.freeze({`,
    `    sourceNcmSha256: ${JSON.stringify(entry.sourceNcmSha256)},`,
    `    roofMaterialId: ${entry.roofMaterialId},`,
    `    payloadBytes: ${entry.payloadBytes},`,
    `    materials: Object.freeze(${JSON.stringify(entry.materials)}),`,
    `    code: ${JSON.stringify(entry.code)},`,
    "  }),",
  ]),
  "});",
  "",
].join("\n");

await writeAtomic(output, source);

console.log(JSON.stringify({ mode, output, snapshot, structures: entries.length }, null, 2));

async function buildCanonicalEntries() {
  const [codec, styleCatalog] = await Promise.all([
    import(pathToFileURL(resolve(chunkSource, "ncm/blueprint-codec.js"))),
    import(pathToFileURL(resolve(chunkSource, "construction/building-style-catalog.js"))),
  ]);
  const canonicalEntries = [];
  for (const spec of STRUCTURE_LAYOUT) {
    const definition = JSON.parse(await readFile(resolve(sourceRoot, spec.definitionPath), "utf8"));
    if (definition.key !== spec.structureKey) {
      throw new Error(`${spec.definitionPath} no longer defines ${spec.structureKey}.`);
    }
    const style = styleCatalog.BUILDING_STYLE_PRESETS_BY_KEY[definition.defaults?.style];
    if (!style) throw new Error(`Unknown default building style for ${definition.key}.`);

    const blueprint = codec.decodeNcm3(definition.ncm.code);
    const roleByPlaceholder = new Map(Object.entries(definition.ncm.materialRoles)
      .map(([role, placeholder]) => [placeholder, role]));
    const materialize = (materialId) => {
      const role = roleByPlaceholder.get(materialId);
      if (!role) return materialId;
      return role === "roof" ? ROOF_MATERIAL_ID : style.materials[role];
    };
    for (const command of blueprint.commands) {
      for (const field of ["material", "trunkMaterial", "leafMaterial"]) {
        if (Number.isInteger(command[field])) command[field] = materialize(command[field]);
      }
    }

    const code = codec.encodeNcm3(blueprint);
    const materials = [...new Set([...codec.voxelize(blueprint).values()].map((voxel) => voxel.material))]
      .sort((left, right) => left - right);
    if (materials.some((materialId) => materialId >= 1 && materialId <= 7)) {
      throw new Error(`${definition.key} still contains role-placeholder materials.`);
    }
    if (definition.validation?.expectedPayloadBytes != null
      && definition.validation.expectedPayloadBytes !== codec.payloadByteLength(code)) {
      throw new Error(`${definition.key} payload metadata does not match its materialized NCM3 code.`);
    }
    if (definition.validation?.expectedDefaultMaterialIds != null
      && JSON.stringify(definition.validation.expectedDefaultMaterialIds) !== JSON.stringify(materials)) {
      throw new Error(`${definition.key} material metadata does not match its materialized NCM3 code.`);
    }
    canonicalEntries.push({
      key: definition.key,
      sourceNcmSha256: createHash("sha256").update(definition.ncm.code).digest("hex"),
      roofMaterialId: ROOF_MATERIAL_ID,
      payloadBytes: codec.payloadByteLength(code),
      materials,
      code,
    });
  }
  return canonicalEntries;
}

async function readSnapshotEntries() {
  const parsed = JSON.parse(await readFile(snapshot, "utf8"));
  if (parsed.schemaVersion !== 1 || parsed.roofMaterialId !== ROOF_MATERIAL_ID) {
    throw new Error("Homepage structure snapshot metadata is invalid.");
  }
  return parsed.structures;
}

async function writeSnapshot(structures) {
  const value = `${JSON.stringify({
    schemaVersion: 1,
    roofMaterialId: ROOF_MATERIAL_ID,
    structures,
  }, null, 2)}\n`;
  await writeAtomic(snapshot, value);
}

function validateEntries(structures) {
  if (!Array.isArray(structures) || structures.length !== STRUCTURE_LAYOUT.length) {
    throw new Error("Homepage structure snapshot count does not match the scene layout.");
  }
  for (let index = 0; index < structures.length; index += 1) {
    const entry = structures[index];
    const expectedKey = STRUCTURE_LAYOUT[index]?.structureKey;
    if (!entry || entry.key !== expectedKey) {
      throw new Error(`Homepage structure snapshot order drifted at index ${index}.`);
    }
    if (!/^[0-9a-f]{64}$/u.test(entry.sourceNcmSha256)) {
      throw new Error(`${entry.key} has an invalid source NCM hash.`);
    }
    if (entry.roofMaterialId !== ROOF_MATERIAL_ID || !Number.isSafeInteger(entry.payloadBytes) || entry.payloadBytes <= 0) {
      throw new Error(`${entry.key} has invalid payload metadata.`);
    }
    if (!Array.isArray(entry.materials)
      || entry.materials.some((materialId) => !Number.isSafeInteger(materialId) || materialId <= 0)
      || entry.materials.some((materialId, materialIndex) => materialIndex > 0 && materialId <= entry.materials[materialIndex - 1])) {
      throw new Error(`${entry.key} has invalid material metadata.`);
    }
    if (typeof entry.code !== "string" || !entry.code.startsWith("NCM3:")) {
      throw new Error(`${entry.key} has an invalid NCM3 code.`);
    }
    const payloadBytes = Buffer.from(entry.code.slice("NCM3:".length), "base64url").byteLength;
    if (payloadBytes !== entry.payloadBytes) {
      throw new Error(`${entry.key} NCM3 payload length does not match its snapshot metadata.`);
    }
  }
}

async function missingFiles(paths) {
  const checks = await Promise.all(paths.map(async (path) => {
    try {
      await access(path);
      return null;
    } catch {
      return path;
    }
  }));
  return checks.filter(Boolean);
}

async function writeAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, value);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--chunk-source") parsed.chunkSource = args[++index];
    else if (argument === "--source-root") parsed.sourceRoot = args[++index];
    else if (argument === "--snapshot") parsed.snapshot = args[++index];
    else if (argument === "--output") parsed.output = args[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return parsed;
}
