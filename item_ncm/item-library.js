export const ITEM_DEFINITION_LOCALES = Object.freeze([
  "en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans",
]);

const CATALOG_URL = new URL("./json/catalog.json", import.meta.url);
const CATALOG_SCHEMA = "nicechunk.ncf-item-catalog.v1";
const ITEM_SCHEMA = "nicechunk.ncf-item.v1";
const ITEM_PATH = /^json\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/;
const definitionPromises = new Map();

export async function loadItemCatalog({ signal } = {}) {
  const response = await fetch(CATALOG_URL, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`Item catalog request failed with HTTP ${response.status}.`);
  const source = await response.json();
  if (source?.schema !== CATALOG_SCHEMA || !Array.isArray(source.items)) throw new TypeError("Invalid item catalog JSON.");

  const keys = new Set();
  const files = new Set();
  const entries = source.items.map((file, index) => {
    if (typeof file !== "string" || files.has(file)) throw new TypeError(`Invalid item catalog filename at index ${index}.`);
    const match = ITEM_PATH.exec(file);
    if (!match) throw new TypeError(`Unsafe item catalog filename: ${file}`);
    const [, category, key] = match;
    if (keys.has(key)) throw new TypeError(`Duplicate item key in catalog: ${key}`);
    files.add(file);
    keys.add(key);
    return Object.freeze({ key, category, file, label: titleFromSlug(key) });
  });
  if (!entries.length) throw new TypeError("Item catalog must contain at least one filename.");

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
    version: source.version,
    entries: Object.freeze(entries),
    categories: Object.freeze(categories),
    byKey: Object.freeze(Object.fromEntries(entries.map((entry) => [entry.key, entry]))),
  });
}

export function itemsInCategory(catalog, categoryOrKey) {
  const key = typeof categoryOrKey === "object" ? categoryOrKey?.key : String(categoryOrKey);
  if (!catalog?.categories?.some((entry) => entry.key === key)) throw new Error(`Unknown item category: ${key}`);
  return catalog.entries.filter((entry) => entry.category === key);
}

