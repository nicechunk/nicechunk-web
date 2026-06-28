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
sed -n '1,220p' docs/fourier-pickaxe-static-display.md
sed -n '1,220p' fourier-pickaxe/README.md
```

Runtime validation should be performed on a workstation with:

- WebGL-capable browser
- GPU acceleration enabled
- local `.vox` test asset
- enough thermal and power headroom for sustained proof-search testing

## Documentation-Only Showcase

When a reviewer or automated agent cannot access a GPU, the correct output is a documentation-only showcase rather than a runtime claim. The reviewer should describe the intended workflow, the file boundaries, and the evidence that can be checked statically:

- `fourier-pickaxe/index.html` exposes three synchronized panes for source model, function redraw, and proof candidate.
- `fourier-pickaxe/index.html` also exposes a static `Documentation-only review` panel for CPU-only repository review.
- `fourier-pickaxe/main.js` defines the local VOX read path, G0 palette mapping, box-basis compression, payload encoding, and proof-search preview.
- `docs/fourier-pickaxe-showcase.md` explains the project as a GPU-gated research surface and lists what can and cannot be proven without target hardware.
- `docs/fourier-pickaxe-static-display.md` provides the approved CPU-only display packet with allowed claims, disallowed claims, and later GPU evidence requirements.
- `npm run audit:fourier-pickaxe-docs` verifies that public documentation keeps the GPU limitation, payload format, security boundary, and review path visible.

Do not present screenshots, benchmark numbers, proof-search rates, or visual fidelity claims unless they were produced on a GPU-capable review machine.

## GPU-Free Demonstration Package

Use this package when the review machine cannot run the page with WebGL/GPU acceleration. It is designed to be honest enough for technical due diligence while still giving reviewers a clear product picture.

### Demo Narrative

Fourier Pickaxe is a browser lab for turning local voxel art into compact deterministic function bytes. The planned live demo is simple: load a `.vox` model, quantize it into the NiceChunk G0 palette, merge same-color voxels into box basis functions, emit a `0:<base64url-bytes>` payload, and compare the redraw against the original model.

In this environment, only the documentation and source path are being demonstrated. The live GPU validation is deferred to a workstation that can actually render and sustain the proof-search preview.

### Presenter Checklist

- State that this is a GPU-gated research surface, not a production miner.
- Show the local-only input boundary: `.vox` files are selected in the browser and are not uploaded.
- Show the deterministic codec path: parser, palette mapping, basis merge, payload bytes, redraw.
- Show the security boundary: no wallet signing, no deployment endpoint, no server credential, no GitHub token.
- Defer screenshots, visual fidelity, frame stability, and proof-search speed until GPU hardware is available.

### Reviewer Handoff

The safest non-GPU handoff is:

```text
Fourier Pickaxe can be reviewed statically for architecture, scope, codec intent, and security boundaries. Runtime visual behavior is intentionally not claimed here because this environment cannot provide the required GPU/WebGL evidence.
```

## Static Display Summary

For CPU-only GitHub review, present Fourier Pickaxe as a static evidence package:

| Item | Static display |
| --- | --- |
| Product surface | A browser lab for converting local `.vox` assets into compact deterministic function payloads. |
| Runtime dependency | GPU/WebGL hardware for meaningful visual and proof-search validation. |
| Reviewable without GPU | Documentation, HTML controls, codec path, local input boundary, parser usage, and security notes. |
| Not reviewable without GPU | Frame stability, visual fidelity, proof-search responsiveness, screenshots, and benchmark claims. |
| Public safety boundary | No private server address, no deployment script, no token, no wallet key, and no upload endpoint. |

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
