import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  SITE_NAVIGATION_ALIASES,
  SITE_NAVIGATION_LABELS,
  SITE_NAVIGATION_ROUTES,
  resolveSiteNavigationPath,
} from "../src/site-navigation.js";

const localeCodes = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const routeKeys = SITE_NAVIGATION_ROUTES.map(({ key }) => key);

assert.deepEqual(
  SITE_NAVIGATION_ROUTES.filter(({ group }) => group === "primary").map(({ key, href }) => ({ key, href })),
  [
    { key: "world", href: "/world/" },
    { key: "technology", href: "/technology/" },
    { key: "create", href: "/create/" },
    { key: "docs", href: "/docs/" },
  ],
);
assert.deepEqual(
  SITE_NAVIGATION_ROUTES.filter(({ group }) => group === "secondary").map(({ key }) => key),
  ["roadmap", "whitepaper", "github", "whitelist"],
);
assert.deepEqual(
  SITE_NAVIGATION_ROUTES.filter(({ group }) => group === "action").map(({ key, href }) => ({ key, href })),
  [{ key: "enterWorld", href: "/play/" }],
);
assert.equal(SITE_NAVIGATION_ROUTES.find(({ key }) => key === "github")?.external, true);

const expectedAliases = {
  "/civilization/": "/world/",
  "/world_rule/": "/world/",
  "/resource_rule/": "/world/",
  "/elements/": "/world/",
  "/ncm/": "/technology/",
  "/ncfm/": "/technology/",
  "/ncm_dna/": "/technology/",
  "/fairness/": "/technology/",
  "/proof-of-frontier/": "/technology/",
  "/guardian/": "/technology/",
  "/contracts/": "/technology/",
  "/trust/": "/technology/",
  "/miner/": "/create/",
  "/build_ncm/": "/create/",
  "/item_ncm/": "/create/",
  "/forging/": "/create/",
  "/ncm4/": "/create/",
  "/fourier-pickaxe/": "/create/",
  "/fourier-voxel/": "/create/",
};
assert.deepEqual(SITE_NAVIGATION_ALIASES, expectedAliases);
for (const [legacyPath, hubPath] of Object.entries(expectedAliases)) {
  assert.equal(resolveSiteNavigationPath(legacyPath), hubPath);
}
assert.equal(resolveSiteNavigationPath("/docs/"), "/docs/");

assert.deepEqual(Object.keys(SITE_NAVIGATION_LABELS), localeCodes);
for (const locale of localeCodes) {
  assert.deepEqual(Object.keys(SITE_NAVIGATION_LABELS[locale]), routeKeys);
  assert.ok(Object.values(SITE_NAVIGATION_LABELS[locale]).every((label) => label.trim().length > 0));
}

const englishHubKeys = flattenKeys(JSON.parse(await readFile(new URL("../hubs/locales/en.json", import.meta.url), "utf8")));
for (const locale of localeCodes) {
  const [sourceText, publicText] = await Promise.all([
    readFile(new URL(`../hubs/locales/${locale}.json`, import.meta.url), "utf8"),
    readFile(new URL(`../public/hubs/locales/${locale}.json`, import.meta.url), "utf8"),
  ]);
  assert.equal(publicText, sourceText, `Public ${locale} hub locale is stale.`);
  assert.deepEqual(flattenKeys(JSON.parse(sourceText)), englishHubKeys, `${locale} hub locale key shape drifted.`);
}

const pageExpectations = {
  world: { primaryHref: "/play/", titleKey: "hubs.world.meta.title" },
  technology: { primaryHref: "/ncm/", titleKey: "hubs.technology.meta.title" },
  create: { primaryHref: "/build_ncm/", titleKey: "hubs.create.meta.title" },
};
for (const [hub, expectation] of Object.entries(pageExpectations)) {
  const html = await readFile(new URL(`../${hub}/index.html`, import.meta.url), "utf8");
  assert.match(html, new RegExp(`data-i18n-scope="hubs" data-hub="${hub}"`, "u"));
  assert.match(html, /<header class="site-header" data-site-header-root><\/header>/u);
  assert.ok(html.includes(`data-i18n="${expectation.titleKey}"`));
  assert.ok(html.includes(`class="hub-action" href="${expectation.primaryHref}"`));
  assert.match(html, /id="hubLinks"/u);
  assert.match(html, /home-world-preview-desktop\.webp/u);
  assert.match(html, /home-world-preview-mobile\.webp/u);
  assert.doesNotMatch(html, /<video\b|placehold\.co|unsplash\.com/u);
}

const [hubScript, hubStyle, headerStyle, headerScript, fallbackScript, i18nScript, viteConfig] = await Promise.all([
  readFile(new URL("../hubs/hub.js", import.meta.url), "utf8"),
  readFile(new URL("../hubs/style.css", import.meta.url), "utf8"),
  readFile(new URL("../src/site-header.css", import.meta.url), "utf8"),
  readFile(new URL("../src/site-header.js", import.meta.url), "utf8"),
  readFile(new URL("../src/site-ui.js", import.meta.url), "utf8"),
  readFile(new URL("../src/i18n.js", import.meta.url), "utf8"),
  readFile(new URL("../vite.config.js", import.meta.url), "utf8"),
]);

for (const requiredPath of [
  "/civilization/", "/world_rule/", "/resource_rule/", "/elements/",
  "/ncm/", "/ncfm/", "/fairness/", "/proof-of-frontier/", "/guardian/", "/contracts/", "/trust/",
  "/miner/", "/chunk.js/", "/build_ncm/", "/item_ncm/", "/forging/", "/ncm4/", "/fourier-pickaxe/",
]) {
  assert.ok(hubScript.includes(requiredPath), `Hub directory is missing ${requiredPath}.`);
}
assert.match(headerScript, /from "\.\/site-navigation\.js"/u);
assert.match(fallbackScript, /from "\.\/site-navigation\.js"/u);
assert.doesNotMatch(`${hubStyle}\n${headerStyle}`, /transition:\s*all/u);
assert.match(hubStyle, /\.hub-action:focus-visible,[\s\S]*?outline: 2px solid/u);
assert.match(hubStyle, /@media \(prefers-reduced-motion: reduce\)/u);
assert.match(hubStyle, /@media \(max-width: 900px\)[\s\S]*?\.hub-links \{\s*grid-template-columns: minmax\(0, 1fr\);/u);
assert.match(headerStyle, /max-height: min\(70dvh, 620px\)/u);
assert.match(headerStyle, /grid-template-columns: minmax\(0, 1fr\) auto 44px/u);
assert.match(i18nScript, /hubs: \{\s*localeBase: "\/hubs\/locales"/u);
for (const [name, path] of Object.entries({ world: "world/index.html", technology: "technology/index.html", create: "create/index.html" })) {
  assert.match(viteConfig, new RegExp(`${name}: "${path.replace("/", "\\/")}"`, "u"));
}

console.log("Consolidated navigation, hubs, aliases, and nine-language copy are valid.");

function flattenKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}
