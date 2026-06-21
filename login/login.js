import "../src/site-header.css";
import "../src/site-ui.js";
import { initI18n, t } from "../src/i18n.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import {
  clearWalletConnection,
  clearWalletSession,
  getWalletSession,
  hasBoundWallet,
  isGameWalletSessionReady,
  persistConnectedWallet,
  persistUsername,
  safeRedirectTarget,
} from "../src/walletSession.js";

const canvas = document.querySelector("#worldPreview");
const ctx = canvas.getContext("2d");
const walletList = document.querySelector("#walletList");
const statusLine = document.querySelector("#statusLine");
const walletSection = document.querySelector("#walletSection");
const profileSection = document.querySelector("#profileSection");
const readySection = document.querySelector("#readySection");
const usernameInput = document.querySelector("#usernameInput");
const addressChip = document.querySelector("#addressChip");
const saveNameButton = document.querySelector("#saveNameButton");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const summaryName = document.querySelector("#summaryName");
const summaryAddress = document.querySelector("#summaryAddress");
const steps = Array.from(document.querySelectorAll(".step"));
const heroVideo = document.querySelector(".hero-logo-video");
const heroLogoStage = document.querySelector(".hero-logo-stage");
const heroLogoCanvas = document.querySelector(".hero-logo-canvas");
const heroLogoFallback = document.querySelector(".hero-logo-fallback");
const heroLoadStatus = document.querySelector("#heroLoadStatus");
const heroLoadTitle = document.querySelector("#heroLoadTitle");
const heroLoadText = document.querySelector("#heroLoadText");
const heroLoadBar = document.querySelector("#heroLoadBar");
const heroLoadPercent = document.querySelector("#heroLoadPercent");
const heroLoadBytes = document.querySelector("#heroLoadBytes");
const routeLoadingOverlay = document.querySelector("#routeLoadingOverlay");
const routeLoadTitle = document.querySelector("#routeLoadTitle");
const routeLoadBody = document.querySelector("#routeLoadBody");
const routeLoadBar = document.querySelector("#routeLoadBar");
const routeLoadText = document.querySelector("#routeLoadText");
const routeLoadPercent = document.querySelector("#routeLoadPercent");
const routeLoadBytes = document.querySelector("#routeLoadBytes");

const routeParams = new URLSearchParams(window.location.search);
const redirectTarget = safeRedirectTarget(routeParams.get("redirect")) ?? "/play/";
const autoConnectRequested = routeParams.get("autoConnect") === "1";
const phantomRedirectStorageKey = "nicechunk.phantomRedirectConnect";
const phantomReturnBrowserParam = "returnBrowser";
const walletHelperMode = "wallet-helper";
const walletProofParam = "walletProof";
const walletChallengeParam = "challenge";
const walletLoginChallengeStorageKey = "nicechunk.walletLoginChallenge";
const walletChallengeMaxAgeMs = 10 * 60 * 1000;

let selectedWallet = null;
let { walletAddress, username } = getWalletSession();
let pointerOffsetX = 0;
let pointerOffsetY = 0;
let autoConnectAttempted = false;
let i18nReady = false;
let keyedHeroFrameId = 0;

const loginLoadingFallbacks = {
  visual: {
    title: "Loading visual layer",
    body: "Fetching hero video asset.",
  },
  visualDecode: {
    title: "Decoding visual layer",
    body: "Preparing transparent logo animation.",
  },
  visualReady: {
    title: "Visual layer ready",
    body: "Hero animation is ready.",
  },
  visualFallback: {
    title: "Visual fallback active",
    body: "Using poster image while video loading is unavailable.",
  },
  route: {
    title: "Opening game client",
    body: "Handing your wallet session to the world gateway.",
  },
};

drawScene();
setupHeroVideoLoading();
window.addEventListener("resize", drawScene);
window.addEventListener("pointermove", updateBackdropOffset, { passive: true });
window.addEventListener("nicechunk:languagechange", initialize);
saveNameButton.addEventListener("click", saveUsername);
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveUsername();
});
startButton.addEventListener("click", () => {
  if (!isGameWalletSessionReady()) {
    initialize();
    return;
  }
  startGameWithLoading();
});
resetButton.addEventListener("click", resetLogin);

bootLogin();

async function bootLogin() {
  updateGatewayLoading(12);
  try {
    await initI18n();
    i18nReady = true;
    updateGatewayLoading(72);
    const helperRendered = await handleWalletHelperMode();
    const proofHandled = handleWalletProofLogin();
    const phantomReturnForwarded = handlePhantomRedirectConnect();
    updateGatewayLoading(100);
    if (!helperRendered && !proofHandled && !phantomReturnForwarded) initialize();
  } catch (error) {
    console.warn("Failed to initialize NiceChunk login", error);
    statusLine.textContent = i18nReady ? t("login.status.resourceFailed") : "Login resources failed to load. Refresh and try again.";
  }
}

function initialize() {
  if (!i18nReady) return;
  const session = getWalletSession();
  walletAddress = session.walletAddress;
  username = session.username;
  if (walletAddress && !hasBoundWallet(session)) {
    clearWalletConnection();
    walletAddress = "";
  }

  const wallets = detectWallets();
  renderWallets(wallets);

  if (hasBoundWallet(getWalletSession()) && username) {
    showReady();
    return;
  }

  if (hasBoundWallet(getWalletSession())) {
    showProfile();
    return;
  }

  setStep("wallet");
  statusLine.textContent = wallets.length
    ? t("login.status.walletDetected")
    : t("login.status.noWallet");
  maybeAutoConnectWallet(wallets);
}

