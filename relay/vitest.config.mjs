import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./relay/wrangler.jsonc" }
    })
  ],
  test: {
    include: ["test/relay-runtime.test.mjs"],
    testTimeout: 30_000
  }
});
