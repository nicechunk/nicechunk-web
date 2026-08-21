import {
  SITE_NAVIGATION_LABELS,
  SITE_NAVIGATION_ROUTES,
  resolveSiteNavigationPath,
} from "./site-navigation.js";

const loadingState = {
  active: false,
  autoFinish: true,
  value: 0,
  timer: 0,
};

export function startSiteLoading(value = 12) {
  ensureProgressBar();
  loadingState.active = true;
  loadingState.value = Math.max(loadingState.value, value);
  document.documentElement.classList.add("site-loading");
  updateProgressBar();
  if (!loadingState.timer) {
    loadingState.timer = window.setInterval(() => {
      if (!loadingState.active) return;
      const ceiling = loadingState.value < 68 ? 68 : 86;
      loadingState.value += Math.max(0.35, (ceiling - loadingState.value) * 0.045);
      updateProgressBar();
    }, 120);
  }
}

export function setSiteLoadingProgress(value) {
  ensureProgressBar();
  loadingState.value = Math.max(loadingState.value, Math.min(96, Number(value) || 0));
  updateProgressBar();
}

export function setSiteLoadingStage(value) {
  const stage = document.querySelector("[data-site-loading-stage]");
  if (stage && value) stage.textContent = String(value);
}

export function claimSiteLoading() {
  loadingState.autoFinish = false;
}

export function finishSiteLoading() {
  ensureProgressBar();
  loadingState.value = 100;
  updateProgressBar();
  window.setTimeout(() => {
    loadingState.active = false;
    loadingState.value = 0;
    document.documentElement.classList.remove("site-loading", "site-route-loading");
    const fill = document.querySelector(".site-loading-bar span");
    if (fill) fill.style.transform = "scaleX(0)";
    if (loadingState.timer) {
      window.clearInterval(loadingState.timer);
      loadingState.timer = 0;
    }
  }, 280);
}

function installSiteUi() {
  if (window.__nicechunkSiteUiInstalled) return;
  window.__nicechunkSiteUiInstalled = true;
  document.documentElement.classList.add("site-ui-ready");
  const usesSharedHeader = Boolean(document.querySelector("[data-site-header-root]"));
  if (!usesSharedHeader) ensureUnifiedNavigation();
  ensureUnifiedFooter();
  installUnifiedLanguageObserver();
  if (!usesSharedHeader) {
    installMobileMenu();
    installHeaderMetrics();
  }
  startSiteLoading(16);
  installRouteLoading();
  window.addEventListener("load", () => {
    updateHeaderMetrics();
    window.setTimeout(() => {
      if (loadingState.active && loadingState.autoFinish) finishSiteLoading();
    }, 900);
  });
}

const unifiedNavItems = SITE_NAVIGATION_ROUTES.filter((route) => route.group === "primary");
const unifiedSecondaryNavItems = SITE_NAVIGATION_ROUTES.filter((route) => route.group === "secondary");

const footerGroups = [
  {
    key: "worldGroup",
    links: [
      { key: "home", href: "/" },
      { key: "enterWorld", href: "/play/" },
      { key: "world", href: "/world/" },
      { key: "worldRules", href: "/world_rule/" },
      { key: "resources", href: "/resource_rule/" },
      { key: "elements", href: "/elements/" },
    ],
  },
  {
    key: "technologyGroup",
    links: [
      { key: "technology", href: "/technology/" },
      { key: "chunkjs", href: "/chunk.js/" },
      { key: "ncm", href: "/ncm/" },
      { key: "ncfm", href: "/ncfm/" },
      { key: "fairness", href: "/fairness/" },
      { key: "proof", href: "/proof-of-frontier/" },
      { key: "guardians", href: "/guardian/" },
      { key: "contracts", href: "/contracts/" },
      { key: "civilization", href: "/civilization/" },
      { key: "trust", href: "/trust/" },
    ],
  },
  {
    key: "createGroup",
    links: [
      { key: "create", href: "/create/" },
      { key: "buildNcm", href: "/build_ncm/" },
      { key: "itemNcm", href: "/item_ncm/" },
      { key: "ncm4", href: "/ncm4/" },
      { key: "forging", href: "/forging/" },
      { key: "miner", href: "/miner/" },
      { key: "fourierVoxel", href: "/fourier-voxel/" },
    ],
  },
  {
    key: "projectGroup",
    links: [
      { key: "roadmap", href: "/roadmap/" },
      { key: "docs", href: "/docs/" },
      { key: "whitepaper", href: "/whitepaper/" },
      { key: "whitelist", href: "/seed/" },
    ],
  },
];