function detectWallets() {
  const candidates = [
    {
      id: "phantom",
      name: "Phantom",
      provider: window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null),
      hint: t("login.walletHint.recommended"),
      logo: "/media/wallets/phantom.svg",
    },
    {
      id: "solflare",
      name: "Solflare",
      provider: window.solflare || (window.solana?.isSolflare ? window.solana : null),
      hint: t("login.walletHint.compatible"),
      logo: "/media/wallets/solflare.svg",
    },
    {
      id: "backpack",
      name: "Backpack",
      provider: window.backpack?.solana || (window.solana?.isBackpack ? window.solana : null),
      hint: t("login.walletHint.compatible"),
      logo: "/media/wallets/backpack.svg",
    },
    {
      id: "solana",
      name: "Solana Wallet",
      provider: window.solana,
      hint: t("login.walletHint.generic"),
      logo: "/media/wallets/solana.svg",
    },
  ];

  const seen = new Set();
  return candidates.filter((wallet) => {
    if (!wallet.provider || typeof wallet.provider.connect !== "function") return false;
    if (seen.has(wallet.provider)) return false;
    seen.add(wallet.provider);
    return true;
  });
}

function renderWallets(wallets) {
  walletList.innerHTML = "";

  if (!wallets.length) {
    mobileWalletLinks().forEach((wallet) => {
      const button = createWalletButton(wallet);
      button.addEventListener("click", () => {
        statusLine.textContent = t("login.status.openingWalletApp", { wallet: wallet.name });
      });
      walletList.appendChild(button);
    });
    return;
  }

  wallets.forEach((wallet) => {
    const button = createWalletButton(wallet);
    button.addEventListener("click", () => connectWallet(wallet));
    walletList.appendChild(button);
  });
}

function createWalletButton(wallet) {
  const button = document.createElement(wallet.appLink ? "a" : "button");
  button.className = "wallet-button";
  if (wallet.appLink) {
    button.href = buildWalletAppLink(wallet.appLink);
    button.target = "_blank";
    button.rel = "noreferrer";
  } else {
    button.type = "button";
    button.disabled = Boolean(wallet.disabled);
  }
  button.dataset.wallet = wallet.id || "missing";
  if (wallet.appLink) button.dataset.walletApp = "true";
  button.innerHTML = `
    <span class="wallet-icon" aria-hidden="true"><img src="${wallet.logo}" alt="" loading="eager" /></span>
    <span class="wallet-copy">
      <strong>${wallet.name}</strong>
      <span>${wallet.appLink ? t("login.walletButton.openInApp") : wallet.disabled ? wallet.hint : t("login.walletButton.connectAuthorize")}</span>
    </span>
    <span class="wallet-state">${wallet.hint}</span>
  `;
  return button;
}

async function connectWallet(wallet) {
  selectedWallet = wallet;
  statusLine.textContent = t("login.status.connecting", { wallet: wallet.name });

  try {
    const result = await wallet.provider.connect();
    const publicKey = result?.publicKey || wallet.provider.publicKey;
    if (!publicKey) throw new Error(t("login.status.publicKeyMissing"));

    walletAddress = publicKey.toString();
    persistConnectedWallet({ walletAddress, walletName: wallet.name });
    showProfile();
  } catch (error) {
    statusLine.textContent = error?.message || t("login.status.connectFailed");
  }
}

function maybeAutoConnectWallet(wallets) {
  if (!autoConnectRequested || autoConnectAttempted || walletAddress || !wallets.length) return;
  autoConnectAttempted = true;
  window.setTimeout(() => connectWallet(wallets[0]), 250);
}

function mobileWalletLinks() {
  return [
    {
      id: "phantom-app",
      name: "Phantom",
      hint: t("login.walletHint.mobileApp"),
      logo: "/media/wallets/phantom.svg",
      appLink: "phantom-helper",
    },
    {
      id: "solflare-app",
      name: "Solflare",
      hint: t("login.walletHint.mobileApp"),
      logo: "/media/wallets/solflare.svg",
      appLink: "solflare",
    },
    {
      id: "backpack-app",
      name: "Backpack",
      hint: t("login.walletHint.mobileApp"),
      logo: "/media/wallets/backpack.svg",
      appLink: "backpack",
    },
  ];
}

function buildWalletAppLink(walletId) {
  if (walletId === "phantom-helper") return buildPhantomHelperLink();

  const browseTarget = new URL(window.location.href);
  if (!safeRedirectTarget(browseTarget.searchParams.get("redirect"))) {
    browseTarget.searchParams.set("redirect", redirectTarget);
  }
  browseTarget.searchParams.set("autoConnect", "1");

  const encodedTarget = encodeURIComponent(browseTarget.toString());
  const encodedRef = encodeURIComponent(window.location.origin);
  const bases = {
    phantom: "https://phantom.app/ul/browse",
    solflare: "https://solflare.com/ul/v1/browse",
    backpack: "https://backpack.app/ul/v1/browse",
  };
  return `${bases[walletId]}/${encodedTarget}?ref=${encodedRef}`;
}

function buildPhantomHelperLink() {
  const challenge = createWalletLoginChallenge();
  const helperUrl = new URL("/login/", window.location.origin);
  helperUrl.searchParams.set("mode", walletHelperMode);
  helperUrl.searchParams.set("wallet", "phantom");
  helperUrl.searchParams.set("redirect", redirectTarget);
  helperUrl.searchParams.set(walletChallengeParam, encodeJson(challenge));
  if (challenge.returnBrowser) helperUrl.searchParams.set(phantomReturnBrowserParam, challenge.returnBrowser);

  localStorage.setItem(walletLoginChallengeStorageKey, JSON.stringify(challenge));

  const encodedTarget = encodeURIComponent(helperUrl.toString());
  const encodedRef = encodeURIComponent(window.location.origin);
  return `https://phantom.app/ul/browse/${encodedTarget}?ref=${encodedRef}`;
}

