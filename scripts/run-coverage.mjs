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
  "--test-coverage-include=src/confidential/format.mjs",
  "--test-coverage-include=src/confidential/keys.mjs",
  "--test-coverage-include=src/confidential/counter.mjs",
  "--test-coverage-include=src/confidential/package.mjs",
  "--test-coverage-include=src/confidential/recovery.mjs",
  "--test-coverage-include=src/state/package.mjs",
  "--test-coverage-include=src/state/recovery.mjs",
  "--test-coverage-include=src/validator.mjs",
  "--test-coverage-include=src/lineage.mjs",
  "--test-coverage-branches=90",
  "test/bytes.test.mjs",
  "test/codec.test.mjs",
  "test/crypto.test.mjs",
  "test/schema-validation.test.mjs",
  "test/rejection-codes.test.mjs",
  "test/confidential-format.test.mjs",
  "test/confidential-counter.test.mjs",
  "test/confidential-crypto-vectors.test.mjs",
  "test/confidential-package.test.mjs",
  "test/confidential-s3-recovery.test.mjs",
  "test/state-package.test.mjs",
  "test/validator.test.mjs",
  "test/lineage.test.mjs",
  "test/mortality.test.mjs",
  "test/singleton.test.mjs"
];

const result = spawnSync(process.execPath, args, {
  env: {
    ...process.env,
    MORTALOS_SKIP_FULL_SIGNATURE_BUDGET: "1",
    MORTALOS_SKIP_S4_MILLION_IV: "1"
  },
  stdio: "inherit"
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`coverage process terminated by ${result.signal}`);
if (result.status !== 0) process.exitCode = result.status ?? 1;
