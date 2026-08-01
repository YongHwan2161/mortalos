import { spawn } from "node:child_process";

const engines = process.env.MORTALOS_BROWSER_ENGINE
  ? [process.env.MORTALOS_BROWSER_ENGINE]
  : ["chromium", "firefox", "webkit"];
const commands = {
  chromium: [
    "scripts/verify-chromium.mjs",
    "scripts/verify-confidential-chromium.mjs",
    "scripts/verify-durable-quorum-chromium.mjs"
  ],
  firefox: [
    "scripts/verify-chromium.mjs",
    "scripts/verify-confidential-chromium.mjs",
    "scripts/verify-durable-quorum-chromium.mjs"
  ],
  webkit: ["scripts/verify-chromium.mjs"]
};

function run(script, engine) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: {
        ...process.env,
        MORTALOS_BROWSER_ENGINE: engine,
        MORTALOS_PORTABLE_CASES:
          process.env.MORTALOS_BROWSER_PARITY_CASES ?? "256",
        MORTALOS_S2_CHROMIUM_TRIALS:
          process.env.MORTALOS_BROWSER_PARITY_TRIALS ?? "3",
        MORTALOS_S2_LOSS_TRIALS:
          process.env.MORTALOS_BROWSER_PARITY_LOSS_TRIALS ?? "3"
      },
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${engine} ${script} failed: ${code ?? signal}`));
    });
  });
}

for (const engine of engines) {
  for (const command of commands[engine]) await run(command, engine);
}
console.log("MortalOS browser parity: PASS (Chromium/Firefox full custody; WebKit verifier-only fail-closed profile)");
