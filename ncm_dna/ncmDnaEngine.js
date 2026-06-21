import { byteLength, hashString } from "./ncmDnaHash.js";

export const DEFAULT_SEARCH_CONFIG = {
  mode: "exact",
  maxCandidates: 1_000_000,
  reportEvery: 1000,
  threads: "auto",
  gridSize: 32,
  maxCuboids: 128,
  maxVoxels: 4096,
  maxSeedLength: 16,
  exactHashRequired: true,
};

export const HUMANOID_LIMITS = {
  bodyWidth: [4, 10],
  bodyDepth: [3, 8],
  bodyHeight: [8, 16],
  headSize: [4, 9],
  armLength: [6, 16],
  armThickness: [1, 4],
  legLength: [6, 16],
  legThickness: [1, 4],
  materialSet: [0, 15],
};

export const NCM_AVATAR_SAMPLE_URL = "/media/vox/chr_peasant_girl_orangehair.ncm";
export const NCM_AVATAR_PALETTE = [
  "#111111",
  "#222222",
  "#33a6b8",
  "#577c8a",
  "#656765",
  "#bdc0ba",
  "#c1693c",
  "#e1a679",
  "#e3916e",
  "#fffffb",
];

const base62Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const dnaSeedPrefix = "NCS1";
const speciesMap = { humanoid: 1, ncmAvatar: 2 };
const speciesById = new Map(Object.entries(speciesMap).map(([key, value]) => [value, key]));
const fieldLayout = [
  ["species", 4],
  ["bodyWidth", 4],
  ["bodyDepth", 4],
  ["bodyHeight", 5],
  ["headSize", 4],
  ["armLength", 5],
  ["armThickness", 3],
  ["legLength", 5],
  ["legThickness", 3],
  ["materialSet", 5],
  ["ornamentSeed", 16],
  ["flags", 8],
];

export function normalizeGene(gene) {
  const species = gene.species === "ncmAvatar" ? "ncmAvatar" : "humanoid";
  const normalized = {
    version: 1,
    species,
    bodyWidth: clampInteger(gene.bodyWidth, ...HUMANOID_LIMITS.bodyWidth),
    bodyDepth: clampInteger(gene.bodyDepth, ...HUMANOID_LIMITS.bodyDepth),
    bodyHeight: clampInteger(gene.bodyHeight, ...HUMANOID_LIMITS.bodyHeight),
    headSize: clampInteger(gene.headSize, ...HUMANOID_LIMITS.headSize),
    armLength: clampInteger(gene.armLength, ...HUMANOID_LIMITS.armLength),
    armThickness: clampInteger(gene.armThickness, ...HUMANOID_LIMITS.armThickness),
    legLength: clampInteger(gene.legLength, ...HUMANOID_LIMITS.legLength),
    legThickness: clampInteger(gene.legThickness, ...HUMANOID_LIMITS.legThickness),
    materialSet: clampInteger(gene.materialSet, ...HUMANOID_LIMITS.materialSet),
    ornamentSeed: clampInteger(gene.ornamentSeed ?? 0, 0, 65535),
    flags: clampInteger(gene.flags ?? 0, 0, 255),
  };
  normalized.height = normalized.legLength + normalized.bodyHeight + normalized.headSize;
  normalized.symmetry = "mirror_x";
  return normalized;
}

export function encodeGene(gene) {
  const normalized = normalizeGene(gene);
  let packed = 0n;
  let shift = 0n;
  for (const [field, bits] of fieldLayout) {
    const mask = (1n << BigInt(bits)) - 1n;
    const value = field === "species" ? speciesMap[normalized.species] : normalized[field];
    packed |= (BigInt(value) & mask) << shift;
    shift += BigInt(bits);
  }
  return `NCD1.${normalized.species === "ncmAvatar" ? "AV" : "HM"}.${toBase62(packed)}`;
}

export function decodeGene(code) {
  const [, , payload = "0"] = String(code || "").split(".");
  let packed = fromBase62(payload);
  const gene = { version: 1 };
  for (const [field, bits] of fieldLayout) {
    const mask = (1n << BigInt(bits)) - 1n;
    const raw = Number(packed & mask);
    packed >>= BigInt(bits);
    gene[field] = field === "species" ? (speciesById.get(raw) ?? "humanoid") : raw;
  }
  return normalizeGene(gene);
}

