import {
  DEFAULT_SEARCH_CONFIG,
  cuboidsToVoxelSet,
  dnaSeedFromSearchIndex,
  encodeGene,
  estimateGeneSize,
  estimateRawSize,
  geneFromDnaSeed,
  growGene,
  hashModel,
  inferHumanoidSearchRanges,
  mutateGene,
  normalizeGene,
  randomNcmAvatarGeneFromSeed,
  scoreModelMatch,
  xorshift32,
  hashSeed,
} from "./ncmDnaEngine.js";

let stopped = false;
let paused = false;

self.addEventListener("message", (event) => {
  const { type } = event.data ?? {};
  if (type === "start") {
    stopped = false;
    paused = false;
    void runSearch(event.data.payload);
  } else if (type === "stop") {
    stopped = true;
    paused = false;
  } else if (type === "pause") {
    paused = true;
  } else if (type === "resume") {
    paused = false;
  }
});

async function runSearch(payload) {
  const config = { ...DEFAULT_SEARCH_CONFIG, ...(payload?.config ?? {}) };
  const targetModel = payload.targetModel ?? [];
  const targetHash = payload.targetHash || hashModel(targetModel);
  const rawSize = estimateRawSize(targetModel);
  const startedAt = performance.now();
  const state = {
    targetModel,
    targetHash,
    rawSize,
    config,
    startedAt,
    tested: 0,
    generation: 0,
    bestScore: -1,
    bestGene: null,
    bestGeneCode: "",
    bestHash: "",
    bestSeedCode: "",
    bestModel: [],
    recentSeedCodes: [],
    targetVoxelSet: cuboidsToVoxelSet(targetModel),
  };

  self.postMessage({ type: "status", payload: { status: "running" } });
  try {
    if (config.mode === "ncm-random") {
      await searchNcmAvatarRandom(state);
    } else if (config.mode === "seed-search") {
      await searchSeedSpace(state);
    } else if (config.mode === "evolution") {
      await searchEvolution(state);
    } else {
      await searchCandidateRanges(state);
    }
    if (!stopped) self.postMessage({ type: "done", payload: progressPayload(state, "stopped") });
  } catch (error) {
    self.postMessage({ type: "error", payload: { message: error?.message ?? String(error) } });
  }
}

async function searchSeedSpace(state) {
  const workerIndex = Number(state.config.workerIndex) || 0;
  const workerCount = Math.max(1, Number(state.config.workerCount) || 1);
  const continuous = Boolean(state.config.continuous);
  const maxCandidates = continuous ? Number.POSITIVE_INFINITY : Math.max(1, Number(state.config.maxCandidates) || DEFAULT_SEARCH_CONFIG.maxCandidates);
  const species = state.config.seedSpecies === "humanoid" ? "humanoid" : "ncmAvatar";
  const maxLength = Math.max(9, Number(state.config.maxSeedLength) || DEFAULT_SEARCH_CONFIG.maxSeedLength);
  const salt = `${state.targetHash}:seed-search:${state.config.randomSalt ?? ""}`;

  while (!stopped && state.tested < maxCandidates) {
    await waitWhilePaused();
    state.generation += 1;
    const batchSize = 256;
    for (let index = 0; index < batchSize && !stopped && state.tested < maxCandidates; index += 1) {
      const seedIndex = state.tested * workerCount + workerIndex;
      const seedCode = dnaSeedFromSearchIndex(seedIndex, { species, salt, maxLength });
      pushRecentSeedCode(state, seedCode, seedIndex);
      const gene = geneFromDnaSeed(seedCode, { species, ornaments: true });
      const shouldStop = await testGene(state, gene, { seedCode });
      if (shouldStop && !continuous) return;
    }
  }
}

