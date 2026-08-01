import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium, firefox, webkit } from "playwright";

const engines = { chromium, firefox, webkit };
const requested = process.env.MORTALOS_BROWSER_ENGINE
  ? [process.env.MORTALOS_BROWSER_ENGINE]
  : Object.keys(engines);

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end("<!doctype html><title>MortalOS capability smoke</title>");
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;

try {
  for (const name of requested) {
    const browserType = engines[name];
    if (!browserType) throw new Error(`unsupported browser engine: ${name}`);
    const browser = await browserType.launch({ headless: true });
    try {
    const page = await browser.newPage();
    await page.goto(url);
    const result = await page.evaluate(async () => {
      const result = {};
      try {
        const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("mortalos-capability-smoke", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("records");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        });
        database.close();
        indexedDB.deleteDatabase("mortalos-capability-smoke");
        result.indexed_db = true;
      } catch (error) {
        result.indexed_db = `${error.name}:${error.message}`;
      }
      let signing;
      let encryption;
      try {
        signing = await crypto.subtle.generateKey(
          { name: "Ed25519" },
          false,
          ["sign", "verify"]
        );
        result.ed25519 = {
          extractable: signing.privateKey.extractable,
          type: signing.privateKey.type,
          usages: [...signing.privateKey.usages]
        };
      } catch (error) {
        result.ed25519 = `${error.name}:${error.message}`;
      }
      try {
        encryption = await crypto.subtle.generateKey(
          {
            name: "RSA-OAEP",
            modulusLength: 3072,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
          },
          false,
          ["encrypt", "decrypt"]
        );
        result.rsa_oaep_3072 = {
          extractable: encryption.privateKey.extractable,
          type: encryption.privateKey.type,
          usages: [...encryption.privateKey.usages]
        };
      } catch (error) {
        result.rsa_oaep_3072 = `${error.name}:${error.message}`;
      }
      try {
        const cloned = structuredClone({
          privateKey: (signing ?? encryption).privateKey
        });
        result.structured_clone_crypto_key =
          cloned.privateKey.type === "private" && !cloned.privateKey.extractable;
      } catch (error) {
        result.structured_clone_crypto_key = `${error.name}:${error.message}`;
      }
      try {
        result.locks = navigator.locks
          ? await navigator.locks.request("mortalos-capability-smoke", () => "acquired")
          : "unavailable";
      } catch (error) {
        result.locks = `${error.name}:${error.message}`;
      }
      return result;
    });
    const expected = {
      ed25519: { extractable: false, type: "private", usages: ["sign"] },
      indexed_db: true,
      locks: "acquired",
      rsa_oaep_3072: { extractable: false, type: "private", usages: ["decrypt"] },
      structured_clone_crypto_key: true
    };
    try {
      if (name === "webkit") {
        assert.match(result.ed25519, /^NotSupportedError:/u);
        assert.deepEqual(
          { ...result, ed25519: "unsupported" },
          { ...expected, ed25519: "unsupported" }
        );
      } else {
        assert.deepEqual(result, expected);
      }
    } catch (error) {
      error.message += `\n${name} capabilities: ${JSON.stringify(result, null, 2)}`;
      throw error;
    }
    console.log(
      name === "webkit"
        ? "MortalOS webkit capability smoke: PASS (Ed25519 unavailable; signer profile fails closed)"
        : `MortalOS ${name} capability smoke: PASS`
    );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