export function randomGeneFromSeed(seed, { ornaments = false } = {}) {
  const rng = xorshift32(hashSeed(seed || "nicechunk-dna"));
  const gene = normalizeGene({
    bodyWidth: pickRange(rng, 4, 9),
    bodyDepth: pickRange(rng, 3, 7),
    bodyHeight: pickRange(rng, 8, 14),
    headSize: pickRange(rng, 4, 8),
    armLength: pickRange(rng, 6, 14),
    armThickness: pickRange(rng, 1, 3),
    legLength: pickRange(rng, 6, 14),
    legThickness: pickRange(rng, 1, 3),
    materialSet: pickRange(rng, 0, 7),
    ornamentSeed: Math.floor(rng() * 65536),
    flags: ornaments ? Math.floor(rng() * 48) : 0,
  });
  return normalizeGene({
    ...gene,
    armLength: Math.min(gene.armLength, gene.bodyHeight + gene.legLength),
  });
}

export function mutateGene(gene, seed) {
  const rng = xorshift32(seed || 1);
  const fields = ["bodyWidth", "bodyDepth", "bodyHeight", "headSize", "armLength", "armThickness", "legLength", "legThickness", "materialSet"];
  const next = { ...normalizeGene(gene) };
  const field = fields[Math.floor(rng() * fields.length)];
  const delta = rng() < 0.5 ? -1 : 1;
  const limit = HUMANOID_LIMITS[field];
  next[field] = clampInteger(next[field] + delta, limit[0], limit[1]);
  if (rng() < 0.18) next.flags = clampInteger(next.flags ^ (1 << Math.floor(rng() * 6)), 0, 255);
  if (rng() < 0.18) next.ornamentSeed = Math.floor(rng() * 65536);
  return normalizeGene(next);
}

export function growGene(gene) {
  const normalized = normalizeGene(gene);
  if (normalized.species === "ncmAvatar") return growNcmAvatarGene(normalized);
  if (normalized.species !== "humanoid") return [];
  return growHumanoidGene(normalized);
}

export function growHumanoidGene(gene) {
  const g = normalizeGene(gene);
  const centerX = 16;
  const centerZ = 16;
  const materialBase = g.materialSet * 10;
  const legY = 0;
  const bodyY = g.legLength;
  const headY = bodyY + g.bodyHeight;
  const bodyX = centerX - Math.floor(g.bodyWidth / 2);
  const bodyZ = centerZ - Math.floor(g.bodyDepth / 2);
  const headX = centerX - Math.floor(g.headSize / 2);
  const headZ = centerZ - Math.floor(g.headSize / 2);
  const cuboids = [
    cuboid("leftLeg", centerX - g.legThickness - 1, legY, bodyZ, g.legThickness, g.legLength, g.bodyDepth, materialBase + 4),
    cuboid("rightLeg", centerX + 1, legY, bodyZ, g.legThickness, g.legLength, g.bodyDepth, materialBase + 4),
    cuboid("body", bodyX, bodyY, bodyZ, g.bodyWidth, g.bodyHeight, g.bodyDepth, materialBase + 2),
    cuboid("leftArm", bodyX - g.armThickness, bodyY + g.bodyHeight - g.armLength, bodyZ, g.armThickness, g.armLength, g.bodyDepth, materialBase + 3),
    cuboid("rightArm", bodyX + g.bodyWidth, bodyY + g.bodyHeight - g.armLength, bodyZ, g.armThickness, g.armLength, g.bodyDepth, materialBase + 3),
    cuboid("head", headX, headY, headZ, g.headSize, g.headSize, g.headSize, materialBase + 1),
  ];

  if (g.flags & 1) {
    const eyeY = headY + Math.max(1, Math.floor(g.headSize * 0.58));
    cuboids.push(cuboid("leftEye", centerX - 2, eyeY, headZ + g.headSize, 1, 1, 1, 90));
    cuboids.push(cuboid("rightEye", centerX + 1, eyeY, headZ + g.headSize, 1, 1, 1, 90));
  }
  if (g.flags & 2) {
    cuboids.push(cuboid("leftShoulder", bodyX - 1, bodyY + g.bodyHeight - 2, bodyZ, 1, 2, g.bodyDepth, materialBase + 5));
    cuboids.push(cuboid("rightShoulder", bodyX + g.bodyWidth, bodyY + g.bodyHeight - 2, bodyZ, 1, 2, g.bodyDepth, materialBase + 5));
  }
  if (g.flags & 4) cuboids.push(cuboid("chestPlate", centerX - 1, bodyY + Math.floor(g.bodyHeight / 2), bodyZ + g.bodyDepth, 2, 3, 1, materialBase + 6));
  if (g.flags & 8) cuboids.push(cuboid("backBlock", centerX - 1, bodyY + Math.floor(g.bodyHeight / 2), bodyZ - 1, 2, 3, 1, materialBase + 7));
  if (g.flags & 16) {
    cuboids.push(cuboid("leftFoot", centerX - g.legThickness - 1, 0, bodyZ, g.legThickness, 1, g.bodyDepth + 1, materialBase + 8));
    cuboids.push(cuboid("rightFoot", centerX + 1, 0, bodyZ, g.legThickness, 1, g.bodyDepth + 1, materialBase + 8));
  }
  if (g.flags & 32) cuboids.push(cuboid("helmet", headX - 1, headY + g.headSize - 1, headZ - 1, g.headSize + 2, 1, g.headSize + 2, materialBase + 9));

  return canonicalize(cuboids);
}

