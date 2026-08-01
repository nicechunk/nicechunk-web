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
  bridgeEast: Object.freeze({ x: 2464, z: 1700 }),
  bridgeWest: Object.freeze({ x: 2428, z: 1700 }),
});

export const PRESENTATION_LANDMASSES = Object.freeze([
  Object.freeze({ x: 2392, z: 1715, radiusX: 77, radiusZ: 112 }),
  Object.freeze({ x: 2494, z: 1712, radiusX: 83, radiusZ: 112 }),
]);

export const WESTERN_BAY = Object.freeze({ x: 2356, z: 1710, radiusX: 43, radiusZ: 61 });
export const COASTAL_STAGE_BOUNDS = Object.freeze({ minX: 2320, maxX: 2559, minZ: 1600, maxZ: 1839 });

export const STRUCTURE_LAYOUT = Object.freeze([
  Object.freeze({
    id: "coastal-cottage",
    definitionKey: "cottage",
    definitionPath: "build_ncm/buildings/coastal/seaside-cottage.json",
    minX: 2359,
    minZ: 1687,
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
    id: "village-notice-board",
    definitionKey: "noticeBoard",
    definitionPath: "build_ncm/buildings/civic/covered-village-notice-board.json",
    minX: 2480,
    minZ: 1742,
    surfaceY: 100,
    quarterTurns: 1,
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
  Object.freeze({ x: 2373, z: 1770, height: 7 }),
  Object.freeze({ x: 2414, z: 1800, height: 6 }),
  Object.freeze({ x: 2490, z: 1652, height: 6 }),
  Object.freeze({ x: 2531, z: 1712, height: 7 }),
  Object.freeze({ x: 2508, z: 1791, height: 6 }),
]);

export const PRESENTATION_PLANTS = Object.freeze([
  Object.freeze({ x: 2520, z: 1735, block: "flowerYellow" }),
  Object.freeze({ x: 2492, z: 1664, block: "flowerWhite" }),
  Object.freeze({ x: 2533, z: 1762, block: "flowerPink" }),
  Object.freeze({ x: 2498, z: 1772, block: "flowerBlue" }),
  Object.freeze({ x: 2408, z: 1668, block: "flowerRed" }),
  Object.freeze({ x: 2386, z: 1782, block: "grassPlant" }),
  Object.freeze({ x: 2420, z: 1742, block: "grassPlant" }),
  Object.freeze({ x: 2398, z: 1685, block: "flowerWhite" }),
]);
