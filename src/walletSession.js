export const walletSessionKeys = {
  walletAddress: "nicechunk.walletAddress",
  username: "nicechunk.username",
  walletName: "nicechunk.walletName",
  walletBoundAt: "nicechunk.walletBoundAt",
};

export function getWalletSession() {
  return {
    walletAddress: localStorage.getItem(walletSessionKeys.walletAddress) || "",
    username: localStorage.getItem(walletSessionKeys.username) || "",
    walletName: localStorage.getItem(walletSessionKeys.walletName) || "",
    walletBoundAt: localStorage.getItem(walletSessionKeys.walletBoundAt) || "",
  };
}

export function hasBoundWallet(session = getWalletSession()) {
  return Boolean(session.walletAddress && session.walletBoundAt);
}

export function isGameWalletSessionReady(session = getWalletSession()) {
  return Boolean(hasBoundWallet(session) && session.username);
}

export function persistConnectedWallet({ walletAddress, walletName = "" }) {
  if (!walletAddress) return;
  localStorage.setItem(walletSessionKeys.walletAddress, walletAddress);
  localStorage.setItem(walletSessionKeys.walletBoundAt, String(Date.now()));
  if (walletName) localStorage.setItem(walletSessionKeys.walletName, walletName);
}

export function persistUsername(username) {
  if (!username) return;
  localStorage.setItem(walletSessionKeys.username, username);
}

export function clearWalletConnection() {
  localStorage.removeItem(walletSessionKeys.walletAddress);
  localStorage.removeItem(walletSessionKeys.walletName);
  localStorage.removeItem(walletSessionKeys.walletBoundAt);
}

export function clearWalletSession() {
  clearWalletConnection();
  localStorage.removeItem(walletSessionKeys.username);
}

export function buildWalletLoginUrl({ redirectPath = currentRedirectPath(), autoConnect = false } = {}) {
  const loginUrl = new URL("/login/", window.location.origin);
  loginUrl.searchParams.set("redirect", safeRedirectTarget(redirectPath) || "/play/");
  if (autoConnect) loginUrl.searchParams.set("autoConnect", "1");
  return loginUrl;
}

export function redirectToWalletLogin(options = {}) {
  window.location.replace(buildWalletLoginUrl(options));
}

export function safeRedirectTarget(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function currentRedirectPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/play/";
}

export function detectWalletProviders() {
  const providers = [
    window.phantom?.solana,
    window.solflare,
    window.backpack?.solana,
    window.solana,
  ].filter(Boolean);

  return Array.from(new Set(providers)).filter((provider) => {
    return typeof provider.connect === "function" || typeof provider.on === "function";
  });
}

export function watchWalletSession(onInvalidSession) {
  const providers = detectWalletProviders();
  const cleanup = [];

  const invalidate = () => {
    clearWalletConnection();
    onInvalidSession();
  };

  const handleAccountChanged = (publicKey) => {
    const nextAddress = publicKeyToString(publicKey);
    const currentAddress = getWalletSession().walletAddress;
    if (!nextAddress || nextAddress !== currentAddress) invalidate();
  };

  providers.forEach((provider) => {
    addProviderListener(provider, "disconnect", invalidate, cleanup);
    addProviderListener(provider, "accountChanged", handleAccountChanged, cleanup);
    addProviderListener(provider, "accountsChanged", (accounts) => {
      const account = Array.isArray(accounts) ? accounts[0] : accounts;
      handleAccountChanged(account);
    }, cleanup);
  });

  window.addEventListener("storage", handleStorageChange);
  cleanup.push(() => window.removeEventListener("storage", handleStorageChange));

  function handleStorageChange(event) {
    if (Object.values(walletSessionKeys).includes(event.key) && !isGameWalletSessionReady()) {
      onInvalidSession();
    }
  }

  return () => cleanup.forEach((remove) => remove());
}

function addProviderListener(provider, eventName, listener, cleanup) {
  if (typeof provider.on !== "function") return;
  provider.on(eventName, listener);
  cleanup.push(() => {
    if (typeof provider.off === "function") {
      provider.off(eventName, listener);
      return;
    }
    if (typeof provider.removeListener === "function") {
      provider.removeListener(eventName, listener);
    }
  });
}

function publicKeyToString(publicKey) {
  if (!publicKey) return "";
  if (typeof publicKey === "string") return publicKey;
  if (typeof publicKey.toString === "function") return publicKey.toString();
  if (publicKey.publicKey && typeof publicKey.publicKey.toString === "function") {
    return publicKey.publicKey.toString();
  }
  return "";
}
