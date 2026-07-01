# Fourier Voxel Showcase

Fourier Voxel is an independent GPU-oriented NiceChunk browser program for compact voxel asset functions. This document gives external reviewers and automated agents enough context to assess the `fourier-voxel/` source without requiring this environment to run the GPU workload.

## What It Demonstrates

The page presents a local browser workflow:

1. Load a MagicaVoxel `.vox` file.
2. Parse the model through the shared VOX/NCM parser.
3. Normalize colors into the NiceChunk G0 RGB332 palette.
4. Merge same-color voxels into deterministic box basis functions.
5. Encode the basis into compact function bytes.
6. Redraw the asset from those bytes.
7. Preview a local proof-of-work style expression search against the model hash.

The result is a reviewable demonstration of how voxel assets can move from raw editor files toward compact deterministic payloads.

## Documentation-First Review Path

This project needs a GPU-capable browser for meaningful runtime validation. In CPU-only or headless environments, use documentation and static source review instead:

```bash
npm run audit:fourier-pickaxe-docs
sed -n '1,220p' fourier-voxel/README.md
sed -n '1,220p' docs/fourier-pickaxe-showcase.md
sed -n '1,220p' fourier-voxel/index.html
sed -n '1,260p' fourier-voxel/main.js
```

The documentation audit checks that the public repository contains the minimum review material for the Fourier Voxel surface and that the declared GPU/runtime limitations are explicit.

For a shorter handoff packet that is designed specifically for CPU-only reviewers, use `docs/fourier-pickaxe-static-display.md`.

For a display-ready packet that is safe to read aloud or paste into a third-party review without claiming runtime results, use `docs/fourier-pickaxe-display-packet.md`.

## Documentation-Only Showcase

Use this section when the environment cannot run the GPU workload. It is intentionally written as a presentation card that can be copied into an external review, README summary, or repository handoff without overstating runtime proof.

| Topic | Reviewer-facing statement | Static evidence |
| --- | --- | --- |
| Product idea | Fourier Voxel explores whether voxel assets can be converted into compact deterministic function payloads for future on-chain or proof-oriented workflows. | `fourier-voxel/README.md`, this document |
| Input boundary | `.vox` files are selected locally in the browser and parsed without upload endpoints, wallet signing, deployment scripts, or server credentials. | `fourier-voxel/index.html`, `fourier-voxel/main.js`, `src/vox/ncm.js` |
| Visual workflow | The UI is designed around source model, function redraw, and proof candidate panes so a GPU reviewer can compare original and generated output side by side. | `sourceScene`, `functionScene`, and `powScene` in `fourier-voxel/index.html` |
| Static display | The page includes a documentation-only review panel so CPU-only reviewers can inspect the workflow, trust boundary, and deferred evidence directly in the UI. | `Documentation-only review` in `fourier-voxel/index.html` |
| Compression path | The current research codec maps colors to G0, merges same-color voxels into box basis functions, and emits `0:<base64url-bytes>`. | `createFunctionPayload`, `mergeSameColorVoxels`, and `docs/fourier-pickaxe-showcase.md` |
| GPU limitation | Headless or CPU-only review can verify documentation and source boundaries, but cannot prove WebGL rendering quality, frame stability, or proof-search performance. | `npm run audit:fourier-pickaxe-docs` |

Recommended short showcase copy:

> Fourier Voxel is a GPU-gated NiceChunk research surface for voxel asset functions. In this repository review we validate the architecture, codec documentation, browser-local input boundary, and security scope. Runtime visual quality and proof-search behavior must be confirmed later on GPU hardware with reviewer-supplied `.vox` fixtures.

## Static Evidence Card

Use the following card as the safe non-GPU presentation for GitHub, external agent review, or investor-facing technical screening. The same reviewer-facing packet is maintained in `docs/fourier-pickaxe-static-display.md`. It intentionally avoids screenshots, performance numbers, or visual-fidelity claims because those require GPU hardware.

| Field | Display value |
| --- | --- |
| Name | Fourier Voxel |
| Category | GPU-oriented voxel function research surface |
| Review mode in this environment | Documentation-only, static source review |
| Core input | Local MagicaVoxel `.vox` files |
| Core output | Compact deterministic function payloads using the `0:<base64url-bytes>` research codec |
| Main viewer concept | Three synchronized panes for source model, function redraw, and best proof candidate |
| Trust boundary | Browser-local file parsing, no upload endpoint, no wallet signature, no server credential |
| Valid static evidence | README, showcase document, HTML structure, JavaScript codec path, parser boundaries, audit script |
| Deferred GPU evidence | WebGL rendering quality, frame stability, proof-search responsiveness, visual screenshots, benchmark numbers |

Static presentation narrative:

1. Fourier Voxel turns the abstract asset-function idea into a concrete browser tool.
2. The current implementation shows a deterministic path from `.vox` input to G0 palette boxes and compact function bytes.
3. The repository makes its limitation explicit: documentation can prove scope and boundaries, while GPU hardware must prove live visual behavior.
4. The surface is separated into its own split repository so reviewers can audit the concept without scanning private deployment material or unrelated game runtime code.

## GPU-Free Demo Script

Use this script when presenting Fourier Voxel from a CPU-only environment. It is deliberately phrased as a static demonstration, not a runtime result.

