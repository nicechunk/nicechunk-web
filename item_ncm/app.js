import { ForgeRuntimeCache } from "../chunk.js/forge/forge-runtime-cache.js";
import { ForgeWorkbenchRenderer } from "../chunk.js/renderer/forge-workbench-renderer.js";
import { getLocale, initI18n, onLocaleChange, t } from "./i18n.js";
import {
  itemsInCategory,
  loadItemCatalog,
  loadItemDefinition,
  localizedItemText,
} from "./item-library.js";

await initI18n();

const [catalog, smeltingRules] = await Promise.all([
  loadItemCatalog(),
  loadSmeltingRules(),
]);
const materialRules = new Map(smeltingRules.materials.map((material) => [material.id, material]));
const runtimeCache = new ForgeRuntimeCache({ maxEntries: 24, maxBytes: 48 * 1024 * 1024 });

const els = {
  catalogCount: document.querySelector("#catalogCount"),
  search: document.querySelector("#itemSearch"),
  categories: document.querySelector("#categoryList"),
  categoryTitle: document.querySelector("#activeCategoryTitle"),
  categoryCount: document.querySelector("#activeCategoryCount"),
  itemList: document.querySelector("#itemList"),
  libraryStatus: document.querySelector("#libraryStatus"),
  canvas: document.querySelector("#forgePreview"),
  resetView: document.querySelector("#resetView"),
  runtimeState: document.querySelector("#runtimeState"),
  itemTitle: document.querySelector("#itemTitle"),
  modelSize: document.querySelector("#modelSize"),
  previewFallback: document.querySelector("#previewFallback"),
  itemDescription: document.querySelector("#itemDescription"),
  summaryTags: document.querySelector("#summaryTags"),
  code: document.querySelector("#codeOutput"),
  copyCode: document.querySelector("#copyCode"),
  downloadJson: document.querySelector("#downloadJson"),
  payloadBytes: document.querySelector("#payloadBytes"),
  payloadHash: document.querySelector("#payloadHash"),
  interactionBadge: document.querySelector("#interactionBadge"),
  metrics: document.querySelector("#metrics"),
  verificationList: document.querySelector("#verificationList"),
  verificationCount: document.querySelector("#verificationCount"),
  materialTypeCount: document.querySelector("#materialTypeCount"),
  bomRows: document.querySelector("#bomRows"),
};

const loadedDefinitions = new Map();
let activeCategory = catalog.categories[0].key;
let selectedEntry = null;
let selectedItem = null;
let pendingItemKey = null;
let itemRequest = 0;
let libraryMessage = { key: "library.ready", variables: {}, state: "ready" };
let renderer = null;

try {
  renderer = new ForgeWorkbenchRenderer(els.canvas, {
    clearColor: [0.027, 0.043, 0.058, 1],
    fogColor: [0.027, 0.043, 0.058, 1],
    fogNear: 9,
    fogFar: 24,
    exposure: 1.08,
    lightDirection: [-0.42, 0.82, 0.34],
    ambientColor: [0.46, 0.55, 0.62, 1],
    keyLightColor: [0.78, 0.86, 0.76, 1],
    materialTextureSeed: "nicechunk-mainnet-001",
    materialTextureTileSize: 32,
    materialTileScale: 1.35,
    workpieceDragEnabled: false,
    toolVisuals: false,
    workpieceGrouped: true,
    fov: 36,
    distance: 5.4,
  }).init();
} catch {
  els.previewFallback.hidden = false;
}

renderLibrary();
renderEmptyState();
setupEvents();
onLocaleChange(renderLocalizedState);

const requestedKey = new URL(location.href).searchParams.get("item");
const requestedEntry = requestedKey ? catalog.byKey[requestedKey] : null;
void selectItem(requestedEntry ?? catalog.entries[0]);

