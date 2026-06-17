const gameSessionKeys = {
  walletAddress: "nicechunk.walletAddress",
  username: "nicechunk.username",
  walletBoundAt: "nicechunk.walletBoundAt",
};

export function getGameSession() {
  return {
    walletAddress: localStorage.getItem(gameSessionKeys.walletAddress) || "",
    username: localStorage.getItem(gameSessionKeys.username) || "",
    walletBoundAt: localStorage.getItem(gameSessionKeys.walletBoundAt) || "",
  };
}

export function isGameSessionReady(session = getGameSession()) {
  return Boolean(session.walletAddress && session.walletBoundAt && session.username);
}

export function currentGameRedirectPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/play/";
}

export function redirectToGameLogin({ redirectPath = currentGameRedirectPath(), autoConnect = true } = {}) {
  const loginUrl = new URL("/login/", window.location.origin);
  loginUrl.searchParams.set("redirect", safeRedirectPath(redirectPath) || "/play/");
  if (autoConnect) loginUrl.searchParams.set("autoConnect", "1");
  window.location.replace(loginUrl);
}

export function redirectIfGameSessionMissing() {
  if (!isGameSessionReady()) {
    redirectToGameLogin();
    return true;
  }
  return false;
}

export function isGameSessionStorageKey(key) {
  return Object.values(gameSessionKeys).includes(key);
}

function safeRedirectPath(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
