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
const BOOK_LAYOUTS = Object.freeze({
  "timber-bound-village-ledger": { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] },
  "open-civic-record-book": { portrait: false, pageSets: [{ page: 3, lower: 0 }, { page: 4, lower: 1 }] },
  "stacked-archive-volumes": {
    portrait: false,
    pageSets: [
      { page: 1, lower: 0, upper: 2 },
      { page: 5, lower: 4, upper: 6 },
      { page: 9, lower: 8, upper: 10 },
    ],
  },
  "civilization-code-codex": { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] },
  "mining-skill-manual": { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] },
  "forging-skill-treatise": { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] },
  "farming-skill-handbook": { portrait: true, pageSets: [{ page: 1, lower: 0, upper: 2 }] },
});
const FRAMED_TEXTILE_LAYOUTS = Object.freeze({
  "timber-framed-woven-tapestry": {
    cloth: 8,
    frame: [0, 1, 2, 3, 4, 5, 6, 7],
    decorations: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
  },
});
const DRAWER_CABINET_LAYOUTS = Object.freeze({
  "timber-apothecary-drawer-cabinet": {
    frame: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    drawers: [11, 12, 13, 14, 15, 16],
    handles: [17, 18, 19, 20, 21, 22],
  },
});
const STREET_LANTERN_LAYOUTS = Object.freeze({
  "amber-village-street-lantern": {
    plinth: 0,
    base: 1,
    post: 2,
    collar: 3,
    lowerPlate: 4,
    glass: 5,
    corners: [6, 7, 8, 9],
    upperPlate: 10,
    cap: [11, 12],
    finial: 13,
  },
});
const PUBLIC_BENCH_LAYOUTS = Object.freeze({
  "iron-braced-village-public-bench": {
    seat: 0,
    backSlats: [1, 2],
    backPosts: [3, 4],
    legs: [5, 6, 7, 8],
    stretchers: [9, 10],
    sideBraces: [11, 12],
  },
});
const WALL_CLOCK_LAYOUTS = Object.freeze({
  "copper-rimmed-village-wall-clock": {
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
  },
});
const SHOP_SIGN_LAYOUTS = Object.freeze({
  "iron-bracketed-village-shop-sign": {
    wallPlate: 0,
    arm: 1,
    endCap: 2,
    brace: 3,
    hangers: [4, 5],
    board: 6,
    frame: [7, 8, 9, 10],
    cornerStuds: [11, 12, 13, 14],
    emblem: [15, 16],
  },
});
const NOTICE_BOARD_LAYOUTS = Object.freeze({
  "timber-village-public-notice-board": {
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
  },
});
const HANDBELL_LAYOUTS = Object.freeze({
  "copper-town-crier-handbell": {
    handle: 0,
    collar: 1,
    body: 2,
    rim: 3,
    clapperStem: 4,
    clapper: 5,
  },
});
const WINDOW_BOX_LAYOUTS = Object.freeze({
  "iron-braced-village-window-box-planter": {
    back: 0,
    front: 1,
    sides: [2, 3],
    floor: 4,
    soil: 5,
    cornerBands: [6, 7],
    brackets: [8, 9, 10, 11],
    blooms: [12, 13, 14],
  },
});
const DRINKING_TROUGH_LAYOUTS = Object.freeze({
  "stone-and-timber-village-drinking-trough": {
    feet: [0, 1],
    floor: 2,
    walls: [3, 4, 5, 6],
    water: 7,
    timberRail: 8,
    spout: 9,
    spoutMouth: 10,
  },
});
const ROADSIDE_WELL_LAYOUTS = Object.freeze({
  "stone-and-timber-village-roadside-well": {
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
  },
});
const DIRECTION_SIGNPOST_LAYOUTS = Object.freeze({
  "stone-and-timber-village-roadside-direction-signpost": {
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
  },
});
const PUBLIC_LITTER_BIN_LAYOUTS = Object.freeze({
  "iron-braced-village-public-litter-bin": {
    feet: [0, 1, 2, 3],
    floor: 4,
    walls: [5, 6, 7, 8],
    lowerBands: [9, 10, 11, 12],
    middleBands: [13, 14, 15, 16],
    rim: [17, 18, 19, 20],
    handle: [21, 22, 23],
  },
});
const COAT_RACK_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-coat-rack": {
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
  },
});
const BEDSIDE_TABLE_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-bedside-table": {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    shelf: 8,
    upperCollars: [9, 10, 11, 12],
    top: 13,
    drawer: 14,
    handle: 15,
    topCaps: [16, 17, 18, 19],
  },
});
const WASHSTAND_LAYOUTS = Object.freeze({
  "copper-basin-timber-village-inn-washstand": {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    shelf: 8,
    upperCollars: [9, 10, 11, 12],
    basinFloor: 13,
    basinWalls: [14, 15, 16, 17],
    towelRail: [18, 19, 20],
  },
});
const SINGLE_BED_FRAME_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-single-bed-frame": {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    sideRails: [8, 9],
    headRails: [10, 11],
    headSlats: [12, 13, 14],
    footboard: 15,
    supportSlats: [16, 17, 18, 19],
    caps: [20, 21, 22, 23],
  },
});
const ROOM_KEY_BOARD_LAYOUTS = Object.freeze({
  "iron-hooked-timber-village-inn-room-key-board": {
    board: 0,
    frame: [1, 2, 3, 4],
    hangers: [5, 6],
    labels: [7, 8, 9, 10, 11, 12],
    hooks: [13, 14, 15, 16, 17, 18],
  },
});
const RECEPTION_COUNTER_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-reception-counter": {
    feet: [0, 1, 2, 3],
    posts: [4, 5, 6, 7],
    frontBeams: [8, 9],
    frontPanels: [10, 11, 12],
    countertop: 13,
    staffShelves: [14, 15],
    sideAprons: [16, 17],
    ironBands: [18, 19],
  },
});
const LUGGAGE_RACK_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-luggage-rack": {
    feet: [0, 1, 2, 3],
    legs: [4, 5, 6, 7],
    upperRails: [8, 9],
    luggageSlats: [10, 11, 12, 13],
    lowerRails: [14, 15],
    shoeSlats: [16, 17, 18, 19],
    cornerPlates: [20, 21, 22, 23],
  },
});
const WRITING_DESK_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-writing-desk": {
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
  },
});
const WRITING_CHAIR_LAYOUTS = Object.freeze({
  "iron-braced-timber-village-inn-writing-chair": {
    feet: [0, 1, 2, 3],
    frontLegs: [4, 5],
    rearPosts: [6, 7],
    seat: 8,
    backSlats: [9, 10],
    frontStretcher: 11,
    sideStretchers: [12, 13],
    rearStretcher: 14,
    seatPlates: [15, 16, 17, 18],
  },
});
const WALL_MIRROR_LAYOUTS = Object.freeze({
  "polished-copper-timber-village-inn-wall-mirror": {
    backplate: 0,
    frame: [1, 2, 3, 4],
    mirrorFace: 5,
    hangers: [6, 7],
    cornerPlates: [8, 9, 10, 11],
  },
});

