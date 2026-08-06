import "../src/site-header.css";
import "./style.css";
import { initI18n, t } from "../src/i18n.js";
import { mountSiteHeader } from "../src/site-header.js";
import {
  claimSiteLoading,
  finishSiteLoading,
  setSiteLoadingProgress,
  setSiteLoadingStage,
} from "../src/site-ui.js";
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
const HOME_WORLD_READY_TIMEOUT_MS = 30_000;
const HOME_WORLD_VISUAL_HANDOFF_TIMEOUT_MS = 4_000;
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 2_400;
const PROGRAMMATIC_SCROLL_TARGET_RATIO = 0.55;

claimSiteLoading();

let activeSectionIndex = 0;
let homeWorldScene = null;
let homeBuildingInspector = null;
let programmaticScrollTargetIndex = null;
let programmaticScrollTimer = 0;

initHome();

async function initHome() {
  setSiteLoadingStage("INITIALIZING CHUNK.JS");
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
  setSiteLoadingStage(t("loading.terrain"));
  setSiteLoadingProgress(58);

  setupSectionObserver();
  setupNavigation();
  setupKeyboardPaging();
  setActiveSection(activeSectionIndex, { force: true, immediate: true });

  setSiteLoadingStage(t("loading.meshing"));
  setSiteLoadingProgress(82);
  const sceneResult = await waitForHomeWorldScene(homeWorldScene);
  if (sceneResult?.status === "ready") {
    setSiteLoadingStage(t("loading.rendering"));
    setSiteLoadingProgress(96);
    const handoffResult = await waitForHomeWorldVisualHandoff(homeWorldCanvas);
    if (handoffResult === "ready") {
      document.documentElement.classList.add("home-world-presented");
      setSiteLoadingStage(t("loading.ready"));
    } else {
      document.documentElement.classList.remove("home-world-presented");
      setSiteLoadingStage(t("loading.fallback"));
    }
  } else {
    document.documentElement.classList.remove("home-world-presented");
    setSiteLoadingStage(t("loading.fallback"));
  }
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
      if (programmaticScrollTargetIndex !== null) {
        const targetSection = sections[programmaticScrollTargetIndex];
        const targetRatio = visibility.get(targetSection) || 0;
        if (mostVisible !== targetSection || targetRatio < PROGRAMMATIC_SCROLL_TARGET_RATIO) return;
        finishProgrammaticScroll(programmaticScrollTargetIndex);
      }
      setActiveSection(sections.indexOf(mostVisible));
    },
    { root: container, threshold: [0.15, 0.35, 0.55, 0.75] },
  );

  sections.forEach((section) => observer.observe(section));
  container.addEventListener("wheel", cancelProgrammaticScroll, { passive: true });
  container.addEventListener("touchstart", cancelProgrammaticScroll, { passive: true });
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
  if (targetIndex === activeSectionIndex
    && Math.abs(container.scrollTop - target.offsetTop) <= 1) {
    finishProgrammaticScroll(targetIndex);
    return;
  }
  beginProgrammaticScroll(targetIndex);
  setActiveSection(targetIndex);
  target.scrollIntoView({
    block: "start",
    behavior: reducedMotion.matches ? "auto" : "smooth",
  });
}

function beginProgrammaticScroll(targetIndex) {
  window.clearTimeout(programmaticScrollTimer);
  programmaticScrollTargetIndex = targetIndex;
  document.documentElement.dataset.homeScrollTarget = String(targetIndex);
  programmaticScrollTimer = window.setTimeout(() => {
    finishProgrammaticScroll(targetIndex);
  }, reducedMotion.matches ? 0 : PROGRAMMATIC_SCROLL_TIMEOUT_MS);
}

function finishProgrammaticScroll(targetIndex) {
  if (programmaticScrollTargetIndex !== targetIndex) return;
  window.clearTimeout(programmaticScrollTimer);
  programmaticScrollTimer = 0;
  programmaticScrollTargetIndex = null;
  delete document.documentElement.dataset.homeScrollTarget;
}

function cancelProgrammaticScroll() {
  if (programmaticScrollTargetIndex === null) return;
  window.clearTimeout(programmaticScrollTimer);
  programmaticScrollTimer = 0;
  programmaticScrollTargetIndex = null;
  delete document.documentElement.dataset.homeScrollTarget;
  window.requestAnimationFrame(() => {
    if (programmaticScrollTargetIndex !== null) return;
    setActiveSection(nearestSectionIndex());
  });
}

function nearestSectionIndex() {
  let nearestIndex = activeSectionIndex;
  let nearestDistance = Infinity;
  sections.forEach((section, index) => {
    const distance = Math.abs(section.offsetTop - container.scrollTop);
    if (distance >= nearestDistance) return;
    nearestIndex = index;
    nearestDistance = distance;
  });
  return nearestIndex;
}

function clampIndex(index) {
  return Math.min(Math.max(Math.trunc(Number(index) || 0), 0), Math.max(0, sections.length - 1));
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function waitForHomeWorldScene(scene) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(result);
    };
    const timeout = window.setTimeout(
      () => finish({ status: "timeout" }),
      HOME_WORLD_READY_TIMEOUT_MS,
    );
    scene.ready.then(finish, (error) => finish({ status: "unavailable", detail: error }));
  });
}

function waitForHomeWorldVisualHandoff(canvas) {
  if (!canvas || canvas.dataset.sceneVisualHandoff === "ready") return Promise.resolve("ready");
  return new Promise((resolve) => {
    let animationFrame = 0;
    let settled = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resolve(status);
    };
    const probe = () => {
      if (canvas.dataset.sceneVisualHandoff === "ready") {
        finish("ready");
        return;
      }
      animationFrame = requestAnimationFrame(probe);
    };
    const timeout = window.setTimeout(
      () => finish("timeout"),
      HOME_WORLD_VISUAL_HANDOFF_TIMEOUT_MS,
    );
    probe();
  });
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
