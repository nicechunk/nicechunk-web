const STORAGE_KEY = "nicechunk.language";
const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = Object.freeze([
  Object.freeze({ key: "en", label: "English" }),
  Object.freeze({ key: "es", label: "Español" }),
  Object.freeze({ key: "fr", label: "Français" }),
  Object.freeze({ key: "de", label: "Deutsch" }),
  Object.freeze({ key: "ja", label: "日本語" }),
  Object.freeze({ key: "ru", label: "Русский" }),
  Object.freeze({ key: "ko", label: "한국어" }),
  Object.freeze({ key: "zh-Hant", label: "繁體中文" }),
  Object.freeze({ key: "zh-Hans", label: "简体中文" }),
]);

const SUPPORTED_LOCALE_KEYS = new Set(SUPPORTED_LOCALES.map((entry) => entry.key));
let locale = DEFAULT_LOCALE;
let messages = Object.freeze({});
let initialized = false;
let localeRequest = 0;

export async function initI18n(root = document) {
  locale = readStoredLocale();
  messages = await fetchLocaleMessages(locale);
  applyTranslations(root);
  if (!initialized) {
    initialized = true;
    root.addEventListener("change", (event) => {
      const select = event.target.closest("[data-language-select]");
      if (select) void setLocale(select.value);
    });
  }
  return locale;
}

export function getLocale() {
  return locale;
}

export async function setLocale(nextLocale, { persist = true } = {}) {
  const normalized = normalizeLocale(nextLocale);
  if (normalized === locale) return locale;
  const request = ++localeRequest;
  const nextMessages = await fetchLocaleMessages(normalized);
  if (request !== localeRequest) return locale;
  locale = normalized;
  messages = nextMessages;
  if (persist) writeStoredLocale(locale);
  applyTranslations(document);
  window.dispatchEvent(new CustomEvent("buildncm:localechange", { detail: { locale } }));
  return locale;
}

export function onLocaleChange(listener) {
  const handler = (event) => listener(event.detail.locale);
  window.addEventListener("buildncm:localechange", handler);
  return () => window.removeEventListener("buildncm:localechange", handler);
}

export function t(key, variables = {}) {
  const template = messages[key] ?? key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
  ));
}

export function applyTranslations(root = document) {
  document.documentElement.lang = locale;
  document.title = t("document.title");
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = t("document.description");
  root.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = t(node.dataset.i18nHtml); });
  for (const attribute of ["aria-label", "placeholder", "title"]) {
    const dataName = `i18n${attribute.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`;
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => node.setAttribute(attribute, t(node.dataset[dataName])));
  }
  root.querySelectorAll("[data-language-select]").forEach((select) => { select.value = locale; });
}

async function fetchLocaleMessages(requestedLocale) {
  const response = await fetch(new URL(`./locales/${requestedLocale}.json`, import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error(`BUILD_NCM locale ${requestedLocale} failed with HTTP ${response.status}.`);
  const value = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`BUILD_NCM locale ${requestedLocale} is invalid.`);
  }
  return Object.freeze({ ...value });
}

function normalizeLocale(value) {
  const text = String(value ?? "").trim();
  if (SUPPORTED_LOCALE_KEYS.has(text)) return text;
  const lower = text.toLowerCase();
  if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo" || lower.startsWith("zh-hant")) return "zh-Hant";
  if (lower.startsWith("zh")) return "zh-Hans";
  const base = lower.split("-")[0];
  return SUPPORTED_LOCALE_KEYS.has(base) ? base : DEFAULT_LOCALE;
}

function readStoredLocale() {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeStoredLocale(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}
