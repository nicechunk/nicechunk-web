import { createBlueprint } from "../chunk.js/ncm/blueprint-codec.js";
import { buildingStylePreset } from "../chunk.js/construction/building-style-catalog.js";
import { ARCHITECTURAL_MATERIAL_ID } from "../chunk.js/construction/architectural-material-catalog.js";

/**
 * Large doorless freight warehouse with two open loading portals, a raised
 * dock, high clerestory glazing and one uninterrupted hollow storage hall.
 * Cargo, doors, roads and terrain are intentionally separate from the NCM.
 */
export function createFreightWarehouse({ style = "castle", roofMaterial = null, glazed = true } = {}) {
  const preset = buildingStylePreset(style);
  const materials = {
    ...preset.materials,
    roof: roofMaterial ?? preset.materials.roof,
    lantern: ARCHITECTURAL_MATERIAL_ID.amberGlassPanel,
  };
  const b = createBlueprint({ x: 48, y: 36, z: 38 }, `Freight Warehouse · ${preset.name}`);

  // Full moisture-resistant base and finished warehouse floor.
  b.box(materials.foundation, 7, 0, 6, 34, 2, 26)
    .box(materials.floor, 8, 2, 7, 32, 1, 24);

  // Front wall surrounds two 9 × 10 open cargo portals. No door leaf, shutter
  // or collision voxel is embedded in either bay.
  b.box(materials.wall, 39, 5, 7, 1, 15, 2)
    .box(materials.wall, 39, 5, 18, 1, 15, 3)
    .box(materials.wall, 39, 5, 30, 1, 15, 1)
    .box(materials.wall, 39, 15, 9, 1, 5, 9)
    .box(materials.wall, 39, 15, 21, 1, 5, 9);

  // Rear wall surrounds one broad clerestory opening.
  b.box(materials.wall, 8, 5, 7, 1, 15, 4)
    .box(materials.wall, 8, 5, 27, 1, 15, 4)
    .box(materials.wall, 8, 5, 11, 1, 5, 16)
    .box(materials.wall, 8, 15, 11, 1, 5, 16);

  // Each side wall surrounds three high ventilation-window openings.
  for (const z of [7, 30]) {
    for (const x of [9, 18, 27, 36]) b.box(materials.wall, x, 5, z, 3, 15, 1);
    b.repeat(materials.wall, 12, 5, z, 6, 5, 1, 3, 9, 0, 0)
      .repeat(materials.wall, 12, 15, z, 6, 5, 1, 3, 9, 0, 0);
  }

  if (glazed) {
    b.box(materials.glazing, 8, 10, 11, 1, 5, 16);
    for (const z of [7, 30]) {
      b.repeat(materials.glazing, 12, 10, z, 6, 5, 1, 3, 9, 0, 0);
    }
  }

  // Structural corners, eave beams and external cargo-bay frames.
  b.box(materials.structure, 8, 5, 7, 1, 15, 1)
    .box(materials.structure, 8, 5, 30, 1, 15, 1)
    .box(materials.structure, 39, 5, 7, 1, 15, 1)
    .box(materials.structure, 39, 5, 30, 1, 15, 1)
    .box(materials.structure, 8, 19, 7, 32, 1, 1)
    .box(materials.structure, 8, 19, 30, 32, 1, 1)
    .box(materials.structure, 40, 4, 8, 1, 12, 1)
    .box(materials.structure, 40, 4, 18, 1, 12, 1)
    .box(materials.structure, 40, 4, 20, 1, 12, 1)
    .box(materials.structure, 40, 4, 30, 1, 12, 1)
    .box(materials.structure, 40, 15, 8, 1, 1, 11)
    .box(materials.structure, 40, 15, 20, 1, 1, 11);

  // Raised loading dock and broad stepped freight ramp.
  b.box(materials.foundation, 40, 2, 7, 5, 2, 24)
    .box(materials.floor, 40, 4, 7, 5, 1, 24)
    .box(materials.foundation, 45, 0, 13, 3, 1, 12)
    .box(materials.floor, 44, 1, 13, 3, 1, 12)
    .box(materials.floor, 43, 2, 13, 3, 1, 12)
    .box(materials.floor, 42, 3, 13, 3, 1, 12);

  // Dark weather canopy protects both open loading bays.
  b.box(materials.roof, 40, 17, 6, 6, 1, 26)
    .box(materials.structure, 45, 5, 7, 1, 12, 1)
    .box(materials.structure, 45, 5, 30, 1, 12, 1);

  // Warm dock lights sit outside the portals and never close the openings.
  for (const z of [6, 31]) {
    b.box(materials.structure, 41, 10, z, 1, 3, 1)
      .box(materials.lantern, 41, 13, z, 1, 2, 1)
      .box(materials.foundation, 41, 15, z, 1, 1, 1);
  }

  // Tall charcoal gable roof and a compact ridge ventilation stack.
  b.gableFillZ(materials.wall, 8, 20, 7, 1, 24)
    .gableFillZ(materials.wall, 39, 20, 7, 1, 24)
    .gableZ(materials.roof, 7, 19, 6, 34, 26)
    .gableTrimZ(materials.structure, 7, 19, 6, 34, 26)
    .box(materials.chimney, 22, 32, 18, 4, 3, 2)
    .box(materials.foundation, 21, 35, 17, 6, 1, 4);

  return b;
}