const footerSocialLinks = [
  { key: "x", href: "https://x.com/nicechunk" },
  { key: "github", href: "https://github.com/nicechunk" },
];

const footerLabels = createFooterLabels();

const unifiedNavLabels = {
  en: {
    home: "Home",
    roadbook: "Roadbook",
    worldRules: "World Rules",
    resources: "Resources",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "Elements",
    fairness: "Fairness",
    proofOfFrontier: "Proof",
    seed: "Seed",
    guardians: "Guardians",
    contracts: "Contracts",
    civilization: "Civilization",
    trust: "Trust",
    whitepaper: "Whitepaper",
    docs: "Docs",
    miner: "Miner",
  },
  es: {
    home: "Inicio",
    roadbook: "Ruta",
    worldRules: "Reglas",
    resources: "Recursos",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "Elementos",
    fairness: "Equidad",
    proofOfFrontier: "Prueba",
    seed: "Semilla",
    guardians: "Guardianes",
    contracts: "Contratos",
    civilization: "Civilización",
    trust: "Confianza",
    whitepaper: "Whitepaper",
    docs: "Docs",
    miner: "Miner",
  },
  fr: {
    home: "Accueil",
    roadbook: "Route",
    worldRules: "Règles",
    resources: "Ressources",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "Éléments",
    fairness: "Équité",
    proofOfFrontier: "Preuve",
    seed: "Seed",
    guardians: "Gardiens",
    contracts: "Contrats",
    civilization: "Civilisation",
    trust: "Confiance",
    whitepaper: "Whitepaper",
    docs: "Docs",
    miner: "Mineur",
  },
  de: {
    home: "Home",
    roadbook: "Roadbook",
    worldRules: "Weltregeln",
    resources: "Ressourcen",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "Elemente",
    fairness: "Fairness",
    proofOfFrontier: "Proof",
    seed: "Seed",
    guardians: "Guardians",
    contracts: "Contracts",
    civilization: "Zivilisation",
    trust: "Trust",
    whitepaper: "Whitepaper",
    docs: "Docs",
    miner: "Miner",
  },
  ja: {
    home: "ホーム",
    roadbook: "ロードブック",
    worldRules: "世界ルール",
    resources: "資源",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "元素",
    fairness: "公平性",
    proofOfFrontier: "証明",
    seed: "Seed",
    guardians: "ガーディアン",
    contracts: "契約",
    civilization: "文明",
    trust: "信頼",
    whitepaper: "Whitepaper",
    docs: "ドキュメント",
    miner: "マイナー",
  },
  ru: {
    home: "Главная",
    roadbook: "План",
    worldRules: "Правила",
    resources: "Ресурсы",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "Элементы",
    fairness: "Честность",
    proofOfFrontier: "Доказательство",
    seed: "Seed",
    guardians: "Стражи",
    contracts: "Контракты",
    civilization: "Цивилизация",
    trust: "Доверие",
    whitepaper: "Whitepaper",
    docs: "Документы",
    miner: "Майнер",
  },
  ko: {
    home: "홈",
    roadbook: "로드북",
    worldRules: "월드 규칙",
    resources: "자원",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "원소",
    fairness: "공정성",
    proofOfFrontier: "증명",
    seed: "Seed",
    guardians: "가디언",
    contracts: "컨트랙트",
    civilization: "문명",
    trust: "신뢰",
    whitepaper: "Whitepaper",
    docs: "문서",
    miner: "마이너",
  },
  "zh-Hant": {
    home: "首頁",
    roadbook: "路書",
    worldRules: "世界規則",
    resources: "資源",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "元素",
    fairness: "公平性",
    proofOfFrontier: "證明",
    seed: "種子",
    guardians: "守護者",
    contracts: "合約",
    civilization: "文明",
    trust: "信任",
    whitepaper: "Whitepaper",
    docs: "文檔",
    miner: "礦工",
  },
  "zh-Hans": {
    home: "首页",
    roadbook: "路书",
    worldRules: "世界规则",
    resources: "资源",
    ncm: "NCM",
    ncfm: "NCFM",
    elements: "元素",
    fairness: "公平性",
    proofOfFrontier: "证明",
    seed: "种子",
    guardians: "守护者",
    contracts: "合约",
    civilization: "文明",
    trust: "信任",
    whitepaper: "Whitepaper",
    docs: "文档",
    miner: "矿工",
  },
};

