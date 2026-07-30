export const BUILDING_LIBRARY_POLICY = Object.freeze({
  embeddedDoorLeaves: false,
  entranceRule: "Blueprints keep entrance portals open; players place door items separately.",
});

export const BUILDING_CATEGORIES = Object.freeze([
  category({ key: "residential", nameKey: "library.category.residential" }),
  category({ key: "coastal", nameKey: "library.category.coastal" }),
  category({ key: "civic", nameKey: "library.category.civic" }),
  category({ key: "industrial", nameKey: "library.category.industrial" }),
  category({ key: "fortress", nameKey: "library.category.fortress" }),
]);

export const BUILDING_CATEGORIES_BY_KEY = Object.freeze(Object.fromEntries(
  BUILDING_CATEGORIES.map((entry) => [entry.key, entry]),
));

export const BUILDING_LIBRARY = Object.freeze([
  building({
    key: "hollow-cottage",
    name: "Hollow Cottage",
    nameKey: "library.cottage.name",
    descriptionKey: "library.cottage.description",
    category: "residential",
    defaultStyle: "cottage",
    defaultRoof: "terracotta",
    defaultGlazed: false,
    doorOpening: "open",
    footprint: "16 × 13 vu",
    height: "20 vu",
    referenceScale: "Compact residential shell",
    extraMaterials: [],
    blueprintModule: "./house-blueprint.js",
    blueprintExport: "createReferenceCottage",
  }),
  building({
    key: "seaside-cottage",
    name: "Sea Breeze Cottage",
    nameKey: "library.seaside.name",
    descriptionKey: "library.seaside.description",
    category: "coastal",
    defaultStyle: "coastal",
    defaultRoof: "iceBlue",
    defaultGlazed: true,
    doorOpening: "open",
    footprint: "22 × 18 vu + deck",
    height: "24 vu",
    referenceScale: "Raised compact coastal residence",
    extraMaterials: Object.freeze([
      Object.freeze({ materialId: 55, phase: "finish", label: "Salt-treated Wooden Deck" }),
      Object.freeze({ materialId: 60, phase: "openings", label: "Amber Porch Lantern" }),
      Object.freeze({ materialId: 75, phase: "finish", label: "Blue Ceramic Fascia" }),
    ]),
    blueprintModule: "./seaside-cottage-blueprint.js",
    blueprintExport: "createSeasideCottage",
  }),
  building({
    key: "freight-warehouse",
    name: "Freight Warehouse",
    nameKey: "library.warehouse.name",
    descriptionKey: "library.warehouse.description",
    category: "industrial",
    defaultStyle: "castle",
    defaultRoof: "charcoal",
    defaultGlazed: true,
    doorOpening: "open",
    footprint: "32 × 24 vu + dock",
    height: "36 vu",
    referenceScale: "Large uninterrupted storage hall",
    extraMaterials: Object.freeze([
      Object.freeze({ materialId: 60, phase: "openings", label: "Amber Loading-dock Lamp" }),
    ]),
    blueprintModule: "./warehouse-blueprint.js",
    blueprintExport: "createFreightWarehouse",
  }),
  building({
    key: "grand-castle",
    name: "Royal Blue Citadel",
    nameKey: "library.castle.name",
    descriptionKey: "library.castle.description",
    category: "fortress",
    defaultStyle: "castle",
    defaultRoof: "iceBlue",
    defaultGlazed: false,
    doorOpening: "open",
    footprint: "144 × 124 vu",
    height: "85 vu",
    previewFitScale: 1.12,
    previewMinScale: 1,
    previewYaw: 2.35,
    referenceScale: "Four-tower royal castle with a broad placement courtyard",
    extraMaterials: Object.freeze([
      Object.freeze({ materialId: 60, phase: "openings", label: "Amber Gate Brazier" }),
      Object.freeze({ materialId: 75, phase: "finish", label: "Blue Citadel Banner" }),
    ]),
    blueprintModule: "./grand-castle-blueprint.js",
    blueprintExport: "createGrandCastle",
  }),
  building({
    key: "civic-town-hall",
    name: "Civic Town Hall",
    nameKey: "library.townHall.name",
    descriptionKey: "library.townHall.description",
    category: "civic",
    defaultStyle: "coastal",
    defaultRoof: "iceBlue",
    defaultGlazed: true,
    doorOpening: "open",
    footprint: "28 × 28 vu",
    height: "42 vu",
    referenceScale: "7 × 7 design grid at four NCM voxels per cell",
    extraMaterials: Object.freeze([
      Object.freeze({ materialId: 60, phase: "openings", label: "Amber Civic Lantern" }),
      Object.freeze({ materialId: 75, phase: "finish", label: "Blue Civic Crest and Flag" }),
    ]),
    blueprintModule: "./civic-town-hall-blueprint.js",
    blueprintExport: "createCivicTownHall",
  }),
]);

export const BUILDING_LIBRARY_BY_KEY = Object.freeze(Object.fromEntries(
  BUILDING_LIBRARY.map((entry) => [entry.key, entry]),
));

const BLUEPRINT_FACTORY_PROMISES = new Map();

export function buildingLibraryEntry(value = "hollow-cottage") {
  const entry = typeof value === "object" ? value : BUILDING_LIBRARY_BY_KEY[String(value)];
  if (!entry || !BUILDING_LIBRARY_BY_KEY[entry.key]) throw new Error(`Unknown building library entry: ${value}`);
  return entry;
}

export function buildingsInCategory(categoryOrKey) {
  const key = typeof categoryOrKey === "object" ? categoryOrKey?.key : String(categoryOrKey);
  if (!BUILDING_CATEGORIES_BY_KEY[key]) throw new Error(`Unknown building category: ${key}`);
  return BUILDING_LIBRARY.filter((entry) => entry.category === key);
}

export async function createLibraryBlueprint(buildingOrKey, options = {}) {
  const entry = buildingLibraryEntry(buildingOrKey);
  const createBlueprint = await loadBlueprintFactory(entry);
  return createBlueprint(options);
}

async function loadBlueprintFactory(entry) {
  let promise = BLUEPRINT_FACTORY_PROMISES.get(entry.key);
  if (!promise) {
    promise = import(entry.blueprintModule).then((module) => {
      const createBlueprint = module[entry.blueprintExport];
      if (typeof createBlueprint !== "function") {
        throw new TypeError(`Building ${entry.key} does not export ${entry.blueprintExport}().`);
      }
      return createBlueprint;
    });
    BLUEPRINT_FACTORY_PROMISES.set(entry.key, promise);
  }
  try {
    return await promise;
  } catch (error) {
    if (BLUEPRINT_FACTORY_PROMISES.get(entry.key) === promise) BLUEPRINT_FACTORY_PROMISES.delete(entry.key);
    throw error;
  }
}

function category(definition) {
  if (!definition?.key || !definition.nameKey) throw new TypeError("Invalid building category.");
  return Object.freeze({ ...definition });
}

function building(definition) {
  const categoryEntry = BUILDING_CATEGORIES_BY_KEY[definition?.category];
  if (!definition?.key || !categoryEntry || !definition.blueprintModule || !definition.blueprintExport) {
    throw new TypeError("Invalid building library entry.");
  }
  if (definition.doorOpening !== "open") throw new TypeError(`Building ${definition.key} must keep its entrance portal open.`);
  return Object.freeze({ ...definition, categoryKey: categoryEntry.nameKey });
}
