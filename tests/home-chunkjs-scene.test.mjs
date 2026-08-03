import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import {
  decodeHomeWorldTerrain,
  unpackHomeWorldTerrainChunk,
} from "../home/home-world-terrain.js";

const [html, home, inspector, scene, layout, terrainModule, generator, ncm4Benchmark, style, i18nSource, siteUi, siteHeaderCss, siteHeader, packageSource, assetManifestSource, terrainBytes, compressedTerrainBytes, ncm4ReportSource, ncm4BundleBytes] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../home/home.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-building-inspector.js", import.meta.url), "utf8"),
  readFile(new URL("../home/chunkjs-world-scene.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-world-layout.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-world-terrain.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/generate-home-world-terrain.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/benchmark-home-world-ncm4.mjs", import.meta.url), "utf8"),
  readFile(new URL("../home/style.css", import.meta.url), "utf8"),
  readFile(new URL("../src/i18n.js", import.meta.url), "utf8"),
  readFile(new URL("../src/site-ui.js", import.meta.url), "utf8"),
  readFile(new URL("../src/site-header.css", import.meta.url), "utf8"),
  readFile(new URL("../src/site-header.js", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../public/media/home-world-terrain-v1.bin", import.meta.url)),
  readFile(new URL("../public/media/home-world-terrain-v1.bin.gz", import.meta.url)),
  readFile(new URL("../public/media/home-world-terrain-ncm4-v1-report.json", import.meta.url), "utf8"),
  readFile(new URL("../public/media/home-world-terrain-ncm4-v1.ncm4b", import.meta.url)),
]);
const packageJson = JSON.parse(packageSource);
const assetManifest = JSON.parse(assetManifestSource);
const ncm4Report = JSON.parse(ncm4ReportSource);
const homeLocaleCodes = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const homeLocales = await Promise.all(homeLocaleCodes.map(async (language) => ({
  language,
  source: JSON.parse(await readFile(new URL(`../home/locales/${language}.json`, import.meta.url), "utf8")),
  public: JSON.parse(await readFile(new URL(`../public/home/locales/${language}.json`, import.meta.url), "utf8")),
})));