export function randomNcmAvatarGeneFromSeed(seed) {
  const rng = xorshift32(hashSeed(seed || "ncm-avatar-dna"));
  return normalizeGene({
    species: "ncmAvatar",
    bodyWidth: pickRange(rng, 4, 7),
    bodyDepth: pickRange(rng, 2, 4),
    bodyHeight: pickRange(rng, 8, 12),
    headSize: pickRange(rng, 5, 7),
    armLength: pickRange(rng, 8, 13),
    armThickness: pickRange(rng, 1, 2),
    legLength: pickRange(rng, 6, 10),
    legThickness: pickRange(rng, 1, 2),
    materialSet: pickRange(rng, 0, 3),
    ornamentSeed: Math.floor(rng() * 65536),
    flags: Math.floor(rng() * 256),
  });
}

export function encodeDnaSeed(seed, species = "ncmAvatar", options = {}) {
  const normalizedSpecies = species === "humanoid" ? "HM" : "AV";
  const maxPayloadLength = seedPayloadLengthLimit(normalizedSpecies, options.maxLength);
  const rawPayload = String(seed || "").trim().replace(/[^0-9A-Za-z_-]/g, "") || "0";
  const payload = maxPayloadLength ? rawPayload.slice(0, maxPayloadLength) || "0" : rawPayload;
  return `${dnaSeedPrefix}.${normalizedSpecies}.${payload.replace(/[^0-9A-Za-z_-]/g, "") || "0"}`;
}

export function decodeDnaSeed(seedCode) {
  const value = String(seedCode || "").trim();
  const [prefix, speciesCode, payload] = value.split(".");
  if (prefix === dnaSeedPrefix && payload !== undefined) {
    return {
      species: speciesCode === "HM" ? "humanoid" : "ncmAvatar",
      seed: payload || "0",
      code: encodeDnaSeed(payload || "0", speciesCode === "HM" ? "humanoid" : "ncmAvatar"),
    };
  }
  return {
    species: "ncmAvatar",
    seed: value || "0",
    code: encodeDnaSeed(value || "0", "ncmAvatar"),
  };
}

export function geneFromDnaSeed(seedCode, options = {}) {
  const decoded = decodeDnaSeed(seedCode);
  const species = options.species ?? decoded.species;
  if (species === "humanoid") {
    return randomGeneFromSeed(decoded.seed, { ornaments: Boolean(options.ornaments) });
  }
  return randomNcmAvatarGeneFromSeed(decoded.seed);
}

export function dnaSeedFromSearchIndex(index, { species = "ncmAvatar", salt = "", maxLength = DEFAULT_SEARCH_CONFIG.maxSeedLength } = {}) {
  const normalizedIndex = Math.max(0, Math.trunc(index));
  const speciesCode = species === "humanoid" ? "HM" : "AV";
  const payloadLimit = Math.max(1, seedPayloadLengthLimit(speciesCode, maxLength) || 1);
  const payloadLength = 1 + (hashSeed(`${salt}:length:${normalizedIndex}`) % payloadLimit);
  const payload = deterministicSeedPayload(`${salt}:${normalizedIndex}`, payloadLength);
  return encodeDnaSeed(payload, species, { maxLength });
}

