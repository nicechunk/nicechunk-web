export const BUILDING_LIBRARY_POLICY = Object.freeze({
  embeddedDoorLeaves: false,
  entranceRule: "Blueprints keep entrance portals open; players place door items separately.",
});

export const BUILDING_DEFINITION_LOCALES = Object.freeze([
  "en",
  "es",
  "fr",
  "de",
  "ja",
  "ru",
  "ko",
  "zh-Hant",
  "zh-Hans",
]);

const BUILDING_CATALOG_URL = new URL("./building-catalog.json", import.meta.url);
const CATALOG_SCHEMA = "nicechunk.building-catalog.v1";
const BUILDING_SCHEMA = "nicechunk.ncm-building.v1";
const BUILDING_PATH = /^buildings\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
const BUILDING_ASSET_PATH = /^concepts\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|jpe?g|webp)$/;
const definitionPromises = new Map();

export async function loadBuildingCatalog({ signal } = {}) {
  const response = await fetch(BUILDING_CATALOG_URL, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`Building catalog request failed with HTTP ${response.status}.`);
  const source = await response.json();
  if (source?.schema !== CATALOG_SCHEMA || !Array.isArray(source.buildings)) {
    throw new TypeError("Invalid building catalog JSON.");
  }

  const keys = new Set();
  const files = new Set();
  const entries = source.buildings.map((file, index) => {
    if (typeof file !== "string" || files.has(file)) throw new TypeError(`Invalid building catalog filename at index ${index}.`);
    const match = BUILDING_PATH.exec(file);
    if (!match) throw new TypeError(`Unsafe building catalog filename: ${file}`);
    const [, category, key] = match;
    if (keys.has(key)) throw new TypeError(`Duplicate building key in catalog: ${key}`);
    files.add(file);
    keys.add(key);
    return Object.freeze({
      key,
      category,
      file,
      label: titleFromSlug(key),
    });
  });
  if (!entries.length) throw new TypeError("Building catalog must contain at least one filename.");

  const categories = [];
  const categoryKeys = new Set();
  for (const entry of entries) {
    if (categoryKeys.has(entry.category)) continue;
    categoryKeys.add(entry.category);
    categories.push(Object.freeze({
      key: entry.category,
      nameKey: `library.category.${entry.category}`,
      label: titleFromSlug(entry.category),
    }));
  }

  return Object.freeze({
    schema: source.schema,
    entries: Object.freeze(entries),
    categories: Object.freeze(categories),
    byKey: Object.freeze(Object.fromEntries(entries.map((entry) => [entry.key, entry]))),
  });
}

export function buildingCatalogEntry(catalog, value) {
  const entry = typeof value === "object" ? value : catalog?.byKey?.[String(value)];
  if (!entry || catalog?.byKey?.[entry.key] !== entry) throw new Error(`Unknown building catalog entry: ${value}`);
  return entry;
}

export function buildingsInCategory(catalog, categoryOrKey) {
  const key = typeof categoryOrKey === "object" ? categoryOrKey?.key : String(categoryOrKey);
  if (!catalog?.categories?.some((entry) => entry.key === key)) throw new Error(`Unknown building category: ${key}`);
  return catalog.entries.filter((entry) => entry.category === key);
}

