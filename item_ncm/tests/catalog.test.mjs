import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decodeNcf1,
  encodeNcf1Bytes,
  forgeMaterialRequirements,
} from "../../chunk.js/forge/forge-core.js";
import { validateForgeGripBindings } from "../../chunk.js/forge/forge-grip-validation.js";
import { ForgeRuntimeCache } from "../../chunk.js/forge/forge-runtime-cache.js";
import { forgeWorkbenchComponentsConnected } from "../../chunk.js/forge/forge-workbench.js";
import {
  DEFAULT_PEASANT_GUY_NCM,
  createAvatarMeshFromNcm,
  forgeAvatarTargetGrip,
} from "../../chunk.js/renderer/avatar-mesh.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = join(root, "..");
const rulesFile = process.env.ITEM_NCM_RULES_FILE
  ? resolve(process.env.ITEM_NCM_RULES_FILE)
  : join(projectRoot, "public/rules/smelting-rules.json");
const locales = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const catalog = json(join(root, "json/catalog.json"));
const rules = json(rulesFile);
const materialRules = new Map(rules.materials.map((material) => [material.id, material]));
const runtimeCache = new ForgeRuntimeCache({ maxEntries: 32, maxBytes: 64 * 1024 * 1024 });

assert.equal(catalog.schema, "nicechunk.ncf-item-catalog.v1");
assert.equal(catalog.version, 1);
assert.equal(catalog.items.length, 31);
assert.equal(new Set(catalog.items).size, catalog.items.length);

const listedFiles = new Set(catalog.items);
const diskFiles = new Set(walkJson(join(root, "json"))
  .map((file) => relative(root, file).replaceAll("\\", "/"))
  .filter((file) => file !== "json/catalog.json"));
assert.deepEqual([...diskFiles].sort(), [...listedFiles].sort(), "every item JSON must be listed exactly once");

