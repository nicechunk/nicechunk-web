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
const windowBoxLayouts = new Map([
  ["iron-braced-village-window-box-planter", {
    back: 0,
    front: 1,
    sides: [2, 3],
    floor: 4,
    soil: 5,
    cornerBands: [6, 7],
    brackets: [8, 9, 10, 11],
    blooms: [12, 13, 14],
  }],
]);
const drinkingTroughLayouts = new Map([
  ["stone-and-timber-village-drinking-trough", {
    feet: [0, 1],
    floor: 2,
    walls: [3, 4, 5, 6],
    water: 7,
    timberRail: 8,
    spout: 9,
    spoutMouth: 10,
  }],
]);
const roadsideWellLayouts = new Map([
  ["stone-and-timber-village-roadside-well", {
    foundation: 0,
    curbWalls: [1, 2, 3, 4],
    postFeet: [5, 6],
    posts: [7, 8],
    postCaps: [9, 10],
    crossbeam: 11,
    spindle: 12,
    rope: 13,
    bucket: 14,
    crankAxle: 15,
    crankDrop: 16,
    crankGrip: 17,
  }],
]);
const directionSignpostLayouts = new Map([
  ["stone-and-timber-village-roadside-direction-signpost", {
    foundation: 0,
    plinth: 1,
    postFoot: 2,
    post: 3,
    topCollar: 4,
    cap: 5,
    boards: [6, 9, 12],
    arrowheads: [7, 10, 13],
    facePlates: [8, 11, 14],
    directions: [-1, 1, -1],
  }],
]);
const publicLitterBinLayouts = new Map([
  ["iron-braced-village-public-litter-bin", {
    feet: [0, 1, 2, 3],
    floor: 4,
    walls: [5, 6, 7, 8],
    lowerBands: [9, 10, 11, 12],
    middleBands: [13, 14, 15, 16],
    rim: [17, 18, 19, 20],
    handle: [21, 22, 23],
  }],
]);
const coatRackLayouts = new Map([
  ["iron-braced-timber-village-inn-coat-rack", {
    foundation: 0,
    feet: [1, 2, 3, 4],
    baseCollar: 5,
    lowerPost: 6,
    middleCollar: 7,
    upperPost: 8,
    upperCollar: 9,
    cap: 10,
    lowerHooks: [
      { root: 11, arm: 12, stop: 13, axis: 0, direction: 1 },
      { root: 14, arm: 15, stop: 16, axis: 0, direction: -1 },
    ],
    upperHooks: [
      { root: 17, arm: 18, stop: 19, axis: 2, direction: 1 },
      { root: 20, arm: 21, stop: 22, axis: 2, direction: -1 },
    ],
  }],
]);
const bedsideTableLayouts = new Map([
  ["iron-braced-timber-village-inn-bedside-table", {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    shelf: 8,
    upperCollars: [9, 10, 11, 12],
    top: 13,
    drawer: 14,
    handle: 15,
    topCaps: [16, 17, 18, 19],
  }],
]);
const washstandLayouts = new Map([
  ["copper-basin-timber-village-inn-washstand", {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    shelf: 8,
    upperCollars: [9, 10, 11, 12],
    basinFloor: 13,
    basinWalls: [14, 15, 16, 17],
    towelRail: [18, 19, 20],
  }],
]);
const singleBedFrameLayouts = new Map([
  ["iron-braced-timber-village-inn-single-bed-frame", {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    sideRails: [8, 9],
    headRails: [10, 11],
    headSlats: [12, 13, 14],
    footboard: 15,
    supportSlats: [16, 17, 18, 19],
    caps: [20, 21, 22, 23],
  }],
]);
const roomKeyBoardLayouts = new Map([
  ["iron-hooked-timber-village-inn-room-key-board", {
    board: 0,
    frame: [1, 2, 3, 4],
    hangers: [5, 6],
    labels: [7, 8, 9, 10, 11, 12],
    hooks: [13, 14, 15, 16, 17, 18],
  }],
]);
const receptionCounterLayouts = new Map([
  ["iron-braced-timber-village-inn-reception-counter", {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    frontBeams: [8, 9],
    frontPanels: [10, 11, 12],
    countertop: 13,
    staffShelves: [14, 15],
    sideAprons: [16, 17],
    ironBands: [18, 19],
  }],
]);
const luggageRackLayouts = new Map([
  ["iron-braced-timber-village-inn-luggage-rack", {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    upperRails: [8, 9],
    luggageSlats: [10, 11, 12, 13],
    lowerRails: [14, 15],
    shoeSlats: [16, 17, 18, 19],
    cornerPlates: [20, 21, 22, 23],
  }],
]);
const writingDeskLayouts = new Map([
  ["iron-braced-timber-village-inn-writing-desk", {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    desktop: 8,
    frontAprons: [9, 10],
    drawer: 11,
    handle: 12,
    backApron: 13,
    sideAprons: [14, 15],
    rearStretcher: 16,
    cornerPlates: [17, 18, 19, 20],
  }],
]);
const writingChairLayouts = new Map([
  ["iron-braced-timber-village-inn-writing-chair", {
    feet: [0, 1, 2, 3],
    frontLegs: [4, 5],
    rearPosts: [6, 7],
    seat: 8,
    backSlats: [9, 10],
    frontStretcher: 11,
    sideStretchers: [12, 13],
    rearStretcher: 14,
    seatPlates: [15, 16, 17, 18],
  }],
]);
const wallMirrorLayouts = new Map([
  ["polished-copper-timber-village-inn-wall-mirror", {
    backplate: 0,
    frame: [1, 2, 3, 4],
    mirrorFace: 5,
    hangers: [6, 7],
    cornerPlates: [8, 9, 10, 11],
  }],
]);
const privacyScreenLayouts = new Map([
  ["iron-hinged-timber-village-inn-privacy-screen", {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    panels: [
      { bottomRail: 8, topRail: 9, cloth: 14, leftPost: 4, rightPost: 5 },
      { bottomRail: 10, topRail: 11, cloth: 15, leftPost: 5, rightPost: 6 },
      { bottomRail: 12, topRail: 13, cloth: 16, leftPost: 6, rightPost: 7 },
    ],
    hingePlates: [17, 18, 19, 20],
  }],
]);
const doubleDoorWardrobeLayouts = new Map([
  ["iron-braced-timber-village-inn-double-door-wardrobe", {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    floor: 8,
    sidePanels: [9, 10],
    backPanel: 11,
    doors: [12, 13],
    bottomRail: 14,
    topRail: 15,
    topSlab: 16,
    crown: 17,
    doorStraps: [18, 19, 20, 21],
    pulls: [22, 23],
  }],
]);
const hearthFireplaceLayouts = new Map([
  ["stone-and-iron-village-inn-hearth-fireplace", {
    hearth: 0,
    lowerPiers: [1, 2],
    upperPiers: [3, 4],
    backPanels: [5, 6],
    lintel: 7,
    mantel: 8,
    chimneyBreast: 9,
    chimneyCrown: 10,
    grateFeet: [11, 12],
    grateSideRails: [13, 14],
    grateBars: [15, 16, 17],
    charcoalBed: 18,
    mantelBrackets: [19, 20],
    grateEndRails: [21, 22],
  }],
]);

