import { createBlueprint } from "../chunk.js/ncm/blueprint-codec.js";
import { buildingStylePreset } from "../chunk.js/construction/building-style-catalog.js";
import { ARCHITECTURAL_MATERIAL_ID } from "../chunk.js/construction/architectural-material-catalog.js";
import { WOOD_MATERIAL_ID } from "../chunk.js/construction/wood-material-catalog.js";

/**
 * Doorless coastal cottage with a raised shell, wraparound viewing deck,
 * panoramic glazing and a deep tiled roof. Terrain, water and vegetation are
 * deliberately excluded so the NCM remains a portable building blueprint.
 */
export function createSeasideCottage({ style = "coastal", roofMaterial = null, glazed = true } = {}) {
  const preset = buildingStylePreset(style);
  const materials = {
    ...preset.materials,
    roof: roofMaterial ?? preset.materials.roof,
    deck: WOOD_MATERIAL_ID.woodenPlank,
    lantern: ARCHITECTURAL_MATERIAL_ID.amberGlassPanel,
    coastalBlue: ARCHITECTURAL_MATERIAL_ID.blueCeramicTile,
  };
  const b = createBlueprint({ x: 38, y: 29, z: 32 }, `Sea Breeze Cottage · ${preset.name}`);

  // Six stone piers raise the cottage above wet coastal ground. The finished
  // floor starts at y=4 and the volume above it remains hollow.
  b.repeat(materials.foundation, 8, 0, 8, 2, 4, 2, 3, 9, 0, 0)
    .repeat(materials.foundation, 8, 0, 22, 2, 4, 2, 3, 9, 0, 0)
    .box(materials.floor, 7, 4, 7, 22, 1, 18);

  // Salt-treated plank deck wraps around the sea-facing front and both sides.
  b.box(materials.deck, 29, 4, 6, 5, 1, 20)
    .box(materials.deck, 7, 4, 5, 22, 1, 2)
    .box(materials.deck, 7, 4, 25, 22, 1, 2)
    .box(materials.foundation, 34, 0, 13, 3, 1, 6)
    .box(materials.deck, 33, 1, 13, 3, 1, 6)
    .box(materials.deck, 32, 2, 13, 3, 1, 6)
    .box(materials.deck, 31, 3, 13, 3, 1, 6);

  // Front wall: a seven-voxel panoramic window beside a 6 × 7 open portal.
  b.box(materials.wall, 28, 5, 7, 1, 10, 1)
    .box(materials.wall, 28, 5, 8, 1, 2, 7)
    .box(materials.wall, 28, 12, 8, 1, 3, 13)
    .box(materials.wall, 28, 5, 21, 1, 10, 4);

  // Rear wall surrounds a broad central window.
  b.box(materials.wall, 7, 5, 7, 1, 10, 5)
    .box(materials.wall, 7, 5, 20, 1, 10, 5)
    .box(materials.wall, 7, 5, 12, 1, 2, 8)
    .box(materials.wall, 7, 12, 12, 1, 3, 8);

  // Both side walls carry wide horizontal windows for cross-ventilation.
  for (const z of [7, 24]) {
    b.box(materials.wall, 8, 5, z, 4, 10, 1)
      .box(materials.wall, 24, 5, z, 4, 10, 1)
      .box(materials.wall, 12, 5, z, 12, 2, 1)
      .box(materials.wall, 12, 12, z, 12, 3, 1);
  }

  if (glazed) {
    b.box(materials.glazing, 28, 7, 8, 1, 5, 7)
      .box(materials.glazing, 7, 7, 12, 1, 5, 8)
      .box(materials.glazing, 12, 7, 7, 12, 5, 1)
      .box(materials.glazing, 12, 7, 24, 12, 5, 1);
  }

  // Timber corners, eaves and a projecting frame define the empty entrance.
  b.box(materials.structure, 7, 5, 7, 1, 10, 1)
    .box(materials.structure, 7, 5, 24, 1, 10, 1)
    .box(materials.structure, 28, 5, 7, 1, 10, 1)
    .box(materials.structure, 28, 5, 24, 1, 10, 1)
    .box(materials.structure, 7, 14, 7, 22, 1, 1)
    .box(materials.structure, 7, 14, 24, 22, 1, 1)
    .box(materials.structure, 29, 4, 14, 1, 9, 1)
    .box(materials.structure, 29, 4, 21, 1, 9, 1)
    .box(materials.structure, 29, 12, 14, 1, 1, 8);

  // Blue ceramic fascia makes the low coastal silhouette readable from afar.
  b.box(materials.coastalBlue, 8, 13, 6, 20, 1, 1)
    .box(materials.coastalBlue, 8, 13, 25, 20, 1, 1);

  // Front deck railing stops on either side of the stair/entrance axis.
  b.box(materials.structure, 33, 6, 7, 1, 1, 6)
    .box(materials.structure, 33, 6, 20, 1, 1, 5)
    .box(materials.structure, 33, 5, 7, 1, 3, 1)
    .box(materials.structure, 33, 5, 12, 1, 3, 1)
    .box(materials.structure, 33, 5, 20, 1, 3, 1)
    .box(materials.structure, 33, 5, 24, 1, 3, 1);

  // Two warm porch lights flank the open portal without filling it.
  for (const z of [13, 22]) {
    b.box(materials.structure, 30, 5, z, 1, 3, 1)
      .box(materials.lantern, 30, 8, z, 1, 2, 1)
      .box(materials.foundation, 30, 10, z, 1, 1, 1);
  }

  // Deep ice-blue gable roof with one-voxel overhang around the wall shell.
  b.gableFillZ(materials.wall, 7, 15, 7, 1, 18)
    .gableFillZ(materials.wall, 28, 15, 7, 1, 18)
    .gableZ(materials.roof, 6, 14, 6, 24, 20)
    .gableTrimZ(materials.structure, 6, 14, 6, 24, 20);

  return b;
}
