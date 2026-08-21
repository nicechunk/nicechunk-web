import {
  applyTranslations,
  currentLanguage,
  initI18n,
  setupLanguageControls,
} from "./i18n.js";
import {
  SITE_NAVIGATION_ALIASES,
  SITE_NAVIGATION_LABELS,
  SITE_NAVIGATION_ROUTES,
  resolveSiteNavigationPath,
} from "./site-navigation.js";

const MOBILE_MEDIA_QUERY = "(max-width: 900px)";
const HEADER_I18N_PREFIX = "siteHeader";

export const SITE_HEADER_ROUTES = SITE_NAVIGATION_ROUTES;
export const SITE_HEADER_ROUTE_ALIASES = SITE_NAVIGATION_ALIASES;

const mountedHeaders = new WeakMap();
let headerInstanceSequence = 0;

/**
 * Mount the shared NiceChunk header into a header element or placeholder.
 * The caller's page scope controls which locale file src/i18n.js loads.
 */
export async function mountSiteHeader(target, options = {}) {
  const header = resolveHeaderElement(target);
  const previousController = mountedHeaders.get(header);
  previousController?.destroy({ preserveElement: true });

  const controller = createHeaderController(header, options);
  mountedHeaders.set(header, controller);

  try {
    if (options.initializeI18n !== false) await initI18n(header);
    setupLanguageControls(header);
    applyTranslations(header);
    controller.refresh();
    header.removeAttribute("data-site-header-pending");
  } catch (error) {
    controller.destroy({ preserveElement: true });
    throw error;
  }

  return controller.publicApi;
}

/**
 * Update the active route without rebuilding the header.
 */
export function setSiteHeaderActivePath(target, activePath = window.location.pathname) {
  const header = resolveExistingHeader(target);
  if (!header) return false;
  const controller = mountedHeaders.get(header);
  if (controller) controller.setActivePath(activePath);
  else updateActiveRoute(header, activePath);
  return true;
}

