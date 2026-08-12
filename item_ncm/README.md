# ITEM_NCM

ITEM_NCM is the public NiceChunk forge-item blueprint registry. It follows the same filename-indexed, lazy-loaded catalog model as `build_ncm`, while using the current NCF1 forge format instead of the building-specific NCM format.

## Collection layout

- `json/catalog.json` contains item JSON filenames only.
- `json/<category>/<item>.json` is one independent, self-contained item definition.
- `concepts/<category>/<item>-vN.webp` preserves the Imagegen concept reference used before NCF1 modeling.
- `locales/<locale>.json` contains the page shell translations for all nine supported languages.
- Every item JSON contains its own nine-language names and descriptions.
- `tools/generate-items.mjs` is the canonical source for the initial collection and regenerates every item JSON deterministically.

The registry currently contains 58 blueprints across mining tools, forestry and farming, workshop tools, weapons, building fittings, lighting, furniture, containers, cooking, commerce, construction, books and writing, interior decor, signage, exterior decor, and hand-held civic props. New designs begin with an Imagegen material-style concept; the resulting item JSON records the concept path, provenance, version, and SHA-256 before the forge encoding is accepted.

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
10. Bound books keep every page block inside its cover planes with zero positive-volume intersection, closed volumes keep a portrait cover ratio, and rigid page preview metadata disables cloth deformation that could cross the binding.
11. Frame-bound textiles keep cloth flush against all four rails, keep dyed motifs on the cloth face without intersections, and disable free-cloth deformation that would detach the fabric from its frame.
12. Multi-drawer cabinets preserve a human-scale portrait footprint, align every iron pull with one closed drawer, and reject any positive-volume component intersection.
13. Street lanterns keep a stable square plinth, a centered high post, and an amber chamber enclosed by top and bottom plates with four aligned corner rails and no component intersection.
14. Public benches preserve a two-person human scale, a safe seat height, four supporting legs, two supported back slats, and a symmetric iron-braced underframe without component intersection.
15. Wall clocks keep a human-scale portrait backplate, a connected wall hanger, ordered timber-dial/copper-bezel/glass layers, twelve iron hour studs, readable copper hands, and a framed glass pendulum chamber without component intersection.
16. Projecting shop signs keep a wall-supported iron bracket, two aligned hangers, a timber panel enclosed by four rails, face-mounted studs, and a layered dyed emblem at human-readable village scale.
17. Public notice boards keep two ground-anchored posts, four framed timber posting slats, visible iron posting points, and a connected three-tier rain hood at a scale readable beside the canonical player.
18. Town-crier handbells stay below thirty percent of the canonical 1.75 m player height, keep a front-facing grip through all 27 motion samples, and preserve a connected timber handle, iron collar, flared copper body, hollow mouth rim, and captive clapper.
19. Window-box planters preserve a human-scale wall-mounted trough, keep compost enclosed above a continuous timber floor, bind both corners with iron bands, carry their load on two complete wall brackets, and keep each colored bloom planted into the soil bed.
20. Public drinking troughs keep a low human-scale basin on two grounded stone feet, enclose a still-water plane below four continuous stone rim walls, and connect a timber back rail and iron drinking spout to the basin.
21. Roadside wells preserve a human-scale grounded stone curb, continuously iron-anchored timber posts, a face-seated upper crossbeam and spindle, a captive hollow bucket suspended inside the curb without intersections, and a complete outward crank with a wooden grip.
22. Roadside direction signposts stay at canonical player height, keep a compact grounded stone-and-iron post stack, and preserve three staggered, face-fastened timber arms with genuinely machined left-right-left arrow silhouettes and no encoded lettering.
23. Public litter bins keep a compact street scale, four grounded iron feet, a supported timber floor, four continuous timber walls around a usable open cavity, two exterior iron bands, an unobstructed four-piece top rim, and a closed side-handle loop mounted outside the front wall.
24. Inn coat racks stand at the canonical 1.75 m player height, keep a four-way grounded base and continuous iron-collared timber post, and preserve two perpendicular pairs of face-connected hooks with raised retaining stops and no component intersections.
25. Inn bedside tables keep a compact bed-height top, four grounded iron-capped timber legs, a supported open lower shelf, a closed face-pulled drawer, and four flush top corner plates without component intersections.
26. Inn washstands keep a waist-height basin on four grounded iron-collared timber legs, a supported lower shelf, a continuous copper floor and four-wall usable open cavity, and an outward face-connected towel rail without component intersections.
27. Inn single-bed frames preserve a 1.9 m sleeping length and narrow human-scale width, four grounded iron-capped posts, continuous long rails, a captive slatted headboard, a connected low footboard, and four evenly spaced cross-bed supports without component intersections.
28. Inn room-key boards preserve a portrait wall-readable scale, a captive framed timber backboard, two connected upper hangers, six aligned blank label plates with no encoded lettering, and six face-rooted voxel-machined iron hooks with outward arms and raised retaining stops.
29. Inn reception counters keep a human-scale customer countertop on four grounded iron-footed posts, a captive three-panel customer facade between two iron-banded beams, two ordered open staff-side shelves, and connected side aprons without component intersections.
30. Inn luggage racks keep a knee-height upper luggage deck on four grounded iron-footed timber legs, four separately supported upper slats, a lower four-slat open shoe shelf connected between both leg pairs, and four face-connected iron corner plates without component intersections.

`verification.chainMinted` remains `false` because this library validates blueprint readiness; it does not claim that a blueprint PDA has already been created.

## Add or revise an item

Edit `ITEM_NAMES` and `ITEM_SPECS` in `tools/generate-items.mjs`, using only material IDs present in the current smelting rules. Keep dimensions in Q6 world units and preserve positive-area connections between components. Then run:

```sh
node item_ncm/tools/generate-items.mjs
node item_ncm/tests/catalog.test.mjs
node item_ncm/tests/i18n.test.mjs
node item_ncm/tests/browser.test.mjs
```

Add the generated item path to no hand-maintained JavaScript list: the generator updates `json/catalog.json`, and the browser derives categories and item IDs directly from those paths.
