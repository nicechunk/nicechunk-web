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
const bookLayouts = new Map([
  ["timber-bound-village-ledger", { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] }],
  ["open-civic-record-book", { portrait: false, pageSets: [{ page: 3, lower: 0 }, { page: 4, lower: 1 }] }],
  ["stacked-archive-volumes", {
    portrait: false,
    pageSets: [
      { page: 1, lower: 0, upper: 2 },
      { page: 5, lower: 4, upper: 6 },
      { page: 9, lower: 8, upper: 10 },
    ],
  }],
  ["civilization-code-codex", { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] }],
  ["mining-skill-manual", { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] }],
  ["forging-skill-treatise", { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] }],
  ["farming-skill-handbook", { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] }],
]);
const framedTextileLayouts = new Map([
  ["timber-framed-woven-tapestry", {
    cloth: 8,
    frame: [0, 1, 2, 3, 4, 5, 6, 7],
    decorations: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  }],
]);
const drawerCabinetLayouts = new Map([
  ["timber-apothecary-drawer-cabinet", {
    frame: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    drawers: [11, 12, 13, 14, 15, 16],
    handles: [17, 18, 19, 20, 21, 22],
  }],
]);

assert.equal(catalog.schema, "nicechunk.ncf-item-catalog.v1");
assert.equal(catalog.version, 1);
assert.equal(catalog.items.length, 37);
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
let bookGeometryCount = 0;
let framedTextileGeometryCount = 0;
let drawerCabinetGeometryCount = 0;
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
  const bookLayout = bookLayouts.get(item.key);
  if (bookLayout) {
    bookGeometryCount += 1;
    assert.equal(item.category, "books-writing");
    assert.equal(item.preview.clothMotion, "rigid", `${item.key} must render its bound cloth as rigid`);
    assert.equal(item.verification.bookGeometryValidated, true);
    assertBookGeometry(item, runtime, bookLayout);
  } else if (item.category === "books-writing") {
    assert.fail(`${item.key} is missing its book geometry regression policy`);
  }
  const framedTextileLayout = framedTextileLayouts.get(item.key);
  if (framedTextileLayout) {
    framedTextileGeometryCount += 1;
    assert.equal(item.category, "interior-decor");
    assert.equal(item.preview.clothMotion, "rigid");
    assert.equal(item.verification.framedTextileGeometryValidated, true);
    assertFramedTextileGeometry(item, runtime, framedTextileLayout);
  }
  const drawerCabinetLayout = drawerCabinetLayouts.get(item.key);
  if (drawerCabinetLayout) {
    drawerCabinetGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.verification.drawerCabinetGeometryValidated, true);
    assertDrawerCabinetGeometry(item, runtime, drawerCabinetLayout);
  }
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
  ["furniture", 4],
  ["containers", 3],
  ["cooking", 2],
  ["books-writing", 7],
  ["interior-decor", 1],
]);
assert.equal(tools, 15);
assert.equal(placeables, 22);
assert.equal(conceptReferences, 13);
assert.equal(bookGeometryCount, 7);
assert.equal(framedTextileGeometryCount, 1);
assert.equal(drawerCabinetGeometryCount, 1);
assert.ok(runtimeCache.snapshot().residentBytes > 0);

console.log("item_ncm catalog tests passed: 37 canonical NCF1 items across 11 categories");

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

function assertBookGeometry(item, runtime, layout) {
  if (layout.portrait) {
    assert.ok(item.dimensions.sizeQ[2] > item.dimensions.sizeQ[0], `${item.key} cover must be portrait in its resting plane`);
  }
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  for (const { page, lower, upper = null } of layout.pageSets) {
    assert.equal(item.forge.materialComponents[page].materialId, "cotton_cloth", `${item.key} page ${page} must use current cotton cloth`);
    assert.equal(runtime.components[page].resourceId, "cloth");
    for (const cover of [lower, upper].filter((index) => index != null)) {
      for (const axis of [0, 2]) {
        assert.ok(bounds[page].min[axis] >= bounds[cover].min[axis], `${item.key} page ${page} escapes cover ${cover}`);
        assert.ok(bounds[page].max[axis] <= bounds[cover].max[axis], `${item.key} page ${page} escapes cover ${cover}`);
      }
    }
    assert.ok(bounds[page].min[1] >= bounds[lower].max[1], `${item.key} page ${page} crosses lower cover ${lower}`);
    if (upper != null) assert.ok(bounds[page].max[1] <= bounds[upper].min[1], `${item.key} page ${page} crosses upper cover ${upper}`);
    for (let index = 0; index < bounds.length; index += 1) {
      if (index === page) continue;
      assert.equal(positiveVolumeOverlap(bounds[page], bounds[index]), false, `${item.key} page ${page} intersects component ${index}`);
    }
  }
}