function createWalletLoginChallenge() {
  const nonce = bs58.encode(crypto.getRandomValues(new Uint8Array(16)));
  const issuedAt = new Date().toISOString();
  const returnBrowser = browserReturnMode();
  const message = [
    "NiceChunk wallet login",
    `Domain: ${window.location.host}`,
    `Origin: ${window.location.origin}`,
    `Redirect: ${redirectTarget}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");

  return {
    version: 1,
    app: "NiceChunk",
    domain: window.location.host,
    origin: window.location.origin,
    redirectTarget,
    nonce,
    issuedAt,
    returnBrowser,
    message,
  };
}

async function handleWalletHelperMode() {
  if (routeParams.get("mode") !== walletHelperMode) return false;

  const challenge = decodeJson(routeParams.get(walletChallengeParam));
  if (!isValidChallengeShape(challenge)) {
    renderWalletHelperError();
    return true;
  }

  renderWalletHelper(challenge);
  window.setTimeout(() => signWalletHelperChallenge(challenge), 350);
  return true;
}

function renderWalletHelper(challenge) {
  setStep("wallet");
  profileSection.classList.add("hidden");
  readySection.classList.add("hidden");
  walletSection.classList.remove("hidden");
  walletList.replaceChildren();

  const button = document.createElement("button");
  button.className = "primary-action";
  button.type = "button";
  button.textContent = t("login.signLoginMessage");
  button.addEventListener("click", () => signWalletHelperChallenge(challenge));
  walletList.appendChild(button);
  statusLine.textContent = t("login.status.signingChallenge");
}

function renderWalletHelperError() {
  setStep("wallet");
  walletList.replaceChildren();
  statusLine.textContent = t("login.status.connectFailed");
}

async function signWalletHelperChallenge(challenge) {
  const provider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null) || window.solana;
  if (!provider || typeof provider.connect !== "function" || typeof provider.signMessage !== "function") {
    statusLine.textContent = t("login.status.noWallet");
    return;
  }

  statusLine.textContent = t("login.status.signingChallenge");
  try {
    const connectResult = await provider.connect();
    const publicKey = publicKeyToString(connectResult?.publicKey || provider.publicKey);
    if (!publicKey) throw new Error("Missing wallet public key.");

    const encodedMessage = new TextEncoder().encode(challenge.message);
    const signResult = await provider.signMessage(encodedMessage, "utf8");
    const signature = signatureToBytes(signResult);
    if (!signature?.length) throw new Error("Missing wallet signature.");

    const proof = {
      version: 1,
      walletName: "Phantom",
      publicKey,
      signature: bs58.encode(signature),
      challenge,
    };

    const returnUrl = new URL("/login/", window.location.origin);
    returnUrl.searchParams.set("redirect", challenge.redirectTarget || redirectTarget);
    returnUrl.searchParams.set(walletProofParam, encodeJson(proof));
    const walletBrowserUrl = returnUrl.toString();
    renderContinueInWalletBrowser(walletBrowserUrl);
    window.setTimeout(() => {
      window.location.href = walletBrowserUrl;
    }, 250);
  } catch (error) {
    console.warn("Failed to sign NiceChunk login challenge", error);
    statusLine.textContent = t("login.status.signatureFailed");
  }
}

function handleWalletProofLogin() {
  const proof = decodeJson(routeParams.get(walletProofParam));
  if (!proof) return false;
  return completeWalletProof(proof);
}

function completeWalletProof(proof) {
  try {
    verifyWalletProof(proof);
    walletAddress = proof.publicKey;
    localStorage.removeItem(walletLoginChallengeStorageKey);
    localStorage.setItem(`nicechunk.walletLogin.used.${proof.challenge.nonce}`, String(Date.now()));
    persistConnectedWallet({ walletAddress, walletName: proof.walletName || "Phantom" });

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete(walletProofParam);
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    showProfile();
    return true;
  } catch (error) {
    console.warn("Failed to verify NiceChunk wallet proof", error);
    statusLine.textContent = t("login.status.signatureFailed");
    return false;
  }
}

function renderWalletProofPaste() {
  walletList.querySelector(".proof-paste-box")?.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "proof-paste-box";

  const label = document.createElement("label");
  label.textContent = t("login.pasteProofLabel");

  const textarea = document.createElement("textarea");
  textarea.placeholder = t("login.pasteProofPlaceholder");
  textarea.setAttribute("aria-label", t("login.pasteProofLabel"));
  textarea.autocomplete = "off";
  textarea.spellcheck = false;

  const actions = document.createElement("div");
  actions.className = "proof-paste-actions";

  const pasteButton = document.createElement("button");
  pasteButton.className = "secondary-action";
  pasteButton.type = "button";
  pasteButton.textContent = t("login.pasteFromClipboard");
  pasteButton.addEventListener("click", async () => {
    statusLine.textContent = t("login.status.readingProof");
    try {
      textarea.value = await navigator.clipboard.readText();
      completePastedWalletProof(textarea.value);
    } catch (error) {
      console.warn("Failed to read copied NiceChunk wallet proof", error);
      statusLine.textContent = t("login.status.noCopiedProof");
      textarea.focus();
    }
  });

  const completeButton = document.createElement("button");
  completeButton.className = "primary-action";
  completeButton.type = "button";
  completeButton.textContent = t("login.completePastedProof");
  completeButton.addEventListener("click", () => completePastedWalletProof(textarea.value));

  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") completePastedWalletProof(textarea.value);
  });

  label.appendChild(textarea);
  actions.append(pasteButton, completeButton);
  wrapper.append(label, actions);
  walletList.appendChild(wrapper);
  textarea.focus();
  statusLine.textContent = t("login.status.pasteProofReady");
}

function completePastedWalletProof(value) {
  statusLine.textContent = t("login.status.readingProof");
  const proof = decodeProofText(value);
  if (!proof) {
    statusLine.textContent = t("login.status.noCopiedProof");
    return false;
  }
  return completeWalletProof(proof);
}

function verifyWalletProof(proof) {
  if (!proof || proof.version !== 1 || !proof.publicKey || !proof.signature) {
    throw new Error("Invalid wallet proof.");
  }
  if (!isValidChallengeShape(proof.challenge)) throw new Error("Invalid wallet challenge.");
  if (proof.challenge.domain !== window.location.host || proof.challenge.origin !== window.location.origin) {
    throw new Error("Wallet challenge origin mismatch.");
  }
  if (Date.now() - Date.parse(proof.challenge.issuedAt) > walletChallengeMaxAgeMs) {
    throw new Error("Wallet challenge expired.");
  }

  const pending = readStoredChallenge();
  if (pending && pending.nonce !== proof.challenge.nonce) {
    throw new Error("Wallet challenge nonce mismatch.");
  }
  if (pending && pending.message !== proof.challenge.message) {
    throw new Error("Wallet challenge message mismatch.");
  }

  const publicKey = bs58.decode(proof.publicKey);
  const signature = bs58.decode(proof.signature);
  const message = new TextEncoder().encode(proof.challenge.message);
  if (!nacl.sign.detached.verify(message, signature, publicKey)) {
    throw new Error("Wallet signature verification failed.");
  }
}

function readStoredChallenge() {
  try {
    const challenge = JSON.parse(localStorage.getItem(walletLoginChallengeStorageKey) || "null");
    return isValidChallengeShape(challenge) ? challenge : null;
  } catch {
    return null;
  }
}

function isValidChallengeShape(challenge) {
  if (!challenge || challenge.version !== 1) return false;
  return Boolean(challenge.domain && challenge.origin && challenge.nonce && challenge.issuedAt && challenge.message);
}

function signatureToBytes(result) {
  const signature = result?.signature || result;
  if (signature instanceof Uint8Array) return signature;
  if (Array.isArray(signature)) return Uint8Array.from(signature);
  return null;
}

function publicKeyToString(publicKey) {
  if (!publicKey) return "";
  if (typeof publicKey === "string") return publicKey;
  if (typeof publicKey.toBase58 === "function") return publicKey.toBase58();
  if (typeof publicKey.toString === "function") return publicKey.toString();
  return "";
}

function encodeJson(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJson(value) {
  if (!value) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function encodeProofText(proof) {
  return `nicechunk-proof:${encodeJson(proof)}`;
}

function decodeProofText(value) {
  const text = String(value || "").trim();
  const prefix = "nicechunk-proof:";
  if (!text.startsWith(prefix)) return null;
  return decodeJson(text.slice(prefix.length));
}

function buildPhantomConnectLink() {
  const keyPair = nacl.box.keyPair();
  const redirectUrl = new URL("/login/", window.location.origin);
  redirectUrl.searchParams.set("redirect", redirectTarget);
  redirectUrl.searchParams.set("phantomConnect", "1");
  const returnBrowser = browserReturnMode();
  if (returnBrowser) redirectUrl.searchParams.set(phantomReturnBrowserParam, returnBrowser);

  localStorage.setItem(phantomRedirectStorageKey, JSON.stringify({
    secretKey: Array.from(keyPair.secretKey),
    redirectTarget,
    returnBrowser,
    createdAt: Date.now(),
  }));

  const connectUrl = new URL("https://phantom.app/ul/v1/connect");
  connectUrl.searchParams.set("app_url", window.location.origin);
  connectUrl.searchParams.set("dapp_encryption_public_key", bs58.encode(keyPair.publicKey));
  connectUrl.searchParams.set("redirect_link", redirectUrl.toString());
  connectUrl.searchParams.set("cluster", "devnet");
  return connectUrl.toString();
}

function browserReturnMode() {
  const userAgent = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isChromeIos = /CriOS/i.test(userAgent);
  const isChromeAndroid = isAndroid && /Chrome\//i.test(userAgent) && !/EdgA|OPR|SamsungBrowser|Firefox/i.test(userAgent);

  if (isChromeIos) return "chrome-ios";
  if (isChromeAndroid) return "chrome-android";
  return "";
}

function browserReturnLink(url, returnBrowser) {
  if (returnBrowser === "chrome-ios") {
    return `${url.protocol === "https:" ? "googlechromes" : "googlechrome"}://${url.host}${url.pathname}${url.search}${url.hash}`;
  }

  if (returnBrowser === "chrome-android") {
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
  }

  return url.toString();
}