function ensureUnifiedNavigation() {
  document.querySelectorAll(".site-header .nav-links").forEach((container) => {
    const existingLinks = new Map();
    container.querySelectorAll("a[href]").forEach((link) => {
      const path = normalizePath(link.getAttribute("href"));
      existingLinks.set(path, link);
    });

    const orderedLinks = unifiedNavItems.map((item) => {
      const path = normalizePath(item.href);
      const link = existingLinks.get(path) || document.createElement("a");
      link.href = item.href;
      link.dataset.siteNavKey = item.key;
      link.classList.toggle("active", isActiveNavPath(path));
      if (!link.textContent?.trim()) link.textContent = navLabel(item.key);
      return link;
    });

    container.replaceChildren(...orderedLinks);

    let secondary = container.parentElement?.querySelector(":scope > .nav-secondary");
    if (!secondary) {
      secondary = document.createElement("div");
      secondary.className = "nav-secondary";
      container.insertAdjacentElement("afterend", secondary);
    }
    secondary.replaceChildren(...unifiedSecondaryNavItems.map((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.dataset.siteNavKey = item.key;
      if (item.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.classList.toggle("active", isActiveNavPath(normalizePath(item.href)));
      }
      return link;
    }));
  });

  document.querySelectorAll(".site-header .nav-actions").forEach((container) => {
    const controls = [...container.children].filter((element) => element.tagName !== "A");
    let link = container.querySelector('a[href="/play/"], [data-site-nav-key="enterWorld"]');
    if (!link) link = document.createElement("a");
    link.href = "/play/";
    link.className = "header-action";
    link.dataset.siteNavKey = "enterWorld";
    link.classList.toggle("active", isActiveNavPath("/play/"));
    container.replaceChildren(...controls, link);
  });

  updateUnifiedNavigationLabels();
}

function ensureUnifiedFooter() {
  const existingFooters = [
    ...document.querySelectorAll(".nicechunk-site-footer, footer.site-footer, [data-site-footer-native]"),
  ];
  const footer = existingFooters.shift() || document.createElement("footer");
  existingFooters.forEach((duplicate) => duplicate.remove());
  footer.className = "site-footer nicechunk-site-footer";
  footer.dataset.ncUnifiedFooter = "true";
  footer.classList.toggle("nicechunk-site-footer-floating", isImmersiveFooterPage());

  const brand = createFooterBrand();
  const directory = document.createElement("div");
  directory.className = "nicechunk-footer-directory";
  directory.replaceChildren(...footerGroups.map(createFooterGroup));

  const socialNav = document.createElement("nav");
  socialNav.className = "nicechunk-footer-social";
  setFooterLabelKey(socialNav, "socialAria", { aria: true });
  socialNav.replaceChildren(
    ...footerSocialLinks.map((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      setFooterLabelKey(link, item.key, { aria: true, text: true });
      return link;
    }),
  );

  const communityHeading = document.createElement("h2");
  setFooterLabelKey(communityHeading, "communityGroup", { text: true });
  const community = document.createElement("section");
  community.className = "nicechunk-footer-group nicechunk-footer-community";
  community.append(communityHeading, socialNav);

  const meta = document.createElement("p");
  meta.className = "nicechunk-footer-meta";
  setFooterLabelKey(meta, "copyright", { text: true });

  const footerBar = document.createElement("div");
  footerBar.className = "nicechunk-footer-bar";
  footerBar.append(meta, community);

  footer.replaceChildren(brand, directory, footerBar);
  updateUnifiedFooterLabels(footer);

  const target = findFooterInsertionTarget();
  if (target === document.body) {
    if (footer.parentElement !== document.body) document.body.append(footer);
  } else if (footer.parentElement !== document.body || footer.previousElementSibling !== target) {
    target.insertAdjacentElement("afterend", footer);
  }
}

