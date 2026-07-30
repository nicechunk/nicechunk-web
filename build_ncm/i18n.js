const STORAGE_KEY = "nicechunk.build_ncm.locale.v1";
const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = Object.freeze([
  Object.freeze({ key: "en", label: "EN", name: "English" }),
  Object.freeze({ key: "zh-Hans", label: "中文", name: "简体中文" }),
]);

const MESSAGES = Object.freeze({
  en: Object.freeze({
    "document.title": "BUILD_NCM — NiceChunk Building Compiler",
    "document.description": "NiceChunk static building compiler powered by chunk.js: build, compress and preview NCM blueprints for PDA storage.",
    "language.label": "Interface language",
    "intro.title": "Turn a building into compact on-chain code.",
    "intro.lede": "The reference building is reconstructed from canonical NiceChunk resources and production roof tiles. NCM3 stores bounded building commands and stable material IDs; after a player fetches it from a PDA, the same <code>chunk.js</code> expands it deterministically and compiles its bill of materials.",
    "view.grid": "Grid",
    "view.open": "Openings: Open",
    "view.glazed": "Openings: Glazed",
    "view.spin": "Auto Rotate",
    "view.reset": "Reset View",
    "view.canvasAria": "Three-dimensional building preview",
    "view.hint": "chunk.js software voxel renderer · drag to rotate · wheel to zoom",
    "view.title": "{building} · {style} Style",
    "library.title": "Building Library",
    "library.intro": "Browse by category, then select a building to load its blueprint, spatial preview, NCM payload, material counts and BOM.",
    "library.future": "CATEGORY INDEX · BLUEPRINTS LOAD ON DEMAND",
    "library.aria": "Available NCM buildings",
    "library.categoryAria": "Building categories",
    "library.categorySelectAria": "Browse {category}, {count} listed",
    "library.buildingsInCategoryAria": "Available buildings in {category}",
    "library.count": "{count} BUILDINGS",
    "library.categoryCount": "{count} LISTED",
    "library.selectAria": "Select {building}",
    "library.lazyReady": "Only the selected blueprint is loaded.",
    "library.loading": "Loading {building} blueprint…",
    "library.loaded": "{building} is ready.",
    "library.loadFailure": "Could not load the {building} blueprint. Try again.",
    "library.category.residential": "RESIDENTIAL",
    "library.category.civic": "CIVIC",
    "library.category.coastal": "COASTAL",
    "library.category.industrial": "INDUSTRIAL",
    "library.category.fortress": "FORTRESS",
    "library.cottage.name": "Hollow Cottage",
    "library.cottage.description": "A compact hollow residential shell with an open doorway and optional side glazing.",
    "library.seaside.name": "Sea Breeze Cottage",
    "library.seaside.description": "Raised coastal cottage with a wraparound deck, panoramic glazing, blue tile and an open entrance portal.",
    "library.warehouse.name": "Freight Warehouse",
    "library.warehouse.description": "Large hollow storehouse with twin open cargo bays, loading dock, clerestory glazing and a dark weather roof.",
    "library.castle.name": "Royal Blue Citadel",
    "library.castle.description": "Monumental four-tower castle with a broad open courtyard, layered inner ward, doorless gatehouse, hollow keep, blue tower tiles and heraldic banners.",
    "library.townHall.name": "Civic Town Hall",
    "library.townHall.description": "Large blue-tiled civic hall with an open entrance portal, glazed windows, crest, flag and entrance lamps.",
    "library.footprint": "FOOTPRINT",
    "library.height": "HEIGHT",
    "library.voxels": "VOXELS",
    "style.selectorAria": "Select an architectural material style",
    "style.rolesAria": "Current style material roles",
    "style.policy": "SAME GEOMETRY · CANONICAL MATERIAL IDS",
    "style.description.cottage": "Warm lime render, rustic stone, timber framing and terracotta tile.",
    "style.description.castle": "Regular stone masonry over a deep-stone base with a dark tiled roof.",
    "style.description.desert": "Sandstone footing, sun-dried adobe and a heat-reflective pale roof.",
    "style.description.coastal": "Lime-white walls, shell terrazzo and ice-blue glazing and roof tile.",
    "style.description.volcanic": "Heat-resistant basalt, ash concrete and reinforced dark glazing.",
    "style.description.modern": "Ash-concrete base, clean ceramic envelope and clear architectural glass.",
    "role.foundation": "Foundation",
    "role.wall": "Wall",
    "role.structure": "Frame",
    "role.glazing": "Glazing",
    "role.roof": "Roof",
    "role.floor": "Floor",
    "role.chimney": "Chimney",
    "role.detail": "Building Detail",
    "role.optional": "{role} · OPTIONAL",
    "roof.selectorAria": "Select a roof-tile material",
    "roof.variantAria": "{name}; source: {source}",
    "materials.usedAria": "Materials used by the current building",
    "code.title": "NCM Code",
    "code.ncm3": "NCM3 Shortest",
    "code.ncm2": "NCM2 Compatible",
    "code.recipe": "Command View",
    "code.editorAria": "Editable NCM code",
    "code.load": "Load",
    "code.loading": "Loading…",
    "code.copy": "Copy",
    "code.copied": "Copied",
    "code.loadHint": "Paste NCM3 code, then load it into the preview. Ctrl or Command + Enter also loads it.",
    "code.loadEmpty": "Paste NCM3 code before loading.",
    "code.loadRequiresNcm3": "Only NCM3 code can be loaded into this material-aware preview.",
    "code.loadTooLarge": "The pasted NCM3 code exceeds the 131,072-character safety limit.",
    "code.loadSuccess": "Loaded {voxels} voxels from pasted NCM3 code.",
    "code.loadFailure": "Could not load code: {message}",
    "code.downloadNcm": "Download .ncm",
    "code.downloadJson": "Export Expanded JSON",
    "code.calculating": "Calculating…",
    "code.metric.ncm3": "NCM3 raw payload",
    "code.metric.characters": "On-chain text characters",
    "code.metric.voxels": "Expanded voxels",
    "code.metric.saving": "Saving vs NCM2",
    "code.note.ncm3": "NCM3 uses stable material IDs and bounded building macros. Style changes are re-encoded deterministically for PDA storage.",
    "code.note.ncm2": "NCM2 is expanded and greedily merged into cuboids. It supports older clients, but preserves RGB rather than material semantics.",
    "code.note.recipe": "This command view is intended for auditing. Store the shorter raw NCM3 payload on chain.",
    "bom.title": "Construction Bill of Materials",
    "bom.export": "Export BOM",
    "bom.filterAria": "Filter bill of materials by construction phase",
    "bom.tableAria": "Estimated construction bill of materials",
    "bom.column.material": "Material / Phase",
    "bom.column.amount": "Amount",
    "bom.column.status": "Status",
    "bom.footnote": "The shared chunk.js BOM compiler derives this estimate deterministically from NCM material voxels. MU is one litre of material equivalent, CU is a standard component, and RU is a raw resource. Landscape items do not affect the structural availability rate.",
    "bom.summary.voxels": "Model voxels",
    "bom.summary.materials": "Material types",
    "bom.summary.roof": "Roof tile amount",
    "bom.summary.availability": "Craftable from current resources",
    "bom.summary.coverage": "Catalog coverage",
    "bom.summary.uncovered": "{count} uncovered",
    "bom.stage.available": "Available",
    "bom.stage.gated": "New ore required",
    "bom.item.resinMembrane": "Resin Waterproof Membrane",
    "bom.item.pineRoofFraming": "Pine Roof Framing",
    "phase.all": "All",
    "phase.site": "Site",
    "phase.foundation": "Foundation",
    "phase.structure": "Structure",
    "phase.envelope": "Envelope",
    "phase.roof": "Roof",
    "phase.openings": "Openings",
    "phase.finish": "Finish",
    "phase.landscape": "Landscape",
    "recipe.title": "Roof-tile Color Recipe",
    "recipe.current": "Current tile",
    "recipe.source": "Color source",
    "recipe.formula": "Crafting formula",
    "recipe.time": "Firing time",
    "recipe.yield": "Base yield",
    "recipe.voxels": "Roof voxels",
    "recipe.footnote": "Changing the tile selects a different formal material ID and immediately re-encodes NCM3. Its color comes from existing world resources, not a rendering filter.",
    "catalog.title": "Building Material Model Catalog",
    "catalog.intro": "Every preview uses the runtime material registry and the same procedural texture bake as the game. Geometry follows each component’s canonical shape and L × H × W dimensions; thin panels, rods, beams, slabs, bricks, logs and curved roof tiles are not normalized into cubes.",
    "catalog.openBakeLab": "OPEN BAKE LAB",
    "catalog.filterAria": "Building material model filters",
    "catalog.filter.current": "Current Style",
    "catalog.filter.used": "Used in Model",
    "catalog.filter.wood": "Wood",
    "catalog.filter.glazing": "Glass",
    "catalog.filter.masonry": "Masonry",
    "catalog.filter.finish": "Finish",
    "catalog.filter.roof": "Roof",
    "catalog.filter.all": "All 33",
    "catalog.footnote": "Canvas previews are static and event-driven. They create no WebGL context, no animation loop, and no Three.js dependency.",
    "catalog.production": "PRODUCTION",
    "catalog.placeholder": "PLACEHOLDER",
    "catalog.voxels": "{count} VOXELS",
    "catalog.source": "SOURCE",
    "catalog.recipe": "RECIPE",
    "catalog.process": "PROCESS",
    "catalog.noRecipe": "No production recipe registered",
    "catalog.processPending": "Construction process pending",
    "catalog.furnace": "Furnace",
    "catalog.workbench": "Workbench",
    "catalog.heatTier": "HEAT T{tier}",
    "catalog.toolTier": "TOOL T{tier}",
    "catalog.yield": "{value}% yield",
    "pda.title": "Fetch a Building from a PDA",
    "pda.description": "Supports the standard NCBP account header and experimental accounts that store NCM text directly. The reader verifies SHA-256 before replacing the current spatial preview.",
    "pda.placeholder": "Enter a building PDA address",
    "pda.load": "Fetch and Display",
    "pda.waiting": "Waiting for a PDA address.",
    "pda.enterAddress": "Enter a building PDA address first.",
    "pda.loading": "Reading the account and verifying its code…",
    "pda.requiresNcm3": "The spatial preview accepts NCM3 with material semantics. Download NCM2 for legacy clients.",
    "pda.successVerified": "Loaded successfully: hash verified, {bytes} bytes.",
    "pda.successRaw": "Loaded successfully: experimental raw payload, {bytes} bytes.",
    "pda.failure": "Load failed: {message}",
    "authority.title": "Store the Blueprint, Never Execute Scripts",
    "authority.deterministic": "<b>Deterministic:</b> fixed version, coordinates, material IDs and bounded commands.",
    "authority.auditable": "<b>Auditable:</b> no <code>eval</code>; a blueprint cannot access the network, wallet or DOM.",
    "authority.portable": "<b>Portable:</b> the NCM2 compatibility export can be decoded by existing NiceChunk clients.",
    "authority.verifiable": "<b>Verifiable:</b> the PDA stores a code hash that clients must compare after fetching.",
  }),
  "zh-Hans": Object.freeze({
    "document.title": "BUILD_NCM — NiceChunk 建筑编译器",
    "document.description": "NiceChunk 静态建筑编译器：使用 chunk.js 构建、压缩和预览可存入 PDA 的 NCM 建筑代码。",
    "language.label": "界面语言",
    "intro.title": "把建筑变成一段可以上链的代码。",
    "intro.lede": "参考建筑以 NiceChunk 现有资源和正式彩色瓦片重建。NCM3 保存受限的建筑指令与稳定材料 ID；玩家从 PDA 拉取后，由同一份 <code>chunk.js</code> 确定性展开并生成建造清单。",
    "view.grid": "网格",
    "view.open": "洞口：挖空",
    "view.glazed": "洞口：玻璃",
    "view.spin": "自动旋转",
    "view.reset": "复位视角",
    "view.canvasAria": "三维建筑预览",
    "view.hint": "chunk.js 软件体素渲染 · 拖动旋转 · 滚轮缩放",
    "view.title": "{building} · {style} 风格",
    "library.title": "建筑库",
    "library.intro": "先按分类浏览，再选择建筑；页面只在选中后加载蓝图、空间预览、NCM 载荷、材料统计和 BOM。",
    "library.future": "分类索引 · 蓝图按需加载",
    "library.aria": "可用的 NCM 建筑",
    "library.categoryAria": "建筑分类",
    "library.categorySelectAria": "浏览{category}，共 {count} 个建筑",
    "library.buildingsInCategoryAria": "{category}中的可用建筑",
    "library.count": "{count} 个建筑",
    "library.categoryCount": "{count} 个蓝图",
    "library.selectAria": "选择 {building}",
    "library.lazyReady": "当前只加载已选中的建筑蓝图。",
    "library.loading": "正在加载{building}蓝图…",
    "library.loaded": "{building}已就绪。",
    "library.loadFailure": "无法加载{building}蓝图，请重试。",
    "library.category.residential": "住宅",
    "library.category.civic": "市政",
    "library.category.coastal": "海岸",
    "library.category.industrial": "工业",
    "library.category.fortress": "堡垒",
    "library.cottage.name": "空心小屋",
    "library.cottage.description": "紧凑的空心住宅外壳，带开放门洞和可选侧墙玻璃。",
    "library.seaside.name": "海风小屋",
    "library.seaside.description": "架空海岸小屋，带环绕观景平台、宽幅玻璃、蓝瓦和开放门洞。",
    "library.warehouse.name": "货运仓库",
    "library.warehouse.description": "大型空心仓库，带双开放货运门洞、装卸平台、高窗和深色耐候屋顶。",
    "library.castle.name": "皇家蓝堡",
    "library.castle.description": "四角高塔大型城堡，包含宽阔开放内院、多层内堡、无门门楼、空心主堡、蓝色塔瓦与纹章旗帜。",
    "library.townHall.name": "市政厅",
    "library.townHall.description": "大型蓝瓦市政建筑，包含开放门洞、玻璃窗、市政徽记、旗帜和入口灯柱。",
    "library.footprint": "占地",
    "library.height": "高度",
    "library.voxels": "体素",
    "style.selectorAria": "选择建筑材料风格",
    "style.rolesAria": "当前风格材料角色",
    "style.policy": "相同几何 · 正式材料 ID",
    "style.description.cottage": "温暖石灰抹灰、乡村石材、木构和赤陶瓦。",
    "style.description.castle": "深石地基上的规整石砌体与深色瓦顶。",
    "style.description.desert": "砂岩地基、晒制土坯和反射热量的浅色屋顶。",
    "style.description.coastal": "石灰白墙、贝壳水磨石、冰蓝玻璃和屋瓦。",
    "style.description.volcanic": "耐热玄武岩、火山灰混凝土和增强深色玻璃。",
    "style.description.modern": "火山灰混凝土地基、整洁陶瓷围护和透明建筑玻璃。",
    "role.foundation": "地基",
    "role.wall": "墙体",
    "role.structure": "结构",
    "role.glazing": "玻璃",
    "role.roof": "屋顶",
    "role.floor": "地板",
    "role.chimney": "烟囱",
    "role.detail": "建筑细节",
    "role.optional": "{role} · 可选",
    "roof.selectorAria": "选择屋顶瓦片材料",
    "roof.variantAria": "{name}；来源：{source}",
    "materials.usedAria": "当前建筑使用的材料",
    "code.title": "NCM 代码",
    "code.ncm3": "NCM3 最短版",
    "code.ncm2": "NCM2 兼容版",
    "code.recipe": "指令预览",
    "code.editorAria": "可编辑的 NCM 代码",
    "code.load": "加载",
    "code.loading": "加载中…",
    "code.copy": "复制",
    "code.copied": "已复制",
    "code.loadHint": "粘贴 NCM3 代码后加载到预览；也可以按 Ctrl 或 Command + Enter。",
    "code.loadEmpty": "请先粘贴 NCM3 代码。",
    "code.loadRequiresNcm3": "当前材料语义预览仅支持加载 NCM3 代码。",
    "code.loadTooLarge": "粘贴的 NCM3 代码超过 131,072 字符安全上限。",
    "code.loadSuccess": "已从粘贴的 NCM3 代码加载 {voxels} 个体素。",
    "code.loadFailure": "代码加载失败：{message}",
    "code.downloadNcm": "下载 .ncm",
    "code.downloadJson": "导出展开 JSON",
    "code.calculating": "计算中…",
    "code.metric.ncm3": "NCM3 原始载荷",
    "code.metric.characters": "链上文本字符",
    "code.metric.voxels": "展开方块",
    "code.metric.saving": "相对 NCM2 节省",
    "code.note.ncm3": "NCM3 使用稳定材料 ID 与受限建筑宏；切换风格会确定性重编码，适合 PDA 存储。",
    "code.note.ncm2": "NCM2 已展开并做贪心长方体合并，兼容旧客户端，但只保留 RGB，不保留材料语义。",
    "code.note.recipe": "这是便于审计的指令视图；实际链上载荷应使用更短的 NCM3 原始二进制。",
    "bom.title": "建筑材料清单",
    "bom.export": "导出 BOM",
    "bom.filterAria": "按建造阶段筛选材料",
    "bom.tableAria": "建筑材料估算清单",
    "bom.column.material": "材料 / 阶段",
    "bom.column.amount": "用量",
    "bom.column.status": "状态",
    "bom.footnote": "估算由共享 chunk.js 根据 NCM 材料体素确定性生成；MU 为 1 L 等效材料，CU 为标准构件，RU 为原始资源。景观材料不计入主体建造率。",
    "bom.summary.voxels": "模型体素",
    "bom.summary.materials": "材料种类",
    "bom.summary.roof": "屋瓦用量",
    "bom.summary.availability": "现有资源可生产",
    "bom.summary.coverage": "清单覆盖",
    "bom.summary.uncovered": "{count} 未覆盖",
    "bom.stage.available": "现有资源",
    "bom.stage.gated": "需新增矿石",
    "bom.item.resinMembrane": "树脂防水膜",
    "bom.item.pineRoofFraming": "松木屋架",
    "phase.all": "全部",
    "phase.site": "场地",
    "phase.foundation": "地基",
    "phase.structure": "结构",
    "phase.envelope": "墙体",
    "phase.roof": "屋顶",
    "phase.openings": "门窗",
    "phase.finish": "饰面",
    "phase.landscape": "景观",
    "recipe.title": "瓦片染色配方",
    "recipe.current": "当前瓦片",
    "recipe.source": "颜色来源",
    "recipe.formula": "合成配方",
    "recipe.time": "烧制时间",
    "recipe.yield": "基础产率",
    "recipe.voxels": "屋顶体素",
    "recipe.footnote": "切换瓦片会改变正式材料 ID，并立即重新编码 NCM3；颜色来自现有世界资源，不是渲染滤镜。",
    "catalog.title": "建筑材料模型目录",
    "catalog.intro": "每个预览都使用运行时材料注册表和与游戏相同的程序化纹理烘焙。几何形状遵循构件的正式 shape 与 L × H × W 尺寸；薄面板、棒材、梁、板材、砖、原木和弧形瓦不会被统一成立方体。",
    "catalog.openBakeLab": "打开烘焙实验室",
    "catalog.filterAria": "建筑材料模型筛选",
    "catalog.filter.current": "当前风格",
    "catalog.filter.used": "模型用料",
    "catalog.filter.wood": "木构",
    "catalog.filter.glazing": "玻璃",
    "catalog.filter.masonry": "砌体",
    "catalog.filter.finish": "饰面",
    "catalog.filter.roof": "屋顶",
    "catalog.filter.all": "全部 33 项",
    "catalog.footnote": "Canvas 预览为静态事件驱动；不创建 WebGL 上下文、动画循环或 Three.js 依赖。",
    "catalog.production": "正式生产",
    "catalog.placeholder": "临时占位",
    "catalog.voxels": "{count} 体素",
    "catalog.source": "来源",
    "catalog.recipe": "配方",
    "catalog.process": "加工",
    "catalog.noRecipe": "尚未登记正式生产配方",
    "catalog.processPending": "建筑加工流程待定",
    "catalog.furnace": "熔炉",
    "catalog.workbench": "工作台",
    "catalog.heatTier": "热力 T{tier}",
    "catalog.toolTier": "工具 T{tier}",
    "catalog.yield": "产率 {value}%",
    "pda.title": "从 PDA 拉取建筑",
    "pda.description": "支持标准 NCBP 账户头，也兼容直接存放 NCM 文本的实验账户。读取后会校验 SHA-256，再替换当前空间预览。",
    "pda.placeholder": "输入建筑 PDA 地址",
    "pda.load": "读取并显示",
    "pda.waiting": "等待 PDA 地址。",
    "pda.enterAddress": "请先输入建筑 PDA 地址。",
    "pda.loading": "正在读取账户并校验代码…",
    "pda.requiresNcm3": "当前空间预览只接受保留材料语义的 NCM3；NCM2 可下载后交给旧客户端。",
    "pda.successVerified": "读取成功：哈希已验证，{bytes} bytes。",
    "pda.successRaw": "读取成功：实验裸载荷，{bytes} bytes。",
    "pda.failure": "读取失败：{message}",
    "authority.title": "链上只存蓝图，不执行脚本",
    "authority.deterministic": "<b>确定性：</b>固定版本、坐标、材料 ID 与有限指令集。",
    "authority.auditable": "<b>可审计：</b>不使用 <code>eval</code>，不允许蓝图发起网络、钱包或 DOM 操作。",
    "authority.portable": "<b>可迁移：</b>NCM2 兼容导出可被现有 NiceChunk 客户端直接解码。",
    "authority.verifiable": "<b>可验证：</b>PDA 保存代码哈希，客户端拉取后必须比对。",
  }),
});