function createHeaderController(header, options) {
  const abortController = new AbortController();
  const { signal } = abortController;
  const instanceId = `site-header-${++headerInstanceSequence}`;
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  let currentActivePath = options.activePath || window.location.pathname;
  const brandImage = options.brandImage || "/media/nck.png";
  let previousFocus = null;
  let previousBodyOverflow = "";
  let bodyScrollLocked = false;
  let languageObserver = null;
  let headerResizeObserver = null;

  header.className = mergeClassNames(header.className, "site-header site-header-shared");
  if (!header.id) header.id = "siteHeader";
  header.dataset.siteHeaderMounted = "true";
  header.dataset.siteHeaderPending = "true";

  const brand = createBrand(brandImage);
  const mobileEnter = createMobileEnter();
  const menuToggle = createMenuToggle(`${instanceId}-navigation`);
  const navigation = createNavigation(instanceId);
  const backdrop = createElement("div", "site-menu-backdrop");
  backdrop.setAttribute("aria-hidden", "true");

  header.replaceChildren(brand, mobileEnter, menuToggle, navigation.element, backdrop);
  updateActiveRoute(header, currentActivePath);

  function setMobileMenuOpen(open, { restoreFocus = true } = {}) {
    const isMobile = mediaQuery.matches;
    const nextOpen = Boolean(open && isMobile);
    const wasOpen = header.classList.contains("mobile-menu-open");

    if (nextOpen && !wasOpen) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuToggle;
    }

    header.classList.toggle("mobile-menu-open", nextOpen);
    document.documentElement.classList.toggle("site-mobile-menu-open", nextOpen);
    menuToggle.setAttribute("aria-expanded", String(nextOpen));
    navigation.element.inert = isMobile && !nextOpen;
    if (isMobile) navigation.element.setAttribute("aria-hidden", String(!nextOpen));
    else navigation.element.removeAttribute("aria-hidden");

    if (nextOpen) {
      closeLanguageMenu(navigation.languagePicker);
      lockBodyScroll();
      window.requestAnimationFrame(() => navigation.closeButton.focus({ preventScroll: true }));
    } else {
      closeLanguageMenu(navigation.languagePicker);
      unlockBodyScroll();
      if (wasOpen && restoreFocus && previousFocus?.isConnected) {
        const focusTarget = previousFocus;
        window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
      }
      previousFocus = null;
    }

    updateHeaderMetrics(header, menuToggle);
  }

  function lockBodyScroll() {
    if (bodyScrollLocked || !document.body) return;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    bodyScrollLocked = true;
  }

  function unlockBodyScroll() {
    if (!bodyScrollLocked || !document.body) return;
    document.body.style.overflow = previousBodyOverflow;
    bodyScrollLocked = false;
  }

  function syncResponsiveState() {
    if (!mediaQuery.matches) setMobileMenuOpen(false, { restoreFocus: false });
    navigation.element.inert = mediaQuery.matches && !header.classList.contains("mobile-menu-open");
    if (mediaQuery.matches) {
      navigation.element.setAttribute(
        "aria-hidden",
        String(!header.classList.contains("mobile-menu-open")),
      );
    } else {
      navigation.element.removeAttribute("aria-hidden");
    }
    updateHeaderMetrics(header, menuToggle);
  }

  function refresh() {
    updateActiveRoute(header, currentActivePath);
    updateRouteLabels(header);
    enhanceLanguageMenu(navigation.languagePicker);
    syncLanguageMenuState(navigation.languagePicker);
    syncResponsiveState();
    updateHeaderMetrics(header, menuToggle);
  }

  function destroy({ preserveElement = false } = {}) {
    setMobileMenuOpen(false, { restoreFocus: false });
    abortController.abort();
    languageObserver?.disconnect();
    headerResizeObserver?.disconnect();
    mountedHeaders.delete(header);
    if (!preserveElement) header.replaceChildren();
    header.classList.remove("mobile-menu-open");
    header.classList.remove("site-header-shared");
    header.removeAttribute("data-site-header-mounted");
    header.removeAttribute("data-site-header-pending");
  }

  function setActivePath(path) {
    currentActivePath = path || window.location.pathname;
    updateActiveRoute(header, currentActivePath);
  }

  menuToggle.addEventListener("click", () => {
    setMobileMenuOpen(!header.classList.contains("mobile-menu-open"));
  }, { signal });

  navigation.closeButton.addEventListener("click", () => setMobileMenuOpen(false), { signal });
  backdrop.addEventListener("click", () => setMobileMenuOpen(false), { signal });

  navigation.element.addEventListener("click", (event) => {
    if (event.target.closest?.("a[href]")) setMobileMenuOpen(false, { restoreFocus: false });
  }, { signal });

  document.addEventListener("keydown", (event) => {
    if (!header.classList.contains("mobile-menu-open")) return;
    if (event.key === "Escape") {
      if (
        navigation.languagePicker.classList.contains("open")
        && event.target instanceof Element
        && navigation.languagePicker.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setMobileMenuOpen(false);
      return;
    }
    if (event.key === "Tab") trapFocus(event, navigation.element);
  }, { capture: true, signal });

  window.addEventListener("resize", () => updateHeaderMetrics(header, menuToggle), {
    passive: true,
    signal,
  });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => updateHeaderMetrics(header, menuToggle), 80);
  }, { signal });
  window.addEventListener("nicechunk:languagechange", () => {
    window.requestAnimationFrame(() => {
      updateRouteLabels(header);
      syncLanguageMenuState(navigation.languagePicker);
      updateHeaderMetrics(header, menuToggle);
    });
  }, { signal });

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", syncResponsiveState, { signal });
  } else {
    mediaQuery.addListener(syncResponsiveState);
    signal.addEventListener("abort", () => mediaQuery.removeListener(syncResponsiveState), { once: true });
  }

  if ("MutationObserver" in window) {
    languageObserver = new MutationObserver(() => syncLanguageMenuState(navigation.languagePicker));
    languageObserver.observe(navigation.languagePicker, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
  }

  if ("ResizeObserver" in window) {
    headerResizeObserver = new ResizeObserver(() => updateHeaderMetrics(header, menuToggle));
    headerResizeObserver.observe(header);
  }

  const publicApi = Object.freeze({
    element: header,
    navigation: navigation.element,
    closeMobileMenu: () => setMobileMenuOpen(false),
    destroy,
    refresh: () => {
      setupLanguageControls(header);
      applyTranslations(header);
      refresh();
    },
    setActivePath,
  });

  return { destroy, publicApi, refresh, setActivePath };
}

function createBrand(imageSource) {
  const brand = createElement("a", "brand-mark");
  brand.href = "/";
  setI18nAttribute(brand, "aria-label", `${HEADER_I18N_PREFIX}.brandHomeAria`);

  const image = document.createElement("img");
  image.src = imageSource;
  image.alt = "";
  image.width = 36;
  image.height = 36;

  const name = createElement("span", "brand-mark-name");
  setI18nText(name, `${HEADER_I18N_PREFIX}.brandName`);
  brand.append(image, name);
  return brand;
}

