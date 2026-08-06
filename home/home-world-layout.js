export const WORLD_CENTER = Object.freeze({ x: 2432, y: 100, z: 1712 });
export const MOBILE_TERRAIN_VIEW_DISTANCE = 6;
export const DESKTOP_TERRAIN_VIEW_DISTANCE = 7;
export const PRESENTATION_GROUND_Y = 99;
export const PRESENTATION_WATER_Y = 96;
export const PRESENTATION_WATER_BED_Y = 93;
export const COASTAL_WATER_MARGIN = 18;
export const MINING_TARGET = Object.freeze({ x: 2385, y: 102, z: 1644, material: "coal" });

export const ACTOR_SITES = Object.freeze({
  boy: Object.freeze({ x: 2508, z: 1789, yaw: 0.2 }),
  boyMine: Object.freeze({ x: 2386, z: 1646, yaw: -2.68 }),
  girl: Object.freeze({ x: 2515, z: 1788, yaw: -0.55 }),
  girlCottage: Object.freeze({ x: 2409, z: 1697, yaw: -1.57 }),
  economyBoy: Object.freeze({ x: 2508, z: 1775, yaw: 0 }),
  economyGirl: Object.freeze({ x: 2528, z: 1777, yaw: 0 }),
  guardianBoy: Object.freeze({ x: 2473, z: 1708, yaw: -1.57 }),
  guardianGirl: Object.freeze({ x: 2479, z: 1708, yaw: 1.57 }),
  constructionBoy: Object.freeze({ x: 2512, z: 1797, yaw: 3.141593 }),
  constructionGirl: Object.freeze({ x: 2498, z: 1808, yaw: -1.38 }),
  bridgeEast: Object.freeze({ x: 2464, z: 1700 }),
  bridgeWest: Object.freeze({ x: 2428, z: 1700 }),
});

export const ECONOMY_FORGE_SITE = Object.freeze({
  anvil: Object.freeze({ x: 2508.5, y: 100, z: 1773, yaw: 0 }),
  bench: Object.freeze({ x: 2501.5, y: 100, z: 1771, yaw: 0 }),
  tool: Object.freeze({ x: 2508.5, y: 102.34, z: 1773, yaw: 1.570796 }),
  strike: Object.freeze({ x: 2508.5, y: 102.58, z: 1773 }),
  shelf: Object.freeze({ x: 2500, y: 100, z: 1777, yaw: 0 }),
  marketDisplay: Object.freeze({ x: 2526.5, y: 100, z: 1775, yaw: 0 }),
});

export const ECONOMY_FLOW_SITES = Object.freeze([
  Object.freeze({ x: 2494, z: 1773 }),
  Object.freeze({ x: 2502, z: 1773 }),
  Object.freeze({ x: 2508, z: 1773 }),
  Object.freeze({ x: 2526, z: 1775 }),
]);

export const ECONOMY_MATERIAL_SITES = Object.freeze({
  copperBloom: Object.freeze({ x: 2502.2, y: 103.15, z: 1771.1, yaw: -0.35 }),
  woodenPlank: Object.freeze({ x: 2499.7, y: 101.55, z: 1776.7, yaw: 0.2 }),
  woodenStick: Object.freeze({ x: 2500.3, y: 102.42, z: 1776.7, yaw: -0.25 }),
  basaltBrick: Object.freeze({ x: 2526.2, y: 102.4, z: 1774.8, yaw: 0.28 }),
});

export const CONSTRUCTION_SITE = Object.freeze({
  pallet: Object.freeze({ x: 2498, y: 100, z: 1808, yaw: 0.35 }),
  strike: Object.freeze({ x: 2512, y: 102, z: 1801 }),
  overlay: Object.freeze({ x: 2503, z: 1800, width: 21, depth: 19 }),
});

export const SCENE_RESOURCE_CLUSTERS = Object.freeze([
  Object.freeze({
    id: "mining-coal-outcrop",
    voxels: Object.freeze([
      Object.freeze({ x: 2385, y: 101, z: 1644, material: "coal" }),
      Object.freeze({ x: 2385, y: 102, z: 1644, material: "coal" }),
      Object.freeze({ x: 2384, y: 101, z: 1644, material: "basalt" }),
      Object.freeze({ x: 2385, y: 101, z: 1645, material: "basalt" }),
    ]),
  }),
]);

