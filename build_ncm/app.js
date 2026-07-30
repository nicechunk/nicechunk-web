import {
  NCM_MATERIALS as MATERIALS,
  decodeNcm3,
  describeBlueprint,
  encodeNcm2Compatibility,
  encodeNcm3,
  fetchBlueprintFromPda,
  optimizeVoxelCuboids,
  payloadByteLength,
  voxelize,
} from "../chunk.js/ncm/blueprint-codec.js";
import { NcmBlueprintRenderer } from "../chunk.js/renderer/ncm-blueprint-renderer.js";
import {
  compileConstructionBillOfMaterials,
  serializeConstructionBillOfMaterials,
} from "../chunk.js/construction/bill-of-materials.js";
import {
  ROOF_TILE_VARIANTS,
  ROOF_TILE_VARIANTS_BY_ID,
  roofTileVariant,
} from "../chunk.js/construction/roof-tile-catalog.js";
import {
  BUILDING_STYLE_PRESETS,
  BUILDING_STYLE_PRESETS_BY_KEY,
  buildingStylePreset,
  materialProfile,
} from "../chunk.js/construction/building-style-catalog.js";
import { BUILDING_MATERIAL_CATALOG } from "../chunk.js/construction/building-material-catalog.js";
import {
  MaterialModelPreviewRenderer,
  materialModelDimensionsLabel,
  materialModelShapeLabel,
} from "../chunk.js/renderer/material-model-preview.js";
import {
  BUILDING_CATALOG_VERSION,
  buildingConstructionProfiles,
  buildingStyleRecipeManifest,
} from "./construction-catalog.js";
import { getLocale, initI18n, onLocaleChange, t } from "./i18n.js";
import {
  BUILDING_CATEGORIES,
  BUILDING_LIBRARY,
  buildingLibraryEntry,
  buildingsInCategory,
  createLibraryBlueprint,
} from "./building-library.js";

initI18n();

const MAX_PASTED_NCM_CHARACTERS = 131072;

const els = {
  canvas: document.querySelector("#preview"),
  code: document.querySelector("#codeOutput"),
  metrics: document.querySelector("#metrics"),
  materialStrip: document.querySelector("#materialStrip"),
  hash: document.querySelector("#payloadHash"),
  note: document.querySelector("#formatNote"),
  loadCode: document.querySelector("#loadCode"),
  copy: document.querySelector("#copyCode"),
  codeLoadStatus: document.querySelector("#codeLoadStatus"),
  downloadNcm: document.querySelector("#downloadNcm"),
  downloadJson: document.querySelector("#downloadJson"),
  reset: document.querySelector("#resetView"),
  grid: document.querySelector("#toggleGrid"),
  glazing: document.querySelector("#toggleGlazing"),
  spin: document.querySelector("#toggleSpin"),
  rpcUrl: document.querySelector("#rpcUrl"),
  pdaAddress: document.querySelector("#pdaAddress"),
  loadPda: document.querySelector("#loadPda"),
  pdaStatus: document.querySelector("#pdaStatus"),
  modelSize: document.querySelector("#modelSize"),
  buildingTitle: document.querySelector("#buildingTitle"),
  styleName: document.querySelector("#styleName"),
  styleDescription: document.querySelector("#styleDescription"),
  stylePresets: document.querySelector("#stylePresets"),
  styleMaterialGrid: document.querySelector("#styleMaterialGrid"),
  roofVariants: document.querySelector("#roofVariants"),
  roofName: document.querySelector("#roofName"),
  roofSource: document.querySelector("#roofSource"),
  roofMaterialId: document.querySelector("#roofMaterialId"),
  tilePreview: document.querySelector("#tilePreview"),
  recipeName: document.querySelector("#recipeName"),
  recipeSources: document.querySelector("#recipeSources"),
  recipeFormula: document.querySelector("#recipeFormula"),
  recipeTime: document.querySelector("#recipeTime"),
  recipeYield: document.querySelector("#recipeYield"),
  roofVoxelCount: document.querySelector("#roofVoxelCount"),
  heatMarker: document.querySelector("#heatMarker"),
  bomSummary: document.querySelector("#bomSummary"),
  bomRows: document.querySelector("#bomRows"),
  bomFilters: document.querySelector("#bomFilters"),
  downloadBom: document.querySelector("#downloadBom"),
  materialCatalog: document.querySelector("#buildingMaterialCatalog"),
  materialCatalogCount: document.querySelector("#buildingMaterialCatalogCount"),
  materialCatalogFilters: document.querySelector("#buildingMaterialCatalogFilters"),
  buildingCategories: document.querySelector("#buildingCategoryList"),
  buildingCategoryTitle: document.querySelector("#buildingCategoryTitle"),
  buildingCategoryCount: document.querySelector("#buildingCategoryCount"),
  buildingLibrary: document.querySelector("#buildingLibraryList"),
  buildingLibraryCount: document.querySelector("#buildingLibraryCount"),
  buildingLibraryStatus: document.querySelector("#buildingLibraryStatus"),
};

