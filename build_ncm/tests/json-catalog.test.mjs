import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeNcm3, encodeNcm3, payloadByteLength, voxelize } from "../../chunk.js/ncm/blueprint-codec.js";
import { BUILDING_MATERIAL_CATALOG } from "../../chunk.js/construction/building-material-catalog.js";
import { BUILDING_STYLE_PRESETS } from "../../chunk.js/construction/building-style-catalog.js";
import { ROOF_TILE_VARIANTS } from "../../chunk.js/construction/roof-tile-catalog.js";
import { PLAYER_AVATAR_HEIGHT_WORLD_UNITS, WORLD_BLOCK_SIZE_METERS } from "../../chunk.js/core/constants.js";
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
    const referencePath = join(root, building.referenceImage);
    assert.ok(existsSync(referencePath), `${building.key} reference image is missing`);
    assert.ok(statSync(referencePath).size <= 256 * 1024, `${building.key} reference image must stay web-optimized`);
  }
  assert.equal(building.ncm.format, "NCM3_ROLE_TEMPLATE");
  assert.match(building.ncm.code, /^NCM3:/);
  assert.deepEqual(Object.keys(building.ncm.materialRoles), materialRoles);
  assert.deepEqual(Object.values(building.ncm.materialRoles), [1, 2, 3, 4, 5, 6, 7]);

  const template = decodeNcm3(building.ncm.code);
  assert.equal(encodeNcm3(template), building.ncm.code, `${building.key} NCM template must be canonical`);
  assert.ok(voxelize(template).size > 0, `${building.key} NCM template must contain voxels`);
  validateScaleMetadata(building, template);
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
  if (validation.expectedMaterialVoxelCounts) {
    const materialCounts = Object.fromEntries(materialIds.map((materialId) => [
      materialId,
      [...voxels.values()].filter((voxel) => voxel.material === materialId).length,
    ]));
    assert.deepEqual(materialCounts, validation.expectedMaterialVoxelCounts, `${building.key} material voxel counts changed`);
  }
  if (validation.requireConnected) validateConnectedGeometry(building, voxels);
  if (validation.mirrorAxisX != null) validateMirrorAxisX(building, voxels, validation.mirrorAxisX);
  if (validation.mirrorAxisZ != null) validateMirrorAxisZ(building, voxels, validation.mirrorAxisZ);
  for (const support of validation.supportColumns ?? []) {
    assert.ok(Number.isInteger(support.baseY) && Number.isInteger(support.topY) && support.baseY <= support.topY, `${building.key} has an invalid ${support.label} support range`);
    for (let y = support.baseY; y <= support.topY; y += 1) {
      assert.ok(voxels.has(`${support.x},${y},${support.z}`), `${building.key} has a load-path gap in ${support.label} at ${support.x},${y},${support.z}`);
    }
  }
  for (const support of validation.steppedSupports ?? []) validateSteppedSupport(building, voxels, support);
  for (const span of validation.horizontalSpans ?? []) validateHorizontalSpan(building, voxels, span);
  for (const deck of validation.walkableDecks ?? []) validateWalkableDeck(building, voxels, deck);
  for (const profile of validation.gableProfiles ?? []) validateGableProfile(building, voxels, profile);
  for (const band of validation.diagonalBands ?? []) validateDiagonalBand(building, voxels, band);
  for (const pyramid of validation.steppedPyramids ?? []) validateSteppedPyramid(building, voxels, pyramid);
  for (const loop of validation.closedVoxelLoops ?? []) validateClosedVoxelLoop(building, voxels, loop);
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

