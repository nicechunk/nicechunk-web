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
import {
  DEFAULT_PEASANT_GUY_NCM,
  avatarRightHandRotations,
  createAvatarMeshFromNcm,
  forgeAvatarTargetGrip,
  resolveAvatarMiningPose,
  updateAvatarMeshVertices,
} from "../../chunk.js/renderer/avatar-mesh.js";

const itemRoot = path.resolve(import.meta.dirname, "..");
const projectRoot = path.resolve(itemRoot, "..");
const rulesFile = process.env.ITEM_NCM_RULES_FILE
  ? path.resolve(process.env.ITEM_NCM_RULES_FILE)
  : path.join(projectRoot, "public/rules/smelting-rules.json");
const rules = JSON.parse(readFileSync(rulesFile, "utf8"));
const materialById = new Map(rules.materials.map((material) => [material.id, material]));
const runtimeCache = new ForgeRuntimeCache({ maxEntries: 32, maxBytes: 64 * 1024 * 1024 });

const LOCALES = Object.freeze(["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
const CATALOG_SCHEMA = "nicechunk.ncf-item-catalog.v1";
const ITEM_SCHEMA = "nicechunk.ncf-item.v1";
const MATERIAL_POLICY = "current-smelting-rules-only";
const BLOCK_SIZE_METERS = 0.4;
const AVATAR_HEIGHT_METERS = 1.75;
const AVATAR_SCALE = (AVATAR_HEIGHT_METERS / BLOCK_SIZE_METERS) / 2.52;
const FORGE_METERS_TO_WORLD_UNITS = 1 / BLOCK_SIZE_METERS;
const HELD_SOURCE_TO_AVATAR_AXES = Object.freeze(["+Y", "-Z", "-X"]);
const HELD_POSE_PITCHES = Object.freeze([-0.96, 0, 0.96]);
const HELD_POSE_PROGRESS = Object.freeze([0.01, 0.1, 0.2, 0.35, 0.55, 0.75, 0.95, 0.999]);

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
  "iron-earthwork-shovel": names(
    "Iron Earthwork Shovel", "Pala de terraplén de hierro", "Pelle de terrassement en fer",
    "Eiserne Erdbauschaufel", "鉄製土工作業シャベル", "Железная землеройная лопата",
    "철제 토공 삽", "鐵製土工作業鏟", "铁制土工作业铲",
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
  "copper-field-watering-can": names(
    "Copper Field Watering Can", "Regadera de campo de cobre", "Arrosoir de campagne en cuivre",
    "Kupferne Feldgießkanne", "銅製の畑用じょうろ", "Медная полевая лейка",
    "구리 농장 물뿌리개", "銅製田間澆水壺", "铜制田间浇水壶",
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
  "iron-hearth-cauldron": names(
    "Iron Hearth Cauldron", "Caldero de hogar de hierro", "Chaudron de foyer en fer", "Eiserner Herdkessel",
    "鉄製炉端大釜", "Железный очажный котёл", "철제 화덕 가마솥", "鐵製爐灶大鍋", "铁制炉灶大锅",
  ),
});

const ITEM_SPECS = Object.freeze([
  tool("mining-tools", "carbon-steel-prospector-pick", [
    part("wooden_stick", [4, 50, 4], [0, 0, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [4, 4, 36], [0, 27, 0], { mask: taperAlongZ }),
    part("iron_bloom", [8, 6, 7], [0, 24, 0]),
  ], held([1, 2], [[1]])),
  tool("mining-tools", "iron-deep-rock-pickaxe", [
    part("squared_timber", [5, 54, 5], [0, 0, 0], { grip: handGrip(3, -10) }),
    part("iron_bloom", [5, 5, 40], [0, 29, 0], { mask: taperAlongZ }),
    part("carbon_steel", [8, 6, 2], [0, 29, 4]),
  ], held([1, 2], [[1]])),
  tool("mining-tools", "basalt-stonebreaker-maul", [
    part("squared_timber", [5, 58, 5], [0, 0, 0], { grip: handGrip(3, -10) }),
    part("basalt_composite", [10, 10, 22], [0, 34, 0]),
    part("iron_bloom", [12, 12, 4], [0, 34, -13]),
    part("iron_bloom", [12, 12, 4], [0, 34, 13]),
  ], held([1, 2, 3], [[1, 2, 3]])),
  tool("mining-tools", "iron-earthwork-shovel", [
    part("squared_timber", [6, 58, 6], [0, -4, 0], { grip: handGrip(3, -22) }),
    part("iron_bloom", [4, 26, 24], [0, 36, 0], { mask: shovelBlade }),
    part("carbon_steel", [8, 8, 7], [0, 24, 0]),
    part("squared_timber", [6, 6, 18], [0, -36, 0]),
  ], held([1, 2], [[1], [3]]), { yaw: -0.74, pitch: 0.39 }, {
    image: "concepts/mining-tools/iron-earthwork-shovel-v1.webp",
    source: "imagegen",
    version: 1,
  }),

  tool("forestry-farming", "carbon-steel-forester-axe", [
    part("wooden_stick", [4, 48, 4], [0, 0, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [20, 18, 4], [7, 29, 0], { mask: axeBlade }),
    part("iron_bloom", [7, 8, 7], [0, 24, 0]),
  ], held([1, 2])),
  tool("forestry-farming", "iron-field-hoe", [
    part("squared_timber", [4, 62, 4], [0, 0, 0], { grip: handGrip(2, -10) }),
    part("iron_bloom", [12, 4, 22], [-5, 33, 0], { mask: hoeBlade }),
  ], held([1], [[1]])),
  tool("forestry-farming", "carbon-steel-harvest-sickle", [
    part("wooden_stick", [5, 24, 5], [0, -12, 0], { grip: handGrip(3, -2) }),
    part("carbon_steel", [28, 34, 3], [4, 14, 0], { mask: sickleBlade }),
  ], held([1])),
  tool("forestry-farming", "copper-field-watering-can", [
    part("squared_timber", [6, 20, 6], [15, -2, 0], { grip: handGrip(3, -4) }),
    part("squared_timber", [28, 6, 6], [1, -15, 0]),
    part("squared_timber", [6, 20, 6], [-10, -2, 0]),
    part("copper_bloom", [24, 22, 22], [0, 19, 0], { mask: wateringCanBody }),
    part("copper_bloom", [8, 18, 8], [0, 39, 0]),
    part("copper_bloom", [16, 6, 16], [0, 51, 0], { mask: wateringRoseMask }),
    part("copper_bloom", [4, 10, 10], [14, 19, 0], { mask: fillRimMask }),
  ], held([3, 4, 5]), { yaw: -0.78, pitch: 0.36 }, {
    image: "concepts/forestry-farming/copper-field-watering-can-v1.webp",
    source: "imagegen",
    version: 1,
  }),

  tool("workshop", "iron-blacksmith-hammer", [
    part("wooden_stick", [6, 36, 6], [0, 0, 0], { grip: handGrip(3, -13) }),
    part("iron_bloom", [8, 8, 22], [0, 22, 0]),
    part("carbon_steel", [10, 10, 5], [0, 22, -14]),
    part("carbon_steel", [10, 10, 5], [0, 22, 14]),
  ], held([1, 2, 3], [[1, 2, 3]])),
  tool("workshop", "timber-carpenter-mallet", [
    part("wooden_stick", [8, 34, 8], [0, 0, 0], { grip: handGrip(4, -15) }),
    part("squared_timber", [10, 10, 24], [0, 22, 0]),
    part("wooden_plank", [12, 12, 4], [0, 22, -14]),
    part("wooden_plank", [12, 12, 4], [0, 22, 14]),
  ], held([1, 2, 3], [[1, 2, 3]])),
  tool("workshop", "carbon-steel-masonry-chisel", [
    part("carbon_steel", [5, 30, 5], [0, 0, 0], { grip: handGrip(3, -5) }),
    part("carbon_steel", [4, 14, 4], [0, 22, 0], { mask: chiselTip }),
    part("iron_bloom", [9, 4, 9], [0, -17, 0]),
  ], held([1])),

  tool("weapons", "frontier-longsword", [
    part("wooden_stick", [5, 20, 8], [0, -30, 0], { grip: handGrip(3, 0) }),
    part("iron_bloom", [8, 8, 8], [0, -44, 0], { mask: roundMask }),
    part("carbon_steel", [6, 4, 24], [0, -18, 0]),
    part("carbon_steel", [9, 62, 3], [0, 15, 0], { mask: swordBlade }),
  ], held([3], [[2]])),
  tool("weapons", "guardian-spear", [
    part("squared_timber", [4, 84, 4], [0, -10, 0], { grip: handGrip(2, -8) }),
    part("carbon_steel", [12, 24, 4], [0, 44, 0], { mask: spearHead }),
    part("iron_bloom", [7, 8, 7], [0, 30, 0]),
  ], held([1, 2])),
  tool("weapons", "basalt-war-mace", [
    part("wooden_stick", [5, 42, 5], [0, -5, 0], { grip: handGrip(3, -6) }),
    part("iron_bloom", [8, 8, 8], [0, 20, 0]),
    part("basalt_composite", [18, 18, 18], [0, 33, 0], { mask: maceHead }),
  ], held([1, 2])),

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
  ], held([1, 2, 3, 4])),
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

  placeable("cooking", "iron-hearth-cauldron", [
    part("iron_bloom", [26, 16, 26], [0, 21, 0], { mask: cauldronBowlMask }),
    part("iron_bloom", [30, 3, 30], [0, 29, 0], { mask: cauldronRimMask }),
    part("iron_bloom", [12, 3, 12], [0, 12, 0], { mask: roundMask }),
    ...[-4, 4].flatMap((x) => [-4, 4].map((z) => part("iron_bloom", [3, 12, 3], [x, 6, z]))),
    part("copper_bloom", [3, 12, 16], [-16, 23, 0], { mask: sideHandleMask }),
    part("copper_bloom", [3, 12, 16], [16, 23, 0], { mask: sideHandleMask }),
  ], { yaw: -0.76, pitch: 0.48 }, {
    image: "concepts/cooking/iron-hearth-cauldron-v1.webp",
    source: "imagegen",
    version: 1,
  }),
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
  const concept = spec.concept ? buildConcept(spec) : null;
  const holding = spec.interaction === "tool"
    ? validateToolHolding(spec, runtime)
    : null;

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
    ...(concept ? { concept } : {}),
    ...(holding ? { holding } : {}),
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
      gripDirectionValidated: true,
      currentMaterialsOnly: true,
      chainMinted: false,
    },
  };
}

function validateToolHolding(spec, runtime) {
  const policy = spec.holding;
  const components = runtime.components ?? [];
  const gripIndexes = components
    .map((component, index) => component?.grip ? index : -1)
    .filter((index) => index >= 0);
  if (!policy || gripIndexes.length !== 1) throw new Error(`${spec.key} must define one directional holding policy.`);
  const gripComponentIndex = gripIndexes[0];
  const workComponentIndexes = validatedComponentIndexes(policy.workComponentIndexes, components.length, `${spec.key} work components`);
  if (!workComponentIndexes.length || workComponentIndexes.includes(gripComponentIndex)) {
    throw new Error(`${spec.key} must identify a work end separate from its gripped handle.`);
  }
  const lateralComponentGroups = policy.lateralComponentGroups.map((group, index) => (
    validatedComponentIndexes(group, components.length, `${spec.key} lateral group ${index}`)
  ));
  const gripComponent = components[gripComponentIndex];
  const designGripQ = gripComponent.grip.offsetQ.map((value, axis) => value + gripComponent.offsetQ[axis]);
  for (const componentIndex of workComponentIndexes) {
    if (components[componentIndex].offsetQ[1] <= designGripQ[1]) {
      throw new Error(`${spec.key} work component ${componentIndex} does not extend forward from the hand.`);
    }
  }
  for (const [index, group] of lateralComponentGroups.entries()) {
    const spans = componentGroupSpansQ(components, group);
    if (spans[2] <= spans[0] * 1.1) {
      throw new Error(`${spec.key} lateral group ${index} is not modeled across source Z.`);
    }
  }

  const basis = forgeGripSourceBasis(gripComponent.grip);
  assertDirection(spec.key, "source +X", mapForgeDirection([1, 0, 0], basis), [0, 1, 0]);
  assertDirection(spec.key, "source +Y", mapForgeDirection([0, 1, 0], basis), [0, 0, -1]);
  assertDirection(spec.key, "source +Z", mapForgeDirection([0, 0, 1], basis), [-1, 0, 0]);

  const avatarMesh = createAvatarMeshFromNcm(DEFAULT_PEASANT_GUY_NCM, {
    scale: AVATAR_SCALE,
    attachIronPickaxe: true,
    attachForgedPickaxe: true,
    forgeRuntime: runtime,
    forgeMetersToWorldUnits: FORGE_METERS_TO_WORLD_UNITS,
  });
  const forgedPart = avatarMesh.parts.find((part) => part.forgedTool && part.forgeDesignHash === runtime.designHash);
  const collisionParts = (avatarMesh.collisionParts ?? []).filter((part) => part.equipmentId === "forged_pickaxe");
  if (!forgedPart || collisionParts.length !== components.length) {
    throw new Error(`${spec.key} failed to mount its exact restored geometry on the canonical avatar.`);
  }
  assertMountedScale(spec.key, runtime, forgedPart);
  const targetGrip = forgeAvatarTargetGrip(avatarMesh.handAnchors.right_hand_item, avatarMesh.modelScale);
  for (const componentIndex of workComponentIndexes) {
    if (collisionParts[componentIndex].cz >= targetGrip[2] - 0.01) {
      throw new Error(`${spec.key} work component ${componentIndex} points back toward the avatar after mounting.`);
    }
  }
  for (const [index, group] of lateralComponentGroups.entries()) {
    const spans = boxGroupSpans(collisionParts, group);
    if (spans[0] <= spans[1] * 1.1) {
      throw new Error(`${spec.key} lateral group ${index} is not horizontal after avatar mounting.`);
    }
  }
  const testedPoseCount = validateMountedMotion(spec.key, avatarMesh, gripComponentIndex);

  return {
    gripComponentIndex,
    workComponentIndexes,
    lateralComponentGroups,
    sourceToAvatarAxes: [...HELD_SOURCE_TO_AVATAR_AXES],
    testedPoseCount,
  };
}

function validatedComponentIndexes(input, componentCount, label) {
  if (!Array.isArray(input)) throw new Error(`${label} must be an array.`);
  const values = input.map(Number);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value >= componentCount)
      || new Set(values).size !== values.length) {
    throw new Error(`${label} contains an invalid component index.`);
  }
  return values;
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

