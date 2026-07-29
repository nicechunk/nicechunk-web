import { createBlueprint } from "../chunk.js/ncm/blueprint-codec.js";
import { buildingStylePreset } from "../chunk.js/construction/building-style-catalog.js";
import { ARCHITECTURAL_MATERIAL_ID } from "../chunk.js/construction/architectural-material-catalog.js";
import { ROOF_TILE_MATERIAL_ID } from "../chunk.js/construction/roof-tile-catalog.js";

/**
 * Monumental doorless castle reconstructed from the supplied voxel reference.
 *
 * The silhouette is intentionally hierarchical: four corner towers surround a
 * crenellated curtain wall, a projecting twin-pier gatehouse protects an open
 * portal, a second ward frames the hollow keep, and a roofed central tower
 * crowns the composition. Door leaves, portcullises, drawbridges, terrain,
 * roads, vegetation, furniture and units stay outside the NCM blueprint.
 */
export function createGrandCastle({ style = "castle", roofMaterial = null, glazed = false } = {}) {
  const preset = buildingStylePreset(style);
  const materials = {
    ...preset.materials,
    roof: roofMaterial ?? ROOF_TILE_MATERIAL_ID.iceBlue,
    lantern: ARCHITECTURAL_MATERIAL_ID.amberGlassPanel,
    banner: ARCHITECTURAL_MATERIAL_ID.blueCeramicTile,
  };
  const b = createBlueprint({ x: 152, y: 86, z: 136 }, `Royal Blue Citadel · ${preset.name}`);

  // Stone-only footprint. The reference image's terrain, stream and path are
  // intentionally omitted so the castle can be placed on any world surface.
  // The enlarged courtyard is deliberately left as open placement space. It
  // inherits the world's terrain instead of baking a giant floor or landscape
  // slab into the on-chain building payload.

  addCurtainWalls(b, materials);

  // Four tall hollow corner towers establish the outer silhouette.
  for (const x of [8, 124]) {
    for (const z of [6, 110]) addCornerTower(b, materials, x, z);
  }

  addGatehouse(b, materials);
  addInnerWard(b, materials);
  const center = offsetBuilder(b, 32, 26);
  addKeep(center, materials, glazed);
  addCentralTower(center, materials, glazed);
  addBannersAndLights(b, materials);

  return b;
}

function addCurtainWalls(b, materials) {
  // The outer ring is deliberately much larger than the keep, leaving a
  // continuous 18–24 vu courtyard around the complete central complex.
  b.box(materials.foundation, 24, 2, 22, 2, 4, 92)
    .box(materials.foundation, 127, 2, 22, 2, 4, 38)
    .box(materials.foundation, 127, 2, 76, 2, 4, 38)
    .box(materials.foundation, 26, 2, 22, 101, 4, 2)
    .box(materials.foundation, 26, 2, 112, 101, 4, 2)
    .box(materials.wall, 24, 6, 22, 2, 24, 92)
    .box(materials.wall, 127, 6, 22, 2, 24, 38)
    .box(materials.wall, 127, 6, 76, 2, 24, 38)
    .box(materials.wall, 127, 24, 60, 2, 6, 16)
    .box(materials.wall, 26, 6, 22, 101, 24, 2)
    .box(materials.wall, 26, 6, 112, 101, 24, 2);

  // Narrow perimeter walks do not cover the courtyard below.
  b.box(materials.floor, 26, 29, 24, 101, 1, 2)
    .box(materials.floor, 26, 29, 110, 101, 1, 2)
    .box(materials.floor, 26, 29, 26, 2, 1, 84)
    .box(materials.floor, 125, 29, 26, 2, 1, 84)
    .repeat(materials.wall, 24, 30, 22, 3, 4, 3, 19, 0, 0, 5)
    .repeat(materials.wall, 126, 30, 22, 3, 4, 3, 19, 0, 0, 5)
    .repeat(materials.wall, 26, 30, 22, 3, 4, 3, 21, 5, 0, 0)
    .repeat(materials.wall, 26, 30, 111, 3, 4, 3, 21, 5, 0, 0);

  // Low buttresses add scale without turning the wall into black bars.
  b.repeat(materials.foundation, 129, 3, 31, 3, 10, 3, 6, 0, 0, 5)
    .repeat(materials.foundation, 129, 3, 81, 3, 10, 3, 6, 0, 0, 5)
    .repeat(materials.foundation, 34, 3, 20, 3, 10, 3, 17, 5, 0, 0)
    .repeat(materials.foundation, 34, 3, 113, 3, 10, 3, 17, 5, 0, 0);
}

