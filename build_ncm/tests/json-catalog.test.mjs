import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeNcm3, encodeNcm3, payloadByteLength, voxelize } from "../../chunk.js/ncm/blueprint-codec.js";
import { BUILDING_MATERIAL_CATALOG } from "../../chunk.js/construction/building-material-catalog.js";
import { BUILDING_STYLE_PRESETS } from "../../chunk.js/construction/building-style-catalog.js";
import { ROOF_TILE_VARIANTS } from "../../chunk.js/construction/roof-tile-catalog.js";
import { createCivicTownHall } from "../civic-town-hall-blueprint.js";
import { createGrandCastle } from "../grand-castle-blueprint.js";
import { createReferenceCottage } from "../house-blueprint.js";
import { createSeasideCottage } from "../seaside-cottage-blueprint.js";
import { createFreightWarehouse } from "../warehouse-blueprint.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const locales = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const materialRoles = ["foundation", "wall", "structure", "glazing", "roof", "floor", "chimney"];
const generators = new Map([
  ["hollow-cottage", createReferenceCottage],
  ["seaside-cottage", createSeasideCottage],
  ["civic-town-hall", createCivicTownHall],
  ["freight-warehouse", createFreightWarehouse],
  ["grand-castle", createGrandCastle],
]);
const formalMaterialIds = new Set(BUILDING_MATERIAL_CATALOG
  .filter((entry) => entry.status === "formal")
  .map((entry) => entry.materialId));

const catalog = readJson(join(root, "building-catalog.json"));
assert.deepEqual(Object.keys(catalog), ["schema", "buildings"], "the catalog may contain only its schema and building filenames");
assert.equal(catalog.schema, "nicechunk.building-catalog.v1");
assert.ok(Array.isArray(catalog.buildings) && catalog.buildings.length > 0);
assert.equal(new Set(catalog.buildings).size, catalog.buildings.length, "catalog filenames must be unique");

