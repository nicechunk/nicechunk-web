import {
  BUILDING_MATERIAL_ROLES,
  buildingStyleMaterial,
  buildingStylePreset,
  materialProfile,
} from "../chunk.js/construction/building-style-catalog.js";
import { roofTileConstructionItems } from "../chunk.js/construction/roof-tile-catalog.js";

export const BUILDING_CATALOG_VERSION = "nicechunk-building-library-v3";
export const COTTAGE_CATALOG_VERSION = BUILDING_CATALOG_VERSION;

const ROLE_PHASE = Object.freeze({
  foundation: "foundation",
  wall: "envelope",
  structure: "structure",
  glazing: "openings",
  roof: "roof",
  floor: "finish",
  chimney: "structure",
});

export function buildingConstructionProfiles(styleOrKey, roofVariant, { extraMaterials = [] } = {}) {
  const preset = buildingStylePreset(styleOrKey);
  const profiles = {};

  for (const role of BUILDING_MATERIAL_ROLES) {
    if (role.key === "roof") continue;
    const variant = buildingStyleMaterial(preset, role.key);
    profiles[variant.materialId] = profile(ROLE_PHASE[role.key], `${preset.name} ${role.name}`, [
      item(variant.key, variant.name, 1, "CU", ROLE_PHASE[role.key], variant.color),
    ]);
  }

  profiles[roofVariant.materialId] = profile("roof", roofVariant.nameEn ?? roofVariant.name, englishRoofConstructionItems(roofVariant));
  for (const extra of extraMaterials) {
    if (profiles[extra.materialId]) continue;
    const variant = materialProfile(extra.materialId);
    profiles[variant.materialId] = profile(extra.phase ?? "finish", extra.label ?? variant.name, [
      item(variant.key, variant.nameEn ?? variant.name, 1, "CU", extra.phase ?? "finish", variant.color),
    ]);
  }
  return Object.freeze(profiles);
}

export function buildingStyleRecipeManifest(styleOrKey, roofVariant, { extraMaterials = [] } = {}) {
  const preset = buildingStylePreset(styleOrKey);
  const entries = BUILDING_MATERIAL_ROLES.map((role) => {
    const variant = role.key === "roof" ? roofVariant : buildingStyleMaterial(preset, role.key);
    return Object.freeze({
      role: role.key,
      roleName: role.name,
      materialId: variant.materialId,
      name: variant.nameEn ?? variant.name,
      color: variant.color,
      source: variant.sourceEn ?? variant.source,
      recipe: variant.recipeEn ?? variant.recipe,
      station: variant.stationLabel ?? "Kiln",
      processSeconds: variant.processSeconds,
      yieldBps: variant.yieldBps,
    });
  });
  const known = new Set(entries.map((entry) => entry.materialId));
  for (const extra of extraMaterials) {
    if (known.has(extra.materialId)) continue;
    const variant = materialProfile(extra.materialId);
    entries.push(Object.freeze({
      role: "detail",
      roleName: extra.label ?? "Building Detail",
      materialId: variant.materialId,
      name: variant.nameEn ?? variant.name,
      color: variant.color,
      source: variant.sourceEn ?? variant.source,
      recipe: variant.recipeEn ?? variant.recipe,
      station: variant.stationLabel ?? "Workbench",
      processSeconds: variant.processSeconds,
      yieldBps: variant.yieldBps,
    }));
    known.add(extra.materialId);
  }
  return Object.freeze(entries);
}

// Compatibility for existing consumers of the original single-style page.
export function cottageConstructionProfiles(roofVariant) {
  return buildingConstructionProfiles("cottage", roofVariant);
}

function profile(phase, label, items) {
  return Object.freeze({ phase, label, items: Object.freeze(items) });
}

function item(id, name, unitsPerVoxel, unit, phase, color, stage = "available") {
  return Object.freeze({ id, name, unitsPerVoxel, unit, phase, color, stage });
}

function englishRoofConstructionItems(roofVariant) {
  return roofTileConstructionItems(roofVariant).map((entry) => Object.freeze({
    ...entry,
    name: entry.id === "resin_membrane"
      ? "Resin Waterproof Membrane"
      : entry.id === "pine_lumber"
        ? "Pine Roof Framing"
        : roofVariant.nameEn ?? roofVariant.name,
  }));
}