function addCornerTower(b, materials, x, z) {
  // Enlarged hollow corner tower with a 16 × 16 usable core.
  b.box(materials.foundation, x, 0, z, 20, 5, 20)
    .box(materials.wall, x, 5, z, 2, 40, 20)
    .box(materials.wall, x + 18, 5, z, 2, 40, 20)
    .box(materials.wall, x + 2, 5, z, 16, 40, 2)
    .box(materials.wall, x + 2, 5, z + 18, 16, 40, 2)
    .box(materials.foundation, x - 1, 43, z - 1, 22, 3, 22)
    .box(materials.floor, x, 46, z, 20, 1, 20);

  addCrenellatedRing(b, materials.wall, x - 1, 47, z - 1, 22, 22, 5);

  // Each tower receives the reference's timber flagpole, amber cap and blue
  // stepped pennant. The pole starts above the walk and never blocks a room.
  const centerX = x + 10;
  const centerZ = z + 10;
  b.box(materials.structure, centerX, 51, centerZ, 1, 11, 1)
    .box(materials.lantern, centerX, 62, centerZ, 1, 1, 1)
    .box(materials.banner, centerX + 1, 58, centerZ, 5, 2, 1)
    .box(materials.banner, centerX + 6, 57, centerZ, 4, 2, 1);
}

function addGatehouse(b, materials) {
  // Twin projecting gate piers. The full x=127..146, y=2..23,
  // z=60..75 tunnel remains empty for a separately placed gate system.
  for (const z of [50, 76]) {
    b.box(materials.foundation, 125, 1, z, 23, 5, 10)
      .box(materials.wall, 125, 6, z, 23, 33, 2)
      .box(materials.wall, 125, 6, z + 8, 23, 33, 2)
      .box(materials.wall, 125, 6, z + 2, 2, 33, 6)
      .box(materials.wall, 146, 6, z + 2, 2, 33, 6)
      .box(materials.floor, 127, 39, z + 2, 19, 1, 6);
  }

  // The chamber above the portal creates the stepped stone arch silhouette.
  b.box(materials.wall, 125, 24, 60, 2, 15, 16)
    .box(materials.wall, 146, 24, 60, 2, 15, 16)
    .box(materials.wall, 127, 24, 60, 19, 15, 2)
    .box(materials.wall, 127, 24, 74, 19, 15, 2)
    .box(materials.floor, 127, 38, 62, 19, 2, 12)
    .box(materials.foundation, 148, 21, 57, 2, 3, 22)
    .box(materials.foundation, 148, 19, 58, 2, 2, 20);

  addCrenellatedRing(b, materials.wall, 124, 40, 49, 25, 38, 5);

  // A compact blue tiled canopy marks the open gate in the same visual
  // language as the keep roofs without introducing a gate leaf.
  b.gableZ(materials.roof, 144, 23, 57, 7, 22)
    .gableTrimZ(materials.structure, 144, 23, 57, 7, 22);

  // Broad stairs stop outside the empty portal; no bridge or door is baked in.
  b.box(materials.foundation, 147, 0, 58, 5, 1, 20)
    .box(materials.floor, 146, 1, 59, 5, 1, 18)
    .box(materials.floor, 145, 2, 60, 5, 1, 16);
}

function addInnerWard(b, materials) {
  // A lower second defensive ring reproduces the reference's layered central
  // courtyard. Its front entrance aligns with the main gate and remains open.
  b.box(materials.foundation, 50, 2, 42, 54, 3, 53)
    .box(materials.wall, 50, 5, 42, 2, 17, 53)
    .box(materials.wall, 102, 5, 42, 2, 17, 22)
    .box(materials.wall, 102, 5, 73, 2, 17, 22)
    .box(materials.wall, 102, 15, 64, 2, 7, 9)
    .box(materials.wall, 52, 5, 42, 50, 17, 2)
    .box(materials.wall, 52, 5, 93, 50, 17, 2)
    .box(materials.floor, 52, 21, 44, 50, 1, 2)
    .box(materials.floor, 52, 21, 91, 50, 1, 2)
    .box(materials.floor, 52, 21, 46, 2, 1, 45)
    .box(materials.floor, 100, 21, 46, 2, 1, 45);

  addCrenellatedRing(b, materials.wall, 49, 22, 41, 56, 55, 5);

  // Four compact ward turrets punctuate the middle tier.
  for (const x of [48, 96]) {
    for (const z of [40, 88]) addWardTurret(b, materials, x, z);
  }
}

