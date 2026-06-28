# NiceChunk Asset Manifest

NiceChunk publishes a generated asset manifest at `public/asset-manifest.json`.

The manifest gives reviewers a deterministic inventory of public media, character references, wallet icons, NCM samples, and generated visual references. It exists so asset review does not depend on filename memory or informal screenshots.

## Generate

```bash
npm run assets:manifest
```

`npm run build` also regenerates the manifest through `prebuild`.

## Fields

| Field | Meaning |
| --- | --- |
| `path` | Repository-relative path. |
| `mediaType` | Detected media type based on extension. |
| `bytes` | File size in bytes. |
| `sha256` | Content hash for provenance review. |
| `dimensions` | Pixel or vector dimensions when available. |
| `surface` | Product or review surface that uses the asset. |
| `sourceStatus` | Source category, such as project media, generated reference, wallet brand, or sample model. |
| `canonical` | Whether the file should be treated as a canonical public asset rather than a preview or reference. |

## Review Rules

- Asset additions should be accompanied by a regenerated manifest.
- Large binary changes should be reviewed by `sha256`, dimensions, product surface, and source status.
- Wallet brand assets and sample models should keep clear source status.
- Generated references under `p_d/` are not canonical product assets unless promoted through a documented review.
- Public pages should reference canonical assets when they need stable product identity.

## Split Repository

The `nicechunk-assets` split repository includes this manifest so reviewers can inspect assets without cloning the full working tree.
