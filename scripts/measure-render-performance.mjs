import { chromium } from "playwright";

const defaultUrl = "https://nicechunk.com/play/";
const defaultSamples = [0, 500, 1000, 2500, 5000, 8000, 12000];

const url = process.env.NICECHUNK_RENDER_URL || defaultUrl;
const samplesMs = parseSamples(process.env.NICECHUNK_RENDER_SAMPLES_MS) ?? defaultSamples;
const viewport = {
  width: readIntegerEnv("NICECHUNK_RENDER_WIDTH", 1280),
  height: readIntegerEnv("NICECHUNK_RENDER_HEIGHT", 800),
};
const profileMs = readIntegerEnv("NICECHUNK_RENDER_PROFILE_MS", 0);
const runMovement = readBooleanEnv("NICECHUNK_RENDER_MOVEMENT", false);
const headless = readBooleanEnv("NICECHUNK_RENDER_HEADLESS", true);

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const errors = [];
let cdp = null;

page.on("pageerror", (error) => errors.push(String(error.stack || error.message || error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.addInitScript(() => {
    window.NiceChunkDebugRenderEnabled = true;
    window.__nicechunkPerf = { longTasks: [] };
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__nicechunkPerf.longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          });
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      window.__nicechunkPerf.longTaskObserverUnavailable = true;
    }
    localStorage.setItem("nicechunk.walletAddress", "11111111111111111111111111111111");
    localStorage.setItem("nicechunk.username", "Render Perf Study");
    localStorage.setItem("nicechunk.walletBoundAt", String(Date.now()));
  });

  if (profileMs > 0) {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
  }

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForPlayPage(page);

  let profile = null;
  if (profileMs > 0) {
    await cdp.send("Profiler.start");
  }

  const samples = await collectSamples(page, samplesMs);

  if (profileMs > 0) {
    const remaining = Math.max(0, profileMs - samplesMs[samplesMs.length - 1]);
    if (remaining > 0) await page.waitForTimeout(remaining);
    profile = (await cdp.send("Profiler.stop")).profile;
  }

  const movement = runMovement ? await collectMovementCheck(page) : null;

  console.log(JSON.stringify({
    url,
    viewport,
    samples,
    movement,
    profile: profile ? aggregateProfile(profile) : null,
    errors,
  }, null, 2));
} finally {
  await browser.close();
}

async function waitForPlayPage(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    const rect = canvas?.getBoundingClientRect();
    const overlay = document.querySelector("#gameLoadingOverlay");
    return canvas &&
      rect?.width >= 1000 &&
      rect?.height >= 600 &&
      overlay &&
      (
        overlay.classList.contains("loaded") ||
        getComputedStyle(overlay).opacity < 0.1 ||
        getComputedStyle(overlay).visibility === "hidden"
      );
  }, { timeout: 120000 });
}

async function collectSamples(page, sampleTimes) {
  const samples = [];
  for (const ms of sampleTimes) {
    if (ms && samples.length) {
      await page.waitForTimeout(Math.max(0, ms - samples[samples.length - 1].ms));
    }
    samples.push(await collectSample(page, ms));
  }
  return samples;
}

async function collectSample(page, ms) {
  return page.evaluate((sampleMs) => {
    const longTasks = window.__nicechunkPerf?.longTasks ?? [];
    return {
      ms: sampleMs,
      render: window.NiceChunkDebugRender || null,
      chunks: document.querySelector("#chunks")?.textContent || "",
      fps: document.querySelector("#fps")?.textContent || "",
      position: document.querySelector("#position")?.textContent || "",
      longTaskCount: longTasks.length,
      longTaskTotalMs: Math.round(longTasks.reduce((sum, item) => sum + item.duration, 0)),
      longTaskMaxMs: Math.round(Math.max(0, ...longTasks.map((item) => item.duration))),
      scripts: [...document.scripts].map((script) => script.src).filter((src) => src.includes("/assets/play-")).slice(-1),
    };
  }, ms);
}

async function collectMovementCheck(page) {
  const canvas = await page.$("#game");
  if (!canvas) return { skipped: true, reason: "canvas-unavailable" };

  await canvas.click({ position: { x: Math.floor(viewport.width / 2), y: Math.floor(viewport.height / 2) } });
  const before = parsePosition(await page.textContent("#position"));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(850);
  const afterW = parsePosition(await page.textContent("#position"));
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(850);
  const afterWA = parsePosition(await page.textContent("#position"));
  await page.keyboard.up("KeyA");
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(850);
  const afterWD = parsePosition(await page.textContent("#position"));
  await page.keyboard.up("KeyW");
  await page.keyboard.up("KeyD");

  return {
    movedForward: distance2d(before, afterW) > 0.2,
    movedWithA: distance2d(afterW, afterWA) > 0.2,
    movedWithD: distance2d(afterWA, afterWD) > 0.2,
    before,
    afterW,
    afterWA,
    afterWD,
  };
}

function aggregateProfile(profile) {
  const idToNode = new Map(profile.nodes.map((node) => [node.id, node]));
  const counts = new Map();
  for (const id of profile.samples ?? []) {
    const node = idToNode.get(id);
    if (!node) continue;
    const fn = node.callFrame.functionName || "(anonymous)";
    const source = sourceLabel(node.callFrame.url);
    const line = node.callFrame.lineNumber + 1;
    const key = `${fn} @ ${source}:${line}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([name, samples]) => ({ name, samples }));
}

function sourceLabel(url) {
  if (!url) return "inline";
  const srcIndex = url.indexOf("/src/");
  if (srcIndex >= 0) return url.slice(srcIndex + 1).split("?")[0];
  return url.split("/").pop().split("?")[0] || "inline";
}

function parsePosition(text) {
  const match = String(text || "").match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  return match ? { x: Number(match[1]), z: Number(match[2]) } : null;
}

function distance2d(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
}

function parseSamples(raw) {
  if (!raw) return null;
  const samples = raw.split(",").map((item) => Number(item.trim()));
  if (!samples.length || samples.some((item) => !Number.isFinite(item) || item < 0)) {
    throw new Error("NICECHUNK_RENDER_SAMPLES_MS must be a comma-separated list of non-negative numbers");
  }
  return samples.sort((a, b) => a - b);
}

function readIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function readBooleanEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  throw new Error(`${name} must be true, false, 1, or 0`);
}