function componentBoundsQ(component) {
  return {
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  };
}

function positiveVolumeOverlap(left, right) {
  return [0, 1, 2].every((axis) => (
    Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]) > 0
  ));
}

function assertFramedTextileGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 22);
  assert.ok(item.dimensions.sizeQ[1] > item.dimensions.sizeQ[0]);
  assert.ok(item.dimensions.sizeQ[2] < item.dimensions.sizeQ[0] * 0.2);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["blue_dye", "cotton_cloth", "red_dye", "squared_timber", "wooden_plank", "yellow_dye"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const cloth = bounds[layout.cloth];
  const [left, right, bottom, top] = layout.frame.map((index) => bounds[index]);
  assert.equal(item.forge.materialComponents[layout.cloth].materialId, "cotton_cloth");
  assert.equal(runtime.components[layout.cloth].resourceId, "cloth");
  assert.equal(cloth.min[0], left.max[0]);
  assert.equal(cloth.max[0], right.min[0]);
  assert.equal(cloth.min[1], bottom.max[1]);
  assert.equal(cloth.max[1], top.min[1]);
  for (let index = 0; index < bounds.length; index += 1) {
    if (index === layout.cloth) continue;
    assert.equal(positiveVolumeOverlap(cloth, bounds[index]), false, `${item.key} cloth intersects component ${index}`);
  }
  for (const decorationIndex of layout.decorations) {
    const decoration = bounds[decorationIndex];
    assert.match(item.forge.materialComponents[decorationIndex].materialId, /_dye$/);
    assert.ok(decoration.min[0] >= cloth.min[0] && decoration.max[0] <= cloth.max[0]);
    assert.ok(decoration.min[1] >= cloth.min[1] && decoration.max[1] <= cloth.max[1]);
    assert.equal(decoration.min[2], cloth.max[2]);
  }
  for (let leftIndex = 0; leftIndex < layout.decorations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layout.decorations.length; rightIndex += 1) {
      const leftDecoration = layout.decorations[leftIndex];
      const rightDecoration = layout.decorations[rightIndex];
      assert.equal(
        positiveVolumeOverlap(bounds[leftDecoration], bounds[rightDecoration]),
        false,
        `${item.key} decorations ${leftDecoration} and ${rightDecoration} intersect`,
      );
    }
  }
}

function assertDrawerCabinetGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 23);
  assert.deepEqual(item.dimensions.sizeQ, [64, 78, 26]);
  assert.ok(item.dimensions.height > item.dimensions.width);
  assert.ok(item.dimensions.depth < item.dimensions.width * 0.5);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  assert.equal(layout.drawers.length, 6);
  assert.equal(layout.handles.length, 6);
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const expectedDrawerOffsets = [
    [-18, 21, 1], [0, 21, 1], [18, 21, 1],
    [-18, 51, 1], [0, 51, 1], [18, 51, 1],
  ];
  for (let position = 0; position < layout.drawers.length; position += 1) {
    const drawerIndex = layout.drawers[position];
    const handleIndex = layout.handles[position];
    const drawer = runtime.components[drawerIndex];
    const handle = runtime.components[handleIndex];
    assert.equal(item.forge.materialComponents[drawerIndex].materialId, "wooden_plank");
    assert.equal(item.forge.materialComponents[handleIndex].materialId, "iron_bloom");
    assert.deepEqual(drawer.dimsQ, [16, 26, 16]);
    assert.deepEqual(drawer.offsetQ, expectedDrawerOffsets[position]);
    assert.equal(handle.offsetQ[0], drawer.offsetQ[0]);
    assert.equal(handle.offsetQ[1], drawer.offsetQ[1]);
    assert.equal(bounds[handleIndex].min[2], bounds[drawerIndex].max[2]);
  }
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}
