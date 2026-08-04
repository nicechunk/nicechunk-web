import "../src/site-header.css";
import "./style.css";
import { initI18n, t } from "../src/i18n.js";
import { mountSiteHeader } from "../src/site-header.js";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";
import { createHomeBuildingInspector } from "./home-building-inspector.js";
import { createHomeWorldScene, HOME_WORLD_SECTION_VIEWS } from "./chunkjs-world-scene.js";

const container = document.querySelector("#scrollContainer");
const sections = [...document.querySelectorAll(".snap-section")];
const dots = [...document.querySelectorAll(".side-dot")];
const header = document.querySelector("#siteHeader");
const chapterCurrent = document.querySelector("#chapterCurrent");
const homeWorldCanvas = document.querySelector("#homeWorldCanvas");
const homeBuildingInspectorRoot = document.querySelector("#homeBuildingInspector");
const guardianChatLayer = document.querySelector("#guardianChatLayer");
const guardianChatBubbles = Object.freeze({
  boy: createGuardianChatBubbleController("boy"),
  girl: createGuardianChatBubbleController("girl"),
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let activeSectionIndex = 0;
let homeWorldScene = null;
let homeBuildingInspector = null;

initHome();

async function initHome() {
  setSiteLoadingProgress(32);
  homeBuildingInspector = createHomeBuildingInspector(homeBuildingInspectorRoot);
  homeWorldScene = createHomeWorldScene(homeWorldCanvas, {
    onBuildingInspect: (detail) => homeBuildingInspector?.update(detail),
    onGuardianChat: updateGuardianChat,
  });
  homeWorldScene.focus(HOME_WORLD_SECTION_VIEWS[activeSectionIndex], { immediate: true });

  await mountSiteHeader(header);
  await initI18n();
  homeBuildingInspector.refresh();
  setSiteLoadingProgress(58);

  setupSectionObserver();
  setupNavigation();
  setupKeyboardPaging();
  setActiveSection(activeSectionIndex, { force: true, immediate: true });

  setSiteLoadingProgress(82);
  await Promise.race([homeWorldScene.ready, delay(1_800)]);
  finishSiteLoading();
}

function setupSectionObserver() {
  if (!container || !sections.length) return;
  const visibility = new Map(sections.map((section) => [section, 0]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visibility.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      const [mostVisible, ratio] = [...visibility.entries()]
        .sort((left, right) => right[1] - left[1])[0] || [];
      if (!mostVisible || ratio < 0.15) return;
      setActiveSection(sections.indexOf(mostVisible));
    },
    { root: container, threshold: [0.15, 0.35, 0.55, 0.75] },
  );

  sections.forEach((section) => observer.observe(section));
}

function setupNavigation() {
  dots.forEach((dot) => {
    dot.addEventListener("click", () => scrollToSection(Number(dot.dataset.sectionIndex || 0)));
  });

  document.querySelectorAll("[data-scroll-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      scrollToSection(Number(link.dataset.scrollTarget || 0));
    });
  });
}

function setupKeyboardPaging() {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return;
    if (document.documentElement.classList.contains("site-mobile-menu-open")) return;

    const nextKeys = new Set(["ArrowDown", "PageDown"]);
    const previousKeys = new Set(["ArrowUp", "PageUp"]);
    if (event.key === "Home") {
      event.preventDefault();
      scrollToSection(0);
    } else if (event.key === "End") {
      event.preventDefault();
      scrollToSection(sections.length - 1);
    } else if (nextKeys.has(event.key)) {
      event.preventDefault();
      scrollToSection(activeSectionIndex + 1);
    } else if (previousKeys.has(event.key)) {
      event.preventDefault();
      scrollToSection(activeSectionIndex - 1);
    }
  });
}

function setActiveSection(index, { force = false, immediate = false } = {}) {
  const clamped = clampIndex(index);
  if (!force && clamped === activeSectionIndex) return;
  activeSectionIndex = clamped;

  sections.forEach((section, sectionIndex) => {
    const active = sectionIndex === activeSectionIndex;
    section.classList.toggle("active", active);
    section.setAttribute("aria-current", active ? "step" : "false");
  });

  dots.forEach((dot, dotIndex) => {
    const active = dotIndex === activeSectionIndex;
    dot.classList.toggle("active", active);
    if (active) dot.setAttribute("aria-current", "step");
    else dot.removeAttribute("aria-current");
  });

  if (chapterCurrent) chapterCurrent.textContent = String(activeSectionIndex + 1).padStart(2, "0");
  const section = sections[activeSectionIndex];
  const sceneView = section?.dataset.sceneView || HOME_WORLD_SECTION_VIEWS[activeSectionIndex];
  document.documentElement.dataset.homeChapter = sceneView;
  header?.classList.toggle("scrolled", activeSectionIndex > 0);
  homeWorldScene?.focus(sceneView, { immediate: immediate || reducedMotion.matches });
}

function scrollToSection(index) {
  const targetIndex = clampIndex(index);
  const target = sections[targetIndex];
  if (!target) return;
  setActiveSection(targetIndex);
  target.scrollIntoView({
    block: "start",
    behavior: reducedMotion.matches ? "auto" : "smooth",
  });
}

function clampIndex(index) {
  return Math.min(Math.max(Math.trunc(Number(index) || 0), 0), Math.max(0, sections.length - 1));
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createGuardianChatBubbleController(actor) {
  const root = document.querySelector(`#guardianChat${actor[0].toUpperCase()}${actor.slice(1)}`);
  return Object.freeze({
    root,
    copy: root?.querySelector(".guardian-chat-copy") || null,
  });
}

function updateGuardianChat(detail) {
  if (!guardianChatLayer) return;
  const active = Boolean(detail);
  guardianChatLayer.dataset.active = String(active);
  if (!active) return;

  guardianChatLayer.dataset.pair = String(detail.pairIndex);
  guardianChatLayer.dataset.turn = detail.turn;
  guardianChatLayer.dataset.gesture = detail.gesture;
  for (const actor of ["boy", "girl"]) {
    const bubble = guardianChatBubbles[actor];
    const anchor = detail[actor];
    if (!bubble?.root || !bubble.copy || !anchor) continue;
    bubble.root.style.setProperty("--guardian-chat-x", `${anchor.x.toFixed(1)}px`);
    bubble.root.style.setProperty("--guardian-chat-y", `${anchor.y.toFixed(1)}px`);
    bubble.root.dataset.speaking = String(detail.turn === actor);
    const key = `watchers.chat.pair${detail.pairIndex}.${actor}`;
    if (bubble.copy.dataset.homeI18n !== key) {
      bubble.copy.dataset.homeI18n = key;
      bubble.copy.textContent = t(key);
    }
  }
}

window.addEventListener("pagehide", () => {
  homeWorldScene?.destroy();
  homeBuildingInspector?.destroy();
}, { once: true });