function addWardTurret(b, materials, x, z) {
  b.box(materials.foundation, x, 3, z, 10, 3, 10)
    .box(materials.wall, x, 6, z, 1, 22, 10)
    .box(materials.wall, x + 9, 6, z, 1, 22, 10)
    .box(materials.wall, x + 1, 6, z, 8, 22, 1)
    .box(materials.wall, x + 1, 6, z + 9, 8, 22, 1)
    .box(materials.floor, x, 28, z, 10, 1, 10);
  addCrenellatedRing(b, materials.wall, x - 1, 29, z - 1, 12, 12, 4);
}

function addKeep(b, materials, glazed) {
  // Raised hollow keep. Facades are assembled around open windows rather than
  // painting window colors over solid stone.
  b.box(materials.foundation, 29, 3, 25, 30, 3, 34)
    .box(materials.floor, 30, 6, 26, 28, 1, 32);

  addKeepFaceX(b, materials, 29, 25, false, glazed);
  addKeepFaceX(b, materials, 58, 25, true, glazed);
  addKeepFaceZ(b, materials, 29, 25, glazed);
  addKeepFaceZ(b, materials, 29, 58, glazed);

  // Four secondary hollow towers reproduce the reference's stepped inner
  // skyline while retaining the open courtyard and roofless keep platform.
  for (const x of [26, 52]) {
    for (const z of [22, 52]) addKeepShoulderTower(b, materials, x, z);
  }

  // Timber corners and eave beams echo the warm framing in the reference.
  for (const x of [29, 58]) {
    for (const z of [25, 58]) b.box(materials.structure, x, 6, z, 1, 32, 1);
  }
  b.box(materials.structure, 29, 37, 25, 30, 1, 1)
    .box(materials.structure, 29, 37, 58, 30, 1, 1);

  // The inner keep has no house-like pitched roof. It terminates as an open
  // crenellated stone platform so the castle reads as one defensive complex.
  addCrenellatedRing(b, materials.wall, 28, 38, 24, 32, 36, 5);
}

function addKeepShoulderTower(b, materials, x, z) {
  b.box(materials.foundation, x, 3, z, 10, 3, 10)
    .box(materials.wall, x, 6, z, 1, 34, 10)
    .box(materials.wall, x + 9, 6, z, 1, 34, 10)
    .box(materials.wall, x + 1, 6, z, 8, 34, 1)
    .box(materials.wall, x + 1, 6, z + 9, 8, 34, 1)
    .box(materials.foundation, x - 1, 39, z - 1, 12, 2, 12)
    .box(materials.floor, x, 41, z, 10, 1, 10);
  addCrenellatedRing(b, materials.wall, x - 1, 42, z - 1, 12, 12, 4);
}

function addKeepFaceX(b, materials, x, z, front, glazed) {
  const windowA = [29, 34];
  const windowB = [49, 54];
  const door = front ? [39, 45] : null;
  const segments = [
    [z, 28], [35, 38], [46, 48], [55, 58],
  ];
  for (const [from, to] of segments) b.box(materials.wall, x, 6, from, 1, 32, to - from + 1);

  for (const [from, to] of [windowA, windowB]) {
    b.box(materials.wall, x, 6, from, 1, 11, to - from + 1)
      .box(materials.wall, x, 25, from, 1, 13, to - from + 1);
    addWindowTrimX(b, materials, x + (front ? 1 : -1), from, to, glazed, x);
  }

  if (door) {
    b.box(materials.wall, x, 16, door[0], 1, 22, door[1] - door[0] + 1);
  } else {
    b.box(materials.wall, x, 6, 39, 1, 11, 7)
      .box(materials.wall, x, 25, 39, 1, 13, 7);
    addWindowTrimX(b, materials, x - 1, 39, 45, glazed, x);
  }
}

function addKeepFaceZ(b, materials, x, z, glazed) {
  // Two broad side windows per elevation.
  const windows = [[36, 42], [47, 53]];
  b.box(materials.wall, x, 6, z, 7, 32, 1)
    .box(materials.wall, 43, 6, z, 4, 32, 1)
    .box(materials.wall, 54, 6, z, 5, 32, 1);
  for (const [from, to] of windows) {
    b.box(materials.wall, from, 6, z, to - from + 1, 11, 1)
      .box(materials.wall, from, 25, z, to - from + 1, 13, 1);
    b.box(materials.structure, from - 1, 16, z, 1, 10, 1)
      .box(materials.structure, to + 1, 16, z, 1, 10, 1)
      .box(materials.structure, from - 1, 16, z, to - from + 3, 1, 1)
      .box(materials.structure, from - 1, 25, z, to - from + 3, 1, 1);
    if (glazed) b.box(materials.glazing, from, 17, z, to - from + 1, 8, 1);
  }
}