function forgeGripSourceBasis(grip) {
  const approach = [0, 0, 0];
  approach[Math.max(0, Math.min(2, Math.trunc(grip.axis ?? 1)))] = Number(grip.sign) >= 0 ? 1 : -1;
  let front = Math.abs(approach[1]) < 0.75 ? [0, 1, 0] : [0, 0, -Math.sign(approach[1]) || -1];
  front = normalize(subtract(front, scale(approach, dot(front, approach))));
  const rotation = (Math.trunc(Number(grip.rotation) || 0) & 3) * Math.PI / 2;
  if (rotation) front = rotateAroundAxis(front, approach, rotation);
  return { side: normalize(cross(front, approach)), front, approach };
}

function mapForgeDirection(vector, basis) {
  const side = dot(vector, basis.side);
  const front = dot(vector, basis.front);
  const approach = dot(vector, basis.approach);
  return [side, approach, -front];
}

function assertDirection(key, label, actual, expected) {
  if (actual.some((value, axis) => Math.abs(value - expected[axis]) > 1e-8)) {
    throw new Error(`${key} maps ${label} to an unsafe avatar direction.`);
  }
}

function assertMountedScale(key, runtime, forgedPart) {
  const sourceBounds = unionPickBounds(runtime.mesh.pickBounds ?? []);
  const sourceMeters = sourceBounds.min.map((value, axis) => sourceBounds.max[axis] - value).sort((left, right) => left - right);
  const mountedMeters = [forgedPart.sx, forgedPart.sy, forgedPart.sz]
    .map((value) => value * BLOCK_SIZE_METERS)
    .sort((left, right) => left - right);
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(sourceMeters[axis] - mountedMeters[axis]) > 0.0001) {
      throw new Error(`${key} changed physical scale while mounting on the avatar.`);
    }
  }
}

