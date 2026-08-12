import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localeDirectory = join(root, "locales");
const expectedLocales = ["de", "en", "es", "fr", "ja", "ko", "ru", "zh-Hans", "zh-Hant"];
const localeFiles = readdirSync(localeDirectory).filter((file) => file.endsWith(".json")).sort();
assert.deepEqual(localeFiles, expectedLocales.map((locale) => `${locale}.json`).sort());

const dictionaries = new Map(localeFiles.map((file) => [file.replace(".json", ""), JSON.parse(readFileSync(join(localeDirectory, file), "utf8"))]));
const english = dictionaries.get("en");
const englishKeys = Object.keys(english).sort();
assert.equal(englishKeys.length, 99);
for (const [locale, dictionary] of dictionaries) {
  assert.deepEqual(Object.keys(dictionary).sort(), englishKeys, `${locale} locale keys differ from English`);
  for (const key of englishKeys) {
    assert.equal(typeof dictionary[key], "string");
    assert.ok(dictionary[key].trim(), `${locale}.${key} must not be empty`);
    assert.deepEqual(placeholders(dictionary[key]), placeholders(english[key]), `${locale}.${key} placeholders differ`);
  }
}

const sources = ["index.html", "app.js"].map((file) => readFileSync(join(root, file), "utf8")).join("\n");
const staticKeys = [...sources.matchAll(/data-i18n(?:-[a-z-]+)?="([a-zA-Z0-9_.-]+)"/g)].map((match) => match[1]);
const runtimeKeys = [...sources.matchAll(/\bt\("([a-zA-Z0-9_.-]+)"/g)].map((match) => match[1]);
for (const key of new Set([...staticKeys, ...runtimeKeys])) assert.ok(english[key], `missing locale key used by the page: ${key}`);

for (const key of ["tool", "placeable"]) assert.ok(english[`type.${key}`]);
for (const key of ["mining-tools", "forestry-farming", "workshop", "commerce", "construction", "weapons", "building-fittings", "lighting", "furniture", "containers", "cooking", "books-writing", "interior-decor", "signage", "handheld-civic"]) {
  assert.ok(english[`library.category.${key}`]);
}

console.log("item_ncm i18n tests passed: 9 locales with matching keys and placeholders");

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}
