import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const url = process.env.BUILD_NCM_TEST_URL ?? "http://127.0.0.1:9876/build_ncm/";
const port = Number(process.env.BUILD_NCM_DEBUG_PORT ?? 9324);
const screenshotPath = process.env.BUILD_NCM_SCREENSHOT_PATH ?? "";
const profile = mkdtempSync(join(tmpdir(), "build-ncm-chrome-"));
const chrome = spawn(process.env.CHROME_BIN ?? "google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

try {
  await pollJson(`http://127.0.0.1:${port}/json/version`);
  const pageResponse = await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: "PUT" });
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
  await waitFor(() => evaluate(client, "document.readyState === 'complete' && document.querySelectorAll('[data-style]').length === 6 && document.querySelectorAll('[data-building-category]').length === 12 && document.querySelectorAll('[data-building]').length === 2 && document.querySelector('[data-building=hollow-cottage]') && document.querySelector('[data-building=compact-village-duplex]') && document.querySelector('[data-language-select]').options.length === 9"));

  const initial = await evaluate(client, `({
    visibleBuildingCount: document.querySelectorAll('[data-building]').length,
    totalBuildingCount: document.querySelector('#buildingLibraryCount').textContent,
    categoryCount: document.querySelectorAll('[data-building-category]').length,
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    buildingLabel: document.querySelector('[data-building=hollow-cottage] strong')?.textContent,
    buildingDescription: document.querySelector('[data-building=hollow-cottage] em')?.textContent,
    buildingThumbnailCount: document.querySelectorAll('.building-library-preview').length,
    libraryIsLeft: document.querySelector('.building-library-panel').getBoundingClientRect().right <= document.querySelector('.viewport-card').getBoundingClientRect().left,
    libraryIsSplit: document.querySelector('#buildingCategoryList').getBoundingClientRect().right <= document.querySelector('#buildingLibraryList').getBoundingClientRect().left,
    libraryOverflowY: getComputedStyle(document.querySelector('#buildingLibraryList')).overflowY,
    styleCount: document.querySelectorAll('[data-style]').length,
    locale: document.documentElement.lang,
    documentTitle: document.title,
    introTitle: document.querySelector('.intro h1').textContent,
    bomTitle: document.querySelector('.bom-panel h2').textContent,
    pdaTitle: document.querySelector('.pda-panel h2').textContent,
    roleCount: document.querySelectorAll('.style-material').length,
    roleModelCount: document.querySelectorAll('.style-material canvas[data-material-model]').length,
    usedModelCount: document.querySelectorAll('#materialStrip canvas[data-material-model]').length,
    catalogCount: document.querySelectorAll('#buildingMaterialCatalog .model-material-card').length,
    catalogModelCount: document.querySelectorAll('#buildingMaterialCatalog canvas[data-material-model]').length,
    modelErrors: document.querySelectorAll('canvas[data-model-error]').length,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    ncm: document.querySelector('#codeOutput').value,
    modelSize: document.querySelector('#modelSize').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    languages: [...document.querySelector('[data-language-select]').options].map((option) => option.value),
    editorReadOnly: document.querySelector('#codeOutput').readOnly,
    loadButton: document.querySelector('#loadCode')?.textContent,
    codeStatusRole: document.querySelector('#codeLoadStatus')?.getAttribute('role'),
    hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(initial.visibleBuildingCount, 2);
  assert.match(initial.totalBuildingCount, /30 BUILDINGS/);
  assert.equal(initial.categoryCount, 12);
  assert.equal(initial.activeCategory, "residential");
  assert.equal(initial.activeBuilding, null);
  assert.equal(initial.buildingLabel, "Hollow Cottage");
  assert.match(initial.buildingDescription, /Click to download this building JSON/);
  assert.equal(initial.buildingThumbnailCount, 0);
  assert.equal(initial.libraryIsLeft, true);
  assert.equal(initial.libraryIsSplit, true);
  assert.equal(initial.libraryOverflowY, "auto");
  assert.equal(initial.styleCount, 6);
  assert.equal(initial.locale, "en");
  assert.equal(initial.documentTitle, "BUILD_NCM — NiceChunk Building Compiler");
  assert.equal(initial.introTitle, "Turn a building into compact on-chain code.");
  assert.equal(initial.bomTitle, "Construction Bill of Materials");
  assert.equal(initial.pdaTitle, "Fetch a Building from a PDA");
  assert.equal(initial.roleCount, 0);
  assert.equal(initial.roleModelCount, 0);
  assert.equal(initial.usedModelCount, 0);
  assert.equal(initial.catalogCount, 7);
  assert.equal(initial.catalogModelCount, 7);
  assert.equal(initial.modelErrors, 0);
  assert.equal(initial.activeStyle, "cottage");
  assert.equal(initial.ncm, "");
  assert.equal(initial.modelSize, "—");
  assert.equal(initial.disabledStyles, 6);
  assert.deepEqual(initial.languages, ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"]);
  assert.equal(initial.editorReadOnly, false);
  assert.equal(initial.loadButton, "Load");
  assert.equal(initial.codeStatusRole, "status");
  assert.equal(initial.hasHorizontalOverflow, false);
  assert.ok(initial.resources.includes("/chunk.js/construction/building-style-catalog.js"));
  assert.ok(initial.resources.includes("/chunk.js/renderer/material-model-preview.js"));
  assert.ok(initial.resources.includes("/chunk.js/renderer/texture-array-manager.js"));
  assert.ok(initial.resources.includes("/build_ncm/i18n.js"));
  assert.ok(initial.resources.includes("/build_ncm/building-library.js"));
  assert.ok(initial.resources.includes("/build_ncm/locales/en.json"));
  assert.ok(initial.resources.includes("/build_ncm/building-catalog.json"));
  assert.ok(!initial.resources.some((path) => path.startsWith("/build_ncm/buildings/")), "the initial page must not download any building JSON");
  assert.ok(!initial.resources.some((path) => path.startsWith("/build_ncm/concepts/")), "the initial page must not download concept art");
  assert.ok(!initial.resources.some((path) => path.endsWith("-blueprint.js") || path.endsWith("/house-blueprint.js")), "the JSON runtime must not load building generators");
  assert.ok(!initial.resources.includes("/chunk.js/index.js"), "build_ncm must not load the full chunk.js barrel");

  const payloadBeforeLocaleSwitch = initial.ncm;
  await evaluate(client, `(() => {
    const select = document.querySelector('[data-language-select]');
    select.value = 'zh-Hans';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, "document.documentElement.lang === 'zh-Hans'"));
  const chinese = await evaluate(client, `({
    title: document.title,
    intro: document.querySelector('.intro h1').textContent,
    bom: document.querySelector('.bom-panel h2').textContent,
    openings: document.querySelector('#toggleGlazing').textContent,
    emptyCode: document.querySelector('#metrics .building-empty-state').textContent,
    payload: document.querySelector('#codeOutput').value,
    models: document.querySelectorAll('canvas[data-material-model]').length,
    errors: document.querySelectorAll('canvas[data-model-error]').length,
  })`);
  assert.equal(chinese.title, "BUILD_NCM — NiceChunk 建筑编译器");
  assert.equal(chinese.intro, "把建筑变成一段可以上链的代码。");
  assert.equal(chinese.bom, "建筑材料清单");
  assert.equal(chinese.openings, "洞口：挖空");
  assert.equal(chinese.emptyCode, "尚未加载 NCM 载荷。");
  assert.equal(chinese.payload, payloadBeforeLocaleSwitch, "locale changes must never alter the NCM payload");
  assert.ok(chinese.models >= 13);
  assert.equal(chinese.errors, 0);
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname.startsWith('/build_ncm/buildings/'))"), false);
  await evaluate(client, `(() => {
    const select = document.querySelector('[data-language-select]');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, "document.documentElement.lang === 'en' && document.querySelector('.intro h1').textContent.startsWith('Turn a building')"));

  await evaluate(client, "document.querySelector('[data-building=hollow-cottage]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'hollow-cottage' && document.querySelector('#modelSize').textContent === '24 × 22 × 18'"));
  const cottageLoaded = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    payload: document.querySelector('#codeOutput').value,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.match(cottageLoaded.title, /Hollow Cottage/);
  assert.match(cottageLoaded.payload, /^NCM3:/);
  assert.ok(cottageLoaded.resources.includes("/build_ncm/buildings/residential/hollow-cottage.json"));
  assert.ok(!cottageLoaded.resources.includes("/build_ncm/house-blueprint.js"));
  assert.ok(!cottageLoaded.resources.includes("/build_ncm/buildings/residential/compact-village-duplex.json"), "selecting the hollow cottage must not load the duplex JSON");
  assert.ok(!cottageLoaded.resources.includes("/build_ncm/concepts/residential/compact-village-duplex.webp"), "selecting the hollow cottage must not load the duplex concept art");
  const cottagePayload = cottageLoaded.payload;
  const cottageVoxels = Number((await evaluate(client, "document.querySelectorAll('#metrics .metric strong')[2].textContent")).replaceAll(",", ""));

  await evaluate(client, "document.querySelector('[data-building=compact-village-duplex]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-duplex' && document.querySelector('#modelSize').textContent === '25 × 18 × 17' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const duplex = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(duplex.activeCategory, "residential");
  assert.match(duplex.title, /Compact Village Duplex/);
  assert.equal(duplex.modelSize, "25 × 18 × 17");
  assert.match(duplex.payload, /^NCM3:/);
  assert.equal(duplex.voxelCount, 1556);
  for (const id of [55, 56, 57, 58, 64, 68, 69, 70, 96]) assert.match(duplex.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(duplex.uncovered, false);
  assert.equal(duplex.glazingDisabled, true);
  assert.equal(duplex.glazingLabel, "Openings: Not applicable");
  assert.equal(duplex.disabledStyles, 6);
  assert.equal(duplex.disabledRoofs, 6);
  assert.equal(duplex.conceptHidden, false);
  assert.match(duplex.conceptAlt, /Compact Village Duplex concept reference/);
  assert.equal(duplex.conceptFit, "contain");
  assert.equal(duplex.selectedInUrl, "compact-village-duplex");
  assert.ok(duplex.resources.includes("/build_ncm/buildings/residential/compact-village-duplex.json"));
  assert.ok(duplex.resources.includes("/build_ncm/concepts/residential/compact-village-duplex.webp"));
  assert.ok(!duplex.resources.some((path) => path.endsWith("compact-village-duplex-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=coastal]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building-category].active')?.dataset.buildingCategory === 'coastal' && document.querySelector('[data-building=seaside-cottage]') && document.querySelector('[data-building=stone-timber-harbor-beacon]')"));
  const coastalBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    previewTitle: document.querySelector('#buildingTitle').textContent,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(coastalBrowse.activeBuilding, null, "browsing another category must not select or generate a building");
  assert.match(coastalBrowse.previewTitle, /Compact Village Duplex/);
  assert.ok(!coastalBrowse.resources.includes("/build_ncm/buildings/coastal/seaside-cottage.json"), "category browsing must not load its building JSON");
  assert.ok(!coastalBrowse.resources.includes("/build_ncm/buildings/coastal/stone-timber-harbor-beacon.json"), "category browsing must not load the harbor-beacon JSON");
  assert.ok(!coastalBrowse.resources.includes("/build_ncm/concepts/coastal/stone-timber-harbor-beacon.webp"), "category browsing must not load the harbor-beacon concept art");
  await evaluate(client, "document.querySelector('[data-building=seaside-cottage]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'seaside-cottage' && document.querySelector('#modelSize').textContent === '38 × 29 × 32'"));
  const seaside = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    activeRoof: document.querySelector('[data-roof].active')?.dataset.roof,
    glazed: document.querySelector('#toggleGlazing').getAttribute('aria-pressed'),
    roleCount: document.querySelectorAll('.style-material').length,
    usedMaterials: document.querySelector('#materialStrip').textContent,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    selectedInUrl: new URL(location.href).searchParams.get('building'),
  })`);
  assert.match(seaside.title, /Sea Breeze Cottage/);
  assert.equal(seaside.modelSize, "38 × 29 × 32");
  assert.notEqual(seaside.payload, cottagePayload);
  assert.equal(seaside.activeStyle, "coastal");
  assert.equal(seaside.activeRoof, "iceBlue");
  assert.equal(seaside.glazed, "true");
  assert.equal(seaside.roleCount, 10);
  assert.match(seaside.usedMaterials, /MAT_055/);
  assert.match(seaside.usedMaterials, /MAT_060/);
  assert.match(seaside.usedMaterials, /MAT_075/);
  assert.ok(seaside.voxelCount > cottageVoxels);
  assert.equal(seaside.uncovered, false);
  assert.equal(seaside.selectedInUrl, "seaside-cottage");
  assert.ok(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/buildings/coastal/seaside-cottage.json')"));
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/seaside-cottage-blueprint.js')"), false);
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/buildings/coastal/stone-timber-harbor-beacon.json')"), false, "selecting the seaside cottage must not load the harbor-beacon JSON");
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/concepts/coastal/stone-timber-harbor-beacon.webp')"), false, "selecting the seaside cottage must not load the harbor-beacon concept art");

  await evaluate(client, "document.querySelector('[data-building=stone-timber-harbor-beacon]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'stone-timber-harbor-beacon' && document.querySelector('#modelSize').textContent === '25 × 43 × 23' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const harborBeacon = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(harborBeacon.activeCategory, "coastal");
  assert.match(harborBeacon.title, /Stone and Timber Harbor Beacon/);
  assert.equal(harborBeacon.modelSize, "25 × 43 × 23");
  assert.match(harborBeacon.payload, /^NCM3:/);
  assert.equal(harborBeacon.voxelCount, 3444);
  for (const id of [55, 56, 57, 60, 64, 65, 68, 69, 75, 96]) assert.match(harborBeacon.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(harborBeacon.uncovered, false);
  assert.equal(harborBeacon.glazingDisabled, true);
  assert.equal(harborBeacon.glazingLabel, "Openings: Not applicable");
  assert.equal(harborBeacon.disabledStyles, 6);
  assert.equal(harborBeacon.disabledRoofs, 6);
  assert.equal(harborBeacon.conceptHidden, false);
  assert.match(harborBeacon.conceptAlt, /Stone and Timber Harbor Beacon concept reference/);
  assert.equal(harborBeacon.conceptFit, "contain");
  assert.equal(harborBeacon.selectedInUrl, "stone-timber-harbor-beacon");
  assert.ok(harborBeacon.resources.includes("/build_ncm/buildings/coastal/stone-timber-harbor-beacon.json"));
  assert.ok(harborBeacon.resources.includes("/build_ncm/concepts/coastal/stone-timber-harbor-beacon.webp"));
  assert.ok(!harborBeacon.resources.some((path) => path.endsWith("stone-timber-harbor-beacon-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=industrial]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=freight-warehouse]')"));
  await evaluate(client, "document.querySelector('[data-building=freight-warehouse]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'freight-warehouse' && document.querySelector('#modelSize').textContent === '48 × 36 × 38'"));
  const warehouse = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    activeRoof: document.querySelector('[data-roof].active')?.dataset.roof,
    glazed: document.querySelector('#toggleGlazing').getAttribute('aria-pressed'),
    roleCount: document.querySelectorAll('.style-material').length,
    usedMaterials: document.querySelector('#materialStrip').textContent,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    selectedInUrl: new URL(location.href).searchParams.get('building'),
  })`);
  assert.match(warehouse.title, /Freight Warehouse/);
  assert.equal(warehouse.modelSize, "48 × 36 × 38");
  assert.notEqual(warehouse.payload, seaside.payload);
  assert.equal(warehouse.activeStyle, "castle");
  assert.equal(warehouse.activeRoof, "charcoal");
  assert.equal(warehouse.glazed, "true");
  assert.equal(warehouse.roleCount, 8);
  assert.match(warehouse.usedMaterials, /MAT_060/);
  assert.ok(warehouse.voxelCount > seaside.voxelCount);
  assert.equal(warehouse.uncovered, false);
  assert.equal(warehouse.selectedInUrl, "freight-warehouse");

  await evaluate(client, "document.querySelector('[data-building-category=fortress]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=grand-castle]') && document.querySelector('[data-building=compact-village-guardhouse]')"));
  const fortressBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(fortressBrowse.activeBuilding, null);
  assert.equal(fortressBrowse.cardCount, 2);
  assert.ok(!fortressBrowse.resources.includes("/build_ncm/buildings/fortress/compact-village-guardhouse.json"), "category browsing must not load the guardhouse JSON");
  assert.ok(!fortressBrowse.resources.includes("/build_ncm/concepts/fortress/compact-village-guardhouse.webp"), "category browsing must not load the guardhouse concept art");
  await evaluate(client, "document.querySelector('[data-building=grand-castle]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'grand-castle' && document.querySelector('#modelSize').textContent === '152 × 86 × 136'"));
  const castle = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    activeRoof: document.querySelector('[data-roof].active')?.dataset.roof,
    glazed: document.querySelector('#toggleGlazing').getAttribute('aria-pressed'),
    roleCount: document.querySelectorAll('.style-material').length,
    usedMaterials: document.querySelector('#materialStrip').textContent,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.match(castle.title, /Royal Blue Citadel/);
  assert.equal(castle.modelSize, "152 × 86 × 136");
  assert.notEqual(castle.payload, warehouse.payload);
  assert.equal(castle.activeStyle, "castle");
  assert.equal(castle.activeRoof, "iceBlue");
  assert.equal(castle.glazed, "false");
  assert.equal(castle.roleCount, 9);
  assert.match(castle.usedMaterials, /MAT_060/);
  assert.match(castle.usedMaterials, /MAT_075/);
  assert.doesNotMatch(castle.usedMaterials, /MAT_061/);
  assert.ok(castle.voxelCount > warehouse.voxelCount);
  assert.equal(castle.uncovered, false);
  assert.equal(castle.selectedInUrl, "grand-castle");
  assert.ok(!castle.resources.includes("/build_ncm/buildings/fortress/compact-village-guardhouse.json"), "selecting the castle must not load the guardhouse JSON");
  assert.ok(!castle.resources.includes("/build_ncm/concepts/fortress/compact-village-guardhouse.webp"), "selecting the castle must not load the guardhouse concept art");

  await evaluate(client, "document.querySelector('[data-building=compact-village-guardhouse]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-guardhouse' && document.querySelector('#modelSize').textContent === '15 × 17 × 13' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const guardhouse = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(guardhouse.activeCategory, "fortress");
  assert.match(guardhouse.title, /Compact Village Guardhouse/);
  assert.equal(guardhouse.modelSize, "15 × 17 × 13");
  assert.match(guardhouse.payload, /^NCM3:/);
  assert.equal(guardhouse.voxelCount, 835);
  for (const id of [55, 57, 58, 64, 68, 69, 96]) assert.match(guardhouse.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(guardhouse.uncovered, false);
  assert.equal(guardhouse.glazingDisabled, true);
  assert.equal(guardhouse.glazingLabel, "Openings: Not applicable");
  assert.equal(guardhouse.disabledStyles, 6);
  assert.equal(guardhouse.disabledRoofs, 6);
  assert.equal(guardhouse.conceptHidden, false);
  assert.match(guardhouse.conceptAlt, /Compact Village Guardhouse concept reference/);
  assert.equal(guardhouse.conceptFit, "contain");
  assert.equal(guardhouse.selectedInUrl, "compact-village-guardhouse");
  assert.ok(guardhouse.resources.includes("/build_ncm/buildings/fortress/compact-village-guardhouse.json"));
  assert.ok(guardhouse.resources.includes("/build_ncm/concepts/fortress/compact-village-guardhouse.webp"));
  assert.ok(!guardhouse.resources.some((path) => path.endsWith("compact-village-guardhouse-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=civic]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=civic-town-hall]') && document.querySelector('[data-building=covered-village-bread-oven]') && document.querySelector('[data-building=covered-village-notice-board]') && document.querySelector('[data-building=stone-village-sundial]')"));
  const civicBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(civicBrowse.activeBuilding, null);
  assert.equal(civicBrowse.cardCount, 4);
  assert.ok(!civicBrowse.resources.includes("/build_ncm/buildings/civic/civic-town-hall.json"), "category browsing must not load the town-hall JSON");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/buildings/civic/covered-village-bread-oven.json"), "category browsing must not load the bread-oven JSON");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/concepts/civic/covered-village-bread-oven.webp"), "category browsing must not load the bread-oven concept art");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/buildings/civic/covered-village-notice-board.json"), "category browsing must not load the notice-board JSON");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/concepts/civic/covered-village-notice-board.webp"), "category browsing must not load the notice-board concept art");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/buildings/civic/stone-village-sundial.json"), "category browsing must not load the sundial JSON");
  assert.ok(!civicBrowse.resources.includes("/build_ncm/concepts/civic/stone-village-sundial.webp"), "category browsing must not load the sundial concept art");
  await evaluate(client, "document.querySelector('[data-building=civic-town-hall]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'civic-town-hall' && document.querySelector('#modelSize').textContent === '44 × 42 × 40'"));
  const townHall = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    activeRoof: document.querySelector('[data-roof].active')?.dataset.roof,
    glazed: document.querySelector('#toggleGlazing').getAttribute('aria-pressed'),
    roleCount: document.querySelectorAll('.style-material').length,
    usedMaterials: document.querySelector('#materialStrip').textContent,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    modelErrors: document.querySelectorAll('canvas[data-model-error]').length,
  })`);
  assert.equal(townHall.activeBuilding, "civic-town-hall");
  assert.match(townHall.title, /Civic Town Hall/);
  assert.equal(townHall.modelSize, "44 × 42 × 40");
  assert.notEqual(townHall.payload, cottagePayload);
  assert.match(townHall.payload, /^NCM3:/);
  assert.equal(townHall.activeStyle, "coastal");
  assert.equal(townHall.activeRoof, "iceBlue");
  assert.equal(townHall.glazed, "true");
  assert.equal(townHall.roleCount, 9);
  assert.doesNotMatch(townHall.usedMaterials, /MAT_055/);
  assert.match(townHall.usedMaterials, /MAT_060/);
  assert.match(townHall.usedMaterials, /MAT_075/);
  assert.ok(townHall.voxelCount > cottageVoxels);
  assert.equal(townHall.uncovered, false);
  assert.equal(townHall.modelErrors, 0);
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/buildings/civic/covered-village-notice-board.json')"), false, "selecting the town hall must not load the notice-board JSON");
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/concepts/civic/covered-village-notice-board.webp')"), false, "selecting the town hall must not load the notice-board concept art");
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/buildings/civic/stone-village-sundial.json')"), false, "selecting the town hall must not load the sundial JSON");
  assert.equal(await evaluate(client, "performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/concepts/civic/stone-village-sundial.webp')"), false, "selecting the town hall must not load the sundial concept art");

  const townHallTitles = {
    en: "Civic Town Hall",
    es: "Ayuntamiento Cívico",
    fr: "Hôtel de Ville",
    de: "Bürgerliches Rathaus",
    ja: "市庁舎",
    ru: "Городская ратуша",
    ko: "시민 회관",
    "zh-Hant": "市政廳",
    "zh-Hans": "市政厅",
  };
  for (const [locale, expectedTitle] of Object.entries(townHallTitles)) {
    await evaluate(client, `(() => {
      const select = document.querySelector('[data-language-select]');
      select.value = ${JSON.stringify(locale)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(() => evaluate(client, `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector('#buildingTitle').textContent.includes(${JSON.stringify(expectedTitle)})`));
    const localizedTownHall = await evaluate(client, `({
      activeBuilding: document.querySelector('[data-building].active')?.dataset.building,
      activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
      title: document.querySelector('#buildingTitle').textContent,
      cardTitle: document.querySelector('[data-building=civic-town-hall] strong').textContent,
      payload: document.querySelector('#codeOutput').value,
      thumbnails: document.querySelectorAll('.building-library-preview').length,
    })`);
    assert.equal(localizedTownHall.activeBuilding, "civic-town-hall");
    assert.equal(localizedTownHall.activeCategory, "civic");
    assert.ok(localizedTownHall.title.includes(expectedTitle), `${locale} must use the title stored in the building JSON`);
    assert.equal(localizedTownHall.cardTitle, expectedTitle, `${locale} library title must come from the loaded building JSON`);
    assert.equal(localizedTownHall.payload, townHall.payload, "locale changes must preserve the selected building payload");
    assert.equal(localizedTownHall.thumbnails, 0);
  }
  assert.ok(await evaluate(client, `Object.keys(${JSON.stringify(townHallTitles)}).every((locale) => performance.getEntriesByType('resource').some((entry) => new URL(entry.name).pathname === '/build_ncm/locales/' + locale + '.json'))`));
  await evaluate(client, `(() => {
    const select = document.querySelector('[data-language-select]');
    select.value = 'en';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, "document.documentElement.lang === 'en'"));

  await evaluate(client, "document.querySelector('[data-building=covered-village-bread-oven]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-bread-oven' && document.querySelector('#modelSize').textContent === '23 × 28 × 20' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const breadOven = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(breadOven.activeCategory, "civic");
  assert.match(breadOven.title, /Covered Village Bread Oven/);
  assert.equal(breadOven.modelSize, "23 × 28 × 20");
  assert.match(breadOven.payload, /^NCM3:/);
  assert.equal(breadOven.voxelCount, 3097);
  for (const id of [55, 56, 57, 60, 62, 65, 68, 69, 96]) assert.match(breadOven.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(breadOven.uncovered, false);
  assert.equal(breadOven.glazingDisabled, true);
  assert.equal(breadOven.glazingLabel, "Openings: Not applicable");
  assert.equal(breadOven.disabledStyles, 6);
  assert.equal(breadOven.disabledRoofs, 6);
  assert.equal(breadOven.conceptHidden, false);
  assert.match(breadOven.conceptAlt, /Covered Village Bread Oven concept reference/);
  assert.equal(breadOven.conceptFit, "contain");
  assert.equal(breadOven.selectedInUrl, "covered-village-bread-oven");
  assert.ok(breadOven.resources.includes("/build_ncm/buildings/civic/covered-village-bread-oven.json"));
  assert.ok(breadOven.resources.includes("/build_ncm/concepts/civic/covered-village-bread-oven.webp"));
  assert.ok(!breadOven.resources.some((path) => path.endsWith("covered-village-bread-oven-blueprint.js")));
  assert.ok(!breadOven.resources.includes("/build_ncm/buildings/civic/covered-village-notice-board.json"), "selecting the bread oven must not load the notice-board JSON");
  assert.ok(!breadOven.resources.includes("/build_ncm/concepts/civic/covered-village-notice-board.webp"), "selecting the bread oven must not load the notice-board concept art");
  assert.ok(!breadOven.resources.includes("/build_ncm/buildings/civic/stone-village-sundial.json"), "selecting the bread oven must not load the sundial JSON");
  assert.ok(!breadOven.resources.includes("/build_ncm/concepts/civic/stone-village-sundial.webp"), "selecting the bread oven must not load the sundial concept art");

  await evaluate(client, "document.querySelector('[data-building=covered-village-notice-board]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-notice-board' && document.querySelector('#modelSize').textContent === '23 × 22 × 9' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const noticeBoard = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(noticeBoard.activeCategory, "civic");
  assert.match(noticeBoard.title, /Covered Village Notice Board/);
  assert.equal(noticeBoard.modelSize, "23 × 22 × 9");
  assert.match(noticeBoard.payload, /^NCM3:/);
  assert.equal(noticeBoard.voxelCount, 1486);
  for (const id of [55, 56, 57, 58, 68, 69, 74, 75, 96]) assert.match(noticeBoard.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(noticeBoard.uncovered, false);
  assert.equal(noticeBoard.glazingDisabled, true);
  assert.equal(noticeBoard.glazingLabel, "Openings: Not applicable");
  assert.equal(noticeBoard.disabledStyles, 6);
  assert.equal(noticeBoard.disabledRoofs, 6);
  assert.equal(noticeBoard.conceptHidden, false);
  assert.match(noticeBoard.conceptAlt, /Covered Village Notice Board concept reference/);
  assert.equal(noticeBoard.conceptFit, "contain");
  assert.equal(noticeBoard.selectedInUrl, "covered-village-notice-board");
  assert.ok(noticeBoard.resources.includes("/build_ncm/buildings/civic/covered-village-notice-board.json"));
  assert.ok(noticeBoard.resources.includes("/build_ncm/concepts/civic/covered-village-notice-board.webp"));
  assert.ok(!noticeBoard.resources.some((path) => path.endsWith("covered-village-notice-board-blueprint.js")));
  assert.ok(!noticeBoard.resources.includes("/build_ncm/buildings/civic/stone-village-sundial.json"), "selecting the notice board must not load the sundial JSON");
  assert.ok(!noticeBoard.resources.includes("/build_ncm/concepts/civic/stone-village-sundial.webp"), "selecting the notice board must not load the sundial concept art");

  await evaluate(client, "document.querySelector('[data-building=stone-village-sundial]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'stone-village-sundial' && document.querySelector('#modelSize').textContent === '17 × 15 × 17' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const sundial = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(sundial.activeCategory, "civic");
  assert.match(sundial.title, /Stone Village Sundial/);
  assert.equal(sundial.modelSize, "17 × 15 × 17");
  assert.match(sundial.payload, /^NCM3:/);
  assert.equal(sundial.voxelCount, 1373);
  for (const id of [56, 64, 69]) assert.match(sundial.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(sundial.uncovered, false);
  assert.equal(sundial.glazingDisabled, true);
  assert.equal(sundial.glazingLabel, "Openings: Not applicable");
  assert.equal(sundial.disabledStyles, 6);
  assert.equal(sundial.disabledRoofs, 6);
  assert.equal(sundial.conceptHidden, false);
  assert.match(sundial.conceptAlt, /Stone Village Sundial concept reference/);
  assert.equal(sundial.conceptFit, "contain");
  assert.equal(sundial.selectedInUrl, "stone-village-sundial");
  assert.ok(sundial.resources.includes("/build_ncm/buildings/civic/stone-village-sundial.json"));
  assert.ok(sundial.resources.includes("/build_ncm/concepts/civic/stone-village-sundial.webp"));
  assert.ok(!sundial.resources.some((path) => path.endsWith("stone-village-sundial-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=utility]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=covered-village-well]') && document.querySelector('[data-building=village-twin-lantern]') && document.querySelector('[data-building=covered-village-firewood-rack]')"));
  const utilityBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(utilityBrowse.activeBuilding, null);
  assert.equal(utilityBrowse.cardCount, 3);
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/buildings/utility/covered-village-well.json"), "category browsing must not load the well JSON");
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/concepts/utility/covered-village-well.webp"), "category browsing must not load the well concept art");
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/buildings/utility/village-twin-lantern.json"), "category browsing must not load the lantern JSON");
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/concepts/utility/village-twin-lantern.webp"), "category browsing must not load the lantern concept art");
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/buildings/utility/covered-village-firewood-rack.json"), "category browsing must not load the firewood-rack JSON");
  assert.ok(!utilityBrowse.resources.includes("/build_ncm/concepts/utility/covered-village-firewood-rack.webp"), "category browsing must not load the firewood-rack concept art");
  await evaluate(client, "document.querySelector('[data-building=covered-village-well]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-well' && document.querySelector('#modelSize').textContent === '21 × 22 × 18' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const well = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.match(well.title, /Covered Village Well/);
  assert.equal(well.modelSize, "21 × 22 × 18");
  assert.match(well.payload, /^NCM3:/);
  assert.equal(well.voxelCount, 958);
  for (const id of [55, 56, 60, 68, 69, 96]) assert.match(well.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(well.uncovered, false);
  assert.equal(well.glazingDisabled, true);
  assert.equal(well.glazingLabel, "Openings: Not applicable");
  assert.equal(well.disabledStyles, 0);
  assert.equal(well.disabledRoofs, 0);
  assert.equal(well.conceptHidden, false);
  assert.match(well.conceptAlt, /Covered Village Well concept reference/);
  assert.equal(well.selectedInUrl, "covered-village-well");
  assert.ok(well.resources.includes("/build_ncm/buildings/utility/covered-village-well.json"));
  assert.ok(well.resources.includes("/build_ncm/concepts/utility/covered-village-well.webp"));
  assert.ok(!well.resources.some((path) => path.endsWith("covered-village-well-blueprint.js")));
  assert.ok(!well.resources.includes("/build_ncm/buildings/utility/covered-village-firewood-rack.json"), "selecting the well must not load the firewood-rack JSON");
  assert.ok(!well.resources.includes("/build_ncm/concepts/utility/covered-village-firewood-rack.webp"), "selecting the well must not load the firewood-rack concept art");

  await evaluate(client, "document.querySelector('[data-building=village-twin-lantern]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'village-twin-lantern' && document.querySelector('#modelSize').textContent === '19 × 22 × 11' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const lantern = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.match(lantern.title, /Village Twin Lantern/);
  assert.equal(lantern.modelSize, "19 × 22 × 11");
  assert.match(lantern.payload, /^NCM3:/);
  assert.equal(lantern.voxelCount, 524);
  for (const id of [55, 56, 57, 60, 68, 69, 99]) assert.match(lantern.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(lantern.uncovered, false);
  assert.equal(lantern.glazingDisabled, true);
  assert.equal(lantern.glazingLabel, "Openings: Not applicable");
  assert.equal(lantern.disabledStyles, 6);
  assert.equal(lantern.disabledRoofs, 6);
  assert.equal(lantern.conceptHidden, false);
  assert.match(lantern.conceptAlt, /Village Twin Lantern concept reference/);
  assert.equal(lantern.conceptFit, "contain");
  assert.equal(lantern.selectedInUrl, "village-twin-lantern");
  assert.ok(lantern.resources.includes("/build_ncm/buildings/utility/village-twin-lantern.json"));
  assert.ok(lantern.resources.includes("/build_ncm/concepts/utility/village-twin-lantern.webp"));
  assert.ok(!lantern.resources.some((path) => path.endsWith("village-twin-lantern-blueprint.js")));
  assert.ok(!lantern.resources.includes("/build_ncm/buildings/utility/covered-village-firewood-rack.json"), "selecting the lantern must not load the firewood-rack JSON");
  assert.ok(!lantern.resources.includes("/build_ncm/concepts/utility/covered-village-firewood-rack.webp"), "selecting the lantern must not load the firewood-rack concept art");

  await evaluate(client, "document.querySelector('[data-building=covered-village-firewood-rack]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-firewood-rack' && document.querySelector('#modelSize').textContent === '25 × 22 × 11' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const firewoodRack = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(firewoodRack.activeCategory, "utility");
  assert.match(firewoodRack.title, /Covered Village Firewood Rack/);
  assert.equal(firewoodRack.modelSize, "25 × 22 × 11");
  assert.match(firewoodRack.payload, /^NCM3:/);
  assert.equal(firewoodRack.voxelCount, 1586);
  for (const id of [55, 56, 57, 68, 69, 96]) assert.match(firewoodRack.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(firewoodRack.uncovered, false);
  assert.equal(firewoodRack.glazingDisabled, true);
  assert.equal(firewoodRack.glazingLabel, "Openings: Not applicable");
  assert.equal(firewoodRack.disabledStyles, 6);
  assert.equal(firewoodRack.disabledRoofs, 6);
  assert.equal(firewoodRack.conceptHidden, false);
  assert.match(firewoodRack.conceptAlt, /Covered Village Firewood Rack concept reference/);
  assert.equal(firewoodRack.conceptFit, "contain");
  assert.equal(firewoodRack.selectedInUrl, "covered-village-firewood-rack");
  assert.ok(firewoodRack.resources.includes("/build_ncm/buildings/utility/covered-village-firewood-rack.json"));
  assert.ok(firewoodRack.resources.includes("/build_ncm/concepts/utility/covered-village-firewood-rack.webp"));
  assert.ok(!firewoodRack.resources.some((path) => path.endsWith("covered-village-firewood-rack-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=wayfinding]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=crossroads-wayfinding-sign]')"));
  const wayfindingBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(wayfindingBrowse.activeBuilding, null);
  assert.equal(wayfindingBrowse.cardCount, 2);
  assert.ok(!wayfindingBrowse.resources.includes("/build_ncm/buildings/wayfinding/crossroads-wayfinding-sign.json"), "category browsing must not load the wayfinding JSON");
  assert.ok(!wayfindingBrowse.resources.includes("/build_ncm/concepts/wayfinding/crossroads-wayfinding-sign.webp"), "category browsing must not load the wayfinding concept art");
  assert.ok(!wayfindingBrowse.resources.includes("/build_ncm/buildings/wayfinding/stone-timber-village-gateway.json"), "category browsing must not load the gateway JSON");
  assert.ok(!wayfindingBrowse.resources.includes("/build_ncm/concepts/wayfinding/stone-timber-village-gateway.webp"), "category browsing must not load the gateway concept art");
  await evaluate(client, "document.querySelector('[data-building=crossroads-wayfinding-sign]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'crossroads-wayfinding-sign' && document.querySelector('#modelSize').textContent === '21 × 20 × 21' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const wayfinding = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(wayfinding.activeCategory, "wayfinding");
  assert.match(wayfinding.title, /Crossroads Wayfinding Sign/);
  assert.equal(wayfinding.modelSize, "21 × 20 × 21");
  assert.match(wayfinding.payload, /^NCM3:/);
  assert.equal(wayfinding.voxelCount, 632);
  for (const id of [55, 57, 68, 69, 74, 75]) assert.match(wayfinding.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(wayfinding.uncovered, false);
  assert.equal(wayfinding.glazingDisabled, true);
  assert.equal(wayfinding.glazingLabel, "Openings: Not applicable");
  assert.equal(wayfinding.disabledStyles, 6);
  assert.equal(wayfinding.disabledRoofs, 6);
  assert.equal(wayfinding.conceptHidden, false);
  assert.match(wayfinding.conceptAlt, /Crossroads Wayfinding Sign concept reference/);
  assert.equal(wayfinding.selectedInUrl, "crossroads-wayfinding-sign");
  assert.ok(wayfinding.resources.includes("/build_ncm/buildings/wayfinding/crossroads-wayfinding-sign.json"));
  assert.ok(wayfinding.resources.includes("/build_ncm/concepts/wayfinding/crossroads-wayfinding-sign.webp"));
  assert.ok(!wayfinding.resources.includes("/build_ncm/buildings/wayfinding/stone-timber-village-gateway.json"), "selecting the sign must not load the gateway JSON");
  assert.ok(!wayfinding.resources.includes("/build_ncm/concepts/wayfinding/stone-timber-village-gateway.webp"), "selecting the sign must not load the gateway concept art");
  assert.ok(!wayfinding.resources.some((path) => path.endsWith("crossroads-wayfinding-sign-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building=stone-timber-village-gateway]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'stone-timber-village-gateway' && document.querySelector('#modelSize').textContent === '25 × 29 × 13' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const gateway = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(gateway.activeCategory, "wayfinding");
  assert.match(gateway.title, /Stone and Timber Village Gateway/);
  assert.equal(gateway.modelSize, "25 × 29 × 13");
  assert.match(gateway.payload, /^NCM3:/);
  assert.equal(gateway.voxelCount, 2182);
  for (const id of [55, 56, 57, 68, 69, 96]) assert.match(gateway.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(gateway.uncovered, false);
  assert.equal(gateway.glazingDisabled, true);
  assert.equal(gateway.glazingLabel, "Openings: Not applicable");
  assert.equal(gateway.disabledStyles, 6);
  assert.equal(gateway.disabledRoofs, 6);
  assert.equal(gateway.conceptHidden, false);
  assert.match(gateway.conceptAlt, /Stone and Timber Village Gateway concept reference/);
  assert.equal(gateway.conceptFit, "contain");
  assert.equal(gateway.selectedInUrl, "stone-timber-village-gateway");
  assert.ok(gateway.resources.includes("/build_ncm/buildings/wayfinding/stone-timber-village-gateway.json"));
  assert.ok(gateway.resources.includes("/build_ncm/concepts/wayfinding/stone-timber-village-gateway.webp"));
  assert.ok(!gateway.resources.some((path) => path.endsWith("stone-timber-village-gateway-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=commerce]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=covered-market-stall]') && document.querySelector('[data-building=compact-village-general-store]')"));
  const commerceBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(commerceBrowse.activeBuilding, null);
  assert.equal(commerceBrowse.cardCount, 2);
  assert.ok(!commerceBrowse.resources.includes("/build_ncm/buildings/commerce/covered-market-stall.json"), "category browsing must not load the market-stall JSON");
  assert.ok(!commerceBrowse.resources.includes("/build_ncm/concepts/commerce/covered-market-stall.webp"), "category browsing must not load the market-stall concept art");
  assert.ok(!commerceBrowse.resources.includes("/build_ncm/buildings/commerce/compact-village-general-store.json"), "category browsing must not load the general-store JSON");
  assert.ok(!commerceBrowse.resources.includes("/build_ncm/concepts/commerce/compact-village-general-store.webp"), "category browsing must not load the general-store concept art");
  await evaluate(client, "document.querySelector('[data-building=covered-market-stall]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-market-stall' && document.querySelector('#modelSize').textContent === '21 × 21 × 15' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const marketStall = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(marketStall.activeCategory, "commerce");
  assert.match(marketStall.title, /Covered Market Stall/);
  assert.equal(marketStall.modelSize, "21 × 21 × 15");
  assert.match(marketStall.payload, /^NCM3:/);
  assert.equal(marketStall.voxelCount, 1444);
  for (const id of [55, 56, 57, 60, 68, 69, 74, 75, 96]) assert.match(marketStall.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(marketStall.uncovered, false);
  assert.equal(marketStall.glazingDisabled, true);
  assert.equal(marketStall.glazingLabel, "Openings: Not applicable");
  assert.equal(marketStall.disabledStyles, 6);
  assert.equal(marketStall.disabledRoofs, 6);
  assert.equal(marketStall.conceptHidden, false);
  assert.match(marketStall.conceptAlt, /Covered Market Stall concept reference/);
  assert.equal(marketStall.conceptFit, "contain");
  assert.equal(marketStall.selectedInUrl, "covered-market-stall");
  assert.ok(marketStall.resources.includes("/build_ncm/buildings/commerce/covered-market-stall.json"));
  assert.ok(marketStall.resources.includes("/build_ncm/concepts/commerce/covered-market-stall.webp"));
  assert.ok(!marketStall.resources.some((path) => path.endsWith("covered-market-stall-blueprint.js")));
  assert.ok(!marketStall.resources.includes("/build_ncm/buildings/commerce/compact-village-general-store.json"), "selecting the market stall must not load the general-store JSON");
  assert.ok(!marketStall.resources.includes("/build_ncm/concepts/commerce/compact-village-general-store.webp"), "selecting the market stall must not load the general-store concept art");

  await evaluate(client, "document.querySelector('[data-building=compact-village-general-store]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-general-store' && document.querySelector('#modelSize').textContent === '19 × 19 × 15' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const generalStore = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(generalStore.activeCategory, "commerce");
  assert.match(generalStore.title, /Compact Village General Store/);
  assert.equal(generalStore.modelSize, "19 × 19 × 15");
  assert.match(generalStore.payload, /^NCM3:/);
  assert.equal(generalStore.voxelCount, 1238);
  for (const id of [55, 56, 57, 58, 64, 68, 69, 96]) assert.match(generalStore.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(generalStore.uncovered, false);
  assert.equal(generalStore.glazingDisabled, true);
  assert.equal(generalStore.glazingLabel, "Openings: Not applicable");
  assert.equal(generalStore.disabledStyles, 6);
  assert.equal(generalStore.disabledRoofs, 6);
  assert.equal(generalStore.conceptHidden, false);
  assert.match(generalStore.conceptAlt, /Compact Village General Store concept reference/);
  assert.equal(generalStore.conceptFit, "contain");
  assert.equal(generalStore.selectedInUrl, "compact-village-general-store");
  assert.ok(generalStore.resources.includes("/build_ncm/buildings/commerce/compact-village-general-store.json"));
  assert.ok(generalStore.resources.includes("/build_ncm/concepts/commerce/compact-village-general-store.webp"));
  assert.ok(!generalStore.resources.some((path) => path.endsWith("compact-village-general-store-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=transport]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=stone-timber-footbridge]')"));
  const transportBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(transportBrowse.activeBuilding, null);
  assert.equal(transportBrowse.cardCount, 2);
  assert.ok(!transportBrowse.resources.includes("/build_ncm/buildings/transport/stone-timber-footbridge.json"), "category browsing must not load the footbridge JSON");
  assert.ok(!transportBrowse.resources.includes("/build_ncm/concepts/transport/stone-timber-footbridge.webp"), "category browsing must not load the footbridge concept art");
  assert.ok(!transportBrowse.resources.includes("/build_ncm/buildings/transport/two-wheel-village-handcart.json"), "category browsing must not load the handcart JSON");
  assert.ok(!transportBrowse.resources.includes("/build_ncm/concepts/transport/two-wheel-village-handcart.webp"), "category browsing must not load the handcart concept art");
  await evaluate(client, "document.querySelector('[data-building=stone-timber-footbridge]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'stone-timber-footbridge' && document.querySelector('#modelSize').textContent === '31 × 9 × 13' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const footbridge = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(footbridge.activeCategory, "transport");
  assert.match(footbridge.title, /Stone and Timber Footbridge/);
  assert.equal(footbridge.modelSize, "31 × 9 × 13");
  assert.match(footbridge.payload, /^NCM3:/);
  assert.equal(footbridge.voxelCount, 784);
  for (const id of [55, 56, 57, 60, 64, 68, 69]) assert.match(footbridge.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(footbridge.uncovered, false);
  assert.equal(footbridge.glazingDisabled, true);
  assert.equal(footbridge.glazingLabel, "Openings: Not applicable");
  assert.equal(footbridge.disabledStyles, 6);
  assert.equal(footbridge.disabledRoofs, 6);
  assert.equal(footbridge.conceptHidden, false);
  assert.match(footbridge.conceptAlt, /Stone and Timber Footbridge concept reference/);
  assert.equal(footbridge.conceptFit, "contain");
  assert.equal(footbridge.selectedInUrl, "stone-timber-footbridge");
  assert.ok(footbridge.resources.includes("/build_ncm/buildings/transport/stone-timber-footbridge.json"));
  assert.ok(footbridge.resources.includes("/build_ncm/concepts/transport/stone-timber-footbridge.webp"));
  assert.ok(!footbridge.resources.some((path) => path.endsWith("stone-timber-footbridge-blueprint.js")));
  assert.ok(!footbridge.resources.includes("/build_ncm/buildings/transport/two-wheel-village-handcart.json"), "selecting the footbridge must not load the handcart JSON");
  assert.ok(!footbridge.resources.includes("/build_ncm/concepts/transport/two-wheel-village-handcart.webp"), "selecting the footbridge must not load the handcart concept art");

  await evaluate(client, "document.querySelector('[data-building=two-wheel-village-handcart]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'two-wheel-village-handcart' && document.querySelector('#modelSize').textContent === '23 × 11 × 14' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const handcart = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(handcart.activeCategory, "transport");
  assert.match(handcart.title, /Two-wheel Village Handcart/);
  assert.equal(handcart.modelSize, "23 × 11 × 14");
  assert.match(handcart.payload, /^NCM3:/);
  assert.equal(handcart.voxelCount, 386);
  for (const id of [55, 56, 57]) assert.match(handcart.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(handcart.uncovered, false);
  assert.equal(handcart.glazingDisabled, true);
  assert.equal(handcart.glazingLabel, "Openings: Not applicable");
  assert.equal(handcart.disabledStyles, 6);
  assert.equal(handcart.disabledRoofs, 6);
  assert.equal(handcart.conceptHidden, false);
  assert.match(handcart.conceptAlt, /Two-wheel Village Handcart concept reference/);
  assert.equal(handcart.conceptFit, "contain");
  assert.equal(handcart.selectedInUrl, "two-wheel-village-handcart");
  assert.ok(handcart.resources.includes("/build_ncm/buildings/transport/two-wheel-village-handcart.json"));
  assert.ok(handcart.resources.includes("/build_ncm/concepts/transport/two-wheel-village-handcart.webp"));
  assert.ok(!handcart.resources.some((path) => path.endsWith("two-wheel-village-handcart-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=mining]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=timber-mine-headframe]') && document.querySelector('[data-building=covered-village-ore-sorting-shed]')"));
  const miningBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(miningBrowse.activeBuilding, null);
  assert.equal(miningBrowse.cardCount, 2);
  assert.ok(!miningBrowse.resources.includes("/build_ncm/buildings/mining/timber-mine-headframe.json"), "category browsing must not load the headframe JSON");
  assert.ok(!miningBrowse.resources.includes("/build_ncm/concepts/mining/timber-mine-headframe.webp"), "category browsing must not load the headframe concept art");
  assert.ok(!miningBrowse.resources.includes("/build_ncm/buildings/mining/covered-village-ore-sorting-shed.json"), "category browsing must not load the ore-sorting-shed JSON");
  assert.ok(!miningBrowse.resources.includes("/build_ncm/concepts/mining/covered-village-ore-sorting-shed.webp"), "category browsing must not load the ore-sorting-shed concept art");
  await evaluate(client, "document.querySelector('[data-building=timber-mine-headframe]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'timber-mine-headframe' && document.querySelector('#modelSize').textContent === '23 × 27 × 17' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const headframe = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(headframe.activeCategory, "mining");
  assert.match(headframe.title, /Timber Mine Headframe/);
  assert.equal(headframe.modelSize, "23 × 27 × 17");
  assert.match(headframe.payload, /^NCM3:/);
  assert.equal(headframe.voxelCount, 1773);
  for (const id of [55, 56, 57, 60, 64, 65, 68, 69]) assert.match(headframe.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(headframe.uncovered, false);
  assert.equal(headframe.glazingDisabled, true);
  assert.equal(headframe.glazingLabel, "Openings: Not applicable");
  assert.equal(headframe.disabledStyles, 6);
  assert.equal(headframe.disabledRoofs, 6);
  assert.equal(headframe.conceptHidden, false);
  assert.match(headframe.conceptAlt, /Timber Mine Headframe concept reference/);
  assert.equal(headframe.conceptFit, "contain");
  assert.equal(headframe.selectedInUrl, "timber-mine-headframe");
  assert.ok(headframe.resources.includes("/build_ncm/buildings/mining/timber-mine-headframe.json"));
  assert.ok(headframe.resources.includes("/build_ncm/concepts/mining/timber-mine-headframe.webp"));
  assert.ok(!headframe.resources.some((path) => path.endsWith("timber-mine-headframe-blueprint.js")));
  assert.ok(!headframe.resources.includes("/build_ncm/buildings/mining/covered-village-ore-sorting-shed.json"), "selecting the headframe must not load the ore-sorting-shed JSON");
  assert.ok(!headframe.resources.includes("/build_ncm/concepts/mining/covered-village-ore-sorting-shed.webp"), "selecting the headframe must not load the ore-sorting-shed concept art");

  await evaluate(client, "document.querySelector('[data-building=covered-village-ore-sorting-shed]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-ore-sorting-shed' && document.querySelector('#modelSize').textContent === '21 × 19 × 17' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const oreSortingShed = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(oreSortingShed.activeCategory, "mining");
  assert.match(oreSortingShed.title, /Covered Village Ore Sorting Shed/);
  assert.equal(oreSortingShed.modelSize, "21 × 19 × 17");
  assert.match(oreSortingShed.payload, /^NCM3:/);
  assert.equal(oreSortingShed.voxelCount, 1026);
  for (const id of [55, 56, 57, 64, 68, 69, 96]) assert.match(oreSortingShed.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(oreSortingShed.uncovered, false);
  assert.equal(oreSortingShed.glazingDisabled, true);
  assert.equal(oreSortingShed.glazingLabel, "Openings: Not applicable");
  assert.equal(oreSortingShed.disabledStyles, 6);
  assert.equal(oreSortingShed.disabledRoofs, 6);
  assert.equal(oreSortingShed.conceptHidden, false);
  assert.match(oreSortingShed.conceptAlt, /Covered Village Ore Sorting Shed concept reference/);
  assert.equal(oreSortingShed.conceptFit, "contain");
  assert.equal(oreSortingShed.selectedInUrl, "covered-village-ore-sorting-shed");
  assert.ok(oreSortingShed.resources.includes("/build_ncm/buildings/mining/covered-village-ore-sorting-shed.json"));
  assert.ok(oreSortingShed.resources.includes("/build_ncm/concepts/mining/covered-village-ore-sorting-shed.webp"));
  assert.ok(!oreSortingShed.resources.some((path) => path.endsWith("covered-village-ore-sorting-shed-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=agriculture]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=glass-timber-greenhouse]')"));
  const agricultureBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    cardCount: document.querySelectorAll('[data-building]').length,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(agricultureBrowse.activeBuilding, null);
  assert.equal(agricultureBrowse.cardCount, 4);
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/buildings/agriculture/glass-timber-greenhouse.json"), "category browsing must not load the greenhouse JSON");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/concepts/agriculture/glass-timber-greenhouse.webp"), "category browsing must not load the greenhouse concept art");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/buildings/agriculture/stone-timber-tower-windmill.json"), "category browsing must not load the windmill JSON");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/concepts/agriculture/stone-timber-tower-windmill.webp"), "category browsing must not load the windmill concept art");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/buildings/agriculture/covered-village-apiary.json"), "category browsing must not load the apiary JSON");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/concepts/agriculture/covered-village-apiary.webp"), "category browsing must not load the apiary concept art");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/buildings/agriculture/compact-village-stable-barn.json"), "category browsing must not load the stable-barn JSON");
  assert.ok(!agricultureBrowse.resources.includes("/build_ncm/concepts/agriculture/compact-village-stable-barn.webp"), "category browsing must not load the stable-barn concept art");
  await evaluate(client, "document.querySelector('[data-building=glass-timber-greenhouse]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'glass-timber-greenhouse' && document.querySelector('#modelSize').textContent === '19 × 20 × 27' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const greenhouse = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(greenhouse.activeCategory, "agriculture");
  assert.match(greenhouse.title, /Glass and Timber Greenhouse/);
  assert.equal(greenhouse.modelSize, "19 × 20 × 27");
  assert.match(greenhouse.payload, /^NCM3:/);
  assert.equal(greenhouse.voxelCount, 2255);
  for (const id of [55, 56, 57, 58, 64, 68, 69, 72]) assert.match(greenhouse.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(greenhouse.uncovered, false);
  assert.equal(greenhouse.glazingDisabled, true);
  assert.equal(greenhouse.glazingLabel, "Openings: Not applicable");
  assert.equal(greenhouse.disabledStyles, 6);
  assert.equal(greenhouse.disabledRoofs, 6);
  assert.equal(greenhouse.conceptHidden, false);
  assert.match(greenhouse.conceptAlt, /Glass and Timber Greenhouse concept reference/);
  assert.equal(greenhouse.conceptFit, "contain");
  assert.equal(greenhouse.selectedInUrl, "glass-timber-greenhouse");
  assert.ok(greenhouse.resources.includes("/build_ncm/buildings/agriculture/glass-timber-greenhouse.json"));
  assert.ok(greenhouse.resources.includes("/build_ncm/concepts/agriculture/glass-timber-greenhouse.webp"));
  assert.ok(!greenhouse.resources.includes("/build_ncm/buildings/agriculture/stone-timber-tower-windmill.json"), "selecting the greenhouse must not load the windmill JSON");
  assert.ok(!greenhouse.resources.includes("/build_ncm/concepts/agriculture/stone-timber-tower-windmill.webp"), "selecting the greenhouse must not load the windmill concept art");
  assert.ok(!greenhouse.resources.includes("/build_ncm/buildings/agriculture/covered-village-apiary.json"), "selecting the greenhouse must not load the apiary JSON");
  assert.ok(!greenhouse.resources.includes("/build_ncm/concepts/agriculture/covered-village-apiary.webp"), "selecting the greenhouse must not load the apiary concept art");
  assert.ok(!greenhouse.resources.some((path) => path.endsWith("glass-timber-greenhouse-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building=stone-timber-tower-windmill]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'stone-timber-tower-windmill' && document.querySelector('#modelSize').textContent === '31 × 35 × 25' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const windmill = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(windmill.activeCategory, "agriculture");
  assert.match(windmill.title, /Stone and Timber Tower Windmill/);
  assert.equal(windmill.modelSize, "31 × 35 × 25");
  assert.match(windmill.payload, /^NCM3:/);
  assert.equal(windmill.voxelCount, 2746);
  for (const id of [55, 56, 57, 58, 64, 65, 68, 69, 96]) assert.match(windmill.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(windmill.uncovered, false);
  assert.equal(windmill.glazingDisabled, true);
  assert.equal(windmill.glazingLabel, "Openings: Not applicable");
  assert.equal(windmill.disabledStyles, 6);
  assert.equal(windmill.disabledRoofs, 6);
  assert.equal(windmill.conceptHidden, false);
  assert.match(windmill.conceptAlt, /Stone and Timber Tower Windmill concept reference/);
  assert.equal(windmill.conceptFit, "contain");
  assert.equal(windmill.selectedInUrl, "stone-timber-tower-windmill");
  assert.ok(windmill.resources.includes("/build_ncm/buildings/agriculture/stone-timber-tower-windmill.json"));
  assert.ok(windmill.resources.includes("/build_ncm/concepts/agriculture/stone-timber-tower-windmill.webp"));
  assert.ok(!windmill.resources.includes("/build_ncm/buildings/agriculture/covered-village-apiary.json"), "selecting the windmill must not load the apiary JSON");
  assert.ok(!windmill.resources.includes("/build_ncm/concepts/agriculture/covered-village-apiary.webp"), "selecting the windmill must not load the apiary concept art");
  assert.ok(!windmill.resources.some((path) => path.endsWith("stone-timber-tower-windmill-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building=covered-village-apiary]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'covered-village-apiary' && document.querySelector('#modelSize').textContent === '25 × 25 × 25' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const apiary = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(apiary.activeCategory, "agriculture");
  assert.match(apiary.title, /Covered Village Apiary/);
  assert.equal(apiary.modelSize, "25 × 25 × 25");
  assert.match(apiary.payload, /^NCM3:/);
  assert.equal(apiary.voxelCount, 5069);
  for (const id of [55, 56, 57, 60, 68, 69, 96]) assert.match(apiary.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(apiary.uncovered, false);
  assert.equal(apiary.glazingDisabled, true);
  assert.equal(apiary.glazingLabel, "Openings: Not applicable");
  assert.equal(apiary.disabledStyles, 6);
  assert.equal(apiary.disabledRoofs, 6);
  assert.equal(apiary.conceptHidden, false);
  assert.match(apiary.conceptAlt, /Covered Village Apiary concept reference/);
  assert.equal(apiary.conceptFit, "contain");
  assert.equal(apiary.selectedInUrl, "covered-village-apiary");
  assert.ok(apiary.resources.includes("/build_ncm/buildings/agriculture/covered-village-apiary.json"));
  assert.ok(apiary.resources.includes("/build_ncm/concepts/agriculture/covered-village-apiary.webp"));
  assert.ok(!apiary.resources.includes("/build_ncm/buildings/agriculture/compact-village-stable-barn.json"), "selecting the apiary must not load the stable-barn JSON");
  assert.ok(!apiary.resources.includes("/build_ncm/concepts/agriculture/compact-village-stable-barn.webp"), "selecting the apiary must not load the stable-barn concept art");
  assert.ok(!apiary.resources.some((path) => path.endsWith("covered-village-apiary-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building=compact-village-stable-barn]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-stable-barn' && document.querySelector('#modelSize').textContent === '25 × 17 × 27' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const stableBarn = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(stableBarn.activeCategory, "agriculture");
  assert.match(stableBarn.title, /Compact Village Stable Barn/);
  assert.equal(stableBarn.modelSize, "25 × 17 × 27");
  assert.match(stableBarn.payload, /^NCM3:/);
  assert.equal(stableBarn.voxelCount, 3015);
  for (const id of [55, 56, 57, 58, 64, 68, 70, 72, 96]) assert.match(stableBarn.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(stableBarn.uncovered, false);
  assert.equal(stableBarn.glazingDisabled, true);
  assert.equal(stableBarn.glazingLabel, "Openings: Not applicable");
  assert.equal(stableBarn.disabledStyles, 6);
  assert.equal(stableBarn.disabledRoofs, 6);
  assert.equal(stableBarn.conceptHidden, false);
  assert.match(stableBarn.conceptAlt, /Compact Village Stable Barn concept reference/);
  assert.equal(stableBarn.conceptFit, "contain");
  assert.equal(stableBarn.selectedInUrl, "compact-village-stable-barn");
  assert.ok(stableBarn.resources.includes("/build_ncm/buildings/agriculture/compact-village-stable-barn.json"));
  assert.ok(stableBarn.resources.includes("/build_ncm/concepts/agriculture/compact-village-stable-barn.webp"));
  assert.ok(!stableBarn.resources.some((path) => path.endsWith("compact-village-stable-barn-blueprint.js")));

  if (screenshotPath) {
    await evaluate(client, "document.querySelector('.building-library-panel').scrollIntoView({block:'start'}); window.scrollBy(0, -76); new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  }

  await evaluate(client, "document.querySelector('[data-building-category=construction]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building-category].active')?.dataset.buildingCategory === 'construction' && document.querySelectorAll('[data-building]').length === 3 && document.querySelector('[data-building=timber-building-scaffold]') && document.querySelector('[data-building=compact-village-stonemason-workshop]') && document.querySelector('[data-building=compact-village-carpenter-workshop]')"));
  const constructionBrowse = await evaluate(client, `({
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building ?? null,
    buildingCount: document.querySelectorAll('[data-building]').length,
    previewTitle: document.querySelector('#buildingTitle').textContent,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(constructionBrowse.activeBuilding, null, "browsing construction must not select or generate a building");
  assert.equal(constructionBrowse.buildingCount, 3);
  assert.match(constructionBrowse.previewTitle, /Compact Village Stable Barn/);
  assert.ok(!constructionBrowse.resources.includes("/build_ncm/buildings/construction/timber-building-scaffold.json"), "browsing construction must not load the scaffold JSON");
  assert.ok(!constructionBrowse.resources.includes("/build_ncm/buildings/construction/compact-village-stonemason-workshop.json"), "browsing construction must not load the stonemason workshop JSON");
  assert.ok(!constructionBrowse.resources.includes("/build_ncm/concepts/construction/compact-village-stonemason-workshop.webp"), "browsing construction must not load the stonemason concept art");
  assert.ok(!constructionBrowse.resources.includes("/build_ncm/buildings/construction/compact-village-carpenter-workshop.json"), "browsing construction must not load the carpenter workshop JSON");
  assert.ok(!constructionBrowse.resources.includes("/build_ncm/concepts/construction/compact-village-carpenter-workshop.webp"), "browsing construction must not load the carpenter concept art");

  await evaluate(client, "document.querySelector('[data-building=timber-building-scaffold]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'timber-building-scaffold'"));
  const scaffold = await evaluate(client, `({
    title: document.querySelector('#buildingTitle').textContent,
    payload: document.querySelector('#codeOutput').value,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.match(scaffold.title, /Timber Building Scaffold/);
  assert.match(scaffold.payload, /^NCM3:/);
  assert.ok(scaffold.resources.includes("/build_ncm/buildings/construction/timber-building-scaffold.json"));
  assert.ok(!scaffold.resources.includes("/build_ncm/buildings/construction/compact-village-stonemason-workshop.json"), "selecting the scaffold must not load the stonemason workshop JSON");
  assert.ok(!scaffold.resources.includes("/build_ncm/concepts/construction/compact-village-stonemason-workshop.webp"), "selecting the scaffold must not load the stonemason concept art");
  assert.ok(!scaffold.resources.includes("/build_ncm/buildings/construction/compact-village-carpenter-workshop.json"), "selecting the scaffold must not load the carpenter workshop JSON");
  assert.ok(!scaffold.resources.includes("/build_ncm/concepts/construction/compact-village-carpenter-workshop.webp"), "selecting the scaffold must not load the carpenter concept art");

  await evaluate(client, "document.querySelector('[data-building=compact-village-stonemason-workshop]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-stonemason-workshop' && document.querySelector('#modelSize').textContent === '23 × 18 × 17' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const stonemason = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(stonemason.activeCategory, "construction");
  assert.match(stonemason.title, /Compact Village Stonemason Workshop/);
  assert.equal(stonemason.modelSize, "23 × 18 × 17");
  assert.match(stonemason.payload, /^NCM3:/);
  assert.equal(stonemason.voxelCount, 1459);
  for (const id of [55, 57, 58, 64, 68, 69, 70, 96]) assert.match(stonemason.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(stonemason.uncovered, false);
  assert.equal(stonemason.glazingDisabled, true);
  assert.equal(stonemason.glazingLabel, "Openings: Not applicable");
  assert.equal(stonemason.disabledStyles, 6);
  assert.equal(stonemason.disabledRoofs, 6);
  assert.equal(stonemason.conceptHidden, false);
  assert.match(stonemason.conceptAlt, /Compact Village Stonemason Workshop concept reference/);
  assert.equal(stonemason.conceptFit, "contain");
  assert.equal(stonemason.selectedInUrl, "compact-village-stonemason-workshop");
  assert.ok(stonemason.resources.includes("/build_ncm/buildings/construction/compact-village-stonemason-workshop.json"));
  assert.ok(stonemason.resources.includes("/build_ncm/concepts/construction/compact-village-stonemason-workshop.webp"));
  assert.ok(!stonemason.resources.includes("/build_ncm/buildings/construction/compact-village-carpenter-workshop.json"), "selecting the stonemason workshop must not load the carpenter workshop JSON");
  assert.ok(!stonemason.resources.includes("/build_ncm/concepts/construction/compact-village-carpenter-workshop.webp"), "selecting the stonemason workshop must not load the carpenter concept art");
  assert.ok(!stonemason.resources.some((path) => path.endsWith("compact-village-stonemason-workshop-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building=compact-village-carpenter-workshop]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'compact-village-carpenter-workshop' && document.querySelector('#modelSize').textContent === '19 × 19 × 25' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const carpenter = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    voxelCount: Number(document.querySelectorAll('#metrics .metric strong')[2].textContent.replaceAll(',', '')),
    usedMaterials: document.querySelector('#materialStrip').textContent,
    uncovered: document.querySelector('#bomSummary').textContent.toLowerCase().includes('uncovered'),
    glazingDisabled: document.querySelector('#toggleGlazing').disabled,
    glazingLabel: document.querySelector('#toggleGlazing').textContent,
    disabledStyles: document.querySelectorAll('[data-style]:disabled').length,
    disabledRoofs: document.querySelectorAll('[data-roof]:disabled').length,
    conceptHidden: document.querySelector('#conceptReference').hidden,
    conceptAlt: document.querySelector('#conceptImage').alt,
    conceptFit: getComputedStyle(document.querySelector('#conceptImage')).objectFit,
    selectedInUrl: new URL(location.href).searchParams.get('building'),
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(carpenter.activeCategory, "construction");
  assert.match(carpenter.title, /Compact Village Carpenter Workshop/);
  assert.equal(carpenter.modelSize, "19 × 19 × 25");
  assert.match(carpenter.payload, /^NCM3:/);
  assert.equal(carpenter.voxelCount, 1811);
  for (const id of [55, 56, 57, 58, 64, 68, 70, 96]) assert.match(carpenter.usedMaterials, new RegExp(`MAT_${String(id).padStart(3, '0')}`));
  assert.equal(carpenter.uncovered, false);
  assert.equal(carpenter.glazingDisabled, true);
  assert.equal(carpenter.glazingLabel, "Openings: Not applicable");
  assert.equal(carpenter.disabledStyles, 6);
  assert.equal(carpenter.disabledRoofs, 6);
  assert.equal(carpenter.conceptHidden, false);
  assert.match(carpenter.conceptAlt, /Compact Village Carpenter Workshop concept reference/);
  assert.equal(carpenter.conceptFit, "contain");
  assert.equal(carpenter.selectedInUrl, "compact-village-carpenter-workshop");
  assert.ok(carpenter.resources.includes("/build_ncm/buildings/construction/compact-village-carpenter-workshop.json"));
  assert.ok(carpenter.resources.includes("/build_ncm/concepts/construction/compact-village-carpenter-workshop.webp"));
  assert.ok(!carpenter.resources.some((path) => path.endsWith("compact-village-carpenter-workshop-blueprint.js")));

  await evaluate(client, "document.querySelector('[data-building-category=residential]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building=hollow-cottage]')"));
  await evaluate(client, "document.querySelector('[data-building=hollow-cottage]').click()");
  await waitFor(() => evaluate(client, "document.querySelector('[data-building].active')?.dataset.building === 'hollow-cottage'"));
  const restoredCottage = await evaluate(client, `({
    payload: document.querySelector('#codeOutput').value,
    modelSize: document.querySelector('#modelSize').textContent,
    activeStyle: document.querySelector('[data-style].active')?.dataset.style,
    glazed: document.querySelector('#toggleGlazing').getAttribute('aria-pressed'),
  })`);
  assert.equal(restoredCottage.payload, cottagePayload, "switching back must restore the canonical cottage payload");
  assert.equal(restoredCottage.modelSize, "24 × 22 × 18");
  assert.equal(restoredCottage.activeStyle, "cottage");
  assert.equal(restoredCottage.glazed, "false");
  assert.equal(await evaluate(client, "document.querySelector('#conceptReference').hidden"), true);

  const cottagePreview = await evaluate(client, "document.querySelector('#preview').toDataURL()");
  await evaluate(client, `(() => {
    const editor = document.querySelector('#codeOutput');
    editor.value = ${JSON.stringify(seaside.payload)};
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#loadCode').click();
  })()`);
  await waitFor(() => evaluate(client, "document.querySelector('#modelSize').textContent === '38 × 29 × 32' && document.querySelector('#codeLoadStatus').classList.contains('ok') && !document.querySelector('#loadCode').disabled"));
  const pastedSeaside = await evaluate(client, `({
    payload: document.querySelector('#codeOutput').value,
    modelSize: document.querySelector('#modelSize').textContent,
    status: document.querySelector('#codeLoadStatus').textContent,
    preview: document.querySelector('#preview').toDataURL(),
    selectedFormat: document.querySelector('[data-format].active')?.dataset.format,
    ncm3Selected: document.querySelector('[data-format=ncm3]').getAttribute('aria-selected'),
  })`);
  assert.equal(pastedSeaside.payload, seaside.payload);
  assert.equal(pastedSeaside.modelSize, "38 × 29 × 32");
  assert.match(pastedSeaside.status, /Loaded [\d,]+ voxels/);
  assert.notEqual(pastedSeaside.preview, cottagePreview, "loading pasted code must replace the spatial preview");
  assert.equal(pastedSeaside.selectedFormat, "ncm3");
  assert.equal(pastedSeaside.ncm3Selected, "true");

  await evaluate(client, `(() => {
    const editor = document.querySelector('#codeOutput');
    editor.value = 'NCM3:not-valid';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#loadCode').click();
  })()`);
  await waitFor(() => evaluate(client, "document.querySelector('#codeLoadStatus').classList.contains('error') && !document.querySelector('#loadCode').disabled"));
  const rejectedPaste = await evaluate(client, `({
    payload: document.querySelector('#codeOutput').value,
    modelSize: document.querySelector('#modelSize').textContent,
    status: document.querySelector('#codeLoadStatus').textContent,
    preview: document.querySelector('#preview').toDataURL(),
  })`);
  assert.equal(rejectedPaste.payload, "NCM3:not-valid", "invalid pasted code should remain editable for correction");
  assert.equal(rejectedPaste.modelSize, "38 × 29 × 32", "invalid pasted code must preserve the current building");
  assert.match(rejectedPaste.status, /Could not load code/);
  assert.equal(rejectedPaste.preview, pastedSeaside.preview, "invalid pasted code must not replace the spatial preview");

  await evaluate(client, `(() => {
    const editor = document.querySelector('#codeOutput');
    editor.value = ${JSON.stringify(cottagePayload)};
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  })()`);
  await waitFor(() => evaluate(client, "document.querySelector('#modelSize').textContent === '24 × 22 × 18' && document.querySelector('#codeLoadStatus').classList.contains('ok')"));
  assert.equal(await evaluate(client, "document.querySelector('#codeOutput').value"), cottagePayload, "Ctrl+Enter should load pasted NCM3 code");

  const payloads = new Set();
  for (const style of ["cottage", "castle", "desert", "coastal", "volcanic", "modern"]) {
    await evaluate(client, `document.querySelector('[data-style="${style}"]').click()`);
    await waitFor(() => evaluate(client, `document.querySelector('[data-style].active')?.dataset.style === "${style}"`));
    const state = await evaluate(client, `({
      payload: document.querySelector('#codeOutput').value,
      title: document.querySelector('#buildingTitle').textContent,
      roles: document.querySelectorAll('.style-material').length,
      uncovered: document.querySelector('#bomSummary').textContent.includes('未覆盖'),
    })`);
    assert.match(state.payload, /^NCM3:/);
    assert.ok(state.title.toLowerCase().includes(style));
    assert.equal(state.roles, 7);
    assert.equal(state.uncovered, false);
    payloads.add(state.payload);
  }
  assert.equal(payloads.size, 6);

  await evaluate(client, "document.querySelector('[data-material-filter=all]').click()");
  await waitFor(() => evaluate(client, "document.querySelectorAll('#buildingMaterialCatalog .model-material-card').length === 33"));
  const catalog = await evaluate(client, `({
    cards: document.querySelectorAll('#buildingMaterialCatalog .model-material-card').length,
    models: document.querySelectorAll('#buildingMaterialCatalog canvas[data-material-model]').length,
    errors: document.querySelectorAll('#buildingMaterialCatalog canvas[data-model-error]').length,
    shapes: [...new Set([...document.querySelectorAll('#buildingMaterialCatalog .model-material-card')].map((card) => card.dataset.shape))],
    distinctImages: new Set([...document.querySelectorAll('#buildingMaterialCatalog canvas')].map((canvas) => canvas.toDataURL())).size,
  })`);
  assert.equal(catalog.cards, 33);
  assert.equal(catalog.models, 33);
  assert.equal(catalog.errors, 0);
  assert.ok(catalog.shapes.includes("plank"));
  assert.ok(catalog.shapes.includes("rod"));
  assert.ok(catalog.shapes.includes("beam"));
  assert.ok(catalog.shapes.includes("glassPanel"));
  assert.ok(catalog.shapes.includes("brick"));
  assert.ok(catalog.shapes.includes("roofTile"));
  assert.ok(catalog.distinctImages >= 28, "baked material models should produce distinct images, not one shared color swatch");

  const beforeGlazing = await evaluate(client, "document.querySelector('#codeOutput').value");
  await evaluate(client, "document.querySelector('#toggleGlazing').click()");
  await waitFor(() => evaluate(client, "document.querySelector('#toggleGlazing').getAttribute('aria-pressed') === 'true'"));
  const afterGlazing = await evaluate(client, "document.querySelector('#codeOutput').value");
  assert.notEqual(afterGlazing, beforeGlazing);

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await client.send("Page.reload", { ignoreCache: true });
  await waitFor(() => evaluate(client, "document.readyState === 'complete' && document.querySelectorAll('[data-style]').length === 6 && document.querySelectorAll('[data-building-category]').length === 12 && document.querySelectorAll('[data-building]').length === 2"));
  await evaluate(client, "document.querySelector('[data-material-filter=all]').click()");
  await waitFor(() => evaluate(client, "document.querySelectorAll('#buildingMaterialCatalog .model-material-card').length === 33"));
  const mobile = await evaluate(client, `({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    modelCards: document.querySelectorAll('#buildingMaterialCatalog .model-material-card').length,
    modelErrors: document.querySelectorAll('canvas[data-model-error]').length,
    categories: document.querySelectorAll('[data-building-category]').length,
    buildingCards: document.querySelectorAll('[data-building]').length,
    buildingThumbnails: document.querySelectorAll('.building-library-preview').length,
    categoryFlow: getComputedStyle(document.querySelector('#buildingCategoryList')).flexDirection,
    editorReadOnly: document.querySelector('#codeOutput').readOnly,
    codeActionTopDelta: Math.abs(document.querySelector('#loadCode').getBoundingClientRect().top - document.querySelector('#copyCode').getBoundingClientRect().top),
    loadButtonHeight: document.querySelector('#loadCode').getBoundingClientRect().height,
    copyButtonHeight: document.querySelector('#copyCode').getBoundingClientRect().height,
  })`);
  assert.equal(mobile.scrollWidth, mobile.clientWidth, "mobile page must not create document-level horizontal overflow");
  assert.equal(mobile.modelCards, 33);
  assert.equal(mobile.modelErrors, 0);
  assert.equal(mobile.categories, 12);
  assert.equal(mobile.buildingCards, 2);
  assert.equal(mobile.buildingThumbnails, 0);
  assert.equal(mobile.categoryFlow, "row");
  assert.equal(mobile.editorReadOnly, false);
  assert.ok(mobile.codeActionTopDelta < 1, "mobile Load and Copy actions should remain on the same row");
  assert.ok(mobile.loadButtonHeight >= 40);
  assert.ok(mobile.copyButtonHeight >= 40);

  const stableBarnDirectUrl = new URL(url);
  stableBarnDirectUrl.searchParams.set("building", "compact-village-stable-barn");
  await client.send("Page.navigate", { url: stableBarnDirectUrl.href });
  await waitFor(() => evaluate(client, "document.readyState === 'complete' && document.querySelector('[data-building-category].active')?.dataset.buildingCategory === 'agriculture' && document.querySelector('[data-building].active')?.dataset.building === 'compact-village-stable-barn' && document.querySelector('#conceptImage').complete && document.querySelector('#conceptImage').naturalWidth > 0"));
  const directSelection = await evaluate(client, `({
    activeCategory: document.querySelector('[data-building-category].active')?.dataset.buildingCategory,
    activeBuilding: document.querySelector('[data-building].active')?.dataset.building,
    title: document.querySelector('#buildingTitle').textContent,
    modelSize: document.querySelector('#modelSize').textContent,
    payload: document.querySelector('#codeOutput').value,
    conceptComplete: document.querySelector('#conceptImage').complete,
    conceptNaturalWidth: document.querySelector('#conceptImage').naturalWidth,
    conceptPath: new URL(document.querySelector('#conceptImage').currentSrc).pathname,
    resources: performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname),
  })`);
  assert.equal(directSelection.activeCategory, "agriculture");
  assert.equal(directSelection.activeBuilding, "compact-village-stable-barn");
  assert.match(directSelection.title, /Compact Village Stable Barn/);
  assert.equal(directSelection.modelSize, "25 × 17 × 27");
  assert.match(directSelection.payload, /^NCM3:/);
  assert.equal(directSelection.conceptComplete, true);
  assert.ok(directSelection.conceptNaturalWidth > 0);
  assert.equal(directSelection.conceptPath, "/build_ncm/concepts/agriculture/compact-village-stable-barn.webp");
  assert.ok(directSelection.resources.includes("/build_ncm/buildings/agriculture/compact-village-stable-barn.json"));
  assert.equal(
    directSelection.resources.filter((path) => path.startsWith("/build_ncm/buildings/")).length,
    1,
    "a direct link must download only its selected building JSON",
  );
  assert.ok(!directSelection.resources.some((path) => path.endsWith("-blueprint.js") || path.endsWith("/house-blueprint.js")), "the JSON runtime must not load building generators");

  assert.deepEqual(failedResponses, []);
  assert.deepEqual(errors, []);
  await client.close();
  console.log(JSON.stringify({ ok: true, styles: payloads.size, failedResponses, errors, resources: initial.resources }, null, 2));
} finally {
  chrome.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => chrome.once("close", resolve)),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
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

async function pollJson(endpoint) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Chrome DevTools did not start at ${endpoint}`);
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
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
