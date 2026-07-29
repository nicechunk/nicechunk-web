import { createReferenceCottage } from "./house-blueprint.js";
import { createCivicTownHall } from "./civic-town-hall-blueprint.js";
import { createSeasideCottage } from "./seaside-cottage-blueprint.js";
import { createFreightWarehouse } from "./warehouse-blueprint.js";
import { createGrandCastle } from "./grand-castle-blueprint.js";

export const BUILDING_LIBRARY_POLICY = Object.freeze({
  embeddedDoorLeaves: false,
  entranceRule: "Blueprints keep entrance portals open; players place door items separately.",
});

export const BUILDING_LIBRARY = Object.freeze([
  building({
    key: "hollow-cottage",
    name: "Hollow Cottage",
    nameKey: "library.cottage.name",
    descriptionKey: "library.cottage.description",
    categoryKey: "library.category.residential",
    defaultStyle: "cottage",
    defaultRoof: "terracotta",
    defaultGlazed: false,
    doorOpening: "open",
    footprint: "16 × 13 vu",
    height: "20 vu",
    referenceScale: "Compact residential shell",
    extraMaterials: [],
    createBlueprint: createReferenceCottage,
  }),
  building({
    key: "seaside-cottage",
    name: "Sea Breeze Cottage",
    nameKey: "library.seaside.name",
    descriptionKey: "library.seaside.description",
    categoryKey: "library.category.coastal",
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
    createBlueprint: createSeasideCottage,
  }),
  building({
    key: "freight-warehouse",
    name: "Freight Warehouse",
    nameKey: "library.warehouse.name",
    descriptionKey: "library.warehouse.description",
    categoryKey: "library.category.industrial",
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
    createBlueprint: createFreightWarehouse,
  }),
  building({
    key: "grand-castle",
    name: "Royal Blue Citadel",
    nameKey: "library.castle.name",
    descriptionKey: "library.castle.description",
    categoryKey: "library.category.fortress",
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
    createBlueprint: createGrandCastle,
  }),
  building({
    key: "civic-town-hall",
    name: "Civic Town Hall",
    nameKey: "library.townHall.name",
    descriptionKey: "library.townHall.description",
    categoryKey: "library.category.civic",
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
    createBlueprint: createCivicTownHall,
  }),
]);

export const BUILDING_LIBRARY_BY_KEY = Object.freeze(Object.fromEntries(
  BUILDING_LIBRARY.map((entry) => [entry.key, entry]),
));

export function buildingLibraryEntry(value = "hollow-cottage") {
  const entry = typeof value === "object" ? value : BUILDING_LIBRARY_BY_KEY[String(value)];
  if (!entry || !BUILDING_LIBRARY_BY_KEY[entry.key]) throw new Error(`Unknown building library entry: ${value}`);
  return entry;
}

export function createLibraryBlueprint(buildingOrKey, options = {}) {
  const entry = buildingLibraryEntry(buildingOrKey);
  return entry.createBlueprint(options);
}

function building(definition) {
  if (!definition?.key || typeof definition.createBlueprint !== "function") throw new TypeError("Invalid building library entry.");
  if (definition.doorOpening !== "open") throw new TypeError(`Building ${definition.key} must keep its entrance portal open.`);
  return Object.freeze({ ...definition });
}
