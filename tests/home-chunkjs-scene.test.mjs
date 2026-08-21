import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

import {
  decodeHomeWorldTerrain,
  homeBuildAssetUrl,
  unpackHomeWorldTerrainChunk,
} from "../home/home-world-terrain.js";
import {
  ACTOR_SITES,
  CONSTRUCTION_SITE,
  ECONOMY_FORGE_SITE,
  ECONOMY_MATERIAL_SITES,
  MINING_TARGET,
  PRESENTATION_PATHS,
  PRESENTATION_PLANTS,
  PRESENTATION_TREES,
  SCENE_RESOURCE_CLUSTERS,
  STRUCTURE_LAYOUT,
} from "../home/home-world-layout.js";
import {
  HOME_STRUCTURE_NCM_CODES,
  HOME_STRUCTURE_ROOF_MATERIAL_ID,
} from "../home/home-world-structure-codes.js";

const [html, home, inspector, scene, deferredAssets, layout, terrainModule, generator, ncm4Benchmark, style, i18nSource, siteUi, siteHeaderCss, siteHeader, packageSource, buildVersionTransformSource, assetManifestSource, terrainBytes, compressedTerrainBytes, ncm4ReportSource, ncm4BundleBytes] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../home/home.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-building-inspector.js", import.meta.url), "utf8"),
  readFile(new URL("../home/chunkjs-world-scene.js", import.meta.url), "utf8"),
  readFile(new URL("../home/home-world-deferred-assets.js", import.meta.url), "utf8"),
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
  readBuildVersionTransformSource(),
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
assert.match(html, /id="homeWorldLoader"[\s\S]*?data-site-loading-progress/u);
assert.match(html, /class="home-world-loader-backdrop" aria-hidden="true"/u);
assert.match(html, /id="homeWorldLoadingStage"[\s\S]*?data-site-loading-stage/u);
assert.equal([...html.matchAll(/class="home-loader-voxel"/gu)].length, 16);
assert.match(html, /id="homeBuildingInspector"/u);
assert.match(html, /id="homeScrollCue"[\s\S]*?data-scroll-target="1"/u);
assert.equal([...html.matchAll(/data-home-i18n="scrollCue\.(?:desktop|mobile)"/gu)].length, 2);
assert.match(html, /id="guardianChatLayer" data-active="false"/u);
assert.match(html, /id="guardianChatBoy" data-speaking="true"/u);
assert.match(html, /id="guardianChatGirl" data-speaking="false"/u);
assert.equal([...html.matchAll(/data-home-i18n="watchers\.chat\.pair0\.(?:boy|girl)"/gu)].length, 2);
assert.match(html, /id="ncmInspectorBuildingOutline"/u);
assert.match(html, /id="ncmInspectorBuildingOutlineShadow"/u);
assert.equal([...html.matchAll(/pathLength="1"/gu)].length, 2);
assert.doesNotMatch(html, /voxelShader/u);
assert.doesNotMatch(html, /<video\b|nck-hero-logo-v0149\.(?:png|webm)/u);
assert.doesNotMatch(assetManifestSource, /nck-hero-logo-v0149\.(?:png|webm)/u);
assert.match(siteUi, /if \(!usesSharedHeader\) ensureUnifiedNavigation\(\);\s*ensureUnifiedFooter\(\);/u);
assert.match(siteUi, /footer\.site-footer, \[data-site-footer-native\]/u);
assert.match(siteUi, /const homeFooterContainer = findHomeFooterContainer\(\);/u);
assert.match(siteUi, /homeFooterContainer\.append\(footer\);/u);
assert.match(siteHeader, /mergeClassNames\(header\.className, "site-header site-header-shared"\)/u);
assert.match(siteHeader, /const MOBILE_MEDIA_QUERY = "\(max-width: 900px\)";/u);
assert.match(siteHeaderCss, /header\.site-header\.site-header-shared\[data-site-header-mounted="true"\] \{/u);
assert.match(siteHeaderCss, /@media \(max-width: 900px\) \{[\s\S]*?\.site-header \.site-menu-toggle/u);
assert.match(siteHeaderCss, /max-height: min\(70dvh, 620px\)/u);
assert.doesNotMatch(siteHeaderCss, /^\s*\.site-header\s*\{/mu);
for (const extension of ["png", "webm"]) {
  await assert.rejects(access(new URL(`../public/media/nck-hero-logo-v0149.${extension}`, import.meta.url)));
}
assert.match(html, /<div class="hero-world-stage" aria-hidden="true"><\/div>/u);
assert.match(html, /class="chapter-layout chapter-layout-world"/u);
assert.doesNotMatch(html, /class="terrain-pouw-demo"/u);
assert.match(html, /<footer class="site-footer" data-site-footer-native>/u);
assert.ok(
  html.indexOf('<header class="site-header"') < html.indexOf('<nav class="chapter-nav"'),
  "Primary site navigation must precede chapter navigation in the tab order.",
);
assert.deepEqual(
  [...html.matchAll(/<button class="side-dot[^"]*"[^>]*tabindex="(-?\d+)"/gu)].map((match) => Number(match[1])),
  [0, -1, -1, -1, -1],
  "Chapter navigation must expose one initial roving-tabindex stop.",
);
assert.equal([...html.matchAll(/class="chapter-copy-line"/gu)].length, 10);
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
assert.match(style, /Homepage world-loader storyboard/u);
assert.match(style, /\.home-world-loader-backdrop \{[\s\S]*?backdrop-filter: blur\(8px\) saturate\(0\.82\);/u);
assert.match(style, /\.home-world-loader \{[\s\S]*?top: 50%;[\s\S]*?transform: translate\(-50%, calc\(-50% - 6px\)\) scale\(0\.98\);/u);
assert.match(style, /\.site-loading \.home-world-loader \{[\s\S]*?transform: translate\(-50%, -50%\) scale\(1\);/u);
assert.match(style, /\.home-world-presented \.home-world-static \{\s*display: none;/u);
assert.match(style, /\.scroll-container > \.nicechunk-site-footer-home \{[\s\S]*?min-height: 100dvh !important;[\s\S]*?scroll-snap-align: start;/u);
assert.match(style, /@keyframes home-loader-voxel-rise/u);
assert.match(style, /@keyframes home-loader-scan/u);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-loader-voxel-grid i,/u);
assert.match(style, /#section-1 \.world-copy > p:not\(\.eyebrow\),[\s\S]*?#section-1 \.world-readout \{\s*display: none;/u);
assert.match(style, /#section-1 \.terrain-pouw-actions a:nth-child\(n \+ 2\) \{\s*display: none;/u);
assert.match(style, /\.guardian-chat-layer\[data-active="true"\]/u);
assert.match(style, /\.guardian-chat-bubble-boy \{[\s\S]*?--guardian-chat-tail-x: 84%;/u);
assert.match(style, /\.guardian-chat-bubble-girl \{[\s\S]*?--guardian-chat-tail-x: 16%;/u);
assert.match(style, /@keyframes guardian-chat-talk/u);
assert.ok(
  /pageI18nScope === "home"[\s\S]*?"data-home-i18n"/u.test(i18nSource)
    || /querySelectorAll\("\[data-home-i18n\]"\)/u.test(i18nSource),
  "The shared i18n runtime must translate homepage-scoped text.",
);
assert.match(i18nSource, /translateAttribute\(root, "data-home-i18n-aria-label", "aria-label"\)/u);
assert.equal(packageJson.scripts["benchmark:home-world:ncm4"], "node scripts/benchmark-home-world-ncm4.mjs");
assert.match(buildVersionTransformSource, /\.replaceAll\("__NICECHUNK_BUILD_VERSION__", buildVersion\)/u);
for (const viewport of ["desktop", "mobile"]) {
  const previewPath = `home-world-preview-${viewport}.webp`;
  assert.ok(html.includes(`/media/${previewPath}`), `Missing ${viewport} preview preload.`);
  assert.ok(style.includes(`/media/${previewPath}`), `Missing ${viewport} preview style.`);
  assert.ok(assetManifestSource.includes(`public/media/${previewPath}`), `Missing ${viewport} preview manifest entry.`);
  await access(new URL(`../public/media/${previewPath}`, import.meta.url));
}
assert.match(html, /home-world-preview-desktop\.webp" media="\(min-width: 901px\)"/u);
assert.match(html, /home-world-preview-mobile\.webp" media="\(max-width: 900px\)"/u);
assert.match(html, /rel: "modulepreload", href: `\/chunk\.js\/chunk\/browser-runtime\.js\$\{versionSuffix\}`/u);
assert.match(html, /rel: "preload", as: "fetch", type: "application\/javascript", href: `\/chunk\.js\/chunk\/chunk-build-worker\.bundle\.js\$\{versionSuffix\}`/u);
assert.match(html, /Object\.assign\(link, warmup, \{ crossOrigin: "anonymous", fetchPriority: "high" \}\)/u);
assert.doesNotMatch(html, /<link rel="modulepreload"[^>]+browser-runtime/u);
assert.match(html, /rel="preload" as="fetch"[^>]+href="\/media\/home-world-terrain-v1\.bin\.gz\?v=__NICECHUNK_BUILD_VERSION__"/u);
const preloadLinks = html.match(/<link\b[^>]*\brel="preload"[^>]*>/gu) || [];
for (const deferredModelPath of [
  "/media/vox/chr_peasant_guy_blackhair.ncm",
  "/media/vox/chr_peasant_girl_orangehair.ncm",
]) {
  assert.ok(
    preloadLinks.every((link) => !link.includes(deferredModelPath)),
    `${deferredModelPath} must load with the 3D scene instead of being preloaded before first paint.`,
  );
}
assert.equal(homeBuildAssetUrl("/chunk.js/chunk/browser-runtime.js", "build 42"), "/chunk.js/chunk/browser-runtime.js?v=build%2042");
assert.equal(homeBuildAssetUrl("/asset.bin?format=gzip", "build-42"), "/asset.bin?format=gzip&v=build-42");
assert.equal(homeBuildAssetUrl("/asset.bin", "__NICECHUNK_BUILD_VERSION__"), "/asset.bin");

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
assert.match(home, /import \{[\s\S]*?claimSiteLoading,[\s\S]*?finishSiteLoading,[\s\S]*?setSiteLoadingProgress,[\s\S]*?setSiteLoadingStage,[\s\S]*?\} from "\.\.\/src\/site-ui\.js";/u);
assert.match(home, /claimSiteLoading\(\);/u);
assert.match(siteUi, /export function claimSiteLoading\(\) \{[\s\S]*?loadingState\.autoFinish = false;/u);
assert.match(siteUi, /export function setSiteLoadingStage\(value\)/u);
assert.match(siteUi, /querySelectorAll\("\[data-site-loading-progress\]"\)/u);
assert.match(siteUi, /if \(loadingState\.active && loadingState\.autoFinish\) finishSiteLoading\(\);/u);
assert.equal([...home.matchAll(/createHomeWorldScene\(homeWorldCanvas, \{/gu)].length, 1);
assert.match(home, /const HOME_WORLD_READY_TIMEOUT_MS = 30_000;/u);
assert.match(home, /const HOME_WORLD_VISUAL_HANDOFF_TIMEOUT_MS = 4_000;/u);
assert.match(home, /const sceneResult = await waitForHomeWorldScene\(homeWorldScene\);/u);
assert.match(home, /function presentHomeWorld\([\s\S]*?waitForHomeWorldVisualHandoff\(homeWorldCanvas\)[\s\S]*?completeHomeWorldPresentation\(\{ updateLoading \}\)/u);
assert.match(home, /function completeHomeWorldPresentation\([\s\S]*?classList\.add\("home-world-presented"\)/u);
assert.match(home, /function watchForLateHomeWorldReady\(scene\)[\s\S]*?scene\?\.ready\.then[\s\S]*?void presentHomeWorld\(\);/u);
assert.match(home, /function watchForLateHomeWorldHandoff\(canvas\)[\s\S]*?completeIfReady[\s\S]*?completeHomeWorldPresentation\(\)[\s\S]*?MutationObserver\(completeIfReady\)/u);
assert.match(home, /attributeFilter: \["data-scene-visual-handoff"\]/u);
assert.match(home, /homeWorldHandoffObserver\.observe\([\s\S]*?completeIfReady\(\);/u);
assert.match(home, /sceneResult\?\.status === "ready"[\s\S]*?presentHomeWorld\(\{ updateLoading: true \}\)[\s\S]*?watchForLateHomeWorldReady\(homeWorldScene\);/u);
for (const stage of ["terrain", "meshing", "rendering", "ready", "fallback"]) {
  assert.match(home, new RegExp(`setSiteLoadingStage\\(t\\("loading\\.${stage}"\\)\\)`, "u"));
}
assert.doesNotMatch(home, /Promise\.race\(\[homeWorldScene\.ready, delay\(1_800\)\]\)/u);
assert.equal([...home.matchAll(/createHomeBuildingInspector\(homeBuildingInspectorRoot\)/gu)].length, 1);
assert.match(home, /onBuildingInspect: \(detail\) => homeBuildingInspector\?\.update\(detail\)/u);
assert.match(home, /onGuardianChat: updateGuardianChat/u);
assert.match(home, /watchers\.chat\.pair\$\{detail\.pairIndex\}\.\$\{actor\}/u);
assert.match(home, /bubble\.copy\.textContent = t\(key\)/u);
assert.match(home, /HOME_WORLD_SECTION_VIEWS\[activeSectionIndex\]/u);
assert.match(home, /visibility = new Map/u);
assert.match(home, /ratio < 0\.15/u);
assert.match(home, /const PROGRAMMATIC_SCROLL_TARGET_RATIO = 0\.55;/u);
assert.match(home, /beginProgrammaticScroll\(targetIndex\);\s*setActiveSection\(targetIndex\);/u);
assert.match(home, /targetIndex === activeSectionIndex[\s\S]*?container\.scrollTop - target\.offsetTop/u);
assert.match(home, /mostVisible !== targetSection \|\| targetRatio < PROGRAMMATIC_SCROLL_TARGET_RATIO/u);
assert.match(home, /container\.addEventListener\("wheel", cancelProgrammaticScroll/u);
assert.match(home, /container\.addEventListener\("touchstart", cancelProgrammaticScroll/u);
assert.match(home, /requestAnimationFrame\(\(\) => \{\s*if \(programmaticScrollTargetIndex !== null\) return;\s*setActiveSection\(nearestSectionIndex\(\)\);/u);
assert.match(home, /Math\.abs\(section\.offsetTop - container\.scrollTop\)/u);
assert.match(home, /const CHAPTER_NAVIGATION_KEYS = Object\.freeze\(\{[\s\S]*?ArrowRight: 1,[\s\S]*?ArrowLeft: -1,/u);
assert.match(home, /dot\.addEventListener\("keydown", handleChapterNavigationKeydown\)/u);
assert.match(home, /function handleChapterNavigationKeydown\(event\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?focus\(\{ preventScroll: true \}\)[\s\S]*?scrollToSection\(targetIndex\)/u);
assert.match(home, /dot\.tabIndex = active \? 0 : -1;/u);

assert.match(scene, /CHUNK_RUNTIME_BUNDLE = "chunk\/browser-runtime\.js"/u);
assert.match(scene, /CHUNK_WORKER_BUNDLE = "chunk\/chunk-build-worker\.bundle\.js"/u);
assert.match(scene, /async function loadChunkWorkerSource\(runtimeRoot\)[\s\S]*?fetch\(sourceUrl,[\s\S]*?return Object\.freeze\(\{ sourceUrl, source \}\)/u);
assert.match(scene, /function createChunkWorkerUrl\([\s\S]*?URL\.createObjectURL\(new Blob/u);
assert.match(scene, /workerUrl: loadedWorker\.url/u);
assert.match(scene, /function releaseChunkWorkerObjectUrl\(\)[\s\S]*?URL\.revokeObjectURL\(chunkWorkerObjectUrl\)/u);
assert.equal([...scene.matchAll(/new runtime\.ChunkManager\(/gu)].length, 1);
assert.match(scene, /return import\(\/\* @vite-ignore \*\/ runtimeAssetUrl\(root, CHUNK_RUNTIME_BUNDLE\)\)/u);
assert.match(scene, /return homeBuildAssetUrl\(path\);/u);
assert.match(scene, /canvas\.dataset\.scenePresented = "true";/u);
assert.match(scene, /canvas\.dataset\.scenePresented === "true"[\s\S]*?opacity >= 0\.98/u);
assert.match(scene, /fetch\(homeBuildAssetUrl\(url\),/u);
assert.match(terrainModule, /fetch\(homeBuildAssetUrl\(url\),/u);
assert.doesNotMatch(scene, /load\("(?:construction|renderer|world)\//u);
assert.match(scene, /payloadBytes: building\.payloadBytes/u);
assert.match(scene, /voxelCount: building\.voxels\.size/u);
assert.match(scene, /ncmCode: building\.canonicalCode/u);
assert.match(scene, /const encoded = homeStructureNcmEntry\(spec\.definition\);/u);
assert.match(scene, /runtime\.parseNcm3Building\(encoded\.code/u);
assert.match(scene, /building\.payloadBytes !== encoded\.payloadBytes/u);
assert.match(scene, /building\.materials\.join\(","\) !== encoded\.materials\.join\(","\)/u);
assert.doesNotMatch(scene, /parseNcm3Building\(spec\.definition\.ncm\.code/u);
assert.doesNotMatch(scene, /JSON\.stringify\(spec\.definition\)|JSON\.stringify\(target/u);
assert.match(scene, /const HOMEPAGE_HAMMER_GRIP_ROLL_QUARTER_TURNS = 1;/u);
assert.match(scene, /forgeGripRollQuarterTurns: HOMEPAGE_HAMMER_GRIP_ROLL_QUARTER_TURNS,/u);
assert.doesNotMatch(scene, /orientHomepageHammerGrip|HOMEPAGE_HAMMER_GRIP_AXIS/u);
assert.match(scene, /sceneInspectableBuildings = structureInspectables\.map/u);
assert.match(scene, /raycastInspectableStructure\(projection\.target, pointerRay\)/u);
assert.match(scene, /hasWorldVoxel: \(x, y, z\) => ensureInteractionGeometry\(\)\.occupiedVoxels\.has/u);
assert.match(scene, /anchor: visibleProjectionAnchor\(topCenter, center, rect, viewport\)/u);
assert.match(scene, /outlineGroups: Object\.freeze\(outlineGroups\)/u);
assert.match(scene, /get outlineGroups\(\) \{\s*return ensureInteractionGeometry\(\)\.outlineGroups;/u);
assert.match(scene, /if \(interactionGeometry\) return interactionGeometry;/u);
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
assert.match(scene, /autoResizeEachFrame: false,/u);
assert.match(scene, /sceneViewport = viewportRect\(width, height\);[\s\S]*?renderer\?\.resize\(width, height, sceneDpr\)/u);
assert.match(scene, /const BUILDING_INSPECTION_FRAME_MS = 1_000 \/ 12;/u);
assert.match(scene, /if \(!buildingInspectionDirty && !animatedOutline\) return;/u);
assert.match(scene, /buildingInspectionDirty = true;[\s\S]*?guardianProjectionDirty = true;/u);
assert.doesNotMatch(scene, /\.terrain-pouw-demo/u);
assert.match(scene, /const GUARDIAN_DIALOGUE_PAIR_COUNT = 3;/u);
assert.match(scene, /updateGuardianChat\(cameraPose, timestamp\)/u);
assert.match(scene, /projectAvatarChatAnchor\(boy, cameraPose, viewport\)/u);
const guardianChatProjectionBlock = scene.match(/function updateGuardianChat\(cameraPose, timestamp\) \{[\s\S]*?\n  \}\n\n  function projectAvatarChatAnchor/u)?.[0] || "";
assert.doesNotMatch(guardianChatProjectionBlock, /getBoundingClientRect/u);
assert.match(guardianChatProjectionBlock, /const viewport = sceneViewport;/u);
assert.match(guardianChatProjectionBlock, /guardianProjectionDirty \|\| !guardianAnchors/u);
assert.match(guardianChatProjectionBlock, /dialogueKey === guardianDialogueKey/u);
assert.match(scene, /options\.onGuardianChat\?\.\(detail\)/u);
assert.match(scene, /guardianActorGesture\(guardianDialogue, "boy"/u);
assert.match(scene, /guardianActorGesture\(guardianDialogue, "girl"/u);
assert.match(scene, /pairElapsed < GUARDIAN_DIALOGUE_PAIR_MS \* 0\.5 \? "boy" : "girl"/u);
assert.match(scene, /equipment: boyGuardianGesture[\s\S]*?\{ rightHand: "empty" \}/u);
assert.doesNotMatch(scene, /avatarRelayOverlay/u);
const guardianOverlayBlock = scene.match(/function overlaysForView\(timestamp\) \{[\s\S]*?\n  \}\n\n  function surfaceYAt/u)?.[0] || "";
assert.doesNotMatch(guardianOverlayBlock, /focusView === "guardian"/u);

assert.match(inspector, /const INSPECTOR_TIMING = Object\.freeze/u);
assert.match(inspector, /target\.ncmCode/u);
assert.match(inspector, /target\.voxelCount \/ Math\.max\(1, target\.payloadBytes\)/u);
assert.match(inspector, /root\.dataset\.active = "false"/u);
assert.match(inspector, /root\.setAttribute\("aria-hidden", "false"\)/u);
assert.equal([...inspector.matchAll(/root\.setAttribute\("aria-hidden", "true"\)/gu)].length, 2);
assert.match(inspector, /updateBuildingOutline\(detail\.outline\)/u);
assert.match(inspector, /buildingOutline\.setAttribute\("d", path\)/u);
assert.doesNotMatch(inspector, /setAttribute\("points"/u);
assert.match(inspector, /detail\.bounds\.right \+ PANEL_GAP_PX/u);
assert.doesNotMatch(inspector, /transition:\s*all/u);
assert.match(style, /\.ncm-building-outline \{[\s\S]*?stroke: var\(--ncm-inspector-white\);/u);
assert.match(style, /stroke-dasharray: 10 7;/u);
assert.match(style, /\.home-camera-transitioning \.home-building-inspector \{\s*visibility: hidden;/u);
assert.match(style, /\.home-building-inspector \{[\s\S]*?z-index: 180;/u);
assert.match(style, /\.chapter-nav \{[\s\S]*?z-index: 120;/u);
assert.match(style, /\.home-scroll-cue \{[\s\S]*?bottom: max\(18px, env\(safe-area-inset-bottom, 0px\)\);/u);
assert.match(style, /html:not\(\[data-home-chapter="arrival"\]\) \.home-scroll-cue/u);
assert.match(style, /@keyframes home-scroll-wheel/u);
assert.match(style, /@keyframes home-swipe-finger/u);
assert.match(style, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-scroll-cue-mouse i,[\s\S]*?animation: none;/u);
assert.doesNotMatch(style, /@keyframes ncm-building-outline/u);
assert.doesNotMatch(style, /\.ncm-building-outline \{[^}]*filter:/su);
assert.match(style, /font: 650 11px\/1\.52/u);
assert.match(style, /\.site-footer \.brand-mark \{[\s\S]*?min-height: 40px;/u);
assert.match(style, /\.site-footer \.brand-mark:focus-visible,[\s\S]*?outline: 2px solid var\(--home-green\);[\s\S]*?outline-offset: 3px;/u);

for (const { language, source, public: publicLocale } of homeLocales) {
  assert.deepEqual(publicLocale.buildingInspector, source.buildingInspector, `Public ${language} inspector copy is stale.`);
  assert.deepEqual(publicLocale.terrainPouw, source.terrainPouw, `Public ${language} terrain PoUW copy is stale.`);
  assert.deepEqual(publicLocale.watchers.chat, source.watchers.chat, `Public ${language} Guardian chat copy is stale.`);
  const { _meta: meta, ...publicBody } = publicLocale;
  const contentHash = createHash("sha256").update(JSON.stringify(publicBody)).digest("hex").slice(0, 16);
  assert.equal(meta.contentHash, contentHash, `Public ${language} locale hash is stale.`);
  assert.equal(meta.version, `home-locale-${language}-${contentHash}`, `Public ${language} locale version is stale.`);
  for (const dictionary of [source, publicLocale]) {
    assert.equal(typeof dictionary.buildingInspector?.aria, "string", `Missing ${language} building inspector aria label.`);
    assert.equal(typeof dictionary.buildingInspector?.detail, "string", `Missing ${language} building inspector detail.`);
    assert.equal(typeof dictionary.buildingInspector?.fullCode, "string", `Missing ${language} building inspector code label.`);
    assert.equal(typeof dictionary.scrollCue?.aria, "string", `Missing ${language} scroll-cue aria label.`);
    assert.equal(typeof dictionary.scrollCue?.desktop, "string", `Missing ${language} desktop scroll cue.`);
    assert.equal(typeof dictionary.scrollCue?.mobile, "string", `Missing ${language} mobile swipe cue.`);
    for (const key of ["aria", "eyebrow", "initializing", "terrain", "meshing", "rendering", "ready", "fallback", "engine"]) {
      assert.equal(typeof dictionary.loading?.[key], "string", `Missing ${language} homepage loading ${key} copy.`);
      assert.ok(dictionary.loading[key].trim().length > 0, `Empty ${language} homepage loading ${key} copy.`);
    }
    assert.match(dictionary.buildingInspector.codeLength, /\{count\}/u, `Missing ${language} code-length token.`);
    for (const key of ["aria", "eyebrow", "title", "source", "candidate", "proof", "exact", "decision", "retained", "larger", "summary", "caveat", "report", "bundle", "miner"]) {
      assert.equal(typeof dictionary.terrainPouw?.[key], "string", `Missing ${language} terrain PoUW ${key} copy.`);
      assert.ok(dictionary.terrainPouw[key].trim().length > 0, `Empty ${language} terrain PoUW ${key} copy.`);
    }
    for (const pair of ["pair0", "pair1", "pair2"]) {
      for (const actor of ["boy", "girl"]) {
        const line = dictionary.watchers?.chat?.[pair]?.[actor];
        assert.equal(typeof line, "string", `Missing ${language} ${pair} ${actor} Guardian chat line.`);
        assert.match(line, /[\p{Extended_Pictographic}\u2705]/u, `Missing ${language} ${pair} ${actor} chat Emoji.`);
      }
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
  "stone-timber-village-gateway.json",
  "hollow-cottage.json",
  "stone-timber-footbridge.json",
  "stone-timber-tower-windmill.json",
  "covered-village-bloomery.json",
  "covered-market-stall.json",
  "timber-building-scaffold.json",
  "timber-mine-headframe.json",
  "stone-timber-harbor-beacon.json",
  "compact-village-blacksmith-shop.json",
  "compact-village-schoolhouse.json",
]) {
  assert.ok(layout.includes(buildingPath), `Missing canonical building: ${buildingPath}`);
}
const structureLayout = layout.match(/export const STRUCTURE_LAYOUT = Object\.freeze\(\[[\s\S]*?\n\]\);/u)?.[0];
assert.ok(structureLayout, "Missing fixed structure layout block.");
assert.equal([...structureLayout.matchAll(/\bid: "/gu)].length, 12);
assert.equal(HOME_STRUCTURE_ROOF_MATERIAL_ID, 96);
assert.equal(Object.keys(HOME_STRUCTURE_NCM_CODES).length, STRUCTURE_LAYOUT.length);
for (const spec of STRUCTURE_LAYOUT) {
  const definition = JSON.parse(await readFile(new URL(`../${spec.definitionPath}`, import.meta.url), "utf8"));
  assert.equal(spec.structureKey, definition.key, `${spec.id} points at an unexpected NCM structure.`);
  const encoded = HOME_STRUCTURE_NCM_CODES[definition.key];
  assert.ok(encoded, `Missing materialized homepage NCM3 code for ${definition.key}.`);
  assert.equal(
    encoded.sourceNcmSha256,
    createHash("sha256").update(definition.ncm.code).digest("hex"),
    `Stale source NCM hash for ${definition.key}.`,
  );
  assert.notEqual(encoded.code, definition.ncm.code, `${definition.key} still uses its role-material template.`);
  assert.match(encoded.code, /^NCM3:/u);
  assert.equal(Buffer.from(encoded.code.slice(5), "base64").byteLength, encoded.payloadBytes);
  assert.equal(encoded.roofMaterialId, HOME_STRUCTURE_ROOF_MATERIAL_ID);
  assert.ok(encoded.materials.length > 0, `${definition.key} has no materialized materials.`);
  assert.ok(
    encoded.materials.every((materialId) => materialId < 1 || materialId > 7),
    `${definition.key} still contains role-placeholder materials 1..7.`,
  );
  if (["river-footbridge", "mine-headframe"].includes(spec.id)) {
    assert.ok(!encoded.materials.includes(HOME_STRUCTURE_ROOF_MATERIAL_ID));
  } else {
    assert.ok(encoded.materials.includes(HOME_STRUCTURE_ROOF_MATERIAL_ID), `${definition.key} is missing red roof tiles.`);
  }
}

for (const view of ["arrival", "world", "technology", "create", "explore"]) {
  assert.match(scene, new RegExp(`\\b${view}: Object\\.freeze\\(`, "u"));
}

assert.match(scene, /renderer\.uploadAvatarMesh\("villager-boy", boyMesh\)/u);
assert.match(scene, /renderer\.uploadAvatarMesh\("villager-girl", girlMesh\)/u);
assert.match(scene, /for \(const prop of props\) renderer\.uploadAvatarMesh\(prop\.id, prop\.mesh\)/u);
const initialSceneMeshes = scene.match(/async function createInitialSceneMeshes\(runtime\) \{[\s\S]*?\n\}/u)?.[0] || "";
const deferredSceneAssets = scene.match(/async function createDeferredSceneAssets\(runtime, runtimeRoot, boyCode\) \{[\s\S]*?\n\}/u)?.[0] || "";
assert.match(initialSceneMeshes, /fetchNcm\("\/media\/vox\/chr_peasant_guy_blackhair\.ncm"\)/u);
assert.doesNotMatch(initialSceneMeshes, /loadForgeRuntime|ForgeRuntimeCache|home-world-deferred-assets|smeltingMaterial/u);
assert.match(deferredSceneAssets, /loadForgeRuntime\(runtimeRoot\)/u);
assert.match(deferredSceneAssets, /loadSmeltingMaterialRuntime\(runtimeRoot\)/u);
assert.match(deferredSceneAssets, /import\("\.\/home-world-deferred-assets\.js"\)/u);
assert.match(deferredSceneAssets, /smeltingMaterialToSceneMesh/u);
assert.match(scene, /scheduleDeferredSceneAssets\(\);/u);
assert.match(scene, /requestIdleCallback\(load, \{ timeout: 2_000 \}\)/u);
assert.match(scene, /sceneDeferredAssets = "unavailable"/u);
assert.match(scene, /deferred forge assets could not be loaded/u);
for (const forgeAssetPath of [
  "timber-workbench.json",
  "storage-shelf.json",
  "iron-blacksmith-anvil.json",
  "timber-market-display-stand.json",
  "brick-and-timber-pallet.json",
  "iron-blacksmith-hammer.json",
  "iron-deep-rock-pickaxe.json",
]) {
  assert.ok(deferredAssets.includes(forgeAssetPath), `Missing canonical deferred forge asset: ${forgeAssetPath}`);
}
assert.match(scene, /FORGE_RUNTIME_MODULE = "forge\/forge-runtime-cache\.js"/u);
assert.match(scene, /SMELTING_MATERIAL_MODULE = "renderer\/smelting-material-models\.js"/u);
assert.match(scene, /new forgeModule\.ForgeRuntimeCache/u);
assert.match(scene, /cache\.restore\(definition\.forge\.code/u);
assert.match(scene, /expectedDesignHash: definition\.forge\.designHash/u);
assert.match(scene, /requireCanonical: true/u);
for (const propId of [
  "economy-anvil",
  "economy-workbench",
  "economy-forged-tool",
  "economy-storage-shelf",
  "economy-market-display",
  "construction-material-pallet",
  "economy-copper-bloom",
  "economy-wooden-plank",
  "economy-wooden-stick",
  "economy-basalt-brick",
]) {
  assert.ok(scene.includes(`\"${propId}\"`), `Missing deferred scene prop: ${propId}`);
}
assert.match(scene, /createSmeltingMaterialPreviewMesh\(\{ materialId \}\)/u);
assert.match(scene, /vertex\.color\[3\] \/ 255/u);
assert.match(layout, /WORLD_CENTER = Object\.freeze\(\{ x: 2432, y: 100, z: 1712 \}\)/u);
assert.match(layout, /MOBILE_TERRAIN_VIEW_DISTANCE = 6/u);
assert.match(layout, /DESKTOP_TERRAIN_VIEW_DISTANCE = 7/u);
assert.match(layout, /COASTAL_STAGE_BOUNDS = Object\.freeze\(\{ minX: 2320, maxX: 2559, minZ: 1600, maxZ: 1839 \}\)/u);
assert.match(layout, /COASTAL_WATER_MARGIN = 18/u);
assert.match(scene, /sceneTerrainProfile = "stitch-village-river-estuary-dry-paths"/u);
assert.match(scene, /sceneMapBounds = "240x240"/u);
assert.match(scene, /sceneActorBehavior = "waypoint-walk-bridge-idle-mine-forge-build-loop"/u);
assert.match(scene, /focusedForgingPose\(focusElapsed, reducedMotion\.matches\)/u);
assert.match(scene, /focusedBuildingPose\(focusElapsed, reducedMotion\.matches\)/u);
assert.match(scene, /craftingActive \? \(forgingProgress \|\| buildingProgress\) : miningProgress/u);
assert.match(scene, /designHash: deferredHammerDesignHash/u);
assert.match(scene, /renderer\.emitVoxelParticles\("break", \{/u);
assert.match(scene, /worldX: ECONOMY_FORGE_SITE\.strike\.x/u);
assert.match(scene, /sceneEconomyResourceClusters = String\(Object\.keys\(ECONOMY_MATERIAL_SITES\)\.length\)/u);
assert.match(scene, /createResourceClusterChunks\(runtime, revision\)/u);
assert.match(scene, /WINDMILL_ROTATION_MS = 42_000/u);
assert.match(scene, /splitWindmillBuilding\(building, spec\.definition\)/u);
assert.match(scene, /sceneAnimatedPart = "windmill-rotor"/u);
assert.match(scene, /function rotatedRotorMesh\(chunk, sourceVertices, pivot, angle\)/u);
assert.match(scene, /sceneWindmillRotating = String\(!reducedMotion\.matches\)/u);
assert.match(layout, /id: "coastal-cottage"[\s\S]*?surfaceY: PRESENTATION_WATER_BED_Y[\s\S]*?siteMode: "water"/u);
assert.match(layout, /id: "coastal-cottage"[\s\S]*?quarterTurns: 0[\s\S]*?siteMode: "water"/u);
assert.match(layout, /id: "west-bridge-approach"[\s\S]*?Object\.freeze\(\{ x: 2408, z: 1697 \}\)/u);
assert.match(layout, /girlCottage: Object\.freeze\(\{ x: 2409, z: 1697, yaw: -1\.57 \}\)/u);
assert.match(layout, /id: "river-footbridge"[\s\S]*?siteMode: "bridge"[\s\S]*?walkable: true/u);
assert.match(layout, /id: "village-gateway"[\s\S]*?quarterTurns: 0[\s\S]*?walkable: true/u);
assert.match(layout, /PRESENTATION_PATHS = Object\.freeze/u);
assert.match(layout, /id: "village-spine"[\s\S]*?halfWidth: 3\.25/u);
assert.match(generator, /pathDistance <= 0 \? blocks\.dryDirt : blocks\.grass/u);
assert.match(generator, /Homepage plant \$\{key\} overlaps another scene feature/u);
assert.match(layout, /id: "tower-windmill"[\s\S]*?quarterTurns: 2/u);
assert.match(layout, /id: "village-bloomery"[\s\S]*?minX: 2477[\s\S]*?minZ: 1762/u);
assert.match(layout, /id: "village-market-stall"[\s\S]*?minX: 2520[\s\S]*?minZ: 1762/u);
assert.match(layout, /id: "construction-scaffold"[\s\S]*?minX: 2503[\s\S]*?minZ: 1800/u);
assert.match(scene, /CONSTRUCTION_SITE\.overlay\.width/u);
assert.match(scene, /routeWalk\(ACTOR_SITES\.bridgeEast, ACTOR_SITES\.bridgeWest/u);
assert.match(scene, /routeWalk\(ACTOR_SITES\.bridgeWest, ACTOR_SITES\.bridgeEast/u);
assert.match(scene, /cachedVisibleChunks = cachedTerrainChunks\.concat\(structureChunks\);/u);
const renderFrameSource = scene.match(/function renderFrame\(timestamp, force = false\) \{[\s\S]*?\n  \}\n\n  function terrainBuildWorkPending/u)?.[0] || "";
assert.doesNotMatch(renderFrameSource, /\[\.\.\.chunks\.chunks\.values\(\)\]/u);
assert.match(scene, /function terrainBuildWorkPending\(\)[\s\S]*?chunks\.completedBuilds\?\.length[\s\S]*?chunks\.inFlightBuilds\?\.size/u);
assert.match(scene, /SCENE_DIAGNOSTICS_INTERVAL_MS = 250/u);
assert.doesNotMatch(scene, /STRUCTURES_BY_VIEW|structureChunksForView/u);
assert.match(scene, /const ACTOR_ROUTES = Object\.freeze\(/u);
assert.match(scene, /routeStop\("mine", ACTOR_SITES\.boyMine/u);
assert.match(scene, /yaw: headingYaw\(ACTOR_SITES\.boyMine, MINING_TARGET\)/u);
assert.match(scene, /miningAimPitchFor\(boy\)/u);
assert.match(scene, /MINING_TARGET\.y \+ 0\.5 - shoulderY/u);
assert.match(scene, /const cycleTime = safeElapsed % route\.durationMs/u);
assert.match(scene, /staticRoutePose\(ACTOR_ROUTES\.boy\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, structureWalkSurfaces, boy, boyPose\)/u);
assert.match(scene, /positionAvatarAt\(runtime, worldConfig, chunks, structureWalkSurfaces, girl, girlPose\)/u);
assert.match(scene, /function addStructureWalkSurfaces\(placement, spec, walkSurfaces\)/u);
assert.match(scene, /structureWalkSurfaces\.get\(`\$\{worldX\},\$\{worldZ\}`\)/u);
assert.match(scene, /return Math\.atan2\(-\(to\.x - from\.x\), -\(to\.z - from\.z\)\);/u);
assert.match(scene, /setSceneData\(canvas, `\$\{prefix\}Yaw`, avatar\.yaw\.toFixed\(6\)\)/u);
assert.match(scene, /if \(canvas\.dataset\[key\] !== nextValue\) canvas\.dataset\[key\] = nextValue;/u);

assert.match(scene, /loadHomeWorldTerrain\(options\.terrainUrl\)/u);
assert.match(scene, /applyHomeWorldTerrain\(chunks, presentationTerrain/u);
assert.match(scene, /chunks\.setRenderLogger\(\{ record: recordBuildEvent \}\)/u);
assert.match(scene, /type === "chunk-build-done"/u);
assert.match(scene, /type === "chunk-remesh-done"/u);
assert.match(scene, /function prioritizePendingTerrainBuilds\(view = focusView\)/u);
assert.match(scene, /requiredIds\.has\(left\.id\)/u);
assert.match(scene, /chunks\.buildQueueNeedsSort = false/u);
assert.match(scene, /if \(runtime && chunks\) \{\s*prioritizePendingTerrainBuilds\(view\);/u);
assert.match(scene, /canvas\.dataset\.sceneReady === "true" && chunks\.buildQueue\?\.length\) resumeTerrainBuildsForView\(\)/u);
assert.match(scene, /initialTerrainView = focusView;\s*const initialPriorityIds = terrainPriorityIdsForView\(focusView\)/u);
assert.match(scene, /deferredBuildTasks = chunks\.buildQueue\.filter\(\(task\) => !initialPriorityIds\.has\(task\.id\)\)/u);
assert.match(scene, /chunks\.buildQueue = chunks\.buildQueue\.filter\(\(task\) => initialPriorityIds\.has\(task\.id\)\)/u);
assert.match(scene, /includeChunkIds: initialPriorityIds/u);
assert.match(scene, /chunks\.setBuildConcurrencyLimit\(1\);/u);
assert.match(scene, /function scheduleDeferredTerrainPreparation\(presentationTerrain, deferredBuildTasks, initialTerrainResult\)/u);
assert.match(scene, /includeChunkIds: deferredIds/u);
assert.match(scene, /priorityChunkIds: deferredTerrainPriorityIds/u);
assert.match(scene, /onProgress: \(\{ chunkId, appliedChunks, appliedDeltas \}\)/u);
assert.match(scene, /chunks\.buildQueue\.push\(task\);\s*chunks\.buildQueueNeedsSort = true;\s*prioritizePendingTerrainBuilds\(focusView\);/u);
assert.match(scene, /function updateDeferredTerrainPriority\(view = focusView\)/u);
assert.match(scene, /chunks\.buildQueue\.push\(\.\.\.liveTasks\)/u);
assert.match(scene, /sceneTerrainPreparation = "ready"/u);
assert.match(scene, /scheduleDeferredTerrainPreparation\(presentationTerrain, deferredBuildTasks, terrainResult\);\s*focus\(focusView, \{ immediate: true \}\);\s*renderFrame\(startedAt, true\);/u);
assert.match(scene, /function expandTerrainWorkerPool\(\)/u);
assert.match(scene, /chunks\.setBuildConcurrencyLimit\(terrainWorkerCount\)/u);
assert.match(scene, /buildMetrics\.baseBuilds \+= 1;\s*expandTerrainWorkerPool\(\);/u);
assert.match(scene, /pauseTerrainBuildsForTransition\(\);\s*scheduleDeferredWorkAfterVisualHandoff\(\);\s*document\.documentElement\.classList\.remove\("home-world-fallback"\)/u);
assert.match(scene, /function scheduleDeferredWorkAfterVisualHandoff\(\)[\s\S]*?startDeferredTerrainPreparation\(VISUAL_HANDOFF_PROBE_MS\);[\s\S]*?scheduleDeferredSceneAssets\(\);/u);
assert.match(scene, /reducedMotion\.matches \|\| opacity >= 0\.98/u);
assert.match(scene, /event\.target === canvas && event\.propertyName === "opacity"/u);
assert.doesNotMatch(scene, /startDeferredTerrainPreparation\(420\)/u);
assert.match(scene, /function pauseTerrainBuildsForTransition\(\)[\s\S]*?chunks\.setBuildConcurrencyLimit\(0\)/u);
assert.match(scene, /sceneTerrainBuildPhase = "transition"/u);
assert.match(scene, /\}, 900\);/u);
assert.match(scene, /sceneTerrainBuildPhase = "background"/u);
assert.match(scene, /function resumeTerrainBuildsForView\(\)/u);
assert.match(scene, /sceneTerrainBuildPhase = "view-priority"/u);
assert.match(scene, /const CAMERA_TARGET_WAIT_TIMEOUT_MS = 3_000;/u);
assert.match(scene, /cameraTransitionWaiting \|\| timestamp - transitionStart < CAMERA_TRANSITION_MS/u);
assert.match(scene, /renderer\.prepareChunksForRender\(visibleChunks, \{ maxUploads, cameraState: targetCamera \}\);/u);
assert.match(scene, /function updateCameraTransitionGate\(timestamp, targetCamera\)/u);
assert.match(scene, /sceneCameraWaitResult = readiness\.ready \? "ready" : "timeout"/u);
assert.match(scene, /setSceneData\(canvas, "sceneCameraEye", formatSceneVector\(cameraPose\.eye\)\)/u);
assert.match(scene, /setSceneData\(canvas, "sceneCameraTargetEye", formatSceneVector\(cameraTarget\.eye\)\)/u);
assert.match(scene, /runtime\.chunkIntersectsCameraFrustum\(terrainReadinessProbe\(chunk\), camera\)/u);
assert.match(scene, /gpuMeshReady\(chunks\.chunks\.get\(id\)\)/u);
assert.match(scene, /const becameReady = readinessPending && lastReadiness\.ready;/u);
const mobileSceneDpr = Number(scene.match(/const MOBILE_SCENE_DPR = ([\d.]+);/u)?.[1]);
assert.equal(mobileSceneDpr, 1.15);
assert.equal(Math.floor(390 * mobileSceneDpr), 448);
assert.equal(Math.floor(844 * mobileSceneDpr), 970);
assert.match(scene, /const sceneDpr = mobileViewport \? MOBILE_SCENE_DPR : lowPower \? 0\.75 : 0\.875;/u);
assert.match(scene, /maxMobileDpr: MOBILE_SCENE_DPR/u);
assert.match(scene, /sceneAspect = Math\.max\(0\.25, width \/ height\);/u);
assert.match(scene, /const maxUploads = lowPower \|\| mobileViewport \? 4 : 8;/u);
assert.doesNotMatch(scene, /terrainChunks\.length >=|expectedTerrainChunks|createPresentationDeltas|presentationBoundsForView/u);
assert.match(terrainModule, /new Int32Array\(entry\.deltaCount \* 4\)/u);
assert.match(terrainModule, /includeChunkIds = null/u);
assert.match(terrainModule, /priorityChunkIds = null/u);
assert.match(terrainModule, /if \(prioritized && appliedChunks > 0\) chunks\.sort\(compareChunks\);/u);
assert.match(terrainModule, /onProgress\?\.\(\{ chunkId: chunk\.id, appliedChunks, appliedDeltas, totalChunks \}\)/u);
assert.match(terrainModule, /filter\(\(chunk\) => !included \|\| included\.has\(chunk\.id\)\)/u);
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
assert.equal(terrain.runCount, 159_057);
assert.equal(terrain.deltaCount, 633_903);
assert.equal(terrain.fingerprint, "7541cdf019729fb8e585101c06382cba");
assert.deepEqual(gunzipSync(compressedTerrainBytes), terrainBytes);
assert.ok(compressedTerrainBytes.byteLength < terrainBytes.byteLength / 20);
assert.equal(PRESENTATION_PATHS.length, 6);
assert.equal(PRESENTATION_PLANTS.length, 299);
assert.equal(PRESENTATION_PLANTS.filter((plant) => plant.block.startsWith("flower")).length, 277);
assert.equal(PRESENTATION_TREES.length, 6);
assert.deepEqual(MINING_TARGET, { x: 2393, y: 102, z: 1650, material: "coal" });
assert.deepEqual(ACTOR_SITES.boyMine, { x: 2395, z: 1653, yaw: -2.5 });
assert.deepEqual(ACTOR_SITES.economyBoy, { x: 2486, z: 1805, yaw: 0 });
assert.deepEqual(ECONOMY_FORGE_SITE, {
  anvil: { x: 2486.5, y: 100, z: 1803, yaw: 0 },
  bench: { x: 2479.5, y: 100, z: 1803, yaw: 0 },
  tool: { x: 2486.5, y: 102.34, z: 1803, yaw: 1.570796 },
  strike: { x: 2486.5, y: 102.58, z: 1803 },
  shelf: { x: 2479, y: 100, z: 1807, yaw: 0 },
  marketDisplay: { x: 2496.5, y: 100, z: 1803, yaw: 0 },
});
assert.equal(Object.keys(ECONOMY_MATERIAL_SITES).length, 4);
assert.equal(SCENE_RESOURCE_CLUSTERS.length, 1);
assert.equal(SCENE_RESOURCE_CLUSTERS.filter((cluster) => cluster.id.startsWith("economy-")).length, 0);
assert.ok(SCENE_RESOURCE_CLUSTERS.some((cluster) => cluster.id === "mining-coal-outcrop"
  && cluster.voxels.some((voxel) => voxel.x === MINING_TARGET.x
    && voxel.y === MINING_TARGET.y
    && voxel.z === MINING_TARGET.z
    && voxel.material === MINING_TARGET.material)));
assert.ok(Math.hypot(
  ACTOR_SITES.economyBoy.x + 0.5 - ECONOMY_FORGE_SITE.anvil.x,
  ACTOR_SITES.economyBoy.z + 0.5 - ECONOMY_FORGE_SITE.anvil.z,
) < 3, "The economy actor must stand within hammering distance of the anvil.");
const distanceToSegment = (point, from, to) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared))
    : 0;
  return Math.hypot(point.x - (from.x + dx * amount), point.z - (from.z + dz * amount));
};
for (const path of PRESENTATION_PATHS) {
  const length = path.points.slice(0, -1).reduce((total, from, index) => (
    total + Math.hypot(path.points[index + 1].x - from.x, path.points[index + 1].z - from.z)
  ), 0);
  const roadsideFlowers = PRESENTATION_PLANTS.filter((plant) => {
    if (!plant.block.startsWith("flower")) return false;
    const distance = Math.min(...path.points.slice(0, -1).map((from, index) => (
      distanceToSegment(plant, from, path.points[index + 1])
    )));
    return distance >= path.halfWidth + 0.5 && distance <= path.halfWidth + 4.2;
  });
  if (!["production-courtyard", "construction-spur"].includes(path.id)) {
    assert.ok(roadsideFlowers.length >= Math.floor(length * 0.8), `${path.id} does not have a dense roadside flower band.`);
  }
}
const gateway = STRUCTURE_LAYOUT.find((structure) => structure.id === "village-gateway");
const coastalCottage = STRUCTURE_LAYOUT.find((structure) => structure.id === "coastal-cottage");
assert.deepEqual(
  { minX: gateway?.minX, minZ: gateway?.minZ, quarterTurns: gateway?.quarterTurns, walkable: gateway?.walkable },
  { minX: 2504, minZ: 1730, quarterTurns: 0, walkable: true },
);
assert.deepEqual(
  { minX: coastalCottage?.minX, minZ: coastalCottage?.minZ, quarterTurns: coastalCottage?.quarterTurns, siteMode: coastalCottage?.siteMode },
  { minX: 2370, minZ: 1681, quarterTurns: 0, siteMode: "water" },
);
assert.deepEqual(PRESENTATION_PATHS.find((path) => path.id === "west-bridge-approach")?.points.at(-1), { x: 2408, z: 1697 });
assert.deepEqual(CONSTRUCTION_SITE.overlay, { x: 2503, z: 1800, width: 21, depth: 19 });

const unpackedTerrainChunks = new Map();
const explicitColumn = (worldX, worldZ) => {
  const chunkKey = `${Math.floor(worldX / 16)},${Math.floor(worldZ / 16)}`;
  let packed = unpackedTerrainChunks.get(chunkKey);
  if (!packed) {
    packed = unpackHomeWorldTerrainChunk(terrain, Math.floor(worldX / 16), Math.floor(worldZ / 16));
    unpackedTerrainChunks.set(chunkKey, packed);
  }
  const column = [];
  for (let offset = 0; offset < packed.length; offset += 4) {
    if (packed[offset] === worldX && packed[offset + 2] === worldZ) column.push([packed[offset + 1], packed[offset + 3]]);
  }
  return column.sort((left, right) => left[0] - right[0]);
};
const topSolid = (worldX, worldZ) => explicitColumn(worldX, worldZ).findLast((entry) => entry[1] !== 0);

for (const [worldX, worldZ] of [[2508, 1790], [2508, 1773], [2499, 1807], [2508, 1712], [2472, 1704], [2415, 1702], [2408, 1697], [2512, 1670]]) {
  assert.equal(topSolid(worldX, worldZ)?.[1], 9, `Homepage dry-dirt path is missing at ${worldX},${worldZ}.`);
}
for (const [worldX, worldZ] of [[2446, 1700], [2432, 1784], [2415, 1838]]) {
  assert.equal(topSolid(worldX, worldZ)?.[1], 17, `Homepage river or estuary is missing at ${worldX},${worldZ}.`);
}
const plantBlockIds = { grassPlant: 28, flowerWhite: 49, flowerYellow: 50, flowerRed: 51, flowerBlue: 52, flowerPink: 53 };
for (const plant of PRESENTATION_PLANTS) {
  const column = explicitColumn(plant.x, plant.z);
  const decorationIndex = column.findLastIndex((entry) => entry[1] === plantBlockIds[plant.block]);
  assert.notEqual(decorationIndex, -1, `Homepage plant is missing at ${plant.x},${plant.z}.`);
  assert.ok([1, 9].includes(column[decorationIndex - 1]?.[1]), `Homepage plant is not rooted on grass or dry dirt at ${plant.x},${plant.z}.`);
}
for (const tree of PRESENTATION_TREES) {
  const column = explicitColumn(tree.x, tree.z);
  const trunkIndex = column.findIndex((entry) => entry[1] === 22);
  assert.notEqual(trunkIndex, -1, `Homepage tree trunk is missing at ${tree.x},${tree.z}.`);
  assert.ok([1, 9].includes(column[trunkIndex - 1]?.[1]), `Homepage tree is not rooted on grass or dry dirt at ${tree.x},${tree.z}.`);
}

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
assert.equal(ncm4Report.projection.genericNcm3Bytes, 1_273_806);
assert.equal(ncm4Report.projection.ncm4RecordBytes, 648_383);
assert.equal(ncm4Report.projection.bundleBytes, 650_193);
assert.equal(ncm4Report.projection.ncm4SavedPercentAgainstNcm3, 49.0988);
assert.equal(ncm4Report.projection.ncm4LargerPercentAgainstNcht, 86.8706);
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
assert.equal(ncm4Report.chunks.reduce((total, chunk) => total + chunk.ncm4Bytes, 0), 648_383);
assert.equal(ncm4BundleBytes.byteLength, ncm4Report.projection.bundleBytes);
assert.equal(createHash("sha256").update(ncm4BundleBytes).digest("hex"), ncm4Report.projection.bundleSha256);
assert.equal(ncm4BundleBytes.subarray(0, 4).toString("ascii"), "NC4B");
assert.equal(ncm4BundleBytes[4], 1);
assert.equal(ncm4BundleBytes.readUInt16LE(5), 225);
assert.equal(ncm4BundleBytes.readInt16LE(7), 85);
assert.equal(ncm4BundleBytes[9], 31);
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
  [2432, 1712, 97],
]) {
  const packed = unpackHomeWorldTerrainChunk(terrain, Math.floor(worldX / 16), Math.floor(worldZ / 16));
  let topY = -Infinity;
  for (let offset = 0; offset < packed.length; offset += 4) {
    if (packed[offset] !== worldX || packed[offset + 2] !== worldZ || packed[offset + 3] === 0) continue;
    topY = Math.max(topY, packed[offset + 1]);
  }
  assert.equal(topY, expectedY, `Unexpected homepage relief height at ${worldX},${worldZ}.`);
}

for (const view of ["arrival", "world", "technology", "create", "explore"]) {
  const preset = scene.match(new RegExp(`${view}: Object\\.freeze\\(\\{[\\s\\S]*?eye: \\[([^\\]]+)\\],[\\s\\S]*?target: \\[([^\\]]+)\\]`, "u"));
  assert.ok(preset, `Missing ${view} camera preset.`);
  const eye = preset[1].split(",").map(Number);
  const target = preset[2].split(",").map(Number);
  const distance = Math.hypot(...eye.map((value, index) => value - target[index]));
  assert.ok(distance < 112, `${view} camera is too far from its subject (${distance.toFixed(2)}).`);
}
assert.match(scene, /arrival: Object\.freeze\(\{\s*eye: \[2460, 134, 1757\],\s*target: \[2494, 103, 1662\],\s*fov: 52,/u);
assert.match(scene, /create: Object\.freeze\(\{\s*eye: \[2496, 120, 1845\],\s*target: \[2496, 104, 1802\],\s*fov: 42,/u);
assert.match(scene, /mobile && view === "arrival"[\s\S]*?target\.splice\(0, 3, 2524, 110, 1645\);[\s\S]*?eye = \[2560, 145, 1768\];/u);
assert.match(scene, /mobile && view === "create"[\s\S]*?target\.splice\(0, 3, 2490, 104, 1802\);[\s\S]*?eye = \[2490, 126, 1860\];/u);
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

async function readBuildVersionTransformSource() {
  const candidates = [
    new URL("../vite.config.js", import.meta.url),
    new URL("../scripts/build-static-site.mjs", import.meta.url),
  ];
  let missingError;
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missingError = error;
    }
  }
  throw missingError;
}