function handlePhantomRedirectConnect() {
  if (!routeParams.has("phantomConnect")) return false;

  const errorCode = routeParams.get("errorCode");
  if (errorCode) {
    statusLine.textContent = routeParams.get("errorMessage") || t("login.status.connectFailed");
    return false;
  }

  const phantomPublicKey = routeParams.get("phantom_encryption_public_key");
  const nonce = routeParams.get("nonce");
  const data = routeParams.get("data");
  if (!phantomPublicKey || !nonce || !data) return false;

  const forwarded = forwardPhantomResponseToOriginalBrowser();
  if (forwarded) return true;

  try {
    const pending = JSON.parse(localStorage.getItem(phantomRedirectStorageKey) || "{}");
    const secretKey = Uint8Array.from(pending.secretKey || []);
    if (secretKey.length !== nacl.box.secretKeyLength) throw new Error("Missing Phantom connect key.");

    const sharedSecret = nacl.box.before(bs58.decode(phantomPublicKey), secretKey);
    const decrypted = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), sharedSecret);
    if (!decrypted) throw new Error("Unable to decrypt Phantom connect response.");

    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    if (!payload?.public_key) throw new Error("Phantom connect response did not include a public key.");

    walletAddress = payload.public_key;
    localStorage.removeItem(phantomRedirectStorageKey);
    persistConnectedWallet({ walletAddress, walletName: "Phantom" });

    const cleanUrl = new URL(window.location.href);
    ["phantomConnect", "phantom_encryption_public_key", "nonce", "data"].forEach((key) => {
      cleanUrl.searchParams.delete(key);
    });
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  } catch (error) {
    console.warn("Failed to complete Phantom redirect login", error);
    statusLine.textContent = t("login.status.connectFailed");
  }

  return false;
}

