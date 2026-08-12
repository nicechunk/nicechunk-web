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
const streetLanternLayouts = new Map([
  ["amber-village-street-lantern", {
    plinth: 0,
    post: 2,
    lowerPlate: 4,
    glass: 5,
    corners: [6, 7, 8, 9],
    upperPlate: 10,
  }],
]);
const publicBenchLayouts = new Map([
  ["iron-braced-village-public-bench", {
    seat: 0,
    backSlats: [1, 2],
    backPosts: [3, 4],
    legs: [5, 6, 7, 8],
    stretchers: [9, 10],
    sideBraces: [11, 12],
  }],
]);
const wallClockLayouts = new Map([
  ["copper-rimmed-village-wall-clock", {
    backplate: 0,
    outerFrame: [1, 2, 3, 4],
    hanger: [5, 6],
    dial: 7,
    bezel: 8,
    faceGlass: 9,
    hourStuds: 10,
    hands: 11,
    centerPin: 12,
    pendulumGlass: 13,
    pendulumFrame: [14, 15, 16, 17],
    pendulum: [18, 19],
  }],
]);
const shopSignLayouts = new Map([
  ["iron-bracketed-village-shop-sign", {
    wallPlate: 0,
    arm: 1,
    endCap: 2,
    brace: 3,
    hangers: [4, 5],
    board: 6,
    frame: [7, 8, 9, 10],
    cornerStuds: [11, 12, 13, 14],
    emblem: [15, 16],
  }],
]);
const noticeBoardLayouts = new Map([
  ["timber-village-public-notice-board", {
    feet: [0, 1],
    anchors: [2, 3],
    posts: [4, 5],
    boardSlats: [6, 7, 8, 9],
    sideFrame: [10, 11],
    crossFrame: [12, 13],
    fasteners: 14,
    header: 15,
    roof: [16, 17, 18],
    roofPins: [19, 20],
  }],
]);
const handbellLayouts = new Map([
  ["copper-town-crier-handbell", {
    handle: 0,
    collar: 1,
    body: 2,
    rim: 3,
    clapperStem: 4,
    clapper: 5,
  }],
]);

assert.equal(catalog.schema, "nicechunk.ncf-item-catalog.v1");
assert.equal(catalog.version, 1);
assert.equal(catalog.items.length, 46);
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
let streetLanternGeometryCount = 0;
let publicBenchGeometryCount = 0;
let wallClockGeometryCount = 0;
let shopSignGeometryCount = 0;
let noticeBoardGeometryCount = 0;
let handbellGeometryCount = 0;
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
  const streetLanternLayout = streetLanternLayouts.get(item.key);
  if (streetLanternLayout) {
    streetLanternGeometryCount += 1;
    assert.equal(item.category, "lighting");
    assert.equal(item.verification.streetLanternGeometryValidated, true);
    assertStreetLanternGeometry(item, runtime, streetLanternLayout);
  }
  const publicBenchLayout = publicBenchLayouts.get(item.key);
  if (publicBenchLayout) {
    publicBenchGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.verification.publicBenchGeometryValidated, true);
    assertPublicBenchGeometry(item, runtime, publicBenchLayout);
  }
  const wallClockLayout = wallClockLayouts.get(item.key);
  if (wallClockLayout) {
    wallClockGeometryCount += 1;
    assert.equal(item.category, "interior-decor");
    assert.equal(item.verification.wallClockGeometryValidated, true);
    assertWallClockGeometry(item, runtime, wallClockLayout);
  }
  const shopSignLayout = shopSignLayouts.get(item.key);
  if (shopSignLayout) {
    shopSignGeometryCount += 1;
    assert.equal(item.category, "signage");
    assert.equal(item.verification.shopSignGeometryValidated, true);
    assertShopSignGeometry(item, runtime, shopSignLayout);
  }
  const noticeBoardLayout = noticeBoardLayouts.get(item.key);
  if (noticeBoardLayout) {
    noticeBoardGeometryCount += 1;
    assert.equal(item.category, "signage");
    assert.equal(item.verification.noticeBoardGeometryValidated, true);
    assertNoticeBoardGeometry(item, runtime, noticeBoardLayout);
  }
  const handbellLayout = handbellLayouts.get(item.key);
  if (handbellLayout) {
    handbellGeometryCount += 1;
    assert.equal(item.category, "handheld-civic");
    assert.equal(item.interaction, "tool");
    assert.equal(item.verification.handbellGeometryValidated, true);
    assertHandbellGeometry(item, runtime, handbellLayout);
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
  ["workshop", 4],
  ["weapons", 3],
  ["building-fittings", 3],
  ["lighting", 4],
  ["handheld-civic", 1],
  ["furniture", 5],
  ["containers", 3],
  ["cooking", 2],
  ["commerce", 1],
  ["construction", 1],
  ["books-writing", 7],
  ["interior-decor", 2],
  ["signage", 2],
]);
assert.equal(tools, 16);
assert.equal(placeables, 30);
assert.equal(conceptReferences, 19);
assert.equal(bookGeometryCount, 7);
assert.equal(framedTextileGeometryCount, 1);
assert.equal(drawerCabinetGeometryCount, 1);
assert.equal(streetLanternGeometryCount, 1);
assert.equal(publicBenchGeometryCount, 1);
assert.equal(wallClockGeometryCount, 1);
assert.equal(shopSignGeometryCount, 1);
assert.equal(noticeBoardGeometryCount, 1);
assert.equal(handbellGeometryCount, 1);
assert.ok(runtimeCache.snapshot().residentBytes > 0);