async function searchNcmAvatarRandom(state) {
  const workerIndex = Number(state.config.workerIndex) || 0;
  const seed = hashSeed(`${state.targetHash}:ncm-avatar:${workerIndex}:${state.config.randomSalt ?? ""}`);
  const rng = xorshift32(seed);
  const continuous = Boolean(state.config.continuous);
  const maxCandidates = continuous ? Number.POSITIVE_INFINITY : Math.max(1, Number(state.config.maxCandidates) || DEFAULT_SEARCH_CONFIG.maxCandidates);
  let localBest = randomNcmAvatarGeneFromSeed(`${state.targetHash}:seed:${workerIndex}`);

  while (!stopped && state.tested < maxCandidates) {
    await waitWhilePaused();
    state.generation += 1;
    const batchSize = 192;
    for (let index = 0; index < batchSize && !stopped && state.tested < maxCandidates; index += 1) {
      const explore = !state.bestGene || rng() < 0.28;
      const gene = explore ? randomAvatarGene(rng) : mutateGene(localBest, Math.floor(rng() * 0xffffffff));
      const shouldStop = await testGene(state, normalizeGene({ ...gene, species: "ncmAvatar" }));
      if (state.bestGene) localBest = state.bestGene;
      if (shouldStop && !continuous) return;
    }
  }
}

async function searchCandidateRanges(state) {
  const ranges = inferHumanoidSearchRanges(state.targetModel);
  const fields = ["bodyWidth", "bodyDepth", "bodyHeight", "headSize", "armLength", "armThickness", "legLength", "legThickness", "materialSet", "flags", "ornamentSeed"];
  const candidate = { version: 1, species: "humanoid", symmetry: "mirror_x" };
  const maxCandidates = Math.max(1, Number(state.config.maxCandidates) || DEFAULT_SEARCH_CONFIG.maxCandidates);

  async function visit(index) {
    if (stopped || state.tested >= maxCandidates) return true;
    await waitWhilePaused();
    if (index >= fields.length) {
      return testGene(state, normalizeGene(candidate));
    }
    const field = fields[index];
    for (const value of ranges[field] ?? [0]) {
      candidate[field] = value;
      const shouldStop = await visit(index + 1);
      if (shouldStop) return true;
    }
    return false;
  }

  await visit(0);
}

async function searchEvolution(state) {
  const ranges = inferHumanoidSearchRanges(state.targetModel);
  const seed = hashSeed(`${state.targetHash}:evolution`);
  const rng = xorshift32(seed);
  const centerGene = normalizeGene({
    bodyWidth: middle(ranges.bodyWidth),
    bodyDepth: middle(ranges.bodyDepth),
    bodyHeight: middle(ranges.bodyHeight),
    headSize: middle(ranges.headSize),
    armLength: middle(ranges.armLength),
    armThickness: middle(ranges.armThickness),
    legLength: middle(ranges.legLength),
    legThickness: middle(ranges.legThickness),
    materialSet: middle(ranges.materialSet),
    flags: middle(ranges.flags),
    ornamentSeed: 0,
  });
  const populationSize = 64;
  const eliteCount = 4;
  let population = [centerGene];
  while (population.length < populationSize) population.push(mutateGene(centerGene, Math.floor(rng() * 0xffffffff)));

  while (!stopped && state.tested < state.config.maxCandidates) {
    await waitWhilePaused();
    state.generation += 1;
    const scored = [];
    for (const gene of population) {
      const shouldStop = await testGene(state, gene);
      scored.push({ gene, score: state.bestGene === gene ? state.bestScore : scoreGene(gene, state) });
      if (shouldStop) return;
      if (stopped || state.tested >= state.config.maxCandidates) break;
    }
    scored.sort((a, b) => b.score - a.score);
    const elites = scored.slice(0, eliteCount).map((item) => item.gene);
    population = [...elites];
    while (population.length < populationSize) {
      const parent = elites[Math.floor(rng() * elites.length)] ?? centerGene;
      population.push(mutateGene(parent, Math.floor(rng() * 0xffffffff)));
    }
  }
}