function forwardPhantomResponseToOriginalBrowser() {
  const returnBrowser = routeParams.get(phantomReturnBrowserParam);
  if (!returnBrowser) return false;

  const pending = JSON.parse(localStorage.getItem(phantomRedirectStorageKey) || "{}");
  const secretKey = Uint8Array.from(pending.secretKey || []);
  if (secretKey.length === nacl.box.secretKeyLength) return false;

  const returnUrl = new URL("/login/", window.location.origin);
  routeParams.forEach((value, key) => {
    if (key !== phantomReturnBrowserParam) returnUrl.searchParams.set(key, value);
  });
  const browserUrl = browserReturnLink(returnUrl, returnBrowser);

  renderReturnToBrowser(browserUrl);
  window.setTimeout(() => {
    window.location.href = browserUrl;
  }, 250);
  return true;
}

function renderReturnToBrowser(browserUrl, proof = null) {
  setStep("wallet");
  profileSection.classList.add("hidden");
  readySection.classList.add("hidden");
  walletSection.classList.remove("hidden");
  walletList.replaceChildren();

  const link = document.createElement("a");
  link.className = "primary-action";
  link.href = browserUrl;
  link.textContent = t("login.returnToBrowser");
  if (proof) {
    link.addEventListener("click", () => copyWalletProof(proof));
  }
  walletList.appendChild(link);

  if (proof) {
    const copyButton = document.createElement("button");
    copyButton.className = "secondary-action";
    copyButton.type = "button";
    copyButton.textContent = t("login.copyLoginProof");
    copyButton.addEventListener("click", () => copyWalletProof(proof));
    walletList.appendChild(copyButton);
  }
  statusLine.textContent = t("login.status.returningToBrowser");
}

function renderContinueInWalletBrowser(walletBrowserUrl) {
  setStep("wallet");
  profileSection.classList.add("hidden");
  readySection.classList.add("hidden");
  walletSection.classList.remove("hidden");
  walletList.replaceChildren();

  const link = document.createElement("a");
  link.className = "primary-action";
  link.href = walletBrowserUrl;
  link.textContent = t("login.continueInWalletBrowser");
  walletList.appendChild(link);
  statusLine.textContent = t("login.status.continuingInWalletBrowser");
}

async function copyWalletProof(proof) {
  const proofText = encodeProofText(proof);
  try {
    await navigator.clipboard.writeText(proofText);
    statusLine.textContent = t("login.status.proofCopied");
  } catch (error) {
    console.warn("Failed to copy NiceChunk wallet proof", error);
    renderManualProofCopy(proofText);
    statusLine.textContent = t("login.status.proofCopyFailed");
  }
}

function renderManualProofCopy(proofText) {
  walletList.querySelector(".proof-copy-box")?.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "proof-copy-box";

  const label = document.createElement("label");
  label.textContent = t("login.manualProofLabel");

  const textarea = document.createElement("textarea");
  textarea.readOnly = true;
  textarea.value = proofText;
  textarea.setAttribute("aria-label", t("login.manualProofLabel"));
  textarea.addEventListener("focus", () => textarea.select());
  textarea.addEventListener("click", () => textarea.select());

  const selectButton = document.createElement("button");
  selectButton.className = "secondary-action";
  selectButton.type = "button";
  selectButton.textContent = t("login.selectLoginProof");
  selectButton.addEventListener("click", () => {
    textarea.focus();
    textarea.select();
    statusLine.textContent = t("login.status.proofSelectReady");
  });

  label.appendChild(textarea);
  wrapper.append(label, selectButton);
  walletList.appendChild(wrapper);
  textarea.focus();
  textarea.select();
}

function showProfile() {
  setStep("profile");
  walletSection.classList.add("hidden");
  readySection.classList.add("hidden");
  profileSection.classList.remove("hidden");
  usernameInput.value = username;
  addressChip.textContent = formatAddress(walletAddress);
  statusLine.textContent = t("login.status.profile");
  usernameInput.focus();
}

function saveUsername() {
  const value = usernameInput.value.trim();
  if (!isValidUsername(value)) {
    statusLine.textContent = t("login.status.invalidUsername");
    usernameInput.focus();
    return;
  }

  username = value;
  persistUsername(username);
  showReady();
}

function showReady() {
  setStep("ready");
  walletSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  readySection.classList.remove("hidden");
  summaryName.textContent = username || "-";
  summaryAddress.textContent = formatAddress(walletAddress);
  statusLine.textContent = t("login.status.ready");
}