function createFooterGroup(group) {
  const section = document.createElement("section");
  section.className = "nicechunk-footer-group";

  const heading = document.createElement("h2");
  setFooterLabelKey(heading, group.key, { text: true });

  const navigation = document.createElement("nav");
  setFooterLabelKey(navigation, "navigationAria", { aria: true });
  navigation.replaceChildren(...group.links.map((item) => {
    const link = document.createElement("a");
    link.href = item.href;
    setFooterLabelKey(link, item.key, { text: true });
    return link;
  }));

  section.append(heading, navigation);
  return section;
}

function findFooterInsertionTarget() {
  const main = document.querySelector("main:last-of-type");
  if (!main) return document.body;
  let target = main;
  while (target.parentElement && target.parentElement !== document.body) {
    target = target.parentElement;
  }
  return target;
}

function createFooterBrand() {
  const wrapper = document.createElement("div");
  wrapper.className = "nicechunk-footer-brand";
  const link = document.createElement("a");
  link.className = "brand-mark";
  link.href = "/";
  link.setAttribute("aria-label", "NiceChunk");

  const image = document.createElement("img");
  image.src = "/media/nck.png";
  image.alt = "";

  const name = document.createElement("span");
  name.textContent = "NICECHUNK";

  const tagline = document.createElement("p");
  setFooterLabelKey(tagline, "tagline", { text: true });

  link.append(image, name);
  wrapper.append(link, tagline);
  return wrapper;
}

function setFooterLabelKey(element, key, { aria = false, text = false } = {}) {
  element.dataset.siteFooterKey = key;
  if (aria) element.dataset.siteFooterAria = "true";
  if (text) element.dataset.siteFooterText = "true";
}

function updateUnifiedFooterLabels(root = document) {
  const language = currentSiteLanguage();
  root.querySelectorAll("[data-site-footer-key]").forEach((element) => {
    const label = footerLabel(language, element.dataset.siteFooterKey);
    if (element.dataset.siteFooterText === "true") element.textContent = label;
    if (element.dataset.siteFooterAria === "true") element.setAttribute("aria-label", label);
  });
}

function footerLabel(language, key) {
  return footerLabels[language]?.[key] || footerLabels.en[key] || key;
}