function setupEvents() {
  els.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button || !catalog.categories.some((category) => category.key === button.dataset.category)) return;
    activeCategory = button.dataset.category;
    els.search.value = "";
    renderLibrary();
  });
  els.itemList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-item]");
    const entry = button ? catalog.byKey[button.dataset.item] : null;
    if (entry) void selectItem(entry);
  });
  els.search.addEventListener("input", renderLibrary);
  els.resetView.addEventListener("click", () => {
    if (selectedItem && renderer) setPreviewCamera(selectedItem);
  });
  els.copyCode.addEventListener("click", () => void copyNcf1Code());
  els.downloadJson.addEventListener("click", downloadSelectedJson);
  window.addEventListener("popstate", () => {
    const key = new URL(location.href).searchParams.get("item");
    const entry = key ? catalog.byKey[key] : null;
    if (entry && entry.key !== selectedEntry?.key) void selectItem(entry, { updateUrl: false });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
    event.preventDefault();
    els.search.focus();
  });
}

async function selectItem(entry, { updateUrl = true } = {}) {
  const request = ++itemRequest;
  pendingItemKey = entry.key;
  activeCategory = entry.category;
  setLibraryMessage("library.loading", { item: displayEntryName(entry) }, "loading");
  renderLibrary();
  setRuntimeState("loading", "preview.loading");

  try {
    const definition = await loadItemDefinition(entry);
    const runtime = runtimeCache.restore(definition.forge.code, {
      expectedDesignHash: definition.forge.designHash,
      requireCanonical: true,
    });
    await verifyDefinitionAgainstRuntime(definition, runtime);
    if (request !== itemRequest) return;

    loadedDefinitions.set(entry.key, definition);
    selectedEntry = entry;
    selectedItem = definition;
    pendingItemKey = null;
    if (updateUrl) updateSelectedUrl(entry.key);
    renderLibrary();
    renderSelectedItem(runtime);
    setLibraryMessage("library.loaded", { item: localizedItemText(definition, "names", getLocale()) }, "ready");
  } catch {
    if (request !== itemRequest) return;
    pendingItemKey = null;
    renderLibrary();
    setRuntimeState("error", "preview.failed");
    setLibraryMessage("library.failure", { item: displayEntryName(entry) }, "error");
  }
}

async function verifyDefinitionAgainstRuntime(definition, runtime) {
  if (runtime.rawByteLength !== definition.forge.rawBytes
      || runtime.componentCount !== definition.forge.decodedComponentCount
      || runtime.vertexCount !== definition.forge.runtime.vertexCount
      || runtime.triangleCount !== definition.forge.runtime.triangleCount
      || Boolean(runtime.grip) !== definition.forge.hasGrip) {
    throw new Error("Runtime evidence does not match the item JSON.");
  }
  for (const component of definition.forge.materialComponents) {
    const material = materialRules.get(component.materialId);
    if (!material || material.itemCode !== component.itemCode) throw new Error("Item references a material outside the current smelting rules.");
  }
  const digest = await crypto.subtle.digest("SHA-256", runtime.bytes);
  const sha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  if (sha256 !== definition.forge.sha256) throw new Error("Item payload hash mismatch.");
}

function renderLibrary() {
  const query = els.search.value.trim().toLocaleLowerCase(getLocale());
  const active = catalog.categories.find((category) => category.key === activeCategory) ?? catalog.categories[0];
  const entries = query
    ? catalog.entries.filter((entry) => itemSearchText(entry).includes(query))
    : itemsInCategory(catalog, active);

  els.catalogCount.textContent = t("library.total", { count: catalog.entries.length });
  els.categoryTitle.textContent = query ? t("library.searchResults") : t(active.nameKey);
  els.categoryCount.textContent = t("library.listed", { count: entries.length });
  els.categories.replaceChildren(...catalog.categories.map((category) => {
    const count = itemsInCategory(catalog, category).length;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category.key;
    button.className = "category-button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(!query && category.key === active.key));
    button.setAttribute("aria-label", t("library.categorySelectAria", { category: t(category.nameKey), count }));
    button.classList.toggle("active", !query && category.key === active.key);
    const marker = document.createElement("i");
    marker.className = `category-marker marker-${category.key}`;
    marker.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = t(category.nameKey);
    const total = document.createElement("b");
    total.textContent = String(count).padStart(2, "0");
    button.append(marker, name, total);
    return button;
  }));

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "item-list-empty";
    empty.textContent = t("library.noResults");
    els.itemList.replaceChildren(empty);
  } else {
    els.itemList.replaceChildren(...entries.map(renderItemCard));
  }
  renderLibraryStatus();
}