function validateScaleMetadata(building, template) {
  const scale = building.scale;
  if (scale == null) return;
  assert.equal(scale.voxelMeters, WORLD_BLOCK_SIZE_METERS, `${building.key} voxel scale diverges from Chunk.js`);
  assert.equal(scale.avatarHeightVoxels, PLAYER_AVATAR_HEIGHT_WORLD_UNITS, `${building.key} avatar scale diverges from Chunk.js`);
  assert.ok(Number.isInteger(scale.wallFootprintVoxels?.x) && scale.wallFootprintVoxels.x > 0 && scale.wallFootprintVoxels.x <= template.size.x, `${building.key} has an invalid wall-footprint width`);
  assert.ok(Number.isInteger(scale.wallFootprintVoxels?.z) && scale.wallFootprintVoxels.z > 0 && scale.wallFootprintVoxels.z <= template.size.z, `${building.key} has an invalid wall-footprint depth`);
  assert.equal(scale.wallFootprintMeters?.x, scale.wallFootprintVoxels.x * WORLD_BLOCK_SIZE_METERS, `${building.key} wall width is not derived from its voxel footprint`);
  assert.equal(scale.wallFootprintMeters?.z, scale.wallFootprintVoxels.z * WORLD_BLOCK_SIZE_METERS, `${building.key} wall depth is not derived from its voxel footprint`);
  assert.ok(Number.isInteger(scale.doorClearVoxels?.width) && scale.doorClearVoxels.width >= 2, `${building.key} has an invalid clear doorway width`);
  assert.ok(Number.isInteger(scale.doorClearVoxels?.height) && scale.doorClearVoxels.height > PLAYER_AVATAR_HEIGHT_WORLD_UNITS, `${building.key} doorway does not clear the canonical avatar`);
  assert.ok(Number.isInteger(scale.interiorClearHeightVoxels) && scale.interiorClearHeightVoxels > PLAYER_AVATAR_HEIGHT_WORLD_UNITS, `${building.key} interior does not clear the canonical avatar`);
  const openings = building.validation?.openVolumes ?? [];
  assert.ok(openings.some((volume) => volume.width === scale.doorClearVoxels.width && volume.height === scale.doorClearVoxels.height && volume.depth >= 1), `${building.key} does not prove its declared doorway clearance`);
  assert.ok(openings.some((volume) => volume.height >= scale.interiorClearHeightVoxels && volume.width >= scale.doorClearVoxels.width && volume.depth >= 3), `${building.key} does not prove its declared interior headroom`);
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

function validateMirrorAxisZ(building, voxels, axisZ) {
  assert.ok(Number.isInteger(axisZ) && axisZ >= 0, `${building.key} has an invalid Z mirror axis`);
  for (const voxel of voxels.values()) {
    const mirror = voxels.get(`${voxel.x},${voxel.y},${axisZ * 2 - voxel.z}`);
    assert.equal(mirror?.material, voxel.material, `${building.key} lost Z symmetry at ${voxel.x},${voxel.y},${voxel.z}`);
  }
}

function validateHorizontalSpan(building, voxels, span) {
  assert.ok(["x", "z"].includes(span.axis), `${building.key} has an invalid ${span.label} span axis`);
  assert.ok(Number.isInteger(span.start) && Number.isInteger(span.end) && span.start <= span.end, `${building.key} has an invalid ${span.label} span range`);
  for (let position = span.start; position <= span.end; position += 1) {
    const x = span.axis === "x" ? position : span.fixed;
    const z = span.axis === "x" ? span.fixed : position;
    assert.ok(voxels.has(`${x},${span.y},${z}`), `${building.key} has a structural gap in ${span.label} at ${x},${span.y},${z}`);
  }
}

function validateSteppedSupport(building, voxels, support) {
  assert.ok(Number.isInteger(support.materialId) && support.materialId > 0, `${building.key} has an invalid ${support.label} support material`);
  assert.ok(Array.isArray(support.segments) && support.segments.length > 0, `${building.key} has no segments for ${support.label}`);
  let previous = null;
  for (const segment of support.segments) {
    for (const key of ["x", "y", "z"]) assert.ok(Number.isInteger(segment[key]) && segment[key] >= 0, `${building.key} has an invalid ${support.label} ${key}`);
    for (const key of ["width", "height", "depth"]) assert.ok(Number.isInteger(segment[key]) && segment[key] > 0, `${building.key} has an invalid ${support.label} ${key}`);
    for (let x = segment.x; x < segment.x + segment.width; x += 1) {
      for (let y = segment.y; y < segment.y + segment.height; y += 1) {
        for (let z = segment.z; z < segment.z + segment.depth; z += 1) {
          assert.equal(voxels.get(`${x},${y},${z}`)?.material, support.materialId, `${building.key} has a material or load-path gap in ${support.label} at ${x},${y},${z}`);
        }
      }
    }
    if (!previous) {
      assert.ok(segment.y > 0, `${building.key} ${support.label} cannot prove ground support below y=0`);
      for (let x = segment.x; x < segment.x + segment.width; x += 1) {
        for (let z = segment.z; z < segment.z + segment.depth; z += 1) {
          assert.ok(voxels.has(`${x},${segment.y - 1},${z}`), `${building.key} ${support.label} lacks grounded support below ${x},${segment.y},${z}`);
        }
      }
    } else {
      assert.equal(segment.y, previous.y + previous.height, `${building.key} has a vertical gap between ${support.label} segments`);
      assert.ok(rangesOverlap(previous.x, previous.width, segment.x, segment.width), `${building.key} loses X face contact in ${support.label}`);
      assert.ok(rangesOverlap(previous.z, previous.depth, segment.z, segment.depth), `${building.key} loses Z face contact in ${support.label}`);
    }
    previous = segment;
  }
}

function validateClosedVoxelLoop(building, voxels, loop) {
  assert.ok(Array.isArray(loop.points) && loop.points.length >= 4, `${building.key} has an incomplete ${loop.label} loop`);
  const points = loop.points.map((point) => {
    assert.ok(Array.isArray(point) && point.length === 3 && point.every((value) => Number.isInteger(value) && value >= 0), `${building.key} has an invalid point in ${loop.label}`);
    const [x, y, z] = point;
    assert.equal(voxels.get(`${x},${y},${z}`)?.material, loop.materialId, `${building.key} breaks ${loop.label} at ${x},${y},${z}`);
    return { x, y, z };
  });
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const distance = Math.abs(current.x - next.x) + Math.abs(current.y - next.y) + Math.abs(current.z - next.z);
    assert.equal(distance, 1, `${building.key} ${loop.label} is not face-connected between points ${index} and ${(index + 1) % points.length}`);
  }
}