function unionPickBounds(bounds) {
  const result = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const bound of bounds) {
    for (let axis = 0; axis < 3; axis += 1) {
      result.min[axis] = Math.min(result.min[axis], bound.min[axis]);
      result.max[axis] = Math.max(result.max[axis], bound.max[axis]);
    }
  }
  return result;
}

function boxGroupSpans(parts, indexes) {
  const bounds = unionBoxBounds(indexes.map((index) => parts[index]));
  return bounds.min.map((value, axis) => bounds.max[axis] - value);
}

function validateMountedMotion(key, avatarMesh, gripComponentIndex) {
  const equipment = {
    rightHand: "pickaxe",
    equipmentId: "forged_pickaxe",
    forged: true,
    designHash: avatarMesh.parts.find((part) => part.forgedTool)?.forgeDesignHash,
  };
  const frames = [
    { label: "idle", animation: { moving: false, timeMs: 0, equipment }, armX: 0, mining: false },
    { label: "walk-forward", animation: { moving: true, timeMs: Math.PI * 0.5 / 0.011, equipment }, armX: -0.32, mining: false },
    { label: "walk-back", animation: { moving: true, timeMs: Math.PI * 1.5 / 0.011, equipment }, armX: 0.32, mining: false },
  ];
  for (const pitchOffset of HELD_POSE_PITCHES) {
    for (const progress of HELD_POSE_PROGRESS) {
      const pose = resolveAvatarMiningPose(progress, pitchOffset);
      frames.push({
        label: `swing-${pitchOffset}-${progress}`,
        animation: { timeMs: 0, equipment, miningProgress: progress, miningAimPitch: pitchOffset },
        armX: pose.armX,
        mining: pose.active,
      });
    }
  }

  const collisionParts = (avatarMesh.collisionParts ?? []).filter((part) => part.equipmentId === "forged_pickaxe");
  for (const frame of frames) {
    const vertices = new Float32Array(updateAvatarMeshVertices(avatarMesh, frame.animation));
    const bodyBounds = avatarPartBounds(avatarMesh, vertices, (part) => (
      !part.equipment && !["left_arm", "right_arm", "right_hand_item"].includes(part.bone)
    ));
    const handBounds = unionBounds(avatarPartBounds(avatarMesh, vertices, (part) => part.bone === "right_arm"));
    const rotation = avatarRightHandRotations(avatarMesh, "forged_pickaxe", {
      armX: frame.armX,
      mining: frame.mining,
    }).right_hand_item;
    const pivot = avatarMesh.pivots.right_hand_item;
    const offset = avatarMesh.boneOffsets.right_hand_item ?? [0, 0, 0];
    const posedTools = collisionParts.map((part) => posedBoxBounds(part, pivot, rotation, offset));
    for (const toolBounds of posedTools) {
      for (const bodyPart of bodyBounds) {
        if (boundsOverlap(toolBounds, bodyPart, 0.00001)) {
          const pose = avatarMesh.equipmentPoses?.forged_pickaxe;
          throw new Error(`${key} intersects ${bodyPart.name} during ${frame.label} (carryZ=${pose?.carryZ}, miningZ=${pose?.miningZ}).`);
        }
      }
    }
    if (!boundsOverlap(posedTools[gripComponentIndex], handBounds, 0)) {
      throw new Error(`${key} detaches from the hand during ${frame.label}.`);
    }
  }
  return frames.length;
}

