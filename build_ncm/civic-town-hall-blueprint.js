import { createBlueprint } from "../chunk.js/ncm/blueprint-codec.js";
import { buildingStylePreset } from "../chunk.js/construction/building-style-catalog.js";
import { ARCHITECTURAL_MATERIAL_ID } from "../chunk.js/construction/architectural-material-catalog.js";

/**
 * Enlarged civic town hall reconstructed from the supplied multi-view design.
 *
 * Each source design cell expands to four NCM voxels, producing a 28 × 28
 * square civic shell from the reference's 7 × 7 plan. The entrance is an open
 * portal: door leaves are separate placeable objects and never baked into this
 * blueprint. Terrain and vegetation are intentionally excluded.
 */
export function createCivicTownHall({ style = "coastal", roofMaterial = null, glazed = true } = {}) {
  const preset = buildingStylePreset(style);
  const materials = {
    ...preset.materials,
    roof: roofMaterial ?? preset.materials.roof,
    lantern: ARCHITECTURAL_MATERIAL_ID.amberGlassPanel,
    civicBlue: ARCHITECTURAL_MATERIAL_ID.blueCeramicTile,
  };
  const b = createBlueprint({ x: 44, y: 42, z: 40 }, `Civic Town Hall · ${preset.name}`);

  // Raised stone base, finished floor and a hollow traversable interior.
  b.box(materials.foundation, 7, 0, 5, 30, 1, 30)
    .box(materials.floor, 8, 1, 6, 28, 1, 28);

  // Two-course plinth around the shell.
  b.box(materials.foundation, 8, 2, 6, 28, 2, 1)
    .box(materials.foundation, 8, 2, 33, 28, 2, 1)
    .box(materials.foundation, 8, 2, 7, 1, 2, 26)
    .box(materials.foundation, 35, 2, 7, 1, 2, 26);

  // Front gable wall surrounds a 10 × 9 open portal for a separate door item.
  b.box(materials.wall, 35, 4, 6, 1, 14, 9)
    .box(materials.wall, 35, 4, 25, 1, 14, 9)
    .box(materials.wall, 35, 13, 15, 1, 5, 10);

  // Rear wall surrounding a central window.
  b.box(materials.wall, 8, 4, 6, 1, 14, 9)
    .box(materials.wall, 8, 4, 25, 1, 14, 9)
    .box(materials.wall, 8, 4, 15, 1, 4, 10)
    .box(materials.wall, 8, 13, 15, 1, 5, 10);

  // Both side walls surround broad rectangular windows.
  for (const z of [6, 33]) {
    b.box(materials.wall, 9, 4, z, 7, 14, 1)
      .box(materials.wall, 28, 4, z, 7, 14, 1)
      .box(materials.wall, 16, 4, z, 12, 4, 1)
      .box(materials.wall, 16, 13, z, 12, 5, 1);
  }

  // Glazing is explicit and can be removed without closing the openings.
  if (glazed) {
    b.box(materials.glazing, 8, 8, 15, 1, 5, 10)
      .box(materials.glazing, 16, 8, 6, 12, 5, 1)
      .box(materials.glazing, 16, 8, 33, 12, 5, 1);
  }

  // Timber corners, eave beams and a projecting frame around the open portal.
  b.box(materials.structure, 8, 4, 6, 1, 14, 1)
    .box(materials.structure, 8, 4, 33, 1, 14, 1)
    .box(materials.structure, 35, 4, 6, 1, 14, 1)
    .box(materials.structure, 35, 4, 33, 1, 14, 1)
    .box(materials.structure, 8, 17, 6, 28, 1, 1)
    .box(materials.structure, 8, 17, 33, 28, 1, 1)
    .box(materials.structure, 36, 3, 14, 1, 12, 1)
    .box(materials.structure, 36, 3, 25, 1, 12, 1)
    .box(materials.structure, 36, 14, 14, 1, 1, 12);

  // Broad ceremonial steps lead through the empty entrance portal.
  b.box(materials.foundation, 36, 0, 14, 6, 1, 12)
    .box(materials.foundation, 36, 1, 15, 4, 1, 10);

  // Triangular gable ends and deep blue stepped tile roof.
  b.gableFillZ(materials.wall, 8, 18, 6, 1, 28)
    .gableFillZ(materials.wall, 35, 18, 6, 1, 28)
    .gableZ(materials.roof, 7, 17, 5, 30, 30)
    .gableTrimZ(materials.structure, 7, 17, 5, 30, 30);

  // Civic crest on the front gable: stone surround, pale inset, blue center.
  b.box(materials.foundation, 36, 21, 16, 1, 6, 8)
    .box(materials.wall, 37, 22, 17, 1, 4, 6)
    .box(materials.civicBlue, 38, 23, 19, 1, 2, 2);

  // Ridge plinth, flagpole, gold cap and stepped blue civic flag.
  b.box(materials.foundation, 20, 32, 19, 4, 1, 2)
    .box(materials.structure, 21, 33, 19, 1, 9, 1)
    .box(materials.lantern, 21, 41, 19, 1, 1, 1)
    .box(materials.civicBlue, 22, 38, 19, 4, 2, 1)
    .box(materials.civicBlue, 26, 37, 19, 4, 2, 1)
    .box(materials.civicBlue, 30, 36, 19, 4, 2, 1);

  // Two compact amber civic lamps flank the entrance.
  for (const z of [12, 27]) {
    b.box(materials.foundation, 40, 0, z, 1, 1, 1)
      .box(materials.structure, 40, 1, z, 1, 7, 1)
      .box(materials.lantern, 40, 8, z, 1, 2, 1)
      .box(materials.foundation, 40, 10, z, 1, 1, 1);
  }

  return b;
}