const COLORS = Object.freeze({
  amber_glass_panel: 0xda5,
  basalt_brick: 0x334,
  basalt_composite: 0x354,
  biochar_compost: 0x432,
  blue_dye: 0x258,
  carbon_steel: 0x899,
  clear_glass_panel: 0x9ce,
  copper_bloom: 0xb64,
  fired_clay_brick: 0xa54,
  glass_ingot: 0x9cd,
  ice_blue_glass_panel: 0x8bd,
  iron_bloom: 0x9a9,
  polished_stone_slab: 0xaab,
  red_dye: 0xb43,
  squared_timber: 0x865,
  wooden_plank: 0xa75,
  wooden_stick: 0x753,
  yellow_dye: 0xdb3,
});
const TAPESTRY_KNOT_PATTERN = Object.freeze([
  ".....####.....",
  "...###..###...",
  "..##..##..##..",
  ".##..####..##.",
  "##..######..##",
  "##..######..##",
  ".##..####..##.",
  "..##..##..##..",
  "...###..###...",
  ".....####.....",
]);

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
  "amber-village-street-lantern": names(
    "Amber Village Street Lantern", "Farola de aldea de vidrio ámbar", "Réverbère de village en verre ambré",
    "Dorfstraßenlaterne aus Bernsteinglas", "琥珀ガラスの村落街灯", "Деревенский фонарь с янтарным стеклом",
    "호박 유리 마을 가로등", "琥珀玻璃村莊街燈", "琥珀玻璃村庄街灯",
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
  "timber-apothecary-drawer-cabinet": names(
    "Timber Apothecary Drawer Cabinet", "Gabinete de cajones de boticario de madera", "Meuble d’apothicaire à tiroirs en bois",
    "Apotheker-Schubladenschrank aus Holz", "木製薬種引き出し棚", "Деревянный аптекарский шкаф с ящиками",
    "목재 약재 서랍장", "木製藥材抽屜櫃", "木制药材抽屉柜",
  ),
  "iron-braced-village-public-bench": names(
    "Iron-braced Village Public Bench", "Banco público de aldea reforzado con hierro", "Banc public de village renforcé de fer",
    "Eisenverstärkte öffentliche Dorfbank", "鉄補強の村の公共ベンチ", "Деревенская общественная скамья с железным усилением",
    "철제 보강 마을 공공 벤치", "鐵箍村莊公共長椅", "铁箍村庄公共长椅",
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
  "iron-field-cooking-grate": names(
    "Iron Field Cooking Grate", "Parrilla de campaña de hierro", "Grille de cuisine de campagne en fer",
    "Eiserner Feldkochrost", "鉄製の野外調理台", "Железная походная решётка",
    "철제 야외 조리대", "鐵製野外烹飪架", "铁制野外烹饪架",
  ),
  "timber-bound-village-ledger": names(
    "Timber-bound Village Ledger", "Libro mayor de aldea encuadernado en madera", "Registre de village relié en bois",
    "Holzgebundenes Dorfregister", "木装丁の村落台帳", "Деревенская учётная книга в деревянном переплёте",
    "목재 장정 마을 장부", "木封村莊帳簿", "木封村庄账簿",
  ),
  "open-civic-record-book": names(
    "Open Civic Record Book", "Libro de registro cívico abierto", "Registre municipal ouvert",
    "Offenes Bürgerregister", "開かれた行政記録簿", "Открытая городская учётная книга",
    "펼쳐진 마을 행정 기록부", "攤開的市政記錄簿", "摊开的市政记录簿",
  ),
  "stacked-archive-volumes": names(
    "Stacked Archive Volumes", "Volúmenes de archivo apilados", "Volumes d’archives empilés",
    "Gestapelte Archivbände", "積み重ねた公文書冊子", "Стопка архивных томов",
    "쌓아 둔 기록 보관 서적", "疊放的檔案藏書", "叠放的档案藏书",
  ),
  "civilization-code-codex": names(
    "Civilization Code Codex", "Códice del Código de la Civilización", "Codex du Code de la civilisation",
    "Kodex des Zivilisationsrechts", "文明法典", "Кодекс цивилизации",
    "문명 법전", "文明法典", "文明法典",
  ),
  "mining-skill-manual": names(
    "Mining Skill Manual", "Manual de habilidad minera", "Manuel de compétence minière",
    "Handbuch der Bergbaufertigkeit", "採掘技能書", "Учебник навыка горного дела",
    "채광 기술서", "採礦技能書", "采矿技能书",
  ),
  "forging-skill-treatise": names(
    "Forging Skill Treatise", "Tratado de habilidad de forja", "Traité de maîtrise de la forge",
    "Lehrbuch der Schmiedekunst", "鍛造技能書", "Трактат о кузнечном мастерстве",
    "단조 기술서", "鍛造技能書", "锻造技能书",
  ),
  "farming-skill-handbook": names(
    "Farming Skill Handbook", "Manual de habilidad agrícola", "Manuel de compétence agricole",
    "Handbuch der Landwirtschaft", "農耕技能書", "Справочник по земледелию",
    "농경 기술서", "農耕技能書", "农耕技能书",
  ),
  "timber-framed-woven-tapestry": names(
    "Timber-framed Woven Tapestry", "Tapiz tejido con marco de madera", "Tapisserie tissée à cadre en bois",
    "Gewebter Wandteppich im Holzrahmen", "木枠の織りタペストリー", "Тканый гобелен в деревянной раме",
    "목재 틀 직조 태피스트리", "木框編織壁毯", "木框编织壁毯",
  ),
  "copper-rimmed-village-wall-clock": names(
    "Copper-rimmed Village Wall Clock", "Reloj de pared de aldea con aro de cobre", "Horloge murale de village cerclée de cuivre",
    "Dorf-Wanduhr mit Kupferrand", "銅縁の村落壁掛け時計", "Деревенские настенные часы с медным ободом",
    "구리 테두리 마을 벽시계", "銅邊村莊掛鐘", "铜边村庄挂钟",
  ),
  "iron-bracketed-village-shop-sign": names(
    "Iron-bracketed Village Shop Sign", "Letrero de tienda de aldea con soporte de hierro", "Enseigne de boutique villageoise sur potence en fer",
    "Dorfladenschild mit Eisenhalterung", "鉄製ブラケット付き村落商店看板", "Деревенская магазинная вывеска на железном кронштейне",
    "철제 브래킷 마을 상점 간판", "鐵架村莊商店招牌", "铁架村庄商店招牌",
  ),
  "timber-village-public-notice-board": names(
    "Timber Village Public Notice Board", "Tablón público de anuncios de aldea en madera", "Panneau d’affichage public de village en bois",
    "Öffentliche Dorfanschlagtafel aus Holz", "木製村落公共掲示板", "Деревянная общественная доска объявлений деревни",
    "목재 마을 공공 게시판", "木製村莊公共公告板", "木制村庄公共公告板",
  ),
  "copper-town-crier-handbell": names(
    "Copper Town Crier Handbell", "Campana de mano de cobre del pregonero", "Clochette à main en cuivre du crieur public",
    "Kupferne Handglocke des Ausrufers", "銅製の町触れ手鈴", "Медный ручной колокол городского глашатая",
    "구리 마을 전령 손종", "銅製城鎮傳令手鈴", "铜制城镇传令手铃",
  ),
  "iron-braced-village-window-box-planter": names(
    "Iron-braced Village Window-box Planter", "Jardinera de ventana de aldea reforzada con hierro", "Jardinière de fenêtre villageoise renforcée de fer",
    "Eisenverstärkter Dorf-Fensterblumenkasten", "鉄補強の村落窓辺プランター", "Деревенский оконный цветочный ящик с железными скобами",
    "철제 보강 마을 창가 화분 상자", "鐵箍村莊窗臺花箱", "铁箍村庄窗台花箱",
  ),
  "stone-and-timber-village-drinking-trough": names(
    "Stone-and-timber Village Drinking Trough", "Abrevadero público de aldea de piedra y madera", "Abreuvoir public de village en pierre et bois",
    "Dorftränke aus Stein und Holz", "石と木の村落共同水飲み槽", "Деревенская общественная поилка из камня и дерева",
    "석재·목재 마을 공용 물통", "石木村莊公共飲水槽", "石木村庄公共饮水槽",
  ),
  "stone-and-timber-village-roadside-well": names(
    "Stone-and-timber Village Roadside Well", "Pozo de camino de aldea de piedra y madera", "Puits de bord de route villageois en pierre et bois",
    "Dorfbrunnen am Weg aus Stein und Holz", "石と木の村落街道井戸", "Деревенский придорожный колодец из камня и дерева",
    "석재·목재 마을 길가 우물", "石木村莊路邊水井", "石木村庄路边水井",
  ),
  "stone-and-timber-village-roadside-direction-signpost": names(
    "Stone-and-timber Village Roadside Direction Signpost", "Poste indicador de camino de aldea de piedra y madera", "Poteau indicateur routier villageois en pierre et bois",
    "Dorfwegweiser aus Stein und Holz", "石と木の村落街道道標", "Деревенский придорожный указатель из камня и дерева",
    "석재·목재 마을 길가 방향 표지대", "石木村莊路邊指路牌", "石木村庄路边指路牌",
  ),
  "iron-braced-village-public-litter-bin": names(
    "Iron-braced Village Public Litter Bin", "Papelera pública de aldea reforzada con hierro", "Corbeille publique villageoise renforcée de fer",
    "Eisenverstärkter öffentlicher Dorfabfallbehälter", "鉄補強の村落公共ごみ箱", "Деревенская общественная урна с железными скобами",
    "철제 보강 마을 공공 쓰레기통", "鐵箍村莊公共垃圾桶", "铁箍村庄公共垃圾桶",
  ),
  "iron-braced-timber-village-inn-coat-rack": names(
    "Iron-braced Timber Village Inn Coat Rack", "Perchero de posada de aldea de madera reforzado con hierro", "Portemanteau d’auberge villageoise en bois renforcé de fer",
    "Eisenverstärkter Holzkleiderständer für Dorfgasthäuser", "鉄補強の木製村宿コート掛け", "Деревянная вешалка деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 옷걸이", "鐵箍木製村莊旅店衣帽架", "铁箍木制村庄客栈衣帽架",
  ),
  "iron-braced-timber-village-inn-bedside-table": names(
    "Iron-braced Timber Village Inn Bedside Table", "Mesita de noche de posada de aldea de madera reforzada con hierro", "Table de chevet d’auberge villageoise en bois renforcée de fer",
    "Eisenverstärkter Holz-Nachttisch für Dorfgasthäuser", "鉄補強の木製村宿ベッドサイドテーブル", "Деревянная прикроватная тумба деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 침대 탁자", "鐵箍木製村莊旅店床頭櫃", "铁箍木制村庄客栈床头柜",
  ),
  "copper-basin-timber-village-inn-washstand": names(
    "Copper-basin Timber Village Inn Washstand", "Lavabo de posada de aldea de madera con palangana de cobre", "Meuble de toilette d’auberge villageoise en bois avec bassin en cuivre",
    "Holzwaschtisch für Dorfgasthäuser mit Kupferbecken", "銅たらい付き木製村宿洗面台", "Деревянный умывальный столик деревенской гостиницы с медным тазом",
    "구리 세숫대야 목재 마을 여관 세면대", "銅盆木製村莊旅店盥洗架", "铜盆木制村庄客栈盥洗架",
  ),
  "iron-braced-timber-village-inn-single-bed-frame": names(
    "Iron-braced Timber Village Inn Single Bed Frame", "Bastidor de cama individual de posada de aldea de madera reforzado con hierro", "Cadre de lit simple d’auberge villageoise en bois renforcé de fer",
    "Eisenverstärktes Einzelbettgestell aus Holz für Dorfgasthäuser", "鉄補強の木製村宿シングルベッド枠", "Деревянный каркас односпальной кровати деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 1인용 침대틀", "鐵箍木製村莊旅店單人床架", "铁箍木制村庄客栈单人床架",
  ),
  "iron-hooked-timber-village-inn-room-key-board": names(
    "Iron-hooked Timber Village Inn Room-key Board", "Tablero de llaves de habitaciones de posada de aldea en madera con ganchos de hierro", "Tableau à clés de chambres d’auberge villageoise en bois avec crochets en fer",
    "Hölzernes Zimmerschlüsselbrett für Dorfgasthäuser mit Eisenhaken", "鉄フック付き木製村宿客室鍵掛け板", "Деревянная доска для ключей от номеров деревенской гостиницы с железными крючками",
    "철제 갈고리 목재 마을 여관 객실 열쇠판", "鐵鉤木製村莊旅店房間鑰匙板", "铁钩木制村庄客栈房间钥匙板",
  ),
  "iron-braced-timber-village-inn-reception-counter": names(
    "Iron-braced Timber Village Inn Reception Counter", "Mostrador de recepción de posada de aldea de madera reforzado con hierro", "Comptoir d’accueil d’auberge villageoise en bois renforcé de fer",
    "Eisenverstärkter Holzempfangstresen für Dorfgasthäuser", "鉄補強の木製村宿受付カウンター", "Деревянная стойка регистрации деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 접수대", "鐵箍木製村莊旅店接待櫃檯", "铁箍木制村庄客栈接待柜台",
  ),
  "iron-braced-timber-village-inn-luggage-rack": names(
    "Iron-braced Timber Village Inn Luggage Rack", "Portaequipajes de posada de aldea de madera reforzado con hierro", "Porte-bagages d’auberge villageoise en bois renforcé de fer",
    "Eisenverstärkte Holz-Gepäckablage für Dorfgasthäuser", "鉄補強の木製村宿荷物台", "Деревянная багажная подставка деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 짐받이", "鐵箍木製村莊旅店行李架", "铁箍木制村庄客栈行李架",
  ),
  "iron-braced-timber-village-inn-writing-desk": names(
    "Iron-braced Timber Village Inn Writing Desk", "Escritorio de posada de aldea de madera reforzado con hierro", "Bureau d’écriture d’auberge villageoise en bois renforcé de fer",
    "Eisenverstärkter Holzschreibtisch für Dorfgasthäuser", "鉄補強の木製村宿書き物机", "Деревянный письменный стол деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 책상", "鐵箍木製村莊旅店寫字桌", "铁箍木制村庄客栈写字桌",
  ),
  "iron-braced-timber-village-inn-writing-chair": names(
    "Iron-braced Timber Village Inn Writing Chair", "Silla de escritorio de posada de aldea de madera reforzada con hierro", "Chaise de bureau d’auberge villageoise en bois renforcée de fer",
    "Eisenverstärkter Holzschreibstuhl für Dorfgasthäuser", "鉄補強の木製村宿書き物椅子", "Деревянный письменный стул деревенской гостиницы с железными скобами",
    "철제 보강 목재 마을 여관 책상 의자", "鐵箍木製村莊旅店寫字椅", "铁箍木制村庄客栈写字椅",
  ),
  "polished-copper-timber-village-inn-wall-mirror": names(
    "Polished-copper Timber Village Inn Wall Mirror", "Espejo de pared de posada de aldea de madera con cobre pulido", "Miroir mural d’auberge villageoise en bois à face de cuivre poli",
    "Dorfherbergen-Wandspiegel aus Holz mit polierter Kupferfläche", "磨き銅面の木製村宿壁鏡", "Настенное зеркало деревенской гостиницы в деревянной раме с полированной медной поверхностью",
    "광택 구리면 목재 마을 여관 벽거울", "拋光銅面木框村莊旅店壁鏡", "抛光铜面木框村庄客栈壁镜",
  ),
  "iron-blacksmith-anvil": names(
    "Iron Blacksmith Anvil", "Yunque de herrero de hierro", "Enclume de forgeron en fer", "Eiserner Schmiedeamboss",
    "鉄製の鍛冶金床", "Железная кузнечная наковальня", "철제 대장장이 모루", "鐵製鍛造砧", "铁制锻造砧",
  ),
  "timber-market-display-stand": names(
    "Timber Market Display Stand", "Expositor de mercado de madera", "Présentoir de marché en bois", "Marktauslage aus Holz",
    "木製市場陳列台", "Деревянный рыночный прилавок", "목재 시장 진열대", "木製市集陳列臺", "木制集市陈列台",
  ),
  "brick-and-timber-pallet": names(
    "Brick and Timber Pallet", "Palé de ladrillo y madera", "Palette de briques et de bois", "Ziegel-und-Holz-Palette",
    "れんがと木材のパレット", "Поддон с кирпичом и брусом", "벽돌 및 목재 팔레트", "磚木材料托盤", "砖木材料托盘",
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
  placeable("workshop", "iron-blacksmith-anvil", [
    part("basalt_brick", [42, 8, 34], [0, 4, 0]),
    part("iron_bloom", [26, 26, 22], [0, 21, 0]),
    part("iron_bloom", [18, 12, 18], [0, 40, 0]),
    part("iron_bloom", [66, 12, 26], [0, 52, 0]),
    part("carbon_steel", [28, 10, 16], [43, 53, 0], { mask: chiselTip }),
    part("carbon_steel", [14, 18, 24], [-40, 49, 0]),
  ], { yaw: -0.82, pitch: 0.28 }),

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
  tool("handheld-civic", "copper-town-crier-handbell", [
    part("squared_timber", [7, 16, 7], [0, -10, 0], { grip: handGrip(4, -5, 3) }),
    part("iron_bloom", [8, 4, 8], [0, 0, 0]),
    part("copper_bloom", [12, 6, 12], [0, 5, 0], { mask: handbellBodyMask }),
    part("copper_bloom", [14, 4, 14], [0, 10, 0], { mask: handbellRimMask }),
    part("iron_bloom", [3, 8, 3], [0, 6, 0]),
    part("iron_bloom", [5, 4, 5], [0, 10, 0], { mask: roundMask }),
  ], held([1, 2, 3, 4, 5]), { yaw: -0.62, pitch: 0.28 }, {
    image: "concepts/handheld-civic/copper-town-crier-handbell-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("lighting", "basalt-standing-brazier", [
    part("basalt_brick", [20, 6, 20], [0, 3, 0]),
    part("iron_bloom", [6, 28, 6], [0, 20, 0]),
    part("iron_bloom", [34, 14, 34], [0, 39, 0], { mask: bowlMask }),
    part("copper_bloom", [36, 4, 36], [0, 46, 0], { mask: rimMask }),
  ]),
  placeable("lighting", "amber-village-street-lantern", [
    part("polished_stone_slab", [36, 6, 36], [0, 3, 0]),
    part("basalt_brick", [24, 12, 24], [0, 12, 0]),
    part("iron_bloom", [6, 58, 6], [0, 47, 0]),
    part("iron_bloom", [14, 6, 14], [0, 79, 0]),
    part("iron_bloom", [28, 4, 28], [0, 84, 0]),
    part("amber_glass_panel", [20, 20, 20], [0, 96, 0]),
    ...[-12, 12].flatMap((x) => [-12, 12].map((z) => part("iron_bloom", [4, 20, 4], [x, 96, z]))),
    part("iron_bloom", [30, 4, 30], [0, 108, 0]),
    part("copper_bloom", [24, 4, 24], [0, 112, 0]),
    part("copper_bloom", [16, 4, 16], [0, 116, 0]),
    part("iron_bloom", [6, 8, 6], [0, 122, 0]),
  ], { yaw: -0.74, pitch: 0.24 }, {
    image: "concepts/lighting/amber-village-street-lantern-v1.webp",
    source: "imagegen",
    version: 1,
  }),

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
  placeable("furniture", "timber-apothecary-drawer-cabinet", [
    part("squared_timber", [6, 68, 22], [-29, 36, 0]),
    part("squared_timber", [6, 68, 22], [29, 36, 0]),
    part("squared_timber", [52, 6, 22], [0, 5, 0]),
    part("wooden_plank", [52, 62, 4], [0, 39, -9]),
    part("squared_timber", [64, 6, 26], [0, 73, 0]),
    part("squared_timber", [64, 4, 26], [0, 0, 0]),
    part("wooden_plank", [52, 4, 4], [0, 36, 9]),
    ...[-9, 9].map((x) => part("wooden_plank", [2, 26, 4], [x, 21, 9])),
    ...[-9, 9].map((x) => part("wooden_plank", [2, 26, 4], [x, 51, 9])),
    ...[21, 51].flatMap((y) => [-18, 0, 18].map((x) => part("wooden_plank", [16, 26, 16], [x, y, 1]))),
    ...[21, 51].flatMap((y) => [-18, 0, 18].map((x) => part("iron_bloom", [5, 4, 4], [x, y, 11]))),
  ], { yaw: -0.72, pitch: 0.34 }, {
    image: "concepts/furniture/timber-apothecary-drawer-cabinet-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-village-public-bench", [
    part("wooden_plank", [96, 6, 30], [0, 27, 0]),
    part("wooden_plank", [88, 8, 6], [0, 40, 18]),
    part("wooden_plank", [88, 8, 6], [0, 50, 18]),
    part("squared_timber", [4, 34, 6], [-46, 41, 18]),
    part("squared_timber", [4, 34, 6], [46, 41, 18]),
    part("squared_timber", [8, 24, 8], [-38, 12, -10]),
    part("squared_timber", [8, 24, 8], [-38, 12, 10]),
    part("squared_timber", [8, 24, 8], [38, 12, -10]),
    part("squared_timber", [8, 24, 8], [38, 12, 10]),
    part("iron_bloom", [68, 4, 4], [0, 12, -13]),
    part("iron_bloom", [68, 4, 4], [0, 12, 13]),
    part("iron_bloom", [4, 4, 12], [-38, 12, 0]),
    part("iron_bloom", [4, 4, 12], [38, 12, 0]),
  ], { yaw: -0.74, pitch: 0.3 }, {
    image: "concepts/furniture/iron-braced-village-public-bench-v1.webp",
    source: "imagegen",
    version: 1,
  }),

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
  placeable("cooking", "iron-field-cooking-grate", [
    part("iron_bloom", [48, 4, 4], [0, 32, -18]),
    part("iron_bloom", [48, 4, 4], [0, 32, 18]),
    part("iron_bloom", [4, 4, 32], [-22, 32, 0]),
    part("iron_bloom", [4, 4, 32], [22, 32, 0]),
    ...[-14, -7, 0, 7, 14].map((x) => part("carbon_steel", [4, 3, 32], [x, 32, 0])),
    ...[-21, 21].flatMap((x) => [-17, 17].map((z) => part("iron_bloom", [6, 28, 6], [x, 16, z]))),
    ...[-21, 21].flatMap((x) => [-17, 17].map((z) => part("iron_bloom", [12, 4, 12], [x, 0, z]))),
  ], { yaw: -0.72, pitch: 0.4 }, {
    image: "concepts/cooking/iron-field-cooking-grate-v1.webp",
    source: "imagegen",
    version: 1,
  }),

  placeable("commerce", "timber-market-display-stand", [
    part("wooden_plank", [82, 6, 34], [0, 67, 0]),
    ...[-34, 34].flatMap((x) => [-11, 11].map((z) => part("squared_timber", [6, 24, 6], [x, 12, z]))),
    ...[-34, 34].flatMap((x) => [-11, 11].map((z) => part("squared_timber", [6, 34, 6], [x, 47, z]))),
    part("wooden_plank", [70, 6, 28], [0, 27, 0]),
    part("wooden_plank", [76, 32, 6], [0, 84, 20]),
    part("wooden_stick", [72, 4, 4], [0, 72, -15]),
    part("wooden_stick", [72, 4, 4], [0, 72, 15]),
    part("copper_bloom", [12, 12, 4], [0, 86, 15]),
  ], { yaw: -0.66, pitch: 0.27 }),

  placeable("construction", "brick-and-timber-pallet", [
    part("wooden_plank", [88, 6, 58], [0, 3, 0]),
    ...[-20, 0, 20].map((z) => part("squared_timber", [80, 6, 8], [0, -3, z])),
    ...[-27, 0, 27].flatMap((x) => [-14, 14].map((z) => part("fired_clay_brick", [22, 16, 22], [x, 14, z]))),
    ...[-14, 14].flatMap((x) => [-14, 14].map((z) => part("fired_clay_brick", [22, 16, 22], [x, 30, z]))),
    part("wooden_stick", [4, 42, 60], [-32, 21, 0]),
    part("wooden_stick", [4, 42, 60], [32, 21, 0]),
  ], { yaw: -0.76, pitch: 0.38 }),

  placeable("books-writing", "timber-bound-village-ledger", portraitBookParts([
    part("wooden_plank", [22, 1, 16], [0, 0, 0]),
    part("cotton_cloth", [19, 3, 13], [0, 2, 0]),
    part("wooden_plank", [22, 1, 16], [0, 4, 0]),
    part("resin_binder", [3, 3, 16], [-11, 2, 0]),
    ...[-7, 0, 7].map((x) => part("resin_binder", [2, 1, 16], [x, 5, 0])),
  ]), { yaw: -0.78, pitch: 0.5, clothMotion: "rigid" }, {
    image: "concepts/books-writing/timber-bound-village-ledger-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "open-civic-record-book", [
    part("wooden_plank", [16, 2, 18], [-9, 0, 0]),
    part("wooden_plank", [16, 2, 18], [9, 0, 0]),
    part("resin_binder", [2, 4, 18], [0, 1, 0]),
    part("cotton_cloth", [14, 2, 15], [-8, 2, 0]),
    part("cotton_cloth", [14, 2, 15], [8, 2, 0]),
    part("resin_binder", [2, 2, 15], [0, 4, 0]),
  ], { yaw: -0.45, pitch: 0.6, clothMotion: "rigid" }, {
    image: "concepts/books-writing/open-civic-record-book-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "stacked-archive-volumes", [
    part("wooden_plank", [28, 1, 18], [0, 0, 0]),
    part("cotton_cloth", [25, 3, 15], [0, 2, 0]),
    part("wooden_plank", [28, 1, 18], [0, 4, 0]),
    part("resin_binder", [3, 3, 18], [-14, 2, 0]),
    part("wooden_plank", [20, 1, 26], [3, 5, 0]),
    part("cotton_cloth", [17, 3, 23], [3, 7, 0]),
    part("wooden_plank", [20, 1, 26], [3, 9, 0]),
    part("resin_binder", [20, 3, 3], [3, 7, -13]),
    part("wooden_plank", [24, 1, 16], [-2, 10, 1]),
    part("cotton_cloth", [21, 3, 13], [-2, 12, 1]),
    part("wooden_plank", [24, 1, 16], [-2, 14, 1]),
    part("resin_binder", [3, 3, 16], [-14, 12, 1]),
  ], { yaw: -0.74, pitch: 0.5, clothMotion: "rigid" }, {
    image: "concepts/books-writing/stacked-archive-volumes-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "civilization-code-codex", portraitBookParts([
    part("wooden_plank", [30, 1, 22], [0, 0, 0]),
    part("cotton_cloth", [27, 5, 19], [0, 3, 0]),
    part("wooden_plank", [30, 1, 22], [0, 6, 0]),
    part("resin_binder", [3, 5, 22], [-15, 3, 0]),
    part("blue_dye", [22, 1, 14], [1, 7, 0]),
    part("iron_bloom", [24, 1, 2], [1, 7, -8]),
    part("iron_bloom", [24, 1, 2], [1, 7, 8]),
    part("iron_bloom", [2, 1, 14], [-11, 7, 0]),
    part("iron_bloom", [2, 1, 14], [13, 7, 0]),
    part("yellow_dye", [14, 1, 2], [1, 8, -5]),
    part("yellow_dye", [14, 1, 2], [1, 8, 5]),
    part("yellow_dye", [2, 1, 10], [-6, 8, 0]),
    part("yellow_dye", [2, 1, 10], [8, 8, 0]),
    part("red_dye", [8, 1, 2], [1, 8, -3]),
    part("red_dye", [8, 1, 2], [1, 8, 3]),
    part("red_dye", [2, 1, 6], [-3, 8, 0]),
    part("red_dye", [2, 1, 6], [5, 8, 0]),
    part("yellow_dye", [4, 1, 4], [1, 8, 0]),
    ...[-13, 13].flatMap((x) => [-9, 9].map((z) => part("iron_bloom", [4, 1, 4], [x, 7, z]))),
    part("iron_bloom", [4, 1, 6], [13, 7, 0]),
    part("iron_bloom", [3, 5, 4], [15, 4, 0]),
  ]), { yaw: -0.74, pitch: 0.5, clothMotion: "rigid" }, {
    image: "concepts/books-writing/civilization-code-codex-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "mining-skill-manual", portraitBookParts([
    part("wooden_plank", [22, 1, 16], [0, 0, 0]),
    part("cotton_cloth", [19, 3, 13], [0, 2, 0]),
    part("wooden_plank", [22, 1, 16], [0, 4, 0]),
    part("resin_binder", [3, 3, 16], [-11, 2, 0]),
    part("iron_bloom", [2, 1, 12], [-8, 5, 0]),
    part("iron_bloom", [2, 1, 12], [-5, 5, 0]),
    ...[-9, 9].flatMap((x) => [-6, 6].map((z) => part("iron_bloom", [4, 1, 4], [x, 5, z]))),
    part("iron_bloom", [8, 1, 2], [2, 5, -3]),
    part("iron_bloom", [6, 1, 2], [3, 5, 3]),
    part("iron_bloom", [4, 1, 5], [9, 5, 0]),
    part("iron_bloom", [3, 3, 3], [11, 2, 0]),
  ]), { yaw: -0.72, pitch: 0.48, clothMotion: "rigid" }, {
    image: "concepts/books-writing/mining-skill-manual-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "forging-skill-treatise", portraitBookParts([
    part("wooden_plank", [24, 1, 18], [0, 0, 0]),
    part("cotton_cloth", [21, 3, 15], [0, 2, 0]),
    part("wooden_plank", [24, 1, 18], [0, 4, 0]),
    part("resin_binder", [3, 3, 18], [-12, 2, 0]),
    part("red_dye", [12, 1, 10], [1, 5, 0]),
    part("iron_bloom", [16, 1, 2], [1, 5, -6]),
    part("iron_bloom", [16, 1, 2], [1, 5, 6]),
    part("iron_bloom", [2, 1, 10], [-6, 5, 0]),
    part("iron_bloom", [2, 1, 10], [8, 5, 0]),
    part("iron_bloom", [2, 1, 10], [1, 6, 0]),
    part("iron_bloom", [12, 1, 2], [1, 6, 0]),
    ...[-6, 0, 6].map((z) => part("iron_bloom", [3, 1, 3], [-11, 5, z])),
    ...[-10, 10].flatMap((x) => [-7, 7].map((z) => part("iron_bloom", [4, 1, 4], [x, 5, z]))),
    part("iron_bloom", [4, 1, 5], [10, 5, 0]),
    part("iron_bloom", [3, 3, 4], [12, 2, 0]),
  ]), { yaw: -0.74, pitch: 0.48, clothMotion: "rigid" }, {
    image: "concepts/books-writing/forging-skill-treatise-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("books-writing", "farming-skill-handbook", portraitBookParts([
    part("wooden_plank", [20, 1, 15], [0, 0, 0]),
    part("cotton_cloth", [17, 3, 13], [0, 2, 0]),
    part("cotton_cloth", [20, 1, 15], [0, 4, 0]),
    part("resin_binder", [3, 3, 15], [-10, 2, 0]),
    part("yellow_dye", [12, 1, 10], [1, 5, 0]),
    part("resin_binder", [16, 1, 2], [1, 5, -6]),
    part("resin_binder", [16, 1, 2], [1, 5, 6]),
    part("resin_binder", [2, 1, 10], [-6, 5, 0]),
    part("resin_binder", [2, 1, 10], [8, 5, 0]),
    ...[-3, 0, 3].map((z) => part("blue_dye", [10, 1, 1], [1, 6, z])),
    ...[-4, 6].flatMap((x) => [-4, 4].map((z) => part("red_dye", [2, 1, 2], [x, 6, z]))),
    ...[-5, 0, 5].map((z) => part("resin_binder", [4, 1, 3], [-9, 5, z])),
    part("resin_binder", [4, 1, 4], [8, 5, 0]),
    part("wooden_plank", [3, 3, 4], [10, 2, 0]),
  ]), { yaw: -0.72, pitch: 0.5, clothMotion: "rigid" }, {
    image: "concepts/books-writing/farming-skill-handbook-v1.webp",
    source: "imagegen",
    version: 1,
  }),

  placeable("interior-decor", "timber-framed-woven-tapestry", [
    part("squared_timber", [6, 84, 6], [-38, 42, 0]),
    part("squared_timber", [6, 84, 6], [38, 42, 0]),
    part("squared_timber", [70, 6, 6], [0, 3, 0]),
    part("squared_timber", [70, 6, 6], [0, 81, 0]),
    part("wooden_plank", [10, 10, 8], [-40, 1, 0]),
    part("wooden_plank", [10, 10, 8], [40, 1, 0]),
    part("wooden_plank", [10, 10, 8], [-40, 83, 0]),
    part("wooden_plank", [10, 10, 8], [40, 83, 0]),
    part("cotton_cloth", [70, 72, 1], [0, 42, 0]),
    part("squared_timber", [5, 10, 5], [0, 89, 0]),
    part("wooden_plank", [14, 14, 5], [0, 101, 0], { mask: tapestryHangerMask }),
    part("red_dye", [60, 4, 1], [0, 70, 1]),
    part("red_dye", [60, 4, 1], [0, 14, 1]),
    ...[-29, 29].flatMap((x) => [22, 62].map((y) => part("red_dye", [5, 5, 1], [x, y, 1]))),
    part("yellow_dye", [38, 4, 1], [0, 61, 1]),
    part("yellow_dye", [38, 4, 1], [0, 23, 1]),
    part("yellow_dye", [4, 34, 1], [-23, 42, 1]),
    part("yellow_dye", [4, 34, 1], [23, 42, 1]),
    part("blue_dye", [30, 30, 1], [0, 42, 1], { mask: tapestryKnotMask }),
  ], { yaw: -0.5, pitch: 0.2, clothMotion: "rigid" }, {
    image: "concepts/interior-decor/timber-framed-woven-tapestry-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("interior-decor", "copper-rimmed-village-wall-clock", [
    part("wooden_plank", [40, 64, 1], [0, 0, 0]),
    part("squared_timber", [4, 56, 1], [-18, 0, 1]),
    part("squared_timber", [4, 56, 1], [18, 0, 1]),
    part("squared_timber", [32, 4, 1], [0, 30, 1]),
    part("squared_timber", [32, 4, 1], [0, -30, 1]),
    part("squared_timber", [12, 4, 1], [0, 34, 1]),
    part("iron_bloom", [4, 4, 1], [0, 34, 2]),
    part("wooden_plank", [30, 30, 1], [0, 10, 1], { mask: clockFaceMask }),
    part("copper_bloom", [34, 34, 1], [0, 10, 2], { mask: clockBezelMask }),
    part("clear_glass_panel", [30, 30, 1], [0, 10, 3], { mask: clockFaceMask }),
    part("iron_bloom", [28, 28, 1], [0, 10, 4], { mask: clockHourStudMask }),
    part("copper_bloom", [16, 16, 1], [0, 10, 5], { mask: clockHandsMask }),
    part("iron_bloom", [3, 3, 1], [0, 10, 6]),
    part("clear_glass_panel", [16, 18, 1], [0, -17, 1]),
    part("squared_timber", [2, 20, 1], [-9, -17, 1]),
    part("squared_timber", [2, 20, 1], [9, -17, 1]),
    part("squared_timber", [16, 2, 1], [0, -7, 1]),
    part("squared_timber", [16, 2, 1], [0, -27, 1]),
    part("copper_bloom", [2, 10, 1], [0, -13, 2]),
    part("copper_bloom", [8, 8, 1], [0, -22, 2], { mask: roundMask }),
  ], { yaw: -0.48, pitch: 0.24 }, {
    image: "concepts/interior-decor/copper-rimmed-village-wall-clock-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("signage", "iron-bracketed-village-shop-sign", [
    part("iron_bloom", [4, 56, 3], [-30, 16, 0]),
    part("iron_bloom", [60, 4, 3], [2, 42, 0]),
    part("iron_bloom", [6, 8, 4], [35, 42, 0]),
    part("iron_bloom", [18, 22, 2], [-19, 29, 0], { mask: shopSignBraceMask }),
    part("iron_bloom", [3, 14, 2], [-4, 33, 0]),
    part("iron_bloom", [3, 14, 2], [20, 33, 0]),
    part("wooden_plank", [40, 28, 1], [8, 8, 0]),
    part("squared_timber", [4, 32, 2], [-14, 8, 0]),
    part("squared_timber", [4, 32, 2], [30, 8, 0]),
    part("squared_timber", [40, 4, 2], [8, 24, 0]),
    part("squared_timber", [40, 4, 2], [8, -8, 0]),
    ...[-13, 29].flatMap((x) => [-7, 23].map((y) => part("iron_bloom", [3, 3, 1], [x, y, 1]))),
    part("red_dye", [24, 20, 1], [8, 8, 1], { mask: shopSignDiamondMask }),
    part("yellow_dye", [14, 12, 1], [8, 8, 2], { mask: shopSignMerchantMarkMask }),
  ], { yaw: -0.66, pitch: 0.28 }, {
    image: "concepts/signage/iron-bracketed-village-shop-sign-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("signage", "timber-village-public-notice-board", [
    part("polished_stone_slab", [18, 8, 22], [-48, 4, 0]),
    part("polished_stone_slab", [18, 8, 22], [48, 4, 0]),
    part("iron_bloom", [14, 8, 16], [-48, 12, 0]),
    part("iron_bloom", [14, 8, 16], [48, 12, 0]),
    part("squared_timber", [10, 86, 10], [-48, 59, 0]),
    part("squared_timber", [10, 86, 10], [48, 59, 0]),
    ...[46, 60, 74, 88].map((y) => part("wooden_plank", [86, 12, 4], [0, y, 0])),
    part("squared_timber", [6, 64, 6], [-46, 68, 0]),
    part("squared_timber", [6, 64, 6], [46, 68, 0]),
    part("squared_timber", [86, 6, 6], [0, 97, 0]),
    part("squared_timber", [86, 6, 6], [0, 37, 0]),
    part("iron_bloom", [78, 48, 2], [0, 67, 3], { mask: noticeBoardFastenerMask }),
    part("squared_timber", [112, 8, 10], [0, 106, 0]),
    part("wooden_plank", [116, 4, 30], [0, 112, 0]),
    part("wooden_plank", [104, 4, 26], [0, 116, 0]),
    part("wooden_plank", [92, 4, 22], [0, 120, 0]),
    part("wooden_stick", [10, 8, 30], [-51, 116, 0]),
    part("wooden_stick", [10, 8, 30], [51, 116, 0]),
  ], { yaw: -0.62, pitch: 0.25 }, {
    image: "concepts/signage/timber-village-public-notice-board-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("exterior-decor", "iron-braced-village-window-box-planter", [
    part("wooden_plank", [76, 16, 2], [0, 8, -11]),
    part("wooden_plank", [76, 16, 2], [0, 8, 11]),
    part("wooden_plank", [2, 16, 20], [-39, 8, 0]),
    part("wooden_plank", [2, 16, 20], [39, 8, 0]),
    part("wooden_plank", [76, 2, 20], [0, 1, 0]),
    part("biochar_compost", [72, 4, 20], [0, 14, 0]),
    part("iron_bloom", [2, 18, 24], [-37, 8, 0], { mask: windowBoxCornerBandMask }),
    part("iron_bloom", [2, 18, 24], [37, 8, 0], { mask: windowBoxCornerBandMask }),
    part("iron_bloom", [2, 14, 2], [-22, -7, -11]),
    part("iron_bloom", [2, 2, 20], [-22, -1, 0]),
    part("iron_bloom", [2, 14, 2], [22, -7, -11]),
    part("iron_bloom", [2, 2, 20], [22, -1, 0]),
    part("red_dye", [10, 12, 10], [-24, 22, 0], { mask: windowBoxBloomMask }),
    part("yellow_dye", [10, 10, 10], [0, 21, 0], { mask: windowBoxBloomMask }),
    part("blue_dye", [10, 12, 10], [24, 22, 0], { mask: windowBoxBloomMask }),
  ], { yaw: -0.68, pitch: 0.3 }, {
    image: "concepts/exterior-decor/iron-braced-village-window-box-planter-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("exterior-decor", "stone-and-timber-village-drinking-trough", [
    part("polished_stone_slab", [28, 8, 24], [-36, 4, 0]),
    part("polished_stone_slab", [28, 8, 24], [36, 4, 0]),
    part("polished_stone_slab", [96, 6, 28], [0, 11, 0]),
    part("polished_stone_slab", [96, 16, 5], [0, 22, -16]),
    part("polished_stone_slab", [96, 16, 5], [0, 22, 16]),
    part("polished_stone_slab", [5, 16, 27], [-50, 22, 0]),
    part("polished_stone_slab", [5, 16, 27], [50, 22, 0]),
    part("ice_blue_glass_panel", [95, 2, 27], [0, 28, 0]),
    part("squared_timber", [60, 4, 5], [0, 28, -21]),
    part("iron_bloom", [6, 10, 18], [0, 31, -9]),
    part("iron_bloom", [8, 8, 6], [0, 34, 3]),
  ], { yaw: -0.66, pitch: 0.26 }, {
    image: "concepts/exterior-decor/stone-and-timber-village-drinking-trough-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("exterior-decor", "stone-and-timber-village-roadside-well", [
    part("polished_stone_slab", [76, 6, 66], [0, 3, 0]),
    part("polished_stone_slab", [64, 30, 8], [0, 21, -27]),
    part("polished_stone_slab", [64, 30, 8], [0, 21, 27]),
    part("polished_stone_slab", [8, 30, 46], [-28, 21, 0]),
    part("polished_stone_slab", [8, 30, 46], [28, 21, 0]),
    part("iron_bloom", [16, 8, 16], [-24, 40, -23]),
    part("iron_bloom", [16, 8, 16], [24, 40, -23]),
    part("squared_timber", [8, 66, 8], [-24, 77, -23]),
    part("squared_timber", [8, 66, 8], [24, 77, -23]),
    part("iron_bloom", [16, 8, 16], [-24, 114, -23]),
    part("iron_bloom", [16, 8, 16], [24, 114, -23]),
    part("squared_timber", [32, 10, 10], [0, 113, -23]),
    part("squared_timber", [40, 10, 20], [0, 79, -13]),
    part("wooden_stick", [4, 26, 4], [0, 61, -5]),
    part("squared_timber", [24, 22, 24], [0, 37, 3], { mask: wellSuspendedBucketMask }),
    part("iron_bloom", [12, 6, 6], [34, 79, -23]),
    part("iron_bloom", [6, 24, 6], [43, 67, -23]),
    part("wooden_stick", [16, 6, 6], [54, 67, -23]),
  ], { yaw: -0.7, pitch: 0.27 }, {
    image: "concepts/exterior-decor/stone-and-timber-village-roadside-well-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("exterior-decor", "stone-and-timber-village-roadside-direction-signpost", [
    part("polished_stone_slab", [38, 6, 32], [0, 3, 0]),
    part("polished_stone_slab", [30, 10, 24], [0, 11, 0]),
    part("iron_bloom", [18, 8, 18], [0, 20, 0]),
    part("squared_timber", [10, 78, 10], [0, 63, 0]),
    part("iron_bloom", [16, 6, 16], [0, 105, 0]),
    part("squared_timber", [20, 4, 20], [0, 110, 0]),
    part("wooden_plank", [40, 12, 6], [-25, 90, 0]),
    part("wooden_plank", [12, 12, 6], [-51, 90, 0], { mask: directionSignLeftArrowMask }),
    part("iron_bloom", [6, 8, 2], [-8, 90, 4]),
    part("wooden_plank", [40, 12, 6], [25, 72, 0]),
    part("wooden_plank", [12, 12, 6], [51, 72, 0], { mask: directionSignRightArrowMask }),
    part("iron_bloom", [6, 8, 2], [8, 72, 4]),
    part("wooden_plank", [40, 12, 6], [-25, 54, 0]),
    part("wooden_plank", [12, 12, 6], [-51, 54, 0], { mask: directionSignLeftArrowMask }),
    part("iron_bloom", [6, 8, 2], [-8, 54, 4]),
  ], { yaw: -0.72, pitch: 0.25 }, {
    image: "concepts/exterior-decor/stone-and-timber-village-roadside-direction-signpost-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("exterior-decor", "iron-braced-village-public-litter-bin", [
    part("iron_bloom", [6, 6, 6], [-11, 3, -11]),
    part("iron_bloom", [6, 6, 6], [11, 3, -11]),
    part("iron_bloom", [6, 6, 6], [-11, 3, 11]),
    part("iron_bloom", [6, 6, 6], [11, 3, 11]),
    part("wooden_plank", [28, 8, 28], [0, 10, 0]),
    part("wooden_plank", [28, 32, 2], [0, 26, -15]),
    part("wooden_plank", [28, 32, 2], [0, 26, 15]),
    part("wooden_plank", [2, 32, 28], [-15, 26, 0]),
    part("wooden_plank", [2, 32, 28], [15, 26, 0]),
    part("iron_bloom", [28, 3, 2], [0, 18, -17]),
    part("iron_bloom", [28, 3, 2], [0, 18, 17]),
    part("iron_bloom", [2, 3, 28], [-17, 18, 0]),
    part("iron_bloom", [2, 3, 28], [17, 18, 0]),
    part("iron_bloom", [28, 3, 2], [0, 30, -17]),
    part("iron_bloom", [28, 3, 2], [0, 30, 17]),
    part("iron_bloom", [2, 3, 28], [-17, 30, 0]),
    part("iron_bloom", [2, 3, 28], [17, 30, 0]),
    part("iron_bloom", [32, 4, 4], [0, 44, -16]),
    part("iron_bloom", [32, 4, 4], [0, 44, 16]),
    part("iron_bloom", [4, 4, 28], [-16, 44, 0]),
    part("iron_bloom", [4, 4, 28], [16, 44, 0]),
    part("iron_bloom", [4, 8, 4], [-8, 42, 18]),
    part("iron_bloom", [4, 8, 4], [8, 42, 18]),
    part("iron_bloom", [12, 4, 4], [0, 48, 18]),
  ], { yaw: -0.68, pitch: 0.31 }, {
    image: "concepts/exterior-decor/iron-braced-village-public-litter-bin-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-coat-rack", [
    part("iron_bloom", [14, 4, 14], [0, 2, 0]),
    part("squared_timber", [12, 4, 6], [13, 2, 0]),
    part("squared_timber", [12, 4, 6], [-13, 2, 0]),
    part("squared_timber", [6, 4, 12], [0, 2, 13]),
    part("squared_timber", [6, 4, 12], [0, 2, -13]),
    part("iron_bloom", [14, 4, 14], [0, 6, 0]),
    part("squared_timber", [8, 68, 8], [0, 42, 0]),
    part("iron_bloom", [14, 4, 14], [0, 78, 0]),
    part("squared_timber", [8, 20, 8], [0, 90, 0]),
    part("iron_bloom", [14, 4, 14], [0, 102, 0]),
    part("squared_timber", [18, 8, 18], [0, 108, 0]),
    part("iron_bloom", [4, 4, 6], [9, 78, 0]),
    part("wooden_stick", [16, 4, 4], [19, 78, 0]),
    part("wooden_stick", [6, 10, 6], [30, 81, 0]),
    part("iron_bloom", [4, 4, 6], [-9, 78, 0]),
    part("wooden_stick", [16, 4, 4], [-19, 78, 0]),
    part("wooden_stick", [6, 10, 6], [-30, 81, 0]),
    part("iron_bloom", [6, 4, 4], [0, 102, 9]),
    part("wooden_stick", [4, 4, 16], [0, 102, 19]),
    part("wooden_stick", [6, 10, 6], [0, 105, 30]),
    part("iron_bloom", [6, 4, 4], [0, 102, -9]),
    part("wooden_stick", [4, 4, 16], [0, 102, -19]),
    part("wooden_stick", [6, 10, 6], [0, 105, -30]),
  ], { yaw: -0.7, pitch: 0.28 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-coat-rack-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-bedside-table", [
    part("iron_bloom", [8, 4, 8], [-17, 2, -12]),
    part("iron_bloom", [8, 4, 8], [-17, 2, 12]),
    part("iron_bloom", [8, 4, 8], [17, 2, -12]),
    part("iron_bloom", [8, 4, 8], [17, 2, 12]),
    part("squared_timber", [6, 32, 6], [-17, 20, -12]),
    part("squared_timber", [6, 32, 6], [-17, 20, 12]),
    part("squared_timber", [6, 32, 6], [17, 20, -12]),
    part("squared_timber", [6, 32, 6], [17, 20, 12]),
    part("wooden_plank", [28, 4, 24], [0, 12, 0]),
    part("iron_bloom", [8, 4, 8], [-17, 38, -12]),
    part("iron_bloom", [8, 4, 8], [-17, 38, 12]),
    part("iron_bloom", [8, 4, 8], [17, 38, -12]),
    part("iron_bloom", [8, 4, 8], [17, 38, 12]),
    part("wooden_plank", [44, 6, 34], [0, 43, 0]),
    part("wooden_plank", [28, 12, 24], [0, 30, 0]),
    part("iron_bloom", [8, 4, 4], [0, 30, 14]),
    part("iron_bloom", [6, 2, 6], [-19, 47, -14]),
    part("iron_bloom", [6, 2, 6], [-19, 47, 14]),
    part("iron_bloom", [6, 2, 6], [19, 47, -14]),
    part("iron_bloom", [6, 2, 6], [19, 47, 14]),
  ], { yaw: -0.7, pitch: 0.34 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-bedside-table-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "copper-basin-timber-village-inn-washstand", [
    part("iron_bloom", [8, 4, 8], [-18, 2, -13]),
    part("iron_bloom", [8, 4, 8], [-18, 2, 13]),
    part("iron_bloom", [8, 4, 8], [18, 2, -13]),
    part("iron_bloom", [8, 4, 8], [18, 2, 13]),
    part("squared_timber", [6, 34, 6], [-18, 21, -13]),
    part("squared_timber", [6, 34, 6], [-18, 21, 13]),
    part("squared_timber", [6, 34, 6], [18, 21, -13]),
    part("squared_timber", [6, 34, 6], [18, 21, 13]),
    part("wooden_plank", [36, 4, 20], [0, 14, 0]),
    part("iron_bloom", [8, 4, 8], [-18, 40, -13]),
    part("iron_bloom", [8, 4, 8], [-18, 40, 13]),
    part("iron_bloom", [8, 4, 8], [18, 40, -13]),
    part("iron_bloom", [8, 4, 8], [18, 40, 13]),
    part("copper_bloom", [44, 4, 36], [0, 44, 0]),
    part("copper_bloom", [44, 10, 4], [0, 51, -16]),
    part("copper_bloom", [44, 10, 4], [0, 51, 16]),
    part("copper_bloom", [4, 10, 28], [-20, 51, 0]),
    part("copper_bloom", [4, 10, 28], [20, 51, 0]),
    part("iron_bloom", [4, 6, 6], [-18, 30, 19]),
    part("iron_bloom", [4, 6, 6], [18, 30, 19]),
    part("wooden_stick", [32, 4, 4], [0, 30, 22]),
  ], { yaw: -0.7, pitch: 0.35 }, {
    image: "concepts/furniture/copper-basin-timber-village-inn-washstand-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-single-bed-frame", [
    part("iron_bloom", [10, 6, 10], [-24, 3, -56]),
    part("iron_bloom", [10, 6, 10], [24, 3, -56]),
    part("iron_bloom", [10, 6, 10], [-24, 3, 56]),
    part("iron_bloom", [10, 6, 10], [24, 3, 56]),
    part("squared_timber", [8, 56, 8], [-24, 34, -56]),
    part("squared_timber", [8, 56, 8], [24, 34, -56]),
    part("squared_timber", [8, 34, 8], [-24, 23, 56]),
    part("squared_timber", [8, 34, 8], [24, 23, 56]),
    part("wooden_plank", [8, 12, 104], [-24, 30, 0]),
    part("wooden_plank", [8, 12, 104], [24, 30, 0]),
    part("wooden_plank", [40, 12, 8], [0, 30, -56]),
    part("wooden_plank", [40, 6, 8], [0, 59, -56]),
    part("squared_timber", [6, 20, 8], [-12, 46, -56]),
    part("squared_timber", [6, 20, 8], [0, 46, -56]),
    part("squared_timber", [6, 20, 8], [12, 46, -56]),
    part("wooden_plank", [40, 10, 8], [0, 35, 56]),
    part("wooden_plank", [40, 4, 16], [0, 36, -36]),
    part("wooden_plank", [40, 4, 16], [0, 36, -12]),
    part("wooden_plank", [40, 4, 16], [0, 36, 12]),
    part("wooden_plank", [40, 4, 16], [0, 36, 36]),
    part("iron_bloom", [10, 6, 10], [-24, 65, -56]),
    part("iron_bloom", [10, 6, 10], [24, 65, -56]),
    part("iron_bloom", [10, 6, 10], [-24, 43, 56]),
    part("iron_bloom", [10, 6, 10], [24, 43, 56]),
  ], { yaw: -0.68, pitch: 0.3 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-single-bed-frame-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-hooked-timber-village-inn-room-key-board", [
    part("wooden_plank", [40, 56, 4], [0, 30, 0]),
    part("squared_timber", [4, 64, 6], [-22, 30, 0]),
    part("squared_timber", [4, 64, 6], [22, 30, 0]),
    part("squared_timber", [40, 4, 6], [0, 0, 0]),
    part("squared_timber", [40, 4, 6], [0, 60, 0]),
    part("iron_bloom", [8, 6, 4], [-12, 65, -1]),
    part("iron_bloom", [8, 6, 4], [12, 65, -1]),
    ...[47, 25].flatMap((y) => [-12, 0, 12].map((x) => part("wooden_plank", [10, 4, 2], [x, y, 3]))),
    ...[36, 14].flatMap((y) => [-12, 0, 12].map((x) => part("iron_bloom", [8, 12, 12], [x, y, 8], { mask: roomKeyHookMask }))),
  ], { yaw: -0.68, pitch: 0.25 }, {
    image: "concepts/furniture/iron-hooked-timber-village-inn-room-key-board-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-luggage-rack", [
    part("iron_bloom", [8, 4, 8], [-21, 2, -12]),
    part("iron_bloom", [8, 4, 8], [-21, 2, 12]),
    part("iron_bloom", [8, 4, 8], [21, 2, -12]),
    part("iron_bloom", [8, 4, 8], [21, 2, 12]),
    part("squared_timber", [6, 28, 6], [-21, 18, -12]),
    part("squared_timber", [6, 28, 6], [-21, 18, 12]),
    part("squared_timber", [6, 28, 6], [21, 18, -12]),
    part("squared_timber", [6, 28, 6], [21, 18, 12]),
    part("squared_timber", [42, 6, 6], [0, 35, -12]),
    part("squared_timber", [42, 6, 6], [0, 35, 12]),
    ...[-13, -4, 4, 13].map((x) => part("wooden_plank", [6, 2, 24], [x, 39, 0])),
    part("squared_timber", [36, 4, 4], [0, 12, -12]),
    part("squared_timber", [36, 4, 4], [0, 12, 12]),
    ...[-13, -4, 4, 13].map((x) => part("wooden_plank", [6, 2, 24], [x, 15, 0])),
    part("iron_bloom", [2, 6, 6], [-22, 35, -12]),
    part("iron_bloom", [2, 6, 6], [-22, 35, 12]),
    part("iron_bloom", [2, 6, 6], [22, 35, -12]),
    part("iron_bloom", [2, 6, 6], [22, 35, 12]),
  ], { yaw: -0.68, pitch: 0.3 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-luggage-rack-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-writing-desk", [
    part("iron_bloom", [10, 4, 10], [-29, 2, -12]),
    part("iron_bloom", [10, 4, 10], [-29, 2, 12]),
    part("iron_bloom", [10, 4, 10], [29, 2, -12]),
    part("iron_bloom", [10, 4, 10], [29, 2, 12]),
    part("squared_timber", [8, 38, 8], [-29, 23, -12]),
    part("squared_timber", [8, 38, 8], [-29, 23, 12]),
    part("squared_timber", [8, 38, 8], [29, 23, -12]),
    part("squared_timber", [8, 38, 8], [29, 23, 12]),
    part("wooden_plank", [72, 6, 36], [0, 45, 0]),
    part("wooden_plank", [8, 10, 8], [-21, 37, 12]),
    part("wooden_plank", [8, 10, 8], [21, 37, 12]),
    part("wooden_plank", [34, 10, 8], [0, 37, 12]),
    part("iron_bloom", [8, 4, 2], [0, 36, 17]),
    part("wooden_plank", [50, 8, 4], [0, 38, -14]),
    part("squared_timber", [8, 8, 16], [-29, 38, 0]),
    part("squared_timber", [8, 8, 16], [29, 38, 0]),
    part("squared_timber", [50, 6, 6], [0, 15, -12]),
    part("iron_bloom", [8, 4, 2], [-29, 44, -19]),
    part("iron_bloom", [8, 4, 2], [-29, 44, 19]),
    part("iron_bloom", [8, 4, 2], [29, 44, -19]),
    part("iron_bloom", [8, 4, 2], [29, 44, 19]),
  ], { yaw: -0.68, pitch: 0.28 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-writing-desk-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("furniture", "iron-braced-timber-village-inn-writing-chair", [
    part("iron_bloom", [8, 4, 8], [-12, 2, 13]),
    part("iron_bloom", [8, 4, 8], [12, 2, 13]),
    part("iron_bloom", [8, 4, 8], [-12, 2, -19]),
    part("iron_bloom", [8, 4, 8], [12, 2, -19]),
    part("squared_timber", [6, 22, 6], [-12, 15, 13]),
    part("squared_timber", [6, 22, 6], [12, 15, 13]),
    part("squared_timber", [6, 52, 6], [-12, 30, -19]),
    part("squared_timber", [6, 52, 6], [12, 30, -19]),
    part("wooden_plank", [32, 4, 32], [0, 28, 0]),
    part("wooden_plank", [18, 6, 6], [0, 40, -19]),
    part("wooden_plank", [18, 8, 6], [0, 51, -19]),
    part("squared_timber", [18, 4, 4], [0, 12, 13]),
    part("squared_timber", [4, 4, 26], [-12, 12, -3]),
    part("squared_timber", [4, 4, 26], [12, 12, -3]),
    part("squared_timber", [18, 4, 4], [0, 12, -19]),
    part("iron_bloom", [6, 2, 6], [-12, 31, -13]),
    part("iron_bloom", [6, 2, 6], [-12, 31, 13]),
    part("iron_bloom", [6, 2, 6], [12, 31, -13]),
    part("iron_bloom", [6, 2, 6], [12, 31, 13]),
  ], { yaw: -0.68, pitch: 0.28 }, {
    image: "concepts/furniture/iron-braced-timber-village-inn-writing-chair-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("interior-decor", "polished-copper-timber-village-inn-wall-mirror", [
    part("wooden_plank", [32, 52, 2], [0, 30, -2]),
    part("squared_timber", [4, 52, 4], [-18, 30, 1]),
    part("squared_timber", [4, 52, 4], [18, 30, 1]),
    part("squared_timber", [32, 4, 4], [0, 2, 1]),
    part("squared_timber", [32, 4, 4], [0, 58, 1]),
    part("copper_bloom", [32, 52, 2], [0, 30, 0]),
    part("iron_bloom", [6, 4, 4], [-10, 62, 1]),
    part("iron_bloom", [6, 4, 4], [10, 62, 1]),
    part("iron_bloom", [4, 4, 2], [-16, 2, 4]),
    part("iron_bloom", [4, 4, 2], [16, 2, 4]),
    part("iron_bloom", [4, 4, 2], [-16, 58, 4]),
    part("iron_bloom", [4, 4, 2], [16, 58, 4]),
  ], { yaw: -0.58, pitch: 0.2 }, {
    image: "concepts/interior-decor/polished-copper-timber-village-inn-wall-mirror-v1.webp",
    source: "imagegen",
    version: 1,
  }),
  placeable("commerce", "iron-braced-timber-village-inn-reception-counter", [
    part("iron_bloom", [10, 6, 10], [-45, 3, -17]),
    part("iron_bloom", [10, 6, 10], [-45, 3, 17]),
    part("iron_bloom", [10, 6, 10], [45, 3, -17]),
    part("iron_bloom", [10, 6, 10], [45, 3, 17]),
    part("squared_timber", [8, 54, 8], [-45, 33, -17]),
    part("squared_timber", [8, 54, 8], [-45, 33, 17]),
    part("squared_timber", [8, 54, 8], [45, 33, -17]),
    part("squared_timber", [8, 54, 8], [45, 33, 17]),
    part("wooden_plank", [82, 8, 8], [0, 14, 17]),
    part("wooden_plank", [82, 8, 8], [0, 56, 17]),
    part("wooden_plank", [26, 34, 2], [-29, 35, 22]),
    part("wooden_plank", [32, 34, 2], [0, 35, 22]),
    part("wooden_plank", [26, 34, 2], [29, 35, 22]),
    part("wooden_plank", [104, 8, 46], [0, 64, 0]),
    part("wooden_plank", [82, 6, 20], [0, 49, -7]),
    part("wooden_plank", [82, 6, 20], [0, 22, -7]),
    part("squared_timber", [8, 8, 26], [-45, 56, 0]),
    part("squared_timber", [8, 8, 26], [45, 56, 0]),
    part("iron_bloom", [82, 3, 2], [0, 14, 22]),
    part("iron_bloom", [82, 3, 2], [0, 56, 22]),
  ], { yaw: -0.7, pitch: 0.3 }, {
    image: "concepts/commerce/iron-braced-timber-village-inn-reception-counter-v1.webp",
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
  const bookLayout = BOOK_LAYOUTS[spec.key] ?? null;
  if (spec.category === "books-writing" && !bookLayout) throw new Error(`${spec.key} is missing its bound-page geometry policy.`);
  if (bookLayout) validateBookGeometry(spec, runtime, bookLayout);
  const framedTextileLayout = FRAMED_TEXTILE_LAYOUTS[spec.key] ?? null;
  if (framedTextileLayout) validateFramedTextileGeometry(spec, runtime, framedTextileLayout);
  const drawerCabinetLayout = DRAWER_CABINET_LAYOUTS[spec.key] ?? null;
  if (drawerCabinetLayout) validateDrawerCabinetGeometry(spec, runtime, drawerCabinetLayout);
  const streetLanternLayout = STREET_LANTERN_LAYOUTS[spec.key] ?? null;
  if (streetLanternLayout) validateStreetLanternGeometry(spec, runtime, streetLanternLayout);
  const publicBenchLayout = PUBLIC_BENCH_LAYOUTS[spec.key] ?? null;
  if (publicBenchLayout) validatePublicBenchGeometry(spec, runtime, publicBenchLayout);
  const wallClockLayout = WALL_CLOCK_LAYOUTS[spec.key] ?? null;
  if (wallClockLayout) validateWallClockGeometry(spec, runtime, wallClockLayout);
  const shopSignLayout = SHOP_SIGN_LAYOUTS[spec.key] ?? null;
  if (shopSignLayout) validateShopSignGeometry(spec, runtime, shopSignLayout);
  const noticeBoardLayout = NOTICE_BOARD_LAYOUTS[spec.key] ?? null;
  if (noticeBoardLayout) validateNoticeBoardGeometry(spec, runtime, noticeBoardLayout);
  const handbellLayout = HANDBELL_LAYOUTS[spec.key] ?? null;
  if (handbellLayout) validateHandbellGeometry(spec, runtime, handbellLayout);
  const windowBoxLayout = WINDOW_BOX_LAYOUTS[spec.key] ?? null;
  if (windowBoxLayout) validateWindowBoxGeometry(spec, runtime, windowBoxLayout);
  const drinkingTroughLayout = DRINKING_TROUGH_LAYOUTS[spec.key] ?? null;
  if (drinkingTroughLayout) validateDrinkingTroughGeometry(spec, runtime, drinkingTroughLayout);
  const roadsideWellLayout = ROADSIDE_WELL_LAYOUTS[spec.key] ?? null;
  if (roadsideWellLayout) validateRoadsideWellGeometry(spec, runtime, roadsideWellLayout);
  const directionSignpostLayout = DIRECTION_SIGNPOST_LAYOUTS[spec.key] ?? null;
  if (directionSignpostLayout) validateDirectionSignpostGeometry(spec, runtime, directionSignpostLayout);
  const publicLitterBinLayout = PUBLIC_LITTER_BIN_LAYOUTS[spec.key] ?? null;
  if (publicLitterBinLayout) validatePublicLitterBinGeometry(spec, runtime, publicLitterBinLayout);
  const coatRackLayout = COAT_RACK_LAYOUTS[spec.key] ?? null;
  if (coatRackLayout) validateCoatRackGeometry(spec, runtime, coatRackLayout);
  const bedsideTableLayout = BEDSIDE_TABLE_LAYOUTS[spec.key] ?? null;
  if (bedsideTableLayout) validateBedsideTableGeometry(spec, runtime, bedsideTableLayout);
  const washstandLayout = WASHSTAND_LAYOUTS[spec.key] ?? null;
  if (washstandLayout) validateWashstandGeometry(spec, runtime, washstandLayout);
  const singleBedFrameLayout = SINGLE_BED_FRAME_LAYOUTS[spec.key] ?? null;
  if (singleBedFrameLayout) validateSingleBedFrameGeometry(spec, runtime, singleBedFrameLayout);
  const roomKeyBoardLayout = ROOM_KEY_BOARD_LAYOUTS[spec.key] ?? null;
  if (roomKeyBoardLayout) validateRoomKeyBoardGeometry(spec, runtime, roomKeyBoardLayout);
  const receptionCounterLayout = RECEPTION_COUNTER_LAYOUTS[spec.key] ?? null;
  if (receptionCounterLayout) validateReceptionCounterGeometry(spec, runtime, receptionCounterLayout);
  const luggageRackLayout = LUGGAGE_RACK_LAYOUTS[spec.key] ?? null;
  if (luggageRackLayout) validateLuggageRackGeometry(spec, runtime, luggageRackLayout);
  const writingDeskLayout = WRITING_DESK_LAYOUTS[spec.key] ?? null;
  if (writingDeskLayout) validateWritingDeskGeometry(spec, runtime, writingDeskLayout);
  const writingChairLayout = WRITING_CHAIR_LAYOUTS[spec.key] ?? null;
  if (writingChairLayout) validateWritingChairGeometry(spec, runtime, writingChairLayout);
  const wallMirrorLayout = WALL_MIRROR_LAYOUTS[spec.key] ?? null;
  if (wallMirrorLayout) validateWallMirrorGeometry(spec, runtime, wallMirrorLayout);

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
      ...(spec.preview?.clothMotion ? { clothMotion: spec.preview.clothMotion } : {}),
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
      ...(bookLayout ? { bookGeometryValidated: true } : {}),
      ...(framedTextileLayout ? { framedTextileGeometryValidated: true } : {}),
      ...(drawerCabinetLayout ? { drawerCabinetGeometryValidated: true } : {}),
      ...(streetLanternLayout ? { streetLanternGeometryValidated: true } : {}),
      ...(publicBenchLayout ? { publicBenchGeometryValidated: true } : {}),
      ...(wallClockLayout ? { wallClockGeometryValidated: true } : {}),
      ...(shopSignLayout ? { shopSignGeometryValidated: true } : {}),
      ...(noticeBoardLayout ? { noticeBoardGeometryValidated: true } : {}),
      ...(handbellLayout ? { handbellGeometryValidated: true } : {}),
      ...(windowBoxLayout ? { windowBoxGeometryValidated: true } : {}),
      ...(drinkingTroughLayout ? { drinkingTroughGeometryValidated: true } : {}),
      ...(roadsideWellLayout ? { roadsideWellGeometryValidated: true } : {}),
      ...(directionSignpostLayout ? { directionSignpostGeometryValidated: true } : {}),
      ...(publicLitterBinLayout ? { publicLitterBinGeometryValidated: true } : {}),
      ...(coatRackLayout ? { coatRackGeometryValidated: true } : {}),
      ...(bedsideTableLayout ? { bedsideTableGeometryValidated: true } : {}),
      ...(washstandLayout ? { washstandGeometryValidated: true } : {}),
      ...(singleBedFrameLayout ? { singleBedFrameGeometryValidated: true } : {}),
      ...(roomKeyBoardLayout ? { roomKeyBoardGeometryValidated: true } : {}),
      ...(receptionCounterLayout ? { receptionCounterGeometryValidated: true } : {}),
      ...(luggageRackLayout ? { luggageRackGeometryValidated: true } : {}),
      ...(writingDeskLayout ? { writingDeskGeometryValidated: true } : {}),
      ...(writingChairLayout ? { writingChairGeometryValidated: true } : {}),
      ...(wallMirrorLayout ? { wallMirrorGeometryValidated: true } : {}),
      chainMinted: false,
    },
  };
}

function validateBookGeometry(spec, runtime, layout) {
  if (spec.preview?.clothMotion !== "rigid") {
    throw new Error(`${spec.key} must disable cloth deformation for bound pages.`);
  }
  if (layout.portrait && runtime.boundsQ.sizeQ[2] <= runtime.boundsQ.sizeQ[0]) {
    throw new Error(`${spec.key} must keep its cover long edge on source Z.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  for (const { page, lower, upper = null } of layout.pageSets) {
    const pageComponent = components[page];
    const pageBounds = componentBounds[page];
    const lowerBounds = componentBounds[lower];
    const upperBounds = upper == null ? null : componentBounds[upper];
    if (!pageComponent || pageComponent.resourceId !== "cloth" || !pageBounds || !lowerBounds || (upper != null && !upperBounds)) {
      throw new Error(`${spec.key} has an invalid page or cover component index.`);
    }
    for (const coverBounds of [lowerBounds, upperBounds].filter(Boolean)) {
      for (const axis of [0, 2]) {
        if (pageBounds.min[axis] < coverBounds.min[axis] || pageBounds.max[axis] > coverBounds.max[axis]) {
          throw new Error(`${spec.key} page ${page} escapes its cover footprint.`);
        }
      }
    }
    if (pageBounds.min[1] < lowerBounds.max[1] || (upperBounds && pageBounds.max[1] > upperBounds.min[1])) {
      throw new Error(`${spec.key} page ${page} crosses a cover plane.`);
    }
    for (let index = 0; index < componentBounds.length; index += 1) {
      if (index === page) continue;
      if (boundsOverlap(pageBounds, componentBounds[index], 0)) {
        throw new Error(`${spec.key} page ${page} intersects component ${index}.`);
      }
    }
  }
}

function validateFramedTextileGeometry(spec, runtime, layout) {
  if (spec.preview?.clothMotion !== "rigid") {
    throw new Error(`${spec.key} must keep its frame-bound textile rigid.`);
  }
  if (runtime.boundsQ.sizeQ[1] <= runtime.boundsQ.sizeQ[0] || runtime.boundsQ.sizeQ[2] >= runtime.boundsQ.sizeQ[0] * 0.2) {
    throw new Error(`${spec.key} must remain a thin, portrait-oriented wall decoration.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const cloth = components[layout.cloth];
  const clothBounds = componentBounds[layout.cloth];
  const [left, right, bottom, top] = layout.frame.map((index) => componentBounds[index]);
  if (!cloth || cloth.resourceId !== "cloth" || !clothBounds || !left || !right || !bottom || !top) {
    throw new Error(`${spec.key} has an invalid cloth or primary frame component index.`);
  }
  if (clothBounds.min[0] !== left.max[0] || clothBounds.max[0] !== right.min[0]
    || clothBounds.min[1] !== bottom.max[1] || clothBounds.max[1] !== top.min[1]
    || clothBounds.min[2] < left.min[2] || clothBounds.max[2] > left.max[2]) {
    throw new Error(`${spec.key} cloth is not taut within all four frame faces.`);
  }
  for (let index = 0; index < componentBounds.length; index += 1) {
    if (index !== layout.cloth && boundsOverlap(clothBounds, componentBounds[index], 0)) {
      throw new Error(`${spec.key} cloth intersects component ${index}.`);
    }
  }
  for (const decorationIndex of layout.decorations) {
    const decoration = componentBounds[decorationIndex];
    if (!decoration || !spec.parts[decorationIndex]?.materialId.endsWith("_dye")) {
      throw new Error(`${spec.key} has an invalid woven decoration component ${decorationIndex}.`);
    }
    if (decoration.min[0] < clothBounds.min[0] || decoration.max[0] > clothBounds.max[0]
      || decoration.min[1] < clothBounds.min[1] || decoration.max[1] > clothBounds.max[1]
      || decoration.min[2] !== clothBounds.max[2]) {
      throw new Error(`${spec.key} decoration ${decorationIndex} leaves the textile face.`);
    }
  }
  for (let leftIndex = 0; leftIndex < layout.decorations.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layout.decorations.length; rightIndex += 1) {
      const leftDecoration = layout.decorations[leftIndex];
      const rightDecoration = layout.decorations[rightIndex];
      if (boundsOverlap(componentBounds[leftDecoration], componentBounds[rightDecoration], 0)) {
        throw new Error(`${spec.key} decorations ${leftDecoration} and ${rightDecoration} intersect.`);
      }
    }
  }
}

function validateDrawerCabinetGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 23 || runtime.boundsQ.sizeQ.join(",") !== "64,78,26") {
    throw new Error(`${spec.key} must preserve its six-drawer furniture scale.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  if (layout.drawers.length !== 6 || layout.handles.length !== 6 || layout.drawers.length !== layout.handles.length) {
    throw new Error(`${spec.key} must keep exactly six drawers and six pulls.`);
  }
  for (const index of layout.frame) {
    if (!components[index] || !["squared_timber", "wooden_plank"].includes(spec.parts[index]?.materialId)) {
      throw new Error(`${spec.key} has an invalid timber frame component ${index}.`);
    }
  }
  const expectedDrawerOffsets = [
    [-18, 21, 1], [0, 21, 1], [18, 21, 1],
    [-18, 51, 1], [0, 51, 1], [18, 51, 1],
  ];
  for (let position = 0; position < layout.drawers.length; position += 1) {
    const drawerIndex = layout.drawers[position];
    const handleIndex = layout.handles[position];
    const drawer = components[drawerIndex];
    const handle = components[handleIndex];
    const drawerBounds = componentBounds[drawerIndex];
    const handleBounds = componentBounds[handleIndex];
    if (!drawer || !handle || spec.parts[drawerIndex]?.materialId !== "wooden_plank"
      || spec.parts[handleIndex]?.materialId !== "iron_bloom"
      || drawer.dimsQ.join(",") !== "16,26,16"
      || drawer.offsetQ.some((value, axis) => value !== expectedDrawerOffsets[position][axis])) {
      throw new Error(`${spec.key} has an invalid drawer pair at position ${position}.`);
    }
    if (handle.offsetQ[0] !== drawer.offsetQ[0] || handle.offsetQ[1] !== drawer.offsetQ[1]
      || handleBounds.min[2] !== drawerBounds.max[2]) {
      throw new Error(`${spec.key} handle ${handleIndex} is not centered on drawer ${drawerIndex}.`);
    }
  }
  for (let left = 0; left < componentBounds.length; left += 1) {
    for (let right = left + 1; right < componentBounds.length; right += 1) {
      if (boundsOverlap(componentBounds[left], componentBounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validateStreetLanternGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 14 || runtime.boundsQ.sizeQ.join(",") !== "36,126,36") {
    throw new Error(`${spec.key} must preserve its stable human-scale street-light proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "polished_stone_slab", "basalt_brick", "iron_bloom", "iron_bloom", "iron_bloom",
    "amber_glass_panel", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom",
    "iron_bloom", "copper_bloom", "copper_bloom", "iron_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const plinth = componentBounds[layout.plinth];
  const post = components[layout.post];
  const glass = componentBounds[layout.glass];
  const lowerPlate = componentBounds[layout.lowerPlate];
  const upperPlate = componentBounds[layout.upperPlate];
  if (post.offsetQ[0] !== 0 || post.offsetQ[2] !== 0 || post.dimsQ[1] <= post.dimsQ[0] * 8
    || plinth.max[0] - plinth.min[0] < upperPlate.max[0] - upperPlate.min[0]
    || plinth.max[2] - plinth.min[2] < upperPlate.max[2] - upperPlate.min[2]) {
    throw new Error(`${spec.key} must keep a centered tall post on a stable square plinth.`);
  }
  if (glass.min[1] !== lowerPlate.max[1] || glass.max[1] !== upperPlate.min[1]
    || glass.min[0] < lowerPlate.min[0] || glass.max[0] > lowerPlate.max[0]
    || glass.min[2] < lowerPlate.min[2] || glass.max[2] > lowerPlate.max[2]) {
    throw new Error(`${spec.key} amber chamber is not enclosed by its plates.`);
  }
  const expectedCornerOffsets = [[-12, 96, -12], [-12, 96, 12], [12, 96, -12], [12, 96, 12]];
  for (let position = 0; position < layout.corners.length; position += 1) {
    const cornerIndex = layout.corners[position];
    const corner = components[cornerIndex];
    const cornerBounds = componentBounds[cornerIndex];
    if (corner.offsetQ.some((value, axis) => value !== expectedCornerOffsets[position][axis])
      || corner.dimsQ.join(",") !== "4,20,4"
      || cornerBounds.min[1] !== lowerPlate.max[1] || cornerBounds.max[1] !== upperPlate.min[1]) {
      throw new Error(`${spec.key} has an invalid lantern corner ${cornerIndex}.`);
    }
  }
  for (let left = 0; left < componentBounds.length; left += 1) {
    for (let right = left + 1; right < componentBounds.length; right += 1) {
      if (boundsOverlap(componentBounds[left], componentBounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validatePublicBenchGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 13 || runtime.boundsQ.sizeQ.join(",") !== "96,58,36") {
    throw new Error(`${spec.key} must preserve its two-person public-bench proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "wooden_plank", "wooden_plank", "wooden_plank",
    "squared_timber", "squared_timber", "squared_timber", "squared_timber",
    "squared_timber", "squared_timber",
    "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const seat = components[layout.seat];
  const seatBounds = componentBounds[layout.seat];
  if (seat.dimsQ.join(",") !== "96,6,30" || seat.offsetQ.join(",") !== "0,27,0"
    || seatBounds.max[1] < 28 || seatBounds.max[1] > 32) {
    throw new Error(`${spec.key} has an invalid human-scale seat plane.`);
  }
  const expectedLegOffsets = [[-38, 12, -10], [-38, 12, 10], [38, 12, -10], [38, 12, 10]];
  for (let position = 0; position < layout.legs.length; position += 1) {
    const legIndex = layout.legs[position];
    const leg = components[legIndex];
    const legBounds = componentBounds[legIndex];
    if (leg.dimsQ.join(",") !== "8,24,8"
      || leg.offsetQ.some((value, axis) => value !== expectedLegOffsets[position][axis])
      || legBounds.max[1] !== seatBounds.min[1]) {
      throw new Error(`${spec.key} has an invalid supporting leg ${legIndex}.`);
    }
  }
  const [leftPostBounds, rightPostBounds] = layout.backPosts.map((index) => componentBounds[index]);
  for (const slatIndex of layout.backSlats) {
    const slat = components[slatIndex];
    const slatBounds = componentBounds[slatIndex];
    if (slat.dimsQ.join(",") !== "88,8,6"
      || slatBounds.min[0] !== leftPostBounds.max[0]
      || slatBounds.max[0] !== rightPostBounds.min[0]
      || slatBounds.min[2] !== seatBounds.max[2]) {
      throw new Error(`${spec.key} has an unsupported back slat ${slatIndex}.`);
    }
  }
  const expectedStretcherOffsets = [[0, 12, -13], [0, 12, 13]];
  for (let position = 0; position < layout.stretchers.length; position += 1) {
    const stretcher = components[layout.stretchers[position]];
    if (stretcher.dimsQ.join(",") !== "68,4,4"
      || stretcher.offsetQ.some((value, axis) => value !== expectedStretcherOffsets[position][axis])) {
      throw new Error(`${spec.key} has an invalid longitudinal iron stretcher.`);
    }
  }
  for (const braceIndex of layout.sideBraces) {
    const brace = components[braceIndex];
    if (brace.dimsQ.join(",") !== "4,4,12" || brace.offsetQ[1] !== 12 || brace.offsetQ[2] !== 0) {
      throw new Error(`${spec.key} has an invalid side brace ${braceIndex}.`);
    }
  }
  for (let left = 0; left < componentBounds.length; left += 1) {
    for (let right = left + 1; right < componentBounds.length; right += 1) {
      if (boundsOverlap(componentBounds[left], componentBounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validateWallClockGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 20 || runtime.boundsQ.sizeQ.join(",") !== "40,68,7") {
    throw new Error(`${spec.key} must preserve its human-scale wall-clock proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "wooden_plank",
    "squared_timber", "squared_timber", "squared_timber", "squared_timber", "squared_timber",
    "iron_bloom", "wooden_plank", "copper_bloom", "clear_glass_panel",
    "iron_bloom", "copper_bloom", "iron_bloom", "clear_glass_panel",
    "squared_timber", "squared_timber", "squared_timber", "squared_timber",
    "copper_bloom", "copper_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }

  const backplate = components[layout.backplate];
  if (backplate.dimsQ.join(",") !== "40,64,1" || backplate.offsetQ.join(",") !== "0,0,0") {
    throw new Error(`${spec.key} must keep one continuous timber wall backplate.`);
  }
  const expectedOuterFrame = [
    { dims: "4,56,1", offset: "-18,0,1" },
    { dims: "4,56,1", offset: "18,0,1" },
    { dims: "32,4,1", offset: "0,30,1" },
    { dims: "32,4,1", offset: "0,-30,1" },
  ];
  for (let position = 0; position < layout.outerFrame.length; position += 1) {
    const component = components[layout.outerFrame[position]];
    if (component.dimsQ.join(",") !== expectedOuterFrame[position].dims
      || component.offsetQ.join(",") !== expectedOuterFrame[position].offset) {
      throw new Error(`${spec.key} has an invalid outer frame rail.`);
    }
  }
  const [timberHanger, ironHanger] = layout.hanger.map((index) => components[index]);
  const [timberHangerBounds, ironHangerBounds] = layout.hanger.map((index) => componentBounds[index]);
  const topRailBounds = componentBounds[layout.outerFrame[2]];
  if (timberHanger.dimsQ.join(",") !== "12,4,1" || timberHanger.offsetQ.join(",") !== "0,34,1"
    || ironHanger.dimsQ.join(",") !== "4,4,1" || ironHanger.offsetQ.join(",") !== "0,34,2"
    || timberHangerBounds.min[1] !== topRailBounds.max[1]
    || ironHangerBounds.min[2] !== timberHangerBounds.max[2]) {
    throw new Error(`${spec.key} must retain its connected timber-and-iron wall hanger.`);
  }

  const dial = components[layout.dial];
  const bezel = components[layout.bezel];
  const faceGlass = components[layout.faceGlass];
  const dialBounds = componentBounds[layout.dial];
  const bezelBounds = componentBounds[layout.bezel];
  const glassBounds = componentBounds[layout.faceGlass];
  if (dial.dimsQ.join(",") !== "30,30,1" || dial.offsetQ.join(",") !== "0,10,1"
    || bezel.dimsQ.join(",") !== "34,34,1" || bezel.offsetQ.join(",") !== "0,10,2"
    || faceGlass.dimsQ.join(",") !== "30,30,1" || faceGlass.offsetQ.join(",") !== "0,10,3"
    || dialBounds.max[2] !== bezelBounds.min[2] || bezelBounds.max[2] !== glassBounds.min[2]) {
    throw new Error(`${spec.key} must keep its dial, copper bezel, and glass in ordered touching layers.`);
  }
  const hourStuds = components[layout.hourStuds];
  const hourStudBounds = componentBounds[layout.hourStuds];
  const hands = components[layout.hands];
  const handBounds = componentBounds[layout.hands];
  const centerPin = components[layout.centerPin];
  const pinBounds = componentBounds[layout.centerPin];
  if (hourStuds.dimsQ.join(",") !== "28,28,1" || hourStuds.offsetQ.join(",") !== "0,10,4"
    || hands.dimsQ.join(",") !== "16,16,1" || hands.offsetQ.join(",") !== "0,10,5"
    || centerPin.dimsQ.join(",") !== "3,3,1" || centerPin.offsetQ.join(",") !== "0,10,6"
    || hourStudBounds.min[2] !== glassBounds.max[2]
    || handBounds.min[2] !== hourStudBounds.max[2]
    || pinBounds.min[2] !== handBounds.max[2]
    || hourStudBounds.min[0] < glassBounds.min[0] || hourStudBounds.max[0] > glassBounds.max[0]
    || hourStudBounds.min[1] < glassBounds.min[1] || hourStudBounds.max[1] > glassBounds.max[1]) {
    throw new Error(`${spec.key} must keep twelve hour studs and readable hands secured above its glass face.`);
  }

  const pendulumGlass = componentBounds[layout.pendulumGlass];
  const [leftFrame, rightFrame, topFrame, bottomFrame] = layout.pendulumFrame.map((index) => componentBounds[index]);
  if (pendulumGlass.min[0] !== leftFrame.max[0] || pendulumGlass.max[0] !== rightFrame.min[0]
    || pendulumGlass.max[1] !== topFrame.min[1] || pendulumGlass.min[1] !== bottomFrame.max[1]) {
    throw new Error(`${spec.key} pendulum glass must remain enclosed by its timber frame.`);
  }
  const [rodBounds, bobBounds] = layout.pendulum.map((index) => componentBounds[index]);
  if (rodBounds.min[2] !== pendulumGlass.max[2] || bobBounds.min[2] !== pendulumGlass.max[2]
    || rodBounds.min[1] !== bobBounds.max[1]
    || bobBounds.min[0] < pendulumGlass.min[0] || bobBounds.max[0] > pendulumGlass.max[0]
    || bobBounds.min[1] < pendulumGlass.min[1] || rodBounds.max[1] > pendulumGlass.max[1]) {
    throw new Error(`${spec.key} pendulum must remain connected and contained behind its window.`);
  }
  for (let left = 0; left < componentBounds.length; left += 1) {
    for (let right = left + 1; right < componentBounds.length; right += 1) {
      if (boundsOverlap(componentBounds[left], componentBounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validateShopSignGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 17 || runtime.boundsQ.sizeQ.join(",") !== "70,58,5") {
    throw new Error(`${spec.key} must preserve its human-scale projecting shop-sign proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom",
    "wooden_plank", "squared_timber", "squared_timber", "squared_timber", "squared_timber",
    "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "red_dye", "yellow_dye",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const wallPlate = componentBounds[layout.wallPlate];
  const arm = componentBounds[layout.arm];
  const endCap = componentBounds[layout.endCap];
  const brace = componentBounds[layout.brace];
  const board = componentBounds[layout.board];
  const [leftFrame, rightFrame, topFrame, bottomFrame] = layout.frame.map((index) => componentBounds[index]);
  if (wallPlate.max[1] !== arm.max[1] || wallPlate.max[0] !== arm.min[0]
    || arm.max[0] !== endCap.min[0] || brace.max[1] !== arm.min[1]
    || brace.min[0] < wallPlate.min[0] || brace.max[0] > arm.max[0]) {
    throw new Error(`${spec.key} bracket does not form one supported wall-mounted assembly.`);
  }
  if (board.min[0] !== leftFrame.max[0] || board.max[0] !== rightFrame.min[0]
    || board.max[1] !== topFrame.min[1] || board.min[1] !== bottomFrame.max[1]) {
    throw new Error(`${spec.key} timber panel is not enclosed by its four frame members.`);
  }
  for (const hangerIndex of layout.hangers) {
    const hanger = componentBounds[hangerIndex];
    if (hanger.max[1] !== arm.min[1] || hanger.min[1] !== topFrame.max[1]) {
      throw new Error(`${spec.key} hanger ${hangerIndex} does not meet both arm and sign frame.`);
    }
  }
  for (const studIndex of layout.cornerStuds) {
    const stud = componentBounds[studIndex];
    if (stud.min[2] !== board.max[2]) {
      throw new Error(`${spec.key} stud ${studIndex} leaves the board face.`);
    }
  }
  const [backEmblem, frontEmblem] = layout.emblem.map((index) => componentBounds[index]);
  if (backEmblem.min[2] !== board.max[2] || frontEmblem.min[2] !== backEmblem.max[2]
    || frontEmblem.min[0] < backEmblem.min[0] || frontEmblem.max[0] > backEmblem.max[0]
    || frontEmblem.min[1] < backEmblem.min[1] || frontEmblem.max[1] > backEmblem.max[1]) {
    throw new Error(`${spec.key} merchant emblem is not layered on the board face.`);
  }
}

function validateNoticeBoardGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 21 || runtime.boundsQ.sizeQ.join(",") !== "116,122,30") {
    throw new Error(`${spec.key} must preserve its roofed, human-scale public notice-board proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "polished_stone_slab", "polished_stone_slab", "iron_bloom", "iron_bloom",
    "squared_timber", "squared_timber",
    "wooden_plank", "wooden_plank", "wooden_plank", "wooden_plank",
    "squared_timber", "squared_timber", "squared_timber", "squared_timber",
    "iron_bloom", "squared_timber", "wooden_plank", "wooden_plank", "wooden_plank",
    "wooden_stick", "wooden_stick",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  for (let position = 0; position < layout.posts.length; position += 1) {
    const foot = componentBounds[layout.feet[position]];
    const anchor = componentBounds[layout.anchors[position]];
    const post = componentBounds[layout.posts[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== anchor.min[1] || anchor.max[1] !== post.min[1]
      || post.max[1] !== componentBounds[layout.header].min[1]) {
      throw new Error(`${spec.key} support ${position} is not grounded continuously into the roof header.`);
    }
  }
  const [leftFrame, rightFrame] = layout.sideFrame.map((index) => componentBounds[index]);
  const [topFrame, bottomFrame] = layout.crossFrame.map((index) => componentBounds[index]);
  for (const slatIndex of layout.boardSlats) {
    const slat = componentBounds[slatIndex];
    if (slat.min[0] !== leftFrame.max[0] || slat.max[0] !== rightFrame.min[0]
      || slat.min[1] < bottomFrame.max[1] || slat.max[1] > topFrame.min[1]) {
      throw new Error(`${spec.key} notice slat ${slatIndex} escapes its timber frame.`);
    }
  }
  if (bottomFrame.max[1] !== componentBounds[layout.boardSlats[0]].min[1]
    || topFrame.min[1] !== componentBounds[layout.boardSlats.at(-1)].max[1]) {
    throw new Error(`${spec.key} notice panel does not meet its upper and lower frame rails.`);
  }
  const fasteners = componentBounds[layout.fasteners];
  if (fasteners.min[0] < leftFrame.max[0] || fasteners.max[0] > rightFrame.min[0]
    || fasteners.min[1] < bottomFrame.max[1] || fasteners.max[1] > topFrame.min[1]) {
    throw new Error(`${spec.key} iron posting points leave the notice panel.`);
  }
  let previous = componentBounds[layout.header];
  for (const roofIndex of layout.roof) {
    const roof = componentBounds[roofIndex];
    if (previous.max[1] !== roof.min[1]
      || roof.min[0] < previous.min[0] - 2 || roof.max[0] > previous.max[0] + 2
      || roof.min[2] < -15 || roof.max[2] > 15) {
      throw new Error(`${spec.key} roof tier ${roofIndex} is detached or unstable.`);
    }
    previous = roof;
  }
  const firstRoof = componentBounds[layout.roof[0]];
  const lastRoof = componentBounds[layout.roof.at(-1)];
  for (const pinIndex of layout.roofPins) {
    const pin = componentBounds[pinIndex];
    if (pin.min[1] > firstRoof.max[1] || pin.max[1] < lastRoof.min[1]
      || pin.min[0] < firstRoof.min[0] || pin.max[0] > firstRoof.max[0]
      || pin.min[2] < firstRoof.min[2] || pin.max[2] > firstRoof.max[2]) {
      throw new Error(`${spec.key} roof pin ${pinIndex} does not bind the rain-hood tiers.`);
    }
  }
}

function validateHandbellGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 6 || runtime.boundsQ.sizeQ.join(",") !== "14,30,14") {
    throw new Error(`${spec.key} must preserve its one-hand, human-scale bell proportions.`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = ["squared_timber", "iron_bloom", "copper_bloom", "copper_bloom", "iron_bloom", "iron_bloom"];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const handle = componentBounds[layout.handle];
  const collar = componentBounds[layout.collar];
  const body = componentBounds[layout.body];
  const rim = componentBounds[layout.rim];
  const clapperStem = componentBounds[layout.clapperStem];
  const clapper = componentBounds[layout.clapper];
  if (handle.max[1] !== collar.min[1] || collar.max[1] !== body.min[1]
    || body.max[1] !== rim.min[1]) {
    throw new Error(`${spec.key} handle, collar, copper body, and rim are not connected in order.`);
  }
  if (clapperStem.min[1] !== collar.max[1] || clapperStem.max[1] < rim.min[1]
    || clapper.min[1] > rim.max[1] || clapper.max[1] < rim.max[1]
    || clapperStem.max[1] < clapper.min[1]
    || clapper.min[0] < rim.min[0] || clapper.max[0] > rim.max[0]
    || clapper.min[2] < rim.min[2] || clapper.max[2] > rim.max[2]) {
    throw new Error(`${spec.key} iron clapper is detached or leaves the bell mouth.`);
  }
}

function validateWindowBoxGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 15 || runtime.boundsQ.sizeQ.join(",") !== "80,42,24") {
    throw new Error(`${spec.key} must preserve its human-scale wall-mounted window-box proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "wooden_plank", "wooden_plank", "wooden_plank", "wooden_plank", "wooden_plank",
    "biochar_compost", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom",
    "red_dye", "yellow_dye", "blue_dye",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const back = componentBounds[layout.back];
  const front = componentBounds[layout.front];
  const floor = componentBounds[layout.floor];
  const soil = componentBounds[layout.soil];
  const [leftSide, rightSide] = layout.sides.map((index) => componentBounds[index]);
  if (floor.min[0] !== back.min[0] || floor.max[0] !== back.max[0]
    || floor.min[2] !== back.max[2] || floor.max[2] !== front.min[2]
    || back.min[1] !== front.min[1] || back.max[1] !== front.max[1]
    || leftSide.max[0] !== back.min[0] || rightSide.min[0] !== back.max[0]
    || leftSide.min[2] !== back.max[2] || leftSide.max[2] !== front.min[2]
    || rightSide.min[2] !== back.max[2] || rightSide.max[2] !== front.min[2]) {
    throw new Error(`${spec.key} timber trough is not continuously enclosed.`);
  }
  if (soil.min[0] < back.min[0] || soil.max[0] > back.max[0]
    || soil.min[2] < back.max[2] || soil.max[2] > front.min[2]
    || soil.min[1] < floor.max[1] || soil.max[1] > back.max[1]) {
    throw new Error(`${spec.key} compost escapes the timber trough.`);
  }
  for (const bandIndex of layout.cornerBands) {
    const band = componentBounds[bandIndex];
    if (band.min[1] > floor.min[1] || band.max[1] < front.max[1]
      || band.min[2] > back.min[2] || band.max[2] < front.max[2]
      || (band.min[0] > leftSide.max[0] && band.max[0] < rightSide.min[0])) {
      throw new Error(`${spec.key} corner band ${bandIndex} does not reinforce the complete trough section.`);
    }
  }
  for (let index = 0; index < layout.brackets.length; index += 2) {
    const upright = componentBounds[layout.brackets[index]];
    const shelf = componentBounds[layout.brackets[index + 1]];
    if (upright.max[1] !== floor.min[1] || shelf.max[1] !== floor.min[1]
      || upright.max[2] !== shelf.min[2] || upright.min[2] !== back.min[2]
      || shelf.max[2] !== front.min[2] || upright.min[0] !== shelf.min[0]
      || upright.max[0] !== shelf.max[0]) {
      throw new Error(`${spec.key} wall bracket pair ${index / 2} is detached from the trough.`);
    }
  }
  for (const bloomIndex of layout.blooms) {
    const bloom = componentBounds[bloomIndex];
    if (bloom.min[1] > soil.max[1] || bloom.max[1] <= soil.max[1]
      || bloom.min[0] < soil.min[0] || bloom.max[0] > soil.max[0]
      || bloom.min[2] < soil.min[2] || bloom.max[2] > soil.max[2]) {
      throw new Error(`${spec.key} bloom ${bloomIndex} is not planted into the compost bed.`);
    }
  }
}

function validateDrinkingTroughGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 11 || runtime.boundsQ.sizeQ.join(",") !== "105,38,42") {
    throw new Error(`${spec.key} must preserve its low, human-scale public drinking-trough proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "polished_stone_slab", "polished_stone_slab", "polished_stone_slab", "polished_stone_slab",
    "polished_stone_slab", "polished_stone_slab", "polished_stone_slab", "ice_blue_glass_panel",
    "squared_timber", "iron_bloom", "iron_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const floor = componentBounds[layout.floor];
  const [back, front, left, right] = layout.walls.map((index) => componentBounds[index]);
  const water = componentBounds[layout.water];
  if (floor.min[0] !== back.min[0] || floor.max[0] !== back.max[0]
    || floor.min[2] > left.min[2] || floor.max[2] < left.max[2]
    || back.min[0] !== floor.min[0] || back.max[0] !== floor.max[0]
    || front.min[0] !== floor.min[0] || front.max[0] !== floor.max[0]
    || back.max[2] !== left.min[2] || front.min[2] !== left.max[2]
    || left.max[0] < floor.min[0] || right.min[0] > floor.max[0]
    || floor.max[1] !== back.min[1] || floor.max[1] !== front.min[1]
    || floor.max[1] !== left.min[1] || floor.max[1] !== right.min[1]) {
    throw new Error(`${spec.key} stone basin is not continuously enclosed above its floor.`);
  }
  if (water.min[0] !== left.max[0] || water.max[0] !== right.min[0]
    || water.min[2] !== back.max[2] || water.max[2] !== front.min[2]
    || water.min[1] <= floor.max[1] || water.max[1] >= back.max[1]) {
    throw new Error(`${spec.key} still-water plane leaves the hollow basin or reaches above its rim.`);
  }
  for (const footIndex of layout.feet) {
    const foot = componentBounds[footIndex];
    if (foot.min[1] !== 0 || foot.max[1] < floor.min[1]
      || foot.max[0] <= floor.min[0] || foot.min[0] >= floor.max[0]
      || foot.max[2] <= floor.min[2] || foot.min[2] >= floor.max[2]) {
      throw new Error(`${spec.key} stone foot ${footIndex} does not support the basin floor.`);
    }
  }
  const timberRail = componentBounds[layout.timberRail];
  const spout = componentBounds[layout.spout];
  const mouth = componentBounds[layout.spoutMouth];
  if (timberRail.max[2] !== back.min[2] || timberRail.min[1] < back.min[1] || timberRail.max[1] > back.max[1]
    || spout.min[2] - timberRail.max[2] > 0.5 || spout.min[1] > timberRail.max[1]
    || spout.max[2] !== mouth.min[2] || mouth.min[1] <= water.max[1]
    || mouth.max[2] >= front.min[2]) {
    throw new Error(`${spec.key} timber back rail or iron drinking spout is detached or badly placed.`);
  }
}

function validateRoadsideWellGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 18 || runtime.boundsQ.sizeQ.join(",") !== "100,118,66") {
    throw new Error(`${spec.key} must preserve its compact human-scale roadside-well proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const componentBounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "polished_stone_slab", "polished_stone_slab", "polished_stone_slab", "polished_stone_slab", "polished_stone_slab",
    "iron_bloom", "iron_bloom", "squared_timber", "squared_timber", "iron_bloom", "iron_bloom", "squared_timber",
    "squared_timber", "wooden_stick", "squared_timber", "iron_bloom", "iron_bloom", "wooden_stick",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const foundation = componentBounds[layout.foundation];
  const [back, front, left, right] = layout.curbWalls.map((index) => componentBounds[index]);
  if (foundation.min[1] !== 0 || foundation.max[1] !== back.min[1]
    || foundation.max[1] !== front.min[1] || foundation.max[1] !== left.min[1] || foundation.max[1] !== right.min[1]
    || back.max[2] !== left.min[2] || front.min[2] !== left.max[2]
    || back.min[0] !== left.min[0] || back.max[0] !== right.max[0]
    || front.min[0] !== left.min[0] || front.max[0] !== right.max[0]) {
    throw new Error(`${spec.key} stone foundation and four curb walls do not form a continuous grounded wellhead.`);
  }
  for (let position = 0; position < layout.posts.length; position += 1) {
    const post = componentBounds[layout.posts[position]];
    const foot = componentBounds[layout.postFeet[position]];
    if (foot.min[1] !== back.max[1] || foot.max[1] !== post.min[1]
      || post.min[0] < foot.min[0] || post.max[0] > foot.max[0]
      || post.min[2] < foot.min[2] || post.max[2] > foot.max[2]) {
      throw new Error(`${spec.key} post ${position} is not continuously iron-anchored to the stone curb.`);
    }
  }
  const crossbeam = componentBounds[layout.crossbeam];
  for (let position = 0; position < layout.posts.length; position += 1) {
    const post = componentBounds[layout.posts[position]];
    const cap = componentBounds[layout.postCaps[position]];
    const beamTouchesInnerCapFace = position === 0
      ? crossbeam.min[0] === cap.max[0]
      : crossbeam.max[0] === cap.min[0];
    if (post.max[1] !== cap.min[1] || !beamTouchesInnerCapFace
      || overlapLength(cap.min[1], cap.max[1], crossbeam.min[1], crossbeam.max[1]) <= 0
      || overlapLength(cap.min[2], cap.max[2], crossbeam.min[2], crossbeam.max[2]) <= 0
      || post.min[0] < cap.min[0] || post.max[0] > cap.max[0]
      || post.min[2] < cap.min[2] || post.max[2] > cap.max[2]) {
      throw new Error(`${spec.key} upper cap ${position} does not bind its post to the timber crossbeam.`);
    }
  }
  const spindle = componentBounds[layout.spindle];
  const [leftPost, rightPost] = layout.posts.map((index) => componentBounds[index]);
  if (spindle.min[0] !== leftPost.max[0] || spindle.max[0] !== rightPost.min[0]
    || overlapLength(spindle.min[1], spindle.max[1], leftPost.min[1], leftPost.max[1]) <= 0
    || overlapLength(spindle.min[1], spindle.max[1], rightPost.min[1], rightPost.max[1]) <= 0
    || overlapLength(spindle.min[2], spindle.max[2], leftPost.min[2], leftPost.max[2]) <= 0
    || overlapLength(spindle.min[2], spindle.max[2], rightPost.min[2], rightPost.max[2]) <= 0) {
    throw new Error(`${spec.key} timber spindle is not face-seated between both posts.`);
  }
  const rope = componentBounds[layout.rope];
  const bucket = componentBounds[layout.bucket];
  const bucketComponent = components[layout.bucket];
  const bucketSolidCount = bucketComponent.solid.reduce((sum, value) => sum + value, 0);
  if (rope.max[1] !== spindle.min[1] || rope.min[1] !== bucket.max[1]
    || overlapLength(rope.min[0], rope.max[0], spindle.min[0], spindle.max[0]) <= 0
    || overlapLength(rope.min[2], rope.max[2], spindle.min[2], spindle.max[2]) <= 0
    || overlapLength(rope.min[0], rope.max[0], bucket.min[0], bucket.max[0]) <= 0
    || overlapLength(rope.min[2], rope.max[2], bucket.min[2], bucket.max[2]) <= 0
    || bucket.min[1] < foundation.max[1] || bucket.max[1] > spindle.min[1]
    || bucket.min[0] <= left.max[0] || bucket.max[0] >= right.min[0]
    || bucket.min[2] <= back.max[2] || bucket.max[2] >= front.min[2]) {
    throw new Error(`${spec.key} rope or captive bucket leaves the safe interior of the curb.`);
  }
  if (bucketSolidCount <= 0 || bucketSolidCount >= FORGE_COMPONENT_GRID.x * FORGE_COMPONENT_GRID.y * FORGE_COMPONENT_GRID.z) {
    throw new Error(`${spec.key} bucket must preserve its hollow forged body and raised handle.`);
  }
  const crankAxle = componentBounds[layout.crankAxle];
  const crankDrop = componentBounds[layout.crankDrop];
  const crankGrip = componentBounds[layout.crankGrip];
  if (crankAxle.min[0] !== rightPost.max[0]
    || overlapLength(crankAxle.min[1], crankAxle.max[1], rightPost.min[1], rightPost.max[1]) <= 0
    || overlapLength(crankAxle.min[2], crankAxle.max[2], rightPost.min[2], rightPost.max[2]) <= 0
    || crankAxle.max[0] !== crankDrop.min[0]
    || overlapLength(crankAxle.min[1], crankAxle.max[1], crankDrop.min[1], crankDrop.max[1]) <= 0
    || overlapLength(crankAxle.min[2], crankAxle.max[2], crankDrop.min[2], crankDrop.max[2]) <= 0
    || crankDrop.max[0] !== crankGrip.min[0]
    || overlapLength(crankDrop.min[1], crankDrop.max[1], crankGrip.min[1], crankGrip.max[1]) <= 0
    || overlapLength(crankDrop.min[2], crankDrop.max[2], crankGrip.min[2], crankGrip.max[2]) <= 0
    || crankGrip.max[0] <= foundation.max[0]) {
    throw new Error(`${spec.key} crank does not form a continuous post-mounted axle, drop, and outward wooden grip.`);
  }
}

function overlapLength(leftMin, leftMax, rightMin, rightMax) {
  return Math.min(leftMax, rightMax) - Math.max(leftMin, rightMin);
}

function validateDirectionSignpostGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 15 || runtime.boundsQ.sizeQ.join(",") !== "114,112,32") {
    throw new Error(`${spec.key} must preserve its human-scale roadside signpost proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "polished_stone_slab", "polished_stone_slab", "iron_bloom", "squared_timber", "iron_bloom", "squared_timber",
    "wooden_plank", "wooden_plank", "iron_bloom", "wooden_plank", "wooden_plank", "iron_bloom", "wooden_plank", "wooden_plank", "iron_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const foundation = bounds[layout.foundation];
  const plinth = bounds[layout.plinth];
  const postFoot = bounds[layout.postFoot];
  const post = bounds[layout.post];
  const topCollar = bounds[layout.topCollar];
  const cap = bounds[layout.cap];
  if (foundation.min[1] !== 0 || foundation.max[1] !== plinth.min[1]
    || plinth.max[1] !== postFoot.min[1] || postFoot.max[1] !== post.min[1]
    || post.max[1] !== topCollar.min[1] || topCollar.max[1] !== cap.min[1]
    || post.min[0] < postFoot.min[0] || post.max[0] > postFoot.max[0]
    || post.min[2] < postFoot.min[2] || post.max[2] > postFoot.max[2]
    || cap.min[0] > topCollar.min[0] || cap.max[0] < topCollar.max[0]
    || cap.min[2] > topCollar.min[2] || cap.max[2] < topCollar.max[2]) {
    throw new Error(`${spec.key} foundation, plinth, iron foot, post, collar, and cap are not one continuous grounded stack.`);
  }
  for (let position = 0; position < layout.boards.length; position += 1) {
    const board = bounds[layout.boards[position]];
    const arrowhead = bounds[layout.arrowheads[position]];
    const facePlate = bounds[layout.facePlates[position]];
    const direction = layout.directions[position];
    const boardTouchesPost = direction < 0 ? board.max[0] === post.min[0] : board.min[0] === post.max[0];
    const arrowTouchesBoard = direction < 0 ? arrowhead.max[0] === board.min[0] : arrowhead.min[0] === board.max[0];
    const pointsOutward = direction < 0 ? arrowhead.min[0] < board.min[0] : arrowhead.max[0] > board.max[0];
    if (!boardTouchesPost || !arrowTouchesBoard || !pointsOutward
      || overlapLength(board.min[1], board.max[1], post.min[1], post.max[1]) <= 0
      || overlapLength(board.min[2], board.max[2], post.min[2], post.max[2]) <= 0
      || facePlate.min[2] !== board.max[2]
      || overlapLength(facePlate.min[0], facePlate.max[0], board.min[0], board.max[0]) <= 0
      || overlapLength(facePlate.min[1], facePlate.max[1], board.min[1], board.max[1]) <= 0) {
      throw new Error(`${spec.key} directional arm ${position} is detached, points inward, or has an invalid iron face plate.`);
    }
    const arrowComponent = components[layout.arrowheads[position]];
    const solidCount = arrowComponent.solid.reduce((sum, value) => sum + value, 0);
    if (solidCount <= 0 || solidCount >= FORGE_COMPONENT_GRID.x * FORGE_COMPONENT_GRID.y * FORGE_COMPONENT_GRID.z) {
      throw new Error(`${spec.key} directional arm ${position} must preserve a machined arrow silhouette.`);
    }
  }
  const boardHeights = layout.boards.map((index) => components[index].offsetQ[1]);
  if (!(boardHeights[0] > boardHeights[1] && boardHeights[1] > boardHeights[2])) {
    throw new Error(`${spec.key} direction arms must remain visibly staggered from top to bottom.`);
  }
}

function validatePublicLitterBinGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 24 || runtime.boundsQ.sizeQ.join(",") !== "36,50,38") {
    throw new Error(`${spec.key} must preserve its compact human-scale public-bin proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "iron_bloom", "iron_bloom", "iron_bloom", "iron_bloom", "wooden_plank",
    "wooden_plank", "wooden_plank", "wooden_plank", "wooden_plank",
    ...Array(15).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const floor = bounds[layout.floor];
  const [back, front, left, right] = layout.walls.map((index) => bounds[index]);
  if (floor.min[1] <= 0 || floor.max[1] < back.min[1] || floor.max[1] < front.min[1]
    || floor.max[1] < left.min[1] || floor.max[1] < right.min[1]
    || floor.min[1] > back.min[1] || floor.min[1] > front.min[1]
    || floor.min[1] > left.min[1] || floor.min[1] > right.min[1]
    || back.min[0] !== floor.min[0] || back.max[0] !== floor.max[0]
    || front.min[0] !== floor.min[0] || front.max[0] !== floor.max[0]
    || left.min[2] !== floor.min[2] || left.max[2] !== floor.max[2]
    || right.min[2] !== floor.min[2] || right.max[2] !== floor.max[2]
    || back.max[2] !== left.min[2] || front.min[2] !== left.max[2]
    || back.min[0] !== left.max[0] || back.max[0] !== right.min[0]
    || front.min[0] !== left.max[0] || front.max[0] !== right.min[0]) {
    throw new Error(`${spec.key} timber floor and four walls do not form one open-topped container.`);
  }
  for (const footIndex of layout.feet) {
    const foot = bounds[footIndex];
    if (foot.min[1] !== 0 || foot.max[1] !== floor.min[1]
      || overlapLength(foot.min[0], foot.max[0], floor.min[0], floor.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], floor.min[2], floor.max[2]) <= 0) {
      throw new Error(`${spec.key} foot ${footIndex} does not ground and support the timber floor.`);
    }
  }
  const wallTop = back.max[1];
  const innerOpening = {
    minX: left.max[0],
    maxX: right.min[0],
    minZ: back.max[2],
    maxZ: front.min[2],
  };
  if (innerOpening.maxX - innerOpening.minX < 24 || innerOpening.maxZ - innerOpening.minZ < 24) {
    throw new Error(`${spec.key} must keep a genuinely usable open top rather than a solid or token cavity.`);
  }
  for (const [bandName, indexes, expectedY] of [
    ["lower band", layout.lowerBands, 18],
    ["middle band", layout.middleBands, 30],
    ["top rim", layout.rim, 44],
  ]) {
    for (const index of indexes) {
      const piece = bounds[index];
      if (components[index].offsetQ[1] !== expectedY || piece.min[1] < back.min[1] || piece.max[1] > wallTop + 6) {
        throw new Error(`${spec.key} ${bandName} ${index} is vertically misplaced.`);
      }
      const crossesOpening = overlapLength(piece.min[0], piece.max[0], innerOpening.minX, innerOpening.maxX) > 0
        && overlapLength(piece.min[2], piece.max[2], innerOpening.minZ, innerOpening.maxZ) > 0;
      if (crossesOpening) throw new Error(`${spec.key} ${bandName} ${index} obstructs the open top.`);
    }
  }
  const [leftMount, rightMount, handleGrip] = layout.handle.map((index) => bounds[index]);
  if (leftMount.max[1] !== handleGrip.min[1] || rightMount.max[1] !== handleGrip.min[1]
    || handleGrip.min[0] !== leftMount.max[0] || handleGrip.max[0] !== rightMount.min[0]
    || leftMount.min[2] > front.max[2] + 2 || leftMount.max[2] <= front.max[2]
    || rightMount.min[2] > front.max[2] + 2 || rightMount.max[2] <= front.max[2]
    || handleGrip.min[2] > front.max[2] + 2 || handleGrip.max[2] <= front.max[2]) {
    throw new Error(`${spec.key} side handle must remain a closed, face-connected loop mounted outside the front wall.`);
  }
}

function validateCoatRackGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 23 || runtime.boundsQ.sizeQ.join(",") !== "66,112,66") {
    throw new Error(`${spec.key} must preserve its canonical-player-scale inn coat-rack proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "iron_bloom",
    ...Array(4).fill("squared_timber"),
    "iron_bloom", "squared_timber", "iron_bloom", "squared_timber", "iron_bloom", "squared_timber",
    "iron_bloom", "wooden_stick", "wooden_stick",
    "iron_bloom", "wooden_stick", "wooden_stick",
    "iron_bloom", "wooden_stick", "wooden_stick",
    "iron_bloom", "wooden_stick", "wooden_stick",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }

  const foundation = bounds[layout.foundation];
  const baseCollar = bounds[layout.baseCollar];
  const lowerPost = bounds[layout.lowerPost];
  const middleCollar = bounds[layout.middleCollar];
  const upperPost = bounds[layout.upperPost];
  const upperCollar = bounds[layout.upperCollar];
  const cap = bounds[layout.cap];
  if (foundation.min[1] !== 0 || baseCollar.min[1] !== foundation.max[1]
    || baseCollar.max[1] !== lowerPost.min[1] || lowerPost.max[1] !== middleCollar.min[1]
    || middleCollar.max[1] !== upperPost.min[1] || upperPost.max[1] !== upperCollar.min[1]
    || upperCollar.max[1] !== cap.min[1]
    || lowerPost.min[0] < baseCollar.min[0] || lowerPost.max[0] > baseCollar.max[0]
    || lowerPost.min[2] < baseCollar.min[2] || lowerPost.max[2] > baseCollar.max[2]
    || upperPost.min[0] < middleCollar.min[0] || upperPost.max[0] > middleCollar.max[0]
    || upperPost.min[2] < middleCollar.min[2] || upperPost.max[2] > middleCollar.max[2]) {
    throw new Error(`${spec.key} base collars, timber post, and cap must form one continuous vertical stack.`);
  }
  const expectedFootOffsets = [[13, 2, 0], [-13, 2, 0], [0, 2, 13], [0, 2, -13]];
  for (let position = 0; position < layout.feet.length; position += 1) {
    const index = layout.feet[position];
    const foot = bounds[index];
    if (components[index].offsetQ.some((value, axis) => value !== expectedFootOffsets[position][axis])
      || foot.min[1] !== 0
      || ![0, 2].some((axis) => overlapLength(foot.min[axis], foot.max[axis], foundation.min[axis], foundation.max[axis]) === 0)
      || overlapLength(foot.min[0], foot.max[0], foundation.min[0], foundation.max[0]) < 0
      || overlapLength(foot.min[2], foot.max[2], foundation.min[2], foundation.max[2]) < 0) {
      throw new Error(`${spec.key} foot ${index} is not a grounded face-connected arm of the four-way base.`);
    }
  }

  for (const [tier, hooks, collarIndex] of [
    ["lower", layout.lowerHooks, layout.middleCollar],
    ["upper", layout.upperHooks, layout.upperCollar],
  ]) {
    const collar = bounds[collarIndex];
    for (const { root, arm, stop, axis, direction } of hooks) {
      const crossAxes = [0, 1, 2].filter((candidate) => candidate !== axis);
      const rootBounds = bounds[root];
      const armBounds = bounds[arm];
      const stopBounds = bounds[stop];
      const collarFace = direction > 0 ? collar.max[axis] : collar.min[axis];
      const rootInnerFace = direction > 0 ? rootBounds.min[axis] : rootBounds.max[axis];
      const rootOuterFace = direction > 0 ? rootBounds.max[axis] : rootBounds.min[axis];
      const armInnerFace = direction > 0 ? armBounds.min[axis] : armBounds.max[axis];
      const armOuterFace = direction > 0 ? armBounds.max[axis] : armBounds.min[axis];
      const stopInnerFace = direction > 0 ? stopBounds.min[axis] : stopBounds.max[axis];
      if (rootInnerFace !== collarFace || armInnerFace !== rootOuterFace || stopInnerFace !== armOuterFace
        || crossAxes.some((crossAxis) => overlapLength(rootBounds.min[crossAxis], rootBounds.max[crossAxis], collar.min[crossAxis], collar.max[crossAxis]) <= 0)
        || crossAxes.some((crossAxis) => overlapLength(armBounds.min[crossAxis], armBounds.max[crossAxis], rootBounds.min[crossAxis], rootBounds.max[crossAxis]) <= 0)
        || crossAxes.some((crossAxis) => overlapLength(stopBounds.min[crossAxis], stopBounds.max[crossAxis], armBounds.min[crossAxis], armBounds.max[crossAxis]) <= 0)
        || stopBounds.max[1] <= armBounds.max[1]) {
        throw new Error(`${spec.key} ${tier} hook ${root}/${arm}/${stop} is detached, reversed, or lacks its raised retaining stop.`);
      }
    }
  }
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      if (boundsOverlap(bounds[left], bounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validateBedsideTableGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 20 || runtime.boundsQ.sizeQ.join(",") !== "44,48,34") {
    throw new Error(`${spec.key} must preserve its compact canonical-player-scale bedside proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    "wooden_plank",
    ...Array(4).fill("iron_bloom"),
    "wooden_plank", "wooden_plank", "iron_bloom",
    ...Array(4).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const top = bounds[layout.top];
  if (top.max[0] - top.min[0] !== 44 || top.max[2] - top.min[2] !== 34) {
    throw new Error(`${spec.key} must preserve a practical inn bedside top.`);
  }
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const collar = bounds[layout.upperCollars[position]];
    const cap = bounds[layout.topCaps[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== leg.min[1] || leg.max[1] !== collar.min[1]
      || collar.max[1] !== top.min[1] || cap.min[1] !== top.max[1]
      || overlapLength(foot.min[0], foot.max[0], leg.min[0], leg.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], leg.min[2], leg.max[2]) <= 0
      || overlapLength(leg.min[0], leg.max[0], collar.min[0], collar.max[0]) <= 0
      || overlapLength(leg.min[2], leg.max[2], collar.min[2], collar.max[2]) <= 0
      || overlapLength(collar.min[0], collar.max[0], top.min[0], top.max[0]) <= 0
      || overlapLength(collar.min[2], collar.max[2], top.min[2], top.max[2]) <= 0
      || overlapLength(cap.min[0], cap.max[0], top.min[0], top.max[0]) <= 0
      || overlapLength(cap.min[2], cap.max[2], top.min[2], top.max[2]) <= 0) {
      throw new Error(`${spec.key} corner stack ${position} does not form one grounded iron-capped timber support.`);
    }
  }
  const shelf = bounds[layout.shelf];
  const drawer = bounds[layout.drawer];
  const handle = bounds[layout.handle];
  for (const legIndex of layout.legs) {
    const leg = bounds[legIndex];
    const shelfTouches = [0, 2].some((axis) => (shelf.min[axis] === leg.max[axis] || shelf.max[axis] === leg.min[axis])
      && overlapLength(shelf.min[1], shelf.max[1], leg.min[1], leg.max[1]) > 0
      && overlapLength(shelf.min[axis === 0 ? 2 : 0], shelf.max[axis === 0 ? 2 : 0], leg.min[axis === 0 ? 2 : 0], leg.max[axis === 0 ? 2 : 0]) > 0);
    const drawerTouches = [0, 2].some((axis) => (drawer.min[axis] === leg.max[axis] || drawer.max[axis] === leg.min[axis])
      && overlapLength(drawer.min[1], drawer.max[1], leg.min[1], leg.max[1]) > 0
      && overlapLength(drawer.min[axis === 0 ? 2 : 0], drawer.max[axis === 0 ? 2 : 0], leg.min[axis === 0 ? 2 : 0], leg.max[axis === 0 ? 2 : 0]) > 0);
    if (!shelfTouches || !drawerTouches) {
      throw new Error(`${spec.key} shelf or drawer is detached from leg ${legIndex}.`);
    }
  }
  if (shelf.max[1] >= drawer.min[1] || drawer.max[1] !== bounds[layout.upperCollars[0]].min[1]
    || handle.min[2] !== drawer.max[2]
    || overlapLength(handle.min[0], handle.max[0], drawer.min[0], drawer.max[0]) <= 0
    || overlapLength(handle.min[1], handle.max[1], drawer.min[1], drawer.max[1]) <= 0) {
    throw new Error(`${spec.key} must keep an open lower bay, a closed supported drawer, and a face-mounted pull.`);
  }
  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      if (boundsOverlap(bounds[left], bounds[right], 0)) {
        throw new Error(`${spec.key} components ${left} and ${right} intersect.`);
      }
    }
  }
}

function validateWashstandGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 21 || runtime.boundsQ.sizeQ.join(",") !== "44,56,42") {
    throw new Error(`${spec.key} must preserve its compact canonical-player-scale washstand proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    "wooden_plank",
    ...Array(4).fill("iron_bloom"),
    ...Array(5).fill("copper_bloom"),
    "iron_bloom", "iron_bloom", "wooden_stick",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const floor = bounds[layout.basinFloor];
  const [back, front, left, right] = layout.basinWalls.map((index) => bounds[index]);
  if (floor.min[0] !== left.min[0] || floor.max[0] !== right.max[0]
    || floor.min[2] !== back.min[2] || floor.max[2] !== front.max[2]
    || [back, front, left, right].some((wall) => wall.min[1] !== floor.max[1])
    || back.min[0] !== floor.min[0] || back.max[0] !== floor.max[0]
    || front.min[0] !== floor.min[0] || front.max[0] !== floor.max[0]
    || left.min[2] !== back.max[2] || left.max[2] !== front.min[2]
    || right.min[2] !== back.max[2] || right.max[2] !== front.min[2]
    || back.max[2] !== left.min[2] || front.min[2] !== left.max[2]
    || left.max[0] >= right.min[0] || back.max[2] >= front.min[2]) {
    throw new Error(`${spec.key} copper floor and four walls must form one continuous, genuinely open wash basin.`);
  }
  const cavityWidth = right.min[0] - left.max[0];
  const cavityDepth = front.min[2] - back.max[2];
  const cavityHeight = back.max[1] - floor.max[1];
  if (cavityWidth < 32 || cavityDepth < 24 || cavityHeight < 8) {
    throw new Error(`${spec.key} copper basin cavity is too small to be usable.`);
  }
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const collar = bounds[layout.upperCollars[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== leg.min[1] || leg.max[1] !== collar.min[1]
      || collar.max[1] !== floor.min[1]
      || overlapLength(foot.min[0], foot.max[0], leg.min[0], leg.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], leg.min[2], leg.max[2]) <= 0
      || overlapLength(leg.min[0], leg.max[0], collar.min[0], collar.max[0]) <= 0
      || overlapLength(leg.min[2], leg.max[2], collar.min[2], collar.max[2]) <= 0
      || overlapLength(collar.min[0], collar.max[0], floor.min[0], floor.max[0]) <= 0
      || overlapLength(collar.min[2], collar.max[2], floor.min[2], floor.max[2]) <= 0) {
      throw new Error(`${spec.key} support stack ${position} does not continuously ground the copper basin.`);
    }
  }
  const shelf = bounds[layout.shelf];
  for (const legIndex of layout.legs) {
    const leg = bounds[legIndex];
    const shelfTouches = [0, 2].some((axis) => (shelf.min[axis] === leg.max[axis] || shelf.max[axis] === leg.min[axis])
      && overlapLength(shelf.min[1], shelf.max[1], leg.min[1], leg.max[1]) > 0
      && overlapLength(shelf.min[axis === 0 ? 2 : 0], shelf.max[axis === 0 ? 2 : 0], leg.min[axis === 0 ? 2 : 0], leg.max[axis === 0 ? 2 : 0]) > 0);
    if (!shelfTouches) throw new Error(`${spec.key} lower shelf is detached from leg ${legIndex}.`);
  }
  const [leftMount, rightMount, rail] = layout.towelRail.map((index) => bounds[index]);
  if (leftMount.min[2] !== bounds[layout.legs[1]].max[2]
    || rightMount.min[2] !== bounds[layout.legs[3]].max[2]
    || rail.min[0] !== leftMount.max[0] || rail.max[0] !== rightMount.min[0]
    || overlapLength(rail.min[1], rail.max[1], leftMount.min[1], leftMount.max[1]) <= 0
    || overlapLength(rail.min[2], rail.max[2], leftMount.min[2], leftMount.max[2]) <= 0
    || overlapLength(rail.min[1], rail.max[1], rightMount.min[1], rightMount.max[1]) <= 0
    || overlapLength(rail.min[2], rail.max[2], rightMount.min[2], rightMount.max[2]) <= 0) {
    throw new Error(`${spec.key} towel rail must remain a face-connected outward front assembly.`);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateSingleBedFrameGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 24 || runtime.boundsQ.sizeQ.join(",") !== "58,68,122") {
    throw new Error(`${spec.key} must preserve its canonical-player-scale single-bed proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    "wooden_plank", "wooden_plank", "wooden_plank", "wooden_plank",
    ...Array(3).fill("squared_timber"),
    ...Array(5).fill("wooden_plank"),
    ...Array(4).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    const cap = bounds[layout.caps[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== post.min[1] || post.max[1] !== cap.min[1]
      || overlapLength(foot.min[0], foot.max[0], post.min[0], post.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], post.min[2], post.max[2]) <= 0
      || overlapLength(post.min[0], post.max[0], cap.min[0], cap.max[0]) <= 0
      || overlapLength(post.min[2], post.max[2], cap.min[2], cap.max[2]) <= 0) {
      throw new Error(`${spec.key} corner post ${position} is not one grounded iron-capped support.`);
    }
  }
  const [leftRail, rightRail] = layout.sideRails.map((index) => bounds[index]);
  const [leftHeadPost, rightHeadPost, leftFootPost, rightFootPost] = layout.posts.map((index) => bounds[index]);
  if (leftRail.min[2] !== leftHeadPost.max[2] || leftRail.max[2] !== leftFootPost.min[2]
    || rightRail.min[2] !== rightHeadPost.max[2] || rightRail.max[2] !== rightFootPost.min[2]) {
    throw new Error(`${spec.key} long side rails must face-connect head and foot posts across the full sleeping length.`);
  }
  const [lowerHeadRail, upperHeadRail] = layout.headRails.map((index) => bounds[index]);
  const footboard = bounds[layout.footboard];
  for (const rail of [lowerHeadRail, upperHeadRail]) {
    if (rail.min[0] !== leftHeadPost.max[0] || rail.max[0] !== rightHeadPost.min[0]) {
      throw new Error(`${spec.key} headboard rail is detached from its posts.`);
    }
  }
  if (footboard.min[0] !== leftFootPost.max[0] || footboard.max[0] !== rightFootPost.min[0]) {
    throw new Error(`${spec.key} footboard is detached from its posts.`);
  }
  for (const slatIndex of layout.headSlats) {
    const slat = bounds[slatIndex];
    if (slat.min[1] !== lowerHeadRail.max[1] || slat.max[1] !== upperHeadRail.min[1]
      || overlapLength(slat.min[0], slat.max[0], lowerHeadRail.min[0], lowerHeadRail.max[0]) <= 0
      || overlapLength(slat.min[2], slat.max[2], lowerHeadRail.min[2], lowerHeadRail.max[2]) <= 0) {
      throw new Error(`${spec.key} headboard slat ${slatIndex} is not captive between both head rails.`);
    }
  }
  for (const slatIndex of layout.supportSlats) {
    const slat = bounds[slatIndex];
    if (slat.min[0] !== leftRail.max[0] || slat.max[0] !== rightRail.min[0]
      || overlapLength(slat.min[1], slat.max[1], leftRail.min[1], leftRail.max[1]) <= 0
      || slat.min[2] <= leftRail.min[2] || slat.max[2] >= leftRail.max[2]) {
      throw new Error(`${spec.key} sleeping support slat ${slatIndex} is detached or leaves the bed interior.`);
    }
  }
  const supportOffsets = layout.supportSlats.map((index) => components[index].offsetQ[2]);
  if (supportOffsets.some((value, index) => index > 0 && value - supportOffsets[index - 1] !== 24)) {
    throw new Error(`${spec.key} support slats must remain evenly spaced under the sleeping plane.`);
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateRoomKeyBoardGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 19 || runtime.boundsQ.sizeQ.join(",") !== "48,70,17") {
    throw new Error(`${spec.key} must preserve its human-readable portrait room-key-board proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "wooden_plank",
    ...Array(4).fill("squared_timber"),
    "iron_bloom", "iron_bloom",
    ...Array(6).fill("wooden_plank"),
    ...Array(6).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const board = bounds[layout.board];
  const [left, right, bottom, top] = layout.frame.map((index) => bounds[index]);
  if (board.min[0] !== left.max[0] || board.max[0] !== right.min[0]
    || board.min[1] !== bottom.max[1] || board.max[1] !== top.min[1]
    || board.min[2] < left.min[2] || board.max[2] > left.max[2]) {
    throw new Error(`${spec.key} backboard must remain captive within all four timber frame faces.`);
  }
  for (const hangerIndex of layout.hangers) {
    const hanger = bounds[hangerIndex];
    if (hanger.min[1] !== top.max[1]
      || overlapLength(hanger.min[0], hanger.max[0], top.min[0], top.max[0]) <= 0
      || overlapLength(hanger.min[2], hanger.max[2], top.min[2], top.max[2]) <= 0) {
      throw new Error(`${spec.key} wall hanger ${hangerIndex} is detached from the upper frame.`);
    }
  }
  const expectedPositions = [
    [-12, 47], [0, 47], [12, 47], [-12, 25], [0, 25], [12, 25],
  ];
  for (let position = 0; position < layout.labels.length; position += 1) {
    const labelIndex = layout.labels[position];
    const hookIndex = layout.hooks[position];
    const label = bounds[labelIndex];
    const hook = bounds[hookIndex];
    const [expectedX, labelY] = expectedPositions[position];
    if (components[labelIndex].offsetQ[0] !== expectedX || components[labelIndex].offsetQ[1] !== labelY
      || components[hookIndex].offsetQ[0] !== expectedX
      || label.min[2] !== board.max[2] || hook.min[2] !== board.max[2]
      || label.min[1] <= hook.max[1]
      || hook.max[2] <= label.max[2]) {
      throw new Error(`${spec.key} label-hook pair ${position} is misaligned or leaves the board face.`);
    }
    const hookSolidCount = components[hookIndex].solid.reduce((sum, value) => sum + value, 0);
    if (hookSolidCount <= 0 || hookSolidCount >= FORGE_COMPONENT_GRID.x * FORGE_COMPONENT_GRID.y * FORGE_COMPONENT_GRID.z) {
      throw new Error(`${spec.key} hook ${hookIndex} must preserve a genuinely machined raised-stop silhouette.`);
    }
    const backSolid = [];
    const outerLow = [];
    const outerHigh = [];
    for (let y = 0; y < FORGE_COMPONENT_GRID.y; y += 1) {
      for (let x = 0; x < FORGE_COMPONENT_GRID.x; x += 1) {
        if (components[hookIndex].solid[forgeVoxelIndex(x, y, 0)]) backSolid.push([x, y]);
        if (components[hookIndex].solid[forgeVoxelIndex(x, y, FORGE_COMPONENT_GRID.z - 2)]) {
          (y >= 6 ? outerHigh : outerLow).push([x, y]);
        }
      }
    }
    if (!backSolid.length || !outerLow.length || !outerHigh.length) {
      throw new Error(`${spec.key} hook ${hookIndex} lacks a board root, outward arm, or raised retaining stop.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateReceptionCounterGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 20 || runtime.boundsQ.sizeQ.join(",") !== "104,68,46") {
    throw new Error(`${spec.key} must preserve its human-scale inn reception-counter proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    ...Array(8).fill("wooden_plank"),
    "squared_timber", "squared_timber", "iron_bloom", "iron_bloom",
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const countertop = bounds[layout.countertop];
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const post = bounds[layout.posts[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== post.min[1] || post.max[1] !== countertop.min[1]
      || overlapLength(foot.min[0], foot.max[0], post.min[0], post.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], post.min[2], post.max[2]) <= 0
      || overlapLength(post.min[0], post.max[0], countertop.min[0], countertop.max[0]) <= 0
      || overlapLength(post.min[2], post.max[2], countertop.min[2], countertop.max[2]) <= 0) {
      throw new Error(`${spec.key} corner support ${position} does not form a grounded post beneath the customer countertop.`);
    }
  }
  const [lowerBeam, upperBeam] = layout.frontBeams.map((index) => bounds[index]);
  const [leftFrontPost, rightFrontPost] = [layout.posts[1], layout.posts[3]].map((index) => bounds[index]);
  for (const beam of [lowerBeam, upperBeam]) {
    if (beam.min[0] !== leftFrontPost.max[0] || beam.max[0] !== rightFrontPost.min[0]) {
      throw new Error(`${spec.key} customer-facing beam is detached from the front posts.`);
    }
  }
  for (const panelIndex of layout.frontPanels) {
    const panel = bounds[panelIndex];
    if (panel.min[1] !== lowerBeam.max[1] || panel.max[1] !== upperBeam.min[1]
      || panel.min[2] !== lowerBeam.max[2]
      || overlapLength(panel.min[0], panel.max[0], lowerBeam.min[0], lowerBeam.max[0]) <= 0) {
      throw new Error(`${spec.key} customer-facing panel ${panelIndex} is detached from the framed facade.`);
    }
  }
  const [writingShelf, storageShelf] = layout.staffShelves.map((index) => bounds[index]);
  const [leftBackPost, rightBackPost] = [layout.posts[0], layout.posts[2]].map((index) => bounds[index]);
  for (const shelf of [writingShelf, storageShelf]) {
    if (shelf.min[0] !== leftBackPost.max[0] || shelf.max[0] !== rightBackPost.min[0]
      || overlapLength(shelf.min[2], shelf.max[2], leftBackPost.min[2], leftBackPost.max[2]) <= 0
      || shelf.max[2] >= leftFrontPost.min[2]) {
      throw new Error(`${spec.key} staff-side shelf is detached or obstructs the customer facade.`);
    }
  }
  if (storageShelf.max[1] >= writingShelf.min[1] || writingShelf.max[1] >= countertop.min[1]) {
    throw new Error(`${spec.key} staff shelves must preserve two ordered open working bays.`);
  }
  for (let position = 0; position < layout.sideAprons.length; position += 1) {
    const apron = bounds[layout.sideAprons[position]];
    const backPost = bounds[layout.posts[position * 2]];
    const frontPost = bounds[layout.posts[position * 2 + 1]];
    if (apron.min[2] !== backPost.max[2] || apron.max[2] !== frontPost.min[2]
      || apron.max[1] !== countertop.min[1]) {
      throw new Error(`${spec.key} side apron ${position} is detached from the post pair or countertop.`);
    }
  }
  for (let position = 0; position < layout.ironBands.length; position += 1) {
    const band = bounds[layout.ironBands[position]];
    const beam = bounds[layout.frontBeams[position]];
    if (band.min[2] !== beam.max[2]
      || band.min[0] !== beam.min[0] || band.max[0] !== beam.max[0]
      || overlapLength(band.min[1], band.max[1], beam.min[1], beam.max[1]) <= 0) {
      throw new Error(`${spec.key} iron face band ${position} is detached from its timber beam.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateLuggageRackGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 24 || runtime.boundsQ.sizeQ.join(",") !== "50,40,32") {
    throw new Error(`${spec.key} must preserve its compact human-scale inn luggage-rack proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(6).fill("squared_timber"),
    ...Array(4).fill("wooden_plank"),
    ...Array(2).fill("squared_timber"),
    ...Array(4).fill("wooden_plank"),
    ...Array(4).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const upperRails = layout.upperRails.map((index) => bounds[index]);
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    const upperRail = upperRails[position % 2];
    if (foot.min[1] !== 0 || foot.max[1] !== leg.min[1] || leg.max[1] !== upperRail.min[1]
      || overlapLength(foot.min[0], foot.max[0], leg.min[0], leg.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], leg.min[2], leg.max[2]) <= 0
      || overlapLength(leg.min[0], leg.max[0], upperRail.min[0], upperRail.max[0]) <= 0
      || overlapLength(leg.min[2], leg.max[2], upperRail.min[2], upperRail.max[2]) <= 0) {
      throw new Error(`${spec.key} support stack ${position} does not continuously connect a grounded iron foot to the luggage deck.`);
    }
  }
  for (const slatIndex of layout.luggageSlats) {
    const slat = bounds[slatIndex];
    if (slat.min[1] !== upperRails[0].max[1]
      || upperRails.some((rail) => overlapLength(slat.min[2], slat.max[2], rail.min[2], rail.max[2]) <= 0)) {
      throw new Error(`${spec.key} upper luggage slat ${slatIndex} is not supported by both rails.`);
    }
  }
  const lowerRails = layout.lowerRails.map((index) => bounds[index]);
  const [leftBackLeg, leftFrontLeg, rightBackLeg, rightFrontLeg] = layout.legs.map((index) => bounds[index]);
  for (let position = 0; position < lowerRails.length; position += 1) {
    const rail = lowerRails[position];
    const leftLeg = position === 0 ? leftBackLeg : leftFrontLeg;
    const rightLeg = position === 0 ? rightBackLeg : rightFrontLeg;
    if (rail.min[0] !== leftLeg.max[0] || rail.max[0] !== rightLeg.min[0]
      || overlapLength(rail.min[1], rail.max[1], leftLeg.min[1], leftLeg.max[1]) <= 0
      || overlapLength(rail.min[2], rail.max[2], leftLeg.min[2], leftLeg.max[2]) <= 0
      || overlapLength(rail.min[1], rail.max[1], rightLeg.min[1], rightLeg.max[1]) <= 0
      || overlapLength(rail.min[2], rail.max[2], rightLeg.min[2], rightLeg.max[2]) <= 0) {
      throw new Error(`${spec.key} lower shoe-shelf rail ${position} is detached from its leg pair.`);
    }
  }
  for (const slatIndex of layout.shoeSlats) {
    const slat = bounds[slatIndex];
    if (slat.min[1] !== lowerRails[0].max[1]
      || lowerRails.some((rail) => overlapLength(slat.min[2], slat.max[2], rail.min[2], rail.max[2]) <= 0)) {
      throw new Error(`${spec.key} lower shoe slat ${slatIndex} is not supported by both rails.`);
    }
  }
  for (let position = 0; position < layout.cornerPlates.length; position += 1) {
    const plate = bounds[layout.cornerPlates[position]];
    const rail = upperRails[position % 2];
    const attached = position < 2 ? plate.max[0] === rail.min[0] : plate.min[0] === rail.max[0];
    if (!attached || plate.min[1] !== rail.min[1] || plate.max[1] !== rail.max[1]
      || overlapLength(plate.min[2], plate.max[2], rail.min[2], rail.max[2]) <= 0) {
      throw new Error(`${spec.key} iron corner plate ${position} is detached from its upper rail.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateWritingDeskGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 21 || runtime.boundsQ.sizeQ.join(",") !== "72,48,40") {
    throw new Error(`${spec.key} must preserve its canonical-player-scale inn writing-desk proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    ...Array(4).fill("wooden_plank"),
    "iron_bloom", "wooden_plank",
    ...Array(3).fill("squared_timber"),
    ...Array(4).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const desktop = bounds[layout.desktop];
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const leg = bounds[layout.legs[position]];
    if (foot.min[1] !== 0 || foot.max[1] !== leg.min[1] || leg.max[1] !== desktop.min[1]
      || overlapLength(foot.min[0], foot.max[0], leg.min[0], leg.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], leg.min[2], leg.max[2]) <= 0
      || overlapLength(leg.min[0], leg.max[0], desktop.min[0], desktop.max[0]) <= 0
      || overlapLength(leg.min[2], leg.max[2], desktop.min[2], desktop.max[2]) <= 0) {
      throw new Error(`${spec.key} support stack ${position} does not continuously connect a grounded iron foot to the desktop.`);
    }
  }
  const [leftApron, rightApron] = layout.frontAprons.map((index) => bounds[index]);
  const drawer = bounds[layout.drawer];
  const [leftFrontLeg, rightFrontLeg] = [layout.legs[1], layout.legs[3]].map((index) => bounds[index]);
  if (leftApron.min[0] !== leftFrontLeg.max[0] || leftApron.max[0] !== drawer.min[0]
    || drawer.max[0] !== rightApron.min[0] || rightApron.max[0] !== rightFrontLeg.min[0]
    || [leftApron, drawer, rightApron].some((partBounds) => partBounds.max[1] !== desktop.min[1])) {
    throw new Error(`${spec.key} closed drawer and front aprons must form one supported row beneath the desktop.`);
  }
  const handle = bounds[layout.handle];
  if (handle.min[2] !== drawer.max[2]
    || overlapLength(handle.min[0], handle.max[0], drawer.min[0], drawer.max[0]) <= 0
    || overlapLength(handle.min[1], handle.max[1], drawer.min[1], drawer.max[1]) <= 0) {
    throw new Error(`${spec.key} iron drawer pull is detached from the closed drawer face.`);
  }
  const backApron = bounds[layout.backApron];
  const [leftBackLeg, rightBackLeg] = [layout.legs[0], layout.legs[2]].map((index) => bounds[index]);
  if (backApron.min[0] !== leftBackLeg.max[0] || backApron.max[0] !== rightBackLeg.min[0]
    || backApron.max[1] !== desktop.min[1]) {
    throw new Error(`${spec.key} back apron is detached from the rear legs or desktop.`);
  }
  for (let position = 0; position < layout.sideAprons.length; position += 1) {
    const apron = bounds[layout.sideAprons[position]];
    const backLeg = bounds[layout.legs[position * 2]];
    const frontLeg = bounds[layout.legs[position * 2 + 1]];
    if (apron.min[2] !== backLeg.max[2] || apron.max[2] !== frontLeg.min[2]
      || apron.max[1] !== desktop.min[1]) {
      throw new Error(`${spec.key} side apron ${position} is detached from its leg pair or desktop.`);
    }
  }
  const rearStretcher = bounds[layout.rearStretcher];
  if (rearStretcher.min[0] !== leftBackLeg.max[0] || rearStretcher.max[0] !== rightBackLeg.min[0]
    || overlapLength(rearStretcher.min[1], rearStretcher.max[1], leftBackLeg.min[1], leftBackLeg.max[1]) <= 0
    || overlapLength(rearStretcher.min[2], rearStretcher.max[2], leftBackLeg.min[2], leftBackLeg.max[2]) <= 0) {
    throw new Error(`${spec.key} rear lower stretcher is detached from the back legs.`);
  }
  for (const plateIndex of layout.cornerPlates) {
    const plate = bounds[plateIndex];
    const faceConnected = plate.max[2] === desktop.min[2] || plate.min[2] === desktop.max[2];
    if (!faceConnected
      || overlapLength(plate.min[0], plate.max[0], desktop.min[0], desktop.max[0]) <= 0
      || overlapLength(plate.min[1], plate.max[1], desktop.min[1], desktop.max[1]) <= 0) {
      throw new Error(`${spec.key} iron desktop corner plate ${plateIndex} is detached.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateWritingChairGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 19 || runtime.boundsQ.sizeQ.join(",") !== "32,56,40") {
    throw new Error(`${spec.key} must preserve its canonical-player-scale inn writing-chair proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    ...Array(4).fill("iron_bloom"),
    ...Array(4).fill("squared_timber"),
    ...Array(3).fill("wooden_plank"),
    ...Array(4).fill("squared_timber"),
    ...Array(4).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const seat = bounds[layout.seat];
  for (let position = 0; position < layout.feet.length; position += 1) {
    const foot = bounds[layout.feet[position]];
    const supportIndex = position < 2 ? layout.frontLegs[position] : layout.rearPosts[position - 2];
    const support = bounds[supportIndex];
    const supportSeatConnected = position < 2
      ? support.max[1] === seat.min[1]
        && overlapLength(support.min[2], support.max[2], seat.min[2], seat.max[2]) > 0
      : support.max[2] === seat.min[2]
        && overlapLength(support.min[1], support.max[1], seat.min[1], seat.max[1]) > 0;
    if (foot.min[1] !== 0 || foot.max[1] !== support.min[1] || !supportSeatConnected
      || overlapLength(foot.min[0], foot.max[0], support.min[0], support.max[0]) <= 0
      || overlapLength(foot.min[2], foot.max[2], support.min[2], support.max[2]) <= 0
      || overlapLength(support.min[0], support.max[0], seat.min[0], seat.max[0]) <= 0) {
      throw new Error(`${spec.key} support stack ${position} does not continuously connect a grounded iron foot to the seat.`);
    }
  }
  const [leftRearPost, rightRearPost] = layout.rearPosts.map((index) => bounds[index]);
  for (const slatIndex of layout.backSlats) {
    const slat = bounds[slatIndex];
    if (slat.min[0] !== leftRearPost.max[0] || slat.max[0] !== rightRearPost.min[0]
      || slat.min[2] !== leftRearPost.min[2] || slat.max[2] !== leftRearPost.max[2]
      || overlapLength(slat.min[1], slat.max[1], leftRearPost.min[1], leftRearPost.max[1]) <= 0) {
      throw new Error(`${spec.key} backrest slat ${slatIndex} is detached from the rear posts.`);
    }
  }
  const [lowerBackSlat, upperBackSlat] = layout.backSlats.map((index) => bounds[index]);
  if (lowerBackSlat.max[1] >= upperBackSlat.min[1] || lowerBackSlat.min[1] <= seat.max[1]) {
    throw new Error(`${spec.key} backrest must preserve two ordered slats and an open lumbar gap above the seat.`);
  }
  const [leftFrontLeg, rightFrontLeg] = layout.frontLegs.map((index) => bounds[index]);
  const frontStretcher = bounds[layout.frontStretcher];
  if (frontStretcher.min[0] !== leftFrontLeg.max[0] || frontStretcher.max[0] !== rightFrontLeg.min[0]
    || overlapLength(frontStretcher.min[1], frontStretcher.max[1], leftFrontLeg.min[1], leftFrontLeg.max[1]) <= 0) {
    throw new Error(`${spec.key} front stretcher is detached from the front legs.`);
  }
  for (let position = 0; position < layout.sideStretchers.length; position += 1) {
    const stretcher = bounds[layout.sideStretchers[position]];
    const frontLeg = bounds[layout.frontLegs[position]];
    const rearPost = bounds[layout.rearPosts[position]];
    if (stretcher.min[2] !== rearPost.max[2] || stretcher.max[2] !== frontLeg.min[2]
      || overlapLength(stretcher.min[1], stretcher.max[1], frontLeg.min[1], frontLeg.max[1]) <= 0
      || overlapLength(stretcher.min[0], stretcher.max[0], frontLeg.min[0], frontLeg.max[0]) <= 0) {
      throw new Error(`${spec.key} side stretcher ${position} is detached from the front and rear supports.`);
    }
  }
  const rearStretcher = bounds[layout.rearStretcher];
  if (rearStretcher.min[0] !== leftRearPost.max[0] || rearStretcher.max[0] !== rightRearPost.min[0]) {
    throw new Error(`${spec.key} rear stretcher is detached from the rear posts.`);
  }
  for (const plateIndex of layout.seatPlates) {
    const plate = bounds[plateIndex];
    if (plate.min[1] !== seat.max[1]
      || overlapLength(plate.min[0], plate.max[0], seat.min[0], seat.max[0]) <= 0
      || overlapLength(plate.min[2], plate.max[2], seat.min[2], seat.max[2]) <= 0) {
      throw new Error(`${spec.key} iron seat plate ${plateIndex} is detached.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
}

function validateWallMirrorGeometry(spec, runtime, layout) {
  if (runtime.componentCount !== 12 || runtime.boundsQ.sizeQ.join(",") !== "40,64,8") {
    throw new Error(`${spec.key} must preserve its portrait human-readable inn wall-mirror proportions (got ${runtime.componentCount} components and ${runtime.boundsQ.sizeQ.join(",")}).`);
  }
  const components = runtime.components ?? [];
  const bounds = components.map((component) => ({
    min: component.offsetQ.map((value, axis) => value - component.dimsQ[axis] * 0.5),
    max: component.offsetQ.map((value, axis) => value + component.dimsQ[axis] * 0.5),
  }));
  const expectedMaterials = [
    "wooden_plank", ...Array(4).fill("squared_timber"), "copper_bloom", ...Array(6).fill("iron_bloom"),
  ];
  for (let index = 0; index < expectedMaterials.length; index += 1) {
    if (!components[index] || spec.parts[index]?.materialId !== expectedMaterials[index]) {
      throw new Error(`${spec.key} has an invalid material at component ${index}.`);
    }
  }
  const backplate = bounds[layout.backplate];
  const mirrorFace = bounds[layout.mirrorFace];
  const [left, right, bottom, top] = layout.frame.map((index) => bounds[index]);
  if (backplate.max[2] !== mirrorFace.min[2]
    || backplate.min[0] !== mirrorFace.min[0] || backplate.max[0] !== mirrorFace.max[0]
    || backplate.min[1] !== mirrorFace.min[1] || backplate.max[1] !== mirrorFace.max[1]) {
    throw new Error(`${spec.key} polished copper face must be fully supported by the timber backplate without intersection.`);
  }
  if (mirrorFace.min[0] !== left.max[0] || mirrorFace.max[0] !== right.min[0]
    || mirrorFace.min[1] !== bottom.max[1] || mirrorFace.max[1] !== top.min[1]
    || [left, right, bottom, top].some((rail) => rail.min[2] !== backplate.max[2]
      || overlapLength(rail.min[2], rail.max[2], mirrorFace.min[2], mirrorFace.max[2]) <= 0)) {
    throw new Error(`${spec.key} copper face must remain captive inside all four timber frame rails.`);
  }
  for (let position = 0; position < layout.hangers.length; position += 1) {
    const hanger = bounds[layout.hangers[position]];
    if (hanger.min[1] !== top.max[1]
      || overlapLength(hanger.min[0], hanger.max[0], top.min[0], top.max[0]) <= 0
      || overlapLength(hanger.min[2], hanger.max[2], top.min[2], top.max[2]) <= 0) {
      throw new Error(`${spec.key} upper hanger ${position} is detached from the top rail.`);
    }
  }
  for (let position = 0; position < layout.cornerPlates.length; position += 1) {
    const plate = bounds[layout.cornerPlates[position]];
    const verticalRail = bounds[layout.frame[position % 2]];
    const horizontalRail = bounds[layout.frame[position < 2 ? 2 : 3]];
    if (plate.min[2] !== verticalRail.max[2]
      || overlapLength(plate.min[0], plate.max[0], verticalRail.min[0], verticalRail.max[0]) <= 0
      || overlapLength(plate.min[1], plate.max[1], horizontalRail.min[1], horizontalRail.max[1]) <= 0) {
      throw new Error(`${spec.key} iron corner plate ${position} is detached from both meeting frame rails.`);
    }
  }
  for (let first = 0; first < bounds.length; first += 1) {
    for (let second = first + 1; second < bounds.length; second += 1) {
      if (boundsOverlap(bounds[first], bounds[second], 0)) {
        throw new Error(`${spec.key} components ${first} and ${second} intersect.`);
      }
    }
  }
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

function tapestryKnotMask({ x, y }) {
  return TAPESTRY_KNOT_PATTERN[FORGE_COMPONENT_GRID.y - 1 - y][x] === "#";
}

function tapestryHangerMask({ x, y }) {
  return x < 2 || x >= FORGE_COMPONENT_GRID.x - 2 || y < 2 || y >= FORGE_COMPONENT_GRID.y - 2;
}

function clockFaceMask({ nx, ny }) {
  return Math.abs(nx) <= 0.98 && Math.abs(ny) <= 0.98 && Math.abs(nx) + Math.abs(ny) <= 1.55;
}

function clockBezelMask({ nx, ny }) {
  const outer = Math.abs(nx) <= 0.98 && Math.abs(ny) <= 0.98 && Math.abs(nx) + Math.abs(ny) <= 1.55;
  const inner = Math.abs(nx) < 0.74 && Math.abs(ny) < 0.74 && Math.abs(nx) + Math.abs(ny) < 1.12;
  return outer && !inner;
}

function clockHourStudMask({ x, y }) {
  const hourStud = [
    [6, 9], [9, 8], [11, 7], [12, 5], [11, 3], [9, 1],
    [6, 0], [4, 1], [2, 3], [1, 5], [2, 7], [4, 8],
  ].some(([studX, studY]) => x === studX && y === studY);
  const centerHub = (x === 6 || x === 7) && (y === 4 || y === 5);
  return hourStud || centerHub;
}

function clockHandsMask({ x, y }) {
  const hourHand = (x === 6 || x === 7) && y >= 4 && y <= 8;
  const minuteHand = (y === 4 || y === 5) && x >= 6 && x <= 12;
  return hourHand || minuteHand;
}

function shopSignBraceMask({ nx, ny }) {
  return Math.abs(ny - nx) <= 0.28;
}

function shopSignDiamondMask({ nx, ny }) {
  return Math.abs(nx) + Math.abs(ny) <= 1.08;
}

function shopSignMerchantMarkMask({ nx, ny }) {
  const diamond = Math.abs(nx) + Math.abs(ny) <= 1.12;
  return diamond && (Math.abs(nx) <= 0.24 || Math.abs(ny) <= 0.28);
}

function handbellBodyMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const progress = (ny + 1) / 2;
  const outerRadius = 0.45 + progress * 0.55;
  const stairRadius = Math.floor(outerRadius * 4) / 4;
  return radial <= stairRadius;
}

function handbellRimMask({ nx, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  return radial >= 0.62 && radial <= 1.02;
}

function noticeBoardFastenerMask({ x, y }) {
  return [1, 4, 7, 10, 12].includes(x) && [1, 3, 5, 7, 9].includes(y);
}

function windowBoxCornerBandMask({ nx, ny, nz }) {
  const sideRail = Math.abs(nx) >= 0.5 && (Math.abs(ny) >= 0.56 || Math.abs(nz) >= 0.56);
  const faceRail = Math.abs(nx) < 0.5 && Math.abs(ny) >= 0.72 && Math.abs(nz) >= 0.72;
  return sideRail || faceRail;
}

function roomKeyHookMask({ x, y, z }) {
  const rootPlate = z <= 1 && x >= 3 && x <= 10 && y >= 1 && y <= 8;
  const outwardArm = x >= 5 && x <= 8 && y >= 1 && y <= 3 && z >= 1 && z <= 12;
  const retainingStop = x >= 5 && x <= 8 && y >= 1 && y <= 8 && z >= 11;
  return rootPlate || outwardArm || retainingStop;
}

function windowBoxBloomMask({ nx, ny, nz }) {
  const stem = Math.abs(nx) <= 0.2 && Math.abs(nz) <= 0.2 && ny <= 0.35;
  const petals = ny >= -0.1 && (
    (Math.abs(nx) <= 0.28 && Math.abs(nz) <= 0.92)
    || (Math.abs(nx) <= 0.92 && Math.abs(nz) <= 0.28)
  );
  return stem || petals;
}

function wellSuspendedBucketMask({ nx, ny, nz }) {
  const radial = Math.sqrt(nx * nx + nz * nz);
  const wall = radial >= 0.6 && radial <= 1.02 && ny <= 0.58;
  const bottom = ny <= -0.72 && radial <= 0.78;
  const handle = ny >= 0.36 && (Math.abs(nx) <= 0.2 || Math.abs(nz) <= 0.2);
  return wall || bottom || handle;
}

function directionSignLeftArrowMask({ nx, ny }) {
  return nx >= 0.15 || Math.abs(ny) <= (nx + 1) * 0.5;
}

function directionSignRightArrowMask({ nx, ny }) {
  return nx <= -0.15 || Math.abs(ny) <= (1 - nx) * 0.5;
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

function portraitBookParts(parts) {
  return parts.map((entry) => Object.freeze({
    ...entry,
    dimsQ: Object.freeze([entry.dimsQ[2], entry.dimsQ[1], entry.dimsQ[0]]),
    offsetQ: Object.freeze([entry.offsetQ[2], entry.offsetQ[1], entry.offsetQ[0]]),
  }));
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
