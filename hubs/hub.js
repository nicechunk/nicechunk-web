import "./style.css";
import "../src/site-header.css";
import "../src/site-header-bootstrap.js";
import { initI18n, t } from "../src/i18n.js";
import { finishSiteLoading, setSiteLoadingProgress } from "../src/site-ui.js";

const HUBS = Object.freeze({
  world: Object.freeze({
    links: Object.freeze([
      Object.freeze({ key: "civilization", href: "/civilization/", icon: "codex" }),
      Object.freeze({ key: "worldRules", href: "/world_rule/", icon: "terrain" }),
      Object.freeze({ key: "resourceRules", href: "/resource_rule/", icon: "resource" }),
      Object.freeze({ key: "elements", href: "/elements/", icon: "elements" }),
    ]),
  }),
  technology: Object.freeze({
    links: Object.freeze([
      Object.freeze({ key: "ncm", href: "/ncm/", icon: "compress" }),
      Object.freeze({ key: "ncfm", href: "/ncfm/", icon: "wave" }),
      Object.freeze({ key: "fairness", href: "/fairness/", icon: "balance" }),
      Object.freeze({ key: "proof", href: "/proof-of-frontier/", icon: "proof" }),
      Object.freeze({ key: "guardians", href: "/guardian/", icon: "relay" }),
      Object.freeze({ key: "contracts", href: "/contracts/", icon: "contract" }),
      Object.freeze({ key: "trust", href: "/trust/", icon: "shield" }),
    ]),
  }),
  create: Object.freeze({
    links: Object.freeze([
      Object.freeze({ key: "miner", href: "/miner/", icon: "pickaxe" }),
      Object.freeze({ key: "chunkjs", href: "/chunk.js/", icon: "cube" }),
      Object.freeze({ key: "buildNcm", href: "/build_ncm/", icon: "building" }),
      Object.freeze({ key: "itemNcm", href: "/item_ncm/", icon: "item" }),
      Object.freeze({ key: "forging", href: "/forging/", icon: "forge" }),
      Object.freeze({ key: "ncm4", href: "/ncm4/", icon: "layers" }),
      Object.freeze({ key: "fourier", href: "/fourier-pickaxe/", icon: "wave" }),
    ]),
  }),
});

const hubKey = document.documentElement.dataset.hub;
const hub = HUBS[hubKey] || HUBS.world;
const cardRoot = document.querySelector("#hubLinks");

await initI18n();
renderHubLinks();
setSiteLoadingProgress(92);
window.requestAnimationFrame(() => finishSiteLoading());

function renderHubLinks() {
  if (!cardRoot) return;
  cardRoot.replaceChildren(...hub.links.map((link, index) => {
    const anchor = document.createElement("a");
    anchor.className = "hub-link";
    anchor.href = link.href;
    anchor.style.setProperty("--hub-link-order", String(index));

    const number = document.createElement("span");
    number.className = "hub-link-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const icon = document.createElement("span");
    icon.className = "hub-link-icon";
    icon.innerHTML = iconSvg(link.icon);

    const copy = document.createElement("span");
    copy.className = "hub-link-copy";
    const title = document.createElement("strong");
    title.textContent = t(`hubs.${hubKey}.links.${link.key}.title`);
    const body = document.createElement("span");
    body.textContent = t(`hubs.${hubKey}.links.${link.key}.body`);
    copy.append(title, body);

    const arrow = document.createElement("span");
    arrow.className = "hub-link-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    anchor.append(number, icon, copy, arrow);
    return anchor;
  }));
}

function iconSvg(name) {
  const paths = {
    codex: '<path d="M5 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5zM19 4h-5v16a3 3 0 0 1 3-3h2z"/>',
    terrain: '<path d="m3 17 5-6 4 3 4-7 5 10M4 20h16M8 11V6h5"/>',
    resource: '<path d="m12 3 7 4-7 4-7-4zM5 12l7 4 7-4M5 17l7 4 7-4"/>',
    elements: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="m7 7.5 3 3M17 7.5l-3 3M12 15v3"/>',
    compress: '<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6M8 8h8v8H8z"/>',
    wave: '<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>',
    balance: '<path d="M12 3v18M5 6h14M7 6l-4 7h8zM17 6l-4 7h8zM8 21h8"/>',
    proof: '<path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM9 12l2 2 4-5"/>',
    relay: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
    contract: '<path d="M6 3h9l3 3v15H6zM15 3v4h4M9 11h6M9 15h6"/>',
    shield: '<path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    pickaxe: '<path d="M14 4c3 0 5 1 7 3l-2 2c-2-1-4-1-6 0L5 20l-2-2 8-10c-1-2-1-3-3-4z"/>',
    cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
    building: '<path d="M4 21V9l8-6 8 6v12M8 21v-8h8v8M3 21h18"/>',
    item: '<path d="M5 7h14v14H5zM8 7V4h8v3M9 11h6M12 11v6"/>',
    forge: '<path d="M4 5h12v6c0 3-2 5-5 5H8c-2 0-4-2-4-4zM11 16v5M7 21h8M17 4l4 4M19 3l2 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.cube}</svg>`;
}