let locale = DEFAULT_LOCALE;
let initialized = false;

export function initI18n(root = document) {
  locale = readStoredLocale();
  applyTranslations(root);
  if (!initialized) {
    initialized = true;
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-locale]");
      if (button) setLocale(button.dataset.locale);
    });
  }
  return locale;
}

export function getLocale() {
  return locale;
}

export function setLocale(nextLocale, { persist = true } = {}) {
  const normalized = normalizeLocale(nextLocale);
  if (normalized === locale) return locale;
  locale = normalized;
  if (persist) writeStoredLocale(locale);
  applyTranslations(document);
  window.dispatchEvent(new CustomEvent("buildncm:localechange", { detail: { locale } }));
  return locale;
}

export function onLocaleChange(listener) {
  const handler = (event) => listener(event.detail.locale);
  window.addEventListener("buildncm:localechange", handler);
  return () => window.removeEventListener("buildncm:localechange", handler);
}

export function t(key, variables = {}) {
  const template = MESSAGES[locale]?.[key] ?? MESSAGES.en[key] ?? key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
  ));
}

export function applyTranslations(root = document) {
  document.documentElement.lang = locale;
  document.title = t("document.title");
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = t("document.description");
  root.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = t(node.dataset.i18nHtml); });
  for (const attribute of ["aria-label", "placeholder", "title"]) {
    const dataName = `i18n${attribute.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => node.setAttribute(attribute, t(node.dataset[dataName])));
  }
  root.querySelectorAll("[data-locale]").forEach((button) => {
    const active = button.dataset.locale === locale;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function normalizeLocale(value) {
  const text = String(value ?? "");
  if (MESSAGES[text]) return text;
  if (text.toLowerCase().startsWith("zh")) return "zh-Hans";
  return DEFAULT_LOCALE;
}

function readStoredLocale() {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeStoredLocale(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}