function addWindowTrimX(b, materials, trimX, from, to, glazed, wallX) {
  b.box(materials.structure, trimX, 16, from - 1, 1, 10, 1)
    .box(materials.structure, trimX, 16, to + 1, 1, 10, 1)
    .box(materials.structure, trimX, 16, from - 1, 1, 1, to - from + 3)
    .box(materials.structure, trimX, 25, from - 1, 1, 1, to - from + 3)
    .box(materials.roof, trimX + (trimX > wallX ? 1 : -1), 26, from - 1, 2, 1, to - from + 3);
  if (glazed) b.box(materials.glazing, wallX, 17, from, 1, 8, to - from + 1);
}

function addCentralTower(b, materials, glazed) {
  // A hollow stone transition rises directly from the open keep platform.
  b.box(materials.wall, 34, 38, 31, 2, 8, 22)
    .box(materials.wall, 52, 38, 31, 2, 8, 22)
    .box(materials.wall, 36, 38, 31, 16, 8, 2)
    .box(materials.wall, 36, 38, 51, 16, 8, 2);

  // Broad stone terrace and parapet support the upper tower.
  b.box(materials.foundation, 34, 43, 31, 20, 3, 22)
    .box(materials.floor, 35, 46, 32, 18, 1, 20);
  addCrenellatedRing(b, materials.wall, 33, 47, 30, 22, 24, 5);

  // Hollow upper tower with four high window openings.
  addUpperTowerFaceX(b, materials, 37, glazed);
  addUpperTowerFaceX(b, materials, 51, glazed);
  addUpperTowerFaceZ(b, materials, 34, glazed);
  addUpperTowerFaceZ(b, materials, 49, glazed);
  b.box(materials.floor, 39, 64, 36, 12, 1, 13);

  // Dark timber-framed slit windows on every visible axis.
  for (const z of [40, 45]) {
    b.box(materials.structure, 53, 52, z - 1, 1, 9, 1)
      .box(materials.structure, 53, 52, z + 2, 1, 9, 1)
      .box(materials.structure, 53, 52, z - 1, 1, 1, 4)
      .box(materials.structure, 53, 60, z - 1, 1, 1, 4);
  }
  for (const x of [42, 47]) {
    b.box(materials.structure, x - 1, 52, 33, 1, 9, 1)
      .box(materials.structure, x + 2, 52, 33, 1, 9, 1)
      .box(materials.structure, x - 1, 52, 33, 4, 1, 1)
      .box(materials.structure, x - 1, 60, 33, 4, 1, 1);
  }

  // Castle-crown battlements wrap around the stepped blue pyramidal roof.
  addCrenellatedRing(b, materials.wall, 36, 65, 33, 18, 19, 4);
  const roofLayers = [
    [38, 66, 35, 14, 15], [39, 67, 36, 12, 13], [40, 68, 37, 10, 11],
    [41, 69, 38, 8, 9], [42, 70, 39, 6, 7], [43, 71, 40, 4, 5],
    [44, 72, 41, 2, 3],
  ];
  for (const [x, y, z, w, d] of roofLayers) b.box(materials.roof, x, y, z, w, 1, d);

  // Highest flag mirrors the reference's blue pennant and amber finial.
  b.box(materials.structure, 44, 73, 42, 1, 11, 1)
    .box(materials.lantern, 44, 84, 42, 1, 1, 1)
    .box(materials.banner, 45, 80, 42, 5, 2, 1)
    .box(materials.banner, 50, 79, 42, 4, 2, 1);
}

function addUpperTowerFaceX(b, materials, x, glazed) {
  for (const [from, to] of [[34, 39], [42, 44], [47, 50]]) {
    b.box(materials.wall, x, 47, from, 2, 18, to - from + 1);
  }
  for (const [from, to] of [[40, 41], [45, 46]]) {
    b.box(materials.wall, x, 47, from, 2, 6, to - from + 1)
      .box(materials.wall, x, 60, from, 2, 5, to - from + 1);
    if (glazed) b.box(materials.glazing, x, 53, from, 2, 7, to - from + 1);
  }
}

function addUpperTowerFaceZ(b, materials, z, glazed) {
  for (const [from, to] of [[39, 41], [44, 46], [49, 50]]) {
    b.box(materials.wall, from, 47, z, to - from + 1, 18, 2);
  }
  for (const [from, to] of [[42, 43], [47, 48]]) {
    b.box(materials.wall, from, 47, z, to - from + 1, 6, 2)
      .box(materials.wall, from, 60, z, to - from + 1, 5, 2);
    if (glazed) b.box(materials.glazing, from, 53, z, to - from + 1, 7, 2);
  }
}