assert.equal(catalog.schema, "nicechunk.ncf-item-catalog.v1");
assert.equal(catalog.version, 1);
assert.equal(catalog.items.length, 64);
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
let windowBoxGeometryCount = 0;
let drinkingTroughGeometryCount = 0;
let roadsideWellGeometryCount = 0;
let directionSignpostGeometryCount = 0;
let publicLitterBinGeometryCount = 0;
let coatRackGeometryCount = 0;
let bedsideTableGeometryCount = 0;
let washstandGeometryCount = 0;
let singleBedFrameGeometryCount = 0;
let roomKeyBoardGeometryCount = 0;
let receptionCounterGeometryCount = 0;
let luggageRackGeometryCount = 0;
let writingDeskGeometryCount = 0;
let writingChairGeometryCount = 0;
let wallMirrorGeometryCount = 0;
let privacyScreenGeometryCount = 0;
let doubleDoorWardrobeGeometryCount = 0;
let hearthFireplaceGeometryCount = 0;
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
  const windowBoxLayout = windowBoxLayouts.get(item.key);
  if (windowBoxLayout) {
    windowBoxGeometryCount += 1;
    assert.equal(item.category, "exterior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.windowBoxGeometryValidated, true);
    assertWindowBoxGeometry(item, runtime, windowBoxLayout);
  }
  const drinkingTroughLayout = drinkingTroughLayouts.get(item.key);
  if (drinkingTroughLayout) {
    drinkingTroughGeometryCount += 1;
    assert.equal(item.category, "exterior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.drinkingTroughGeometryValidated, true);
    assertDrinkingTroughGeometry(item, runtime, drinkingTroughLayout);
  }
  const roadsideWellLayout = roadsideWellLayouts.get(item.key);
  if (roadsideWellLayout) {
    roadsideWellGeometryCount += 1;
    assert.equal(item.category, "exterior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.roadsideWellGeometryValidated, true);
    assertRoadsideWellGeometry(item, runtime, roadsideWellLayout);
  }
  const directionSignpostLayout = directionSignpostLayouts.get(item.key);
  if (directionSignpostLayout) {
    directionSignpostGeometryCount += 1;
    assert.equal(item.category, "exterior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.directionSignpostGeometryValidated, true);
    assertDirectionSignpostGeometry(item, runtime, directionSignpostLayout);
  }
  const publicLitterBinLayout = publicLitterBinLayouts.get(item.key);
  if (publicLitterBinLayout) {
    publicLitterBinGeometryCount += 1;
    assert.equal(item.category, "exterior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.publicLitterBinGeometryValidated, true);
    assertPublicLitterBinGeometry(item, runtime, publicLitterBinLayout);
  }
  const coatRackLayout = coatRackLayouts.get(item.key);
  if (coatRackLayout) {
    coatRackGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.coatRackGeometryValidated, true);
    assertCoatRackGeometry(item, runtime, coatRackLayout);
  }
  const bedsideTableLayout = bedsideTableLayouts.get(item.key);
  if (bedsideTableLayout) {
    bedsideTableGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.bedsideTableGeometryValidated, true);
    assertBedsideTableGeometry(item, runtime, bedsideTableLayout);
  }
  const washstandLayout = washstandLayouts.get(item.key);
  if (washstandLayout) {
    washstandGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.washstandGeometryValidated, true);
    assertWashstandGeometry(item, runtime, washstandLayout);
  }
  const singleBedFrameLayout = singleBedFrameLayouts.get(item.key);
  if (singleBedFrameLayout) {
    singleBedFrameGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.singleBedFrameGeometryValidated, true);
    assertSingleBedFrameGeometry(item, runtime, singleBedFrameLayout);
  }
  const roomKeyBoardLayout = roomKeyBoardLayouts.get(item.key);
  if (roomKeyBoardLayout) {
    roomKeyBoardGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.roomKeyBoardGeometryValidated, true);
    assertRoomKeyBoardGeometry(item, runtime, roomKeyBoardLayout);
  }
  const receptionCounterLayout = receptionCounterLayouts.get(item.key);
  if (receptionCounterLayout) {
    receptionCounterGeometryCount += 1;
    assert.equal(item.category, "commerce");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.receptionCounterGeometryValidated, true);
    assertReceptionCounterGeometry(item, runtime, receptionCounterLayout);
  }
  const luggageRackLayout = luggageRackLayouts.get(item.key);
  if (luggageRackLayout) {
    luggageRackGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.luggageRackGeometryValidated, true);
    assertLuggageRackGeometry(item, runtime, luggageRackLayout);
  }
  const writingDeskLayout = writingDeskLayouts.get(item.key);
  if (writingDeskLayout) {
    writingDeskGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.writingDeskGeometryValidated, true);
    assertWritingDeskGeometry(item, runtime, writingDeskLayout);
  }
  const writingChairLayout = writingChairLayouts.get(item.key);
  if (writingChairLayout) {
    writingChairGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.writingChairGeometryValidated, true);
    assertWritingChairGeometry(item, runtime, writingChairLayout);
  }
  const wallMirrorLayout = wallMirrorLayouts.get(item.key);
  if (wallMirrorLayout) {
    wallMirrorGeometryCount += 1;
    assert.equal(item.category, "interior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.wallMirrorGeometryValidated, true);
    assertWallMirrorGeometry(item, runtime, wallMirrorLayout);
  }
  const privacyScreenLayout = privacyScreenLayouts.get(item.key);
  if (privacyScreenLayout) {
    privacyScreenGeometryCount += 1;
    assert.equal(item.category, "interior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.preview.clothMotion, "rigid");
    assert.equal(item.verification.privacyScreenGeometryValidated, true);
    assertPrivacyScreenGeometry(item, runtime, privacyScreenLayout);
  }
  const doubleDoorWardrobeLayout = doubleDoorWardrobeLayouts.get(item.key);
  if (doubleDoorWardrobeLayout) {
    doubleDoorWardrobeGeometryCount += 1;
    assert.equal(item.category, "furniture");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.doubleDoorWardrobeGeometryValidated, true);
    assertDoubleDoorWardrobeGeometry(item, runtime, doubleDoorWardrobeLayout);
  }
  const hearthFireplaceLayout = hearthFireplaceLayouts.get(item.key);
  if (hearthFireplaceLayout) {
    hearthFireplaceGeometryCount += 1;
    assert.equal(item.category, "interior-decor");
    assert.equal(item.interaction, "placeable");
    assert.equal(item.verification.hearthFireplaceGeometryValidated, true);
    assertHearthFireplaceGeometry(item, runtime, hearthFireplaceLayout);
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
  ["furniture", 14],
  ["containers", 3],
  ["cooking", 2],
  ["commerce", 2],
  ["construction", 1],
  ["books-writing", 7],
  ["interior-decor", 5],
  ["signage", 2],
  ["exterior-decor", 5],
]);
assert.equal(tools, 16);
assert.equal(placeables, 48);
assert.equal(conceptReferences, 37);
assert.equal(bookGeometryCount, 7);
assert.equal(framedTextileGeometryCount, 1);
assert.equal(drawerCabinetGeometryCount, 1);
assert.equal(streetLanternGeometryCount, 1);
assert.equal(publicBenchGeometryCount, 1);
assert.equal(wallClockGeometryCount, 1);
assert.equal(shopSignGeometryCount, 1);
assert.equal(noticeBoardGeometryCount, 1);
assert.equal(handbellGeometryCount, 1);
assert.equal(windowBoxGeometryCount, 1);
assert.equal(drinkingTroughGeometryCount, 1);
assert.equal(roadsideWellGeometryCount, 1);
assert.equal(directionSignpostGeometryCount, 1);
assert.equal(publicLitterBinGeometryCount, 1);
assert.equal(coatRackGeometryCount, 1);
assert.equal(bedsideTableGeometryCount, 1);
assert.equal(washstandGeometryCount, 1);
assert.equal(singleBedFrameGeometryCount, 1);
assert.equal(roomKeyBoardGeometryCount, 1);
assert.equal(receptionCounterGeometryCount, 1);
assert.equal(luggageRackGeometryCount, 1);
assert.equal(writingDeskGeometryCount, 1);
assert.equal(writingChairGeometryCount, 1);
assert.equal(wallMirrorGeometryCount, 1);
assert.equal(privacyScreenGeometryCount, 1);
assert.equal(doubleDoorWardrobeGeometryCount, 1);
assert.equal(hearthFireplaceGeometryCount, 1);
assert.ok(runtimeCache.snapshot().residentBytes > 0);