let selectedBuilding = initialBuildingEntry();
let activeBuildingCategory = selectedBuilding.category;
let selectedStyle = buildingStylePreset(selectedBuilding.defaultStyle);
let selectedRoof = roofTileVariant(selectedBuilding.defaultRoof);
let glazed = selectedBuilding.defaultGlazed;
let blueprint = await createLibraryBlueprint(selectedBuilding, { style: selectedStyle, roofMaterial: selectedRoof.materialId, glazed });
let formats = buildFormats(blueprint);
let selectedFormat = "ncm3";
let autoSpin = false;
let activeBomPhase = "all";
let constructionBill = null;
let hashRequest = 0;
let activeMaterialCatalogFilter = "current";
let pdaStatusMessage = { key: "pda.waiting", variables: {}, state: "" };
let codeLoadStatusMessage = { key: "code.loadHint", variables: {}, state: "" };
let codeEditorDirty = false;
let blueprintRequest = 0;
let blueprintBusy = false;
let buildingLibraryStatusMessage = { key: "library.lazyReady", variables: {}, state: "" };

const materialModels = new MaterialModelPreviewRenderer({
  seed: "nicechunk-mainnet-001",
  tileSize: 32,
  maxPixelRatio: 1.25,
});

const spatial = new NcmBlueprintRenderer(els.canvas, {
  background: "#0b1017",
  yaw: selectedBuilding.previewYaw ?? 2.55,
  pitch: 0.58,
  gridVisible: true,
  maxPixelRatio: 1.25,
  fitScale: selectedBuilding.previewFitScale ?? 1.24,
  minScale: selectedBuilding.previewMinScale ?? 5,
});
spatial.setBlueprint(blueprint);
renderBuildingLibrary();
renderStylePresets();
renderRoofVariants();
renderBlueprintState();
renderCodePanel();
setupEvents();
onLocaleChange(renderLocalizedState);

function buildFormats(nextBlueprint) {
  const voxels = voxelize(nextBlueprint);
  const cuboids = optimizeVoxelCuboids(voxels);
  const ncm3 = encodeNcm3(nextBlueprint);
  const ncm2 = encodeNcm2Compatibility(nextBlueprint.size, cuboids);
  return {
    ncm3,
    ncm2,
    recipe: JSON.stringify({ format: "NCM3", size: nextBlueprint.size, commands: describeBlueprint(nextBlueprint) }, null, 2),
    voxels,
    cuboids,
  };
}

function materialCounts(voxels) {
  const counts = new Map();
  for (const voxel of voxels.values()) counts.set(voxel.material, (counts.get(voxel.material) ?? 0) + 1);
  return counts;
}

function displayMaterial(materialId) {
  if (ROOF_TILE_VARIANTS_BY_ID[materialId]) return normalizedProfile(ROOF_TILE_VARIANTS_BY_ID[materialId]);
  try {
    return normalizedProfile(materialProfile(materialId));
  } catch {
    return normalizedProfile(MATERIALS[materialId] ?? { name: `Material ${materialId}`, color: "#777c78" });
  }
}

function normalizedProfile(profile) {
  return {
    ...profile,
    name: profile.nameEn ?? profile.name,
    source: profile.sourceEn ?? profile.source ?? "Canonical NiceChunk material",
    recipe: profile.recipeEn ?? profile.recipe ?? "World resource",
  };
}

function localizedRoofTile(variant) {
  const chinese = getLocale() === "zh-Hans";
  return {
    name: chinese ? variant.name : variant.nameEn,
    shortName: chinese ? variant.shortName : variant.shortNameEn,
    source: chinese ? variant.source : variant.sourceEn,
    recipe: chinese ? variant.recipe : variant.recipeEn,
  };
}

function localizedBomItemName(item) {
  if (item.id === "resin_membrane") return t("bom.item.resinMembrane");
  if (item.id === "pine_lumber") return t("bom.item.pineRoofFraming");
  if (item.phase === "roof" && item.unit === "CU") return localizedRoofTile(selectedRoof).name;
  return item.name;
}

function renderMaterials(counts) {
  els.materialStrip.replaceChildren(...[...counts].sort((a, b) => a[0] - b[0]).map(([id, count]) => {
    const profile = displayMaterial(id);
    const chip = document.createElement("div");
    chip.className = "material-chip";
    chip.title = profile.recipe;
    const model = document.createElement("canvas");
    model.className = "material-chip-model";
    model.setAttribute("aria-hidden", "true");
    const name = document.createElement("b");
    name.textContent = profile.name;
    const key = document.createElement("small");
    key.textContent = `MAT_${String(id).padStart(3, "0")} · ${count.toLocaleString()}`;
    chip.append(model, name, key);
    renderMaterialModel(model, profile, { width: 62, height: 48 });
    return chip;
  }));
}

