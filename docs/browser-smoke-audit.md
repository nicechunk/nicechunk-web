# NiceChunk Browser Smoke Audit

NiceChunk includes a lightweight browser smoke audit for built public pages.

This is not a full visual regression suite. It is a release gate that proves the production build can be served, key pages load in Chromium, DOM content is present, local assets resolve, and screenshots are not trivially blank.

## Command

Run after a production build:

```bash
npm run build
npm run audit:browser-smoke
```

`npm run validate:release` runs the browser smoke audit after the build.

## Coverage

The audit opens these built routes from `dist/`:

- `/`
- `/play/`
- `/login/`
- `/docs/`
- `/guardian/`
- `/resource_rule/`
- `/world_rule/`
- `/ncm/`
- `/proof-of-frontier/`
- `/trust/`

For each route, it records:

- HTTP status
- document title
- body text length
- visible DOM element count
- rendered body height
- screenshot byte size
- browser page errors
- failed local asset requests

The JSON report is written to `.cache/browser-smoke-report.json`. The cache directory is intentionally ignored by git.

## Environment

The audit requires Playwright Chromium:

```bash
npx playwright install chromium
```

CI should install Chromium before running `npm run validate:release`.

## Known Limit

This audit catches broken route output, blank pages, missing local assets, and obvious runtime crashes. It does not compare screenshots against approved baselines, validate wallet extension flows, or perform mobile viewport coverage. Those remain separate visual and wallet-flow review items.
