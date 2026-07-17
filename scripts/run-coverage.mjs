import { spawnSync } from "node:child_process";

const args = [
  "--test",
  "--experimental-test-coverage",
  "--test-coverage-include=src/bytes.mjs",
  "--test-coverage-include=src/codec.mjs",
  "--test-coverage-include=src/crypto.mjs",
  "--test-coverage-include=src/primordials.mjs",
  "--test-coverage-include=src/schema-validation.mjs",
  "--test-coverage-include=src/rejection-codes.mjs",
  "--test-coverage-include=src/validator.mjs",
  "--test-coverage-include=src/lineage.mjs",
  "--test-coverage-branches=90",
  "test/bytes.test.mjs",
  "test/codec.test.mjs",
  "test/crypto.test.mjs",
  "test/schema-validation.test.mjs",
  "test/rejection-codes.test.mjs",
  "test/validator.test.mjs",
  "test/lineage.test.mjs",
  "test/mortality.test.mjs",
  "test/singleton.test.mjs"
];

const result = spawnSync(process.execPath, args, {
  env: { ...process.env, MORTALOS_SKIP_FULL_SIGNATURE_BUDGET: "1" },
  stdio: "inherit"
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`coverage process terminated by ${result.signal}`);
if (result.status !== 0) process.exitCode = result.status ?? 1;