console.log("item_ncm catalog tests passed: 46 canonical NCF1 items across 15 categories");

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

function assertStreetLanternGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 14);
  assert.deepEqual(item.dimensions.sizeQ, [36, 126, 36]);
  assert.ok(item.dimensions.height > item.dimensions.width * 3);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["amber_glass_panel", "basalt_brick", "copper_bloom", "iron_bloom", "polished_stone_slab"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const plinth = bounds[layout.plinth];
  const post = runtime.components[layout.post];
  const glass = bounds[layout.glass];
  const lowerPlate = bounds[layout.lowerPlate];
  const upperPlate = bounds[layout.upperPlate];
  assert.deepEqual(post.dimsQ, [6, 58, 6]);
  assert.deepEqual(post.offsetQ, [0, 47, 0]);
  assert.ok(plinth.max[0] - plinth.min[0] >= upperPlate.max[0] - upperPlate.min[0]);
  assert.equal(glass.min[1], lowerPlate.max[1]);
  assert.equal(glass.max[1], upperPlate.min[1]);
  assert.equal(item.forge.materialComponents[layout.glass].materialId, "amber_glass_panel");
  assert.deepEqual(
    layout.corners.map((index) => runtime.components[index].offsetQ),
    [[-12, 96, -12], [-12, 96, 12], [12, 96, -12], [12, 96, 12]],
  );
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}

function assertPublicBenchGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 13);
  assert.deepEqual(item.dimensions.sizeQ, [96, 58, 36]);
  assert.ok(item.dimensions.width >= 1.4 && item.dimensions.width <= 1.8);
  assert.ok(item.dimensions.height >= 0.8 && item.dimensions.height <= 1);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const seat = runtime.components[layout.seat];
  const seatBounds = bounds[layout.seat];
  assert.deepEqual(seat.dimsQ, [96, 6, 30]);
  assert.equal(seatBounds.max[1], 30);
  assert.deepEqual(
    layout.legs.map((index) => runtime.components[index].offsetQ),
    [[-38, 12, -10], [-38, 12, 10], [38, 12, -10], [38, 12, 10]],
  );
  for (const legIndex of layout.legs) assert.equal(bounds[legIndex].max[1], seatBounds.min[1]);
  const [leftPost, rightPost] = layout.backPosts.map((index) => bounds[index]);
  for (const slatIndex of layout.backSlats) {
    assert.equal(bounds[slatIndex].min[0], leftPost.max[0]);
    assert.equal(bounds[slatIndex].max[0], rightPost.min[0]);
    assert.equal(bounds[slatIndex].min[2], seatBounds.max[2]);
  }
  assert.deepEqual(layout.stretchers.map((index) => runtime.components[index].dimsQ), [[68, 4, 4], [68, 4, 4]]);
  assert.deepEqual(layout.sideBraces.map((index) => runtime.components[index].dimsQ), [[4, 4, 12], [4, 4, 12]]);
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}

function assertWallClockGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 20);
  assert.deepEqual(item.dimensions.sizeQ, [40, 68, 7]);
  assert.ok(item.dimensions.width >= 0.55 && item.dimensions.width <= 0.7);
  assert.ok(item.dimensions.height >= 0.9 && item.dimensions.height <= 1.15);
  assert.ok(item.dimensions.depth >= 0.08 && item.dimensions.depth <= 0.14);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["clear_glass_panel", "copper_bloom", "iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  assert.deepEqual(components[layout.backplate].dimsQ, [40, 64, 1]);
  assert.deepEqual(components[layout.backplate].offsetQ, [0, 0, 0]);
  assert.deepEqual(
    layout.outerFrame.map((index) => components[index].offsetQ),
    [[-18, 0, 1], [18, 0, 1], [0, 30, 1], [0, -30, 1]],
  );
  assert.deepEqual(layout.hanger.map((index) => components[index].offsetQ), [[0, 34, 1], [0, 34, 2]]);
  assert.deepEqual(components[layout.dial].offsetQ, [0, 10, 1]);
  assert.deepEqual(components[layout.bezel].offsetQ, [0, 10, 2]);
  assert.deepEqual(components[layout.faceGlass].offsetQ, [0, 10, 3]);
  assert.equal(bounds[layout.dial].max[2], bounds[layout.bezel].min[2]);
  assert.equal(bounds[layout.bezel].max[2], bounds[layout.faceGlass].min[2]);
  assert.deepEqual(components[layout.hourStuds].dimsQ, [28, 28, 1]);
  assert.deepEqual(components[layout.hands].dimsQ, [16, 16, 1]);
  assert.deepEqual(components[layout.centerPin].dimsQ, [3, 3, 1]);
  assert.equal(bounds[layout.hourStuds].min[2], bounds[layout.faceGlass].max[2]);
  assert.equal(bounds[layout.hands].min[2], bounds[layout.hourStuds].max[2]);
  assert.equal(bounds[layout.centerPin].min[2], bounds[layout.hands].max[2]);
  const pendulumGlass = bounds[layout.pendulumGlass];
  const [leftFrame, rightFrame, topFrame, bottomFrame] = layout.pendulumFrame.map((index) => bounds[index]);
  assert.equal(pendulumGlass.min[0], leftFrame.max[0]);
  assert.equal(pendulumGlass.max[0], rightFrame.min[0]);
  assert.equal(pendulumGlass.max[1], topFrame.min[1]);
  assert.equal(pendulumGlass.min[1], bottomFrame.max[1]);
  const [rod, bob] = layout.pendulum.map((index) => bounds[index]);
  assert.equal(rod.min[2], pendulumGlass.max[2]);
  assert.equal(bob.min[2], pendulumGlass.max[2]);
  assert.equal(rod.min[1], bob.max[1]);
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}

function assertShopSignGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 17);
  assert.deepEqual(item.dimensions.sizeQ, [70, 58, 5]);
  assert.ok(item.dimensions.width >= 1 && item.dimensions.width <= 1.15);
  assert.ok(item.dimensions.height >= 0.9 && item.dimensions.height <= 1);
  assert.ok(item.dimensions.depth >= 0.07 && item.dimensions.depth <= 0.09);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "red_dye", "squared_timber", "wooden_plank", "yellow_dye"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  assert.deepEqual(components[layout.wallPlate].dimsQ, [4, 56, 3]);
  assert.deepEqual(components[layout.arm].dimsQ, [60, 4, 3]);
  assert.deepEqual(components[layout.endCap].dimsQ, [6, 8, 4]);
  assert.equal(bounds[layout.wallPlate].max[0], bounds[layout.arm].min[0]);
  assert.equal(bounds[layout.arm].max[0], bounds[layout.endCap].min[0]);
  const [leftFrame, rightFrame, topFrame, bottomFrame] = layout.frame.map((index) => bounds[index]);
  const board = bounds[layout.board];
  assert.equal(board.min[0], leftFrame.max[0]);
  assert.equal(board.max[0], rightFrame.min[0]);
  assert.equal(board.max[1], topFrame.min[1]);
  assert.equal(board.min[1], bottomFrame.max[1]);
  for (const hangerIndex of layout.hangers) {
    assert.equal(bounds[hangerIndex].max[1], bounds[layout.arm].min[1]);
    assert.equal(bounds[hangerIndex].min[1], topFrame.max[1]);
  }
  for (const studIndex of layout.cornerStuds) assert.equal(bounds[studIndex].min[2], board.max[2]);
  assert.equal(bounds[layout.emblem[0]].min[2], board.max[2]);
  assert.equal(bounds[layout.emblem[1]].min[2], bounds[layout.emblem[0]].max[2]);
}

function assertNoticeBoardGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 21);
  assert.deepEqual(item.dimensions.sizeQ, [116, 122, 30]);
  assert.ok(item.dimensions.width >= 1.75 && item.dimensions.width <= 1.9);
  assert.ok(item.dimensions.height >= 1.85 && item.dimensions.height <= 1.95);
  assert.ok(item.dimensions.depth >= 0.4 && item.dimensions.depth <= 0.5);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "polished_stone_slab", "squared_timber", "wooden_plank", "wooden_stick"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  for (let position = 0; position < layout.posts.length; position += 1) {
    assert.equal(bounds[layout.feet[position]].min[1], 0);
    assert.equal(bounds[layout.feet[position]].max[1], bounds[layout.anchors[position]].min[1]);
    assert.equal(bounds[layout.anchors[position]].max[1], bounds[layout.posts[position]].min[1]);
    assert.equal(bounds[layout.posts[position]].max[1], bounds[layout.header].min[1]);
  }
  const [leftFrame, rightFrame] = layout.sideFrame.map((index) => bounds[index]);
  const [topFrame, bottomFrame] = layout.crossFrame.map((index) => bounds[index]);
  for (const slatIndex of layout.boardSlats) {
    assert.equal(bounds[slatIndex].min[0], leftFrame.max[0]);
    assert.equal(bounds[slatIndex].max[0], rightFrame.min[0]);
  }
  assert.equal(bottomFrame.max[1], bounds[layout.boardSlats[0]].min[1]);
  assert.equal(topFrame.min[1], bounds[layout.boardSlats.at(-1)].max[1]);
  assert.equal(bounds[layout.fasteners].min[2], bounds[layout.boardSlats[0]].max[2]);
  let previous = bounds[layout.header];
  for (const roofIndex of layout.roof) {
    assert.equal(previous.max[1], bounds[roofIndex].min[1]);
    previous = bounds[roofIndex];
  }
  for (const pinIndex of layout.roofPins) {
    assert.ok(bounds[pinIndex].min[1] <= bounds[layout.roof[0]].max[1]);
    assert.ok(bounds[pinIndex].max[1] >= bounds[layout.roof[2]].min[1]);
  }
}

function assertHandbellGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 6);
  assert.deepEqual(item.dimensions.sizeQ, [14, 30, 14]);
  assert.ok(item.dimensions.width >= 0.2 && item.dimensions.width <= 0.24);
  assert.ok(item.dimensions.height >= 0.45 && item.dimensions.height <= 0.5);
  assert.ok(item.dimensions.depth >= 0.2 && item.dimensions.depth <= 0.24);
  assert.ok(item.dimensions.height < 1.75 * 0.3, `${item.key} must remain a one-hand prop beside the canonical player`);
  assert.ok(item.forge.requirements.outputMassGrams <= 35_000, `${item.key} must not regress to a monumental bell mass`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["copper_bloom", "iron_bloom", "squared_timber"],
  );
  assert.deepEqual(item.holding, {
    gripComponentIndex: layout.handle,
    workComponentIndexes: [layout.collar, layout.body, layout.rim, layout.clapperStem, layout.clapper],
    lateralComponentGroups: [],
    sourceToAvatarAxes: ["+Y", "-Z", "-X"],
    testedPoseCount: 27,
  });
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  assert.equal(bounds[layout.handle].max[1], bounds[layout.collar].min[1]);
  assert.equal(bounds[layout.collar].max[1], bounds[layout.body].min[1]);
  assert.equal(bounds[layout.body].max[1], bounds[layout.rim].min[1]);
  assert.equal(bounds[layout.clapperStem].min[1], bounds[layout.collar].max[1]);
  assert.ok(bounds[layout.clapperStem].max[1] >= bounds[layout.rim].min[1]);
  assert.ok(bounds[layout.clapper].min[1] <= bounds[layout.rim].max[1]);
  assert.ok(bounds[layout.clapper].max[1] >= bounds[layout.rim].max[1]);
  assert.ok(item.forge.materialComponents[layout.body].usedVolumeMm3 < item.forge.materialComponents[layout.body].inputVolumeMm3);
  assert.ok(item.forge.materialComponents[layout.rim].usedVolumeMm3 < item.forge.materialComponents[layout.rim].inputVolumeMm3);
}