function createFooterLabels() {
  const english = {
    navigationAria: "Footer navigation",
    socialAria: "NiceChunk social links",
    worldGroup: "World",
    technologyGroup: "Technology",
    createGroup: "Create",
    projectGroup: "Project",
    communityGroup: "Community",
    home: "Home",
    enterWorld: "Enter World",
    world: "World Overview",
    worldRules: "World Rules",
    resources: "Resource Rules",
    elements: "Elements",
    technology: "Technology Overview",
    chunkjs: "Chunk.js Engine",
    ncm: "NCM Compression",
    ncfm: "NCFM",
    fairness: "Fairness",
    proof: "Proof",
    guardians: "Guardians",
    contracts: "Contracts",
    civilization: "Civilization",
    trust: "Trust",
    create: "Create Hub",
    buildNcm: "Building NCM",
    itemNcm: "Item NCM",
    ncm4: "NCM4",
    forging: "Forging",
    miner: "Miner",
    fourierVoxel: "Fourier Voxel",
    roadmap: "Roadmap",
    docs: "Docs",
    whitepaper: "Whitepaper",
    whitelist: "Whitelist",
    x: "X",
    github: "GitHub",
    tagline: "A verifiable seeded voxel civilization on Solana.",
    copyright: "© 2026 NiceChunk. All rights reserved.",
  };

  const translations = {
    es: {
      navigationAria: "Navegación del pie de página",
      socialAria: "Enlaces sociales de NiceChunk",
      worldGroup: "Mundo",
      technologyGroup: "Tecnología",
      createGroup: "Crear",
      projectGroup: "Proyecto",
      communityGroup: "Comunidad",
      home: "Inicio",
      enterWorld: "Entrar al mundo",
      world: "Resumen del mundo",
      worldRules: "Reglas del mundo",
      resources: "Reglas de recursos",
      elements: "Elementos",
      technology: "Resumen tecnológico",
      chunkjs: "Motor Chunk.js",
      ncm: "Compresión NCM",
      fairness: "Equidad",
      proof: "Prueba",
      guardians: "Guardianes",
      contracts: "Contratos",
      civilization: "Civilización",
      trust: "Confianza",
      create: "Centro de creación",
      buildNcm: "NCM de edificios",
      itemNcm: "NCM de objetos",
      forging: "Forja",
      fourierVoxel: "Vóxel de Fourier",
      roadmap: "Ruta",
      docs: "Documentación",
      whitepaper: "Libro blanco",
      whitelist: "Lista de acceso",
      tagline: "Una civilización voxel verificable y sembrada en Solana.",
      copyright: "© 2026 NiceChunk. Todos los derechos reservados.",
    },
    fr: {
      navigationAria: "Navigation du pied de page",
      socialAria: "Liens sociaux NiceChunk",
      worldGroup: "Monde",
      technologyGroup: "Technologie",
      createGroup: "Créer",
      projectGroup: "Projet",
      communityGroup: "Communauté",
      home: "Accueil",
      enterWorld: "Entrer dans le monde",
      world: "Vue d’ensemble du monde",
      worldRules: "Règles du monde",
      resources: "Règles des ressources",
      elements: "Éléments",
      technology: "Vue d’ensemble technique",
      chunkjs: "Moteur Chunk.js",
      ncm: "Compression NCM",
      fairness: "Équité",
      proof: "Preuve",
      guardians: "Gardiens",
      contracts: "Contrats",
      civilization: "Civilisation",
      trust: "Confiance",
      create: "Atelier de création",
      buildNcm: "NCM de bâtiments",
      itemNcm: "NCM d’objets",
      forging: "Forge",
      fourierVoxel: "Voxel de Fourier",
      roadmap: "Feuille de route",
      docs: "Documentation",
      whitepaper: "Livre blanc",
      whitelist: "Liste d’accès",
      tagline: "Une civilisation voxel vérifiable et déterminée sur Solana.",
      copyright: "© 2026 NiceChunk. Tous droits réservés.",
    },
    de: {
      navigationAria: "Fußzeilennavigation",
      socialAria: "NiceChunk Social-Links",
      worldGroup: "Welt",
      technologyGroup: "Technologie",
      createGroup: "Erstellen",
      projectGroup: "Projekt",
      communityGroup: "Community",
      home: "Startseite",
      enterWorld: "Welt betreten",
      world: "Weltübersicht",
      worldRules: "Weltregeln",
      resources: "Ressourcenregeln",
      elements: "Elemente",
      technology: "Technologieübersicht",
      chunkjs: "Chunk.js-Engine",
      ncm: "NCM-Kompression",
      fairness: "Fairness",
      proof: "Nachweis",
      guardians: "Wächter",
      contracts: "Verträge",
      civilization: "Zivilisation",
      trust: "Vertrauen",
      create: "Erstellungszentrum",
      buildNcm: "Gebäude-NCM",
      itemNcm: "Objekt-NCM",
      forging: "Schmieden",
      fourierVoxel: "Fourier-Voxel",
      roadmap: "Roadmap",
      docs: "Dokumentation",
      whitepaper: "Whitepaper",
      whitelist: "Whitelist",
      tagline: "Eine verifizierbare, deterministische Voxel-Zivilisation auf Solana.",
      copyright: "© 2026 NiceChunk. Alle Rechte vorbehalten.",
    },
    ja: {
      navigationAria: "フッターナビゲーション",
      socialAria: "NiceChunk ソーシャルリンク",
      worldGroup: "世界",
      technologyGroup: "技術",
      createGroup: "制作",
      projectGroup: "プロジェクト",
      communityGroup: "コミュニティ",
      home: "ホーム",
      enterWorld: "世界に入る",
      world: "世界概要",
      worldRules: "世界ルール",
      resources: "資源ルール",
      elements: "元素",
      technology: "技術概要",
      chunkjs: "Chunk.js エンジン",
      ncm: "NCM 圧縮",
      fairness: "公平性",
      proof: "証明",
      guardians: "ガーディアン",
      contracts: "コントラクト",
      civilization: "文明",
      trust: "信頼",
      create: "制作ハブ",
      buildNcm: "建築 NCM",
      itemNcm: "アイテム NCM",
      forging: "鍛造",
      fourierVoxel: "フーリエ・ボクセル",
      roadmap: "ロードマップ",
      docs: "ドキュメント",
      whitepaper: "ホワイトペーパー",
      whitelist: "ホワイトリスト",
      tagline: "Solana 上の検証可能なシード型ボクセル文明。",
      copyright: "© 2026 NiceChunk. All rights reserved.",
    },
    ru: {
      navigationAria: "Навигация в подвале",
      socialAria: "Социальные ссылки NiceChunk",
      worldGroup: "Мир",
      technologyGroup: "Технологии",
      createGroup: "Создание",
      projectGroup: "Проект",
      communityGroup: "Сообщество",
      home: "Главная",
      enterWorld: "Войти в мир",
      world: "Обзор мира",
      worldRules: "Правила мира",
      resources: "Правила ресурсов",
      elements: "Элементы",
      technology: "Обзор технологий",
      chunkjs: "Движок Chunk.js",
      ncm: "Сжатие NCM",
      fairness: "Честность",
      proof: "Доказательство",
      guardians: "Стражи",
      contracts: "Контракты",
      civilization: "Цивилизация",
      trust: "Доверие",
      create: "Центр создания",
      buildNcm: "NCM зданий",
      itemNcm: "NCM предметов",
      forging: "Ковка",
      fourierVoxel: "Воксели Фурье",
      roadmap: "План",
      docs: "Документация",
      whitepaper: "Whitepaper",
      whitelist: "Вайтлист",
      tagline: "Проверяемая детерминированная воксельная цивилизация на Solana.",
      copyright: "© 2026 NiceChunk. Все права защищены.",
    },
    ko: {
      navigationAria: "바닥글 탐색",
      socialAria: "NiceChunk 소셜 링크",
      worldGroup: "세계",
      technologyGroup: "기술",
      createGroup: "제작",
      projectGroup: "프로젝트",
      communityGroup: "커뮤니티",
      home: "홈",
      enterWorld: "월드 입장",
      world: "월드 개요",
      worldRules: "월드 규칙",
      resources: "자원 규칙",
      elements: "원소",
      technology: "기술 개요",
      chunkjs: "Chunk.js 엔진",
      ncm: "NCM 압축",
      fairness: "공정성",
      proof: "증명",
      guardians: "가디언",
      contracts: "컨트랙트",
      civilization: "문명",
      trust: "신뢰",
      create: "제작 허브",
      buildNcm: "건축 NCM",
      itemNcm: "아이템 NCM",
      forging: "단조",
      fourierVoxel: "푸리에 복셀",
      roadmap: "로드맵",
      docs: "문서",
      whitepaper: "백서",
      whitelist: "허용 목록",
      tagline: "Solana 위에서 검증 가능한 시드 기반 복셀 문명.",
      copyright: "© 2026 NiceChunk. 모든 권리 보유.",
    },
    "zh-Hant": {
      navigationAria: "頁尾導覽",
      socialAria: "NiceChunk 社群連結",
      worldGroup: "世界",
      technologyGroup: "技術",
      createGroup: "創作",
      projectGroup: "專案",
      communityGroup: "社群",
      home: "首頁",
      enterWorld: "進入世界",
      world: "世界總覽",
      worldRules: "世界規則",
      resources: "資源規則",
      elements: "元素",
      technology: "技術總覽",
      chunkjs: "Chunk.js 引擎",
      ncm: "NCM 壓縮",
      fairness: "公平性",
      proof: "證明",
      guardians: "守護者",
      contracts: "合約",
      civilization: "文明",
      trust: "信任",
      create: "創作中心",
      buildNcm: "建築 NCM",
      itemNcm: "物品 NCM",
      forging: "鍛造",
      fourierVoxel: "傅立葉體素",
      roadmap: "路線圖",
      docs: "文件",
      whitepaper: "白皮書",
      whitelist: "白名單",
      tagline: "Solana 上可驗證的種子體素文明。",
      copyright: "© 2026 NiceChunk. 保留所有權利。",
    },
    "zh-Hans": {
      navigationAria: "页脚导航",
      socialAria: "NiceChunk 社交链接",
      worldGroup: "世界",
      technologyGroup: "技术",
      createGroup: "创作",
      projectGroup: "项目",
      communityGroup: "社区",
      home: "首页",
      enterWorld: "进入世界",
      world: "世界总览",
      worldRules: "世界规则",
      resources: "资源规则",
      elements: "元素",
      technology: "技术总览",
      chunkjs: "Chunk.js 引擎",
      ncm: "NCM 压缩",
      fairness: "公平性",
      proof: "证明",
      guardians: "守护者",
      contracts: "合约",
      civilization: "文明",
      trust: "信任",
      create: "创作中心",
      buildNcm: "建筑 NCM",
      itemNcm: "物品 NCM",
      forging: "锻造",
      fourierVoxel: "傅里叶体素",
      roadmap: "路线图",
      docs: "文档",
      whitepaper: "白皮书",
      whitelist: "白名单",
      tagline: "Solana 上可验证的种子体素文明。",
      copyright: "© 2026 NiceChunk. 保留所有权利。",
    },
  };

  return Object.freeze(Object.fromEntries(
    Object.entries({ en: {}, ...translations }).map(([language, overrides]) => [
      language,
      Object.freeze({ ...english, ...overrides }),
    ]),
  ));
}