export const PRESENTATION_LANDMASSES = Object.freeze([
  Object.freeze({ x: 2392, z: 1715, radiusX: 77, radiusZ: 112 }),
  Object.freeze({ x: 2494, z: 1712, radiusX: 83, radiusZ: 112 }),
]);

export const PRESENTATION_RIVER = Object.freeze({
  centerline: Object.freeze([
    Object.freeze({ x: 2443, z: 1600, halfWidth: 7.5 }),
    Object.freeze({ x: 2450, z: 1643, halfWidth: 8.5 }),
    Object.freeze({ x: 2446, z: 1700, halfWidth: 10 }),
    Object.freeze({ x: 2441, z: 1744, halfWidth: 11.5 }),
    Object.freeze({ x: 2432, z: 1784, halfWidth: 15.5 }),
    Object.freeze({ x: 2415, z: 1839, halfWidth: 25 }),
  ]),
});

export const PRESENTATION_RELIEF = Object.freeze({
  version: 1,
  maxRise: 2,
  shoreFadeStart: 6,
  shoreFadeEnd: 18,
  hills: Object.freeze([
    Object.freeze({ x: 2400, z: 1642, radiusX: 42, radiusZ: 34, height: 2 }),
    Object.freeze({ x: 2396, z: 1787, radiusX: 35, radiusZ: 31, height: 1 }),
    Object.freeze({ x: 2522, z: 1784, radiusX: 40, radiusZ: 34, height: 2 }),
  ]),
});

export const WESTERN_BAY = Object.freeze({ x: 2354, z: 1722, radiusX: 50, radiusZ: 70 });
export const COASTAL_STAGE_BOUNDS = Object.freeze({ minX: 2320, maxX: 2559, minZ: 1600, maxZ: 1839 });

export const PRESENTATION_PATHS = Object.freeze([
  Object.freeze({
    id: "village-spine",
    halfWidth: 3.25,
    points: Object.freeze([
      Object.freeze({ x: 2500, z: 1814 }),
      Object.freeze({ x: 2497, z: 1807 }),
      Object.freeze({ x: 2508, z: 1790 }),
      Object.freeze({ x: 2508, z: 1773 }),
      Object.freeze({ x: 2516, z: 1740 }),
      Object.freeze({ x: 2512, z: 1720 }),
      Object.freeze({ x: 2503, z: 1708 }),
      Object.freeze({ x: 2502, z: 1701 }),
    ]),
  }),
  Object.freeze({
    id: "production-courtyard",
    halfWidth: 2.75,
    points: Object.freeze([
      Object.freeze({ x: 2495, z: 1773 }),
      Object.freeze({ x: 2508, z: 1773 }),
      Object.freeze({ x: 2520, z: 1773 }),
    ]),
  }),
  Object.freeze({
    id: "construction-spur",
    halfWidth: 2.5,
    points: Object.freeze([
      Object.freeze({ x: 2497, z: 1807 }),
      Object.freeze({ x: 2503, z: 1807 }),
    ]),
  }),
  Object.freeze({
    id: "east-bridge-approach",
    halfWidth: 2.75,
    points: Object.freeze([
      Object.freeze({ x: 2504, z: 1712 }),
      Object.freeze({ x: 2482, z: 1708 }),
      Object.freeze({ x: 2464, z: 1700 }),
    ]),
  }),
  Object.freeze({
    id: "west-bridge-approach",
    halfWidth: 2.5,
    points: Object.freeze([
      Object.freeze({ x: 2428, z: 1700 }),
      Object.freeze({ x: 2412, z: 1702 }),
      Object.freeze({ x: 2408, z: 1697 }),
    ]),
  }),
  Object.freeze({
    id: "windmill-track",
    halfWidth: 2.5,
    points: Object.freeze([
      Object.freeze({ x: 2502, z: 1702 }),
      Object.freeze({ x: 2510, z: 1674 }),
      Object.freeze({ x: 2525, z: 1650 }),
    ]),
  }),
]);

