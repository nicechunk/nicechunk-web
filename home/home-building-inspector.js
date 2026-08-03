import { currentLanguage, t } from "../src/i18n.js";

const INSPECTOR_TIMING = Object.freeze({
  exitTotalMs: 380,
});
const MIN_DESKTOP_WIDTH = 901;
const VIEWPORT_MARGIN = 18;
const PANEL_GAP_PX = 18;
const CONNECTOR_LEAD_PX = 10;
const CONNECTOR_TERMINAL_PX = 8;

/*
 * enter  000ms anchor | 020ms connector | 090ms surface | 140ms frame
 *        220ms title  | 280ms metrics   | 360ms full NCM3 code
 * exit   000ms code/metrics | 060ms frame | 140ms surface | 220ms connector
 */
export function createHomeBuildingInspector(root) {
  if (!(root instanceof HTMLElement)) return createNoopInspector();

  const panel = root.querySelector(".ncm-inspector-panel");
  const buildingOutline = root.querySelector("#ncmInspectorBuildingOutline");
  const buildingOutlineShadow = root.querySelector("#ncmInspectorBuildingOutlineShadow");
  const connector = root.querySelector("#ncmInspectorConnector");
  const connectorShadow = root.querySelector("#ncmInspectorConnectorShadow");
  const anchor = root.querySelector("#ncmInspectorAnchor");
  const terminal = root.querySelector("#ncmInspectorTerminal");
  const title = root.querySelector("#ncmInspectorTitle");
  const identity = root.querySelector("#ncmInspectorIdentity");
  const payload = root.querySelector("#ncmInspectorPayload");
  const voxels = root.querySelector("#ncmInspectorVoxels");
  const modelSize = root.querySelector("#ncmInspectorModelSize");
  const expansion = root.querySelector("#ncmInspectorExpansion");
  const codeLength = root.querySelector("#ncmInspectorCodeLength");
  const code = root.querySelector("#ncmInspectorCode");
  if (!panel || !buildingOutline || !buildingOutlineShadow || !connector || !connectorShadow
    || !anchor || !terminal || !title || !identity
    || !payload || !voxels || !modelSize || !expansion || !codeLength || !code) {
    return createNoopInspector();
  }

  let currentDetail = null;
  let currentLayout = null;
  let panelSize = null;
  let closeTimer = 0;
  let lastConnectorPath = "";
  let lastOutlinePoints = "";

  function update(detail) {
    if (!detail?.target || window.innerWidth < MIN_DESKTOP_WIDTH) {
      close();
      return;
    }
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = 0;

    const changed = currentDetail?.target.id !== detail.target.id;
    currentDetail = detail;
    if (changed) {
      renderContent(detail.target);
      root.dataset.buildingId = detail.target.id;
      panelSize = null;
    }
    if (changed || !currentLayout) currentLayout = placePanel(detail);
    updateBuildingOutline(detail.outline, detail.bounds);
    updateConnector(detail, currentLayout);
    root.dataset.active = "true";
    document.documentElement.classList.add("home-building-hover");
  }

  function close() {
    if (!currentDetail && root.dataset.active !== "true") return;
    currentDetail = null;
    root.dataset.active = "false";
    document.documentElement.classList.remove("home-building-hover");
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (root.dataset.active === "true") return;
      root.removeAttribute("data-building-id");
      root.removeAttribute("data-side");
      currentLayout = null;
      panelSize = null;
      lastConnectorPath = "";
      lastOutlinePoints = "";
    }, INSPECTOR_TIMING.exitTotalMs);
  }

  function refresh() {
    if (!currentDetail) return;
    renderContent(currentDetail.target);
    panelSize = null;
    currentLayout = placePanel(currentDetail);
    updateBuildingOutline(currentDetail.outline, currentDetail.bounds);
    updateConnector(currentDetail, currentLayout);
  }

  function renderContent(target) {
    const language = currentLanguage();
    const localizedTitle = localizedValue(target.titles, language);
    title.textContent = localizedTitle;
    identity.textContent = target.id.toUpperCase();
    payload.textContent = `${formatNumber(target.payloadBytes, language)} B`;
    voxels.textContent = formatNumber(target.voxelCount, language);
    modelSize.textContent = `${target.modelSize.x} × ${target.modelSize.y} × ${target.modelSize.z}`;
    expansion.textContent = `${(target.voxelCount / Math.max(1, target.payloadBytes)).toFixed(2)} VOX/B`;
    codeLength.textContent = t("buildingInspector.codeLength", {
      count: formatNumber(target.ncmCode.length, language),
    });
    code.textContent = target.ncmCode;
    panel.setAttribute("aria-label", `${localizedTitle}: ${t("buildingInspector.aria")}`);
  }

  function placePanel(detail) {
    if (!panelSize) {
      const panelRect = panel.getBoundingClientRect();
      panelSize = Object.freeze({ width: panelRect.width, height: panelRect.height });
    }
    const { width, height } = panelSize;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 76;
    const minY = Math.min(viewport.height - height - VIEWPORT_MARGIN, headerBottom + 14);
    const maxY = Math.max(minY, viewport.height - height - VIEWPORT_MARGIN);
    const verticalPositions = uniqueNumbers([
      clamp(detail.bounds.top - 14, minY, maxY),
      clamp(detail.anchor.y - 52, minY, maxY),
      clamp((detail.bounds.top + detail.bounds.bottom - height) * 0.5, minY, maxY),
    ]);
    const maxX = Math.max(VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN);
    const horizontalPositions = [
      { x: clamp(detail.bounds.right + PANEL_GAP_PX, VIEWPORT_MARGIN, maxX), side: "right" },
      { x: clamp(detail.bounds.left - width - PANEL_GAP_PX, VIEWPORT_MARGIN, maxX), side: "left" },
    ];
    const obstructions = [...document.querySelectorAll(".snap-section.active .chapter-card, .chapter-nav")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    const candidates = [];
    for (const horizontal of horizontalPositions) {
      for (const y of verticalPositions) {
        const { x, side } = horizontal;
        const rect = { left: x, top: y, right: x + width, bottom: y + height, width, height };
        const obstructionPenalty = obstructions.reduce((sum, obstruction) => sum + intersectionArea(rect, obstruction), 0);
        const buildingPenalty = intersectionArea(rect, detail.bounds);
        const edgeX = side === "right" ? x : x + width;
        const terminalY = clamp(detail.anchor.y, y + 54, y + height - 38);
        const distance = Math.hypot(edgeX - detail.anchor.x, terminalY - detail.anchor.y);
        const panelArea = Math.max(1, width * height);
        candidates.push({
          x,
          y,
          width,
          height,
          side,
          score: (obstructionPenalty / panelArea) * 1_200
            + (buildingPenalty / panelArea) * 2_400
            + distance,
        });
      }
    }
    candidates.sort((left, right) => left.score - right.score);
    const layout = candidates[0] || {
      x: VIEWPORT_MARGIN,
      y: minY,
      width,
      height,
      side: "right",
    };
    root.dataset.side = layout.side;
    root.style.setProperty("--ncm-inspector-x", `${layout.x.toFixed(2)}px`);
    root.style.setProperty("--ncm-inspector-y", `${layout.y.toFixed(2)}px`);
    return layout;
  }

  function updateBuildingOutline(projectedOutline, bounds) {
    const points = Array.isArray(projectedOutline) && projectedOutline.length >= 3
      ? projectedOutline
      : [
        { x: bounds.left, y: bounds.top },
        { x: bounds.right, y: bounds.top },
        { x: bounds.right, y: bounds.bottom },
        { x: bounds.left, y: bounds.bottom },
      ];
    const pointList = points
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");
    if (pointList === lastOutlinePoints) return;
    buildingOutline.setAttribute("points", pointList);
    buildingOutlineShadow.setAttribute("points", pointList);
    lastOutlinePoints = pointList;
  }

  function updateConnector(detail, layout) {
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const edgeX = layout.side === "right" ? detail.bounds.right : detail.bounds.left;
    const anchorX = clamp(edgeX, 0, viewportWidth);
    const anchorY = clamp(
      detail.anchor.y,
      Math.max(0, detail.bounds.top + 4),
      Math.min(viewportHeight, detail.bounds.bottom - 4),
    );
    const terminalX = layout.side === "right" ? layout.x : layout.x + layout.width;
    const terminalY = clamp(anchorY, layout.y + 42, layout.y + layout.height - 30);
    const direction = terminalX >= anchorX ? 1 : -1;
    const path = [
      `M ${anchorX.toFixed(2)} ${anchorY.toFixed(2)}`,
      `L ${(anchorX + direction * CONNECTOR_LEAD_PX).toFixed(2)} ${anchorY.toFixed(2)}`,
      `L ${(terminalX - direction * CONNECTOR_TERMINAL_PX).toFixed(2)} ${terminalY.toFixed(2)}`,
      `L ${terminalX.toFixed(2)} ${terminalY.toFixed(2)}`,
    ].join(" ");
    if (path !== lastConnectorPath) {
      connector.setAttribute("d", path);
      connectorShadow.setAttribute("d", path);
      lastConnectorPath = path;
    }
    root.querySelector("svg")?.setAttribute("viewBox", `0 0 ${viewportWidth} ${viewportHeight}`);
    anchor.setAttribute("cx", anchorX.toFixed(2));
    anchor.setAttribute("cy", anchorY.toFixed(2));
    terminal.setAttribute("x", (terminalX - 2.5).toFixed(2));
    terminal.setAttribute("y", (terminalY - 2.5).toFixed(2));
    root.dataset.anchorX = anchorX.toFixed(2);
    root.dataset.anchorY = anchorY.toFixed(2);
  }

  const handleResize = () => refresh();
  const handleLanguageChange = () => refresh();
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("nicechunk:languagechange", handleLanguageChange);

  return Object.freeze({
    update,
    refresh,
    destroy() {
      if (closeTimer) window.clearTimeout(closeTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("nicechunk:languagechange", handleLanguageChange);
      document.documentElement.classList.remove("home-building-hover");
    },
  });
}

function localizedValue(values, language) {
  return values?.[language] || values?.en || Object.values(values || {})[0] || "NCM3";
}

function formatNumber(value, language) {
  return new Intl.NumberFormat(language).format(Number(value) || 0);
}

function intersectionArea(left, right) {
  const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return width * height;
}

function uniqueNumbers(values) {
  return [...new Set(values.map((value) => Number(value.toFixed(2))))];
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function createNoopInspector() {
  return Object.freeze({
    update() {},
    refresh() {},
    destroy() {},
  });
}