function currentSiteLanguage() {
  return normalizeSiteLanguage(
    document.documentElement.lang || window.localStorage?.getItem("nicechunk.language") || navigator.language,
  );
}

function installUnifiedLanguageObserver() {
  if (!("MutationObserver" in window) || window.__nicechunkNavLanguageObserver) return;
  const observer = new MutationObserver(() => {
    updateUnifiedNavigationLabels();
    updateUnifiedFooterLabels();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  window.__nicechunkNavLanguageObserver = observer;
}

function isImmersiveFooterPage() {
  return ["/play/", "/mining/", "/forging/", "/player_set/"].includes(normalizePath(window.location.pathname));
}

function updateUnifiedNavigationLabels() {
  document.querySelectorAll("[data-site-nav-key]").forEach((link) => {
    link.textContent = navLabel(link.dataset.siteNavKey);
    const url = new URL(link.getAttribute("href") || "/", window.location.origin);
    link.classList.toggle("active", url.origin === window.location.origin && isActiveNavPath(normalizePath(url.href)));
  });
}

function navLabel(key) {
  const language = normalizeSiteLanguage(
    document.documentElement.lang || window.localStorage?.getItem("nicechunk.language") || navigator.language,
  );
  return SITE_NAVIGATION_LABELS[language]?.[key]
    || SITE_NAVIGATION_LABELS.en[key]
    || unifiedNavLabels[language]?.[key]
    || unifiedNavLabels.en[key]
    || key;
}

function normalizeSiteLanguage(language) {
  if (!language) return "en";
  if (language === "zh" || language === "zh-CN" || language === "zh-SG") return "zh-Hans";
  if (language === "zh-TW" || language === "zh-HK" || language === "zh-MO") return "zh-Hant";
  if (unifiedNavLabels[language]) return language;
  const base = language.split("-")[0];
  return unifiedNavLabels[base] ? base : "en";
}

function normalizePath(href) {
  const url = new URL(href || "/", window.location.origin);
  if (url.pathname === "/index.html") return "/";
  if (url.pathname === "/") return "/";
  return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}

function isActiveNavPath(path) {
  const current = normalizePath(window.location.pathname);
  const activePath = resolveSiteNavigationPath(current);
  return path === "/" ? activePath === "/" : activePath === path || activePath.startsWith(path);
}

function installMobileMenu() {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".site-nav, .top-nav");
  if (!header || !nav || header.querySelector(".site-menu-toggle")) return;

  if (!nav.id) {
    nav.id = "sitePrimaryNav";
  }

  const button = document.createElement("button");
  button.className = "site-menu-toggle";
  button.type = "button";
  button.setAttribute("aria-label", "Menu");
  button.setAttribute("aria-controls", nav.id);
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<span></span><span></span><span></span>';
  const mobileEnter = document.createElement("a");
  mobileEnter.className = "site-mobile-enter";
  mobileEnter.href = "/play/";
  mobileEnter.dataset.siteNavKey = "enterWorld";
  mobileEnter.textContent = navLabel("enterWorld");
  header.insertBefore(mobileEnter, nav);
  header.insertBefore(button, nav);

  const closeButton = document.createElement("button");
  closeButton.className = "site-menu-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close menu");
  closeButton.innerHTML = '<span></span><span></span>';
  nav.prepend(closeButton);

  button.addEventListener("click", () => {
    const open = !header.classList.contains("mobile-menu-open");
    setMobileMenuOpen(open);
  });

  closeButton.addEventListener("click", () => {
    setMobileMenuOpen(false);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest?.("a[href]")) {
      setMobileMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      setMobileMenuOpen(false);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!header.classList.contains("mobile-menu-open")) return;
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    if (event.target.closest?.(".site-nav, .top-nav, .site-menu-toggle")) return;
    setMobileMenuOpen(false);
  });

  window.addEventListener("resize", () => {
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    if (!mobile || !header.classList.contains("mobile-menu-open")) {
      setMobileMenuOpen(false, { restoreFocus: false });
    }
  }, { passive: true });

  setMobileMenuOpen(false, { restoreFocus: false });
}