function setupHeroVideoLoading() {
  if (!heroVideo) return;
  updateHeroVideoProgress({ stage: "visual", percent: 4, loaded: 0, total: 0 });
  const source = heroVideo.querySelector("source[data-src]");
  const videoSrc = source?.dataset.src;
  const useKeyedLogo = shouldKeyHeroVideo();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (useKeyedLogo) startKeyedHeroVideo();
    updateHeroVideoProgress({ stage: "visualReady", percent: 100 });
    window.setTimeout(() => heroLoadStatus?.classList.add("loaded"), 360);
  };

  if (useKeyedLogo) {
    heroLogoStage?.classList.add("use-keyed-logo");
    heroVideo.crossOrigin = "anonymous";
  }

  heroVideo.addEventListener("loadstart", () => updateHeroVideoProgress({ stage: "visual", percent: 18 }));
  heroVideo.addEventListener("loadedmetadata", () => updateHeroVideoProgress({ stage: "visualDecode", percent: 76 }));
  heroVideo.addEventListener("canplay", finish);
  heroVideo.addEventListener("playing", finish);
  heroVideo.addEventListener("error", () => {
    showHeroPosterFallback();
    updateHeroVideoProgress({ stage: "visualFallback", percent: 100 });
    window.setTimeout(() => heroLoadStatus?.classList.add("loaded"), 700);
  });

  window.setTimeout(() => {
    if (!source || !videoSrc) return;
    source.src = videoSrc;
    source.removeAttribute("data-src");
    heroVideo.src = videoSrc;
    heroVideo.load();
    const playPromise = heroVideo.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => updateHeroVideoProgress({ stage: "visualReady", percent: 78 }));
    }
    window.setTimeout(finish, 1400);
  }, 80);
}

function shouldKeyHeroVideo() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isiPadOS = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isiPadOS;
}

function startKeyedHeroVideo() {
  if (!heroLogoCanvas || !heroVideo || keyedHeroFrameId) return;
  const canvasContext = heroLogoCanvas.getContext("2d", { willReadFrequently: true });
  if (!canvasContext) {
    showHeroPosterFallback();
    return;
  }

  const render = () => {
    if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const frameDrawn = drawKeyedHeroFrame(canvasContext);
      if (!frameDrawn) return;
    }
    keyedHeroFrameId = window.requestAnimationFrame(render);
  };

  render();
}

function drawKeyedHeroFrame(canvasContext) {
  const width = heroVideo.videoWidth || 512;
  const height = heroVideo.videoHeight || 512;
  if (heroLogoCanvas.width !== width) heroLogoCanvas.width = width;
  if (heroLogoCanvas.height !== height) heroLogoCanvas.height = height;

  canvasContext.clearRect(0, 0, width, height);
  canvasContext.drawImage(heroVideo, 0, 0, width, height);

  let frame;
  try {
    frame = canvasContext.getImageData(0, 0, width, height);
  } catch (error) {
    showHeroPosterFallback();
    return false;
  }

  const data = frame.data;
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const magentaStrength = Math.min(red, blue) - green;
    const isPinkKey =
      red > 135 &&
      blue > 120 &&
      green < 150 &&
      magentaStrength > 42 &&
      red - green > 48 &&
      blue - green > 34;

    if (!isPinkKey) continue;

    const alphaCut = Math.max(0, Math.min(1, (magentaStrength - 42) / 88));
    data[index + 3] = Math.round(data[index + 3] * (1 - alphaCut));
  }

  canvasContext.putImageData(frame, 0, 0);
  return true;
}

function showHeroPosterFallback() {
  if (keyedHeroFrameId) {
    window.cancelAnimationFrame(keyedHeroFrameId);
    keyedHeroFrameId = 0;
  }
  heroLogoStage?.classList.remove("use-keyed-logo");
  heroLogoStage?.classList.add("use-poster-logo");
  if (heroLogoFallback) heroLogoFallback.hidden = false;
}

function updateHeroVideoProgress({ stage, percent, loaded = null, total = null }) {
  const progress = Math.max(0, Math.min(100, Math.round(percent)));
  const fallback = loginLoadingFallbacks[stage] ?? loginLoadingFallbacks.visual;
  const titleKey = `login.loading.stages.${stage}.title`;
  const bodyKey = `login.loading.stages.${stage}.body`;
  const title = i18nReady ? t(titleKey) : fallback.title;
  const body = i18nReady ? t(bodyKey) : fallback.body;

  if (heroLoadBar) heroLoadBar.style.width = `${progress}%`;
  if (heroLoadPercent) heroLoadPercent.textContent = `${progress}%`;
  if (heroLoadTitle) heroLoadTitle.textContent = title === titleKey ? fallback.title : title;
  if (heroLoadText) heroLoadText.textContent = body === bodyKey ? fallback.body : body;
  if (heroLoadBytes && loaded !== null) heroLoadBytes.textContent = formatLoadingBytes(loaded, total);
}

function updateGatewayLoading(percent) {
  const progress = walletList.querySelector(".login-progress-card .load-track span");
  if (progress) progress.style.width = `${percent}%`;
  const percentLabel = walletList.querySelector(".login-progress-card .load-meta span:first-child");
  if (percentLabel) percentLabel.textContent = `${Math.round(percent)}%`;
}

function startGameWithLoading() {
  routeLoadingOverlay.hidden = false;
  startButton.disabled = true;
  resetButton.disabled = true;
  updateRouteLoading(10);
  statusLine.textContent = i18nReady ? t("login.loading.route") : loginLoadingFallbacks.route.body;
  const startedAt = performance.now();
  const duration = 900;

  const tick = () => {
    const elapsed = performance.now() - startedAt;
    const progress = Math.min(92, 18 + (elapsed / duration) * 74);
    updateRouteLoading(progress);
    if (elapsed < duration) {
      requestAnimationFrame(tick);
      return;
    }
    updateRouteLoading(100);
    window.location.href = redirectTarget;
  };

  requestAnimationFrame(tick);
}

