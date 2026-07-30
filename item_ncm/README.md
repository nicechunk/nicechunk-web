# ITEM_NCM

ITEM_NCM is the public NiceChunk forge-item blueprint registry. It follows the same filename-indexed, lazy-loaded catalog model as `build_ncm`, while using the current NCF1 forge format instead of the building-specific NCM format.

## Collection layout

- `json/catalog.json` contains item JSON filenames only.
- `json/<category>/<item>.json` is one independent, self-contained item definition.
- `concepts/<category>/<item>-vN.webp` preserves the Imagegen concept reference used before NCF1 modeling.
- `locales/<locale>.json` contains the page shell translations for all nine supported languages.
- Every item JSON contains its own nine-language names and descriptions.
- `tools/generate-items.mjs` is the canonical source for the initial collection and regenerates every item JSON deterministically.

The registry currently contains 35 blueprints across mining tools, forestry and farming, workshop tools, weapons, building fittings, lighting, furniture, containers, cooking, and books and writing. New designs begin with an Imagegen material-style concept; the resulting item JSON records the concept path, provenance, version, and SHA-256 before the forge encoding is accepted.

## Forge guarantees

The generator rejects an item unless all of these checks pass:

1. Every material exists in the current `smelting-rules.json` and has a valid item code and unit volume.
2. All forge components form one connected assembly.
3. Hand-held items have one valid grip that clears the canonical avatar; placeable items have no grip.
4. Every hand-held design declares its work components and uses the fixed mount mapping `+X → +Y`, `+Y → -Z`, and `+Z → -X`; work ends must point forward and transverse heads must use source Z.
5. The exact restored mesh is mounted at game scale on the canonical 1.75 m avatar and checked through idle, walking, full swing, and three-pitch motion samples without body collision or grip detachment.
6. The current NCF1 v15 payload round-trips canonically and stays within 640 raw bytes.
7. `ForgeRuntimeCache` restores a non-empty game mesh from the encoded payload.
8. Dimensions, material requirements, bill of materials, runtime evidence, design hash, and SHA-256 are written into the item JSON.
9. When a concept reference is present, its category-bound filename and SHA-256 are validated and written into the item JSON.

`verification.chainMinted` remains `false` because this library validates blueprint readiness; it does not claim that a blueprint PDA has already been created.

## Add or revise an item

Edit `ITEM_NAMES` and `ITEM_SPECS` in `tools/generate-items.mjs`, using only material IDs present in the current smelting rules. Keep dimensions in Q6 world units and preserve positive-area connections between components. Then run:

```sh
node item_ncm/tools/generate-items.mjs
node item_ncm/tests/catalog.test.mjs
node item_ncm/tests/i18n.test.mjs
```

Add the generated item path to no hand-maintained JavaScript list: the generator updates `json/catalog.json`, and the browser derives categories and item IDs directly from those paths.
