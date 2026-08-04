export const WORLD_CENTER = Object.freeze({ x: 2432, y: 100, z: 1712 });
export const MOBILE_TERRAIN_VIEW_DISTANCE = 6;
export const DESKTOP_TERRAIN_VIEW_DISTANCE = 7;
export const PRESENTATION_GROUND_Y = 99;
export const PRESENTATION_WATER_Y = 96;
export const PRESENTATION_WATER_BED_Y = 93;
export const COASTAL_WATER_MARGIN = 18;
export const MINING_TARGET = Object.freeze({ x: 2385, z: 1644 });

export const ACTOR_SITES = Object.freeze({
  boy: Object.freeze({ x: 2526, z: 1788, yaw: -2.35 }),
  boyMine: Object.freeze({ x: 2388, z: 1648, yaw: -2.36 }),
  girl: Object.freeze({ x: 2535, z: 1768, yaw: -2.42 }),
  girlCottage: Object.freeze({ x: 2399, z: 1703, yaw: 1.48 }),
  economyBoy: Object.freeze({ x: 2484, z: 1725, yaw: -1.42 }),
  economyGirl: Object.freeze({ x: 2492, z: 1725, yaw: 1.42 }),
  guardianBoy: Object.freeze({ x: 2514, z: 1657, yaw: -1.57 }),
  guardianGirl: Object.freeze({ x: 2524, z: 1657, yaw: 1.57 }),
  bridgeEast: Object.freeze({ x: 2464, z: 1700 }),
  bridgeWest: Object.freeze({ x: 2428, z: 1700 }),
});

export const ECONOMY_FLOW_SITES = Object.freeze([
  Object.freeze({ x: 2478, z: 1722 }),
  Object.freeze({ x: 2483, z: 1722 }),
  Object.freeze({ x: 2488, z: 1722 }),
  Object.freeze({ x: 2493, z: 1722 }),
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
      Object.freeze({ x: 2516, z: 1819 }),
      Object.freeze({ x: 2516, z: 1740 }),
      Object.freeze({ x: 2512, z: 1720 }),
      Object.freeze({ x: 2503, z: 1708 }),
      Object.freeze({ x: 2502, z: 1701 }),
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
      Object.freeze({ x: 2397, z: 1704 }),
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
    quarterTurns: 1,
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
]);

export const PRESENTATION_TREES = Object.freeze([
  Object.freeze({ x: 2400, z: 1629, height: 6 }),
  Object.freeze({ x: 2405, z: 1770, height: 7 }),
  Object.freeze({ x: 2390, z: 1800, height: 6 }),
  Object.freeze({ x: 2490, z: 1652, height: 6 }),
  Object.freeze({ x: 2531, z: 1712, height: 7 }),
  Object.freeze({ x: 2508, z: 1791, height: 6 }),
]);

export const PRESENTATION_PLANTS = Object.freeze([
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
