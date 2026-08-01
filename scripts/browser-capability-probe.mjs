import { createServer } from "node:http";
import { chromium, firefox, webkit } from "playwright";

const ENGINES = Object.freeze({ chromium, firefox, webkit });

export async function probeBrowserCapabilities(name) {
  const browserType = ENGINES[name];
  if (!browserType) throw new Error(`unsupported browser engine: ${name}`);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>MortalOS capability smoke</title>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    return await page.evaluate(async () => {
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
        const cloned = structuredClone({ privateKey: (signing ?? encryption).privateKey });
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
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

export function hasNativeSignerCapability(result) {
  return (
    result?.ed25519?.extractable === false &&
    result.ed25519.type === "private" &&
    JSON.stringify(result.ed25519.usages) === JSON.stringify(["sign"])
  );
}
