import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  FORGE_COMPONENT_GRID,
  createForgeComponent,
  decodeNcf1,
  encodeNcf1Bytes,
  forgeMaterialRequirements,
  forgeVoxelIndex,
  selectCompactNcf1Encoding,
} from "../../chunk.js/forge/forge-core.js";
import {
  createForgeWorkbenchDesign,
  createForgeWorkbenchMaterial,
  forgeWorkbenchComponentsConnected,
  forgeWorkbenchStats,
} from "../../chunk.js/forge/forge-workbench.js";
import { validateForgeGripBindings } from "../../chunk.js/forge/forge-grip-validation.js";
import { ForgeRuntimeCache } from "../../chunk.js/forge/forge-runtime-cache.js";

const itemRoot = path.resolve(import.meta.dirname, "..");
const projectRoot = path.resolve(itemRoot, "..");
const rules = JSON.parse(readFileSync(path.join(projectRoot, "public/rules/smelting-rules.json"), "utf8"));
const materialById = new Map(rules.materials.map((material) => [material.id, material]));
const runtimeCache = new ForgeRuntimeCache({ maxEntries: 32, maxBytes: 64 * 1024 * 1024 });

const LOCALES = Object.freeze(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const CATALOG_SCHEMA = "nicechunk.ncf-item-catalog.v1";
const ITEM_SCHEMA = "nicechunk.ncf-item.v1";
const MATERIAL_POLICY = "current-smelting-rules-only";

const COLORS = Object.freeze({
  amber_glass_panel: 0xda5,
  basalt_brick: 0x334,
  basalt_composite: 0x354,
  carbon_steel: 0x899,
  clear_glass_panel: 0x9ce,
  copper_bloom: 0xb64,
  glass_ingot: 0x9cd,
  iron_bloom: 0x9a9,
  polished_stone_slab: 0xaab,
  squared_timber: 0x865,
  wooden_plank: 0xa75,
  wooden_stick: 0x753,
});

const ITEM_NAMES = Object.freeze({
  "carbon-steel-prospector-pick": names(
    "Carbon-steel Prospector Pick", "Pico de prospector de acero al carbono", "Pic de prospecteur en acier au carbone",
    "Prospektorenspitzhacke aus Kohlenstoffstahl", "炭素鋼の探鉱つるはし", "Геологическая кирка из углеродистой стали",
    "탄소강 탐광 곡괭이", "碳鋼探礦鎬", "碳钢探矿镐",
  ),
  "iron-deep-rock-pickaxe": names(
    "Iron Deep-rock Pickaxe", "Pico de hierro para roca profunda", "Pioche en fer pour roche profonde",
    "Eisen-Spitzhacke für Tiefengestein", "鉄製深岩つるはし", "Железная кирка для глубинной породы",
    "철제 심층암 곡괭이", "鐵製深岩鎬", "铁制深岩镐",
  ),
  "basalt-stonebreaker-maul": names(
    "Basalt Stonebreaker Maul", "Maza de basalto rompepiedras", "Maillet brise-pierre en basalte",
    "Basalt-Steinbrecherhammer", "玄武岩の砕石大槌", "Базальтовая кувалда камнелома",
    "현무암 쇄석 대형 망치", "玄武岩碎石大槌", "玄武岩碎石大锤",
  ),
  "carbon-steel-forester-axe": names(
    "Carbon-steel Forester Axe", "Hacha forestal de acero al carbono", "Hache forestière en acier au carbone",
    "Forstaxt aus Kohlenstoffstahl", "炭素鋼の森林斧", "Лесной топор из углеродистой стали",
    "탄소강 산림 도끼", "碳鋼林務斧", "碳钢林务斧",
  ),
  "iron-field-hoe": names(
    "Iron Field Hoe", "Azada de campo de hierro", "Houe de champ en fer", "Eiserne Feldhacke",
    "鉄製の畑用くわ", "Железная полевая мотыга", "철제 밭 괭이", "鐵製田間鋤", "铁制田间锄",
  ),
  "carbon-steel-harvest-sickle": names(
    "Carbon-steel Harvest Sickle", "Hoz de cosecha de acero al carbono", "Faucille de récolte en acier au carbone",
    "Erntesichel aus Kohlenstoffstahl", "炭素鋼の収穫鎌", "Жатвенный серп из углеродистой стали",
    "탄소강 수확 낫", "碳鋼收割鐮", "碳钢收割镰",
  ),
  "iron-blacksmith-hammer": names(
    "Iron Blacksmith Hammer", "Martillo de herrero de hierro", "Marteau de forgeron en fer", "Eiserner Schmiedehammer",
    "鉄製の鍛冶ハンマー", "Железный кузнечный молот", "철제 대장장이 망치", "鐵製鍛造錘", "铁制锻造锤",
  ),
  "timber-carpenter-mallet": names(
    "Timber Carpenter Mallet", "Mazo de carpintero de madera", "Maillet de charpentier en bois", "Zimmermannsklüpfel aus Holz",
    "木製の大工槌", "Деревянная плотницкая киянка", "목재 목수 망치", "木製木工槌", "木制木工槌",
  ),
  "carbon-steel-masonry-chisel": names(
    "Carbon-steel Masonry Chisel", "Cincel de albañilería de acero al carbono", "Burin de maçonnerie en acier au carbone",
    "Mauermeißel aus Kohlenstoffstahl", "炭素鋼の石工のみ", "Камнетёсное зубило из углеродистой стали",
    "탄소강 석공 끌", "碳鋼石工鑿", "碳钢石工凿",
  ),
  "frontier-longsword": names(
    "Frontier Longsword", "Espada larga de la frontera", "Épée longue de la frontière", "Grenzland-Langschwert",
    "辺境のロングソード", "Пограничный длинный меч", "변경 장검", "邊境長劍", "边境长剑",
  ),
  "guardian-spear": names(
    "Guardian Spear", "Lanza del guardián", "Lance du gardien", "Wächterspeer", "守護者の槍",
    "Копьё стража", "수호자 창", "守衛長矛", "守卫长矛",
  ),
  "basalt-war-mace": names(
    "Basalt War Mace", "Maza de guerra de basalto", "Masse de guerre en basalte", "Basalt-Streitkolben",
    "玄武岩の戦棍", "Базальтовая боевая булава", "현무암 전투 철퇴", "玄武岩戰鎚", "玄武岩战锤",
  ),
  "reinforced-timber-door": names(
    "Reinforced Timber Door", "Puerta de madera reforzada", "Porte en bois renforcée", "Verstärkte Holztür",
    "補強木製扉", "Усиленная деревянная дверь", "보강 목재 문", "強化木門", "强化木门",
  ),
  "iron-portcullis-panel": names(
    "Iron Portcullis Panel", "Panel de rastrillo de hierro", "Panneau de herse en fer", "Eisernes Fallgatterfeld",
    "鉄製落とし格子パネル", "Железная секция подъёмной решётки", "철제 성문 격자 패널", "鐵製吊閘板", "铁制吊闸板",
  ),
  "shuttered-window-frame": names(
    "Shuttered Window Frame", "Marco de ventana con contraventanas", "Cadre de fenêtre à volets", "Fensterrahmen mit Läden",
    "鎧戸付き窓枠", "Оконная рама со ставнями", "덧문 달린 창틀", "百葉窗框", "百叶窗框",
  ),
  "amber-twin-hook-lantern": names(
    "Amber Twin-hook Lantern", "Farol ámbar de doble gancho", "Lanterne ambrée à double crochet", "Bernstein-Doppelhakenlaterne",
    "琥珀色の二連フックランタン", "Янтарный фонарь с двойным крюком", "호박빛 쌍고리 랜턴", "琥珀雙鉤燈籠", "琥珀双钩灯笼",
  ),
  "copper-miner-hand-lamp": names(
    "Copper Miner's Hand Lamp", "Lámpara de mano de minero de cobre", "Lampe de mineur en cuivre", "Kupferne Bergmanns-Handlampe",
    "銅製の鉱夫用手提げ灯", "Медная ручная лампа шахтёра", "구리 광부 손전등", "銅製礦工手燈", "铜制矿工手灯",
  ),
  "basalt-standing-brazier": names(
    "Basalt Standing Brazier", "Brasero de pie de basalto", "Brasero sur pied en basalte", "Basalt-Standfeuerschale",
    "玄武岩の据え置き火鉢", "Базальтовая жаровня на стойке", "현무암 스탠딩 화로", "玄武岩立式火盆", "玄武岩立式火盆",
  ),
  "timber-workbench": names(
    "Timber Workbench", "Banco de trabajo de madera", "Établi en bois", "Holzwerkbank", "木製作業台",
    "Деревянный верстак", "목재 작업대", "木製工作台", "木制工作台",
  ),
  "field-stool": names(
    "Field Stool", "Taburete de campo", "Tabouret de campagne", "Feldhocker", "野外用スツール",
    "Походный табурет", "야외용 스툴", "野外矮凳", "野外矮凳",
  ),
  "storage-shelf": names(
    "Storage Shelf", "Estantería de almacenamiento", "Étagère de rangement", "Lagerregal", "収納棚",
    "Складской стеллаж", "수납 선반", "儲物架", "储物架",
  ),
  "banded-wooden-chest": names(
    "Banded Wooden Chest", "Cofre de madera reforzado con bandas", "Coffre en bois cerclé", "Beschlagene Holztruhe",
    "帯金付き木箱", "Окованный деревянный сундук", "쇠테 두른 나무 상자", "箍帶木箱", "箍带木箱",
  ),
  "iron-ore-bucket": names(
    "Iron Ore Bucket", "Cubo de mineral de hierro", "Seau à minerai en fer", "Eiserner Erzeimer", "鉄製の鉱石バケツ",
    "Железное ведро для руды", "철제 광석 양동이", "鐵製礦石桶", "铁制矿石桶",
  ),
  "reinforced-travel-crate": names(
    "Reinforced Travel Crate", "Cajón de viaje reforzado", "Caisse de voyage renforcée", "Verstärkte Transportkiste",
    "補強輸送箱", "Усиленный дорожный ящик", "보강 운송 상자", "強化運輸箱", "强化运输箱",
  ),
});

const ITEM_SPECS = Object.freeze([
  tool("mining-tools", "carbon-steel-prospector-pick", [
    part("wooden_stick", [4, 50, 4], [0, 0, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [36, 4, 4], [0, 27, 0], { mask: taperAlongX }),
    part("iron_bloom", [8, 6, 7], [0, 24, 0]),
  ]),
  tool("mining-tools", "iron-deep-rock-pickaxe", [
    part("squared_timber", [5, 54, 5], [0, 0, 0], { grip: handGrip(3, -10) }),
    part("iron_bloom", [40, 5, 5], [0, 29, 0], { mask: taperAlongX }),
    part("carbon_steel", [8, 6, 2], [0, 29, 4]),
  ]),
  tool("mining-tools", "basalt-stonebreaker-maul", [
    part("squared_timber", [5, 58, 5], [0, 0, 0], { grip: handGrip(3, -10) }),
    part("basalt_composite", [22, 10, 10], [0, 34, 0]),
    part("iron_bloom", [4, 12, 12], [-13, 34, 0]),
    part("iron_bloom", [4, 12, 12], [13, 34, 0]),
  ]),

  tool("forestry-farming", "carbon-steel-forester-axe", [
    part("wooden_stick", [4, 48, 4], [0, 0, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [20, 18, 4], [7, 29, 0], { mask: axeBlade }),
    part("iron_bloom", [7, 8, 7], [0, 24, 0]),
  ]),
  tool("forestry-farming", "iron-field-hoe", [
    part("squared_timber", [4, 62, 4], [0, 0, 0], { grip: handGrip(2, -10) }),
    part("iron_bloom", [22, 4, 12], [7, 33, 0], { mask: hoeBlade }),
  ]),
  tool("forestry-farming", "carbon-steel-harvest-sickle", [
    part("wooden_stick", [5, 24, 5], [0, -12, 0], { grip: handGrip(3, -2) }),
    part("carbon_steel", [28, 34, 3], [4, 14, 0], { mask: sickleBlade }),
  ]),

  tool("workshop", "iron-blacksmith-hammer", [
    part("wooden_stick", [5, 36, 5], [0, 0, 0], { grip: handGrip(3, -6) }),
    part("iron_bloom", [22, 8, 8], [0, 22, 0]),
    part("carbon_steel", [5, 10, 10], [-14, 22, 0]),
    part("carbon_steel", [5, 10, 10], [14, 22, 0]),
  ]),
  tool("workshop", "timber-carpenter-mallet", [
    part("wooden_stick", [5, 34, 5], [0, 0, 0], { grip: handGrip(3, -6) }),
    part("squared_timber", [24, 12, 12], [0, 23, 0]),
    part("wooden_plank", [4, 14, 14], [-14, 23, 0]),
    part("wooden_plank", [4, 14, 14], [14, 23, 0]),
  ]),
  tool("workshop", "carbon-steel-masonry-chisel", [
    part("carbon_steel", [5, 30, 5], [0, 0, 0], { grip: handGrip(3, -5) }),
    part("carbon_steel", [4, 14, 4], [0, 22, 0], { mask: chiselTip }),
    part("iron_bloom", [9, 4, 9], [0, -17, 0]),
  ]),

  tool("weapons", "frontier-longsword", [
    part("wooden_stick", [5, 20, 8], [0, -30, 0], { grip: handGrip(3, 0) }),
    part("iron_bloom", [8, 8, 8], [0, -44, 0], { mask: roundMask }),
    part("carbon_steel", [24, 4, 6], [0, -18, 0]),
    part("carbon_steel", [9, 62, 3], [0, 15, 0], { mask: swordBlade }),
  ]),
  tool("weapons", "guardian-spear", [
    part("squared_timber", [4, 84, 4], [0, -10, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [12, 24, 4], [0, 44, 0], { mask: spearHead }),
    part("iron_bloom", [7, 8, 7], [0, 30, 0]),
  ]),
  tool("weapons", "basalt-war-mace", [
    part("wooden_stick", [5, 42, 5], [0, -5, 0], { grip: handGrip(3, -6) }),
    part("iron_bloom", [8, 8, 8], [0, 20, 0]),
    part("basalt_composite", [18, 18, 18], [0, 33, 0], { mask: maceHead }),
  ]),

  placeable("building-fittings", "reinforced-timber-door", [
    ...[-21, -7, 7, 21].map((x) => part("wooden_plank", [14, 118, 4], [x, 59, 0])),
    part("squared_timber", [58, 6, 6], [0, 25, 5]),
    part("squared_timber", [58, 6, 6], [0, 93, 5]),
    part("iron_bloom", [8, 16, 2], [19, 59, 3]),
    part("iron_bloom", [4, 10, 4], [19, 59, 6]),
  ]),
  placeable("building-fittings", "iron-portcullis-panel", [
    ...[-30, -20, -10, 0, 10, 20, 30].map((x) => part("iron_bloom", [4, 104, 4], [x, 52, 0])),
    ...[20, 52, 84].map((y) => part("iron_bloom", [64, 4, 6], [0, y, 5])),
    part("basalt_composite", [68, 8, 8], [0, 108, 0]),
  ]),
  placeable("building-fittings", "shuttered-window-frame", [
    part("squared_timber", [60, 6, 6], [0, 3, 0]),
    part("squared_timber", [60, 6, 6], [0, 69, 0]),
    part("squared_timber", [6, 72, 6], [-33, 36, 0]),
    part("squared_timber", [6, 72, 6], [33, 36, 0]),
    part("clear_glass_panel", [60, 60, 2], [0, 36, 0]),
    part("wooden_plank", [20, 58, 3], [-46, 36, 0]),
    part("wooden_plank", [20, 58, 3], [46, 36, 0]),
  ]),

  placeable("lighting", "amber-twin-hook-lantern", [
    part("iron_bloom", [24, 4, 16], [0, 2, 0]),
    part("iron_bloom", [24, 4, 16], [0, 28, 0]),
    ...[-10, 10].flatMap((x) => [-6, 6].map((z) => part("iron_bloom", [3, 22, 3], [x, 15, z]))),
    part("amber_glass_panel", [18, 20, 12], [0, 14, 0]),
    part("copper_bloom", [18, 5, 12], [0, 33, 0]),
    part("iron_bloom", [4, 16, 4], [0, 44, 0]),
    part("iron_bloom", [14, 4, 4], [5, 54, 0]),
  ]),
  tool("lighting", "copper-miner-hand-lamp", [
    part("wooden_stick", [5, 20, 8], [0, -18, 0], { grip: handGrip(3, 0) }),
    part("iron_bloom", [7, 6, 7], [0, -5, 0]),
    part("copper_bloom", [14, 12, 14], [0, 4, 0], { mask: roundMask }),
    part("glass_ingot", [10, 10, 3], [0, 4, 9]),
    part("copper_bloom", [12, 4, 12], [0, 12, 0]),
  ]),
  placeable("lighting", "basalt-standing-brazier", [
    part("basalt_brick", [20, 6, 20], [0, 3, 0]),
    part("iron_bloom", [6, 28, 6], [0, 20, 0]),
    part("iron_bloom", [34, 14, 34], [0, 39, 0], { mask: bowlMask }),
    part("copper_bloom", [36, 4, 36], [0, 46, 0], { mask: rimMask }),
  ]),

  placeable("furniture", "timber-workbench", [
    part("wooden_plank", [78, 6, 38], [0, 53, 0]),
    ...[-31, 31].flatMap((x) => [-12, 12].map((z) => part("squared_timber", [7, 50, 7], [x, 25, z]))),
    part("squared_timber", [55, 5, 5], [0, 14, -12]),
    part("squared_timber", [55, 5, 5], [0, 14, 12]),
    part("wooden_plank", [70, 20, 5], [0, 66, 15]),
  ]),
  placeable("furniture", "field-stool", [
    part("wooden_plank", [34, 5, 34], [0, 37, 0]),
    ...[-12, 12].flatMap((x) => [-12, 12].map((z) => part("squared_timber", [5, 34, 5], [x, 17, z]))),
    part("wooden_stick", [19, 4, 4], [0, 12, -12]),
    part("wooden_stick", [19, 4, 4], [0, 12, 12]),
  ]),
  placeable("furniture", "storage-shelf", [
    ...[-28, 28].flatMap((x) => [-10, 10].map((z) => part("squared_timber", [6, 80, 6], [x, 40, z]))),
    ...[8, 30, 52, 74].map((y) => part("wooden_plank", [50, 5, 26], [0, y, 0])),
  ]),

  placeable("containers", "banded-wooden-chest", [
    part("wooden_plank", [52, 4, 32], [0, 2, 0]),
    part("wooden_plank", [52, 28, 4], [0, 18, -14]),
    part("wooden_plank", [52, 28, 4], [0, 18, 14]),
    part("wooden_plank", [4, 28, 24], [-24, 18, 0]),
    part("wooden_plank", [4, 28, 24], [24, 18, 0]),
    part("wooden_plank", [54, 5, 34], [0, 35, 0]),
    ...[-16, 16].flatMap((x) => [-17, 17].map((z) => part("iron_bloom", [4, 28, 2], [x, 18, z]))),
    part("iron_bloom", [8, 10, 3], [0, 20, -18]),
  ]),
  placeable("containers", "iron-ore-bucket", [
    part("iron_bloom", [28, 30, 28], [0, 15, 0], { mask: bucketMask }),
    part("iron_bloom", [3, 24, 3], [-16, 34, 0]),
    part("iron_bloom", [3, 24, 3], [16, 34, 0]),
    part("iron_bloom", [35, 3, 3], [0, 48, 0]),
  ]),
  placeable("containers", "reinforced-travel-crate", [
    part("wooden_plank", [54, 5, 38], [0, 2, 0]),
    part("wooden_plank", [54, 34, 4], [0, 22, -17]),
    part("wooden_plank", [54, 34, 4], [0, 22, 17]),
    part("wooden_plank", [4, 34, 30], [-25, 22, 0]),
    part("wooden_plank", [4, 34, 30], [25, 22, 0]),
    part("wooden_plank", [54, 5, 38], [0, 42, 0]),
    ...[14, 30].flatMap((y) => [-21, 21].map((z) => part("iron_bloom", [54, 4, 3], [0, y, z]))),
  ]),
]);

generate();

function generate() {
  const generatedItems = [];
  const failures = [];
  const seen = new Set();
  for (const spec of ITEM_SPECS) {
    if (seen.has(spec.key)) throw new Error(`Duplicate item key: ${spec.key}`);
    seen.add(spec.key);
    try {
      generatedItems.push({ spec, definition: buildItem(spec) });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length) {
    throw new Error(`Item validation failed:\n- ${failures.join("\n- ")}`);
  }

  const catalogItems = [];
  for (const { spec, definition } of generatedItems) {
    const relative = `json/${spec.category}/${spec.key}.json`;
    const destination = path.join(itemRoot, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, `${JSON.stringify(definition, null, 2)}\n`);
    catalogItems.push(relative);
  }
  const catalog = { schema: CATALOG_SCHEMA, version: 1, items: catalogItems };
  mkdirSync(path.join(itemRoot, "json"), { recursive: true });
  writeFileSync(path.join(itemRoot, "json/catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  process.stdout.write(`Generated ${catalogItems.length} canonical item definitions across ${new Set(ITEM_SPECS.map((item) => item.category)).size} categories.\n`);
}

function buildItem(spec) {
  const builtParts = spec.parts.map(buildPart);
  const components = builtParts.map((entry) => entry.component);
  const materials = builtParts.map((entry) => entry.material);
  if (!forgeWorkbenchComponentsConnected(components)) {
    const links = [];
    for (let left = 0; left < components.length; left += 1) {
      for (let right = left + 1; right < components.length; right += 1) {
        if (forgeWorkbenchComponentsConnected([components[left], components[right]])) links.push(`${left}-${right}`);
      }
    }
    throw new Error(`${spec.key} contains disconnected forge components (links: ${links.join(", ") || "none"}).`);
  }
  const gripValidation = validateForgeGripBindings(components);
  if (!gripValidation.valid) {
    throw new Error(`${spec.key} has an invalid grip: ${gripValidation.reason}.`);
  }
  const hasGrip = gripValidation.gripCount === 1;
  if ((spec.interaction === "tool") !== hasGrip) {
    throw new Error(`${spec.key} interaction and grip policy disagree.`);
  }

  const sourceDesign = createForgeWorkbenchDesign(components, materials);
  const stats = forgeWorkbenchStats(components, materials);
  const selection = selectCompactNcf1Encoding(sourceDesign);
  const decoded = decodeNcf1(selection.code, { requireCanonical: true });
  const canonicalBytes = encodeNcf1Bytes(decoded);
  if (!equalBytes(canonicalBytes, selection.bytes)) throw new Error(`${spec.key} failed canonical NCF1 round trip.`);
  const runtime = runtimeCache.restore(selection.code, { requireCanonical: true });
  if (runtime.rawByteLength > 640 || runtime.vertexCount < 1 || runtime.triangleCount < 1) {
    throw new Error(`${spec.key} failed the game runtime restoration gate.`);
  }
  if (Boolean(runtime.grip) !== hasGrip) throw new Error(`${spec.key} lost its grip during compact encoding.`);

  const requirements = forgeMaterialRequirements(selection.bytes);
  const materialComponents = stats.componentBreakdown.map((entry, index) => ({
    index,
    materialId: entry.materialId,
    itemCode: materialById.get(entry.materialId).itemCode,
    inputVolumeMm3: entry.inputVolumeMm3,
    usedVolumeMm3: entry.usedVolumeMm3,
    unusedVolumeMm3: entry.unusedVolumeMm3,
  }));
  const billOfMaterials = stats.materialBreakdown.map((entry) => {
    const material = requiredMaterial(entry.materialId);
    return {
      materialId: entry.materialId,
      itemCode: material.itemCode,
      componentCount: entry.componentCount,
      inputVolumeMm3: entry.inputVolumeMm3,
      usedVolumeMm3: entry.usedVolumeMm3,
      unusedVolumeMm3: entry.unusedVolumeMm3,
      unitVolumeMm3: material.unitVolumeMm3,
      equivalentInputUnits: Math.ceil(entry.inputVolumeMm3 / material.unitVolumeMm3),
    };
  });
  const dimensions = runtime.boundsQ.sizeQ.map((value) => round(value / 64, 4));
  const localizedNames = ITEM_NAMES[spec.key];
  if (!localizedNames) throw new Error(`Missing localized names for ${spec.key}.`);

  return {
    schema: ITEM_SCHEMA,
    key: spec.key,
    category: spec.category,
    interaction: spec.interaction,
    names: localizedNames,
    descriptions: localizedDescriptions(localizedNames, spec.interaction),
    dimensions: {
      unit: "m",
      width: dimensions[0],
      height: dimensions[1],
      depth: dimensions[2],
      sizeQ: [...runtime.boundsQ.sizeQ],
    },
    preview: {
      yaw: spec.preview?.yaw ?? -0.72,
      pitch: spec.preview?.pitch ?? 0.34,
    },
    forge: {
      format: "NCF1",
      version: 15,
      code: selection.code,
      rawBytes: runtime.rawByteLength,
      sha256: createHash("sha256").update(selection.bytes).digest("hex"),
      designHash: requirements.designHash,
      encodingMode: selection.mode,
      sourceEncodingMode: selection.sourceMode,
      surfaceBaked: selection.surfaceBaked,
      sourceBytes: selection.sourceByteLength,
      savedBytes: selection.savedBytes,
      sourceComponentCount: components.length,
      decodedComponentCount: runtime.componentCount,
      appearanceQuadCount: runtime.appearanceQuadCount,
      hasGrip,
      materialPolicy: MATERIAL_POLICY,
      materialRuleSet: rules.ruleSet,
      materialComponents,
      requirements: {
        requiredVolumeMm3: requirements.requiredVolumeMm3,
        requiredEffectiveDurability: requirements.requiredEffectiveDurability,
        outputMassGrams: requirements.outputMassGrams,
        materialScore: requirements.materialScore,
      },
      runtime: {
        kind: runtime.kind,
        vertexCount: runtime.vertexCount,
        triangleCount: runtime.triangleCount,
        meshByteLength: runtime.meshByteLength,
      },
    },
    billOfMaterials,
    verification: {
      canonicalRoundTrip: true,
      gameRuntimeRestored: true,
      connectedComponents: true,
      gripValidated: true,
      currentMaterialsOnly: true,
      chainMinted: false,
    },
  };
}

function buildPart(definition) {
  const materialRule = requiredMaterial(definition.materialId);
  const inputVolumeMm3 = physicalVolumeMm3(definition.dimsQ);
  const material = createForgeWorkbenchMaterial({
    ...materialRule,
    materialId: materialRule.id,
    volumeMm3: inputVolumeMm3,
  }, {
    color444: COLORS[materialRule.id],
  });
  const component = createForgeComponent({
    resourceId: material.profile.resourceId,
    color444: COLORS[materialRule.id] ?? material.profile.color444,
    dimsQ: definition.dimsQ,
    offsetQ: definition.offsetQ,
    grip: definition.grip ?? null,
    solid: definition.mask ? createSolid(definition.mask) : undefined,
  });
  return { material, component };
}

function requiredMaterial(materialId) {
  const material = materialById.get(materialId);
  if (!material || !Number.isInteger(material.itemCode) || !Number.isInteger(material.unitVolumeMm3) || material.unitVolumeMm3 < 1) {
    throw new Error(`Unknown or incomplete forge material: ${materialId}`);
  }
  return material;
}

function physicalVolumeMm3(dimsQ) {
  const qVolume = dimsQ.reduce((product, value) => product * value, 1);
  return Math.max(1, Math.round(qVolume * 1_000_000_000 / 64 ** 3));
}

function createSolid(predicate) {
  const solid = new Uint8Array(FORGE_COMPONENT_GRID.x * FORGE_COMPONENT_GRID.y * FORGE_COMPONENT_GRID.z);
  for (let z = 0; z < FORGE_COMPONENT_GRID.z; z += 1) {
    for (let y = 0; y < FORGE_COMPONENT_GRID.y; y += 1) {
      for (let x = 0; x < FORGE_COMPONENT_GRID.x; x += 1) {
        const nx = ((x + 0.5) / FORGE_COMPONENT_GRID.x) * 2 - 1;
        const ny = ((y + 0.5) / FORGE_COMPONENT_GRID.y) * 2 - 1;
        const nz = ((z + 0.5) / FORGE_COMPONENT_GRID.z) * 2 - 1;
        solid[forgeVoxelIndex(x, y, z)] = predicate({ x, y, z, nx, ny, nz }) ? 1 : 0;
      }
    }
  }
  if (!solid.some(Boolean)) throw new Error("Forge mask produced an empty component.");
  return solid;
}

function taperAlongX({ nx, ny, nz }) {
  return Math.abs(ny) <= 0.22 + (1 - Math.abs(nx)) * 0.72 && Math.abs(nz) <= 0.82;
}

function axeBlade({ nx, ny, nz }) {
  const forward = (nx + 1) / 2;
  return nx > -0.72 && Math.abs(ny + 0.08) <= 0.28 + forward * 0.65 && Math.abs(nz) <= 0.82;
}

function hoeBlade({ nx, ny, nz }) {
  return nx > -0.75 && ny < 0.45 && Math.abs(nz) <= 0.88 && (nx < -0.35 || ny < 0.05);
}

function sickleBlade({ nx, ny, nz }) {
  const dx = nx + 0.55;
  const dy = ny + 0.42;
  const radius = Math.sqrt(dx * dx + dy * dy);
  return Math.abs(nz) <= 0.82 && radius >= 0.52 && radius <= 1.08 && nx > -0.7 && ny > -0.82;
}

function chiselTip({ nx, ny, nz }) {
  const width = 0.18 + ((1 - ny) / 2) * 0.72;
  return Math.abs(nx) <= width && Math.abs(nz) <= width;
}

function swordBlade({ nx, ny, nz }) {
  const top = (ny + 1) / 2;
  const width = top > 0.76 ? Math.max(0.08, (1 - top) * 3.2) : 0.84;
  return Math.abs(nx) <= width && Math.abs(nz) <= 0.82;
}

function spearHead({ nx, ny, nz }) {
  const width = Math.max(0.1, 1 - (ny + 1) / 2);
  return Math.abs(nx) <= width && Math.abs(nz) <= width;
}

function maceHead({ nx, ny, nz }) {
  return nx * nx + ny * ny + nz * nz <= 1.05 || Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) > 0.82;
}

function roundMask({ nx, ny, nz }) {
  return nx * nx + ny * ny + nz * nz <= 1.15;
}

function bowlMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const outer = radial <= 0.98 && ny <= 0.7;
  const inner = radial < 0.62 && ny > -0.42;
  return outer && !inner;
}

function rimMask({ nx, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  return radial >= 0.68 && radial <= 1.02;
}

function bucketMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const taper = 0.72 + ((ny + 1) / 2) * 0.25;
  const wall = radial >= taper - 0.22 && radial <= taper;
  const bottom = ny < -0.72 && radial <= taper;
  return wall || bottom;
}

function names(en, es, fr, de, ja, ru, ko, zhHant, zhHans) {
  return Object.freeze({ en, es, fr, de, ja, ru, ko, "zh-Hant": zhHant, "zh-Hans": zhHans });
}

function localizedDescriptions(localizedNames, interaction) {
  const mode = interaction === "tool" ? "tool" : "placeable";
  const templates = mode === "tool" ? {
    en: (name) => `${name} is a canonical NCF1 hand-held blueprint made only from current NiceChunk forge materials and restored by the live game runtime.`,
    es: (name) => `${name} es un plano NCF1 canónico de mano, fabricado solo con materiales actuales de NiceChunk y restaurado por el entorno del juego.`,
    fr: (name) => `${name} est un plan NCF1 canonique tenu en main, composé uniquement de matériaux actuels de NiceChunk et restauré par le moteur du jeu.`,
    de: (name) => `${name} ist ein kanonischer, handgeführter NCF1-Bauplan, der nur aktuelle NiceChunk-Schmiedematerialien nutzt und von der Spiel-Laufzeit rekonstruiert wird.`,
    ja: (name) => `${name}は、現行のNiceChunk鍛造素材だけで作られ、ゲーム実行環境で復元される正規NCF1手持ち設計図です。`,
    ru: (name) => `${name} — канонический ручной чертёж NCF1, использующий только текущие кузнечные материалы NiceChunk и восстанавливаемый игровым движком.`,
    ko: (name) => `${name}은(는) 현재 NiceChunk 단조 재료만 사용하며 게임 런타임에서 복원되는 정규 NCF1 휴대 장비 설계도입니다.`,
    "zh-Hant": (name) => `${name}是僅使用現行 NiceChunk 鍛造材料、並可由遊戲執行環境還原的標準 NCF1 手持物品設計圖。`,
    "zh-Hans": (name) => `${name}是仅使用现行 NiceChunk 锻造材料、并可由游戏运行环境还原的标准 NCF1 手持物品设计图。`,
  } : {
    en: (name) => `${name} is a canonical NCF1 placeable blueprint made only from current NiceChunk forge materials and restored by the live game runtime.`,
    es: (name) => `${name} es un plano NCF1 canónico colocable, fabricado solo con materiales actuales de NiceChunk y restaurado por el entorno del juego.`,
    fr: (name) => `${name} est un plan NCF1 canonique à placer, composé uniquement de matériaux actuels de NiceChunk et restauré par le moteur du jeu.`,
    de: (name) => `${name} ist ein kanonischer platzierbarer NCF1-Bauplan, der nur aktuelle NiceChunk-Schmiedematerialien nutzt und von der Spiel-Laufzeit rekonstruiert wird.`,
    ja: (name) => `${name}は、現行のNiceChunk鍛造素材だけで作られ、ゲーム実行環境で復元される正規NCF1設置物設計図です。`,
    ru: (name) => `${name} — канонический размещаемый чертёж NCF1, использующий только текущие кузнечные материалы NiceChunk и восстанавливаемый игровым движком.`,
    ko: (name) => `${name}은(는) 현재 NiceChunk 단조 재료만 사용하며 게임 런타임에서 복원되는 정규 NCF1 배치형 설계도입니다.`,
    "zh-Hant": (name) => `${name}是僅使用現行 NiceChunk 鍛造材料、並可由遊戲執行環境還原的標準 NCF1 可放置物設計圖。`,
    "zh-Hans": (name) => `${name}是仅使用现行 NiceChunk 锻造材料、并可由游戏运行环境还原的标准 NCF1 可放置物设计图。`,
  };
  return Object.freeze(Object.fromEntries(LOCALES.map((locale) => [locale, templates[locale](localizedNames[locale])])));
}

function tool(category, key, parts, preview = null) {
  return Object.freeze({ category, key, parts: Object.freeze(parts), interaction: "tool", preview });
}

function placeable(category, key, parts, preview = null) {
  return Object.freeze({ category, key, parts: Object.freeze(parts), interaction: "placeable", preview });
}

function part(materialId, dimsQ, offsetQ, { grip = null, mask = null } = {}) {
  return Object.freeze({ materialId, dimsQ: Object.freeze(dimsQ), offsetQ: Object.freeze(offsetQ), grip, mask });
}

function handGrip(x, y = 0, z = 0) {
  return Object.freeze({ offsetQ: Object.freeze([x, y, z]), axis: 0, sign: 1, rotation: 0 });
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function equalBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
