import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawn } from "node:child_process";

const itemRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = join(itemRoot, "..");
const localPort = Number(process.env.ITEM_NCM_TEST_PORT ?? 9877);
const debugPort = Number(process.env.ITEM_NCM_DEBUG_PORT ?? 9325);
const externalUrl = process.env.ITEM_NCM_TEST_URL ?? "";
const screenshotPath = process.env.ITEM_NCM_SCREENSHOT_PATH ?? "";
const rulesFile = process.env.ITEM_NCM_RULES_FILE ? normalize(process.env.ITEM_NCM_RULES_FILE) : "";
const server = externalUrl ? null : await startStaticServer(localPort);
const url = externalUrl || `http://127.0.0.1:${localPort}/item_ncm/`;
const profile = mkdtempSync(join(tmpdir(), "item-ncm-chrome-"));
const chrome = spawn(process.env.CHROME_BIN ?? "google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--use-angle=swiftshader",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

try {
  await pollJson(`http://127.0.0.1:${debugPort}/json/version`);
  const pageResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about%3Ablank`, { method: "PUT" });
  if (!pageResponse.ok) throw new Error(`Unable to create Chrome page: ${pageResponse.status}`);
  const page = await pageResponse.json();
  const client = await cdp(page.webSocketDebuggerUrl);
  const errors = [];
  const failedResponses = [];
  client.on("Runtime.exceptionThrown", (event) => errors.push(event.exceptionDetails?.text ?? "Runtime exception"));
  client.on("Log.entryAdded", (event) => {
    if (event.entry?.level === "error") errors.push(event.entry.text);
  });
  client.on("Network.responseReceived", (event) => {
    if (event.response.status >= 400) failedResponses.push(`${event.response.status} ${event.response.url}`);
  });
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Network.enable");
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
  await client.send("Page.navigate", { url });
  await waitFor(() => evaluate(client, `document.readyState === "complete"
    && document.querySelectorAll("[data-category]").length === 10
    && document.querySelectorAll("[data-item]").length === 4
    && document.querySelector("#runtimeState").dataset.state === "verified"`));

  const initial = await evaluate(client, `({
    locale: document.documentElement.lang,
    title: document.title,
    languageCount: document.querySelector("[data-language-select]").options.length,
    categoryCount: document.querySelectorAll("[data-category]").length,
    visibleItems: document.querySelectorAll("[data-item]").length,
    total: document.querySelector("#catalogCount").textContent,
    selected: document.querySelector("[data-item].active")?.dataset.item,
    itemTitle: document.querySelector("#itemTitle").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    metricCount: document.querySelectorAll("#metrics .metric-card").length,
    verificationCount: document.querySelectorAll("#verificationList .complete").length,
    bomCount: document.querySelectorAll("#bomRows .bom-row").length,
    fallbackHidden: document.querySelector("#previewFallback").hidden,
    canvasWidth: document.querySelector("#forgePreview").width,
    canvasHeight: document.querySelector("#forgePreview").height,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(initial.locale, "en");
  assert.equal(initial.title, "ITEM_NCM — NiceChunk Forge Item Registry");
  assert.equal(initial.languageCount, 9);
  assert.equal(initial.categoryCount, 10);
  assert.equal(initial.visibleItems, 4);
  assert.match(initial.total, /35 ITEMS/);
  assert.equal(initial.selected, "carbon-steel-prospector-pick");
  assert.equal(initial.itemTitle, "Carbon-steel Prospector Pick");
  assert.match(initial.payload, /^NCF1\./);
  assert.equal(initial.payloadBytes, "269 / 640 B");
  assert.equal(initial.metricCount, 6);
  assert.equal(initial.verificationCount, 6);
  assert.equal(initial.bomCount, 3);
  assert.equal(initial.fallbackHidden, true);
  assert.ok(initial.canvasWidth > 0 && initial.canvasHeight > 0);
  assert.equal(initial.scrollWidth, initial.clientWidth);
  assert.ok(initial.resources.includes("/item_ncm/locales/en.json"));
  assert.ok(initial.resources.includes("/item_ncm/json/catalog.json"));
  assert.ok(initial.resources.includes("/item_ncm/json/mining-tools/carbon-steel-prospector-pick.json"));
  assert.ok(initial.resources.includes("/rules/smelting-rules.json"));
  assert.ok(initial.resources.includes("/chunk.js/forge/forge-runtime-cache.js"));
  assert.ok(initial.resources.includes("/chunk.js/renderer/forge-workbench-renderer.js"));
  assert.equal(initial.resources.filter((path) => /^\/item_ncm\/json\/(?!catalog\.json)/.test(path)).length, 1);

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "zh-Hans" && document.querySelector("#itemTitle").textContent === "碳钢探矿镐"`));
  const chinese = await evaluate(client, `({
    title: document.title,
    heading: document.querySelector("#pageTitle").textContent,
    library: document.querySelector("#libraryTitle").textContent,
    item: document.querySelector("#itemTitle").textContent,
    category: document.querySelector("[data-category].active span").textContent,
    payload: document.querySelector("#codeOutput").value,
  })`);
  assert.equal(chinese.title, "ITEM_NCM — NiceChunk 锻造物品库");
  assert.equal(chinese.library, "物品库");
  assert.equal(chinese.item, "碳钢探矿镐");
  assert.equal(chinese.category, "采矿工具");
  assert.equal(chinese.payload, initial.payload, "locale changes must never alter canonical NCF1");

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));
  await evaluate(client, `document.querySelector('[data-category="furniture"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 3 && document.querySelector('[data-item="timber-workbench"]')`));
  const furnitureBrowse = await evaluate(client, `({
    activeCategory: document.querySelector("[data-category].active")?.dataset.category,
    activeItem: document.querySelector("[data-item].active")?.dataset.item ?? null,
    title: document.querySelector("#itemTitle").textContent,
    furnitureJsonLoaded: performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/furniture/")),
  })`);
  assert.equal(furnitureBrowse.activeCategory, "furniture");
  assert.equal(furnitureBrowse.activeItem, null);
  assert.equal(furnitureBrowse.title, "Carbon-steel Prospector Pick");
  assert.equal(furnitureBrowse.furnitureJsonLoaded, false, "category browsing must not load item JSON files");

  await evaluate(client, `document.querySelector('[data-item="timber-workbench"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="timber-workbench"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const workbench = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(workbench.title, "Timber Workbench");
  assert.equal(workbench.type, "PLACEABLE");
  assert.match(workbench.payload, /^NCF1\./);
  assert.notEqual(workbench.payload, initial.payload);
  assert.equal(workbench.materialRows, 2);
  assert.equal(workbench.selectedInUrl, "timber-workbench");
  assert.ok(workbench.resources.includes("/item_ncm/json/furniture/timber-workbench.json"));

  await evaluate(client, `document.querySelector('[data-category="cooking"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 2 && document.querySelector('[data-item="iron-hearth-cauldron"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/cooking/"))`), false,
    "category browsing must not load cooking item JSON files");
  await evaluate(client, `document.querySelector('[data-item="iron-hearth-cauldron"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-hearth-cauldron"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const cauldron = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(cauldron.title, "Iron Hearth Cauldron");
  assert.equal(cauldron.type, "PLACEABLE");
  assert.match(cauldron.payload, /^NCF1\./);
  assert.equal(cauldron.payloadBytes, "523 / 640 B");
  assert.equal(cauldron.materialRows, 2);
  assert.equal(cauldron.selectedInUrl, "iron-hearth-cauldron");
  assert.ok(cauldron.resources.includes("/item_ncm/json/cooking/iron-hearth-cauldron.json"));

  await evaluate(client, `document.querySelector('[data-item="iron-field-cooking-grate"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-field-cooking-grate"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const cookingGrate = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(cookingGrate.title, "Iron Field Cooking Grate");
  assert.equal(cookingGrate.type, "PLACEABLE");
  assert.equal(cookingGrate.payloadBytes, "195 / 640 B");
  assert.equal(cookingGrate.componentCount, "17");
  assert.equal(cookingGrate.selectedInUrl, "iron-field-cooking-grate");
  assert.ok(cookingGrate.resources.includes("/item_ncm/json/cooking/iron-field-cooking-grate.json"));

  await evaluate(client, `document.querySelector('[data-category="books-writing"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 7 && document.querySelector('[data-item="timber-bound-village-ledger"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/books-writing/"))`), false,
    "category browsing must not load book item JSON files");
  await evaluate(client, `document.querySelector('[data-item="timber-bound-village-ledger"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="timber-bound-village-ledger"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const villageLedger = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(villageLedger.title, "Timber-bound Village Ledger");
  assert.equal(villageLedger.type, "PLACEABLE");
  assert.equal(villageLedger.payloadBytes, "78 / 640 B");
  assert.equal(villageLedger.componentCount, "7");
  assert.equal(villageLedger.selectedInUrl, "timber-bound-village-ledger");
  assert.ok(villageLedger.resources.includes("/item_ncm/json/books-writing/timber-bound-village-ledger.json"));

  await evaluate(client, `document.querySelector('[data-item="open-civic-record-book"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="open-civic-record-book"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const openRecordBook = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(openRecordBook.title, "Open Civic Record Book");
  assert.equal(openRecordBook.type, "PLACEABLE");
  assert.equal(openRecordBook.payloadBytes, "72 / 640 B");
  assert.equal(openRecordBook.componentCount, "6");
  assert.equal(openRecordBook.selectedInUrl, "open-civic-record-book");
  assert.ok(openRecordBook.resources.includes("/item_ncm/json/books-writing/open-civic-record-book.json"));

  await evaluate(client, `document.querySelector('[data-item="stacked-archive-volumes"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="stacked-archive-volumes"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const archiveVolumes = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(archiveVolumes.title, "Stacked Archive Volumes");
  assert.equal(archiveVolumes.type, "PLACEABLE");
  assert.equal(archiveVolumes.payloadBytes, "129 / 640 B");
  assert.equal(archiveVolumes.componentCount, "12");
  assert.equal(archiveVolumes.selectedInUrl, "stacked-archive-volumes");
  assert.ok(archiveVolumes.resources.includes("/item_ncm/json/books-writing/stacked-archive-volumes.json"));

  await evaluate(client, `document.querySelector('[data-item="civilization-code-codex"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="civilization-code-codex"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const civilizationCodex = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(civilizationCodex.title, "Civilization Code Codex");
  assert.equal(civilizationCodex.type, "PLACEABLE");
  assert.equal(civilizationCodex.payloadBytes, "263 / 640 B");
  assert.equal(civilizationCodex.componentCount, "24");
  assert.equal(civilizationCodex.selectedInUrl, "civilization-code-codex");
  assert.ok(civilizationCodex.resources.includes("/item_ncm/json/books-writing/civilization-code-codex.json"));

  await evaluate(client, `document.querySelector('[data-item="mining-skill-manual"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="mining-skill-manual"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const miningManual = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(miningManual.title, "Mining Skill Manual");
  assert.equal(miningManual.type, "PLACEABLE");
  assert.equal(miningManual.payloadBytes, "157 / 640 B");
  assert.equal(miningManual.componentCount, "14");
  assert.equal(miningManual.selectedInUrl, "mining-skill-manual");
  assert.ok(miningManual.resources.includes("/item_ncm/json/books-writing/mining-skill-manual.json"));

  await evaluate(client, `document.querySelector('[data-item="forging-skill-treatise"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="forging-skill-treatise"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const forgingTreatise = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(forgingTreatise.title, "Forging Skill Treatise");
  assert.equal(forgingTreatise.type, "PLACEABLE");
  assert.equal(forgingTreatise.payloadBytes, "220 / 640 B");
  assert.equal(forgingTreatise.componentCount, "20");
  assert.equal(forgingTreatise.selectedInUrl, "forging-skill-treatise");
  assert.ok(forgingTreatise.resources.includes("/item_ncm/json/books-writing/forging-skill-treatise.json"));

  await evaluate(client, `document.querySelector('[data-item="farming-skill-handbook"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="farming-skill-handbook"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const farmingHandbook = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(farmingHandbook.title, "Farming Skill Handbook");
  assert.equal(farmingHandbook.type, "PLACEABLE");
  assert.equal(farmingHandbook.payloadBytes, "218 / 640 B");
  assert.equal(farmingHandbook.componentCount, "21");
  assert.equal(farmingHandbook.selectedInUrl, "farming-skill-handbook");
  assert.ok(farmingHandbook.resources.includes("/item_ncm/json/books-writing/farming-skill-handbook.json"));

  await evaluate(client, `document.querySelector('[data-category="mining-tools"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 4 && document.querySelector('[data-item="iron-earthwork-shovel"]')`));
  await evaluate(client, `document.querySelector('[data-item="iron-earthwork-shovel"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-earthwork-shovel"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const shovel = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(shovel.title, "Iron Earthwork Shovel");
  assert.equal(shovel.type, "HAND-HELD");
  assert.equal(shovel.payloadBytes, "122 / 640 B");
  assert.equal(shovel.selectedInUrl, "iron-earthwork-shovel");
  assert.ok(shovel.resources.includes("/item_ncm/json/mining-tools/iron-earthwork-shovel.json"));

  await evaluate(client, `document.querySelector('[data-category="forestry-farming"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 4 && document.querySelector('[data-item="copper-field-watering-can"]')`));
  await evaluate(client, `document.querySelector('[data-item="copper-field-watering-can"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="copper-field-watering-can"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const wateringCan = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(wateringCan.title, "Copper Field Watering Can");
  assert.equal(wateringCan.type, "HAND-HELD");
  assert.equal(wateringCan.payloadBytes, "170 / 640 B");
  assert.equal(wateringCan.selectedInUrl, "copper-field-watering-can");
  assert.ok(wateringCan.resources.includes("/item_ncm/json/forestry-farming/copper-field-watering-can.json"));

  await evaluate(client, `(() => {
    const search = document.querySelector("#itemSearch");
    search.value = "guardian-spear";
    search.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 1 && document.querySelector('[data-item="guardian-spear"]')`));
  assert.equal(await evaluate(client, `document.querySelector("#activeCategoryTitle").textContent`), "SEARCH RESULTS");

  await evaluate(client, `document.querySelector('[data-category="mining-tools"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 4 && document.querySelector('[data-category="mining-tools"].active')`));

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(client, `(() => {
    const search = document.querySelector("#itemSearch");
    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.clientWidth === 390 && document.querySelectorAll("[data-item]").length === 4`));
  const mobile = await evaluate(client, `(() => {
    const library = document.querySelector(".library-panel").getBoundingClientRect();
    const preview = document.querySelector(".preview-column").getBoundingClientRect();
    const details = document.querySelector(".details-panel").getBoundingClientRect();
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      categoryCount: document.querySelectorAll("[data-category]").length,
      itemCount: document.querySelectorAll("[data-item]").length,
      libraryBeforePreview: library.top < preview.top,
      previewBeforeDetails: preview.top < details.top,
      canvasHeight: document.querySelector("#forgePreview").getBoundingClientRect().height,
    };
  })()`);
  assert.equal(mobile.clientWidth, 390);
  assert.equal(mobile.scrollWidth, mobile.clientWidth, "mobile page must not create document-level horizontal overflow");
  assert.equal(mobile.categoryCount, 10);
  assert.equal(mobile.itemCount, 4);
  assert.equal(mobile.libraryBeforePreview, true);
  assert.equal(mobile.previewBeforeDetails, true);
  assert.ok(mobile.canvasHeight >= 380);

  if (screenshotPath) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  }

  assert.deepEqual(failedResponses, []);
  assert.deepEqual(errors, []);
  await client.close();
  console.log("item_ncm browser tests passed: desktop, lazy loading, i18n and 390px mobile");
} finally {
  chrome.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => chrome.once("close", resolve)),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
  server?.close();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function startStaticServer(port) {
  const server = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);
      const pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === "/item_ncm") {
        response.writeHead(308, { Location: "/item_ncm/" });
        response.end();
        return;
      }
      const file = publicFile(pathname);
      if (!file || !insideProject(file)) return notFound(response);
      const stat = statSync(file);
      const resolved = stat.isDirectory() ? join(file, "index.html") : file;
      const data = readFileSync(resolved);
      response.writeHead(200, {
        "Content-Type": mimeType(resolved),
        "Cache-Control": "no-store",
        "Content-Length": data.length,
      });
      response.end(data);
    } catch {
      notFound(response);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

function publicFile(pathname) {
  const clean = normalize(pathname).replace(/^[/\\]+/, "");
  if (pathname === "/rules/smelting-rules.json" && rulesFile) return rulesFile;
  if (pathname.startsWith("/item_ncm/") || pathname.startsWith("/chunk.js/")) return join(projectRoot, clean);
  if (pathname.startsWith("/rules/")) return join(projectRoot, "public", clean);
  return null;
}

function insideProject(file) {
  if (rulesFile && file === rulesFile) return true;
  const prefix = `${projectRoot}${sep}`;
  return file.startsWith(prefix) && !file.includes(`${sep}..${sep}`);
}

function notFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function mimeType(file) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
  })[extname(file)] ?? "application/octet-stream";
}

async function pollJson(endpoint) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Chrome DevTools did not start at ${endpoint}`);
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for browser state.");
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function cdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id) {
      const waiter = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(payload.error.message));
      else waiter.resolve(payload.result);
      return;
    }
    for (const listener of listeners.get(payload.method) ?? []) listener(payload.params);
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) ?? []), listener]);
    },
    close() {
      socket.close();
    },
  };
}