export function minimumDnaSeedLength(species = "ncmAvatar") {
  const speciesCode = species === "humanoid" ? "HM" : "AV";
  return `${dnaSeedPrefix}.${speciesCode}.0`.length;
}

export function growNcmAvatarGene(gene) {
  const g = normalizeGene({ ...gene, species: "ncmAvatar" });
  const rng = xorshift32((g.ornamentSeed ^ (g.flags << 16) ^ 0x9e3779b9) >>> 0);
  const centerX = 16;
  const centerZ = 16;
  const bodyWidth = clampInteger(g.bodyWidth - 1, 3, 6);
  const bodyDepth = clampInteger(g.bodyDepth, 2, 4);
  const bodyHeight = clampInteger(g.bodyHeight - 4, 5, 8);
  const headSize = clampInteger(g.headSize, 5, 7);
  const legLength = clampInteger(g.legLength + 3, 9, 13);
  const legThickness = clampInteger(g.legThickness, 1, 2);
  const armLength = clampInteger(g.armLength, 8, 13);
  const armThickness = clampInteger(g.armThickness, 1, 2);
  const bodyY = legLength;
  const headY = bodyY + bodyHeight + 2;
  const bodyX = centerX - Math.floor(bodyWidth / 2);
  const bodyZ = centerZ - Math.floor(bodyDepth / 2);
  const headX = centerX - Math.floor(headSize / 2);
  const headZ = centerZ - Math.floor(headSize / 2);
  const armReach = clampInteger(armLength - 4, 4, 9);
  const armY = bodyY + bodyHeight - 1;
  const mats = avatarMaterialSet(g.materialSet);
  const cuboids = [
    cuboid("leftBoot", centerX - legThickness - 1, 0, bodyZ, legThickness + 1, 1, bodyDepth + 1, mats.hair),
    cuboid("rightBoot", centerX + 1, 0, bodyZ, legThickness + 1, 1, bodyDepth + 1, mats.hair),
    cuboid("leftLeg", centerX - legThickness - 1, 1, bodyZ, legThickness, legLength - 1, bodyDepth, mats.pants),
    cuboid("rightLeg", centerX + 1, 1, bodyZ, legThickness, legLength - 1, bodyDepth, mats.pants),
    cuboid("body", bodyX, bodyY, bodyZ, bodyWidth, bodyHeight, bodyDepth, mats.shirt),
    cuboid("chestPanel", bodyX + 1, bodyY + 2, bodyZ + bodyDepth, Math.max(1, bodyWidth - 2), Math.max(3, bodyHeight - 4), 1, mats.panel),
    cuboid("leftSleeve", bodyX - armReach, armY, bodyZ, armReach, 2, bodyDepth, mats.panel),
    cuboid("rightSleeve", bodyX + bodyWidth, armY, bodyZ, armReach, 2, bodyDepth, mats.panel),
    cuboid("leftHand", bodyX - armReach - 2, armY + 1, bodyZ, 2, 1, bodyDepth, mats.skin),
    cuboid("rightHand", bodyX + bodyWidth + armReach, armY + 1, bodyZ, 2, 1, bodyDepth, mats.skin),
    cuboid("head", headX, headY, headZ, headSize, headSize, headSize, mats.skin),
    cuboid("hairCap", headX, headY + headSize - 1, headZ, headSize, 1, headSize, mats.hairWarm),
    cuboid("hairBack", headX, headY + 1, headZ, headSize, headSize - 1, 1, mats.hairWarm),
    cuboid("hairLeft", headX, headY + 1, headZ, 1, headSize - 1, headSize, mats.hairWarm),
    cuboid("hairRight", headX + headSize - 1, headY + 1, headZ, 1, headSize - 1, headSize, mats.hairWarm),
    cuboid("leftEye", centerX - 2, headY + Math.max(2, Math.floor(headSize * 0.56)), headZ + headSize, 1, 1, 1, mats.eye),
    cuboid("rightEye", centerX + 1, headY + Math.max(2, Math.floor(headSize * 0.56)), headZ + headSize, 1, 1, 1, mats.eye),
  ];

  if (g.flags & 1) cuboids.push(cuboid("hairFringe", headX + 1, headY + headSize - 2, headZ + headSize, Math.max(2, headSize - 2), 1, 1, mats.hairWarm));
  if (g.flags & 2) cuboids.push(cuboid("skirt", bodyX - 1, bodyY, bodyZ - 1, bodyWidth + 2, 2, bodyDepth + 2, mats.pants));
  if (g.flags & 4) cuboids.push(cuboid("belt", bodyX, bodyY + Math.max(2, Math.floor(bodyHeight * 0.42)), bodyZ + bodyDepth, bodyWidth, 1, 1, mats.hair));
  if (g.flags & 8) cuboids.push(cuboid("collar", bodyX + 1, bodyY + bodyHeight - 1, bodyZ + bodyDepth, Math.max(1, bodyWidth - 2), 1, 1, mats.panel));
  if (g.flags & 16) {
    cuboids.push(cuboid("leftCheek", centerX - 3, headY + 2, headZ + headSize, 1, 1, 1, mats.skinWarm));
    cuboids.push(cuboid("rightCheek", centerX + 2, headY + 2, headZ + headSize, 1, 1, 1, mats.skinWarm));
  }

  const detailCount = 8 + (g.flags % 8);
  for (let index = 0; index < detailCount; index += 1) {
    const zone = rng();
    if (zone < 0.42) {
      const x = headX + Math.floor(rng() * headSize);
      const y = headY + Math.floor(rng() * headSize);
      const z = rng() < 0.72 ? headZ + headSize : headZ - 1;
      cuboids.push(cuboid(`hairPixel${index}`, x, y, z, 1, 1, 1, mats.hairWarm));
    } else if (zone < 0.76) {
      const x = bodyX + Math.floor(rng() * bodyWidth);
      const y = bodyY + Math.floor(rng() * bodyHeight);
      cuboids.push(cuboid(`clothPixel${index}`, x, y, bodyZ + bodyDepth, 1, 1, 1, rng() < 0.5 ? mats.panel : mats.shirtDark));
    } else {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side < 0 ? bodyX - armThickness : bodyX + bodyWidth;
      const y = bodyY + Math.floor(rng() * Math.max(1, bodyHeight));
      cuboids.push(cuboid(`armPixel${index}`, x, y, bodyZ + bodyDepth, armThickness, 1, 1, mats.skinWarm));
    }
  }

  return canonicalize(cuboids);
}