function renderItemCard(entry) {
  const definition = loadedDefinitions.get(entry.key);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item-card";
  button.dataset.item = entry.key;
  button.setAttribute("role", "radio");
  button.setAttribute("aria-checked", String(entry.key === selectedEntry?.key));
  button.setAttribute("aria-label", t("library.selectAria", { item: displayEntryName(entry) }));
  button.classList.toggle("active", entry.key === selectedEntry?.key);
  button.classList.toggle("pending", entry.key === pendingItemKey);
  if (entry.key === pendingItemKey) button.setAttribute("aria-busy", "true");

  const index = catalog.entries.indexOf(entry) + 1;
  const serial = document.createElement("span");
  serial.className = "item-serial";
  serial.textContent = String(index).padStart(2, "0");
  const copy = document.createElement("span");
  copy.className = "item-card-copy";
  const name = document.createElement("strong");
  name.textContent = displayEntryName(entry);
  const key = document.createElement("code");
  key.textContent = entry.key;
  const stats = document.createElement("span");
  stats.className = "item-card-stats";
  if (definition) {
    stats.append(
      itemCardStat(t(`type.${definition.interaction}`)),
      itemCardStat(`${definition.forge.rawBytes} B`),
    );
  } else {
    stats.append(itemCardStat("JSON"), itemCardStat(t("library.onSelect")));
  }
  copy.append(name, key, stats);
  const arrow = document.createElement("span");
  arrow.className = "item-arrow";
  arrow.setAttribute("aria-hidden", "true");
  button.append(serial, copy, arrow);
  return button;
}

function renderSelectedItem(runtime) {
  const name = localizedItemText(selectedItem, "names", getLocale());
  els.itemTitle.textContent = name;
  els.itemDescription.textContent = localizedItemText(selectedItem, "descriptions", getLocale());
  els.modelSize.textContent = formatDimensions(selectedItem.dimensions);
  els.code.value = selectedItem.forge.code;
  els.copyCode.disabled = false;
  els.downloadJson.disabled = false;
  els.payloadBytes.textContent = `${selectedItem.forge.rawBytes} / 640 B`;
  els.payloadHash.textContent = selectedItem.forge.sha256;
  els.payloadHash.title = selectedItem.forge.sha256;
  els.interactionBadge.textContent = t(`type.${selectedItem.interaction}`);
  els.interactionBadge.dataset.type = selectedItem.interaction;
  setRuntimeState("verified", "preview.verified");
  renderSummaryTags();
  renderMetrics();
  renderVerification();
  renderBillOfMaterials();

  if (renderer) {
    renderer.setDesign(runtime.design, {
      componentMaterialIds: selectedItem.forge.materialComponents.map((component) => component.materialId),
    });
    renderer.setWorkpieceGrouped(true);
    setPreviewCamera(selectedItem);
  }
}

function renderLocalizedState() {
  renderLibrary();
  renderLibraryStatus();
  if (selectedItem) {
    const runtime = runtimeCache.peek(selectedItem.forge.code, { expectedDesignHash: selectedItem.forge.designHash });
    if (runtime) renderSelectedItem(runtime);
  } else {
    renderEmptyState();
  }
}

