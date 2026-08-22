import { readFileSync, writeFileSync } from "node:fs";
import { createDurableRepairProviderSession } from "../lab/placement/durable-repair-provider-session.mjs";
import { executeLineagePlacementRepairEffect } from "../lab/placement/repair-executor.mjs";
import { decodeBase64Url } from "../src/bytes.mjs";

function placement(value) {
  return Object.freeze({
    consumption_announcements: Object.freeze(value.consumption_announcements.map(decodeBase64Url)),
    execution_receipts: Object.freeze(value.execution_receipts.map(decodeBase64Url)),
    lease: decodeBase64Url(value.lease),
    observed_at_ms: value.observed_at_ms,
    offer: decodeBase64Url(value.offer),
    revocations: Object.freeze(value.revocations.map(decodeBase64Url)),
    shard_index: value.shard_index,
    usage_receipts: Object.freeze(value.usage_receipts.map(decodeBase64Url))
  });
}

function providerPlacement(value) {
  const { shard_index: ignored, ...result } = placement(value);
  return Object.freeze(result);
}

const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));
const durableProvider = createDurableRepairProviderSession({
  directory: payload.provider_session_directory,
  provider: Object.freeze({
    async executeRepairEffect({ resource_bytes: resourceBytes }) {
      writeFileSync(payload.provider_effect_path, resourceBytes, { flag: "wx" });
      return { placement: providerPlacement(payload.replacement_placement) };
    }
  })
});
await executeLineagePlacementRepairEffect({
  capsule_bytes: decodeBase64Url(payload.capsule_bytes),
  commit_bytes: decodeBase64Url(payload.commit_bytes),
  directory: payload.directory,
  generation_bytes: decodeBase64Url(payload.generation_bytes),
  observed_at_ms: payload.observed_at_ms,
  observed_liveness_responses: payload.observed_liveness_responses.map(decodeBase64Url),
  observed_placements: payload.observed_placements.map(placement),
  provider: Object.freeze({
    async executeRepairEffect(request) {
      await durableProvider.executeRepairEffect(request);
      process.exit(86);
    }
  }),
  replacement_lease_bytes: decodeBase64Url(payload.replacement_lease_bytes),
  replacement_offer_bytes: decodeBase64Url(payload.replacement_offer_bytes),
  resource_bytes: decodeBase64Url(payload.resource_bytes),
  shard_index: payload.shard_index
});
