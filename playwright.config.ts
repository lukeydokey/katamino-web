import { defineConfig, devices } from "@playwright/test";
import { resolvePlaywrightWebServerEnv } from "./src/lib/testing/local-supabase-env";

const webServerEnv = resolvePlaywrightWebServerEnv(process.env);
const shouldReuseExistingServer =
  !process.env.CI && webServerEnv.KATAMINO_E2E_LOCAL_SUPABASE !== "1";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    env: webServerEnv,
    url: "http://localhost:3000",
    reuseExistingServer: shouldReuseExistingServer,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