assert.match(html, /id="homeWorldCanvas"/u);
assert.match(html, /id="homeBuildingInspector"/u);
assert.match(html, /id="ncmInspectorBuildingOutline"/u);
assert.match(html, /id="ncmInspectorBuildingOutlineShadow"/u);
assert.equal([...html.matchAll(/pathLength="1"/gu)].length, 2);
assert.doesNotMatch(html, /voxelShader/u);
assert.doesNotMatch(html, /<video\b|nck-hero-logo-v0149\.(?:png|webm)/u);
assert.doesNotMatch(assetManifestSource, /nck-hero-logo-v0149\.(?:png|webm)/u);
assert.match(siteUi, /if \(!document\.querySelector\("\[data-site-footer-native\]"\)\) ensureUnifiedFooter\(\);/u);
assert.match(siteHeader, /mergeClassNames\(header\.className, "site-header site-header-shared"\)/u);
assert.match(siteHeaderCss, /header\.site-header\.site-header-shared\[data-site-header-mounted="true"\] \{/u);
assert.doesNotMatch(siteHeaderCss, /^\s*\.site-header\s*\{/mu);
for (const extension of ["png", "webm"]) {
  await assert.rejects(access(new URL(`../public/media/nck-hero-logo-v0149.${extension}`, import.meta.url)));
}
assert.match(html, /<div class="hero-world-stage" aria-hidden="true"><\/div>/u);
assert.match(html, /class="chapter-layout chapter-layout-world"/u);
assert.match(html, /class="terrain-pouw-demo"/u);
assert.match(html, /data-source-bytes="340696"/u);
assert.match(html, /data-candidate-bytes="630844"/u);
assert.match(html, /data-exact-chunks="225"/u);
assert.match(html, /data-mismatch-count="0"/u);
assert.match(html, /href="\/media\/home-world-terrain-ncm4-v1-report\.json"/u);
assert.match(html, /href="\/media\/home-world-terrain-ncm4-v1\.ncm4b" download/u);
assert.equal([...html.matchAll(/data-i18n="terrainPouw\./gu)].length, 14);
assert.match(html, /<footer class="site-footer" data-site-footer-native>/u);
assert.equal([...html.matchAll(/class="chapter-copy-line"/gu)].length, 9);
assert.match(style, /\.chapter-copy-line \{[\s\S]*?box-decoration-break: clone;/u);
assert.match(style, /\.chapter-card \{[\s\S]*?background: transparent;[\s\S]*?backdrop-filter: none;/u);
assert.match(style, /\.side-dot \{[\s\S]*?background: transparent;[\s\S]*?border: 0;/u);
assert.doesNotMatch(style, /transition:\s*all/u);
assert.match(style, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 900px\)/u);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ncm-connector-line/u);
assert.match(style, /--terrain-pouw-source-ratio: 54%;/u);
assert.match(style, /PoUW reveal storyboard/u);
assert.match(style, /\.snap-section\.active \.terrain-pouw-candidate > i > b \{\s*width: 100%;/u);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.terrain-pouw-demo,/u);
assert.match(i18nSource, /pageI18nScope === "home"[\s\S]*?"data-home-i18n"/u);
assert.match(i18nSource, /translateAttribute\(root, "data-home-i18n-aria-label", "aria-label"\)/u);
assert.equal(packageJson.scripts["benchmark:home-world:ncm4"], "node scripts/benchmark-home-world-ncm4.mjs");
for (const viewport of ["desktop", "mobile"]) {
  const previewPath = `home-world-preview-${viewport}.webp`;
  assert.ok(html.includes(`/media/${previewPath}`), `Missing ${viewport} preview preload.`);
  assert.ok(style.includes(`/media/${previewPath}`), `Missing ${viewport} preview style.`);
  assert.ok(assetManifestSource.includes(`public/media/${previewPath}`), `Missing ${viewport} preview manifest entry.`);
  await access(new URL(`../public/media/${previewPath}`, import.meta.url));
}

const [brandLogoBytes, desktopPreviewBytes] = await Promise.all([
  readFile(new URL("../public/media/nck.png", import.meta.url)),
  readFile(new URL("../public/media/home-world-preview-desktop.webp", import.meta.url)),
]);
assert.ok(brandLogoBytes.byteLength <= 7_000, `Brand logo exceeds its 7 KB budget: ${brandLogoBytes.byteLength} bytes.`);
assert.ok(desktopPreviewBytes.byteLength <= 8_192, `Desktop preview exceeds its 8 KiB budget: ${desktopPreviewBytes.byteLength} bytes.`);
for (const [path, bytes] of [
  ["public/media/nck.png", brandLogoBytes],
  ["public/media/home-world-preview-desktop.webp", desktopPreviewBytes],
]) {
  const asset = assetManifest.assets.find((entry) => entry.path === path);
  assert.ok(asset, `Missing optimized asset manifest entry: ${path}`);
  assert.equal(asset.bytes, bytes.byteLength);
  assert.equal(asset.sha256, createHash("sha256").update(bytes).digest("hex"));
}

assert.doesNotMatch(home, /setupShader|experimental-webgl/u);
const initHome = home.match(/async function initHome\(\) \{[\s\S]*?\n\}/u)?.[0] || "";
assert.ok(
  initHome.indexOf("homeWorldScene = createHomeWorldScene(homeWorldCanvas, {") < initHome.indexOf("await "),
  "The Chunk.js scene must start before async navigation and locale initialization.",
);
assert.equal([...home.matchAll(/createHomeWorldScene\(homeWorldCanvas, \{/gu)].length, 1);
assert.equal([...home.matchAll(/createHomeBuildingInspector\(homeBuildingInspectorRoot\)/gu)].length, 1);
assert.match(home, /onBuildingInspect: \(detail\) => homeBuildingInspector\?\.update\(detail\)/u);
assert.match(home, /HOME_WORLD_SECTION_VIEWS\[activeSectionIndex\]/u);
assert.match(home, /visibility = new Map/u);
assert.match(home, /ratio < 0\.15/u);

assert.match(scene, /CHUNK_RUNTIME_BUNDLE = "chunk\/browser-runtime\.js"/u);
assert.match(scene, /CHUNK_WORKER_BUNDLE = "chunk\/chunk-build-worker\.bundle\.js"/u);
assert.equal([...scene.matchAll(/new runtime\.ChunkManager\(/gu)].length, 1);
assert.match(scene, /return import\(\/\* @vite-ignore \*\/ runtimeAssetUrl\(root, CHUNK_RUNTIME_BUNDLE\)\)/u);
assert.doesNotMatch(scene, /load\("(?:construction|renderer|world)\//u);
assert.match(scene, /payloadBytes: building\.payloadBytes/u);
assert.match(scene, /voxelCount: building\.voxels\.size/u);
assert.doesNotMatch(scene, /JSON\.stringify\(spec\.definition\)|JSON\.stringify\(target/u);
assert.match(scene, /sceneInspectableBuildings = structureInspectables\.map/u);
assert.match(scene, /raycastInspectableStructure\(projection\.target, pointerRay\)/u);
assert.match(scene, /hasWorldVoxel: \(x, y, z\) => occupiedVoxels\.has/u);
assert.match(scene, /anchor: visibleProjectionAnchor\(topCenter, center, rect, viewport\)/u);
assert.match(scene, /outlineGroups: Object\.freeze\(outlineGroups\)/u);
assert.match(scene, /structureSurfaceProjectionMesh\(placement\.worldVoxels\.values\(\)\)/u);
assert.match(scene, /projectInspectableModelOutline/u);
assert.match(scene, /rasterizeInspectableSilhouette\(projectedFaces, viewport\)/u);
assert.match(scene, /traceStructureMaskContours\(image\.data, canvasWidth, canvasHeight\)/u);
assert.match(scene, /simplifyClosedContour\(contour, BUILDING_OUTLINE_SIMPLIFY_TOLERANCE\)/u);
assert.match(scene, /windmillRotor\?\.currentAngle\?\.\(\)/u);
assert.doesNotMatch(scene, /convexHull2d/u);
assert.doesNotMatch(scene, /structureFeatureEdges|group\.edges/u);
assert.doesNotMatch(scene, /cached\.updatedAt|now - cached\.updatedAt|alignCachedOutlineToProjection/u);
assert.match(scene, /pose\.eye\.map\(\(value\) => Number\(value\)\.toFixed\(4\)\)/u);
assert.match(scene, /const projector = createWorldPointProjector\(pose, viewport\)/u);
assert.match(scene, /projectWorldPointWithProjector\(worldPoints\[index\], projector\)/u);
assert.match(scene, /points: Object\.freeze\(points\)/u);
assert.match(scene, /mergeStructureSurfaceCells\(group\.cells\)/u);
assert.match(scene, /structureSurfaceRectangleCorners\(group, rectangle\)/u);
assert.match(scene, /const BUILDING_OUTLINE_MASK_SCALE = 0\.5;/u);
assert.match(scene, /const BUILDING_OUTLINE_MASK_ALPHA_THRESHOLD = 128;/u);
assert.match(scene, /const BUILDING_OUTLINE_SIMPLIFY_TOLERANCE = 0\.6;/u);
assert.equal([...scene.matchAll(/inspectables\.push\(createInspectableStructure/gu)].length, 2);
assert.match(scene, /projectWorldPoint\(corner, pose, viewport\)/u);
assert.match(scene, /\(hover: hover\) and \(pointer: fine\)/u);
assert.match(scene, /setCameraTransitioning\(cameraTransitionActive\(timestamp\)\)/u);
assert.match(scene, /const enabled = !cameraTransitioning/u);
assert.match(scene, /canvas\.dataset\.sceneCameraTransitioning = String\(active\)/u);
assert.match(scene, /\.terrain-pouw-demo/u);

assert.match(inspector, /const INSPECTOR_TIMING = Object\.freeze/u);
assert.match(inspector, /target\.ncmCode/u);
assert.match(inspector, /target\.voxelCount \/ Math\.max\(1, target\.payloadBytes\)/u);
assert.match(inspector, /root\.dataset\.active = "false"/u);
assert.match(inspector, /updateBuildingOutline\(detail\.outline\)/u);
assert.match(inspector, /buildingOutline\.setAttribute\("d", path\)/u);
assert.doesNotMatch(inspector, /setAttribute\("points"/u);
assert.match(inspector, /detail\.bounds\.right \+ PANEL_GAP_PX/u);
assert.doesNotMatch(inspector, /transition:\s*all/u);
assert.match(style, /\.ncm-building-outline \{[\s\S]*?stroke: var\(--ncm-inspector-white\);/u);
assert.match(style, /stroke-dasharray: 10 7;/u);
assert.match(style, /\.home-camera-transitioning \.home-building-inspector \{\s*visibility: hidden;/u);
assert.doesNotMatch(style, /@keyframes ncm-building-outline/u);
assert.doesNotMatch(style, /\.ncm-building-outline \{[^}]*filter:/su);
assert.match(style, /font: 650 11px\/1\.52/u);

for (const { language, source, public: publicLocale } of homeLocales) {
  assert.deepEqual(publicLocale.buildingInspector, source.buildingInspector, `Public ${language} inspector copy is stale.`);
  assert.deepEqual(publicLocale.terrainPouw, source.terrainPouw, `Public ${language} terrain PoUW copy is stale.`);
  const { _meta: meta, ...publicBody } = publicLocale;
  const contentHash = createHash("sha256").update(JSON.stringify(publicBody)).digest("hex").slice(0, 16);
  assert.equal(meta.contentHash, contentHash, `Public ${language} locale hash is stale.`);
  assert.equal(meta.version, `home-locale-${language}-${contentHash}`, `Public ${language} locale version is stale.`);
  for (const dictionary of [source, publicLocale]) {
    assert.equal(typeof dictionary.buildingInspector?.aria, "string", `Missing ${language} building inspector aria label.`);
    assert.equal(typeof dictionary.buildingInspector?.detail, "string", `Missing ${language} building inspector detail.`);
    assert.equal(typeof dictionary.buildingInspector?.fullCode, "string", `Missing ${language} building inspector code label.`);
    assert.match(dictionary.buildingInspector.codeLength, /\{count\}/u, `Missing ${language} code-length token.`);
    for (const key of ["aria", "eyebrow", "title", "source", "candidate", "proof", "exact", "decision", "retained", "larger", "summary", "caveat", "report", "bundle", "miner"]) {
      assert.equal(typeof dictionary.terrainPouw?.[key], "string", `Missing ${language} terrain PoUW ${key} copy.`);
      assert.ok(dictionary.terrainPouw[key].trim().length > 0, `Empty ${language} terrain PoUW ${key} copy.`);
    }
  }
}

for (const modelPath of [
  "/media/vox/chr_peasant_guy_blackhair.ncm",
  "/media/vox/chr_peasant_girl_orangehair.ncm",
]) {
  assert.ok(scene.includes(modelPath), `Missing canonical villager model: ${modelPath}`);
}

for (const buildingPath of [
  "seaside-cottage.json",
  "covered-village-notice-board.json",
  "hollow-cottage.json",
  "stone-timber-footbridge.json",
  "stone-timber-tower-windmill.json",
]) {
  assert.ok(layout.includes(buildingPath), `Missing canonical building: ${buildingPath}`);
}
assert.doesNotMatch(layout, /covered-market-stall\.json|timber-mine-headframe\.json/u);
const structureLayout = layout.match(/export const STRUCTURE_LAYOUT = Object\.freeze\(\[[\s\S]*?\n\]\);/u)?.[0];
assert.ok(structureLayout, "Missing fixed structure layout block.");
assert.equal([...structureLayout.matchAll(/\bid: "/gu)].length, 5);

for (const view of ["arrival", "world", "market", "guardian", "roadmap"]) {
  assert.match(scene, new RegExp(`\\b${view}: Object\\.freeze\\(`, "u"));
}

assert.match(scene, /renderer\.uploadAvatarMesh\("villager-boy", boyMesh\)/u);
assert.match(scene, /renderer\.uploadAvatarMesh\("villager-girl", girlMesh\)/u);
assert.match(layout, /WORLD_CENTER = Object\.freeze\(\{ x: 2432, y: 100, z: 1712 \}\)/u);
assert.match(layout, /MOBILE_TERRAIN_VIEW_DISTANCE = 6/u);
assert.match(layout, /DESKTOP_TERRAIN_VIEW_DISTANCE = 7/u);
assert.match(layout, /COASTAL_STAGE_BOUNDS = Object\.freeze\(\{ minX: 2320, maxX: 2559, minZ: 1600, maxZ: 1839 \}\)/u);
assert.match(layout, /COASTAL_WATER_MARGIN = 18/u);
assert.match(scene, /sceneTerrainProfile = "two-landmasses-river-bay"/u);
assert.match(scene, /sceneMapBounds = "240x240"/u);
assert.match(scene, /sceneActorBehavior = "waypoint-walk-bridge-idle-mine-loop"/u);
assert.match(scene, /WINDMILL_ROTATION_MS = 42_000/u);
assert.match(scene, /splitWindmillBuilding\(building, spec\.definition\)/u);
assert.match(scene, /sceneAnimatedPart = "windmill-rotor"/u);
assert.match(scene, /function rotatedRotorMesh\(chunk, sourceVertices, pivot, angle\)/u);
assert.match(scene, /sceneWindmillRotating = String\(!reducedMotion\.matches\)/u);
assert.match(layout, /id: "coastal-cottage"[\s\S]*?surfaceY: PRESENTATION_WATER_BED_Y[\s\S]*?siteMode: "water"/u);
assert.match(layout, /id: "river-footbridge"[\s\S]*?siteMode: "bridge"[\s\S]*?walkable: true/u);
assert.match(layout, /id: "tower-windmill"[\s\S]*?quarterTurns: 2/u);
assert.match(scene, /routeWalk\(ACTOR_SITES\.bridgeEast, ACTOR_SITES\.bridgeWest/u);
assert.match(scene, /routeWalk\(ACTOR_SITES\.bridgeWest, ACTOR_SITES\.bridgeEast/u);
assert.match(scene, /const activeStructureChunks = structureChunks;/u);
assert.doesNotMatch(scene, /STRUCTURES_BY_VIEW|structureChunksForView/u);
assert.match(scene, /const ACTOR_ROUTES = Object\.freeze\(/u);
assert.match(scene, /routeStop\("mine", ACTOR_SITES\.boyMine/u);
assert.match(scene, /const cycleTime = safeElapsed % route\.durationMs/u);
assert.match(scene, /staticRoutePose\(ACTOR_ROUTES\.boy\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, structureWalkSurfaces, boy, boyPose\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, structureWalkSurfaces, girl, girlPose\)/u);
assert.match(scene, /function addStructureWalkSurfaces\(placement, spec, walkSurfaces\)/u);
assert.match(scene, /structureWalkSurfaces\.get\(`\$\{worldX\},\$\{worldZ\}`\)/u);
assert.match(scene, /return Math\.atan2\(-\(to\.x - from\.x\), -\(to\.z - from\.z\)\);/u);
assert.match(scene, /canvas\.dataset\[`\$\{prefix\}Yaw`\] = avatar\.yaw\.toFixed\(6\)/u);

assert.match(scene, /loadHomeWorldTerrain\(options\.terrainUrl\)/u);
assert.match(scene, /applyHomeWorldTerrain\(chunks, presentationTerrain/u);
assert.match(scene, /chunks\.setRenderLogger\(\{ record: recordBuildEvent \}\)/u);
assert.match(scene, /type === "chunk-build-done"/u);
assert.match(scene, /type === "chunk-remesh-done"/u);
assert.match(scene, /runtime\.chunkIntersectsCameraFrustum\(terrainReadinessProbe\(chunk\), camera\)/u);
assert.match(scene, /gpuMeshReady\(chunks\.chunks\.get\(id\)\)/u);
assert.match(scene, /readiness\.ready\) markReady\(\)/u);
assert.doesNotMatch(scene, /terrainChunks\.length >=|expectedTerrainChunks|createPresentationDeltas|presentationBoundsForView/u);
assert.match(terrainModule, /new Int32Array\(entry\.deltaCount \* 4\)/u);
assert.match(terrainModule, /new DecompressionStream\("gzip"\)/u);
assert.match(terrainModule, /withTransferMetadata\(decodeHomeWorldTerrain\(bytes\), "identity"/u);
assert.match(generator, /createPresentationDeltas/u);
assert.match(generator, /presentationReliefRise\(x, z, shoreDistance\)/u);
assert.match(generator, /treeSurfaceY = surfaceHeights\.get/u);
assert.match(generator, /MAX_RUNS_PER_COLUMN = 15/u);
assert.match(generator, /gzipSync\(encoded\.bytes, \{ level: 9 \}\)/u);
assert.match(ncm4Benchmark, /material = deltas\[offset \+ 3\] \+ 1/u);
assert.match(ncm4Benchmark, /"--json", "ncm4", "verify"/u);
assert.match(ncm4Benchmark, /verifyBundle\(bundleBytes, records, bounds\.minY, bounds\.height\)/u);
assert.match(ncm4Benchmark, /candidate\.subarray\(0, 4\)\.toString\("ascii"\) !== "NC4P"/u);

const terrain = decodeHomeWorldTerrain(terrainBytes);
assert.equal(terrain.formatVersion, 1);
assert.equal(terrain.generationVersion, 5);
assert.equal(terrain.chunkSize, 16);
assert.equal(terrain.width, 15);
assert.equal(terrain.depth, 15);
assert.equal(terrain.chunks.size, 225);
assert.equal(terrain.runCount, 155_921);
assert.equal(terrain.deltaCount, 621_618);
assert.equal(terrain.fingerprint, "59beb5ad830be97321f01490e42b9f81");
assert.deepEqual(gunzipSync(compressedTerrainBytes), terrainBytes);
assert.ok(compressedTerrainBytes.byteLength < terrainBytes.byteLength / 20);

assert.equal(ncm4Report.schema, "nicechunk.home.terrain-ncm4-research.v1");
assert.equal(ncm4Report.source.format, "NCHT-v1");
assert.equal(ncm4Report.source.bytes, terrainBytes.byteLength);
assert.equal(ncm4Report.source.gzipBytes, compressedTerrainBytes.byteLength);
assert.equal(ncm4Report.source.sha256, createHash("sha256").update(terrainBytes).digest("hex"));
assert.equal(ncm4Report.source.fingerprint, terrain.fingerprint);
assert.equal(ncm4Report.source.chunks, terrain.chunks.size);
assert.equal(ncm4Report.source.deltas, terrain.deltaCount);
assert.equal(ncm4Report.source.runs, terrain.runCount);
assert.equal(ncm4Report.projection.format, "NCM4B-v1");
assert.equal(ncm4Report.projection.ncm4Format, "ncm4-pouw-v1");
assert.equal(ncm4Report.projection.profile, "building");
assert.equal(ncm4Report.projection.genericNcm3Bytes, 1_248_718);
assert.equal(ncm4Report.projection.ncm4RecordBytes, 630_844);
assert.equal(ncm4Report.projection.bundleBytes, 632_654);
assert.equal(ncm4Report.projection.ncm4SavedPercentAgainstNcm3, 49.4807);
assert.equal(ncm4Report.projection.ncm4LargerPercentAgainstNcht, 85.1633);
assert.equal(ncm4Report.projection.exactChunks, 225);
assert.equal(ncm4Report.projection.chunkCount, 225);
assert.equal(ncm4Report.projection.mismatchCount, 0);
assert.equal(ncm4Report.projection.selectedRepresentation, "NCHT-v1");
assert.equal(ncm4Report.decision.accepted, false);
assert.match(ncm4Report.caveat, /not the current ChunkBroken-only NCM4 terrain profile/u);
assert.equal(ncm4Report.chunks.length, 225);
assert.ok(ncm4Report.chunks.every((chunk) => chunk.exact && chunk.mismatchCount === 0 && chunk.acceptedAgainstNcm3));
assert.equal(ncm4Report.chunks.reduce((total, chunk) => total + chunk.deltaCount, 0), terrain.deltaCount);
assert.equal(ncm4Report.chunks.reduce((total, chunk) => total + chunk.runCount, 0), terrain.runCount);
assert.equal(ncm4Report.chunks.reduce((total, chunk) => total + chunk.ncm4Bytes, 0), 630_844);
assert.equal(ncm4BundleBytes.byteLength, ncm4Report.projection.bundleBytes);
assert.equal(createHash("sha256").update(ncm4BundleBytes).digest("hex"), ncm4Report.projection.bundleSha256);
assert.equal(ncm4BundleBytes.subarray(0, 4).toString("ascii"), "NC4B");
assert.equal(ncm4BundleBytes[4], 1);
assert.equal(ncm4BundleBytes.readUInt16LE(5), 225);
assert.equal(ncm4BundleBytes.readInt16LE(7), 85);
assert.equal(ncm4BundleBytes[9], 30);
let ncm4BundleOffset = 10;
for (const proof of ncm4Report.chunks) {
  assert.equal(ncm4BundleBytes.readInt16LE(ncm4BundleOffset), proof.chunkX);
  assert.equal(ncm4BundleBytes.readInt16LE(ncm4BundleOffset + 2), proof.chunkZ);
  assert.equal(ncm4BundleBytes.readUInt32LE(ncm4BundleOffset + 4), proof.ncm4Bytes);
  ncm4BundleOffset += 8;
  assert.equal(ncm4BundleBytes.subarray(ncm4BundleOffset, ncm4BundleOffset + 4).toString("ascii"), "NC4P");
  ncm4BundleOffset += proof.ncm4Bytes;
}
assert.equal(ncm4BundleOffset, ncm4BundleBytes.length);

for (const [worldX, worldZ, expectedY] of [
  [2400, 1642, 101],
  [2396, 1787, 100],
  [2522, 1784, 101],
  [2432, 1712, 99],
]) {
  const packed = unpackHomeWorldTerrainChunk(terrain, Math.floor(worldX / 16), Math.floor(worldZ / 16));
  let topY = -Infinity;
  for (let offset = 0; offset < packed.length; offset += 4) {
    if (packed[offset] !== worldX || packed[offset + 2] !== worldZ || packed[offset + 3] === 0) continue;
    topY = Math.max(topY, packed[offset + 1]);
  }
  assert.equal(topY, expectedY, `Unexpected homepage relief height at ${worldX},${worldZ}.`);
}

for (const view of ["arrival", "world", "market", "guardian", "roadmap"]) {
  const preset = scene.match(new RegExp(`${view}: Object\\.freeze\\(\\{[\\s\\S]*?eye: \\[([^\\]]+)\\],[\\s\\S]*?target: \\[([^\\]]+)\\]`, "u"));
  assert.ok(preset, `Missing ${view} camera preset.`);
  const eye = preset[1].split(",").map(Number);
  const target = preset[2].split(",").map(Number);
  const distance = Math.hypot(...eye.map((value, index) => value - target[index]));
  assert.ok(distance < 112, `${view} camera is too far from its subject (${distance.toFixed(2)}).`);
}
assert.match(scene, /const distanceScale = mobile \? 1\.08 : 1/u);
assert.match(scene, /fov: source\.fov \+ \(mobile \? 2 : 0\)/u);

const centerDeltas = unpackHomeWorldTerrainChunk(terrain, 152, 107);
assert.ok(centerDeltas instanceof Int32Array);
assert.equal(centerDeltas.length / 4, terrain.chunks.get("152,107").deltaCount);
const positions = new Set();
for (let offset = 0; offset < centerDeltas.length; offset += 4) {
  assert.equal(Math.floor(centerDeltas[offset] / 16), 152);
  assert.equal(Math.floor(centerDeltas[offset + 2] / 16), 107);
  const key = `${centerDeltas[offset]},${centerDeltas[offset + 1]},${centerDeltas[offset + 2]}`;
  assert.equal(positions.has(key), false, `Duplicate compact terrain position: ${key}`);
  positions.add(key);
}

const terrainAsset = assetManifest.assets.find((asset) => asset.path === "public/media/home-world-terrain-v1.bin");
assert.ok(terrainAsset, "Missing compact homepage terrain manifest entry.");
assert.equal(terrainAsset.bytes, terrainBytes.byteLength);
assert.equal(terrainAsset.sha256, createHash("sha256").update(terrainBytes).digest("hex"));
const compressedTerrainAsset = assetManifest.assets.find((asset) => asset.path === "public/media/home-world-terrain-v1.bin.gz");
assert.ok(compressedTerrainAsset, "Missing compressed homepage terrain manifest entry.");
assert.equal(compressedTerrainAsset.bytes, compressedTerrainBytes.byteLength);
assert.equal(compressedTerrainAsset.sha256, createHash("sha256").update(compressedTerrainBytes).digest("hex"));
for (const [path, bytes] of [
  ["public/media/home-world-terrain-ncm4-v1-report.json", Buffer.from(ncm4ReportSource)],
  ["public/media/home-world-terrain-ncm4-v1.ncm4b", ncm4BundleBytes],
]) {
  const asset = assetManifest.assets.find((entry) => entry.path === path);
  assert.ok(asset, `Missing NCM4 terrain research asset: ${path}`);
  assert.equal(asset.bytes, bytes.byteLength);
  assert.equal(asset.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(asset.sourceStatus, "generated-research");
  assert.equal(asset.canonical, false);
}

for (const cloudOverride of ["cloudHeight", "cloudRadius", "cloudCellSize", "cloudFarPadding"]) {
  assert.doesNotMatch(scene, new RegExp(`${cloudOverride}:`, "u"));
}
assert.doesNotMatch(scene, /function positionAvatar\(/u);

console.log("Homepage Chunk.js scene wiring and compact terrain are valid.");