async function testGene(state, gene, options = {}) {
  state.tested += 1;
  const model = growGene(gene);
  const hash = hashModel(model);
  const code = encodeGene(gene);
  const score = hash === state.targetHash ? 1 : scoreGene(gene, state, model);
  const geneSize = estimateGeneSize(code);
  const bestGeneSize = state.bestGeneCode ? estimateGeneSize(state.bestGeneCode) : Infinity;
  const isBetter = score > state.bestScore || (score === state.bestScore && geneSize < bestGeneSize);

  if (isBetter) {
    state.bestScore = score;
    state.bestGene = gene;
    state.bestGeneCode = code;
    state.bestHash = hash;
    state.bestModel = model;
    state.bestSeedCode = Object.hasOwn(options, "seedCode") ? options.seedCode : "";
    self.postMessage({ type: "best", payload: progressPayload(state, "running") });
  }

  if (state.tested % state.config.reportEvery === 0) {
    self.postMessage({ type: "progress", payload: progressPayload(state, "running") });
    await sleep(0);
  }

  if (hash === state.targetHash) {
    self.postMessage({ type: "success", payload: progressPayload(state, "success") });
    if (!state.config.continuous) {
      stopped = true;
      return true;
    }
  }
  return stopped;
}

function scoreGene(gene, state, model = null) {
  const generated = model ?? growGene(gene);
  const match = state.targetVoxelSet ? scoreAgainstTargetSet(generated, state.targetVoxelSet) : scoreModelMatch(generated, state.targetModel);
  const penalty = gene.species === "ncmAvatar" ? 0 : estimateGeneSize(encodeGene(gene)) * 0.0004;
  return Math.max(0, match - penalty);
}

function scoreAgainstTargetSet(generated, targetSet) {
  const generatedSet = cuboidsToVoxelSet(generated);
  if (!generatedSet.size && !targetSet.size) return 1;
  let intersection = 0;
  for (const key of generatedSet) {
    if (targetSet.has(key)) intersection += 1;
  }
  return intersection / (generatedSet.size + targetSet.size - intersection || 1);
}

function randomAvatarGene(rng) {
  return normalizeGene({
    species: "ncmAvatar",
    bodyWidth: randomInt(rng, 4, 7),
    bodyDepth: randomInt(rng, 2, 4),
    bodyHeight: randomInt(rng, 8, 12),
    headSize: randomInt(rng, 5, 7),
    armLength: randomInt(rng, 8, 13),
    armThickness: randomInt(rng, 1, 2),
    legLength: randomInt(rng, 6, 10),
    legThickness: randomInt(rng, 1, 2),
    materialSet: randomInt(rng, 0, 3),
    ornamentSeed: Math.floor(rng() * 65536),
    flags: Math.floor(rng() * 256),
  });
}

function progressPayload(state, status) {
  const elapsedMs = Math.max(1, performance.now() - state.startedAt);
  const geneSize = state.bestGeneCode ? estimateGeneSize(state.bestGeneCode) : 0;
  return {
    status,
    candidatesTested: state.tested,
    candidatesPerSecond: Math.round((state.tested / elapsedMs) * 1000),
    generationCount: state.generation,
    bestGene: state.bestGene,
    bestGeneCode: state.bestGeneCode,
    bestGeneSize: geneSize,
    rawModelSize: state.rawSize,
    compressionRatio: geneSize ? state.rawSize / geneSize : 0,
    bytesSaved: geneSize ? Math.max(0, state.rawSize - geneSize) : 0,
    bestMatchScore: Math.max(0, state.bestScore),
    targetHash: state.targetHash,
    bestHash: state.bestHash,
    bestSeedCode: state.bestSeedCode ?? "",
    recentSeedCodes: state.recentSeedCodes,
    exactMatch: state.bestHash === state.targetHash,
    continuous: Boolean(state.config.continuous),
    elapsedMs,
    bestModel: state.bestModel,
  };
}

function pushRecentSeedCode(state, seedCode, seedIndex) {
  state.recentSeedCodes.push(`#${seedIndex + 1} ${seedCode}`);
  if (state.recentSeedCodes.length > 20) state.recentSeedCodes.splice(0, state.recentSeedCodes.length - 20);
}

async function waitWhilePaused() {
  while (paused && !stopped) {
    self.postMessage({ type: "status", payload: { status: "paused" } });
    await sleep(80);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function middle(values) {
  return values[Math.floor(values.length / 2)] ?? values[0] ?? 0;
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
