// UI tests against the real app + Neon data from `npm run db:seed && npm run db:seed:demo`. Run: npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

// E2E_PORT=3001 → test a production build (`npm run build` first) without touching the dev server on :3000
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",
    timeout: 60_000,
    use: {
        baseURL: BASE,
        storageState: "e2e/.auth/manager.json",
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: PORT === 3000 ? "npm run dev" : `npx next start -p ${PORT}`,
        url: `${BASE}/login`,
        reuseExistingServer: true, // keep using `npm run dev` if it's already up
        timeout: 120_000,
    },
});
