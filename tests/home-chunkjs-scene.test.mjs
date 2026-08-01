import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [html, home, scene, assetManifest] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../home/home.js", import.meta.url), "utf8"),
  readFile(new URL("../home/chunkjs-world-scene.js", import.meta.url), "utf8"),
  readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"),
]);

assert.match(html, /id="homeWorldCanvas"/u);
assert.doesNotMatch(html, /voxelShader/u);
assert.doesNotMatch(html, /<video\b|nck-hero-logo-v0149\.webm/u);
assert.doesNotMatch(assetManifest, /nck-hero-logo-v0149\.webm/u);
await assert.rejects(access(new URL("../public/media/nck-hero-logo-v0149.webm", import.meta.url)));
assert.match(html, /<img class="hero-logo hero-logo-image" src="\/media\/nck-hero-logo-v0149\.png" alt="" \/>/u);
assert.doesNotMatch(home, /setupShader|experimental-webgl/u);
assert.match(home, /HOME_WORLD_SECTION_VIEWS\[activeSectionIndex\]/u);
assert.match(home, /visibility = new Map/u);
assert.match(home, /ratio < 0\.15/u);

for (const modulePath of [
  "chunk/chunk-manager.js",
  "construction/building-mesher.js",
  "construction/building-parser.js",
  "renderer/avatar-mesh.js",
  "renderer/camera.js",
  "renderer/webgl2-renderer.js",
  "world/block-registry.js",
  "world/world-generator.js",
]) {
  assert.ok(scene.includes(modulePath), `Missing Chunk.js runtime module: ${modulePath}`);
}

for (const modelPath of [
  "/media/vox/chr_peasant_guy_blackhair.ncm",
  "/media/vox/chr_peasant_girl_orangehair.ncm",
]) {
  assert.ok(scene.includes(modelPath), `Missing canonical villager model: ${modelPath}`);
}

for (const buildingPath of [
  "seaside-cottage.json",
  "covered-market-stall.json",
  "timber-mine-headframe.json",
  "stone-timber-tower-windmill.json",
]) {
  assert.ok(scene.includes(buildingPath), `Missing canonical building: ${buildingPath}`);
}

for (const view of ["arrival", "world", "market", "guardian", "roadmap"]) {
  assert.match(scene, new RegExp(`\\b${view}: Object\\.freeze\\(`, "u"));
}

assert.match(scene, /renderer\.uploadAvatarMesh\("villager-boy", boyMesh\)/u);
assert.match(scene, /renderer\.uploadAvatarMesh\("villager-girl", girlMesh\)/u);
assert.match(scene, /WORLD_CENTER = Object\.freeze\(\{ x: 2432, y: 100, z: 1712 \}\)/u);
assert.match(scene, /DESKTOP_TERRAIN_VIEW_DISTANCE = 5/u);
assert.match(scene, /sceneTerrainProfile = "open-coastal-plain"/u);
assert.match(scene, /sceneActorBehavior = "waypoint-walk-idle-mine-loop"/u);
assert.match(scene, /id: "tower-windmill"[\s\S]*?quarterTurns: 2/u);
assert.match(scene, /const activeStructureChunks = structureChunks;/u);
assert.doesNotMatch(scene, /STRUCTURES_BY_VIEW|structureChunksForView/u);
assert.match(scene, /const ACTOR_ROUTES = Object\.freeze\(/u);
assert.match(scene, /routeStop\("mine", ACTOR_SITES\.boyMine/u);
assert.match(scene, /const cycleTime = safeElapsed % route\.durationMs/u);
assert.match(scene, /staticRoutePose\(ACTOR_ROUTES\.boy\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, boy, boyPose\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, girl, girlPose\)/u);
assert.match(scene, /function headingYaw\(from, to\)/u);
assert.match(scene, /return Math\.atan2\(-\(to\.x - from\.x\), -\(to\.z - from\.z\)\);/u);
assert.match(scene, /headingYaw\(\{ x, z \}, segment\.lookAt\)/u);
assert.match(scene, /headingYaw\(segment\.from, segment\.to\)/u);
assert.match(scene, /getOpaqueColumnTopAtWorld\(worldX, worldZ\)/u);
assert.match(scene, /exposeActorState\(canvas, "boy", boy, boyPose\)/u);
assert.match(scene, /canvas\.dataset\[`\$\{prefix\}Yaw`\] = avatar\.yaw\.toFixed\(6\)/u);
assert.match(scene, /addCoastalStageDeltas\(runtime, worldConfig, put\)/u);
assert.match(scene, /coastalWaterDistance\(x, z\)/u);
assert.doesNotMatch(scene, /function positionAvatar\(/u);
assert.match(scene, /terrainChunks\.length >= expectedTerrainChunks/u);
assert.match(scene, /expectedTerrainChunks = chunks\.chunks\.size/u);

console.log("Homepage Chunk.js scene wiring is valid.");