function addBannersAndLights(b, materials) {
  // Blue-and-amber heraldic banners on the two front towers.
  for (const z of [11, 115]) addBannerX(b, materials, 144, 22, z, 9, 15);

  // Smaller standards break up the long front wall.
  for (const z of [37, 91]) addBannerX(b, materials, 130, 13, z, 7, 11);

  // Matching standards on both long walls make every rotated view readable.
  for (const x of [43, 96]) {
    addBannerZ(b, materials, x, 13, 21, 7, 11);
    addBannerZ(b, materials, x, 13, 114, 7, 11);
  }

  // Warm lamps mark the gate and wall walk without becoming terrain props.
  for (const z of [54, 81]) {
    b.box(materials.structure, 149, 9, z, 1, 6, 1)
      .box(materials.lantern, 149, 15, z, 2, 2, 2)
      .box(materials.foundation, 148, 17, z - 1, 4, 1, 4);
  }
  b.repeat(materials.structure, 129, 31, 31, 1, 4, 1, 11, 0, 0, 7)
    .repeat(materials.lantern, 129, 35, 31, 1, 2, 1, 11, 0, 0, 7)
    .repeat(materials.structure, 105, 23, 48, 1, 5, 1, 6, 0, 0, 8)
    .repeat(materials.lantern, 105, 28, 48, 1, 2, 1, 6, 0, 0, 8);
}

function addBannerX(b, materials, x, y, z, width, height) {
  b.box(materials.lantern, x, y, z, 1, 1, width)
    .box(materials.lantern, x, y + height - 1, z, 1, 1, width)
    .box(materials.lantern, x, y + 1, z, 1, height - 2, 1)
    .box(materials.lantern, x, y + 1, z + width - 1, 1, height - 2, 1)
    .box(materials.banner, x, y + 1, z + 1, 1, height - 3, width - 2)
    .box(materials.lantern, x, y + 4, z + Math.floor(width / 2), 1, height - 8, 1)
    .box(materials.lantern, x, y + Math.floor(height / 2), z + 2, 1, 1, width - 4);
}

function addBannerZ(b, materials, x, y, z, width, height) {
  b.box(materials.lantern, x, y, z, width, 1, 1)
    .box(materials.lantern, x, y + height - 1, z, width, 1, 1)
    .box(materials.lantern, x, y + 1, z, 1, height - 2, 1)
    .box(materials.lantern, x + width - 1, y + 1, z, 1, height - 2, 1)
    .box(materials.banner, x + 1, y + 1, z, width - 2, height - 3, 1)
    .box(materials.lantern, x + Math.floor(width / 2), y + 4, z, 1, height - 8, 1)
    .box(materials.lantern, x + 2, y + Math.floor(height / 2), z, width - 4, 1, 1);
}

function addCrenellatedRing(b, material, x, y, z, width, depth, step) {
  const xCount = Math.floor((width - 2) / step) + 1;
  const zCount = Math.floor((depth - 2) / step) + 1;
  b.repeat(material, x, y, z, 2, 4, 2, xCount, step, 0, 0)
    .repeat(material, x, y, z + depth - 2, 2, 4, 2, xCount, step, 0, 0)
    .repeat(material, x, y, z, 2, 4, 2, zCount, 0, 0, step)
    .repeat(material, x + width - 2, y, z, 2, 4, 2, zCount, 0, 0, step);
}

function offsetBuilder(target, offsetX, offsetZ) {
  return {
    box(material, x, y, z, w = 1, h = 1, d = 1) {
      target.box(material, x + offsetX, y, z + offsetZ, w, h, d);
      return this;
    },
    repeat(material, x, y, z, w, h, d, count, dx = 0, dy = 0, dz = 0) {
      target.repeat(material, x + offsetX, y, z + offsetZ, w, h, d, count, dx, dy, dz);
      return this;
    },
    gable(material, x, y, z, width, depth) {
      target.gable(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
    gableTrim(material, x, y, z, width, depth) {
      target.gableTrim(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
    gableFill(material, x, y, z, width, depth = 1) {
      target.gableFill(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
    gableZ(material, x, y, z, width, depth) {
      target.gableZ(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
    gableTrimZ(material, x, y, z, width, depth) {
      target.gableTrimZ(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
    gableFillZ(material, x, y, z, width, depth) {
      target.gableFillZ(material, x + offsetX, y, z + offsetZ, width, depth);
      return this;
    },
  };
}
