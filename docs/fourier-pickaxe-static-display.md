# Fourier Voxel Static Display

Fourier Voxel requires GPU/WebGL hardware for meaningful runtime validation. This file is the approved static display package for review environments that cannot run the GPU workload.

For a shorter display packet that can be read aloud or pasted into an external review, use `docs/fourier-pickaxe-display-packet.md`.

## Display Positioning

Fourier Voxel is an independent NiceChunk browser program for compact voxel asset functions. It explores a deterministic path from local MagicaVoxel `.vox` assets to compact function payloads that can be reviewed for future on-chain or proof-oriented workflows.

Use this positioning when presenting the project without GPU access:

```text
Fourier Voxel is a GPU-gated voxel function lab. In this review environment, only architecture, documentation, source boundaries, codec intent, and security scope are being demonstrated. Runtime screenshots, visual fidelity, proof-search responsiveness, and benchmark claims are deferred until a GPU-capable workstation is available.
```

## Static Review Card

| Field | Static display value |
| --- | --- |
| Surface | GPU-oriented voxel function research page |
| Review mode here | Documentation-only static source review |
| Local input | Reviewer-supplied MagicaVoxel `.vox` file |
| Function output | `0:<base64url-bytes>` research payload |
| Palette boundary | NiceChunk G0 RGB332 color mapping |
| Viewer concept | Source model, function redraw, and proof candidate panes |
| Security boundary | No upload endpoint, wallet signature, server address, GitHub token, private key, or deploy script |
| Valid non-GPU evidence | README, showcase document, HTML controls, JavaScript codec path, parser boundary, audit script |
| Deferred GPU evidence | WebGL rendering, frame stability, visual fidelity, proof-search responsiveness, screenshots, videos, benchmark numbers |

## Display-Only Packet

When the current machine cannot run the GPU workload, present Fourier Voxel from the documentation packet instead of attempting runtime proof. The approved source is `docs/fourier-pickaxe-display-packet.md`, which contains a one-minute walkthrough, allowed display copy, and the explicit `No Runtime Claim` boundary.

## Reviewer Walkthrough

1. Open `fourier-voxel/README.md` and confirm that the project is described as GPU-oriented research rather than a production miner.
2. Open `docs/fourier-pickaxe-showcase.md` and review the documentation-first workflow, payload format, GPU validation plan, and known limits.
3. Open `fourier-voxel/index.html` and verify that the page exposes the local `.vox` input, compute controls, proof controls, three viewer panes, and documentation-only review panel.
4. Open `fourier-voxel/main.js` and verify the source path for `parseVox`, G0 palette mapping, basis generation, payload encoding, hashing, and proof-search preview logic.
5. Run `npm run audit:fourier-pickaxe-docs` to verify that the public documentation keeps GPU limits, static display language, security boundaries, and evidence expectations visible.

## Allowed Claims Without GPU

- The repository contains a dedicated Fourier Voxel program and documentation surface.
- The browser workflow is designed around local `.vox` parsing and compact deterministic function payloads.
- The static source path documents parser usage, palette mapping, box-basis compression, payload encoding, and proof-search preview intent.
- The public boundary excludes private infrastructure, deployment scripts, server addresses, wallet keys, GitHub tokens, and upload endpoints.
- Runtime visual evidence is intentionally deferred until GPU hardware is available.

## Disallowed Claims Without GPU

- Do not claim that the page rendered correctly on this machine.
- Do not provide screenshots or videos unless they were captured from a GPU-capable review machine.
- Do not state frame rate, proof-search speed, thermal behavior, or power behavior.
- Do not claim visual fidelity between the source VOX and function redraw.
- Do not treat the research codec as a finalized chain codec.

## GPU Evidence To Add Later

When a GPU-capable workstation is available, add a separate evidence note with:

- hardware model and browser version
- acceleration status
- `.vox` fixture names or hashes
- screenshots of the three panes after loading fixtures
- visual mismatch notes
- bounded proof-search duration and observed responsiveness
- any failures or browser console errors

Keep that evidence separate from this static display so reviewers can distinguish documentation review from real runtime validation.

## Security Notes

Fourier Voxel is part of the public review surface. It must not introduce:

- private server addresses
- deployment-only scripts
- GitHub tokens
- wallet secrets
- private keys
- SSH keys
- upload endpoints
- production credentials

Run the split and repository audits before publication:

```bash
node scripts/split-github-repos.mjs
npm run repo:audit
npm run audit:fourier-pickaxe-docs
```