export async function loadItemDefinition(catalogEntry, { signal } = {}) {
  const entry = catalogEntry;
  let promise = definitionPromises.get(entry.file);
  if (!promise) {
    promise = fetch(new URL(entry.file.replace(/^json\//, "./json/"), import.meta.url), { signal, cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Item JSON request failed with HTTP ${response.status}.`);
        return validateItemDefinition(await response.json(), entry);
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

export function localizedItemText(item, field, locale) {
  const values = item?.[field];
  if (!values || typeof values !== "object") return "";
  return values[locale] ?? values.en ?? "";
}

function validateItemDefinition(source, entry) {
  if (!source || typeof source !== "object" || Array.isArray(source) || source.schema !== ITEM_SCHEMA) {
    throw new TypeError(`Invalid item JSON for ${entry.key}.`);
  }
  if (source.key !== entry.key || source.category !== entry.category) throw new TypeError(`Item JSON identity does not match ${entry.file}.`);
  if (!["tool", "placeable"].includes(source.interaction)) throw new TypeError(`Item ${source.key} has an invalid interaction mode.`);
  const names = localizedTextMap(source.names, "names", source.key);
  const descriptions = localizedTextMap(source.descriptions, "descriptions", source.key);
  const dimensions = source.dimensions;
  if (dimensions?.unit !== "m" || ![dimensions.width, dimensions.height, dimensions.depth].every(positiveNumber)) {
    throw new TypeError(`Item ${source.key} has invalid dimensions.`);
  }
  if (!Array.isArray(dimensions.sizeQ) || dimensions.sizeQ.length !== 3 || !dimensions.sizeQ.every(positiveInteger)) {
    throw new TypeError(`Item ${source.key} has invalid packed dimensions.`);
  }
  let concept = null;
  if (source.concept != null) {
    const expectedImage = `concepts/${entry.category}/${entry.key}-v${source.concept.version}.webp`;
    if (source.concept?.source !== "imagegen" || !positiveInteger(source.concept.version)
      || source.concept.image !== expectedImage || !/^[a-f0-9]{64}$/.test(source.concept.sha256)) {
      throw new TypeError(`Item ${source.key} has invalid concept provenance.`);
    }
    concept = Object.freeze({ ...source.concept });
  }

  const forge = source.forge;
  if (forge?.format !== "NCF1" || forge.version !== 15 || typeof forge.code !== "string" || !forge.code.startsWith("NCF1.")) {
    throw new TypeError(`Item ${source.key} has invalid NCF1 data.`);
  }
  if (!positiveInteger(forge.rawBytes) || forge.rawBytes > 640 || !/^[a-f0-9]{64}$/.test(forge.sha256)) {
    throw new TypeError(`Item ${source.key} exceeds the NCF1 payload policy.`);
  }
  if (!Number.isInteger(forge.designHash) || forge.designHash < 0 || forge.designHash > 0xffffffff) {
    throw new TypeError(`Item ${source.key} has an invalid design hash.`);
  }
  if (forge.hasGrip !== (source.interaction === "tool") || forge.materialPolicy !== "current-smelting-rules-only") {
    throw new TypeError(`Item ${source.key} violates the interaction or material policy.`);
  }
  if (!Array.isArray(forge.materialComponents) || !forge.materialComponents.length) throw new TypeError(`Item ${source.key} has no material components.`);
  for (const [index, component] of forge.materialComponents.entries()) {
    if (component?.index !== index || typeof component.materialId !== "string" || !positiveInteger(component.itemCode) || !positiveInteger(component.inputVolumeMm3)) {
      throw new TypeError(`Item ${source.key} has an invalid material component.`);
    }
  }
  const requirements = forge.requirements;
  if (!positiveInteger(requirements?.requiredVolumeMm3) || !positiveInteger(requirements?.outputMassGrams)) {
    throw new TypeError(`Item ${source.key} has invalid material requirements.`);
  }
  const runtime = forge.runtime;
  if (runtime?.kind !== "ncf1-forge-runtime-v1" || !positiveInteger(runtime.vertexCount) || !positiveInteger(runtime.triangleCount)) {
    throw new TypeError(`Item ${source.key} has invalid runtime evidence.`);
  }

  if (!Array.isArray(source.billOfMaterials) || !source.billOfMaterials.length) throw new TypeError(`Item ${source.key} has no bill of materials.`);
  const materialIds = new Set();
  for (const material of source.billOfMaterials) {
    if (typeof material?.materialId !== "string" || materialIds.has(material.materialId) || !positiveInteger(material.itemCode)
      || !positiveInteger(material.usedVolumeMm3) || !positiveInteger(material.equivalentInputUnits)) {
      throw new TypeError(`Item ${source.key} has an invalid bill of materials.`);
    }
    materialIds.add(material.materialId);
  }
  const verificationKeys = ["canonicalRoundTrip", "gameRuntimeRestored", "connectedComponents", "gripValidated", "currentMaterialsOnly"];
  if (verificationKeys.some((key) => source.verification?.[key] !== true)) throw new TypeError(`Item ${source.key} has incomplete verification evidence.`);

  return Object.freeze({
    ...source,
    names,
    descriptions,
    dimensions: Object.freeze({ ...dimensions, sizeQ: Object.freeze([...dimensions.sizeQ]) }),
    preview: Object.freeze({ ...source.preview }),
    ...(concept ? { concept } : {}),
    forge: Object.freeze({
      ...forge,
      materialComponents: Object.freeze(forge.materialComponents.map((component) => Object.freeze({ ...component }))),
      requirements: Object.freeze({ ...requirements }),
      runtime: Object.freeze({ ...runtime }),
    }),
    billOfMaterials: Object.freeze(source.billOfMaterials.map((material) => Object.freeze({ ...material }))),
    verification: Object.freeze({ ...source.verification }),
  });
}

function localizedTextMap(value, field, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Item ${key} has invalid ${field}.`);
  const normalized = {};
  for (const locale of ITEM_DEFINITION_LOCALES) {
    if (typeof value[locale] !== "string" || !value[locale].trim()) throw new TypeError(`Item ${key} is missing ${field}.${locale}.`);
    normalized[locale] = value[locale].trim();
  }
  return Object.freeze(normalized);
}

function titleFromSlug(value) {
  return String(value).split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}
