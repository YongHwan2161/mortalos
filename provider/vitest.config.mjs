import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const fixturePath = process.env.MORTALOS_PROVIDER_RUNTIME_FIXTURE;
if (!fixturePath) throw new Error("MORTALOS_PROVIDER_RUNTIME_FIXTURE is required");
const runtimeFixture = JSON.parse(readFileSync(fixturePath, "utf8"));

export default defineConfig({
  define: {
    __MORTALOS_PROVIDER_RUNTIME_FIXTURE__: JSON.stringify(runtimeFixture)
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./provider/wrangler.jsonc" }
    })
  ],
  test: {
    include: ["test/provider-runtime.test.mjs"],
    testTimeout: 60_000
  }
});