export function canonicalize(cuboids) {
  return [...cuboids]
    .map((part) => ({
      id: String(part.id ?? ""),
      x: Math.trunc(part.x),
      y: Math.trunc(part.y),
      z: Math.trunc(part.z),
      w: Math.trunc(part.w),
      h: Math.trunc(part.h),
      d: Math.trunc(part.d),
      material: Math.trunc(part.material),
    }))
    .filter((part) => part.w > 0 && part.h > 0 && part.d > 0)
    .sort(compareCuboids);
}

export function stableStringifyModel(cuboids) {
  const canonical = canonicalize(cuboids);
  return `[${canonical.map((part) => `{"x":${part.x},"y":${part.y},"z":${part.z},"w":${part.w},"h":${part.h},"d":${part.d},"material":${part.material}}`).join(",")}]`;
}

export function hashModel(cuboids) {
  return hashString(stableStringifyModel(cuboids));
}

export function getBoundingBox(cuboids) {
  const parts = canonicalize(cuboids);
  if (!parts.length) return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0, width: 0, height: 0, depth: 0 };
  const box = parts.reduce(
    (acc, part) => ({
      minX: Math.min(acc.minX, part.x),
      minY: Math.min(acc.minY, part.y),
      minZ: Math.min(acc.minZ, part.z),
      maxX: Math.max(acc.maxX, part.x + part.w),
      maxY: Math.max(acc.maxY, part.y + part.h),
      maxZ: Math.max(acc.maxZ, part.z + part.d),
    }),
    { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity },
  );
  return { ...box, width: box.maxX - box.minX, height: box.maxY - box.minY, depth: box.maxZ - box.minZ };
}

export function estimateRawSize(cuboids) {
  return byteLength(stableStringifyModel(cuboids));
}

export function estimateGeneSize(code) {
  return byteLength(code);
}

export function cuboidsToVoxelSet(cuboids, includeMaterial = true) {
  const set = new Set();
  for (const part of canonicalize(cuboids)) {
    for (let x = part.x; x < part.x + part.w; x += 1) {
      for (let y = part.y; y < part.y + part.h; y += 1) {
        for (let z = part.z; z < part.z + part.d; z += 1) {
          set.add(includeMaterial ? `${x},${y},${z},${part.material}` : `${x},${y},${z}`);
        }
      }
    }
  }
  return set;
}

