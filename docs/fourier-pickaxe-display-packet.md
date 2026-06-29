# Fourier Voxel Display Packet

Fourier Voxel needs GPU/WebGL hardware for runtime proof. This packet is the display material to use when the current reviewer, agent, or CI environment cannot run the page meaningfully.

## Display Rule

Use the project as a documentation-based display only:

```text
Fourier Voxel is a GPU-gated voxel function research surface. This review shows the documented workflow, source boundaries, codec intent, and security scope. It does not claim live rendering, proof-search speed, screenshots, or visual fidelity because this environment cannot provide GPU/WebGL evidence.
```

## One-Minute Walkthrough

1. Open `fourier-voxel/README.md` and state the project boundary: GPU-oriented research, not a production miner.
2. Open `docs/fourier-pickaxe-showcase.md` and summarize the workflow: local `.vox` file, G0 palette mapping, box-basis merge, `0:<base64url-bytes>` payload, redraw target, and proof-search preview.
3. Open `fourier-voxel/index.html` and point to the static `Documentation-only review` panel, the local file input, and the three intended viewer panes.
4. Open `fourier-voxel/main.js` and verify the source path names: `parseVox`, `mergeSameColorVoxels`, `createFunctionPayload`, and `createPowCandidate`.
5. Close with the deferred evidence list: WebGL rendering, frame stability, visual fidelity, proof-search responsiveness, screenshots, and benchmark numbers require a GPU workstation.

## Display Checklist

| Check | Static answer |
| --- | --- |
| Can the current environment prove rendering? | No. GPU/WebGL evidence is required. |
| Can the current environment prove architecture and scope? | Yes. Use README, showcase docs, source files, and audit output. |
| Can the current environment claim screenshots or benchmarks? | No. Those claims must be deferred. |
| Is any private infrastructure required? | No. The public surface has no upload endpoint, wallet signing, server address, token, private key, or deploy script. |
| What should be shown instead of runtime output? | The documentation-only panel, the codec path, the security boundary, and the GPU validation plan. |

## Allowed Display Copy

```text
Fourier Voxel is presented here as a documentation-only GPU-gated research surface. The repository can be reviewed for architecture, local input boundaries, codec intent, and public safety controls. Runtime visual proof is intentionally deferred until GPU hardware is available.
```

## No Runtime Claim

Do not say that Fourier Voxel has rendered, benchmarked, matched visual fidelity, or sustained proof-search in this environment. If GPU hardware was not used, the correct evidence level is documentation-only.

## Validation Command

```bash
npm run audit:fourier-pickaxe-docs
```