function updateRouteLoading(percent) {
  const progress = Math.max(0, Math.min(100, Math.round(percent)));
  const fallback = loginLoadingFallbacks.route;
  const titleKey = "login.loading.stages.route.title";
  const bodyKey = "login.loading.stages.route.body";
  const title = i18nReady ? t(titleKey) : fallback.title;
  const body = i18nReady ? t(bodyKey) : fallback.body;

  if (routeLoadBar) routeLoadBar.style.width = `${progress}%`;
  if (routeLoadPercent) routeLoadPercent.textContent = `${progress}%`;
  if (routeLoadTitle) routeLoadTitle.textContent = title === titleKey ? fallback.title : title;
  if (routeLoadBody) routeLoadBody.textContent = body === bodyKey ? fallback.body : body;
  if (routeLoadText) routeLoadText.textContent = i18nReady ? t("login.loading.route") : fallback.title;
  if (routeLoadBytes) routeLoadBytes.textContent = formatLoadingBytesFromPerformance();
}

function formatLoadingBytesFromPerformance() {
  const entries = [
    ...performance.getEntriesByType("navigation"),
    ...performance.getEntriesByType("resource"),
  ];
  let loaded = 0;
  let total = 0;
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.name || seen.has(entry.name)) continue;
    seen.add(entry.name);
    const encoded = Math.max(0, entry.encodedBodySize || 0);
    const transfer = Math.max(0, entry.transferSize || 0);
    const decoded = Math.max(0, entry.decodedBodySize || 0);
    const size = transfer || encoded || decoded;
    if (!size) continue;
    loaded += size;
    total += encoded || size;
  }
  return formatLoadingBytes(loaded, total);
}

function formatLoadingBytes(loaded, total = 0) {
  const formattedLoaded = formatByteSize(loaded);
  if (total > 0 && total >= loaded) {
    const formattedTotal = formatByteSize(total);
    return i18nReady
      ? t("login.loading.bytesKnown", { loaded: formattedLoaded, total: formattedTotal })
      : `Transferred ${formattedLoaded} / ${formattedTotal}`;
  }
  return i18nReady
    ? t("login.loading.bytesUnknown", { loaded: formattedLoaded })
    : `Transferred ${formattedLoaded}`;
}

function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function resetLogin() {
  selectedWallet = null;
  walletAddress = "";
  username = "";
  clearWalletSession();
  walletSection.classList.remove("hidden");
  profileSection.classList.add("hidden");
  readySection.classList.add("hidden");
  initialize();
}

function setStep(name) {
  const progressByStep = {
    wallet: "33.333%",
    profile: "66.666%",
    ready: "100%",
  };
  const stepsTrack = steps[0]?.parentElement;
  if (stepsTrack) stepsTrack.style.setProperty("--flow-progress", progressByStep[name] || progressByStep.wallet);
  steps.forEach((step) => {
    step.classList.toggle("active", step.dataset.step === name);
  });
}

function isValidUsername(value) {
  return /^[\p{Script=Han}A-Za-z0-9_]{3,18}$/u.test(value);
}