export function scoreModelMatch(a, b) {
  const left = cuboidsToVoxelSet(a);
  const right = cuboidsToVoxelSet(b);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const key of left) {
    if (right.has(key)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection || 1);
}

export function inferHumanoidSearchRanges(target) {
  const parts = canonicalize(target);
  const byId = new Map(parts.map((part) => [part.id, part]));
  const bbox = getBoundingBox(parts);
  const body = byId.get("body") ?? largestPart(parts);
  const head = byId.get("head") ?? highestPart(parts);
  const leftArm = byId.get("leftArm");
  const leftLeg = byId.get("leftLeg");
  const materialSet = body ? clampInteger(Math.floor(body.material / 10), ...HUMANOID_LIMITS.materialSet) : 0;
  const inferred = {
    bodyWidth: body?.w ?? bbox.width,
    bodyDepth: body?.d ?? bbox.depth,
    bodyHeight: body?.h ?? Math.max(8, Math.round(bbox.height * 0.42)),
    headSize: head?.h ?? Math.max(4, Math.round(bbox.height * 0.24)),
    armLength: leftArm?.h ?? Math.max(6, Math.round(bbox.height * 0.46)),
    armThickness: leftArm?.w ?? 2,
    legLength: leftLeg?.h ?? Math.max(6, Math.round(bbox.height * 0.34)),
    legThickness: leftLeg?.w ?? 2,
    materialSet,
    flags: inferFlags(byId),
  };
  return {
    bodyWidth: rangeAround(inferred.bodyWidth, 1, HUMANOID_LIMITS.bodyWidth),
    bodyDepth: rangeAround(inferred.bodyDepth, 1, HUMANOID_LIMITS.bodyDepth),
    bodyHeight: rangeAround(inferred.bodyHeight, 2, HUMANOID_LIMITS.bodyHeight),
    headSize: rangeAround(inferred.headSize, 1, HUMANOID_LIMITS.headSize),
    armLength: rangeAround(inferred.armLength, 2, HUMANOID_LIMITS.armLength),
    armThickness: rangeAround(inferred.armThickness, 1, HUMANOID_LIMITS.armThickness),
    legLength: rangeAround(inferred.legLength, 2, HUMANOID_LIMITS.legLength),
    legThickness: rangeAround(inferred.legThickness, 1, HUMANOID_LIMITS.legThickness),
    materialSet: rangeAround(materialSet, 0, HUMANOID_LIMITS.materialSet),
    ornamentSeed: [0],
    flags: [inferred.flags],
  };
}

export function generateRawVariation(cuboids, seed) {
  const rng = xorshift32(hashSeed(seed || "raw-variation"));
  const next = [];
  for (const part of canonicalize(cuboids)) {
    if (part.h > 3 && rng() < 0.36) {
      const cut = Math.max(1, Math.min(part.h - 1, 1 + Math.floor(rng() * (part.h - 1))));
      next.push({ ...part, id: `${part.id}A`, h: cut });
      next.push({ ...part, id: `${part.id}B`, y: part.y + cut, h: part.h - cut });
    } else {
      next.push(part);
    }
  }
  if (rng() < 0.75) next.push(cuboid("rawBadge", 15, Math.max(8, Math.floor(getBoundingBox(cuboids).height * 0.45)), 13, 2, 2, 1, 96));
  return canonicalize(next);
}

export function ncmBoxesToCuboids(boxes, { unit = 9, centerX = 16, centerZ = 16 } = {}) {
  return canonicalize(
    boxes.map((box, index) => {
      const p = box.p ?? [0, 0, 0];
      const s = box.s ?? [unit, unit, unit];
      return cuboid(
        `ncm_${String(index).padStart(4, "0")}`,
        Math.round((p[0] - s[0] / 2) / unit) + centerX,
        Math.max(0, Math.round((p[1] - s[1] / 2) / unit)),
        Math.round((p[2] - s[2] / 2) / unit) + centerZ,
        Math.max(1, Math.round(s[0] / unit)),
        Math.max(1, Math.round(s[1] / unit)),
        Math.max(1, Math.round(s[2] / unit)),
        ncmColorToMaterial(box.c),
      );
    }),
  );
}

export function formatRatio(rawSize, geneSize) {
  if (!rawSize || !geneSize) return "0.00x";
  return `${(rawSize / geneSize).toFixed(2)}x`;
}