export const STRUCTURE_LAYOUT = Object.freeze([
  Object.freeze({
    id: "coastal-cottage",
    definitionKey: "cottage",
    definitionPath: "build_ncm/buildings/coastal/seaside-cottage.json",
    minX: 2370,
    minZ: 1681,
    surfaceY: PRESENTATION_WATER_BED_Y,
    quarterTurns: 0,
    siteMode: "water",
  }),
  Object.freeze({
    id: "river-footbridge",
    definitionKey: "footbridge",
    definitionPath: "build_ncm/buildings/transport/stone-timber-footbridge.json",
    minX: 2431,
    minZ: 1694,
    surfaceY: PRESENTATION_GROUND_Y,
    quarterTurns: 0,
    siteMode: "bridge",
    walkable: true,
    walkCorridor: Object.freeze({ minLocalZ: 4, maxLocalZ: 8 }),
  }),
  Object.freeze({
    id: "village-gateway",
    definitionKey: "villageGateway",
    definitionPath: "build_ncm/buildings/wayfinding/stone-timber-village-gateway.json",
    minX: 2504,
    minZ: 1730,
    surfaceY: 100,
    quarterTurns: 0,
    walkable: true,
    walkCorridor: Object.freeze({ minLocalX: 8, maxLocalX: 16, maxLocalY: 0 }),
  }),
  Object.freeze({
    id: "hollow-cottage",
    definitionKey: "hollowCottage",
    definitionPath: "build_ncm/buildings/residential/hollow-cottage.json",
    minX: 2488,
    minZ: 1682,
    surfaceY: 100,
    quarterTurns: 2,
  }),
  Object.freeze({
    id: "tower-windmill",
    definitionKey: "windmill",
    definitionPath: "build_ncm/buildings/agriculture/stone-timber-tower-windmill.json",
    minX: 2510,
    minZ: 1624,
    surfaceY: 100,
    quarterTurns: 2,
  }),
  Object.freeze({
    id: "village-bloomery",
    definitionKey: "bloomery",
    definitionPath: "build_ncm/buildings/industrial/covered-village-bloomery.json",
    minX: 2477,
    minZ: 1762,
    surfaceY: 100,
    quarterTurns: 0,
  }),
  Object.freeze({
    id: "village-market-stall",
    definitionKey: "marketStall",
    definitionPath: "build_ncm/buildings/commerce/covered-market-stall.json",
    minX: 2520,
    minZ: 1762,
    surfaceY: 100,
    quarterTurns: 0,
  }),
  Object.freeze({
    id: "construction-scaffold",
    definitionKey: "scaffold",
    definitionPath: "build_ncm/buildings/construction/timber-building-scaffold.json",
    minX: 2503,
    minZ: 1800,
    surfaceY: 100,
    quarterTurns: 0,
  }),
]);

export const PRESENTATION_TREES = Object.freeze([
  Object.freeze({ x: 2400, z: 1629, height: 6 }),
  Object.freeze({ x: 2405, z: 1770, height: 7 }),
  Object.freeze({ x: 2390, z: 1800, height: 6 }),
  Object.freeze({ x: 2490, z: 1652, height: 6 }),
  Object.freeze({ x: 2531, z: 1712, height: 7 }),
  Object.freeze({ x: 2480, z: 1801, height: 6 }),
]);