export async function loadBuildingDefinition(catalogEntry, { signal } = {}) {
  const entry = catalogEntry;
  let promise = definitionPromises.get(entry.file);
  if (!promise) {
    promise = fetch(new URL(entry.file, BUILDING_CATALOG_URL), { signal, cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Building JSON request failed with HTTP ${response.status}.`);
        return validateBuildingDefinition(await response.json(), entry);
      });
    definitionPromises.set(entry.file, promise);
  }
  try {
    return await promise;
  } catch (error) {
    if (definitionPromises.get(entry.file) === promise) definitionPromises.delete(entry.file);
    throw error;
  }
}

export function localizedBuildingText(building, field, locale) {
  const values = building?.[field];
  if (!values || typeof values !== "object") return "";
  return values[locale] ?? values.en ?? "";
}

function validateBuildingDefinition(source, catalogEntry) {
  if (!source || typeof source !== "object" || Array.isArray(source) || source.schema !== BUILDING_SCHEMA) {
    throw new TypeError(`Invalid building JSON for ${catalogEntry.key}.`);
  }
  if (source.key !== catalogEntry.key || source.category !== catalogEntry.category) {
    throw new TypeError(`Building JSON identity does not match ${catalogEntry.file}.`);
  }
  const titles = localizedTextMap(source.titles, "titles", source.key);
  const descriptions = localizedTextMap(source.descriptions, "descriptions", source.key);
  const kind = typeof source.kind === "string" && source.kind.trim() ? source.kind.trim() : "habitable-building";
  const referenceImage = source.referenceImage == null ? "" : String(source.referenceImage);
  if (referenceImage && !BUILDING_ASSET_PATH.test(referenceImage)) {
    throw new TypeError(`Building ${source.key} has an unsafe reference image path.`);
  }
  const defaults = source.defaults;
  if (!defaults || typeof defaults.style !== "string" || typeof defaults.roof !== "string" || typeof defaults.glazed !== "boolean") {
    throw new TypeError(`Building ${source.key} has invalid defaults.`);
  }
  const access = normalizeAccess(source.access, kind, source.key);
  const doorOpening = source.doorOpening ?? (access.enterable ? "open" : "not-applicable");
  if (access.enterable && doorOpening !== "open") {
    throw new TypeError(`Enterable building ${source.key} must keep its entrance portal open.`);
  }
  if (!access.enterable && !["open", "not-applicable"].includes(doorOpening)) {
    throw new TypeError(`Surface object ${source.key} has an invalid door-opening policy.`);
  }
  const capabilities = normalizeCapabilities(source.capabilities, defaults, source.key);
  for (const field of ["footprint", "height", "referenceScale"]) {
    if (typeof source[field] !== "string" || !source[field].trim()) throw new TypeError(`Building ${source.key} has invalid ${field}.`);
  }

  const preview = source.preview ?? {};
  for (const field of ["fitScale", "minScale", "yaw"]) {
    if (preview[field] != null && (!Number.isFinite(preview[field]) || preview[field] <= 0)) {
      throw new TypeError(`Building ${source.key} has invalid preview.${field}.`);
    }
  }

  const extraMaterials = (source.extraMaterials ?? []).map((item, index) => {
    if (!Number.isInteger(item?.materialId) || item.materialId <= 0 || typeof item.phase !== "string" || typeof item.label !== "string") {
      throw new TypeError(`Building ${source.key} has invalid extra material ${index}.`);
    }
    return Object.freeze({ materialId: item.materialId, phase: item.phase, label: item.label });
  });

  const ncm = source.ncm;
  if (ncm?.format !== "NCM3_ROLE_TEMPLATE" || typeof ncm.code !== "string" || !ncm.code.startsWith("NCM3:")) {
    throw new TypeError(`Building ${source.key} has invalid NCM template data.`);
  }
  if (ncm.code.length > 131072) throw new TypeError(`Building ${source.key} NCM template exceeds the safety limit.`);
  const materialRoles = ncm.materialRoles;
  const requiredRoles = ["foundation", "wall", "structure", "glazing", "roof", "floor", "chimney"];
  if (!materialRoles || requiredRoles.some((role) => !Number.isInteger(materialRoles[role]))) {
    throw new TypeError(`Building ${source.key} has invalid material-role placeholders.`);
  }
  if (new Set(requiredRoles.map((role) => materialRoles[role])).size !== requiredRoles.length) {
    throw new TypeError(`Building ${source.key} material-role placeholders must be unique.`);
  }

  return Object.freeze({
    schema: source.schema,
    key: source.key,
    category: source.category,
    kind,
    titles,
    descriptions,
    referenceImage,
    defaults: Object.freeze({ ...defaults }),
    capabilities,
    access,
    doorOpening,
    footprint: source.footprint,
    height: source.height,
    referenceScale: source.referenceScale,
    preview: Object.freeze({ ...preview }),
    extraMaterials: Object.freeze(extraMaterials),
    ncm: Object.freeze({
      format: ncm.format,
      code: ncm.code,
      materialRoles: Object.freeze({ ...materialRoles }),
    }),
  });
}

function normalizeCapabilities(value, defaults, buildingKey) {
  const source = value ?? {};
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError(`Building ${buildingKey} has invalid capabilities.`);
  }
  const capabilities = {
    styles: source.styles ?? true,
    roofVariants: source.roofVariants ?? true,
    glazing: source.glazing ?? true,
  };
  if (Object.values(capabilities).some((enabled) => typeof enabled !== "boolean")) {
    throw new TypeError(`Building ${buildingKey} capabilities must be boolean.`);
  }
  if (!capabilities.glazing && defaults.glazed) {
    throw new TypeError(`Building ${buildingKey} cannot enable glazing by default.`);
  }
  return Object.freeze(capabilities);
}

function normalizeAccess(value, kind, buildingKey) {
  const source = value ?? {};
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError(`Building ${buildingKey} has invalid access metadata.`);
  }
  const enterable = source.enterable ?? kind === "habitable-building";
  const maxStepRise = source.maxStepRise ?? (enterable ? 2 : 0);
  if (typeof enterable !== "boolean" || !Number.isInteger(maxStepRise) || maxStepRise < 0 || maxStepRise > 2) {
    throw new TypeError(`Building ${buildingKey} has invalid player-access limits.`);
  }
  return Object.freeze({ enterable, maxStepRise });
}

function localizedTextMap(value, field, buildingKey) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Building ${buildingKey} has invalid ${field}.`);
  }
  const normalized = {};
  for (const locale of BUILDING_DEFINITION_LOCALES) {
    if (typeof value[locale] !== "string" || !value[locale].trim()) {
      throw new TypeError(`Building ${buildingKey} ${field} are missing ${locale}.`);
    }
    normalized[locale] = value[locale].trim();
  }
  return Object.freeze(normalized);
}

function titleFromSlug(value) {
  return value.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
