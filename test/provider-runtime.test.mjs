import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { decodeBase64Url } from "../src/bytes.mjs";
import { verifyContinuityCapsule } from "../src/capsule.mjs";
import { recoverContinuityCopyQuorum } from "../src/custody.mjs";
import {
  PROVIDER_TOPOLOGY_FORMAT,
  recoverContinuityProviderQuorum,
  registerCustodyProviderCapability,
  storeContinuityCopiesWithProviders
} from "../src/provider/possession.mjs";

function basis(index) {
  return Object.freeze({
    account_domain: `runtime-account-${index}`,
    admin_domain: `runtime-admin-${index}`,
    credential_domain: `runtime-credential-${index}`,
    failure_domain: `runtime-failure-${index}`,
    provider_id: `logical-provider-${index}`,
    provider_kind: `runtime-provider-${index}`,
    region: ["eu", "us", "apac-ne"][index - 1]
  });
}

function transferred() {
  const fixture = __MORTALOS_PROVIDER_RUNTIME_FIXTURE__;
  return Object.freeze({
    copies: Object.freeze(fixture.copies.map((copy) => decodeBase64Url(copy))),
    headHash: fixture.head_hash,
    organismId: fixture.organism_id,
    resourceBytes: decodeBase64Url(fixture.resource_bytes)
  });
}

describe("ProviderVault possession runtime", () => {
  it("persists provider-signed copies across eviction and recovers through one unavailable vault", async () => {
    const fixture = transferred();
    const stubs = [1, 2, 3].map((index) => env.PROVIDER_VAULT.getByName(`provider-${index}`));
    const identities = [];
    for (let index = 0; index < stubs.length; index += 1) {
      identities.push(await stubs[index].configure(basis(index + 1)));
    }
    const offline = [false, false, false];
    const providers = stubs.map((stub, index) => {
      const provider = {};
      registerCustodyProviderCapability(provider, {
        read: async (digest) => {
          if (offline[index]) throw new Error("runtime-provider-offline");
          const bytes = await stub.get(digest);
          if (!bytes) throw new Error("runtime-provider-object-missing");
          return bytes;
        },
        identity: identities[index],
        store: async (copyBytes) => {
          if (offline[index]) throw new Error("runtime-provider-offline");
          return stub.put(copyBytes);
        }
      });
      return provider;
    });
    const topology = Object.freeze({
      format: PROVIDER_TOPOLOGY_FORMAT,
      providers: Object.freeze(identities)
    });
    const stored = await storeContinuityCopiesWithProviders({
      copies: fixture.copies,
      providers,
      topology
    });

    for (const stub of stubs) await evictDurableObject(stub);
    offline[0] = true;
    const providerRecovery = await recoverContinuityProviderQuorum({
      providers,
      quorum: 2,
      receipts: stored.receipts,
      topology
    });
    expect(providerRecovery.valid_copies).toBe(2);
    expect(providerRecovery.rejected_providers).toHaveLength(1);
    const recovered = recoverContinuityCopyQuorum({
      copies: providerRecovery.provider_copies,
      quorum: 2
    });
    const capsule = verifyContinuityCapsule(recovered.capsule_bytes);
    expect(capsule.head_hash).toBe(fixture.headHash);
    expect(capsule.organism_id).toBe(fixture.organismId);
    expect([...capsule.resource_bytes]).toEqual([...fixture.resourceBytes]);

    await runInDurableObject(stubs[1], async (_instance, state) => {
      const tables = state.storage.sql.exec(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).toArray().map((row) => row.name);
      expect(tables).toContain("objects");
      expect(tables).toContain("object_chunks");
      expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM objects").one().count).toBe(1);
      expect(state.storage.sql.exec("SELECT COUNT(*) AS count FROM object_chunks").one().count).toBeGreaterThan(0);
      const signingSeed = await state.storage.get("provider_signing_seed");
      expect(signingSeed).toBeInstanceOf(Uint8Array);
      expect(signingSeed.byteLength).toBe(32);
    });
  });

  it("keeps provider identity immutable and fails closed on stored-chunk corruption", async () => {
    const fixture = transferred();
    const stub = env.PROVIDER_VAULT.getByName("immutable-provider");
    const configured = await stub.configure(basis(1));
    await runInDurableObject(stub, async (instance) => {
      await expect(instance.configure({ ...basis(1), admin_domain: "different-admin" })).rejects.toThrow(
        "provider identity is immutable"
      );
    });
    const receipt = await stub.put(fixture.copies[0]);
    expect(receipt).toBeInstanceOf(Uint8Array);
    await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql.exec(
        "SELECT digest, ordinal, bytes FROM object_chunks ORDER BY ordinal LIMIT 1"
      ).one();
      const corrupted = new Uint8Array(row.bytes);
      corrupted[0] ^= 1;
      state.storage.sql.exec(
        "UPDATE object_chunks SET bytes = ? WHERE digest = ? AND ordinal = ?",
        corrupted,
        row.digest,
        row.ordinal
      );
    });
    const digest = (await import("../src/provider/possession.mjs"))
      .verifyProviderPossessionReceipt(receipt).body.object.digest;
    await runInDurableObject(stub, (instance) => {
      expect(() => instance.get(digest)).toThrow("provider object readback is invalid");
    });
    expect(configured.public_key).toMatch(/^ed25519:/u);
  });
});
