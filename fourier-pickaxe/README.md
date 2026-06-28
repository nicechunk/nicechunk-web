# Fourier Pickaxe

Fourier Pickaxe is a NiceChunk GPU-oriented research surface for compact voxel asset functions.

It is not a deployment script and does not contain private infrastructure. The page is intended to load local MagicaVoxel `.vox` assets in the browser, map their colors into the shared NiceChunk G0 palette, produce compact function bytes, and display how the asset can be redrawn from that payload.

## Scope

Fourier Pickaxe focuses on one problem:

> Can a voxel asset be represented as compact deterministic function data that is small enough for on-chain or proof-oriented workflows?

The current implementation demonstrates:

- local `.vox` file parsing through `src/vox/ncm.js`
- G0 global palette quantization
- same-color voxel merging into box basis functions
- compact payload encoding as `0:<base64url-bytes>`
- deterministic model hashing for target comparison
- a local proof-of-work style expression search preview
- three synchronized 3D panes for source, function redraw, and best proof candidate

## GPU Requirement

This surface is a GPU-oriented browser demo. Reviewers should not treat a CPU-only environment as a valid runtime proof for the visual or proof-search behavior.

For public repository review, use the documentation-first evidence path:

```bash
npm run audit:fourier-pickaxe-docs
sed -n '1,220p' docs/fourier-pickaxe-showcase.md
sed -n '1,220p' fourier-pickaxe/README.md
```

Runtime validation should be performed on a workstation with:

- WebGL-capable browser
- GPU acceleration enabled
- local `.vox` test asset
- enough thermal and power headroom for sustained proof-search testing

## Data Flow

```text
.vox file
  -> parse SIZE and XYZI chunks
  -> normalize voxels and colors
  -> map colors into G0 RGB332 palette
  -> merge same-color voxels into basis boxes
  -> encode [size, basis count, {color, x, y, z, w, d, h}...]
  -> redraw the asset from function bytes
```

All file parsing happens locally in the browser. No asset upload, wallet key, server address, or deployment credential is required for this surface.

## Review Boundaries

Reviewers should inspect:

- `fourier-pickaxe/index.html` for UI structure and accessible labels
- `fourier-pickaxe/main.js` for VOX normalization, basis generation, payload encoding, and proof-search behavior
- `fourier-pickaxe/styles.css` for responsive layout and non-marketing tool presentation
- `src/vox/ncm.js` for shared VOX/NCM parsing behavior
- `docs/fourier-pickaxe-showcase.md` for expected reviewer evidence and known limits

Do not treat this project as a production miner, final on-chain codec, or finalized economic proof. It is a research and display surface for reviewing the asset-function concept.

## Security Notes

- The surface does not require secrets.
- The surface does not require server endpoints.
- The surface does not require wallet signing.
- Uploaded `.vox` files stay local to the browser session.
- Public examples must use local files or documentation-safe placeholders.

## License

Apache-2.0. See the repository `LICENSE` and `NOTICE` files.