function avatarPartBounds(mesh, vertices, predicate) {
  const result = [];
  let vertexCursor = 0;
  for (const part of mesh.parts) {
    const vertexCount = part.geometry ? part.geometry.vertices.length / 10 : 24;
    if (predicate(part)) {
      const bounds = { name: part.name || part.bone || "part", min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let index = vertexCursor; index < vertexCursor + vertexCount; index += 1) {
        const offset = index * 10;
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], vertices[offset + axis]);
          bounds.max[axis] = Math.max(bounds.max[axis], vertices[offset + axis]);
        }
      }
      result.push(bounds);
    }
    vertexCursor += vertexCount;
  }
  return result;
}

function posedBoxBounds(part, pivot, rotation, offset) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const x of [part.cx - part.sx * 0.5, part.cx + part.sx * 0.5]) {
    for (const y of [part.cy - part.sy * 0.5, part.cy + part.sy * 0.5]) {
      for (const z of [part.cz - part.sz * 0.5, part.cz + part.sz * 0.5]) {
        const point = rotate([x - pivot[0], y - pivot[1], z - pivot[2]], rotation)
          .map((value, axis) => value + pivot[axis] + (offset[axis] || 0));
        for (let axis = 0; axis < 3; axis += 1) {
          bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
          bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
        }
      }
    }
  }
  return bounds;
}

