/* global __BUILD_VERSION__ */

export const languageOrder = ["en", "es", "fr", "de", "ja", "ru", "ko", "zh-Hant", "zh-Hans"];

export const languages = [
  { code: "en", key: "en", englishName: "English" },
  { code: "es", key: "es", englishName: "Spanish" },
  { code: "fr", key: "fr", englishName: "French" },
  { code: "de", key: "de", englishName: "German" },
  { code: "ja", key: "ja", englishName: "Japanese" },
  { code: "ru", key: "ru", englishName: "Russian" },
  { code: "ko", key: "ko", englishName: "Korean" },
  { code: "zh-Hant", key: "zhHant", englishName: "Traditional Chinese" },
  { code: "zh-Hans", key: "zhHans", englishName: "Simplified Chinese" },
];

const languageCodes = new Set(languageOrder);
const languageStorageKey = "nicechunk.language";
const localeVersionPrefix = "nicechunk.playerSet.locale.version.";
const localeDataPrefix = "nicechunk.playerSet.locale.data.";
const defaultLanguage = "en";
const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : String(Date.now());

let activeLanguage = normalizeLanguage(localStorage.getItem(languageStorageKey)) || defaultLanguage;
let activeDictionary = {};
let mainnetIndex = null;
let readyPromise = null;

export async function initI18n(root = document) {
  if (!readyPromise) readyPromise = loadLanguage(activeLanguage);
  await readyPromise;
  setupLanguageControls(root);
  applyTranslations(root);
  return { language: activeLanguage, dictionary: activeDictionary };
}

export function currentLanguage() {
  return activeLanguage;
}

export async function setLanguage(language, root = document) {
  const nextLanguage = normalizeLanguage(language) || defaultLanguage;
  localStorage.setItem(languageStorageKey, nextLanguage);
  if (nextLanguage === activeLanguage && Object.keys(activeDictionary).length) {
    applyTranslations(root);
    return activeLanguage;
  }

  activeLanguage = nextLanguage;
  readyPromise = loadLanguage(activeLanguage);
  await readyPromise;
  applyTranslations(root);
  window.dispatchEvent(new CustomEvent("nicechunk:playerSetLanguageChange", { detail: { language: activeLanguage } }));
  return activeLanguage;
}

export function t(key, params = {}) {
  const template = getByPath(activeDictionary, key) ?? key;
  return interpolate(String(template), params);
}

export function applyTranslations(root = document) {
  document.documentElement.lang = activeLanguage;
  setupLanguageControls(root);

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  translateAttribute(root, "data-i18n-title", "title");
  translateAttribute(root, "data-i18n-placeholder", "placeholder");
  translateAttribute(root, "data-i18n-aria-label", "aria-label");
  translateAttribute(root, "data-i18n-label", "label");
  translateAttribute(root, "data-i18n-value", "value");
}

export function setupLanguageControls(root = document) {
  root.querySelectorAll("select[data-player-set-language-select]").forEach((select) => {
    if (!select.dataset.i18nReady) {
      select.replaceChildren(
        ...languages.map((language) => {
          const option = document.createElement("option");
          option.value = language.code;
          option.textContent = languageOptionLabel(language);
          return option;
        }),
      );
      select.addEventListener("change", () => setLanguage(select.value));
      select.dataset.i18nReady = "true";
    }
    select.value = activeLanguage;
    select.setAttribute("aria-label", t("common.language"));
    select.title = t("common.language");
    select.querySelectorAll("option").forEach((option) => {
      const language = languages.find((item) => item.code === option.value);
      if (language) option.textContent = languageOptionLabel(language);
    });
  });
}

function translateAttribute(root, dataName, attributeName) {
  root.querySelectorAll(`[${dataName}]`).forEach((element) => {
    element.setAttribute(attributeName, t(element.getAttribute(dataName)));
  });
}

function languageOptionLabel(language) {
  return `${language.englishName} (${languageNativeName(language)})`;
}

function languageNativeName(language) {
  return t(`common.languageNative.${language.key}`);
}

async function loadLanguage(language) {
  try {
    activeDictionary = await loadDictionary(language);
  } catch (error) {
    if (language === defaultLanguage) throw error;
    activeLanguage = defaultLanguage;
    localStorage.setItem(languageStorageKey, activeLanguage);
    activeDictionary = await loadDictionary(defaultLanguage);
  }
  document.documentElement.lang = activeLanguage;
  return activeDictionary;
}

async function loadDictionary(language) {
  const mainnet = await fetchMainnetIndex().catch(() => null);
  const remoteLocale = mainnet?.playerSetI18n?.locales?.[language];
  const cached = readCachedDictionary(language, remoteLocale?.version);
  if (cached) return cached;

  const dictionary = await fetchDictionary(language, remoteLocale);
  writeCachedDictionary(language, dictionary, remoteLocale?.version ?? dictionary?._meta?.version ?? buildVersion);
  return dictionary;
}

async function fetchMainnetIndex() {
  if (mainnetIndex) return mainnetIndex;
  const response = await fetch(`/mainnet.json?v=${encodeURIComponent(buildVersion)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to load mainnet index");
  mainnetIndex = await response.json();
  return mainnetIndex;
}

async function fetchDictionary(language, remoteLocale = null) {
  const url = remoteLocale?.url || `/player_set/locales/${language}.json`;
  const version = remoteLocale?.version || buildVersion;
  const response = await fetch(`${url}?v=${encodeURIComponent(version)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Failed to load locale ${language}`);
  return response.json();
}

function readCachedDictionary(language, expectedVersion) {
  if (!expectedVersion) return null;
  const cachedVersion = localStorage.getItem(localeVersionKey(language));
  if (cachedVersion !== expectedVersion) return null;
  const raw = localStorage.getItem(localeDataKey(language));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    localStorage.removeItem(localeVersionKey(language));
    localStorage.removeItem(localeDataKey(language));
    return null;
  }
}

function writeCachedDictionary(language, dictionary, version) {
  if (!version || !dictionary) return;
  try {
    localStorage.setItem(localeVersionKey(language), version);
    localStorage.setItem(localeDataKey(language), JSON.stringify(dictionary));
  } catch (_error) {
    // Storage may be unavailable or full; the page can still use the fetched dictionary.
  }
}

function localeVersionKey(language) {
  return `${localeVersionPrefix}${language}`;
}

function localeDataKey(language) {
  return `${localeDataPrefix}${language}`;
}

function normalizeLanguage(language) {
  if (!language) return null;
  if (languageCodes.has(language)) return language;
  const normalized = String(language).replace("_", "-");
  if (languageCodes.has(normalized)) return normalized;
  return null;
}

function getByPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => params[key] ?? "");
}
