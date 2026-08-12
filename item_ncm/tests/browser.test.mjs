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
const screenshotItem = process.env.ITEM_NCM_SCREENSHOT_ITEM ?? "";
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
    && document.querySelectorAll("[data-category]").length === 16
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
  assert.equal(initial.categoryCount, 16);
  assert.equal(initial.visibleItems, 4);
  assert.match(initial.total, /63 ITEMS/);
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

  await evaluate(client, `document.querySelector('[data-category="handheld-civic"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 1
    && document.querySelector('[data-item="copper-town-crier-handbell"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/handheld-civic/"))`), false,
    "category browsing must not load handheld civic item JSON files");
  await evaluate(client, `document.querySelector('[data-item="copper-town-crier-handbell"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="copper-town-crier-handbell"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const handbell = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(handbell.title, "Copper Town Crier Handbell");
  assert.equal(handbell.type, "HAND-HELD");
  assert.match(handbell.payload, /^NCF1\./);
  assert.equal(handbell.payloadBytes, "475 / 640 B");
  assert.equal(handbell.componentCount, "6");
  assert.equal(handbell.materialRows, 3);
  assert.equal(handbell.selectedInUrl, "copper-town-crier-handbell");
  assert.ok(handbell.resources.includes("/item_ncm/json/handheld-civic/copper-town-crier-handbell.json"));
  const handbellPreview = await evaluate(client, `(() => {
    return {
      clothMotion: document.querySelector("#forgePreview").dataset.clothMotion,
      width: document.querySelector("#forgePreview").width,
      height: document.querySelector("#forgePreview").height,
    };
  })()`);
  assert.equal(handbellPreview.clothMotion, "dynamic");
  assert.ok(handbellPreview.width > 0 && handbellPreview.height > 0);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "铜制城镇传令手铃"`));
  assert.equal(await evaluate(client, `document.querySelector('[data-category="handheld-civic"] span').textContent`), "手持公共道具");
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), handbell.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-category="lighting"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 4 && document.querySelector('[data-item="amber-village-street-lantern"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/lighting/"))`), false,
    "category browsing must not load lighting item JSON files");
  await evaluate(client, `document.querySelector('[data-item="amber-village-street-lantern"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="amber-village-street-lantern"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const streetLantern = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(streetLantern.title, "Amber Village Street Lantern");
  assert.equal(streetLantern.type, "PLACEABLE");
  assert.match(streetLantern.payload, /^NCF1\./);
  assert.equal(streetLantern.payloadBytes, "160 / 640 B");
  assert.equal(streetLantern.componentCount, "14");
  assert.equal(streetLantern.materialRows, 5);
  assert.equal(streetLantern.selectedInUrl, "amber-village-street-lantern");
  assert.ok(streetLantern.resources.includes("/item_ncm/json/lighting/amber-village-street-lantern.json"));
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "琥珀玻璃村庄街灯"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), streetLantern.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-category="furniture"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 14
    && document.querySelector('[data-item="timber-workbench"]')
    && document.querySelector('[data-item="iron-braced-timber-village-inn-double-door-wardrobe"]')`));
  const furnitureBrowse = await evaluate(client, `({
    activeCategory: document.querySelector("[data-category].active")?.dataset.category,
    activeItem: document.querySelector("[data-item].active")?.dataset.item ?? null,
    title: document.querySelector("#itemTitle").textContent,
    furnitureJsonLoaded: performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/furniture/")),
  })`);
  assert.equal(furnitureBrowse.activeCategory, "furniture");
  assert.equal(furnitureBrowse.activeItem, null);
  assert.equal(furnitureBrowse.title, "Amber Village Street Lantern");
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

  await evaluate(client, `document.querySelector('[data-item="timber-apothecary-drawer-cabinet"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="timber-apothecary-drawer-cabinet"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const apothecaryCabinet = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(apothecaryCabinet.title, "Timber Apothecary Drawer Cabinet");
  assert.equal(apothecaryCabinet.type, "PLACEABLE");
  assert.match(apothecaryCabinet.payload, /^NCF1\./);
  assert.equal(apothecaryCabinet.payloadBytes, "255 / 640 B");
  assert.equal(apothecaryCabinet.componentCount, "23");
  assert.equal(apothecaryCabinet.materialRows, 3);
  assert.equal(apothecaryCabinet.selectedInUrl, "timber-apothecary-drawer-cabinet");
  assert.ok(apothecaryCabinet.resources.includes("/item_ncm/json/furniture/timber-apothecary-drawer-cabinet.json"));

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "木制药材抽屉柜"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), apothecaryCabinet.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-village-public-bench"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-village-public-bench"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const publicBench = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(publicBench.title, "Iron-braced Village Public Bench");
  assert.equal(publicBench.type, "PLACEABLE");
  assert.match(publicBench.payload, /^NCF1\./);
  assert.equal(publicBench.payloadBytes, "153 / 640 B");
  assert.equal(publicBench.componentCount, "13");
  assert.equal(publicBench.materialRows, 3);
  assert.equal(publicBench.selectedInUrl, "iron-braced-village-public-bench");
  assert.ok(publicBench.resources.includes("/item_ncm/json/furniture/iron-braced-village-public-bench.json"));
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "铁箍村庄公共长椅"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), publicBench.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-coat-rack"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-coat-rack"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const coatRack = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(coatRack.title, "Iron-braced Timber Village Inn Coat Rack");
  assert.equal(coatRack.type, "PLACEABLE");
  assert.match(coatRack.payload, /^NCF1\./);
  assert.equal(coatRack.payloadBytes, "247 / 640 B");
  assert.equal(coatRack.componentCount, "23");
  assert.equal(coatRack.materialRows, 3);
  assert.equal(coatRack.selectedInUrl, "iron-braced-timber-village-inn-coat-rack");
  assert.ok(coatRack.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-coat-rack.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Coat Rack",
    es: "Perchero de posada de aldea de madera reforzado con hierro",
    fr: "Portemanteau d’auberge villageoise en bois renforcé de fer",
    de: "Eisenverstärkter Holzkleiderständer für Dorfgasthäuser",
    ja: "鉄補強の木製村宿コート掛け",
    ru: "Деревянная вешалка деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 옷걸이",
    "zh-Hant": "鐵箍木製村莊旅店衣帽架",
    "zh-Hans": "铁箍木制村庄客栈衣帽架",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), coatRack.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-bedside-table"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-bedside-table"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const bedsideTable = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(bedsideTable.title, "Iron-braced Timber Village Inn Bedside Table");
  assert.equal(bedsideTable.type, "PLACEABLE");
  assert.match(bedsideTable.payload, /^NCF1\./);
  assert.equal(bedsideTable.payloadBytes, "227 / 640 B");
  assert.equal(bedsideTable.componentCount, "20");
  assert.equal(bedsideTable.materialRows, 3);
  assert.equal(bedsideTable.selectedInUrl, "iron-braced-timber-village-inn-bedside-table");
  assert.ok(bedsideTable.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-bedside-table.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Bedside Table",
    es: "Mesita de noche de posada de aldea de madera reforzada con hierro",
    fr: "Table de chevet d’auberge villageoise en bois renforcée de fer",
    de: "Eisenverstärkter Holz-Nachttisch für Dorfgasthäuser",
    ja: "鉄補強の木製村宿ベッドサイドテーブル",
    ru: "Деревянная прикроватная тумба деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 침대 탁자",
    "zh-Hant": "鐵箍木製村莊旅店床頭櫃",
    "zh-Hans": "铁箍木制村庄客栈床头柜",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), bedsideTable.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="copper-basin-timber-village-inn-washstand"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="copper-basin-timber-village-inn-washstand"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const washstand = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(washstand.title, "Copper-basin Timber Village Inn Washstand");
  assert.equal(washstand.type, "PLACEABLE");
  assert.match(washstand.payload, /^NCF1\./);
  assert.equal(washstand.payloadBytes, "229 / 640 B");
  assert.equal(washstand.componentCount, "21");
  assert.equal(washstand.materialRows, 5);
  assert.equal(washstand.selectedInUrl, "copper-basin-timber-village-inn-washstand");
  assert.ok(washstand.resources.includes("/item_ncm/json/furniture/copper-basin-timber-village-inn-washstand.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Copper-basin Timber Village Inn Washstand",
    es: "Lavabo de posada de aldea de madera con palangana de cobre",
    fr: "Meuble de toilette d’auberge villageoise en bois avec bassin en cuivre",
    de: "Holzwaschtisch für Dorfgasthäuser mit Kupferbecken",
    ja: "銅たらい付き木製村宿洗面台",
    ru: "Деревянный умывальный столик деревенской гостиницы с медным тазом",
    ko: "구리 세숫대야 목재 마을 여관 세면대",
    "zh-Hant": "銅盆木製村莊旅店盥洗架",
    "zh-Hans": "铜盆木制村庄客栈盥洗架",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), washstand.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-single-bed-frame"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-single-bed-frame"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const singleBedFrame = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(singleBedFrame.title, "Iron-braced Timber Village Inn Single Bed Frame");
  assert.equal(singleBedFrame.type, "PLACEABLE");
  assert.match(singleBedFrame.payload, /^NCF1\./);
  assert.equal(singleBedFrame.payloadBytes, "270 / 640 B");
  assert.equal(singleBedFrame.componentCount, "24");
  assert.equal(singleBedFrame.materialRows, 3);
  assert.equal(singleBedFrame.selectedInUrl, "iron-braced-timber-village-inn-single-bed-frame");
  assert.ok(singleBedFrame.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-single-bed-frame.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Single Bed Frame",
    es: "Bastidor de cama individual de posada de aldea de madera reforzado con hierro",
    fr: "Cadre de lit simple d’auberge villageoise en bois renforcé de fer",
    de: "Eisenverstärktes Einzelbettgestell aus Holz für Dorfgasthäuser",
    ja: "鉄補強の木製村宿シングルベッド枠",
    ru: "Деревянный каркас односпальной кровати деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 1인용 침대틀",
    "zh-Hant": "鐵箍木製村莊旅店單人床架",
    "zh-Hans": "铁箍木制村庄客栈单人床架",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), singleBedFrame.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-hooked-timber-village-inn-room-key-board"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-hooked-timber-village-inn-room-key-board"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const roomKeyBoard = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(roomKeyBoard.title, "Iron-hooked Timber Village Inn Room-key Board");
  assert.equal(roomKeyBoard.type, "PLACEABLE");
  assert.match(roomKeyBoard.payload, /^NCF1\./);
  assert.equal(roomKeyBoard.payloadBytes, "343 / 640 B");
  assert.equal(roomKeyBoard.componentCount, "19");
  assert.equal(roomKeyBoard.materialRows, 3);
  assert.equal(roomKeyBoard.selectedInUrl, "iron-hooked-timber-village-inn-room-key-board");
  assert.ok(roomKeyBoard.resources.includes("/item_ncm/json/furniture/iron-hooked-timber-village-inn-room-key-board.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-hooked Timber Village Inn Room-key Board",
    es: "Tablero de llaves de habitaciones de posada de aldea en madera con ganchos de hierro",
    fr: "Tableau à clés de chambres d’auberge villageoise en bois avec crochets en fer",
    de: "Hölzernes Zimmerschlüsselbrett für Dorfgasthäuser mit Eisenhaken",
    ja: "鉄フック付き木製村宿客室鍵掛け板",
    ru: "Деревянная доска для ключей от номеров деревенской гостиницы с железными крючками",
    ko: "철제 갈고리 목재 마을 여관 객실 열쇠판",
    "zh-Hant": "鐵鉤木製村莊旅店房間鑰匙板",
    "zh-Hans": "铁钩木制村庄客栈房间钥匙板",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), roomKeyBoard.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-luggage-rack"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-luggage-rack"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const luggageRack = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(luggageRack.title, "Iron-braced Timber Village Inn Luggage Rack");
  assert.equal(luggageRack.type, "PLACEABLE");
  assert.match(luggageRack.payload, /^NCF1\./);
  assert.equal(luggageRack.payloadBytes, "270 / 640 B");
  assert.equal(luggageRack.componentCount, "24");
  assert.equal(luggageRack.materialRows, 3);
  assert.equal(luggageRack.selectedInUrl, "iron-braced-timber-village-inn-luggage-rack");
  assert.ok(luggageRack.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-luggage-rack.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Luggage Rack",
    es: "Portaequipajes de posada de aldea de madera reforzado con hierro",
    fr: "Porte-bagages d’auberge villageoise en bois renforcé de fer",
    de: "Eisenverstärkte Holz-Gepäckablage für Dorfgasthäuser",
    ja: "鉄補強の木製村宿荷物台",
    ru: "Деревянная багажная подставка деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 짐받이",
    "zh-Hant": "鐵箍木製村莊旅店行李架",
    "zh-Hans": "铁箍木制村庄客栈行李架",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), luggageRack.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-writing-desk"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-writing-desk"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const writingDesk = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(writingDesk.title, "Iron-braced Timber Village Inn Writing Desk");
  assert.equal(writingDesk.type, "PLACEABLE");
  assert.match(writingDesk.payload, /^NCF1\./);
  assert.equal(writingDesk.payloadBytes, "238 / 640 B");
  assert.equal(writingDesk.componentCount, "21");
  assert.equal(writingDesk.materialRows, 3);
  assert.equal(writingDesk.selectedInUrl, "iron-braced-timber-village-inn-writing-desk");
  assert.ok(writingDesk.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-writing-desk.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Writing Desk",
    es: "Escritorio de posada de aldea de madera reforzado con hierro",
    fr: "Bureau d’écriture d’auberge villageoise en bois renforcé de fer",
    de: "Eisenverstärkter Holzschreibtisch für Dorfgasthäuser",
    ja: "鉄補強の木製村宿書き物机",
    ru: "Деревянный письменный стол деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 책상",
    "zh-Hant": "鐵箍木製村莊旅店寫字桌",
    "zh-Hans": "铁箍木制村庄客栈写字桌",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), writingDesk.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-writing-chair"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-writing-chair"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const writingChair = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(writingChair.title, "Iron-braced Timber Village Inn Writing Chair");
  assert.equal(writingChair.type, "PLACEABLE");
  assert.match(writingChair.payload, /^NCF1\./);
  assert.equal(writingChair.payloadBytes, "217 / 640 B");
  assert.equal(writingChair.componentCount, "19");
  assert.equal(writingChair.materialRows, 3);
  assert.equal(writingChair.selectedInUrl, "iron-braced-timber-village-inn-writing-chair");
  assert.ok(writingChair.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-writing-chair.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Writing Chair",
    es: "Silla de escritorio de posada de aldea de madera reforzada con hierro",
    fr: "Chaise de bureau d’auberge villageoise en bois renforcée de fer",
    de: "Eisenverstärkter Holzschreibstuhl für Dorfgasthäuser",
    ja: "鉄補強の木製村宿書き物椅子",
    ru: "Деревянный письменный стул деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 책상 의자",
    "zh-Hant": "鐵箍木製村莊旅店寫字椅",
    "zh-Hans": "铁箍木制村庄客栈写字椅",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), writingChair.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-double-door-wardrobe"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-double-door-wardrobe"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const doubleDoorWardrobe = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(doubleDoorWardrobe.title, "Iron-braced Timber Village Inn Double-door Wardrobe");
  assert.equal(doubleDoorWardrobe.type, "PLACEABLE");
  assert.match(doubleDoorWardrobe.payload, /^NCF1\./);
  assert.equal(doubleDoorWardrobe.payloadBytes, "270 / 640 B");
  assert.equal(doubleDoorWardrobe.componentCount, "24");
  assert.equal(doubleDoorWardrobe.materialRows, 3);
  assert.equal(doubleDoorWardrobe.selectedInUrl, "iron-braced-timber-village-inn-double-door-wardrobe");
  assert.ok(doubleDoorWardrobe.resources.includes("/item_ncm/json/furniture/iron-braced-timber-village-inn-double-door-wardrobe.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Double-door Wardrobe",
    es: "Armario de dos puertas de posada de aldea de madera reforzado con hierro",
    fr: "Armoire à deux portes d’auberge villageoise en bois renforcée de fer",
    de: "Eisenverstärkter zweitüriger Holzkleiderschrank für Dorfgasthäuser",
    ja: "鉄補強の木製村宿両開き衣装戸棚",
    ru: "Двухдверный деревянный шкаф деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 양문 옷장",
    "zh-Hant": "鐵箍木製村莊旅店雙門衣櫃",
    "zh-Hans": "铁箍木制村庄客栈双门衣柜",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), doubleDoorWardrobe.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-category="commerce"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 2
    && document.querySelector('[data-item="iron-braced-timber-village-inn-reception-counter"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/commerce/"))`), false,
    "category browsing must not load commerce item JSON files");
  await evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-reception-counter"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-timber-village-inn-reception-counter"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const receptionCounter = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(receptionCounter.title, "Iron-braced Timber Village Inn Reception Counter");
  assert.equal(receptionCounter.type, "PLACEABLE");
  assert.match(receptionCounter.payload, /^NCF1\./);
  assert.equal(receptionCounter.payloadBytes, "227 / 640 B");
  assert.equal(receptionCounter.componentCount, "20");
  assert.equal(receptionCounter.materialRows, 3);
  assert.equal(receptionCounter.selectedInUrl, "iron-braced-timber-village-inn-reception-counter");
  assert.ok(receptionCounter.resources.includes("/item_ncm/json/commerce/iron-braced-timber-village-inn-reception-counter.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-braced Timber Village Inn Reception Counter",
    es: "Mostrador de recepción de posada de aldea de madera reforzado con hierro",
    fr: "Comptoir d’accueil d’auberge villageoise en bois renforcé de fer",
    de: "Eisenverstärkter Holzempfangstresen für Dorfgasthäuser",
    ja: "鉄補強の木製村宿受付カウンター",
    ru: "Деревянная стойка регистрации деревенской гостиницы с железными скобами",
    ko: "철제 보강 목재 마을 여관 접수대",
    "zh-Hant": "鐵箍木製村莊旅店接待櫃檯",
    "zh-Hans": "铁箍木制村庄客栈接待柜台",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), receptionCounter.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

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
  await assertRigidClothPreview(client, { verifyFrames: true });

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
  await assertRigidClothPreview(client);

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
  await assertRigidClothPreview(client);

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
  await assertRigidClothPreview(client);

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
  await assertRigidClothPreview(client);

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
  await assertRigidClothPreview(client);

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
  await assertRigidClothPreview(client);

  await evaluate(client, `document.querySelector('[data-category="interior-decor"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 4
    && document.querySelector('[data-item="timber-framed-woven-tapestry"]')
    && document.querySelector('[data-item="copper-rimmed-village-wall-clock"]')
    && document.querySelector('[data-item="polished-copper-timber-village-inn-wall-mirror"]')
    && document.querySelector('[data-item="iron-hinged-timber-village-inn-privacy-screen"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/interior-decor/"))`), false,
    "category browsing must not load interior decor item JSON files");
  await evaluate(client, `document.querySelector('[data-item="timber-framed-woven-tapestry"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="timber-framed-woven-tapestry"].active') && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const tapestry = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(tapestry.title, "Timber-framed Woven Tapestry");
  assert.equal(tapestry.type, "PLACEABLE");
  assert.match(tapestry.payload, /^NCF1\./);
  assert.equal(tapestry.payloadBytes, "299 / 640 B");
  assert.equal(tapestry.componentCount, "22");
  assert.equal(tapestry.selectedInUrl, "timber-framed-woven-tapestry");
  assert.ok(tapestry.resources.includes("/item_ncm/json/interior-decor/timber-framed-woven-tapestry.json"));
  await assertRigidClothPreview(client, { verifyFrames: true });

  await evaluate(client, `document.querySelector('[data-item="copper-rimmed-village-wall-clock"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="copper-rimmed-village-wall-clock"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const wallClock = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(wallClock.title, "Copper-rimmed Village Wall Clock");
  assert.equal(wallClock.type, "PLACEABLE");
  assert.match(wallClock.payload, /^NCF1\./);
  assert.equal(wallClock.payloadBytes, "591 / 640 B");
  assert.equal(wallClock.componentCount, "20");
  assert.equal(wallClock.materialRows, 5);
  assert.equal(wallClock.selectedInUrl, "copper-rimmed-village-wall-clock");
  assert.ok(wallClock.resources.includes("/item_ncm/json/interior-decor/copper-rimmed-village-wall-clock.json"));

  await evaluate(client, `document.querySelector('[data-item="polished-copper-timber-village-inn-wall-mirror"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="polished-copper-timber-village-inn-wall-mirror"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const wallMirror = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(wallMirror.title, "Polished-copper Timber Village Inn Wall Mirror");
  assert.equal(wallMirror.type, "PLACEABLE");
  assert.match(wallMirror.payload, /^NCF1\./);
  assert.equal(wallMirror.payloadBytes, "141 / 640 B");
  assert.equal(wallMirror.componentCount, "12");
  assert.equal(wallMirror.materialRows, 4);
  assert.equal(wallMirror.selectedInUrl, "polished-copper-timber-village-inn-wall-mirror");
  assert.ok(wallMirror.resources.includes("/item_ncm/json/interior-decor/polished-copper-timber-village-inn-wall-mirror.json"));
  for (const [locale, expectedName] of Object.entries({
    en: "Polished-copper Timber Village Inn Wall Mirror",
    es: "Espejo de pared de posada de aldea de madera con cobre pulido",
    fr: "Miroir mural d’auberge villageoise en bois à face de cuivre poli",
    de: "Dorfherbergen-Wandspiegel aus Holz mit polierter Kupferfläche",
    ja: "磨き銅面の木製村宿壁鏡",
    ru: "Настенное зеркало деревенской гостиницы в деревянной раме с полированной медной поверхностью",
    ko: "광택 구리면 목재 마을 여관 벽거울",
    "zh-Hant": "拋光銅面木框村莊旅店壁鏡",
    "zh-Hans": "抛光铜面木框村庄客栈壁镜",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), wallMirror.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-hinged-timber-village-inn-privacy-screen"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-hinged-timber-village-inn-privacy-screen"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const privacyScreen = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    clothMotion: document.querySelector("#forgePreview").dataset.clothMotion,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(privacyScreen.title, "Iron-hinged Timber Village Inn Privacy Screen");
  assert.equal(privacyScreen.type, "PLACEABLE");
  assert.match(privacyScreen.payload, /^NCF1\./);
  assert.equal(privacyScreen.payloadBytes, "233 / 640 B");
  assert.equal(privacyScreen.componentCount, "21");
  assert.equal(privacyScreen.materialRows, 3);
  assert.equal(privacyScreen.clothMotion, "rigid");
  assert.equal(privacyScreen.selectedInUrl, "iron-hinged-timber-village-inn-privacy-screen");
  assert.ok(privacyScreen.resources.includes("/item_ncm/json/interior-decor/iron-hinged-timber-village-inn-privacy-screen.json"));
  await assertRigidClothPreview(client, { verifyFrames: true });
  for (const [locale, expectedName] of Object.entries({
    en: "Iron-hinged Timber Village Inn Privacy Screen",
    es: "Biombo de privacidad de posada de aldea de madera con bisagras de hierro",
    fr: "Paravent d’intimité d’auberge villageoise en bois à charnières de fer",
    de: "Holz-Sichtschutz mit Eisenscharnieren für Dorfgasthäuser",
    ja: "鉄蝶番付き木製村宿間仕切り",
    ru: "Деревянная ширма деревенской гостиницы с железными петлями",
    ko: "철제 경첩 목재 마을 여관 가림막",
    "zh-Hant": "鐵鉸鏈木製村莊旅店屏風",
    "zh-Hans": "铁铰链木制村庄客栈屏风",
  })) {
    await evaluate(client, `(() => {
      const select = document.querySelector("[data-language-select]");
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector("#itemTitle").textContent === ${JSON.stringify(expectedName)}`));
    assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), privacyScreen.payload);
  }
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-category="signage"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 2
    && document.querySelector('[data-item="iron-bracketed-village-shop-sign"]')
    && document.querySelector('[data-item="timber-village-public-notice-board"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/signage/"))`), false,
    "category browsing must not load signage item JSON files");
  await evaluate(client, `document.querySelector('[data-item="iron-bracketed-village-shop-sign"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-bracketed-village-shop-sign"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const shopSign = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(shopSign.title, "Iron-bracketed Village Shop Sign");
  assert.equal(shopSign.type, "PLACEABLE");
  assert.match(shopSign.payload, /^NCF1\./);
  assert.equal(shopSign.componentCount, "17");
  assert.equal(shopSign.materialRows, 5);
  assert.equal(shopSign.selectedInUrl, "iron-bracketed-village-shop-sign");
  assert.ok(shopSign.resources.includes("/item_ncm/json/signage/iron-bracketed-village-shop-sign.json"));

  await evaluate(client, `document.querySelector('[data-item="timber-village-public-notice-board"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="timber-village-public-notice-board"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const noticeBoard = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(noticeBoard.title, "Timber Village Public Notice Board");
  assert.equal(noticeBoard.type, "PLACEABLE");
  assert.match(noticeBoard.payload, /^NCF1\./);
  assert.equal(noticeBoard.payloadBytes, "287 / 640 B");
  assert.equal(noticeBoard.componentCount, "21");
  assert.equal(noticeBoard.materialRows, 5);
  assert.equal(noticeBoard.selectedInUrl, "timber-village-public-notice-board");
  assert.ok(noticeBoard.resources.includes("/item_ncm/json/signage/timber-village-public-notice-board.json"));

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "木制村庄公共公告板"`));
  assert.equal(await evaluate(client, `document.querySelector('[data-category="signage"] span').textContent`), "招牌与公告板");
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), noticeBoard.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

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

  await evaluate(client, `document.querySelector('[data-category="exterior-decor"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelectorAll("[data-item]").length === 5
    && document.querySelector('[data-item="iron-braced-village-window-box-planter"]')
    && document.querySelector('[data-item="stone-and-timber-village-drinking-trough"]')
    && document.querySelector('[data-item="stone-and-timber-village-roadside-well"]')
    && document.querySelector('[data-item="stone-and-timber-village-roadside-direction-signpost"]')
    && document.querySelector('[data-item="iron-braced-village-public-litter-bin"]')`));
  assert.equal(await evaluate(client, `performance.getEntriesByType("resource").some((entry) => new URL(entry.name).pathname.includes("/item_ncm/json/exterior-decor/"))`), false,
    "category browsing must not load exterior decor item JSON files");
  await evaluate(client, `document.querySelector('[data-item="iron-braced-village-window-box-planter"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-village-window-box-planter"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const windowBox = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(windowBox.title, "Iron-braced Village Window-box Planter");
  assert.equal(windowBox.type, "PLACEABLE");
  assert.match(windowBox.payload, /^NCF1\./);
  assert.equal(windowBox.payloadBytes, "315 / 640 B");
  assert.equal(windowBox.componentCount, "15");
  assert.equal(windowBox.materialRows, 6);
  assert.equal(windowBox.selectedInUrl, "iron-braced-village-window-box-planter");
  assert.ok(windowBox.resources.includes("/item_ncm/json/exterior-decor/iron-braced-village-window-box-planter.json"));
  const windowBoxPreview = await evaluate(client, `(() => {
    const canvas = document.querySelector("#forgePreview");
    return { width: canvas.width, height: canvas.height };
  })()`);
  assert.ok(windowBoxPreview.width > 0 && windowBoxPreview.height > 0);

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "铁箍村庄窗台花箱"`));
  assert.equal(await evaluate(client, `document.querySelector('[data-category="exterior-decor"] span').textContent`), "室外装饰");
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), windowBox.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-drinking-trough"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-drinking-trough"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const drinkingTrough = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(drinkingTrough.title, "Stone-and-timber Village Drinking Trough");
  assert.equal(drinkingTrough.type, "PLACEABLE");
  assert.match(drinkingTrough.payload, /^NCF1\./);
  assert.equal(drinkingTrough.componentCount, "11");
  assert.equal(drinkingTrough.materialRows, 4);
  assert.equal(drinkingTrough.selectedInUrl, "stone-and-timber-village-drinking-trough");
  assert.ok(drinkingTrough.resources.includes("/item_ncm/json/exterior-decor/stone-and-timber-village-drinking-trough.json"));
  assert.equal(drinkingTrough.payloadBytes, "132 / 640 B");

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "石木村庄公共饮水槽"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), drinkingTrough.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-roadside-well"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-roadside-well"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const roadsideWell = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(roadsideWell.title, "Stone-and-timber Village Roadside Well");
  assert.equal(roadsideWell.type, "PLACEABLE");
  assert.match(roadsideWell.payload, /^NCF1\./);
  assert.equal(roadsideWell.payloadBytes, "624 / 640 B");
  assert.equal(roadsideWell.componentCount, "18");
  assert.equal(roadsideWell.materialRows, 4);
  assert.equal(roadsideWell.selectedInUrl, "stone-and-timber-village-roadside-well");
  assert.ok(roadsideWell.resources.includes("/item_ncm/json/exterior-decor/stone-and-timber-village-roadside-well.json"));

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "石木村庄路边水井"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), roadsideWell.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-roadside-direction-signpost"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="stone-and-timber-village-roadside-direction-signpost"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const directionSignpost = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(directionSignpost.title, "Stone-and-timber Village Roadside Direction Signpost");
  assert.equal(directionSignpost.type, "PLACEABLE");
  assert.match(directionSignpost.payload, /^NCF1\./);
  assert.equal(directionSignpost.payloadBytes, "238 / 640 B");
  assert.equal(directionSignpost.componentCount, "15");
  assert.equal(directionSignpost.materialRows, 4);
  assert.equal(directionSignpost.selectedInUrl, "stone-and-timber-village-roadside-direction-signpost");
  assert.ok(directionSignpost.resources.includes("/item_ncm/json/exterior-decor/stone-and-timber-village-roadside-direction-signpost.json"));

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "石木村庄路边指路牌"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), directionSignpost.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

  await evaluate(client, `document.querySelector('[data-item="iron-braced-village-public-litter-bin"]').click()`);
  await waitFor(() => evaluate(client, `document.querySelector('[data-item="iron-braced-village-public-litter-bin"].active')
    && document.querySelector("#runtimeState").dataset.state === "verified"`));
  const publicLitterBin = await evaluate(client, `({
    title: document.querySelector("#itemTitle").textContent,
    type: document.querySelector("#interactionBadge").textContent,
    payload: document.querySelector("#codeOutput").value,
    payloadBytes: document.querySelector("#payloadBytes").textContent,
    componentCount: document.querySelectorAll("#metrics .metric-card")[5].querySelector("strong").textContent,
    materialRows: document.querySelectorAll("#bomRows .bom-row").length,
    selectedInUrl: new URL(location.href).searchParams.get("item"),
    resources: performance.getEntriesByType("resource").map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(publicLitterBin.title, "Iron-braced Village Public Litter Bin");
  assert.equal(publicLitterBin.type, "PLACEABLE");
  assert.match(publicLitterBin.payload, /^NCF1\./);
  assert.equal(publicLitterBin.payloadBytes, "270 / 640 B");
  assert.equal(publicLitterBin.componentCount, "24");
  assert.equal(publicLitterBin.materialRows, 2);
  assert.equal(publicLitterBin.selectedInUrl, "iron-braced-village-public-litter-bin");
  assert.ok(publicLitterBin.resources.includes("/item_ncm/json/exterior-decor/iron-braced-village-public-litter-bin.json"));

  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "zh-Hans";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.querySelector("#itemTitle").textContent === "铁箍村庄公共垃圾桶"`));
  assert.equal(await evaluate(client, `document.querySelector("#codeOutput").value`), publicLitterBin.payload);
  await evaluate(client, `(() => {
    const select = document.querySelector("[data-language-select]");
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, `document.documentElement.lang === "en"`));

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
  assert.equal(mobile.categoryCount, 16);
  assert.equal(mobile.itemCount, 4);
  assert.equal(mobile.libraryBeforePreview, true);
  assert.equal(mobile.previewBeforeDetails, true);
  assert.ok(mobile.canvasHeight >= 380);

  if (screenshotPath) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
    if (screenshotItem) {
      assert.match(screenshotItem, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      const screenshotUrl = new URL(url);
      screenshotUrl.searchParams.set("item", screenshotItem);
      await client.send("Page.navigate", { url: screenshotUrl.href });
      await waitFor(() => evaluate(client, `document.readyState === "complete"
        && document.querySelector('[data-item="${screenshotItem}"].active')
        && document.querySelector("#runtimeState").dataset.state === "verified"`));
    }
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

async function assertRigidClothPreview(client, { verifyFrames = false } = {}) {
  const state = await evaluate(client, `({
    motion: document.querySelector("#forgePreview").dataset.clothMotion,
    components: document.querySelector("#forgePreview").dataset.clothComponentCount,
    fps: document.querySelector("#forgePreview").dataset.clothAnimationFps,
  })`);
  assert.deepEqual(state, { motion: "rigid", components: "0", fps: "0" });
  if (!verifyFrames) return;
  const clip = await evaluate(client, `(() => {
    const bounds = document.querySelector("#forgePreview").getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, scale: 1 };
  })()`);
  const before = await client.send("Page.captureScreenshot", { format: "png", clip });
  await new Promise((resolve) => setTimeout(resolve, 180));
  const after = await client.send("Page.captureScreenshot", { format: "png", clip });
  assert.equal(after.data, before.data, "rigid cloth preview must remain pixel-stable across animation frames");
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