function renderEmptyState() {
  els.itemTitle.textContent = t("preview.emptyTitle");
  els.itemDescription.textContent = t("preview.emptyDescription");
  els.modelSize.textContent = "—";
  els.code.value = "";
  els.copyCode.disabled = true;
  els.downloadJson.disabled = true;
  els.payloadBytes.textContent = "0 / 640 B";
  els.payloadHash.textContent = "—";
  els.interactionBadge.textContent = "—";
  els.summaryTags.replaceChildren();
  els.metrics.replaceChildren(...[
    "metric.dimensions", "metric.mass", "metric.volume", "metric.payload", "metric.mesh", "metric.components",
  ].map((key) => metricCard(t(key), "—", t("metric.awaiting"))));
  els.verificationCount.textContent = "0 / 6";
  els.verificationList.replaceChildren(...verificationKeys().map((key) => verificationRow(t(key), false)));
  els.materialTypeCount.textContent = "—";
  const empty = document.createElement("div");
  empty.className = "bom-empty";
  empty.textContent = t("bom.empty");
  els.bomRows.replaceChildren(empty);
  setRuntimeState("waiting", "preview.waiting");
}

function renderSummaryTags() {
  const values = [
    t("tag.canonical"),
    t("tag.runtime"),
    t("tag.materials", { count: selectedItem.billOfMaterials.length }),
    selectedItem.forge.hasGrip ? t("tag.grip") : t("tag.placeable"),
  ];
  els.summaryTags.replaceChildren(...values.map((value) => {
    const tag = document.createElement("span");
    tag.textContent = value;
    return tag;
  }));
}

function renderMetrics() {
  const requirements = selectedItem.forge.requirements;
  const runtime = selectedItem.forge.runtime;
  els.metrics.replaceChildren(
    metricCard(t("metric.dimensions"), formatDimensions(selectedItem.dimensions), t("metric.dimensionsDetail")),
    metricCard(t("metric.mass"), formatMass(requirements.outputMassGrams), t("metric.massDetail")),
    metricCard(t("metric.volume"), formatVolume(requirements.requiredVolumeMm3), t("metric.volumeDetail")),
    metricCard(t("metric.payload"), `${selectedItem.forge.rawBytes} B`, t("metric.payloadDetail", { percent: Math.round(selectedItem.forge.rawBytes / 640 * 100) })),
    metricCard(t("metric.mesh"), formatNumber(runtime.triangleCount), t("metric.meshDetail", { vertices: formatNumber(runtime.vertexCount) })),
    metricCard(t("metric.components"), formatNumber(selectedItem.forge.decodedComponentCount), t("metric.componentsDetail")),
  );
}

function renderVerification() {
  els.verificationCount.textContent = "6 / 6";
  els.verificationList.replaceChildren(...verificationKeys().map((key) => verificationRow(t(key), true)));
}

function verificationKeys() {
  return [
    "verification.canonical", "verification.runtime", "verification.connected", "verification.grip",
    "verification.direction", "verification.materials",
  ];
}

function renderBillOfMaterials() {
  els.materialTypeCount.textContent = t("bom.types", { count: selectedItem.billOfMaterials.length });
  els.bomRows.replaceChildren(...selectedItem.billOfMaterials.map((material) => {
    const row = document.createElement("div");
    row.className = "bom-row";
    row.setAttribute("role", "row");
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = titleFromId(material.materialId);
    const id = document.createElement("code");
    id.textContent = `${material.materialId} · #${material.itemCode}`;
    identity.append(name, id);
    const volume = document.createElement("span");
    volume.textContent = formatVolume(material.usedVolumeMm3);
    const units = document.createElement("span");
    units.textContent = formatNumber(material.equivalentInputUnits);
    row.append(identity, volume, units);
    return row;
  }));
}