const AMBIENT_PLANTS = Object.freeze([
  Object.freeze({ x: 2499, z: 1732, block: "grassPlant" }),
  Object.freeze({ x: 2497, z: 1735, block: "flowerYellow" }),
  Object.freeze({ x: 2499, z: 1738, block: "flowerWhite" }),
  Object.freeze({ x: 2497, z: 1740, block: "grassPlant" }),
  Object.freeze({ x: 2531, z: 1732, block: "grassPlant" }),
  Object.freeze({ x: 2533, z: 1735, block: "flowerRed" }),
  Object.freeze({ x: 2531, z: 1738, block: "flowerWhite" }),
  Object.freeze({ x: 2507, z: 1778, block: "grassPlant" }),
  Object.freeze({ x: 2505, z: 1781, block: "flowerBlue" }),
  Object.freeze({ x: 2508, z: 1783, block: "grassPlant" }),
  Object.freeze({ x: 2524, z: 1778, block: "grassPlant" }),
  Object.freeze({ x: 2527, z: 1781, block: "flowerYellow" }),
  Object.freeze({ x: 2524, z: 1784, block: "flowerWhite" }),
  Object.freeze({ x: 2486, z: 1732, block: "grassPlant" }),
  Object.freeze({ x: 2483, z: 1734, block: "flowerPink" }),
  Object.freeze({ x: 2485, z: 1737, block: "flowerWhite" }),
  Object.freeze({ x: 2506, z: 1725, block: "grassPlant" }),
  Object.freeze({ x: 2509, z: 1728, block: "flowerRed" }),
  Object.freeze({ x: 2504, z: 1726, block: "grassPlant" }),
  Object.freeze({ x: 2483, z: 1690, block: "grassPlant" }),
  Object.freeze({ x: 2481, z: 1687, block: "flowerBlue" }),
  Object.freeze({ x: 2484, z: 1684, block: "flowerWhite" }),
  Object.freeze({ x: 2516, z: 1692, block: "grassPlant" }),
  Object.freeze({ x: 2518, z: 1689, block: "flowerYellow" }),
  Object.freeze({ x: 2516, z: 1686, block: "flowerPink" }),
  Object.freeze({ x: 2468, z: 1691, block: "grassPlant" }),
  Object.freeze({ x: 2470, z: 1693, block: "flowerWhite" }),
  Object.freeze({ x: 2468, z: 1709, block: "flowerBlue" }),
  Object.freeze({ x: 2425, z: 1691, block: "grassPlant" }),
  Object.freeze({ x: 2423, z: 1693, block: "flowerRed" }),
  Object.freeze({ x: 2425, z: 1709, block: "flowerYellow" }),
  Object.freeze({ x: 2408, z: 1692, block: "grassPlant" }),
  Object.freeze({ x: 2410, z: 1695, block: "flowerWhite" }),
  Object.freeze({ x: 2408, z: 1712, block: "flowerBlue" }),
  Object.freeze({ x: 2505, z: 1658, block: "grassPlant" }),
  Object.freeze({ x: 2507, z: 1660, block: "flowerYellow" }),
  Object.freeze({ x: 2534, z: 1658, block: "grassPlant" }),
  Object.freeze({ x: 2533, z: 1661, block: "flowerWhite" }),
  Object.freeze({ x: 2397, z: 1627, block: "grassPlant" }),
  Object.freeze({ x: 2403, z: 1630, block: "flowerRed" }),
  Object.freeze({ x: 2402, z: 1774, block: "grassPlant" }),
  Object.freeze({ x: 2407, z: 1778, block: "flowerPink" }),
  Object.freeze({ x: 2397, z: 1795, block: "grassPlant" }),
  Object.freeze({ x: 2403, z: 1798, block: "flowerWhite" }),
  Object.freeze({ x: 2487, z: 1650, block: "grassPlant" }),
  Object.freeze({ x: 2497, z: 1657, block: "flowerBlue" }),
  Object.freeze({ x: 2528, z: 1708, block: "grassPlant" }),
  Object.freeze({ x: 2526, z: 1718, block: "flowerYellow" }),
  Object.freeze({ x: 2505, z: 1789, block: "grassPlant" }),
  Object.freeze({ x: 2522, z: 1795, block: "flowerRed" }),
]);

const ROADSIDE_FLOWER_BLOCKS = Object.freeze([
  "flowerYellow",
  "flowerWhite",
  "flowerRed",
  "flowerBlue",
  "flowerPink",
]);
const ROADSIDE_FLOWER_SAMPLE_STEP = 1.7;
const ROADSIDE_FLOWER_INNER_OFFSET = 0.9;
const ROADSIDE_FLOWER_OUTER_OFFSET = 2.25;

