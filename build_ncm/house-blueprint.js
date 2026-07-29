import { createBlueprint } from "../chunk.js/ncm/blueprint-codec.js";
import { buildingStylePreset } from "../chunk.js/construction/building-style-catalog.js";

/**
 * Hollow terracotta cottage shell derived from the supplied reference image.
 *
 * There is no terrain, vegetation, fence, door leaf, window frame or glass.
 * Every wall is assembled from thin boundary segments, leaving a traversable
 * empty interior, an open front doorway and a raw opening in the right wall.
 */
export function createReferenceCottage({ style = "cottage", roofMaterial = null, glazed = false } = {}) {
  const preset = buildingStylePreset(style);
  const materials = {
    ...preset.materials,
    roof: roofMaterial ?? preset.materials.roof,
  };
  const b = createBlueprint({ x: 24, y: 22, z: 18 }, `Hollow ${preset.name} Cottage`);

  // One structural foundation layer and one finish floor layer. Space above it
  // remains hollow and traversable.
  b.box(materials.foundation, 3, 0, 2, 16, 1, 13)
    .box(materials.floor, 4, 1, 3, 14, 1, 11);

  // Front wall around a 4 × 7 open doorway (x 7..10, y 2..8, z 3).
  b.box(materials.wall, 4, 2, 3, 3, 9, 1)
    .box(materials.wall, 11, 2, 3, 7, 9, 1)
    .box(materials.wall, 7, 9, 3, 4, 2, 1);

  // Rear and left walls are one voxel thick.
  b.box(materials.wall, 4, 2, 13, 14, 9, 1)
    .box(materials.wall, 4, 2, 4, 1, 9, 9);

  // Right wall surrounds a raw 4 × 4 opening with no frame or glass.
  b.box(materials.wall, 17, 2, 4, 1, 9, 3)
    .box(materials.wall, 17, 2, 11, 1, 9, 2)
    .box(materials.wall, 17, 2, 7, 1, 2, 4)
    .box(materials.wall, 17, 8, 7, 1, 3, 4);

  // The reference model keeps this raw opening empty. Glazing is an explicit
  // opt-in because a style's glass recommendation must not silently close it.
  if (glazed) b.box(materials.glazing, 17, 4, 7, 1, 4, 4);

  // Structural timber remains only at corners and under the two eaves.
  b.box(materials.structure, 4, 2, 3, 1, 9, 1)
    .box(materials.structure, 17, 2, 3, 1, 9, 1)
    .box(materials.structure, 4, 2, 13, 1, 9, 1)
    .box(materials.structure, 17, 2, 13, 1, 9, 1)
    .box(materials.structure, 3, 10, 2, 16, 1, 2)
    .box(materials.structure, 3, 10, 13, 16, 1, 2);

  // Two stone steps lead directly into the empty interior.
  b.box(materials.foundation, 7, 0, 0, 4, 1, 3)
    .box(materials.foundation, 8, 1, 1, 3, 1, 2);

  // Hollow gable shell and selectable stepped tile roof.
  b.gableFillZ(materials.wall, 4, 11, 3, 1, 11)
    .gableFillZ(materials.wall, 17, 11, 3, 1, 11)
    .gableZ(materials.roof, 3, 10, 2, 16, 13)
    .gableTrimZ(materials.structure, 3, 10, 2, 16, 13);

  // Narrow stone chimney; it does not fill the room below.
  b.box(materials.chimney, 13, 14, 7, 2, 5, 2)
    .box(materials.foundation, 12, 19, 6, 4, 1, 4);

  return b;
}