console.log("item_ncm catalog tests passed: 64 canonical NCF1 items across 16 categories");

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

function assertWindowBoxGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 15);
  assert.deepEqual(item.dimensions.sizeQ, [80, 42, 24]);
  assert.ok(item.dimensions.width >= 1.2 && item.dimensions.width <= 1.3);
  assert.ok(item.dimensions.height >= 0.62 && item.dimensions.height <= 0.68);
  assert.ok(item.dimensions.depth >= 0.35 && item.dimensions.depth <= 0.4);
  assert.ok(item.forge.requirements.outputMassGrams <= 75_000, `${item.key} must remain practical for a residential window wall`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["biochar_compost", "blue_dye", "iron_bloom", "red_dye", "wooden_plank", "yellow_dye"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const back = bounds[layout.back];
  const front = bounds[layout.front];
  const floor = bounds[layout.floor];
  const soil = bounds[layout.soil];
  const [leftSide, rightSide] = layout.sides.map((index) => bounds[index]);
  assert.equal(floor.min[0], back.min[0]);
  assert.equal(floor.max[0], back.max[0]);
  assert.equal(floor.min[2], back.max[2]);
  assert.equal(floor.max[2], front.min[2]);
  assert.equal(leftSide.max[0], back.min[0]);
  assert.equal(rightSide.min[0], back.max[0]);
  assert.ok(soil.min[1] >= floor.max[1]);
  assert.ok(soil.max[1] <= back.max[1]);
  for (let index = 0; index < layout.brackets.length; index += 2) {
    const upright = bounds[layout.brackets[index]];
    const shelf = bounds[layout.brackets[index + 1]];
    assert.equal(upright.max[1], floor.min[1]);
    assert.equal(shelf.max[1], floor.min[1]);
    assert.equal(upright.max[2], shelf.min[2]);
    assert.equal(shelf.max[2], front.min[2]);
  }
  for (const bloomIndex of layout.blooms) {
    assert.ok(bounds[bloomIndex].min[1] <= soil.max[1]);
    assert.ok(bounds[bloomIndex].max[1] > soil.max[1]);
  }
}

function assertDrinkingTroughGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 11);
  assert.deepEqual(item.dimensions.sizeQ, [105, 38, 42]);
  assert.ok(item.dimensions.width >= 1.6 && item.dimensions.width <= 1.7);
  assert.ok(item.dimensions.height >= 0.55 && item.dimensions.height <= 0.65);
  assert.ok(item.dimensions.depth >= 0.6 && item.dimensions.depth <= 0.7);
  assert.ok(item.forge.requirements.outputMassGrams <= 1_250_000, `${item.key} must remain a compact street fixture rather than monumental masonry`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["ice_blue_glass_panel", "iron_bloom", "polished_stone_slab", "squared_timber"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const floor = bounds[layout.floor];
  const [back, front, left, right] = layout.walls.map((index) => bounds[index]);
  const water = bounds[layout.water];
  assert.equal(floor.max[1], back.min[1]);
  assert.equal(floor.max[1], front.min[1]);
  assert.equal(floor.max[1], left.min[1]);
  assert.equal(floor.max[1], right.min[1]);
  assert.equal(water.min[0], left.max[0]);
  assert.equal(water.max[0], right.min[0]);
  assert.equal(water.min[2], back.max[2]);
  assert.equal(water.max[2], front.min[2]);
  assert.ok(water.max[1] < back.max[1]);
  for (const footIndex of layout.feet) {
    assert.equal(bounds[footIndex].min[1], 0);
    assert.equal(bounds[footIndex].max[1], floor.min[1]);
  }
  assert.equal(bounds[layout.timberRail].max[2], back.min[2]);
  assert.equal(bounds[layout.spout].max[2], bounds[layout.spoutMouth].min[2]);
}

function assertRoadsideWellGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 18);
  assert.deepEqual(item.dimensions.sizeQ, [100, 118, 66]);
  assert.ok(item.dimensions.width >= 1.5 && item.dimensions.width <= 1.6);
  assert.ok(item.dimensions.height >= 1.8 && item.dimensions.height <= 1.9);
  assert.ok(item.dimensions.depth >= 1 && item.dimensions.depth <= 1.1);
  assert.ok(item.forge.rawBytes <= 640);
  assert.ok(item.forge.requirements.outputMassGrams <= 350_000, `${item.key} must remain a compact village fixture rather than monumental masonry`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "polished_stone_slab", "squared_timber", "wooden_stick"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const foundation = bounds[layout.foundation];
  const [back, front, left, right] = layout.curbWalls.map((index) => bounds[index]);
  assert.equal(foundation.min[1], 0);
  for (const curb of [back, front, left, right]) assert.equal(curb.min[1], foundation.max[1]);
  assert.equal(back.max[2], left.min[2]);
  assert.equal(front.min[2], left.max[2]);
  for (let index = 0; index < layout.posts.length; index += 1) {
    const foot = bounds[layout.postFeet[index]];
    const post = bounds[layout.posts[index]];
    const cap = bounds[layout.postCaps[index]];
    assert.equal(foot.min[1], back.max[1]);
    assert.equal(foot.max[1], post.min[1]);
    assert.equal(post.max[1], cap.min[1]);
  }
  const [leftPost, rightPost] = layout.posts.map((index) => bounds[index]);
  const crossbeam = bounds[layout.crossbeam];
  const spindle = bounds[layout.spindle];
  assert.equal(crossbeam.min[0], bounds[layout.postCaps[0]].max[0]);
  assert.equal(crossbeam.max[0], bounds[layout.postCaps[1]].min[0]);
  assert.equal(spindle.min[0], leftPost.max[0]);
  assert.equal(spindle.max[0], rightPost.min[0]);
  const rope = bounds[layout.rope];
  const bucket = bounds[layout.bucket];
  assert.equal(rope.max[1], spindle.min[1]);
  assert.equal(rope.min[1], bucket.max[1]);
  assert.ok(bucket.min[0] > left.max[0] && bucket.max[0] < right.min[0]);
  assert.ok(bucket.min[2] > back.max[2] && bucket.max[2] < front.min[2]);
  assert.ok(item.forge.materialComponents[layout.bucket].usedVolumeMm3 < item.forge.materialComponents[layout.bucket].inputVolumeMm3);
  const crankAxle = bounds[layout.crankAxle];
  const crankDrop = bounds[layout.crankDrop];
  const crankGrip = bounds[layout.crankGrip];
  assert.equal(crankAxle.min[0], rightPost.max[0]);
  assert.equal(crankAxle.max[0], crankDrop.min[0]);
  assert.equal(crankDrop.max[0], crankGrip.min[0]);
  assert.ok(crankGrip.max[0] > foundation.max[0]);
}

function assertDirectionSignpostGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 15);
  assert.deepEqual(item.dimensions.sizeQ, [114, 112, 32]);
  assert.ok(item.dimensions.width >= 1.75 && item.dimensions.width <= 1.8);
  assert.equal(item.dimensions.height, 1.75);
  assert.equal(item.dimensions.depth, 0.5);
  assert.ok(item.forge.rawBytes <= 320);
  assert.ok(item.forge.requirements.outputMassGrams <= 325_000, `${item.key} must remain a compact roadside fixture rather than a monument`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "polished_stone_slab", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const foundation = bounds[layout.foundation];
  const plinth = bounds[layout.plinth];
  const postFoot = bounds[layout.postFoot];
  const post = bounds[layout.post];
  const collar = bounds[layout.topCollar];
  const cap = bounds[layout.cap];
  assert.equal(foundation.min[1], 0);
  assert.equal(foundation.max[1], plinth.min[1]);
  assert.equal(plinth.max[1], postFoot.min[1]);
  assert.equal(postFoot.max[1], post.min[1]);
  assert.equal(post.max[1], collar.min[1]);
  assert.equal(collar.max[1], cap.min[1]);
  for (let position = 0; position < layout.boards.length; position += 1) {
    const board = bounds[layout.boards[position]];
    const arrowhead = bounds[layout.arrowheads[position]];
    const plate = bounds[layout.facePlates[position]];
    const direction = layout.directions[position];
    assert.equal(direction < 0 ? board.max[0] : board.min[0], direction < 0 ? post.min[0] : post.max[0]);
    assert.equal(direction < 0 ? arrowhead.max[0] : arrowhead.min[0], direction < 0 ? board.min[0] : board.max[0]);
    assert.equal(plate.min[2], board.max[2]);
    assert.ok(item.forge.materialComponents[layout.arrowheads[position]].usedVolumeMm3
      < item.forge.materialComponents[layout.arrowheads[position]].inputVolumeMm3);
  }
  const heights = layout.boards.map((index) => components[index].offsetQ[1]);
  assert.ok(heights[0] > heights[1] && heights[1] > heights[2]);
  assert.ok(bounds[layout.arrowheads[0]].min[0] < foundation.min[0]);
  assert.ok(bounds[layout.arrowheads[1]].max[0] > foundation.max[0]);
  assert.ok(bounds[layout.arrowheads[2]].min[0] < foundation.min[0]);
}

function assertPublicLitterBinGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 24);
  assert.deepEqual(item.dimensions.sizeQ, [36, 50, 38]);
  assert.ok(item.dimensions.width >= 0.55 && item.dimensions.width <= 0.6);
  assert.ok(item.dimensions.height >= 0.75 && item.dimensions.height <= 0.8);
  assert.ok(item.dimensions.depth >= 0.58 && item.dimensions.depth <= 0.62);
  assert.ok(item.forge.rawBytes <= 320);
  assert.ok(item.forge.requirements.outputMassGrams <= 175_000, `${item.key} must remain a movable street fixture`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const floor = bounds[layout.floor];
  const [back, front, left, right] = layout.walls.map((index) => bounds[index]);
  for (const footIndex of layout.feet) {
    assert.equal(bounds[footIndex].min[1], 0);
    assert.equal(bounds[footIndex].max[1], floor.min[1]);
  }
  assert.ok(floor.min[1] <= back.min[1] && floor.max[1] >= back.min[1]);
  assert.ok(floor.min[1] <= front.min[1] && floor.max[1] >= front.min[1]);
  assert.ok(floor.min[1] <= left.min[1] && floor.max[1] >= left.min[1]);
  assert.ok(floor.min[1] <= right.min[1] && floor.max[1] >= right.min[1]);
  assert.equal(back.max[2], left.min[2]);
  assert.equal(front.min[2], left.max[2]);
  assert.equal(right.min[0] - left.max[0], 28);
  assert.equal(front.min[2] - back.max[2], 28);
  for (const [indexes, expectedY] of [[layout.lowerBands, 18], [layout.middleBands, 30], [layout.rim, 44]]) {
    for (const index of indexes) assert.equal(components[index].offsetQ[1], expectedY);
  }
  const [leftMount, rightMount, grip] = layout.handle.map((index) => bounds[index]);
  assert.equal(leftMount.max[1], grip.min[1]);
  assert.equal(rightMount.max[1], grip.min[1]);
  assert.equal(grip.min[0], leftMount.max[0]);
  assert.equal(grip.max[0], rightMount.min[0]);
  assert.ok(leftMount.min[2] <= front.max[2] + 2 && leftMount.max[2] > front.max[2]);
  assert.ok(rightMount.min[2] <= front.max[2] + 2 && rightMount.max[2] > front.max[2]);
}

function assertCoatRackGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 23);
  assert.deepEqual(item.dimensions.sizeQ, [66, 112, 66]);
  assert.equal(item.dimensions.width, 1.0313);
  assert.equal(item.dimensions.height, 1.75);
  assert.equal(item.dimensions.depth, 1.0313);
  assert.ok(item.forge.rawBytes <= 320);
  assert.ok(item.forge.requirements.outputMassGrams <= 125_000, `${item.key} must remain a movable inn furnishing`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_stick"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const foundation = bounds[layout.foundation];
  const baseCollar = bounds[layout.baseCollar];
  const lowerPost = bounds[layout.lowerPost];
  const middleCollar = bounds[layout.middleCollar];
  const upperPost = bounds[layout.upperPost];
  const upperCollar = bounds[layout.upperCollar];
  const cap = bounds[layout.cap];
  assert.equal(foundation.min[1], 0);
  assert.equal(foundation.max[1], baseCollar.min[1]);
  assert.equal(baseCollar.max[1], lowerPost.min[1]);
  assert.equal(lowerPost.max[1], middleCollar.min[1]);
  assert.equal(middleCollar.max[1], upperPost.min[1]);
  assert.equal(upperPost.max[1], upperCollar.min[1]);
  assert.equal(upperCollar.max[1], cap.min[1]);
  assert.deepEqual(layout.feet.map((index) => components[index].offsetQ), [
    [13, 2, 0], [-13, 2, 0], [0, 2, 13], [0, 2, -13],
  ]);
  for (const index of layout.feet) assert.equal(bounds[index].min[1], 0);
  for (const [hooks, collarIndex] of [
    [layout.lowerHooks, layout.middleCollar],
    [layout.upperHooks, layout.upperCollar],
  ]) {
    const collar = bounds[collarIndex];
    for (const { root, arm, stop, axis, direction } of hooks) {
      const rootBounds = bounds[root];
      const armBounds = bounds[arm];
      const stopBounds = bounds[stop];
      assert.equal(direction > 0 ? rootBounds.min[axis] : rootBounds.max[axis], direction > 0 ? collar.max[axis] : collar.min[axis]);
      assert.equal(direction > 0 ? armBounds.min[axis] : armBounds.max[axis], direction > 0 ? rootBounds.max[axis] : rootBounds.min[axis]);
      assert.equal(direction > 0 ? stopBounds.min[axis] : stopBounds.max[axis], direction > 0 ? armBounds.max[axis] : armBounds.min[axis]);
      assert.ok(stopBounds.max[1] > armBounds.max[1]);
    }
  }
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}

function assertBedsideTableGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 20);
  assert.deepEqual(item.dimensions.sizeQ, [44, 48, 34]);
  assert.equal(item.dimensions.width, 0.6875);
  assert.equal(item.dimensions.height, 0.75);
  assert.equal(item.dimensions.depth, 0.5313);
  assert.ok(item.forge.rawBytes <= 300);
  assert.ok(item.forge.requirements.outputMassGrams <= 125_000, `${item.key} must remain a movable bedside furnishing`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const top = bounds[layout.top];
  const shelf = bounds[layout.shelf];
  const drawer = bounds[layout.drawer];
  const handle = bounds[layout.handle];
  assert.equal(top.max[0] - top.min[0], 44);
  assert.equal(top.max[2] - top.min[2], 34);
  assert.ok(shelf.max[1] < drawer.min[1]);
  assert.equal(drawer.max[1], bounds[layout.upperCollars[0]].min[1]);
  assert.equal(handle.min[2], drawer.max[2]);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const collar = bounds[layout.upperCollars[position]];
    const cap = bounds[layout.topCaps[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], leg.min[1]);
    assert.equal(leg.max[1], collar.min[1]);
    assert.equal(collar.max[1], top.min[1]);
    assert.equal(cap.min[1], top.max[1]);
  }
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      assert.equal(positiveVolumeOverlap(bounds[left], bounds[right]), false, `${item.key} components ${left} and ${right} intersect`);
    }
  }
}

function assertWashstandGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 21);
  assert.deepEqual(item.dimensions.sizeQ, [44, 56, 42]);
  assert.equal(item.dimensions.width, 0.6875);
  assert.equal(item.dimensions.height, 0.875);
  assert.equal(item.dimensions.depth, 0.6563);
  assert.ok(item.forge.rawBytes <= 300);
  assert.ok(item.forge.requirements.outputMassGrams <= 350_000, `${item.key} must remain a movable inn washstand`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["copper_bloom", "iron_bloom", "squared_timber", "wooden_plank", "wooden_stick"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const floor = bounds[layout.basinFloor];
  const [back, front, left, right] = layout.basinWalls.map((index) => bounds[index]);
  for (const index of [layout.basinFloor, ...layout.basinWalls]) {
    assert.equal(item.forge.materialComponents[index].materialId, "copper_bloom");
  }
  assert.equal(back.min[1], floor.max[1]);
  assert.equal(front.min[1], floor.max[1]);
  assert.equal(left.min[1], floor.max[1]);
  assert.equal(right.min[1], floor.max[1]);
  assert.equal(right.min[0] - left.max[0], 36);
  assert.equal(front.min[2] - back.max[2], 28);
  assert.equal(back.max[1] - floor.max[1], 10);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const collar = bounds[layout.upperCollars[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], leg.min[1]);
    assert.equal(leg.max[1], collar.min[1]);
    assert.equal(collar.max[1], floor.min[1]);
  }
  const [leftMount, rightMount, rail] = layout.towelRail.map((index) => bounds[index]);
  assert.equal(leftMount.min[2], bounds[layout.legs[1]].max[2]);
  assert.equal(rightMount.min[2], bounds[layout.legs[3]].max[2]);
  assert.equal(rail.min[0], leftMount.max[0]);
  assert.equal(rail.max[0], rightMount.min[0]);
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertSingleBedFrameGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 24);
  assert.deepEqual(item.dimensions.sizeQ, [58, 68, 122]);
  assert.equal(item.dimensions.width, 0.9063);
  assert.equal(item.dimensions.height, 1.0625);
  assert.equal(item.dimensions.depth, 1.9063);
  assert.ok(item.dimensions.depth > item.dimensions.width * 2);
  assert.ok(item.forge.rawBytes <= 320);
  assert.ok(item.forge.requirements.outputMassGrams <= 250_000, `${item.key} must remain a movable single bed frame`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    const cap = bounds[layout.caps[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], post.min[1]);
    assert.equal(post.max[1], cap.min[1]);
  }
  const [leftRail, rightRail] = layout.sideRails.map((index) => bounds[index]);
  const [leftHeadPost, rightHeadPost, leftFootPost, rightFootPost] = layout.posts.map((index) => bounds[index]);
  assert.equal(leftRail.min[2], leftHeadPost.max[2]);
  assert.equal(leftRail.max[2], leftFootPost.min[2]);
  assert.equal(rightRail.min[2], rightHeadPost.max[2]);
  assert.equal(rightRail.max[2], rightFootPost.min[2]);
  const [lowerHeadRail, upperHeadRail] = layout.headRails.map((index) => bounds[index]);
  for (const slatIndex of layout.headSlats) {
    assert.equal(bounds[slatIndex].min[1], lowerHeadRail.max[1]);
    assert.equal(bounds[slatIndex].max[1], upperHeadRail.min[1]);
  }
  for (const slatIndex of layout.supportSlats) {
    const slat = bounds[slatIndex];
    assert.equal(slat.min[0], leftRail.max[0]);
    assert.equal(slat.max[0], rightRail.min[0]);
  }
  assert.deepEqual(layout.supportSlats.map((index) => components[index].offsetQ[2]), [-36, -12, 12, 36]);
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertRoomKeyBoardGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 19);
  assert.deepEqual(item.dimensions.sizeQ, [48, 70, 17]);
  assert.equal(item.dimensions.width, 0.75);
  assert.equal(item.dimensions.height, 1.0938);
  assert.equal(item.dimensions.depth, 0.2656);
  assert.ok(item.dimensions.height > item.dimensions.width);
  assert.ok(item.dimensions.depth < item.dimensions.width * 0.4);
  assert.ok(item.forge.rawBytes <= 400);
  assert.ok(item.forge.requirements.outputMassGrams <= 80_000, `${item.key} must remain a wall-mountable reception fixture`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const board = bounds[layout.board];
  const [left, right, bottom, top] = layout.frame.map((index) => bounds[index]);
  assert.equal(board.min[0], left.max[0]);
  assert.equal(board.max[0], right.min[0]);
  assert.equal(board.min[1], bottom.max[1]);
  assert.equal(board.max[1], top.min[1]);
  for (const hangerIndex of layout.hangers) assert.equal(bounds[hangerIndex].min[1], top.max[1]);
  assert.deepEqual(layout.labels.map((index) => components[index].offsetQ.slice(0, 2)), [
    [-12, 47], [0, 47], [12, 47], [-12, 25], [0, 25], [12, 25],
  ]);
  assert.deepEqual(layout.hooks.map((index) => components[index].offsetQ.slice(0, 2)), [
    [-12, 36], [0, 36], [12, 36], [-12, 14], [0, 14], [12, 14],
  ]);
  for (let position = 0; position < layout.hooks.length; position += 1) {
    const hookIndex = layout.hooks[position];
    assert.equal(item.forge.materialComponents[hookIndex].materialId, "iron_bloom");
    assert.ok(item.forge.materialComponents[hookIndex].usedVolumeMm3 < item.forge.materialComponents[hookIndex].inputVolumeMm3);
    assert.equal(bounds[hookIndex].min[2], board.max[2]);
    assert.ok(bounds[hookIndex].max[2] > bounds[layout.labels[position]].max[2]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertReceptionCounterGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 20);
  assert.deepEqual(item.dimensions.sizeQ, [104, 68, 46]);
  assert.equal(item.dimensions.width, 1.625);
  assert.equal(item.dimensions.height, 1.0625);
  assert.equal(item.dimensions.depth, 0.7188);
  assert.ok(item.dimensions.height > 1 && item.dimensions.height < 1.15, `${item.key} countertop must stay near standing elbow height`);
  assert.ok(item.dimensions.width > 1.5 && item.dimensions.width < 1.8, `${item.key} must remain a practical two-person inn counter`);
  assert.ok(item.forge.rawBytes <= 280);
  assert.ok(item.forge.requirements.outputMassGrams <= 300_000, `${item.key} must remain a movable inn reception counter`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const countertop = bounds[layout.countertop];
  assert.equal(countertop.min[1], 60);
  assert.equal(countertop.max[1], 68);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], post.min[1]);
    assert.equal(post.max[1], countertop.min[1]);
  }
  const [lowerBeam, upperBeam] = layout.frontBeams.map((index) => bounds[index]);
  const [leftFrontPost, rightFrontPost] = [layout.posts[1], layout.posts[3]].map((index) => bounds[index]);
  for (const beam of [lowerBeam, upperBeam]) {
    assert.equal(beam.min[0], leftFrontPost.max[0]);
    assert.equal(beam.max[0], rightFrontPost.min[0]);
  }
  for (const panelIndex of layout.frontPanels) {
    const panel = bounds[panelIndex];
    assert.equal(panel.min[1], lowerBeam.max[1]);
    assert.equal(panel.max[1], upperBeam.min[1]);
    assert.equal(panel.min[2], lowerBeam.max[2]);
  }
  const [writingShelf, storageShelf] = layout.staffShelves.map((index) => bounds[index]);
  assert.ok(storageShelf.max[1] < writingShelf.min[1]);
  assert.ok(writingShelf.max[1] < countertop.min[1]);
  assert.equal(writingShelf.min[0], bounds[layout.posts[0]].max[0]);
  assert.equal(writingShelf.max[0], bounds[layout.posts[2]].min[0]);
  assert.equal(storageShelf.min[0], bounds[layout.posts[0]].max[0]);
  assert.equal(storageShelf.max[0], bounds[layout.posts[2]].min[0]);
  for (let position = 0; position < layout.sideAprons.length; position += 1) {
    const apron = bounds[layout.sideAprons[position]];
    assert.equal(apron.min[2], bounds[layout.posts[position * 2]].max[2]);
    assert.equal(apron.max[2], bounds[layout.posts[position * 2 + 1]].min[2]);
    assert.equal(apron.max[1], countertop.min[1]);
  }
  for (let position = 0; position < layout.ironBands.length; position += 1) {
    const band = bounds[layout.ironBands[position]];
    const beam = bounds[layout.frontBeams[position]];
    assert.equal(band.min[2], beam.max[2]);
    assert.equal(band.min[0], beam.min[0]);
    assert.equal(band.max[0], beam.max[0]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertLuggageRackGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 24);
  assert.deepEqual(item.dimensions.sizeQ, [50, 40, 32]);
  assert.equal(item.dimensions.width, 0.7813);
  assert.equal(item.dimensions.height, 0.625);
  assert.equal(item.dimensions.depth, 0.5);
  assert.ok(item.dimensions.height > 0.55 && item.dimensions.height < 0.7, `${item.key} must remain a useful knee-height luggage rack`);
  assert.ok(item.dimensions.width > item.dimensions.height && item.dimensions.depth < item.dimensions.width);
  assert.ok(item.forge.rawBytes <= 320);
  assert.ok(item.forge.requirements.outputMassGrams <= 80_000, `${item.key} must remain movable guest-room furniture`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const upperRails = layout.upperRails.map((index) => bounds[index]);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const rail = upperRails[position % 2];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], leg.min[1]);
    assert.equal(leg.max[1], rail.min[1]);
  }
  assert.deepEqual(layout.luggageSlats.map((index) => components[index].offsetQ[0]), [-13, -4, 4, 13]);
  for (const slatIndex of layout.luggageSlats) {
    const slat = bounds[slatIndex];
    assert.equal(slat.min[1], upperRails[0].max[1]);
    assert.ok(upperRails.every((rail) => Math.min(slat.max[2], rail.max[2]) - Math.max(slat.min[2], rail.min[2]) > 0));
  }
  const lowerRails = layout.lowerRails.map((index) => bounds[index]);
  assert.equal(lowerRails[0].min[0], bounds[layout.legs[0]].max[0]);
  assert.equal(lowerRails[0].max[0], bounds[layout.legs[2]].min[0]);
  assert.equal(lowerRails[1].min[0], bounds[layout.legs[1]].max[0]);
  assert.equal(lowerRails[1].max[0], bounds[layout.legs[3]].min[0]);
  assert.deepEqual(layout.shoeSlats.map((index) => components[index].offsetQ[0]), [-13, -4, 4, 13]);
  for (const slatIndex of layout.shoeSlats) {
    const slat = bounds[slatIndex];
    assert.equal(slat.min[1], lowerRails[0].max[1]);
    assert.ok(lowerRails.every((rail) => Math.min(slat.max[2], rail.max[2]) - Math.max(slat.min[2], rail.min[2]) > 0));
  }
  for (let position = 0; position < layout.cornerPlates.length; position += 1) {
    const plate = bounds[layout.cornerPlates[position]];
    const rail = upperRails[position % 2];
    assert.equal(position < 2 ? plate.max[0] : plate.min[0], position < 2 ? rail.min[0] : rail.max[0]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertWritingDeskGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 21);
  assert.deepEqual(item.dimensions.sizeQ, [72, 48, 40]);
  assert.equal(item.dimensions.width, 1.125);
  assert.equal(item.dimensions.height, 0.75);
  assert.equal(item.dimensions.depth, 0.625);
  assert.ok(item.dimensions.height >= 0.72 && item.dimensions.height <= 0.78, `${item.key} must remain at canonical seated-work height`);
  assert.ok(item.dimensions.width >= 1.05 && item.dimensions.width <= 1.2);
  assert.ok(item.forge.rawBytes <= 280);
  assert.ok(item.forge.requirements.outputMassGrams <= 150_000, `${item.key} must remain movable guest-room furniture`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const desktop = bounds[layout.desktop];
  assert.equal(desktop.min[1], 42);
  assert.equal(desktop.max[1], 48);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], leg.min[1]);
    assert.equal(leg.max[1], desktop.min[1]);
  }
  const [leftApron, rightApron] = layout.frontAprons.map((index) => bounds[index]);
  const drawer = bounds[layout.drawer];
  assert.equal(leftApron.max[0], drawer.min[0]);
  assert.equal(drawer.max[0], rightApron.min[0]);
  assert.ok(drawer.min[1] >= 32, `${item.key} drawer must leave an open knee bay`);
  assert.equal(drawer.max[1], desktop.min[1]);
  const handle = bounds[layout.handle];
  assert.equal(handle.min[2], drawer.max[2]);
  const backApron = bounds[layout.backApron];
  assert.equal(backApron.min[0], bounds[layout.legs[0]].max[0]);
  assert.equal(backApron.max[0], bounds[layout.legs[2]].min[0]);
  for (let position = 0; position < layout.sideAprons.length; position += 1) {
    const apron = bounds[layout.sideAprons[position]];
    assert.equal(apron.min[2], bounds[layout.legs[position * 2]].max[2]);
    assert.equal(apron.max[2], bounds[layout.legs[position * 2 + 1]].min[2]);
    assert.equal(apron.max[1], desktop.min[1]);
  }
  const rearStretcher = bounds[layout.rearStretcher];
  assert.equal(rearStretcher.min[0], bounds[layout.legs[0]].max[0]);
  assert.equal(rearStretcher.max[0], bounds[layout.legs[2]].min[0]);
  for (const plateIndex of layout.cornerPlates) {
    const plate = bounds[plateIndex];
    assert.ok(plate.max[2] === desktop.min[2] || plate.min[2] === desktop.max[2]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertWritingChairGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 19);
  assert.deepEqual(item.dimensions.sizeQ, [32, 56, 40]);
  assert.equal(item.dimensions.width, 0.5);
  assert.equal(item.dimensions.height, 0.875);
  assert.equal(item.dimensions.depth, 0.625);
  assert.ok(item.dimensions.height >= 0.85 && item.dimensions.height <= 0.95, `${item.key} must remain an adult writing chair`);
  assert.ok(item.forge.rawBytes <= 260);
  assert.ok(item.forge.requirements.outputMassGrams <= 80_000, `${item.key} must remain movable guest-room seating`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const seat = bounds[layout.seat];
  assert.equal(seat.min[1], 26);
  assert.equal(seat.max[1], 30);
  assert.ok(seat.max[1] / 64 >= 0.45 && seat.max[1] / 64 <= 0.49, `${item.key} seat must match the canonical desk`);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const supportIndex = position < 2 ? layout.frontLegs[position] : layout.rearPosts[position - 2];
    const support = bounds[supportIndex];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], support.min[1]);
    if (position < 2) assert.equal(support.max[1], seat.min[1]);
    else assert.equal(support.max[2], seat.min[2]);
  }
  const [leftRearPost, rightRearPost] = layout.rearPosts.map((index) => bounds[index]);
  const [lowerBackSlat, upperBackSlat] = layout.backSlats.map((index) => bounds[index]);
  for (const slat of [lowerBackSlat, upperBackSlat]) {
    assert.equal(slat.min[0], leftRearPost.max[0]);
    assert.equal(slat.max[0], rightRearPost.min[0]);
    assert.equal(slat.min[2], leftRearPost.min[2]);
    assert.equal(slat.max[2], leftRearPost.max[2]);
  }
  assert.ok(lowerBackSlat.min[1] > seat.max[1]);
  assert.ok(lowerBackSlat.max[1] < upperBackSlat.min[1]);
  const frontStretcher = bounds[layout.frontStretcher];
  assert.equal(frontStretcher.min[0], bounds[layout.frontLegs[0]].max[0]);
  assert.equal(frontStretcher.max[0], bounds[layout.frontLegs[1]].min[0]);
  for (let position = 0; position < layout.sideStretchers.length; position += 1) {
    const stretcher = bounds[layout.sideStretchers[position]];
    assert.equal(stretcher.min[2], bounds[layout.rearPosts[position]].max[2]);
    assert.equal(stretcher.max[2], bounds[layout.frontLegs[position]].min[2]);
  }
  const rearStretcher = bounds[layout.rearStretcher];
  assert.equal(rearStretcher.min[0], leftRearPost.max[0]);
  assert.equal(rearStretcher.max[0], rightRearPost.min[0]);
  for (const plateIndex of layout.seatPlates) assert.equal(bounds[plateIndex].min[1], seat.max[1]);
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertWallMirrorGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 12);
  assert.deepEqual(item.dimensions.sizeQ, [40, 64, 8]);
  assert.equal(item.dimensions.width, 0.625);
  assert.equal(item.dimensions.height, 1);
  assert.equal(item.dimensions.depth, 0.125);
  assert.ok(item.dimensions.height > item.dimensions.width * 1.5, `${item.key} must remain a portrait wall mirror`);
  assert.ok(item.dimensions.depth < item.dimensions.width * 0.25);
  assert.ok(item.forge.rawBytes <= 180);
  assert.ok(item.forge.requirements.outputMassGrams <= 150_000, `${item.key} must remain wall-mountable inn decor`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["copper_bloom", "iron_bloom", "squared_timber", "wooden_plank"],
  );
  const bounds = runtime.components.map((component) => componentBoundsQ(component));
  const backplate = bounds[layout.backplate];
  const mirrorFace = bounds[layout.mirrorFace];
  const [left, right, bottom, top] = layout.frame.map((index) => bounds[index]);
  assert.equal(item.forge.materialComponents[layout.mirrorFace].materialId, "copper_bloom");
  assert.equal(backplate.max[2], mirrorFace.min[2]);
  assert.equal(backplate.min[0], mirrorFace.min[0]);
  assert.equal(backplate.max[0], mirrorFace.max[0]);
  assert.equal(backplate.min[1], mirrorFace.min[1]);
  assert.equal(backplate.max[1], mirrorFace.max[1]);
  assert.equal(mirrorFace.min[0], left.max[0]);
  assert.equal(mirrorFace.max[0], right.min[0]);
  assert.equal(mirrorFace.min[1], bottom.max[1]);
  assert.equal(mirrorFace.max[1], top.min[1]);
  for (const hangerIndex of layout.hangers) assert.equal(bounds[hangerIndex].min[1], top.max[1]);
  for (const plateIndex of layout.cornerPlates) {
    const plate = bounds[plateIndex];
    assert.equal(plate.min[2], 3);
    assert.equal(plate.max[2], 5);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertPrivacyScreenGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 21);
  assert.deepEqual(item.dimensions.sizeQ, [98, 112, 28]);
  assert.equal(item.dimensions.width, 1.5313);
  assert.equal(item.dimensions.height, 1.75);
  assert.equal(item.dimensions.depth, 0.4375);
  assert.equal(item.preview.clothMotion, "rigid");
  assert.ok(item.dimensions.width >= 1.45 && item.dimensions.width <= 1.6);
  assert.ok(item.forge.rawBytes <= 280);
  assert.ok(item.forge.requirements.outputMassGrams <= 80_000, `${item.key} must remain movable inn decor`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["cotton_cloth", "iron_bloom", "squared_timber"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], post.min[1]);
    assert.equal(components[layout.feet[position]].offsetQ[2], 0);
    assert.equal(components[layout.posts[position]].offsetQ[2], 0);
  }
  for (const panel of layout.panels) {
    const cloth = bounds[panel.cloth];
    const bottomRail = bounds[panel.bottomRail];
    const topRail = bounds[panel.topRail];
    const leftPost = bounds[panel.leftPost];
    const rightPost = bounds[panel.rightPost];
    assert.equal(item.forge.materialComponents[panel.cloth].materialId, "cotton_cloth");
    assert.equal(components[panel.cloth].resourceId, "cloth");
    assert.equal(cloth.min[0], leftPost.max[0]);
    assert.equal(cloth.max[0], rightPost.min[0]);
    assert.equal(cloth.min[1], bottomRail.max[1]);
    assert.equal(cloth.max[1], topRail.min[1]);
    assert.equal(components[panel.cloth].offsetQ[2], 0);
  }
  assert.deepEqual(layout.hingePlates.map((index) => components[index].offsetQ.slice(0, 2)), [
    [-15, 38], [-15, 78], [15, 38], [15, 78],
  ]);
  for (let position = 0; position < layout.hingePlates.length; position += 1) {
    const hinge = bounds[layout.hingePlates[position]];
    const post = bounds[layout.posts[position < 2 ? 1 : 2]];
    assert.equal(hinge.min[2], post.max[2]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertDoubleDoorWardrobeGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 24);
  assert.deepEqual(item.dimensions.sizeQ, [60, 114, 32]);
  assert.equal(item.dimensions.width, 0.9375);
  assert.equal(item.dimensions.height, 1.7813);
  assert.equal(item.dimensions.depth, 0.5);
  assert.ok(item.dimensions.height >= 1.75 && item.dimensions.height <= 1.85, `${item.key} must remain full player-height guest-room storage`);
  assert.ok(item.dimensions.width >= 0.9 && item.dimensions.width <= 1);
  assert.ok(item.dimensions.depth >= 0.45 && item.dimensions.depth <= 0.55);
  assert.ok(item.forge.rawBytes <= 300);
  assert.ok(item.forge.requirements.outputMassGrams <= 220_000, `${item.key} must remain plausible heavy movable furniture`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["iron_bloom", "squared_timber", "wooden_plank"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const floor = bounds[layout.floor];
  const bottomRail = bounds[layout.bottomRail];
  const topRail = bounds[layout.topRail];
  const topSlab = bounds[layout.topSlab];
  const crown = bounds[layout.crown];
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    assert.equal(foot.min[1], 0);
    assert.equal(foot.max[1], post.min[1]);
    assert.equal(post.max[1], topSlab.min[1]);
  }
  assert.equal(floor.min[1], 4);
  assert.equal(floor.max[1], bottomRail.min[1]);
  assert.equal(topRail.max[1], topSlab.min[1]);
  assert.equal(topSlab.max[1], crown.min[1]);
  assert.equal(crown.max[1], 114);
  const [leftSide, rightSide] = layout.sidePanels.map((index) => bounds[index]);
  const back = bounds[layout.backPanel];
  assert.equal(leftSide.min[0], floor.min[0]);
  assert.equal(rightSide.max[0], floor.max[0]);
  assert.equal(back.min[0], leftSide.max[0]);
  assert.equal(back.max[0], rightSide.min[0]);
  assert.equal(leftSide.min[1], floor.max[1]);
  assert.equal(leftSide.max[1], topRail.min[1]);
  assert.equal(back.min[2], floor.min[2]);
  const [leftDoor, rightDoor] = layout.doors.map((index) => bounds[index]);
  assert.equal(leftDoor.min[0], bottomRail.min[0]);
  assert.equal(leftDoor.max[0], rightDoor.min[0]);
  assert.equal(rightDoor.max[0], bottomRail.max[0]);
  assert.equal(leftDoor.min[1], bottomRail.max[1]);
  assert.equal(leftDoor.max[1], topRail.min[1]);
  assert.equal(leftDoor.max[2], floor.max[2]);
  assert.equal(rightDoor.max[2], floor.max[2]);
  for (let position = 0; position < layout.doorStraps.length; position += 1) {
    const strap = bounds[layout.doorStraps[position]];
    const door = position % 2 === 0 ? leftDoor : rightDoor;
    assert.equal(strap.min[2], door.max[2]);
    assert.ok(strap.min[0] >= door.min[0] && strap.max[0] <= door.max[0]);
  }
  for (let position = 0; position < layout.pulls.length; position += 1) {
    const pull = bounds[layout.pulls[position]];
    const door = position === 0 ? leftDoor : rightDoor;
    assert.equal(pull.min[2], door.max[2]);
    assert.equal(Math.sign(components[layout.pulls[position]].offsetQ[0]), position === 0 ? -1 : 1);
    assert.ok(Math.abs(components[layout.pulls[position]].offsetQ[0]) <= 4);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}

function assertHearthFireplaceGeometry(item, runtime, layout) {
  assert.equal(runtime.componentCount, 23);
  assert.deepEqual(item.dimensions.sizeQ, [96, 106, 44]);
  assert.equal(item.dimensions.width, 1.5);
  assert.equal(item.dimensions.height, 1.6563);
  assert.equal(item.dimensions.depth, 0.6875);
  assert.ok(item.dimensions.height >= 1.6 && item.dimensions.height <= 1.7, `${item.key} must remain below but close to canonical player height`);
  assert.ok(item.dimensions.width >= 1.4 && item.dimensions.width <= 1.6);
  assert.ok(item.dimensions.depth >= 0.6 && item.dimensions.depth <= 0.75);
  assert.ok(item.forge.rawBytes <= 290);
  assert.ok(item.forge.requirements.outputMassGrams <= 360_000, `${item.key} must remain plausible room-scale masonry`);
  assert.deepEqual(
    [...new Set(item.forge.materialComponents.map(({ materialId }) => materialId))].sort(),
    ["charcoal", "iron_bloom", "polished_stone_slab", "squared_timber", "stone_brick"],
  );
  const components = runtime.components;
  const bounds = components.map((component) => componentBoundsQ(component));
  const hearth = bounds[layout.hearth];
  const [leftLower, rightLower] = layout.lowerPiers.map((index) => bounds[index]);
  const [leftUpper, rightUpper] = layout.upperPiers.map((index) => bounds[index]);
  const [lowerBack, upperBack] = layout.backPanels.map((index) => bounds[index]);
  const lintel = bounds[layout.lintel];
  const mantel = bounds[layout.mantel];
  const chimneyBreast = bounds[layout.chimneyBreast];
  const chimneyCrown = bounds[layout.chimneyCrown];
  assert.equal(hearth.min[1], 0);
  assert.equal(leftLower.min[1], hearth.max[1]);
  assert.equal(rightLower.min[1], hearth.max[1]);
  assert.equal(lowerBack.min[1], hearth.max[1]);
  assert.equal(leftLower.max[1], leftUpper.min[1]);
  assert.equal(rightLower.max[1], rightUpper.min[1]);
  assert.equal(lowerBack.max[1], upperBack.min[1]);
  assert.equal(leftUpper.max[1], lintel.min[1]);
  assert.equal(rightUpper.max[1], lintel.min[1]);
  assert.equal(lintel.max[1], mantel.min[1]);
  assert.equal(mantel.max[1], chimneyBreast.min[1]);
  assert.equal(chimneyBreast.max[1], chimneyCrown.min[1]);
  const opening = {
    min: [leftLower.max[0], hearth.max[1], lowerBack.max[2]],
    max: [rightLower.min[0], lintel.min[1], leftLower.max[2]],
  };
  assert.ok(opening.max[0] - opening.min[0] >= 48);
  assert.ok(opening.max[1] - opening.min[1] >= 58);
  assert.ok(opening.max[2] - opening.min[2] >= 24);
  for (const index of [layout.hearth, ...layout.lowerPiers, ...layout.upperPiers, ...layout.backPanels, layout.lintel]) {
    assert.equal(positiveVolumeOverlap(bounds[index], opening), false, `${item.key} masonry ${index} obstructs the open firebox`);
  }
  const sideRails = layout.grateSideRails.map((index) => bounds[index]);
  for (let position = 0; position < layout.grateFeet.length; position += 1) {
    const foot = bounds[layout.grateFeet[position]];
    assert.equal(foot.min[1], hearth.max[1]);
    assert.equal(foot.max[1], sideRails[position].min[1]);
  }
  for (const barIndex of layout.grateBars) {
    const bar = bounds[barIndex];
    assert.equal(bar.min[0], sideRails[0].max[0]);
    assert.equal(bar.max[0], sideRails[1].min[0]);
  }
  const [backEndRail, frontEndRail] = layout.grateEndRails.map((index) => bounds[index]);
  assert.equal(backEndRail.min[0], sideRails[0].max[0]);
  assert.equal(backEndRail.max[0], sideRails[1].min[0]);
  assert.equal(frontEndRail.min[0], sideRails[0].max[0]);
  assert.equal(frontEndRail.max[0], sideRails[1].min[0]);
  const charcoalBed = bounds[layout.charcoalBed];
  assert.equal(charcoalBed.min[1], hearth.max[1]);
  assert.ok(charcoalBed.min[0] > sideRails[0].max[0]);
  assert.ok(charcoalBed.max[0] < sideRails[1].min[0]);
  assert.ok(charcoalBed.max[1] < bounds[layout.grateBars[0]].min[1]);
  for (const bracketIndex of layout.mantelBrackets) {
    const bracket = bounds[bracketIndex];
    assert.equal(bracket.min[2], lintel.max[2]);
    assert.equal(bracket.max[1], mantel.min[1]);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      assert.equal(positiveVolumeOverlap(bounds[first], bounds[second]), false, `${item.key} components ${first} and ${second} intersect`);
    }
  }
}