function renderBuildingLibrary() {
  if (!els.buildingLibrary || !els.buildingCategories) return;
  const activeCategory = BUILDING_CATEGORIES.find((entry) => entry.key === activeBuildingCategory) ?? BUILDING_CATEGORIES[0];
  const visibleBuildings = buildingsInCategory(activeCategory);
  const categories = BUILDING_CATEGORIES.map((categoryEntry) => {
    const count = buildingsInCategory(categoryEntry).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "building-category-button";
    button.dataset.buildingCategory = categoryEntry.key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(categoryEntry.key === activeCategory.key));
    button.setAttribute("aria-label", t("library.categorySelectAria", {
      category: t(categoryEntry.nameKey),
      count,
    }));
    button.classList.toggle("active", categoryEntry.key === activeCategory.key);
    const label = document.createElement("span");
    label.textContent = t(categoryEntry.nameKey);
    const total = document.createElement("b");
    total.textContent = String(count).padStart(2, "0");
    button.append(label, total);
    return button;
  });
  const cards = visibleBuildings.map((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "building-library-card";
    button.dataset.building = entry.key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(entry.key === selectedBuilding.key));
    button.setAttribute("aria-label", t("library.selectAria", { building: t(entry.nameKey) }));
    button.classList.toggle("active", entry.key === selectedBuilding.key);
    if (entry.key === selectedBuilding.key && blueprintBusy) button.setAttribute("aria-busy", "true");

    const marker = document.createElement("span");
    marker.className = "building-library-marker";
    marker.setAttribute("aria-hidden", "true");
    const markerGlyph = document.createElement("i");
    const markerIndex = document.createElement("b");
    markerIndex.textContent = String(index + 1).padStart(2, "0");
    marker.append(markerGlyph, markerIndex);
    const copy = document.createElement("span");
    copy.className = "building-library-copy";
    const name = document.createElement("strong");
    name.textContent = t(entry.nameKey);
    const description = document.createElement("em");
    description.textContent = t(entry.descriptionKey);
    const stats = document.createElement("span");
    stats.className = "building-library-stats";
    stats.append(
      libraryStat(entry.footprint, t("library.footprint")),
      libraryStat(entry.height, t("library.height")),
    );
    copy.append(name, description, stats);
    button.append(marker, copy);
    return button;
  });
  els.buildingCategories.replaceChildren(...categories);
  els.buildingLibrary.replaceChildren(...cards);
  els.buildingLibraryCount.textContent = t("library.count", { count: BUILDING_LIBRARY.length });
  els.buildingCategoryTitle.textContent = t(activeCategory.nameKey);
  els.buildingCategoryCount.textContent = t("library.categoryCount", { count: visibleBuildings.length });
  els.buildingLibrary.setAttribute("aria-label", t("library.buildingsInCategoryAria", { category: t(activeCategory.nameKey) }));
  els.buildingLibraryStatus.textContent = t(
    buildingLibraryStatusMessage.key,
    localizedBuildingLibraryStatusVariables(buildingLibraryStatusMessage.variables),
  );
  els.buildingLibraryStatus.className = `building-library-status${buildingLibraryStatusMessage.state ? ` ${buildingLibraryStatusMessage.state}` : ""}`;
  document.querySelector(".building-library-panel")?.classList.toggle("is-loading", blueprintBusy);
}

function libraryStat(value, label) {
  const item = document.createElement("span");
  const strong = document.createElement("b");
  strong.textContent = value;
  const small = document.createElement("i");
  small.textContent = label;
  item.append(strong, small);
  return item;
}

function renderStylePresets() {
  els.stylePresets.replaceChildren(...BUILDING_STYLE_PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "style-preset";
    button.dataset.style = preset.key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(preset.key === selectedStyle.key));
    button.classList.toggle("active", preset.key === selectedStyle.key);
    button.style.setProperty("--style-accent", preset.accent);
    const palette = document.createElement("i");
    palette.className = "style-palette";
    for (const role of ["foundation", "wall", "structure", "roof"]) {
      const swatch = document.createElement("span");
      swatch.style.background = displayMaterial(preset.materials[role]).color;
      palette.append(swatch);
    }
    const label = document.createElement("strong");
    label.textContent = preset.name;
    button.append(palette, label);
    return button;
  }));
}

function renderStyleMaterials() {
  const manifest = buildingStyleRecipeManifest(selectedStyle, selectedRoof, { extraMaterials: selectedBuilding.extraMaterials });
  els.styleMaterialGrid.replaceChildren(...manifest.map((entry) => {
    const card = document.createElement("div");
    card.className = `style-material${entry.role === "glazing" && !glazed ? " recommended" : ""}`;
    card.title = `${entry.recipe} · ${entry.station}`;
    const model = document.createElement("canvas");
    model.className = "style-material-model";
    model.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    const role = document.createElement("small");
    const roleName = t(`role.${entry.role}`);
    role.textContent = entry.role === "glazing" && !glazed ? t("role.optional", { role: roleName }) : roleName;
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const source = document.createElement("em");
    source.textContent = entry.source;
    copy.append(role, name, source);
    card.append(model, copy);
    renderMaterialModel(model, displayMaterial(entry.materialId), { width: 82, height: 60 });
    return card;
  }));
  els.styleName.textContent = selectedStyle.name;
  els.styleDescription.textContent = t(`style.description.${selectedStyle.key}`);
  els.buildingTitle.textContent = t("view.title", { building: t(selectedBuilding.nameKey), style: selectedStyle.name });
}

