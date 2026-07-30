import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decodeNcf1,
  encodeNcf1Bytes,
  forgeMaterialRequirements,
} from "../../chunk.js/forge/forge-core.js";
import { validateForgeGripBindings } from "../../chunk.js/forge/forge-grip-validation.js";
import { ForgeRuntimeCache } from "../../chunk.js/forge/forge-runtime-cache.js";
import { forgeWorkbenchComponentsConnected } from "../../chunk.js/forge/forge-workbench.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = join(root, "..");
const locales = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const catalog = json(join(root, "json/catalog.json"));
const rules = json(join(projectRoot, "public/rules/smelting-rules.json"));
const materialRules = new Map(rules.materials.map((material) => [material.id, material]));
const runtimeCache = new ForgeRuntimeCache({ maxEntries: 32, maxBytes: 64 * 1024 * 1024 });

assert.equal(catalog.schema, "nicechunk.ncf-item-catalog.v1");
assert.equal(catalog.version, 1);
assert.equal(catalog.items.length, 24);
assert.equal(new Set(catalog.items).size, catalog.items.length);

const listedFiles = new Set(catalog.items);
const diskFiles = new Set(walkJson(join(root, "json"))
  .map((file) => relative(root, file).replaceAll("\\", "/"))
  .filter((file) => file !== "json/catalog.json"));
assert.deepEqual([...diskFiles].sort(), [...listedFiles].sort(), "every item JSON must be listed exactly once");

const categories = new Map();
let tools = 0;
let placeables = 0;
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
  for (const key of ["canonicalRoundTrip", "gameRuntimeRestored", "connectedComponents", "gripValidated", "currentMaterialsOnly"]) {
    assert.equal(item.verification[key], true, `${item.key} must pass ${key}`);
  }
  assert.equal(item.verification.chainMinted, false);
}

assert.deepEqual([...categories], [
  ["mining-tools", 3],
  ["forestry-farming", 3],
  ["workshop", 3],
  ["weapons", 3],
  ["building-fittings", 3],
  ["lighting", 3],
  ["furniture", 3],
  ["containers", 3],
]);
assert.equal(tools, 13);
assert.equal(placeables, 11);
assert.ok(runtimeCache.snapshot().residentBytes > 0);

console.log("item_ncm catalog tests passed: 24 canonical NCF1 items across 8 categories");

function json(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function walkJson(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? walkJson(file) : entry.name.endsWith(".json") ? [file] : [];
  });
}
