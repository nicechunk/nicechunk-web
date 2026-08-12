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

function windowBoxBloomMask({ nx, ny, nz }) {
  const stem = Math.abs(nx) <= 0.2 && Math.abs(nz) <= 0.2 && ny <= 0.35;
  const petals = ny >= -0.1 && (
    (Math.abs(nx) <= 0.28 && Math.abs(nz) <= 0.92)
    || (Math.abs(nx) <= 0.92 && Math.abs(nz) <= 0.28)
  );
  return stem || petals;
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