1. Open with the product boundary: "Fourier Voxel is a GPU-oriented NiceChunk research surface for compact voxel function payloads."
2. Explain the workflow: "A reviewer supplies a local `.vox` model, the browser parses it locally, maps colors into G0, merges voxels into box basis functions, and emits a deterministic `0:<base64url-bytes>` payload."
3. Show the reviewable files: `fourier-voxel/index.html`, `fourier-voxel/main.js`, `src/vox/ncm.js`, and this showcase document.
4. Call out the trust boundary: "There is no upload endpoint, wallet signing step, deployment script, server address, GitHub token, or private key in this surface."
5. Close with the deferred evidence: "WebGL visual fidelity, frame stability, proof-search responsiveness, screenshots, and benchmark numbers must be captured later on GPU hardware."

Do not replace step 5 with estimates. If GPU evidence has not been collected, mark it as deferred.

## Third-Party Display Copy

The following copy is safe to reuse in GitHub descriptions, review packets, or non-GPU project overviews:

> Fourier Voxel is a NiceChunk GPU-oriented voxel research surface. It demonstrates the planned path from local MagicaVoxel assets to compact deterministic function payloads, with a browser-local trust boundary and an explicit documentation-first review mode for environments that cannot run the GPU workload.

Short form:

> GPU-gated voxel function lab for reviewing local `.vox` parsing, G0 palette mapping, compact payload encoding, and deferred WebGL/proof-search validation.

## GPU Validation Plan

When suitable hardware is available, collect runtime evidence separately from the static showcase:

| Evidence | How to collect | Acceptance note |
| --- | --- | --- |
| WebGL rendering | Open `/fourier-voxel/` in a GPU-enabled browser and load reviewer-supplied `.vox` fixtures. | Source, function redraw, and proof candidate panes must render without blank canvases. |
| Visual fidelity | Compare the source pane against the function redraw for small and medium models. | Record mismatches as codec research findings, not as hidden failures. |
| Proof-search responsiveness | Run the local proof-search preview for a bounded time window. | Report browser/GPU model, duration, and observed responsiveness instead of a universal benchmark claim. |
| Screenshot evidence | Capture full-page screenshots only after a real GPU run. | Label screenshots with hardware and browser context. |

## Non-GPU Evidence Checklist

The following checks are valid in this environment:

- The project is documented as a research surface, not a production miner or final codec.
- The public files describe GPU requirements and avoid pretending that static checks prove rendering behavior.
- The static evidence card gives third-party reviewers a concise display summary without inventing runtime output.
- The browser page includes a static documentation-only panel for review environments that cannot run the GPU workload.
- The page has a concrete browser workflow with file input, compute controls, proof controls, metrics, and three canvas panes.
- The runtime source shows local parsing, deterministic palette mapping, basis generation, payload creation, model hashing, and proof-search preview logic.
- The repository audit path contains a dedicated Fourier Voxel documentation gate.

The following checks are intentionally deferred to GPU hardware:

- visual fidelity between the uploaded VOX asset and the function redraw
- sustained proof-search responsiveness
- browser frame stability under large voxel assets
- measured GPU, thermal, and power behavior
- reviewer screenshots or videos of the live surface

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| Page shell | `fourier-voxel/index.html` | Tool layout, input controls, metrics, viewer panes, and copy targets. |
| Runtime logic | `fourier-voxel/main.js` | VOX loading, palette mapping, basis generation, payload encoding, proof-search preview, and Three.js rendering. |
| Styling | `fourier-voxel/styles.css` | Dense tool layout, responsive behavior, canvas framing, metrics, logs, and panels. |
| Parser | `src/vox/ncm.js` | Shared MagicaVoxel parsing and NCM encoding primitives. |
| I18n | `src/i18n.js`, `public/fourier-pickaxe/locales/*.json` | Page text and localized labels. |

## Function Payload

The current payload format is a research codec:

```text
0:<base64url([sx, sy, sz, n, {c, x, y, z, w, d, h} * n])>
```

Where:

- `sx`, `sy`, `sz` are source model dimensions.
- `n` is the basis count.
- `c` is a G0 palette index.
- `x`, `y`, `z`, `w`, `d`, `h` define each basis box.
- integers are compact variable-length bytes where applicable.

This is not presented as the final chain codec. It is evidence for the asset-function concept and a target for future protocol review.

## GPU Runtime Expectations

Meaningful runtime review should happen on a machine with:

- WebGL-capable desktop browser
- hardware acceleration enabled
- GPU monitoring available
- a local `.vox` test asset
- reviewer notes for frame stability, fanout behavior, and proof-search responsiveness

The current repository does not claim automated GPU proof-search benchmarking. Headless validation is limited to static source, build, and documentation checks.

## Security Boundary

Fourier Voxel stays inside the public review boundary:

- no private server address
- no deployment script
- no wallet key
- no GitHub token
- no upload endpoint
- no production credential

The input file is read locally by browser APIs. Reviewers should continue treating arbitrary `.vox` input as untrusted data and should check parser changes carefully.

## Review Checklist

Before accepting a Fourier Voxel change, verify:

- `fourier-voxel/README.md` describes scope and GPU requirements.
- `docs/fourier-pickaxe-showcase.md` describes architecture, payload format, and limitations.
- `docs/fourier-pickaxe-showcase.md` includes the documentation-only showcase and non-GPU evidence checklist.
- `npm run audit:fourier-pickaxe-docs` passes.
- `npm run build` still includes the `/fourier-voxel/` route.
- Split repository generation keeps this surface self-contained.
- No private infrastructure, deployment script, key, token, or server address is introduced.

## Known Limits

- GPU runtime behavior is not proven by the documentation audit.
- Proof-search performance is not benchmarked in the default validation path.
- The payload format is experimental and should not be treated as final protocol.
- Real asset corpus coverage requires separate reviewer-supplied `.vox` fixtures.