function renderBuildingMaterialCatalog(counts) {
  if (!els.materialCatalog) return;
  const currentStyleIds = new Set([
    selectedStyle.materials.foundation,
    selectedStyle.materials.wall,
    selectedStyle.materials.structure,
    selectedStyle.materials.glazing,
    selectedRoof.materialId,
    selectedStyle.materials.floor,
    selectedStyle.materials.chimney,
    ...selectedBuilding.extraMaterials.map((entry) => entry.materialId),
  ]);
  const visible = BUILDING_MATERIAL_CATALOG.filter((entry) => materialCatalogMatches(entry, counts, currentStyleIds));
  els.materialCatalogCount.textContent = `${visible.length} / ${BUILDING_MATERIAL_CATALOG.length}`;
  const fragment = document.createDocumentFragment();

  for (const catalog of visible) {
    const profile = normalizedProfile(catalog);
    const usedCount = counts.get(catalog.materialId) ?? 0;
    const inStyle = currentStyleIds.has(catalog.materialId);
    const card = document.createElement("article");
    card.className = `model-material-card${usedCount ? " is-used" : ""}${inStyle ? " is-style" : ""}`;
    card.dataset.materialId = String(catalog.materialId);
    card.dataset.shape = catalog.shape;

    const visual = document.createElement("div");
    visual.className = "model-material-visual";
    const canvas = document.createElement("canvas");
    canvas.className = "catalog-material-model";
    canvas.setAttribute("aria-label", `${profile.name} ${materialModelShapeLabel(catalog)} model`);
    const id = document.createElement("span");
    id.textContent = `MAT ${String(catalog.materialId).padStart(3, "0")}`;
    visual.append(canvas, id);

    const body = document.createElement("div");
    body.className = "model-material-body";
    const tags = document.createElement("div");
    tags.className = "model-material-tags";
    tags.append(
      catalogTag(catalog.categoryLabel, "role"),
      catalogTag(t(catalog.status === "formal" ? "catalog.production" : "catalog.placeholder"), catalog.status === "formal" ? "formal" : "placeholder"),
    );
    if (usedCount) tags.append(catalogTag(t("catalog.voxels", { count: usedCount.toLocaleString() }), "used"));
    const name = document.createElement("h3");
    name.textContent = profile.name;
    const geometry = document.createElement("p");
    geometry.className = "model-material-geometry";
    geometry.textContent = `${materialModelShapeLabel(catalog)} · ${materialModelDimensionsLabel(catalog)} · ${catalog.crossSection}`;
    const usage = document.createElement("p");
    usage.className = "model-material-usage";
    usage.textContent = catalog.usage;
    const source = document.createElement("dl");
    source.className = "model-material-meta";
    appendDefinition(source, t("catalog.source"), profile.source);
    appendDefinition(source, t("catalog.recipe"), profile.recipe ?? t("catalog.noRecipe"));
    appendDefinition(source, t("catalog.process"), materialCatalogProcess(catalog));
    body.append(tags, name, geometry, usage, source);
    card.append(visual, body);
    fragment.append(card);
    renderMaterialModel(canvas, catalog, { width: 176, height: 132 });
  }

  els.materialCatalog.replaceChildren(fragment);
}

function materialCatalogMatches(entry, counts, currentStyleIds) {
  if (activeMaterialCatalogFilter === "all") return true;
  if (activeMaterialCatalogFilter === "current") return currentStyleIds.has(entry.materialId);
  if (activeMaterialCatalogFilter === "used") return counts.has(entry.materialId);
  if (activeMaterialCatalogFilter === "wood") return [55, 56, 57, 22].includes(entry.materialId);
  if (activeMaterialCatalogFilter === "glazing") return entry.category === "glazing" || entry.category === "decorative";
  if (activeMaterialCatalogFilter === "masonry") return ["foundation", "chimney", "masonry", "wall"].includes(entry.category);
  if (activeMaterialCatalogFilter === "finish") return ["surface", "flooring", "finish"].includes(entry.category);
  if (activeMaterialCatalogFilter === "roof") return entry.category === "roof";
  return true;
}

function catalogTag(text, extra) {
  const tag = document.createElement("span");
  tag.className = `model-material-tag ${extra}`;
  tag.textContent = text;
  return tag;
}

function appendDefinition(list, termText, detailText) {
  const group = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = termText;
  const detail = document.createElement("dd");
  detail.textContent = detailText;
  group.append(term, detail);
  list.append(group);
}

