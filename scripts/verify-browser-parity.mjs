import { spawn } from "node:child_process";
import {
  hasNativeSignerCapability,
  probeBrowserCapabilities
} from "./browser-capability-probe.mjs";

const engines = process.env.MORTALOS_BROWSER_ENGINE
  ? [process.env.MORTALOS_BROWSER_ENGINE]
  : ["chromium", "firefox", "webkit"];
const fullCustodyCommands = [
  "scripts/verify-chromium.mjs",
  "scripts/verify-confidential-chromium.mjs",
  "scripts/verify-durable-quorum-chromium.mjs",
  "scripts/verify-continuity-chromium.mjs"
];
const commands = {
  chromium: fullCustodyCommands,
  firefox: fullCustodyCommands,
  webkit: null
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

let webkitSignerCapable = null;
for (const engine of engines) {
  let engineCommands = commands[engine];
  if (engine === "webkit") {
    webkitSignerCapable = hasNativeSignerCapability(
      await probeBrowserCapabilities("webkit")
    );
    engineCommands = webkitSignerCapable
      ? fullCustodyCommands
      : ["scripts/verify-chromium.mjs"];
  }
  for (const command of engineCommands) await run(command, engine);
}
console.log(
  "MortalOS browser parity: PASS (Chromium/Firefox full custody; WebKit " +
    (webkitSignerCapable === null
      ? "not requested"
      : webkitSignerCapable
        ? "full custody"
        : "verifier-only fail-closed") +
    ")"
);