function rangesOverlap(startA, lengthA, startB, lengthB) {
  return Math.max(startA, startB) < Math.min(startA + lengthA, startB + lengthB);
}

function validateWalkableDeck(building, voxels, deck) {
  assert.ok(["x", "z"].includes(deck.axis), `${building.key} has an invalid ${deck.label} deck axis`);
  assert.ok(Number.isInteger(deck.start) && Number.isInteger(deck.end) && deck.start <= deck.end, `${building.key} has an invalid ${deck.label} deck range`);
  assert.ok(Number.isInteger(deck.crossStart) && Number.isInteger(deck.crossEnd) && deck.crossStart <= deck.crossEnd, `${building.key} has an invalid ${deck.label} deck width`);
  assert.equal(deck.topProfile.length, deck.end - deck.start + 1, `${building.key} has an incomplete ${deck.label} height profile`);
  const maxStepRise = building.access?.maxStepRise ?? 2;
  for (let index = 0; index < deck.topProfile.length; index += 1) {
    const position = deck.start + index;
    const topY = deck.topProfile[index];
    assert.ok(Number.isInteger(topY) && topY > 0, `${building.key} has an invalid ${deck.label} deck height`);
    if (index > 0) assert.ok(Math.abs(topY - deck.topProfile[index - 1]) <= maxStepRise, `${building.key} exceeds its step-rise limit on ${deck.label}`);
    for (let cross = deck.crossStart; cross <= deck.crossEnd; cross += 1) {
      const x = deck.axis === "x" ? position : cross;
      const z = deck.axis === "x" ? cross : position;
      assert.ok(voxels.has(`${x},${topY - 1},${z}`), `${building.key} lacks deck support on ${deck.label} at ${x},${z}`);
      for (let clearance = 0; clearance < deck.clearance; clearance += 1) {
        assert.equal(voxels.has(`${x},${topY + clearance},${z}`), false, `${building.key} blocks ${deck.label} at ${x},${topY + clearance},${z}`);
      }
    }
    for (const edge of deck.guardEdges ?? []) {
      const x = deck.axis === "x" ? position : edge;
      const z = deck.axis === "x" ? edge : position;
      for (const offset of deck.guardOffsets ?? []) {
        assert.ok(voxels.has(`${x},${topY + offset},${z}`), `${building.key} has a guard-rail gap on ${deck.label} at ${x},${topY + offset},${z}`);
      }
    }
  }
}