function formatAddress(address) {
  if (!address) return "-";
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function drawScene() {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 720;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const shiftX = pointerOffsetX * 18;
  const shiftY = pointerOffsetY * 12;

  ctx.fillStyle = "#162b31";
  ctx.fillRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#153039");
  sky.addColorStop(0.5, "#1a4c52");
  sky.addColorStop(1, "#0d1716");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawMoon(width * 0.74 + shiftX * 0.25, height * 0.18 + shiftY * 0.2, Math.max(48, width * 0.052));
  drawCloud(width * 0.12 + shiftX * 0.35, height * 0.19 + shiftY * 0.35, 1.2);
  drawCloud(width * 0.66 + shiftX * 0.25, height * 0.28 + shiftY * 0.2, 0.88);
  drawCloud(width * 0.42 + shiftX * 0.45, height * 0.12 + shiftY * 0.3, 0.62);

  const horizon = height * 0.64;
  ctx.fillStyle = "#143f44";
  ctx.fillRect(0, horizon, width, height - horizon);

  const distant = Math.max(22, Math.min(40, width / 34));
  for (let row = 0; row < 4; row++) {
    for (let col = -3; col < Math.ceil(width / distant) + 4; col++) {
      const x = col * distant + ((row % 2) * distant) / 2 + shiftX * 0.6;
      const y = horizon - row * distant * 0.28 + Math.sin((col + row) * 0.8) * 3 + shiftY * 0.24;
      drawBlock(x, y, distant, row > 1 ? "forest" : "deep");
    }
  }

  drawTree(width * 0.1 + shiftX * 0.8, horizon - distant * 4.5 + shiftY * 0.35, distant * 0.8);
  drawTree(width * 0.83 + shiftX * 0.7, horizon - distant * 5.2 + shiftY * 0.32, distant * 0.95);

  const block = Math.max(42, Math.min(72, width / 16));
  const baseY = height * 0.76;
  for (let row = 0; row < 7; row++) {
    for (let col = -3; col < Math.ceil(width / block) + 4; col++) {
      const x = col * block + (row % 2) * (block * 0.5) + shiftX;
      const y = baseY - row * block * 0.4 + Math.sin((col + row) * 0.7) * 6 + shiftY * 0.45;
      const type = row > 3 && col % 5 === 0 ? "ore" : row > 4 ? "stone" : "grass";
      drawBlock(x, y, block, type);
    }
  }

  drawTree(width * 0.24 + shiftX, baseY - block * 3.95 + shiftY * 0.5, block * 0.55);
  drawTree(width * 0.68 + shiftX, baseY - block * 4.2 + shiftY * 0.5, block * 0.62);
  drawAvatar(width * 0.5 + shiftX * 1.15, baseY - block * 2.85 + shiftY * 0.55, block * 0.76);
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = "rgba(181, 255, 240, 0.38)";
  const cells = [
    [0, 0, 34, 14],
    [22, -8, 42, 18],
    [58, 0, 32, 14],
    [12, 10, 64, 14],
  ];
  cells.forEach(([cx, cy, cw, ch]) => {
    ctx.fillRect(x + cx * scale, y + cy * scale, cw * scale, ch * scale);
  });
}

function drawMoon(x, y, radius) {
  ctx.fillStyle = "rgba(87, 241, 219, 0.18)";
  ctx.fillRect(Math.round(x - radius), Math.round(y - radius), Math.round(radius * 2), Math.round(radius * 2));
  ctx.fillStyle = "rgba(184, 255, 241, 0.9)";
  ctx.fillRect(Math.round(x - radius * 0.6), Math.round(y - radius * 0.6), Math.round(radius * 1.2), Math.round(radius * 1.2));
}

function drawBlock(x, y, size, type) {
  const palette = {
    grass: ["#2dd4bf", "#158a79", "#0e665c"],
    stone: ["#6a7c78", "#475752", "#303b38"],
    ore: ["#57f1db", "#384d4b", "#263330"],
    forest: ["#1c7063", "#185046", "#123932"],
    deep: ["#16484b", "#123a3d", "#0e2d2f"],
  }[type] || ["#2dd4bf", "#158a79", "#0e665c"];
  const [top, left, side] = palette;

  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y - size * 0.22);
  ctx.lineTo(x + size * 1.72, y + size * 0.18);
  ctx.lineTo(x + size * 0.72, y + size * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size * 0.72, y + size * 0.42);
  ctx.lineTo(x + size * 0.72, y + size);
  ctx.lineTo(x, y + size * 0.58);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.72, y + size * 0.42);
  ctx.lineTo(x + size * 1.72, y + size * 0.18);
  ctx.lineTo(x + size * 1.72, y + size * 0.76);
  ctx.lineTo(x + size * 0.72, y + size);
  ctx.closePath();
  ctx.fill();

  if (type === "ore") {
    ctx.fillStyle = "#b8fff1";
    ctx.fillRect(Math.round(x + size * 0.42), Math.round(y + size * 0.05), Math.max(3, Math.round(size * 0.08)), Math.max(3, Math.round(size * 0.08)));
    ctx.fillRect(Math.round(x + size * 1.03), Math.round(y + size * 0.28), Math.max(3, Math.round(size * 0.07)), Math.max(3, Math.round(size * 0.07)));
  }
}

function drawTree(x, y, unit) {
  rect(x - unit * 0.2, y + unit * 1.35, unit * 0.4, unit * 1.9, "#5a3926");
  rect(x - unit * 0.34, y + unit * 1.35, unit * 0.18, unit * 1.9, "#3d2619");
  rect(x - unit * 1.1, y + unit * 0.6, unit * 2.2, unit * 0.95, "#127563");
  rect(x - unit * 0.85, y - unit * 0.08, unit * 1.7, unit * 0.9, "#18a08a");
  rect(x - unit * 0.55, y - unit * 0.62, unit * 1.1, unit * 0.74, "#2dd4bf");
  rect(x - unit * 0.18, y - unit * 0.3, unit * 0.36, unit * 0.32, "#b8fff1");
}

function drawAvatar(x, y, unit) {
  rect(x - unit * 0.42, y + unit * 1.2, unit * 0.84, unit * 1.14, "#2e8b86");
  rect(x - unit * 0.25, y + unit * 1.24, unit * 0.5, unit * 0.72, "#58b6a8");
  rect(x - unit * 0.43, y + unit * 2.27, unit * 0.9, unit * 0.13, "#4d3424");
  rect(x - unit * 0.08, y + unit * 2.23, unit * 0.16, unit * 0.16, "#d6a84a");
  rect(x - unit * 0.43, y + unit * 0.08, unit * 0.86, unit * 0.86, "#c99061");
  rect(x - unit * 0.47, y - unit * 0.05, unit * 0.94, unit * 0.28, "#3f2918");
  rect(x - unit * 0.64, y + unit * 1.15, unit * 0.34, unit * 0.5, "#216966");
  rect(x + unit * 0.3, y + unit * 1.15, unit * 0.34, unit * 0.5, "#216966");
  rect(x - unit * 0.62, y + unit * 1.65, unit * 0.32, unit * 0.42, "#c99061");
  rect(x + unit * 0.3, y + unit * 1.65, unit * 0.32, unit * 0.42, "#c99061");
  rect(x - unit * 0.23, y + unit * 2.35, unit * 0.36, unit * 0.76, "#294a7c");
  rect(x + unit * 0.03, y + unit * 2.35, unit * 0.36, unit * 0.76, "#294a7c");
  rect(x - unit * 0.25, y + unit * 3.03, unit * 0.4, unit * 0.42, "#2b2520");
  rect(x + unit * 0.05, y + unit * 3.03, unit * 0.4, unit * 0.42, "#2b2520");
  rect(x + unit * 0.42, y + unit * 1.28, unit * 0.35, unit * 0.78, "#4d3424");
}

function rect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function updateBackdropOffset(event) {
  pointerOffsetX = (window.innerWidth / 2 - event.clientX) / Math.max(window.innerWidth, 1);
  pointerOffsetY = (window.innerHeight / 2 - event.clientY) / Math.max(window.innerHeight, 1);
  drawScene();
}
