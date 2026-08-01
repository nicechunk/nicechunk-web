import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import {
  decodeHomeWorldTerrain,
  unpackHomeWorldTerrainChunk,
} from "../home/home-world-terrain.js";

const [html, home, scene, layout, terrainModule, generator, style, assetManifestSource, terrainBytes, compressedTerrainBytes] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../home/home.js", import.meta.url), "utf8"),
  readFile(new URL("../home/chunkjs-world-scene.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-world-layout.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-world-terrain.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/generate-home-world-terrain.mjs", import.meta.url), "utf8"),
  readFile(new URL("../home/style.css", import.meta.url), "utf8"),
  readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../public/media/home-world-terrain-v1.bin", import.meta.url)),
  readFile(new URL("../public/media/home-world-terrain-v1.bin.gz", import.meta.url)),
]);
const assetManifest = JSON.parse(assetManifestSource);

assert.match(html, /id="homeWorldCanvas"/u);
assert.doesNotMatch(html, /voxelShader/u);
assert.doesNotMatch(html, /<video\b|nck-hero-logo-v0149\.(?:png|webm)/u);
assert.doesNotMatch(assetManifestSource, /nck-hero-logo-v0149\.(?:png|webm)/u);
for (const extension of ["png", "webm"]) {
  await assert.rejects(access(new URL(`../public/media/nck-hero-logo-v0149.${extension}`, import.meta.url)));
}
assert.match(html, /<div class="hero-world-stage" aria-hidden="true"><\/div>/u);
for (const viewport of ["desktop", "mobile"]) {
  const previewPath = `home-world-preview-${viewport}.webp`;
  assert.ok(html.includes(`/media/${previewPath}`), `Missing ${viewport} preview preload.`);
  assert.ok(style.includes(`/media/${previewPath}`), `Missing ${viewport} preview style.`);
  assert.ok(assetManifestSource.includes(`public/media/${previewPath}`), `Missing ${viewport} preview manifest entry.`);
  await access(new URL(`../public/media/${previewPath}`, import.meta.url));
}

assert.doesNotMatch(home, /setupShader|experimental-webgl/u);
const initHome = home.match(/async function initHome\(\) \{[\s\S]*?\n\}/u)?.[0] || "";
assert.ok(
  initHome.indexOf("homeWorldScene = createHomeWorldScene(homeWorldCanvas)") < initHome.indexOf("await "),
  "The Chunk.js scene must start before async navigation and locale initialization.",
);
assert.match(home, /HOME_WORLD_SECTION_VIEWS\[activeSectionIndex\]/u);
assert.match(home, /visibility = new Map/u);
assert.match(home, /ratio < 0\.15/u);

assert.match(scene, /CHUNK_RUNTIME_BUNDLE = "chunk\/browser-runtime\.js"/u);
assert.match(scene, /CHUNK_WORKER_BUNDLE = "chunk\/chunk-build-worker\.bundle\.js"/u);
assert.match(scene, /return import\(\/\* @vite-ignore \*\/ runtimeAssetUrl\(root, CHUNK_RUNTIME_BUNDLE\)\)/u);
assert.doesNotMatch(scene, /load\("(?:construction|renderer|world)\//u);

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
assert.match(generator, /MAX_RUNS_PER_COLUMN = 15/u);
assert.match(generator, /gzipSync\(encoded\.bytes, \{ level: 9 \}\)/u);

const terrain = decodeHomeWorldTerrain(terrainBytes);
assert.equal(terrain.formatVersion, 1);
assert.equal(terrain.generationVersion, 5);
assert.equal(terrain.chunkSize, 16);
assert.equal(terrain.width, 15);
assert.equal(terrain.depth, 15);
assert.equal(terrain.chunks.size, 225);
assert.equal(terrain.runCount, 155_760);
assert.equal(terrain.deltaCount, 620_172);
assert.equal(terrain.fingerprint, "c0c5275f6e1e1f745e076e5dd2484e93");
assert.deepEqual(gunzipSync(compressedTerrainBytes), terrainBytes);
assert.ok(compressedTerrainBytes.byteLength < terrainBytes.byteLength / 20);

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

for (const cloudOverride of ["cloudHeight", "cloudRadius", "cloudCellSize", "cloudFarPadding"]) {
  assert.doesNotMatch(scene, new RegExp(`${cloudOverride}:`, "u"));
}
assert.doesNotMatch(scene, /function positionAvatar\(/u);

console.log("Homepage Chunk.js scene wiring and compact terrain are valid.");