function unionBoxBounds(parts) {
  return parts.reduce((bounds, part) => {
    bounds.min[0] = Math.min(bounds.min[0], part.cx - part.sx * 0.5);
    bounds.min[1] = Math.min(bounds.min[1], part.cy - part.sy * 0.5);
    bounds.min[2] = Math.min(bounds.min[2], part.cz - part.sz * 0.5);
    bounds.max[0] = Math.max(bounds.max[0], part.cx + part.sx * 0.5);
    bounds.max[1] = Math.max(bounds.max[1], part.cy + part.sy * 0.5);
    bounds.max[2] = Math.max(bounds.max[2], part.cz + part.sz * 0.5);
    return bounds;
  }, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
}

function unionBounds(boundsList) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const entry of boundsList) {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], entry.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], entry.max[axis]);
    }
  }
  return bounds;
}

function boundsOverlap(left, right, clearance = 0) {
  return [0, 1, 2].every((axis) => (
    Math.min(left.max[axis], right.max[axis]) - Math.max(left.min[axis], right.min[axis]) > clearance
  ));
}

function buildConcept(spec) {
  const concept = spec.concept;
  const expectedImage = `concepts/${spec.category}/${spec.key}-v${concept.version}.webp`;
  if (concept.source !== "imagegen" || !Number.isInteger(concept.version) || concept.version < 1 || concept.image !== expectedImage) {
    throw new Error(`${spec.key} has invalid concept provenance.`);
  }
  const bytes = readFileSync(path.join(itemRoot, concept.image));
  return {
    image: concept.image,
    source: concept.source,
    version: concept.version,
    sha256: createHash("sha256").update(bytes).digest("hex"),
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

function taperAlongZ({ nx, ny, nz }) {
  const thickness = 0.18 + (1 - Math.abs(nz)) * 0.8;
  return Math.abs(nx) <= thickness && Math.abs(ny) <= thickness;
}

function shovelBlade({ nx, ny, nz }) {
  const forward = (ny + 1) / 2;
  const halfWidth = Math.min(0.98, 0.36 + forward * 0.88);
  const clippedFrontCorner = ny > 0.78 && Math.abs(nz) > 0.86;
  return Math.abs(nx) <= 0.86 && Math.abs(nz) <= halfWidth && !clippedFrontCorner;
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

function cauldronBowlMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const outer = radial <= 0.98 && ny <= 0.78;
  const inner = radial < 0.78 && ny > -0.66;
  return outer && !inner;
}

function cauldronRimMask({ nx, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  return radial >= 0.78 && radial <= 1.02;
}

function bucketMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const taper = 0.72 + ((ny + 1) / 2) * 0.25;
  const wall = radial >= taper - 0.22 && radial <= taper;
  const bottom = ny < -0.72 && radial <= taper;
  return wall || bottom;
}

function sideHandleMask({ ny, nz }) {
  const outer = Math.max(Math.abs(ny), Math.abs(nz)) <= 0.98;
  const inner = Math.abs(ny) < 0.5 && Math.abs(nz) < 0.62;
  return outer && !inner;
}

function wateringCanBody({ nx, ny, nz }) {
  const shell = Math.max(Math.abs(nx), Math.abs(ny), Math.abs(nz)) >= 0.68;
  const fillOpening = nx > 0.6 && Math.abs(ny) < 0.46 && Math.abs(nz) < 0.46;
  return shell && !fillOpening;
}

function wateringRoseMask({ x, nx, ny, nz }) {
  const face = Math.max(Math.abs(nx), Math.abs(nz));
  if (face > 0.98) return false;
  if (ny < -0.46) return true;
  const rim = face >= 0.7;
  const brace = Math.abs(nx) <= 0.18 || Math.abs(nz) <= 0.18;
  const perforated = (x + Math.round((nz + 1) * 4)) % 2 === 0;
  return rim || brace || !perforated;
}

function fillRimMask({ ny, nz }) {
  const outer = Math.max(Math.abs(ny), Math.abs(nz)) <= 0.98;
  const inner = Math.abs(ny) < 0.5 && Math.abs(nz) < 0.5;
  return outer && !inner;
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

function tool(category, key, parts, holding, preview = null, concept = null) {
  return Object.freeze({
    category,
    key,
    parts: Object.freeze(parts),
    interaction: "tool",
    holding,
    preview,
    concept: concept ? Object.freeze({ ...concept }) : null,
  });
}

function placeable(category, key, parts, preview = null, concept = null) {
  return Object.freeze({
    category,
    key,
    parts: Object.freeze(parts),
    interaction: "placeable",
    preview,
    concept: concept ? Object.freeze({ ...concept }) : null,
  });
}

function part(materialId, dimsQ, offsetQ, { grip = null, mask = null } = {}) {
  return Object.freeze({ materialId, dimsQ: Object.freeze(dimsQ), offsetQ: Object.freeze(offsetQ), grip, mask });
}

function handGrip(x, y = 0, z = 0) {
  return Object.freeze({ offsetQ: Object.freeze([x, y, z]), axis: 0, sign: 1, rotation: 0 });
}

function held(workComponentIndexes, lateralComponentGroups = []) {
  return Object.freeze({
    workComponentIndexes: Object.freeze([...workComponentIndexes]),
    lateralComponentGroups: Object.freeze(lateralComponentGroups.map((group) => Object.freeze([...group]))),
  });
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function subtract(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(vector, amount) {
  return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
  return scale(vector, 1 / length);
}

function rotateAroundAxis(vector, axis, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const parallel = scale(axis, dot(axis, vector) * (1 - cosine));
  const perpendicular = scale(cross(axis, vector), sine);
  return [
    vector[0] * cosine + perpendicular[0] + parallel[0],
    vector[1] * cosine + perpendicular[1] + parallel[1],
    vector[2] * cosine + perpendicular[2] + parallel[2],
  ];
}

function rotate(vector, rotation = {}) {
  let [x, y, z] = vector;
  if (rotation.z) {
    const cosine = Math.cos(rotation.z);
    const sine = Math.sin(rotation.z);
    [x, y] = [x * cosine - y * sine, x * sine + y * cosine];
  }
  if (rotation.x) {
    const cosine = Math.cos(rotation.x);
    const sine = Math.sin(rotation.x);
    [y, z] = [y * cosine - z * sine, y * sine + z * cosine];
  }
  if (rotation.y) {
    const cosine = Math.cos(rotation.y);
    const sine = Math.sin(rotation.y);
    [x, z] = [x * cosine + z * sine, -x * sine + z * cosine];
  }
  return [x, y, z];
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function equalBytes(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