function materialCatalogProcess(catalog) {
  if (catalog.status !== "formal") return catalog.note ?? t("catalog.processPending");
  const station = catalog.stationLabel ?? t(catalog.temperatureC != null ? "catalog.furnace" : "catalog.workbench");
  const tier = catalog.temperatureC != null
    ? t("catalog.heatTier", { tier: catalog.heatTier ?? 1 })
    : t("catalog.toolTier", { tier: catalog.toolTier ?? 0 });
  const temperature = catalog.temperatureC != null ? ` · ${catalog.temperatureC}°C` : "";
  return `${station} · ${tier}${temperature} · ${catalog.processSeconds}s · ${t("catalog.yield", { value: Math.round((catalog.yieldBps ?? 0) / 100) })}`;
}

function renderMaterialModel(canvas, profile, options) {
  try {
    materialModels.render(canvas, profile, options);
  } catch (error) {
    canvas.dataset.modelError = error.message;
    console.warn(`Material model ${profile?.materialId ?? "unknown"} failed`, error);
  }
}

function renderRoofVariants() {
  els.roofVariants.replaceChildren(...ROOF_TILE_VARIANTS.map((variant) => {
    const localized = localizedRoofTile(variant);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "roof-swatch";
    button.dataset.roof = variant.key;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", t("roof.variantAria", { name: localized.name, source: localized.source }));
    button.setAttribute("aria-checked", String(variant.key === selectedRoof.key));
    button.classList.toggle("active", variant.key === selectedRoof.key);
    button.style.setProperty("--tile-color", variant.color);
    button.style.setProperty("--tile-accent", variant.accent);
    const swatch = document.createElement("canvas");
    swatch.className = "roof-model-preview";
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = localized.shortName;
    button.append(swatch, label);
    renderMaterialModel(swatch, normalizedProfile(variant), { width: 58, height: 44 });
    return button;
  }));
}

async function rebuildReference() {
  const request = ++blueprintRequest;
  const building = selectedBuilding;
  const style = selectedStyle;
  const roof = selectedRoof;
  const includeGlazing = glazed;
  blueprintBusy = true;
  setBuildingLibraryStatus("library.loading", "loading", { buildingNameKey: building.nameKey });
  renderBuildingLibrary();
  try {
    const nextBlueprint = await createLibraryBlueprint(building, {
      style,
      roofMaterial: roof.materialId,
      glazed: includeGlazing,
    });
    if (request !== blueprintRequest) return false;
    const nextFormats = buildFormats(nextBlueprint);
    if (request !== blueprintRequest) return false;
    blueprint = nextBlueprint;
    formats = nextFormats;
    codeEditorDirty = false;
    spatial.fitScale = building.previewFitScale ?? 1.24;
    spatial.minScale = building.previewMinScale ?? 5;
    spatial.setBlueprint(blueprint);
    renderStylePresets();
    renderRoofVariants();
    renderBlueprintState();
    renderCodePanel();
    setCodeLoadStatus("code.loadHint");
    setBuildingLibraryStatus("library.loaded", "ok", { buildingNameKey: building.nameKey });
    return true;
  } catch (error) {
    if (request !== blueprintRequest) return false;
    console.error(`Building blueprint ${building.key} failed to load`, error);
    setBuildingLibraryStatus("library.loadFailure", "error", { buildingNameKey: building.nameKey });
    return false;
  } finally {
    if (request === blueprintRequest) {
      blueprintBusy = false;
      renderBuildingLibrary();
    }
  }
}

async function selectBuilding(key) {
  selectedBuilding = buildingLibraryEntry(key);
  activeBuildingCategory = selectedBuilding.category;
  const url = new URL(window.location.href);
  url.searchParams.set("building", selectedBuilding.key);
  window.history.replaceState(null, "", url);
  selectedStyle = buildingStylePreset(selectedBuilding.defaultStyle);
  selectedRoof = roofTileVariant(selectedBuilding.defaultRoof);
  glazed = selectedBuilding.defaultGlazed;
  spatial.homeYaw = selectedBuilding.previewYaw ?? 2.55;
  spatial.yaw = spatial.homeYaw;
  spatial.homePitch = 0.58;
  spatial.pitch = spatial.homePitch;
  activeBomPhase = "all";
  els.bomFilters.querySelectorAll("[data-phase]").forEach((item) => item.classList.toggle("active", item.dataset.phase === "all"));
  renderBuildingLibrary();
  await rebuildReference();
}

function initialBuildingEntry() {
  const requested = new URLSearchParams(window.location.search).get("building") ?? "hollow-cottage";
  try {
    return buildingLibraryEntry(requested);
  } catch {
    return buildingLibraryEntry("hollow-cottage");
  }
}

function selectStylePreset(key) {
  selectedStyle = buildingStylePreset(key);
  selectedRoof = roofTileVariant(selectedStyle.materials.roof);
  void rebuildReference();
}

function selectRoofVariant(key) {
  selectedRoof = roofTileVariant(key);
  void rebuildReference();
}

