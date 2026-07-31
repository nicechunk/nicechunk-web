import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, home, scene] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../home/home.js", import.meta.url), "utf8"),
  readFile(new URL("../home/chunkjs-world-scene.js", import.meta.url), "utf8"),
]);

assert.match(html, /id="homeWorldCanvas"/u);
assert.doesNotMatch(html, /voxelShader/u);
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
assert.match(scene, /terrainChunks\.length >= expectedTerrainChunks/u);
assert.match(scene, /expectedTerrainChunks = chunks\.chunks\.size/u);

console.log("Homepage Chunk.js scene wiring is valid.");
