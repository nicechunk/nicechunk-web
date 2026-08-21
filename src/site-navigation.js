export const SITE_NAVIGATION_ROUTES = Object.freeze([
  Object.freeze({ key: "world", href: "/world/", group: "primary" }),
  Object.freeze({ key: "technology", href: "/technology/", group: "primary" }),
  Object.freeze({ key: "create", href: "/create/", group: "primary" }),
  Object.freeze({ key: "docs", href: "/docs/", group: "primary" }),
  Object.freeze({ key: "roadmap", href: "/roadmap/", group: "secondary" }),
  Object.freeze({ key: "whitepaper", href: "/whitepaper/", group: "secondary" }),
  Object.freeze({ key: "github", href: "https://github.com/nicechunk", group: "secondary", external: true }),
  Object.freeze({ key: "whitelist", href: "/seed/", group: "secondary" }),
  Object.freeze({ key: "enterWorld", href: "/play/", group: "action" }),
]);

export const SITE_NAVIGATION_ALIASES = Object.freeze({
  "/civilization/": "/world/",
  "/world_rule/": "/world/",
  "/resource_rule/": "/world/",
  "/elements/": "/world/",
  "/ncm/": "/technology/",
  "/ncfm/": "/technology/",
  "/ncm_dna/": "/technology/",
  "/fairness/": "/technology/",
  "/proof-of-frontier/": "/technology/",
  "/guardian/": "/technology/",
  "/contracts/": "/technology/",
  "/trust/": "/technology/",
  "/miner/": "/create/",
  "/build_ncm/": "/create/",
  "/item_ncm/": "/create/",
  "/forging/": "/create/",
  "/ncm4/": "/create/",
  "/fourier-pickaxe/": "/create/",
  "/fourier-voxel/": "/create/",
});

export const SITE_NAVIGATION_LABELS = Object.freeze({
  en: Object.freeze({ world: "World", technology: "Technology", create: "Create", docs: "Docs", roadmap: "Roadmap", whitepaper: "Whitepaper", github: "GitHub", whitelist: "Whitelist", enterWorld: "Enter World" }),
  es: Object.freeze({ world: "Mundo", technology: "Tecnología", create: "Crear", docs: "Docs", roadmap: "Ruta", whitepaper: "Libro blanco", github: "GitHub", whitelist: "Lista de acceso", enterWorld: "Entrar al mundo" }),
  fr: Object.freeze({ world: "Monde", technology: "Technologie", create: "Créer", docs: "Docs", roadmap: "Feuille de route", whitepaper: "Livre blanc", github: "GitHub", whitelist: "Liste d’accès", enterWorld: "Entrer dans le monde" }),
  de: Object.freeze({ world: "Welt", technology: "Technologie", create: "Erstellen", docs: "Docs", roadmap: "Roadmap", whitepaper: "Whitepaper", github: "GitHub", whitelist: "Whitelist", enterWorld: "Welt betreten" }),
  ja: Object.freeze({ world: "世界", technology: "技術", create: "制作", docs: "ドキュメント", roadmap: "ロードマップ", whitepaper: "ホワイトペーパー", github: "GitHub", whitelist: "ホワイトリスト", enterWorld: "世界に入る" }),
  ru: Object.freeze({ world: "Мир", technology: "Технологии", create: "Создание", docs: "Документация", roadmap: "План", whitepaper: "Whitepaper", github: "GitHub", whitelist: "Вайтлист", enterWorld: "Войти в мир" }),
  ko: Object.freeze({ world: "세계", technology: "기술", create: "제작", docs: "문서", roadmap: "로드맵", whitepaper: "백서", github: "GitHub", whitelist: "허용 목록", enterWorld: "월드 입장" }),
  "zh-Hant": Object.freeze({ world: "世界", technology: "技術", create: "創作", docs: "文件", roadmap: "路線圖", whitepaper: "白皮書", github: "GitHub", whitelist: "白名單", enterWorld: "進入世界" }),
  "zh-Hans": Object.freeze({ world: "世界", technology: "技术", create: "创作", docs: "文档", roadmap: "路线图", whitepaper: "白皮书", github: "GitHub", whitelist: "白名单", enterWorld: "进入世界" }),
});

export function resolveSiteNavigationPath(path) {
  return SITE_NAVIGATION_ALIASES[path] || path;
}