function renderTileRecipe(voxelCount) {
  const variant = selectedRoof;
  const localized = localizedRoofTile(variant);
  els.roofName.textContent = localized.name;
  els.roofSource.textContent = localized.source;
  els.roofMaterialId.textContent = `MAT ${String(variant.materialId).padStart(3, "0")}`;
  els.recipeName.textContent = localized.name;
  els.recipeSources.textContent = localized.source.replaceAll(" + ", " · ");
  els.recipeFormula.textContent = localized.recipe;
  els.recipeTime.textContent = `${variant.processSeconds}s`;
  els.recipeYield.textContent = `${Math.round(variant.yieldBps / 100)}%`;
  els.roofVoxelCount.textContent = voxelCount.toLocaleString();
  els.heatMarker.style.left = `${((variant.heatTier - 1) / 3) * 100}%`;
  els.tilePreview.style.setProperty("--tile-color", variant.color);
  els.tilePreview.style.setProperty("--tile-accent", variant.accent);
  els.tilePreview.classList.toggle("emissive", Boolean(variant.emissive));
}

function renderBill() {
  if (!constructionBill) return;
  const structuralPhases = new Set(["foundation", "structure", "envelope", "roof", "openings", "finish"]);
  const buildItems = constructionBill.items.filter((item) => structuralPhases.has(item.phase));
  const availableItems = buildItems.filter((item) => item.stage === "available");
  const availability = buildItems.length ? Math.round(availableItems.length / buildItems.length * 100) : 0;
  const roofAmount = constructionBill.items
    .filter((item) => item.phase === "roof" && item.unit === "CU")
    .reduce((sum, item) => sum + item.amount, 0);

  els.bomSummary.replaceChildren(
    summaryMetric(constructionBill.voxelCount.toLocaleString(), t("bom.summary.voxels")),
    summaryMetric(String(constructionBill.items.length), t("bom.summary.materials")),
    summaryMetric(`${roofAmount.toLocaleString()} CU`, t("bom.summary.roof"), "blue"),
    summaryMetric(
      constructionBill.unprofiledVoxelCount ? t("bom.summary.uncovered", { count: constructionBill.unprofiledVoxelCount }) : `${availability}%`,
      t(constructionBill.unprofiledVoxelCount ? "bom.summary.coverage" : "bom.summary.availability"),
      constructionBill.unprofiledVoxelCount ? "amber" : "good",
    ),
  );

  const visibleItems = constructionBill.items.filter((item) => activeBomPhase === "all" || item.phase === activeBomPhase);
  els.bomRows.replaceChildren(...visibleItems.map((item) => {
    const row = document.createElement("div");
    row.className = "bom-row";
    row.setAttribute("role", "row");
    const identity = document.createElement("div");
    identity.className = "bom-identity";
    const swatch = document.createElement("i");
    swatch.style.background = item.color;
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = localizedBomItemName(item);
    const meta = document.createElement("small");
    meta.textContent = `${phaseName(item.phase)} · ${item.id}`;
    text.append(name, meta);
    identity.append(swatch, text);
    const amount = document.createElement("strong");
    amount.className = "bom-amount";
    amount.textContent = `${formatAmount(item.amount)} ${item.unit}`;
    const stage = document.createElement("span");
    stage.className = `bom-stage ${item.stage === "available" ? "available" : "gated"}`;
    stage.textContent = t(item.stage === "available" ? "bom.stage.available" : "bom.stage.gated");
    row.append(identity, amount, stage);
    return row;
  }));
}

function summaryMetric(value, label, extra = "") {
  const node = document.createElement("div");
  node.className = `bom-summary-item ${extra}`;
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  node.append(strong, span);
  return node;
}

function phaseName(phase) {
  const key = `phase.${phase}`;
  const translated = t(key);
  return translated === key ? phase : translated;
}

function formatAmount(value) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function renderBlueprintState() {
  const counts = materialCounts(formats.voxels);
  renderMaterials(counts);
  constructionBill = compileConstructionBillOfMaterials(
    formats.voxels,
    buildingConstructionProfiles(selectedStyle, selectedRoof, { extraMaterials: selectedBuilding.extraMaterials }),
    { catalogVersion: BUILDING_CATALOG_VERSION },
  );
  els.modelSize.textContent = `${blueprint.size.x} × ${blueprint.size.y} × ${blueprint.size.z}`;
  els.glazing.textContent = t(glazed ? "view.glazed" : "view.open");
  els.glazing.setAttribute("aria-pressed", String(glazed));
  els.glazing.classList.toggle("active", glazed);
  renderStyleMaterials();
  renderBuildingMaterialCatalog(counts);
  renderBill();
  renderTileRecipe(counts.get(selectedRoof.materialId) ?? 0);
}

function renderCodePanel({ preserveEditor = false } = {}) {
  if (!preserveEditor || !codeEditorDirty) {
    els.code.value = formats[selectedFormat];
    codeEditorDirty = false;
  }
  const selectedCode = selectedFormat === "recipe" ? formats.ncm3 : formats[selectedFormat];
  const ncm3Bytes = payloadByteLength(formats.ncm3);
  const ncm2Bytes = payloadByteLength(formats.ncm2);
  const saving = Math.max(0, Math.round((1 - ncm3Bytes / ncm2Bytes) * 100));
  els.metrics.replaceChildren(
    metric(`${ncm3Bytes} B`, t("code.metric.ncm3"), "good"),
    metric(`${formats.ncm3.length}`, t("code.metric.characters")),
    metric(`${formats.voxels.size.toLocaleString()}`, t("code.metric.voxels")),
    metric(`${saving}%`, t("code.metric.saving"), "good"),
  );
  els.note.textContent = t(`code.note.${selectedFormat}`);
  updateHash(selectedCode);
}

