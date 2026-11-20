import { defineConfig } from '@playwright/test';
// Both builds are served under a subpath (/cut/) to prove subpath hosting works.
//  4317: the real build with empty config (designed empty states)
//  4318: the same build pointed at TEST-ONLY fixtures in tests/fixtures (never shipped)
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { browserName: 'chromium' },
  webServer: [
    { command: 'node scripts/serve-subpath.mjs 4317 /cut/ dist', port: 4317, reuseExistingServer: true },
    { command: 'node scripts/serve-subpath.mjs 4318 /cut/ dist-fx', port: 4318, reuseExistingServer: true },
  ],
});