function createMenuToggle(navigationId) {
  const button = createElement("button", "site-menu-toggle");
  button.type = "button";
  button.setAttribute("aria-controls", navigationId);
  button.setAttribute("aria-expanded", "false");
  setI18nAttribute(button, "aria-label", `${HEADER_I18N_PREFIX}.openMenu`);
  button.append(createMenuLine(), createMenuLine(), createMenuLine());
  return button;
}

function createMobileEnter() {
  const link = createElement("a", "site-mobile-enter");
  link.href = "/play/";
  link.dataset.siteMobileEnter = "true";
  link.textContent = routeLabel("enterWorld");
  return link;
}

function createNavigation(instanceId) {
  const navigation = createElement("nav", "site-nav");
  navigation.id = `${instanceId}-navigation`;
  setI18nAttribute(navigation, "aria-label", `${HEADER_I18N_PREFIX}.primaryNavigationAria`);

  const closeButton = createElement("button", "site-menu-close");
  closeButton.type = "button";
  setI18nAttribute(closeButton, "aria-label", `${HEADER_I18N_PREFIX}.closeMenu`);
  closeButton.append(createMenuLine(), createMenuLine());

  const links = createElement("div", "nav-links");
  const secondaryLinks = createElement("div", "nav-secondary");
  const actions = createElement("div", "nav-actions");

  for (const route of SITE_HEADER_ROUTES) {
    const link = createElement("a", route.group === "action" ? "header-action" : "");
    link.href = route.href;
    if (route.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.siteNavExternal = "true";
    }
    link.dataset.siteNavKey = route.key;
    link.dataset.siteNavPath = normalizePath(route.href);
    link.textContent = routeLabel(route.key);
    if (route.group === "action") actions.append(link);
    else if (route.group === "secondary") secondaryLinks.append(link);
    else links.append(link);
  }

  const languagePicker = createElement("div", "site-header-language");
  languagePicker.setAttribute("data-i18n-language-menu", "");
  actions.prepend(languagePicker);
  navigation.append(closeButton, links, secondaryLinks, actions);

  return { element: navigation, closeButton, languagePicker, secondaryLinks };
}

function updateRouteLabels(header) {
  header.querySelectorAll("[data-site-nav-key]").forEach((link) => {
    link.textContent = routeLabel(link.dataset.siteNavKey);
  });
  const mobileEnter = header.querySelector("[data-site-mobile-enter]");
  if (mobileEnter) mobileEnter.textContent = routeLabel("enterWorld");
}

function routeLabel(key) {
  const labels = SITE_NAVIGATION_LABELS[currentLanguage()] || SITE_NAVIGATION_LABELS.en;
  return labels[key] || SITE_NAVIGATION_LABELS.en[key] || key;
}

function createMenuLine() {
  const line = document.createElement("span");
  line.setAttribute("aria-hidden", "true");
  return line;
}

function enhanceLanguageMenu(picker) {
  if (!picker || picker.dataset.siteHeaderA11yReady === "true") return;
  const trigger = picker.querySelector(".language-trigger");
  const list = picker.querySelector(".language-menu");
  if (!trigger || !list) return;

  const instance = picker.closest(".site-header")?.querySelector(".site-nav")?.id || "site-header";
  trigger.id ||= `${instance}-language-trigger`;
  list.id ||= `${instance}-language-listbox`;
  trigger.setAttribute("aria-controls", list.id);
  list.setAttribute("aria-labelledby", trigger.id);

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!picker.classList.contains("open")) return;
      event.preventDefault();
      event.stopPropagation();
      closeLanguageMenu(picker);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openLanguageMenu(picker);
    const options = enabledLanguageOptions(picker);
    if (!options.length) return;
    const selected = options.find((option) => option.getAttribute("aria-selected") === "true");
    const target = event.key === "ArrowUp" || event.key === "End"
      ? options.at(-1)
      : event.key === "Enter" || event.key === " "
        ? selected || options[0]
        : options[0];
    setRovingLanguageOption(picker, target);
    target.focus({ preventScroll: true });
  });

  list.addEventListener("keydown", (event) => {
    const options = enabledLanguageOptions(picker);
    if (!options.length) return;
    const currentIndex = Math.max(0, options.indexOf(document.activeElement));
    let nextIndex = currentIndex;

    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeLanguageMenu(picker);
      trigger.focus({ preventScroll: true });
      return;
    } else if (event.key === "Tab") {
      closeLanguageMenu(picker);
      return;
    } else {
      return;
    }

    event.preventDefault();
    const nextOption = options[nextIndex];
    setRovingLanguageOption(picker, nextOption);
    nextOption.focus({ preventScroll: true });
  });

  list.addEventListener("click", (event) => {
    if (!event.target.closest?.(".language-option")) return;
    window.requestAnimationFrame(() => {
      closeLanguageMenu(picker);
      trigger.focus({ preventScroll: true });
    });
  });

  picker.addEventListener("focusout", (event) => {
    if (event.relatedTarget && picker.contains(event.relatedTarget)) return;
    closeLanguageMenu(picker);
  });

  picker.dataset.siteHeaderA11yReady = "true";
  syncLanguageMenuState(picker);
}

