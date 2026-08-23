import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createDurableRepairProviderSession } from "../lab/placement/durable-repair-provider-session.mjs";
import { decodeBase64Url } from "../src/bytes.mjs";

const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));

function placement(source) {
  return Object.freeze({
    consumption_announcements: Object.freeze(source.consumption_announcements.map(decodeBase64Url)),
    execution_receipts: Object.freeze(source.execution_receipts.map(decodeBase64Url)),
    lease: decodeBase64Url(source.lease),
    observed_at_ms: source.observed_at_ms,
    offer: decodeBase64Url(source.offer),
    revocations: Object.freeze(source.revocations.map(decodeBase64Url)),
    usage_receipts: Object.freeze(source.usage_receipts.map(decodeBase64Url))
  });
}

if (payload.ready_path) {
  writeFileSync(payload.ready_path, "ready", { flag: "wx" });
  const deadline = Date.now() + 10_000;
  while (!existsSync(payload.release_path)) {
    if (Date.now() >= deadline) throw new Error("provider-session-release-timeout");
    await delay(5);
  }
}

const session = createDurableRepairProviderSession({
  directory: payload.directory,
  provider: Object.freeze({
    async executeRepairEffect() {
      writeFileSync(payload.side_effect_path, `${process.pid}\n`, { flag: "wx" });
      if (payload.mode === "crash-before-result") process.exit(87);
      return Object.freeze({ placement: placement(payload.placement) });
    }
  })
});

try {
  await session.executeRepairEffect({
    effect: Object.freeze({ ignored: true }),
    effect_bytes: decodeBase64Url(payload.effect_bytes),
    idempotency_key: payload.idempotency_key,
    replacement_lease_bytes: decodeBase64Url(payload.replacement_lease_bytes),
    replacement_offer_bytes: decodeBase64Url(payload.replacement_offer_bytes),
    resource_bytes: decodeBase64Url(payload.resource_bytes)
  });
  process.stdout.write(JSON.stringify({ status: "returned" }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    code: error?.code ?? null,
    status: "rejected"
  }));
}