export function materialColor(material) {
  if (material >= 1000 && material < 1000 + NCM_AVATAR_PALETTE.length) {
    return Number.parseInt(NCM_AVATAR_PALETTE[material - 1000].slice(1), 16);
  }
  const palette = [
    0xc99061, 0x2e8b86, 0x216966, 0x294a7c, 0x2b2520, 0x62788f, 0xd6a84a, 0x7954a1, 0x33261c, 0x1b2430,
    0xf0b77f, 0x6aa8a1, 0x477b76, 0x436aa4, 0x403733, 0x7e91a6, 0xf0c95c, 0x9269ba, 0x4e3d31, 0x273040,
    0xc7d8e2, 0x9fbf62, 0x5e8b45, 0x6b6f86, 0x342d38, 0xa6b6c1, 0xffd166, 0x7f5af0, 0x40515c, 0x171d24,
  ];
  if (material === 90) return 0x101014;
  if (material === 96) return 0x8cff00;
  return palette[Math.abs(material) % palette.length];
}

export function ncmColorToMaterial(color) {
  const normalized = String(color || "").toLowerCase();
  const index = NCM_AVATAR_PALETTE.findIndex((item) => item.toLowerCase() === normalized);
  return 1000 + Math.max(0, index);
}

function avatarMaterialSet(materialSet) {
  const variant = Math.abs(materialSet) % 4;
  const shirt = variant === 0 ? 1002 : variant === 1 ? 1003 : variant === 2 ? 1005 : 1004;
  return {
    hair: 1000,
    hairWarm: variant === 1 ? 1000 : 1006,
    pants: variant === 3 ? 1001 : 1004,
    shirt,
    shirtDark: shirt === 1002 ? 1003 : 1002,
    panel: 1005,
    skin: 1007,
    skinWarm: 1008,
    eye: 1009,
  };
}

function cuboid(id, x, y, z, w, h, d, material) {
  return { id, x, y, z, w, h, d, material };
}

function compareCuboids(a, b) {
  return a.x - b.x || a.y - b.y || a.z - b.z || a.w - b.w || a.h - b.h || a.d - b.d || a.material - b.material || a.id.localeCompare(b.id);
}

function rangeAround(value, radius, [min, max]) {
  const center = clampInteger(value, min, max);
  const out = [];
  for (let item = Math.max(min, center - radius); item <= Math.min(max, center + radius); item += 1) out.push(item);
  return out;
}

function inferFlags(byId) {
  let flags = 0;
  if (byId.has("leftEye") || byId.has("rightEye")) flags |= 1;
  if (byId.has("leftShoulder") || byId.has("rightShoulder")) flags |= 2;
  if (byId.has("chestPlate")) flags |= 4;
  if (byId.has("backBlock")) flags |= 8;
  if (byId.has("leftFoot") || byId.has("rightFoot")) flags |= 16;
  if (byId.has("helmet")) flags |= 32;
  return flags;
}

function largestPart(parts) {
  return [...parts].sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d)[0] ?? null;
}

function highestPart(parts) {
  return [...parts].sort((a, b) => b.y + b.h - (a.y + a.h))[0] ?? null;
}

function pickRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.trunc(Number.isFinite(Number(value)) ? Number(value) : min)));
}

function toBase62(value) {
  let current = BigInt(value);
  if (current === 0n) return "0";
  let output = "";
  while (current > 0n) {
    output = base62Alphabet[Number(current % 62n)] + output;
    current /= 62n;
  }
  return output;
}

function deterministicSeedPayload(input, length) {
  let output = "";
  let nonce = 0;
  while (output.length < length) {
    output += toBase62(BigInt(hashSeed(`${input}:${nonce}`)));
    nonce += 1;
  }
  return output.slice(0, length);
}

function seedPayloadLengthLimit(speciesCode, maxLength) {
  const parsed = Math.trunc(Number(maxLength));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const prefixLength = `${dnaSeedPrefix}.${speciesCode}.`.length;
  return Math.max(1, parsed - prefixLength);
}

function fromBase62(value) {
  let output = 0n;
  for (const char of String(value || "0")) {
    const index = base62Alphabet.indexOf(char);
    if (index < 0) continue;
    output = output * 62n + BigInt(index);
  }
  return output;
}

export function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function xorshift32(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}
