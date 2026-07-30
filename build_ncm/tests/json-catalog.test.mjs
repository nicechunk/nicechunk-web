import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeNcm3, encodeNcm3 } from "../../chunk.js/ncm/blueprint-codec.js";
import { BUILDING_STYLE_PRESETS } from "../../chunk.js/construction/building-style-catalog.js";
import { ROOF_TILE_VARIANTS } from "../../chunk.js/construction/roof-tile-catalog.js";
import { createCivicTownHall } from "../civic-town-hall-blueprint.js";
import { createGrandCastle } from "../grand-castle-blueprint.js";
import { createReferenceCottage } from "../house-blueprint.js";
import { createSeasideCottage } from "../seaside-cottage-blueprint.js";
import { createFreightWarehouse } from "../warehouse-blueprint.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const locales = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];
const materialRoles = ["foundation", "wall", "structure", "glazing", "roof", "floor", "chimney"];
const generators = new Map([
  ["hollow-cottage", createReferenceCottage],
  ["seaside-cottage", createSeasideCottage],
  ["civic-town-hall", createCivicTownHall],
  ["freight-warehouse", createFreightWarehouse],
  ["grand-castle", createGrandCastle],
]);

const catalog = readJson(join(root, "building-catalog.json"));
assert.deepEqual(Object.keys(catalog), ["schema", "buildings"], "the catalog may contain only its schema and building filenames");
assert.equal(catalog.schema, "nicechunk.building-catalog.v1");
assert.ok(Array.isArray(catalog.buildings) && catalog.buildings.length > 0);
assert.equal(new Set(catalog.buildings).size, catalog.buildings.length, "catalog filenames must be unique");

const diskBuildingFiles = readdirSync(join(root, "buildings"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((category) => readdirSync(join(root, "buildings", category.name), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => `buildings/${category.name}/${entry.name}`))
  .sort();
assert.deepEqual([...catalog.buildings].sort(), diskBuildingFiles, "every building JSON must be listed exactly once in the catalog");

let parityChecks = 0;
for (const relativePath of catalog.buildings) {
  assert.match(relativePath, /^buildings\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
  const [, category, filename] = relativePath.match(/^buildings\/([^/]+)\/([^/]+)\.json$/);
  const building = readJson(join(root, relativePath));
  assert.equal(building.schema, "nicechunk.ncm-building.v1");
  assert.equal(building.category, category);
  assert.equal(building.key, filename);
  assert.deepEqual(Object.keys(building.titles), locales, `${building.key} must contain all nine titles in canonical order`);
  assert.deepEqual(Object.keys(building.descriptions), locales, `${building.key} must contain all nine descriptions in canonical order`);
  for (const locale of locales) {
    assert.ok(building.titles[locale].trim(), `${building.key} is missing its ${locale} title`);
    assert.ok(building.descriptions[locale].trim(), `${building.key} is missing its ${locale} description`);
  }
  assert.equal(building.doorOpening, "open");
  assert.equal(building.ncm.format, "NCM3_ROLE_TEMPLATE");
  assert.match(building.ncm.code, /^NCM3:/);
  assert.deepEqual(Object.keys(building.ncm.materialRoles), materialRoles);
  assert.deepEqual(Object.values(building.ncm.materialRoles), [1, 2, 3, 4, 5, 6, 7]);

  const generator = generators.get(building.key);
  assert.ok(generator, `missing canonical generator for ${building.key}`);
  const template = decodeNcm3(building.ncm.code);
  const roleByPlaceholder = new Map(Object.entries(building.ncm.materialRoles).map(([role, value]) => [value, role]));
  for (const style of BUILDING_STYLE_PRESETS) {
    for (const roof of ROOF_TILE_VARIANTS) {
      for (const glazed of [false, true]) {
        const commands = template.commands.flatMap((command) => {
          const role = roleByPlaceholder.get(command.material);
          if (role === "glazing" && !glazed) return [];
          if (!role) return [{ ...command }];
          return [{
            ...command,
            material: role === "roof" ? roof.materialId : style.materials[role],
          }];
        });
        const expanded = { size: { ...template.size }, commands };
        const canonical = generator({ style: style.key, roofMaterial: roof.materialId, glazed });
        assert.equal(
          encodeNcm3(expanded),
          encodeNcm3(canonical),
          `${building.key} JSON template diverges for ${style.key}/${roof.key}/${glazed ? "glazed" : "open"}`,
        );
        parityChecks += 1;
      }
    }
  }
}

const localeFiles = readdirSync(join(root, "locales"))
  .filter((filename) => filename.endsWith(".json"))
  .sort();
assert.deepEqual(localeFiles, locales.map((locale) => `${locale}.json`).sort());
const dictionaries = Object.fromEntries(locales.map((locale) => [locale, readJson(join(root, "locales", `${locale}.json`))]));
const englishKeys = Object.keys(dictionaries.en);
for (const locale of locales) {
  assert.deepEqual(Object.keys(dictionaries[locale]), englishKeys, `${locale} UI dictionary keys differ from English`);
  for (const key of englishKeys) {
    assert.ok(String(dictionaries[locale][key]).trim(), `${locale} UI dictionary has an empty ${key}`);
    assert.deepEqual(placeholders(dictionaries[locale][key]), placeholders(dictionaries.en[key]), `${locale} placeholders differ for ${key}`);
    assert.deepEqual(htmlTags(dictionaries[locale][key]), htmlTags(dictionaries.en[key]), `${locale} HTML tags differ for ${key}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  buildings: catalog.buildings.length,
  locales: locales.length,
  uiKeys: englishKeys.length,
  parityChecks,
}, null, 2));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function htmlTags(value) {
  return [...String(value).matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)]
    .map((match) => match[0].startsWith("</") ? `/${match[1]}` : match[1]);
}