function setPreviewCamera(item) {
  const maxDimension = Math.max(item.dimensions.width, item.dimensions.height, item.dimensions.depth);
  renderer.setCamera({
    target: [0, 1.45 + item.dimensions.height * 0.46, 0],
    yaw: Number(item.preview?.yaw) || -0.72,
    pitch: Number(item.preview?.pitch) || 0.34,
    distance: Math.max(4.5, Math.min(7.2, 4.35 + maxDimension * 0.82)),
    fov: 34,
  });
}

function setRuntimeState(state, key) {
  els.runtimeState.dataset.state = state;
  const label = els.runtimeState.querySelector("b");
  label.textContent = t(key);
}

function setLibraryMessage(key, variables = {}, state = "ready") {
  libraryMessage = { key, variables, state };
  renderLibraryStatus();
}

function renderLibraryStatus() {
  els.libraryStatus.textContent = t(libraryMessage.key, libraryMessage.variables);
  els.libraryStatus.dataset.state = libraryMessage.state;
}

async function copyNcf1Code() {
  if (!selectedItem) return;
  try {
    await navigator.clipboard.writeText(selectedItem.forge.code);
  } catch {
    els.code.focus();
    els.code.select();
    document.execCommand("copy");
    els.code.setSelectionRange(0, 0);
  }
  els.copyCode.textContent = t("payload.copied");
  globalThis.setTimeout(() => { els.copyCode.textContent = t("payload.copy"); }, 1500);
}

function downloadSelectedJson() {
  if (!selectedItem) return;
  const blob = new Blob([`${JSON.stringify(selectedItem, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${selectedItem.key}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function metricCard(labelText, valueText, detailText) {
  const card = document.createElement("div");
  card.className = "metric-card";
  const label = document.createElement("span");
  label.textContent = labelText;
  const value = document.createElement("strong");
  value.textContent = valueText;
  const detail = document.createElement("small");
  detail.textContent = detailText;
  card.append(label, value, detail);
  return card;
}

function verificationRow(labelText, complete) {
  const row = document.createElement("li");
  row.className = complete ? "complete" : "pending";
  const icon = document.createElement("i");
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = labelText;
  const state = document.createElement("b");
  state.textContent = complete ? t("verification.pass") : t("verification.pending");
  row.append(icon, label, state);
  return row;
}

function itemCardStat(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span;
}

function itemSearchText(entry) {
  const definition = loadedDefinitions.get(entry.key);
  const localized = definition ? Object.values(definition.names).join(" ") : "";
  return `${entry.key} ${entry.label} ${localized}`.toLocaleLowerCase(getLocale());
}

function displayEntryName(entry) {
  const definition = loadedDefinitions.get(entry.key);
  return definition ? localizedItemText(definition, "names", getLocale()) : entry.label;
}

function updateSelectedUrl(key) {
  const url = new URL(location.href);
  url.searchParams.set("item", key);
  history.replaceState(null, "", url);
}

async function loadSmeltingRules() {
  const response = await fetch(new URL("../rules/smelting-rules.json", import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Smelting rules request failed with HTTP ${response.status}.`);
  const value = await response.json();
  if (value?.ruleSet !== "nicechunk-smelting-v1" || !Array.isArray(value.materials)) throw new TypeError("Invalid smelting rules JSON.");
  return value;
}

function formatDimensions(dimensions) {
  return [dimensions.width, dimensions.height, dimensions.depth]
    .map((value) => formatDecimal(value, 2))
    .join(" × ") + " m";
}

function formatMass(grams) {
  return grams >= 1000 ? `${formatDecimal(grams / 1000, 2)} kg` : `${formatNumber(grams)} g`;
}

function formatVolume(volumeMm3) {
  return volumeMm3 >= 1_000_000
    ? `${formatDecimal(volumeMm3 / 1_000_000, 2)} L`
    : `${formatDecimal(volumeMm3 / 1000, 1)} cm³`;
}

function formatNumber(value) {
  return new Intl.NumberFormat(getLocale()).format(value);
}

function formatDecimal(value, digits) {
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

function titleFromId(value) {
  return String(value).split("_").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}