function metric(value, label, extra = "") {
  const node = document.createElement("div");
  node.className = `metric ${extra}`;
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  node.append(strong, span);
  return node;
}

async function updateHash(code) {
  const request = ++hashRequest;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  if (request !== hashRequest) return;
  els.hash.textContent = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setupEvents() {
  document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => {
    selectCodeFormat(button.dataset.format);
    codeEditorDirty = false;
    renderCodePanel();
    setCodeLoadStatus("code.loadHint");
  }));
  els.code.addEventListener("input", () => {
    codeEditorDirty = true;
    setCodeLoadStatus("code.loadHint");
  });
  els.code.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    loadPastedCode();
  });
  els.loadCode.addEventListener("click", loadPastedCode);
  els.copy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(els.code.value);
    els.copy.textContent = t("code.copied");
    setTimeout(() => { els.copy.textContent = t("code.copy"); }, 1200);
  });
  els.downloadNcm.addEventListener("click", () => downloadText(`${formats.ncm3}\n`, `${fileStem()}.ncm`, "text/plain"));
  els.downloadJson.addEventListener("click", () => downloadText(JSON.stringify({
    name: blueprint.name,
    size: blueprint.size,
    building: selectedBuilding.key,
    style: selectedStyle,
    roof: selectedRoof,
    glazed,
    cuboids: formats.cuboids,
  }, null, 2), `${fileStem()}.expanded.json`, "application/json"));
  els.downloadBom.addEventListener("click", () => downloadText(JSON.stringify({
    blueprint: { libraryKey: selectedBuilding.key, name: blueprint.name, size: blueprint.size, ncm3: formats.ncm3 },
    style: selectedStyle,
    openings: glazed ? "glazed" : "open",
    materialRecipes: buildingStyleRecipeManifest(selectedStyle, selectedRoof, { extraMaterials: selectedBuilding.extraMaterials }),
    billOfMaterials: serializeConstructionBillOfMaterials(constructionBill),
  }, null, 2), `${fileStem()}.bom.json`, "application/json"));
  els.stylePresets.addEventListener("click", (event) => {
    const button = event.target.closest("[data-style]");
    if (button && button.dataset.style !== selectedStyle.key) selectStylePreset(button.dataset.style);
  });
  els.buildingCategories?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-building-category]");
    if (!button || button.dataset.buildingCategory === activeBuildingCategory) return;
    activeBuildingCategory = button.dataset.buildingCategory;
    renderBuildingLibrary();
  });
  els.buildingLibrary?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-building]");
    if (button && button.dataset.building !== selectedBuilding.key) void selectBuilding(button.dataset.building);
  });
  els.roofVariants.addEventListener("click", (event) => {
    const button = event.target.closest("[data-roof]");
    if (button && button.dataset.roof !== selectedRoof.key) selectRoofVariant(button.dataset.roof);
  });
  els.bomFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-phase]");
    if (!button) return;
    activeBomPhase = button.dataset.phase;
    els.bomFilters.querySelectorAll("[data-phase]").forEach((item) => item.classList.toggle("active", item === button));
    renderBill();
  });
  els.materialCatalogFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-material-filter]");
    if (!button || button.dataset.materialFilter === activeMaterialCatalogFilter) return;
    activeMaterialCatalogFilter = button.dataset.materialFilter;
    els.materialCatalogFilters.querySelectorAll("[data-material-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderBuildingMaterialCatalog(materialCounts(formats.voxels));
  });
  els.reset.addEventListener("click", () => spatial.resetView());
  els.grid.addEventListener("click", () => {
    spatial.setGridVisible(!spatial.gridVisible);
    els.grid.classList.toggle("active", spatial.gridVisible);
  });
  els.glazing.addEventListener("click", () => {
    glazed = !glazed;
    void rebuildReference();
  });
  els.spin.addEventListener("click", () => {
    autoSpin = !autoSpin;
    spatial.setAutoRotate(autoSpin);
    els.spin.classList.toggle("active", autoSpin);
  });
  els.loadPda.addEventListener("click", loadPda);
}

async function loadPda() {
  const address = els.pdaAddress.value.trim();
  if (!address) return setPdaStatus("pda.enterAddress", "error");
  setPdaStatus("pda.loading");
  els.loadPda.disabled = true;
  try {
    const account = await fetchBlueprintFromPda({ rpcUrl: els.rpcUrl.value.trim(), address });
    if (!account.code.startsWith("NCM3:")) throw new Error(t("pda.requiresNcm3"));
    const nextBlueprint = decodeNcm3(account.code);
    applyLoadedBlueprint(nextBlueprint, buildFormats(nextBlueprint));
    setCodeLoadStatus("code.loadHint");
    setPdaStatus(account.verified ? "pda.successVerified" : "pda.successRaw", "ok", { bytes: account.storedBytes ?? payloadByteLength(account.code) });
  } catch (error) {
    setPdaStatus("pda.failure", "error", { message: error.message });
  } finally {
    els.loadPda.disabled = false;
  }
}