const diskBuildingFiles = readdirSync(join(root, "buildings"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((category) => readdirSync(join(root, "buildings", category.name), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => `buildings/${category.name}/${entry.name}`))
  .sort();
assert.deepEqual([...catalog.buildings].sort(), diskBuildingFiles, "every building JSON must be listed exactly once in the catalog");

let parityChecks = 0;
for (const relativePath of catalog.buildings) {
  assert.match(relativePath, /^buildings\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
  const [, category, filename] = relativePath.match(/^buildings\/([^/]+)\/([^/]+)\.json$/);
  const building = readJson(join(root, relativePath));
  assert.equal(building.schema, "nicechunk.ncm-building.v1");
  assert.equal(building.category, category);
  assert.equal(building.key, filename);
  assert.deepEqual(Object.keys(building.titles), locales, `${building.key} must contain all nine titles in canonical order`);
  assert.deepEqual(Object.keys(building.descriptions), locales, `${building.key} must contain all nine descriptions in canonical order`);
  for (const locale of locales) {
    assert.ok(building.titles[locale].trim(), `${building.key} is missing its ${locale} title`);
    assert.ok(building.descriptions[locale].trim(), `${building.key} is missing its ${locale} description`);
  }
  const kind = building.kind ?? "habitable-building";
  const enterable = building.access?.enterable ?? kind === "habitable-building";
  const maxStepRise = building.access?.maxStepRise ?? (enterable ? 2 : 0);
  assert.equal(typeof enterable, "boolean");
  assert.ok(Number.isInteger(maxStepRise) && maxStepRise >= 0 && maxStepRise <= 2, `${building.key} has an unsafe player step rise`);
  if (enterable) assert.equal(building.doorOpening, "open", `${building.key} must have an open player entrance`);
  else assert.ok(["open", "not-applicable"].includes(building.doorOpening));
  if (building.referenceImage) {
    assert.match(building.referenceImage, /^concepts\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpe?g|webp)$/);
    assert.ok(existsSync(join(root, building.referenceImage)), `${building.key} reference image is missing`);
  }
  assert.equal(building.ncm.format, "NCM3_ROLE_TEMPLATE");
  assert.match(building.ncm.code, /^NCM3:/);
  assert.deepEqual(Object.keys(building.ncm.materialRoles), materialRoles);
  assert.deepEqual(Object.values(building.ncm.materialRoles), [1, 2, 3, 4, 5, 6, 7]);

  const template = decodeNcm3(building.ncm.code);
  assert.equal(encodeNcm3(template), building.ncm.code, `${building.key} NCM template must be canonical`);
  assert.ok(voxelize(template).size > 0, `${building.key} NCM template must contain voxels`);
  const roleByPlaceholder = new Map(Object.entries(building.ncm.materialRoles).map(([role, value]) => [value, role]));
  const extraMaterialIds = new Set((building.extraMaterials ?? []).map((entry) => entry.materialId));
  const fixedMaterialIds = new Set(template.commands
    .map((command) => command.material)
    .filter((material) => !roleByPlaceholder.has(material)));
  assert.deepEqual([...fixedMaterialIds].sort((a, b) => a - b), [...extraMaterialIds].sort((a, b) => a - b), `${building.key} fixed materials must be declared as extras`);
  const defaultStyle = BUILDING_STYLE_PRESETS.find((style) => style.key === building.defaults.style);
  const defaultRoof = ROOF_TILE_VARIANTS.find((roof) => roof.key === building.defaults.roof);
  assert.ok(defaultStyle, `${building.key} has an unknown default style`);
  assert.ok(defaultRoof, `${building.key} has an unknown default roof`);
  const defaultCommands = remapCommands(template.commands, roleByPlaceholder, defaultStyle, defaultRoof, building.defaults.glazed);
  const defaultVoxels = voxelize({ size: { ...template.size }, commands: defaultCommands });
  const defaultMaterials = new Set(defaultCommands.map((command) => command.material));
  assert.ok([...defaultMaterials].every((materialId) => formalMaterialIds.has(materialId)), `${building.key} uses a material outside the formal game catalog`);
  if (!generators.has(building.key)) assert.ok(building.validation, `${building.key} must include self-contained geometry validation metadata`);
  validateBuildingEvidence(building, defaultVoxels);

  const generator = generators.get(building.key);
  if (generator) {
    for (const style of BUILDING_STYLE_PRESETS) {
      for (const roof of ROOF_TILE_VARIANTS) {
        for (const glazed of [false, true]) {
          const commands = remapCommands(template.commands, roleByPlaceholder, style, roof, glazed);
          const expanded = { size: { ...template.size }, commands };
          const canonical = generator({ style: style.key, roofMaterial: roof.materialId, glazed });
          assert.equal(
            encodeNcm3(expanded),
            encodeNcm3(canonical),
            `${building.key} JSON template diverges for ${style.key}/${roof.key}/${glazed ? "glazed" : "open"}`,
          );
          parityChecks += 1;
        }
      }
    }
  }
}

const localeFiles = readdirSync(join(root, "locales"))
  .filter((filename) => filename.endsWith(".json"))
  .sort();
assert.deepEqual(localeFiles, locales.map((locale) => `${locale}.json`).sort());
const dictionaries = Object.fromEntries(locales.map((locale) => [locale, readJson(join(root, "locales", `${locale}.json`))]));
const englishKeys = Object.keys(dictionaries.en);
for (const locale of locales) {
  assert.deepEqual(Object.keys(dictionaries[locale]), englishKeys, `${locale} UI dictionary keys differ from English`);
  for (const key of englishKeys) {
    assert.ok(String(dictionaries[locale][key]).trim(), `${locale} UI dictionary has an empty ${key}`);
    assert.deepEqual(placeholders(dictionaries[locale][key]), placeholders(dictionaries.en[key]), `${locale} placeholders differ for ${key}`);
    assert.deepEqual(htmlTags(dictionaries[locale][key]), htmlTags(dictionaries.en[key]), `${locale} HTML tags differ for ${key}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  buildings: catalog.buildings.length,
  locales: locales.length,
  uiKeys: englishKeys.length,
  parityChecks,
}, null, 2));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function remapCommands(commands, roleByPlaceholder, style, roof, glazed) {
  return commands.flatMap((command) => {
    const role = roleByPlaceholder.get(command.material);
    if (role === "glazing" && !glazed) return [];
    if (!role) return [{ ...command }];
    return [{
      ...command,
      material: role === "roof" ? roof.materialId : style.materials[role],
    }];
  });
}

function validateBuildingEvidence(building, voxels) {
  const validation = building.validation;
  if (!validation) return;
  assert.equal(voxels.size, validation.expectedVoxelCount, `${building.key} voxel count changed`);
  const payloadBytes = payloadByteLength(building.ncm.code);
  if (validation.expectedPayloadBytes != null) {
    assert.equal(payloadBytes, validation.expectedPayloadBytes, `${building.key} NCM payload length changed`);
  }
  assert.ok(payloadBytes <= validation.maxPayloadBytes, `${building.key} exceeds its NCM payload budget`);
  const materialIds = [...new Set([...voxels.values()].map((voxel) => voxel.material))].sort((a, b) => a - b);
  assert.deepEqual(materialIds, validation.expectedDefaultMaterialIds, `${building.key} default materials changed`);
  if (validation.requireConnected) validateConnectedGeometry(building, voxels);
  if (validation.mirrorAxisX != null) validateMirrorAxisX(building, voxels, validation.mirrorAxisX);
  for (const volume of validation.openVolumes ?? []) {
    for (let x = volume.x; x < volume.x + volume.width; x += 1) {
      for (let y = volume.y; y < volume.y + volume.height; y += 1) {
        for (let z = volume.z; z < volume.z + volume.depth; z += 1) {
          assert.equal(voxels.has(`${x},${y},${z}`), false, `${building.key} blocks ${volume.label} at ${x},${y},${z}`);
        }
      }
    }
  }
  for (const point of validation.solidPoints ?? []) {
    assert.equal(voxels.get(`${point.x},${point.y},${point.z}`)?.material, point.materialId, `${building.key} solid checkpoint changed at ${point.x},${point.y},${point.z}`);
  }
  let previousTopY = null;
  const maxStepRise = building.access?.maxStepRise ?? 2;
  for (const point of validation.approach ?? []) {
    assert.ok(voxels.has(`${point.x},${point.topY - 1},${point.z}`), `${building.key} approach lacks support at ${point.x},${point.z}`);
    assert.equal(voxels.has(`${point.x},${point.topY},${point.z}`), false, `${building.key} approach foot space is blocked at ${point.x},${point.z}`);
    assert.equal(voxels.has(`${point.x},${point.topY + 1},${point.z}`), false, `${building.key} approach head space is blocked at ${point.x},${point.z}`);
    if (previousTopY != null) assert.ok(Math.abs(point.topY - previousTopY) <= maxStepRise, `${building.key} approach exceeds its step-rise limit`);
    previousTopY = point.topY;
  }
}

function validateConnectedGeometry(building, voxels) {
  const first = voxels.values().next().value;
  assert.ok(first, `${building.key} has no geometry to connect`);
  const occupied = new Set(voxels.keys());
  const queue = [first];
  const visited = new Set([`${first.x},${first.y},${first.z}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y, z } = queue[index];
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const key = `${x + dx},${y + dy},${z + dz}`;
      if (!occupied.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(voxels.get(key));
    }
  }
  assert.equal(visited.size, voxels.size, `${building.key} contains disconnected or floating geometry`);
}

function validateMirrorAxisX(building, voxels, axisX) {
  assert.ok(Number.isInteger(axisX) && axisX >= 0, `${building.key} has an invalid X mirror axis`);
  for (const voxel of voxels.values()) {
    const mirror = voxels.get(`${axisX * 2 - voxel.x},${voxel.y},${voxel.z}`);
    assert.equal(mirror?.material, voxel.material, `${building.key} lost X symmetry at ${voxel.x},${voxel.y},${voxel.z}`);
  }
}

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function htmlTags(value) {
  return [...String(value).matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)]
    .map((match) => match[0].startsWith("</") ? `/${match[1]}` : match[1]);
}