function setMobileMenuOpen(open, { restoreFocus = true } = {}) {
  const header = document.querySelector(".site-header");
  const button = header?.querySelector(".site-menu-toggle");
  const nav = header?.querySelector(".site-nav, .top-nav");
  if (!header || !button || !nav) return;
  const wasOpen = header.classList.contains("mobile-menu-open");
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  if (!open && wasOpen && mobile && restoreFocus && nav.contains(document.activeElement)) {
    button.focus();
  }
  header.classList.toggle("mobile-menu-open", open);
  document.documentElement.classList.toggle("site-mobile-menu-open", open);
  button.setAttribute("aria-expanded", open ? "true" : "false");
  if (mobile && !open) {
    nav.setAttribute("aria-hidden", "true");
    nav.setAttribute("inert", "");
  } else {
    nav.removeAttribute("aria-hidden");
    nav.removeAttribute("inert");
  }
  window.setTimeout(updateHeaderMetrics, 40);
  window.setTimeout(updateHeaderMetrics, 180);
}

function installHeaderMetrics() {
  updateHeaderMetrics();
  window.addEventListener("resize", updateHeaderMetrics, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(updateHeaderMetrics, 80);
    window.setTimeout(updateHeaderMetrics, 260);
  });

  if ("ResizeObserver" in window) {
    const header = document.querySelector(".site-header");
    if (header) {
      const observer = new ResizeObserver(updateHeaderMetrics);
      observer.observe(header);
      window.__nicechunkHeaderObserver = observer;
    }
  }

  window.setTimeout(updateHeaderMetrics, 120);
  window.setTimeout(updateHeaderMetrics, 500);
}