function validateGableProfile(building, voxels, profile) {
  for (const key of ["x", "baseY", "z"]) {
    assert.ok(Number.isInteger(profile[key]) && profile[key] >= 0, `${building.key} has an invalid ${profile.label} ${key}`);
  }
  assert.ok(Number.isInteger(profile.width) && profile.width >= 3 && profile.width % 2 === 1, `${building.key} has an invalid ${profile.label} width`);
  assert.ok(Number.isInteger(profile.slopeMaterialId) && profile.slopeMaterialId > 0, `${building.key} has an invalid ${profile.label} slope material`);
  assert.ok(Number.isInteger(profile.ridgeMaterialId) && profile.ridgeMaterialId > 0, `${building.key} has an invalid ${profile.label} ridge material`);
  const layers = Math.ceil(profile.width / 2);
  for (let layer = 0; layer < layers; layer += 1) {
    const y = profile.baseY + layer;
    const left = profile.x + layer;
    const right = profile.x + profile.width - 1 - layer;
    const expectedMaterial = left === right ? profile.ridgeMaterialId : profile.slopeMaterialId;
    assert.equal(voxels.get(`${left},${y},${profile.z}`)?.material, expectedMaterial, `${building.key} breaks ${profile.label} at ${left},${y},${profile.z}`);
    assert.equal(voxels.get(`${right},${y},${profile.z}`)?.material, expectedMaterial, `${building.key} breaks ${profile.label} at ${right},${y},${profile.z}`);
  }
}

function validateDiagonalBand(building, voxels, band) {
  for (const key of ["x", "y", "z"]) {
    assert.ok(Number.isInteger(band[key]) && band[key] >= 0, `${building.key} has an invalid ${band.label} ${key}`);
  }
  for (const key of ["width", "height", "depth", "count"]) {
    assert.ok(Number.isInteger(band[key]) && band[key] > 0, `${building.key} has an invalid ${band.label} ${key}`);
  }
  for (const key of ["dx", "dy", "dz"]) {
    assert.ok(Number.isInteger(band[key]), `${building.key} has an invalid ${band.label} ${key}`);
  }
  assert.ok(Number.isInteger(band.materialId) && band.materialId > 0, `${building.key} has an invalid ${band.label} material`);
  for (let index = 0; index < band.count; index += 1) {
    const originX = band.x + band.dx * index;
    const originY = band.y + band.dy * index;
    const originZ = band.z + band.dz * index;
    for (let x = originX; x < originX + band.width; x += 1) {
      for (let y = originY; y < originY + band.height; y += 1) {
        for (let z = originZ; z < originZ + band.depth; z += 1) {
          assert.equal(voxels.get(`${x},${y},${z}`)?.material, band.materialId, `${building.key} breaks ${band.label} at ${x},${y},${z}`);
        }
      }
    }
  }
}

function validateSteppedPyramid(building, voxels, pyramid) {
  assert.ok(Number.isInteger(pyramid.materialId) && pyramid.materialId > 0, `${building.key} has an invalid ${pyramid.label} material`);
  assert.ok(Array.isArray(pyramid.layers) && pyramid.layers.length >= 2, `${building.key} has an incomplete ${pyramid.label}`);
  let previous = null;
  for (const layer of pyramid.layers) {
    for (const key of ["x", "y", "z"]) {
      assert.ok(Number.isInteger(layer[key]) && layer[key] >= 0, `${building.key} has an invalid ${pyramid.label} ${key}`);
    }
    for (const key of ["width", "depth"]) {
      assert.ok(Number.isInteger(layer[key]) && layer[key] > 0, `${building.key} has an invalid ${pyramid.label} ${key}`);
    }
    if (previous) {
      assert.equal(layer.x, previous.x + 1, `${building.key} loses the X inset in ${pyramid.label}`);
      assert.equal(layer.y, previous.y + 1, `${building.key} loses the vertical step in ${pyramid.label}`);
      assert.equal(layer.z, previous.z + 1, `${building.key} loses the Z inset in ${pyramid.label}`);
      assert.equal(layer.width, previous.width - 2, `${building.key} loses the width taper in ${pyramid.label}`);
      assert.equal(layer.depth, previous.depth - 2, `${building.key} loses the depth taper in ${pyramid.label}`);
    }
    for (let x = layer.x; x < layer.x + layer.width; x += 1) {
      for (let z = layer.z; z < layer.z + layer.depth; z += 1) {
        assert.equal(voxels.get(`${x},${layer.y},${z}`)?.material, pyramid.materialId, `${building.key} breaks ${pyramid.label} at ${x},${layer.y},${z}`);
      }
    }
    previous = layer;
  }
}

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function htmlTags(value) {
  return [...String(value).matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)]
    .map((match) => match[0].startsWith("</") ? `/${match[1]}` : match[1]);
}