const categories = new Map();
let tools = 0;
let placeables = 0;
let conceptReferences = 0;
for (const file of catalog.items) {
  assert.match(file, /^json\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
  const item = json(join(root, file));
  const [, category, filename] = /^json\/([^/]+)\/([^/]+)\.json$/.exec(file);
  assert.equal(item.schema, "nicechunk.ncf-item.v1");
  assert.equal(item.category, category);
  assert.equal(item.key, filename);
  assert.ok(["tool", "placeable"].includes(item.interaction));
  categories.set(category, (categories.get(category) ?? 0) + 1);
  if (item.interaction === "tool") tools += 1;
  else placeables += 1;

  assert.deepEqual(Object.keys(item.names), locales);
  assert.deepEqual(Object.keys(item.descriptions), locales);
  for (const locale of locales) {
    assert.ok(item.names[locale].trim(), `${item.key} needs names.${locale}`);
    assert.ok(item.descriptions[locale].includes("NCF1"), `${item.key} descriptions.${locale} must state the format`);
  }

  assert.equal(item.dimensions.unit, "m");
  for (const dimension of [item.dimensions.width, item.dimensions.height, item.dimensions.depth]) {
    assert.ok(dimension > 0 && dimension <= 2, `${item.key} dimension must remain within the item-scale envelope`);
  }
  assert.equal(item.forge.format, "NCF1");
  assert.equal(item.forge.version, 15);
  assert.match(item.forge.code, /^NCF1\.[A-Za-z0-9_-]+$/);
  assert.ok(item.forge.rawBytes > 0 && item.forge.rawBytes <= 640);
  assert.equal(item.forge.materialPolicy, "current-smelting-rules-only");
  assert.equal(item.forge.materialRuleSet, rules.ruleSet);
  if (item.concept) {
    conceptReferences += 1;
    assert.equal(item.concept.source, "imagegen");
    assert.ok(Number.isInteger(item.concept.version) && item.concept.version > 0);
    assert.equal(item.concept.image, `concepts/${item.category}/${item.key}-v${item.concept.version}.webp`);
    assert.match(item.concept.sha256, /^[a-f0-9]{64}$/);
    const conceptBytes = readFileSync(join(root, item.concept.image));
    assert.equal(createHash("sha256").update(conceptBytes).digest("hex"), item.concept.sha256);
  }

  const decoded = decodeNcf1(item.forge.code, { requireCanonical: true });
  const canonicalBytes = encodeNcf1Bytes(decoded);
  assert.equal(canonicalBytes.length, item.forge.rawBytes);
  assert.equal(createHash("sha256").update(canonicalBytes).digest("hex"), item.forge.sha256);
  const runtime = runtimeCache.restore(item.forge.code, {
    expectedDesignHash: item.forge.designHash,
    requireCanonical: true,
  });
  assert.equal(runtime.rawByteLength, item.forge.rawBytes);
  assert.equal(runtime.vertexCount, item.forge.runtime.vertexCount);
  assert.equal(runtime.triangleCount, item.forge.runtime.triangleCount);
  assert.equal(runtime.componentCount, item.forge.decodedComponentCount);
  assert.deepEqual(runtime.boundsQ.sizeQ, item.dimensions.sizeQ);
  assert.equal(forgeWorkbenchComponentsConnected(runtime.components), true, `${item.key} must be a connected assembly`);
  const grip = validateForgeGripBindings(runtime.components);
  assert.equal(grip.valid, true, `${item.key} grip must remain valid after decoding`);
  assert.equal(grip.gripCount, item.interaction === "tool" ? 1 : 0);
  assert.equal(Boolean(runtime.grip), item.interaction === "tool");
  if (item.interaction === "tool") {
    assert.deepEqual(item.holding.sourceToAvatarAxes, ["+Y", "-Z", "-X"]);
    assert.equal(item.holding.testedPoseCount, 27);
    assert.ok(Number.isInteger(item.holding.gripComponentIndex));
    assert.ok(item.holding.workComponentIndexes.length > 0);
    const gripComponent = runtime.components[item.holding.gripComponentIndex];
    const designGripQ = gripComponent.grip.offsetQ.map((value, axis) => value + gripComponent.offsetQ[axis]);
    for (const componentIndex of item.holding.workComponentIndexes) {
      assert.ok(runtime.components[componentIndex].offsetQ[1] > designGripQ[1], `${item.key} work end must be forward in source space`);
    }
    for (const group of item.holding.lateralComponentGroups) {
      const spans = componentGroupSpansQ(runtime.components, group);
      assert.ok(spans[2] > spans[0] * 1.1, `${item.key} lateral work must use source Z`);
    }

    const avatarMesh = createAvatarMeshFromNcm(DEFAULT_PEASANT_GUY_NCM, {
      scale: (1.75 / 0.4) / 2.52,
      attachIronPickaxe: true,
      attachForgedPickaxe: true,
      forgeRuntime: runtime,
      forgeMetersToWorldUnits: 1 / 0.4,
    });
    const mounted = (avatarMesh.collisionParts ?? []).filter((part) => part.equipmentId === "forged_pickaxe");
    const targetGrip = forgeAvatarTargetGrip(avatarMesh.handAnchors.right_hand_item, avatarMesh.modelScale);
    assert.equal(mounted.length, runtime.componentCount, `${item.key} must mount every restored component`);
    for (const componentIndex of item.holding.workComponentIndexes) {
      assert.ok(mounted[componentIndex].cz < targetGrip[2] - 0.01, `${item.key} work end must face away from the avatar`);
    }
  } else {
    assert.equal(item.holding, undefined);
  }

  const requirements = forgeMaterialRequirements(canonicalBytes);
  assert.equal(requirements.designHash, item.forge.designHash);
  assert.equal(requirements.requiredVolumeMm3, item.forge.requirements.requiredVolumeMm3);
  assert.equal(requirements.outputMassGrams, item.forge.requirements.outputMassGrams);
  assert.equal(item.forge.materialComponents.length, item.forge.sourceComponentCount);
  assert.equal(item.forge.materialComponents.length, runtime.componentCount);
  for (const component of item.forge.materialComponents) {
    const material = materialRules.get(component.materialId);
    assert.ok(material, `${item.key} uses an unknown material ${component.materialId}`);
    assert.equal(component.itemCode, material.itemCode);
    assert.ok(component.inputVolumeMm3 >= component.usedVolumeMm3);
    assert.equal(component.inputVolumeMm3 - component.usedVolumeMm3, component.unusedVolumeMm3);
  }
  const usedVolume = item.billOfMaterials.reduce((sum, material) => sum + material.usedVolumeMm3, 0);
  assert.ok(usedVolume >= item.forge.requirements.requiredVolumeMm3);
  assert.ok(
    usedVolume - item.forge.requirements.requiredVolumeMm3 <= usedVolume * 0.002,
    `${item.key} exceeds the bounded NCF1 v15 aggregate-volume quantization loss`,
  );
  assert.equal(new Set(item.billOfMaterials.map((material) => material.materialId)).size, item.billOfMaterials.length);
  for (const material of item.billOfMaterials) {
    const rule = materialRules.get(material.materialId);
    assert.ok(rule);
    assert.equal(material.itemCode, rule.itemCode);
    assert.equal(material.unitVolumeMm3, rule.unitVolumeMm3);
    assert.equal(material.equivalentInputUnits, Math.ceil(material.inputVolumeMm3 / material.unitVolumeMm3));
  }
  for (const key of [
    "canonicalRoundTrip", "gameRuntimeRestored", "connectedComponents", "gripValidated",
    "gripDirectionValidated", "currentMaterialsOnly",
  ]) {
    assert.equal(item.verification[key], true, `${item.key} must pass ${key}`);
  }
  assert.equal(item.verification.chainMinted, false);
}

assert.deepEqual([...categories], [
  ["mining-tools", 4],
  ["forestry-farming", 4],
  ["workshop", 3],
  ["weapons", 3],
  ["building-fittings", 3],
  ["lighting", 3],
  ["furniture", 3],
  ["containers", 3],
  ["cooking", 2],
  ["books-writing", 3],
]);
assert.equal(tools, 15);
assert.equal(placeables, 16);
assert.equal(conceptReferences, 7);
assert.ok(runtimeCache.snapshot().residentBytes > 0);

console.log("item_ncm catalog tests passed: 31 canonical NCF1 items across 10 categories");

function json(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function walkJson(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? walkJson(file) : entry.name.endsWith(".json") ? [file] : [];
  });
}

function componentGroupSpansQ(components, indexes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const index of indexes) {
    const component = components[index];
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], component.offsetQ[axis] - component.dimsQ[axis] * 0.5);
      max[axis] = Math.max(max[axis], component.offsetQ[axis] + component.dimsQ[axis] * 0.5);
    }
  }
  return min.map((value, axis) => max[axis] - value);
}