function updateHeaderMetrics() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const height = Math.ceil(header.getBoundingClientRect().height || 0);
  if (!height) return;
  document.documentElement.style.setProperty("--nc-site-header-px", `${height}px`);

  const toggle = header.querySelector(".site-menu-toggle");
  if (toggle) {
    const headerRect = header.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const styles = window.getComputedStyle(header);
    const bottomPadding = Number.parseFloat(styles.paddingBottom) || 0;
    const topbarHeight = Math.ceil(toggleRect.bottom - headerRect.top + bottomPadding);
    if (topbarHeight) {
      document.documentElement.style.setProperty("--nc-site-topbar-px", `${topbarHeight}px`);
    }
  }
}

function installRouteLoading() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link || !link.closest(".site-nav, .top-nav")) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;

    event.preventDefault();
    markActiveLink(link);
    document.documentElement.classList.add("site-route-loading");
    startSiteLoading(24);
    setSiteLoadingProgress(42);
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 80);
  });
}

function markActiveLink(activeLink) {
  activeLink.closest(".site-nav, .top-nav")?.querySelectorAll("a.active").forEach((link) => {
    link.classList.remove("active");
  });
  activeLink.classList.add("active");
}

function ensureProgressBar() {
  if (document.querySelector(".site-loading-bar")) return;
  const bar = document.createElement("div");
  bar.className = "site-loading-bar";
  bar.setAttribute("aria-hidden", "true");
  bar.innerHTML = "<span></span>";
  document.body?.prepend(bar);
}

function updateProgressBar() {
  const clampedValue = Math.max(0, Math.min(100, loadingState.value));
  const fill = document.querySelector(".site-loading-bar span");
  if (fill) fill.style.transform = `scaleX(${clampedValue / 100})`;
  document.querySelectorAll("[data-site-loading-progress]").forEach((loader) => {
    const roundedValue = Math.round(clampedValue);
    loader.style.setProperty("--site-loading-ratio", String(clampedValue / 100));
    loader.setAttribute("aria-valuenow", String(roundedValue));
    loader.setAttribute("aria-busy", String(roundedValue < 100));
    const percent = loader.querySelector("[data-site-loading-percent]");
    if (percent) percent.textContent = `${roundedValue}%`;
  });
}

installSiteUi();