async function loadPastedCode() {
  const code = els.code.value.trim();
  if (!code) {
    setCodeLoadStatus("code.loadEmpty", "error");
    els.code.focus();
    return;
  }
  if (code.length > MAX_PASTED_NCM_CHARACTERS) {
    setCodeLoadStatus("code.loadTooLarge", "error");
    return;
  }
  if (!code.startsWith("NCM3:")) {
    setCodeLoadStatus("code.loadRequiresNcm3", "error");
    return;
  }

  setCodeLoadBusy(true);
  setCodeLoadStatus("code.loading");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const nextBlueprint = decodeNcm3(code);
    const nextFormats = buildFormats(nextBlueprint);
    applyLoadedBlueprint(nextBlueprint, nextFormats);
    setCodeLoadStatus("code.loadSuccess", "ok", { voxels: nextFormats.voxels.size.toLocaleString() });
  } catch (error) {
    setCodeLoadStatus("code.loadFailure", "error", { message: error.message });
  } finally {
    setCodeLoadBusy(false);
  }
}

function applyLoadedBlueprint(nextBlueprint, nextFormats) {
  const loadedCounts = materialCounts(nextFormats.voxels);
  const loadedRoofId = [...loadedCounts.keys()].find((materialId) => ROOF_TILE_VARIANTS_BY_ID[materialId]);
  const loadedStyle = detectStyle(loadedCounts);
  blueprint = nextBlueprint;
  formats = nextFormats;
  if (loadedRoofId) selectedRoof = ROOF_TILE_VARIANTS_BY_ID[loadedRoofId];
  if (loadedStyle) selectedStyle = loadedStyle;
  glazed = loadedCounts.has(selectedStyle.materials.glazing);
  codeEditorDirty = false;
  selectCodeFormat("ncm3");
  spatial.setBlueprint(blueprint);
  renderStylePresets();
  renderRoofVariants();
  renderBlueprintState();
  renderCodePanel();
}

function selectCodeFormat(format) {
  selectedFormat = format;
  document.querySelectorAll("[data-format]").forEach((item) => {
    const selected = item.dataset.format === format;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", String(selected));
  });
}

function setCodeLoadBusy(busy) {
  els.loadCode.disabled = busy;
  els.loadCode.setAttribute("aria-busy", String(busy));
  els.loadCode.textContent = t(busy ? "code.loading" : "code.load");
}

function setCodeLoadStatus(key, state = "", variables = {}) {
  codeLoadStatusMessage = { key, state, variables };
  els.codeLoadStatus.textContent = t(key, variables);
  els.codeLoadStatus.className = `code-load-status${state ? ` ${state}` : ""}`;
}

function detectStyle(counts) {
  let best = null;
  let bestScore = 0;
  for (const preset of BUILDING_STYLE_PRESETS) {
    const score = ["foundation", "wall", "structure", "floor", "chimney"]
      .reduce((total, role) => total + Number(counts.has(preset.materials[role])), 0);
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? BUILDING_STYLE_PRESETS_BY_KEY[best.key] : null;
}

function fileStem() {
  return `${selectedBuilding.key}-${selectedStyle.key}-${selectedRoof.key}-${glazed ? "glazed" : "open"}`;
}

function setPdaStatus(key, state = "", variables = {}) {
  pdaStatusMessage = { key, state, variables };
  els.pdaStatus.textContent = t(key, variables);
  els.pdaStatus.className = state;
}

function setBuildingLibraryStatus(key, state = "", variables = {}) {
  buildingLibraryStatusMessage = { key, state, variables };
  if (!els.buildingLibraryStatus) return;
  els.buildingLibraryStatus.textContent = t(key, localizedBuildingLibraryStatusVariables(variables));
  els.buildingLibraryStatus.className = `building-library-status${state ? ` ${state}` : ""}`;
}

function localizedBuildingLibraryStatusVariables(variables) {
  if (!variables.buildingNameKey) return variables;
  return { ...variables, building: t(variables.buildingNameKey) };
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function renderLocalizedState() {
  renderBuildingLibrary();
  renderStylePresets();
  renderRoofVariants();
  renderBlueprintState();
  renderCodePanel({ preserveEditor: true });
  setCodeLoadStatus(codeLoadStatusMessage.key, codeLoadStatusMessage.state, codeLoadStatusMessage.variables);
  setPdaStatus(pdaStatusMessage.key, pdaStatusMessage.state, pdaStatusMessage.variables);
  setBuildingLibraryStatus(
    buildingLibraryStatusMessage.key,
    buildingLibraryStatusMessage.state,
    buildingLibraryStatusMessage.variables,
  );
}