const ROADSIDE_FLOWER_CLEARINGS = Object.freeze([
  Object.freeze({ minX: 2501, maxX: 2526, minZ: 1798, maxZ: 1822 }),
  Object.freeze({ minX: 2494, maxX: 2502, minZ: 1804, maxZ: 1812 }),
  Object.freeze({ minX: 2368, maxX: 2410, minZ: 1678, maxZ: 1715 }),
  Object.freeze({ minX: 2428, maxX: 2464, minZ: 1691, maxZ: 1709 }),
  Object.freeze({ minX: 2475, maxX: 2497, minZ: 1760, maxZ: 1781 }),
  Object.freeze({ minX: 2497, maxX: 2515, minZ: 1767, maxZ: 1779 }),
  Object.freeze({ minX: 2518, maxX: 2542, minZ: 1760, maxZ: 1780 }),
  Object.freeze({ minX: 2501, maxX: 2531, minZ: 1727, maxZ: 1745 }),
  Object.freeze({ minX: 2485, maxX: 2514, minZ: 1679, maxZ: 1702 }),
  Object.freeze({ minX: 2507, maxX: 2543, minZ: 1621, maxZ: 1652 }),
]);

function createRoadsideFlowers() {
  const occupied = new Set(AMBIENT_PLANTS.map(({ x, z }) => `${x},${z}`));
  const flowers = [];
  let flowerIndex = 0;
  const addFlower = (x, z) => {
    const key = `${x},${z}`;
    const inClearing = ROADSIDE_FLOWER_CLEARINGS.some((bounds) => (
      x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
    ));
    const nearTree = PRESENTATION_TREES.some((tree) => Math.hypot(x - tree.x, z - tree.z) < 4);
    if (occupied.has(key) || inClearing || nearTree) return;
    occupied.add(key);
    flowers.push(Object.freeze({ x, z, block: ROADSIDE_FLOWER_BLOCKS[flowerIndex % ROADSIDE_FLOWER_BLOCKS.length] }));
    flowerIndex += 1;
  };

  PRESENTATION_PATHS.forEach((path, pathIndex) => {
    path.points.slice(0, -1).forEach((from, segmentIndex) => {
      const to = path.points[segmentIndex + 1];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const length = Math.hypot(dx, dz);
      const tangentX = dx / length;
      const tangentZ = dz / length;
      const normalX = -tangentZ;
      const normalZ = tangentX;
      let sampleIndex = 0;
      for (let distance = 1.4; distance <= length - 1.4; distance += ROADSIDE_FLOWER_SAMPLE_STEP) {
        const alongJitter = ((sampleIndex + pathIndex) % 3 - 1) * 0.25;
        for (const side of [-1, 1]) {
          const sideIndex = side > 0 ? 1 : 0;
          const edgeJitter = ((sampleIndex + pathIndex + sideIndex) % 2) * 0.2;
          const offset = side * (path.halfWidth + ROADSIDE_FLOWER_INNER_OFFSET + edgeJitter);
          const x = Math.round(from.x + tangentX * (distance + alongJitter) + normalX * offset);
          const z = Math.round(from.z + tangentZ * (distance + alongJitter) + normalZ * offset);
          addFlower(x, z);
          if ((sampleIndex + pathIndex + sideIndex) % 2 === 0) {
            addFlower(
              Math.round(from.x + tangentX * (distance + alongJitter + 0.55)
                + normalX * side * (path.halfWidth + ROADSIDE_FLOWER_OUTER_OFFSET + edgeJitter)),
              Math.round(from.z + tangentZ * (distance + alongJitter + 0.55)
                + normalZ * side * (path.halfWidth + ROADSIDE_FLOWER_OUTER_OFFSET + edgeJitter)),
            );
          }
        }
        sampleIndex += 1;
      }
    });
  });
  return flowers;
}

export const PRESENTATION_PLANTS = Object.freeze([
  ...AMBIENT_PLANTS,
  ...createRoadsideFlowers(),
]);