function syncLanguageMenuState(picker) {
  const trigger = picker?.querySelector(".language-trigger");
  const list = picker?.querySelector(".language-menu");
  if (!trigger || !list) return;
  const open = picker.classList.contains("open");
  trigger.setAttribute("aria-expanded", String(open));
  list.setAttribute("aria-hidden", String(!open));
  const options = enabledLanguageOptions(picker);
  const selected = options.find((option) => option.getAttribute("aria-selected") === "true") || options[0];
  setRovingLanguageOption(picker, selected);
}

function openLanguageMenu(picker) {
  picker.classList.add("open");
  syncLanguageMenuState(picker);
}

function closeLanguageMenu(picker) {
  if (!picker) return;
  picker.classList.remove("open");
  syncLanguageMenuState(picker);
}

function enabledLanguageOptions(picker) {
  return [...(picker?.querySelectorAll(".language-option") || [])]
    .filter((option) => !option.disabled && option.getAttribute("aria-disabled") !== "true");
}

function setRovingLanguageOption(picker, activeOption) {
  picker?.querySelectorAll(".language-option").forEach((option) => {
    option.tabIndex = option === activeOption ? 0 : -1;
  });
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll(
    'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(isVisibleFocusable);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  } else if (!container.contains(document.activeElement)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function isVisibleFocusable(element) {
  if (!(element instanceof HTMLElement) || element.closest('[aria-hidden="true"]')) return false;
  const styles = window.getComputedStyle(element);
  return styles.display !== "none" && styles.visibility !== "hidden" && element.getClientRects().length > 0;
}

function updateActiveRoute(header, activePath) {
  const normalizedCurrent = normalizePath(activePath || window.location.pathname);
  const aliasedCurrent = resolveSiteNavigationPath(normalizedCurrent);

  header.querySelectorAll("[data-site-nav-path]").forEach((link) => {
    if (link.dataset.siteNavExternal === "true") {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
      return;
    }
    const routePath = link.dataset.siteNavPath;
    const active = routePath === "/"
      ? aliasedCurrent === "/"
      : aliasedCurrent === routePath || aliasedCurrent.startsWith(routePath);
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function updateHeaderMetrics(header, menuToggle) {
  const headerRect = header.getBoundingClientRect();
  const height = Math.ceil(headerRect.height || 0);
  if (height) document.documentElement.style.setProperty("--nc-site-header-px", `${height}px`);

  const toggleRect = menuToggle.getBoundingClientRect();
  if (!toggleRect.height) return;
  const styles = window.getComputedStyle(header);
  const bottomPadding = Number.parseFloat(styles.paddingBottom) || 0;
  const topbarHeight = Math.ceil(toggleRect.bottom - headerRect.top + bottomPadding);
  if (topbarHeight) document.documentElement.style.setProperty("--nc-site-topbar-px", `${topbarHeight}px`);
}

function resolveHeaderElement(target) {
  const existing = resolveExistingHeader(target);
  if (existing?.tagName === "HEADER") return existing;

  const header = document.createElement("header");
  if (existing) existing.replaceWith(header);
  else if (document.body) document.body.prepend(header);
  else throw new TypeError("A document body or header mount target is required");
  return header;
}

function resolveExistingHeader(target) {
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.querySelector(target);
  return document.querySelector("[data-site-header-root], .site-header");
}

function normalizePath(value) {
  const url = new URL(value || "/", window.location.origin);
  if (url.pathname === "/" || url.pathname === "/index.html") return "/";
  return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}

function setI18nText(element, key) {
  element.dataset.i18n = key;
}

function setI18nAttribute(element, attribute, key) {
  element.setAttribute(`data-i18n-${attribute}`, key);
}

function createElement(tagName, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function mergeClassNames(current, required) {
  return [...new Set(`${current || ""} ${required}`.trim().split(/\s+/u).filter(Boolean))].join(" ");
}
