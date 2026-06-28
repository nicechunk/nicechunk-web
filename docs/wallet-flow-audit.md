# Wallet Flow Audit

NiceChunk includes a lightweight wallet flow audit for built browser pages.

This audit does not use a real wallet extension, private key, or seed phrase. It uses Playwright to verify public wallet UI behavior and injects a minimal mock Solana provider where a deterministic connected-wallet state is needed.

## Command

Run after a production build:

```bash
npm run build
npm run audit:wallet-flows
```

`npm run validate:release` runs this audit after the browser smoke audit.

## Coverage

The audit opens built routes from `dist/` and verifies:

- `/login/` with no injected wallet: mobile wallet app links are shown, the Phantom install link is present, and the status text reports that no injected wallet was detected.
- `/login/` with a mock Phantom provider: the Phantom wallet button appears, connect moves the UI into the player profile step, and the mock wallet address is persisted in local storage.
- `/guardian/` with no injected wallet: the Connect Wallet action reports the no-wallet guard and does not change the wallet status away from disconnected.

The JSON report is written to `.cache/wallet-flow-report.json`. The cache directory is intentionally ignored by git.

## Boundaries

This audit proves that NiceChunk's public wallet UI states, no-wallet guards, and injected-provider happy path remain wired in the production build.

It does not prove real Phantom, Solflare, Backpack, mobile deep-link, extension approval, wallet network switching, or transaction-signing behavior. Those flows still need manual or dedicated extension-runner evidence before release claims depend on them.
