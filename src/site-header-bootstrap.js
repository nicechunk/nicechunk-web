import "./site-header.css";
import "./site-ui.js";
import { mountSiteHeader } from "./site-header.js";

const header = document.querySelector("[data-site-header-root], .site-header");
const fallbackClassName = header?.className || "site-header";
const fallbackChildren = header ? [...header.childNodes].map((node) => node.cloneNode(true)) : [];

export const siteHeaderReady = header
  ? mountSiteHeader(header).catch((error) => {
      header.className = fallbackClassName;
      header.removeAttribute("data-site-header-mounted");
      header.removeAttribute("data-site-header-pending");
      header.replaceChildren(...fallbackChildren.map((node) => node.cloneNode(true)));
      console.error("NiceChunk shared navigation could not be initialized.", error);
      return null;
    })
  : Promise.resolve(null);

let languageReloadPending = false;
window.addEventListener("nicechunk:languagechange", () => {
  if (languageReloadPending) return;
  languageReloadPending = true;
  window.location.reload();
});
