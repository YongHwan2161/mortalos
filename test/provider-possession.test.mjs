import { ed25519 } from "@noble/curves/ed25519.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  handoffContinuity,
  recoverContinuity,
  PROVIDER_POSSESSION_FORMAT,
  PROVIDER_TOPOLOGY_FORMAT,
  assertIndependentProviderTopology,
  providerObjectDigest,
  recoverContinuityProviderQuorum,
  registerCustodyProviderCapability,
  storeContinuityCopiesWithProviders,
  verifyProviderPossessionReceipt
} from "../sdk/continuity.mjs";
import { encodeBase64Url } from "../src/bytes.mjs";
import { canonicalBytes } from "../src/codec.mjs";
import { verifyContinuityCopy } from "../src/custody.mjs";

function identity(index, publicKey) {
  return Object.freeze({
    account_domain: `account-${index}`,
    admin_domain: `admin-${index}`,
    credential_domain: `credential-${index}`,
    failure_domain: `failure-${index}`,
    provider_id: `logical-provider-${index}`,
    provider_kind: `test-provider-${index}`,
    public_key: publicKey,
    region: `region-${index}`
  });
}

function topology(providers) {
  return Object.freeze({
    format: PROVIDER_TOPOLOGY_FORMAT,
    providers: Object.freeze(providers.map((provider) => provider.identity))
  });
}

class MemoryPossessionProvider {
  constructor(index) {
    const seed = new Uint8Array(32).fill(index);
    const providerIdentity = identity(
      index,
      `ed25519:${encodeBase64Url(ed25519.getPublicKey(seed))}`
    );
    const record = { corrupt: false, objects: new Map(), offline: false };
    this.identity = providerIdentity;
    this.public_fetch_calls = 0;
    this.public_store_calls = 0;
    registerCustodyProviderCapability(this, {
      read: async (digest) => {
        if (record.offline) throw new Error("provider-offline");
        const stored = record.objects.get(digest);
        if (!stored) throw new Error("provider-object-missing");
        const bytes = new Uint8Array(stored);
        if (record.corrupt) bytes[Math.floor(bytes.byteLength / 2)] ^= 1;
        return bytes;
      },
      identity: providerIdentity,
      store: async (copyBytes) => {
        if (record.offline) throw new Error("provider-offline");
        const copy = verifyContinuityCopy(copyBytes);
        const digest = providerObjectDigest(copyBytes);
        record.objects.set(digest, new Uint8Array(copyBytes));
        const readback = record.objects.get(digest);
        assert.equal(providerObjectDigest(readback), digest);
        const body = Object.freeze({
          copy: copy.descriptor,
          format: PROVIDER_POSSESSION_FORMAT,
          object: Object.freeze({ digest, size: copyBytes.byteLength }),
          provider: providerIdentity,
          stored_at: `2026-08-04T00:00:0${index}.000Z`
        });
        return canonicalBytes({
          body,
          signature: `ed25519:${encodeBase64Url(ed25519.sign(canonicalBytes(body), seed))}`
        });
      }
    });
    this.setCorrupt = (value) => { record.corrupt = Boolean(value); };
    this.setOffline = (value) => { record.offline = Boolean(value); };
  }

  fetch() {
    this.public_fetch_calls += 1;
    throw new Error("public facade must not be trusted");
  }

  store() {
    this.public_store_calls += 1;
    throw new Error("public facade must not be trusted");
  }
}

async function transferred() {
  const resourceBytes = new TextEncoder().encode("provider-backed continuity runtime file");
  const authorityA = await createContinuityAuthority();
  const authorityB = await createContinuityAuthority();
  const created = await createContinuity({
    authority: authorityA,
    resourceBytes,
    transitionId: "provider-create"
  });
  const request = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "request"
  });
  const proposal = await handoffContinuity({
    authority: authorityA,
    capsuleBytes: created.capsule_bytes,
    phase: "propose",
    request
  });
  const handed = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "accept",
    proposal
  });
  return { authorityA, authorityB, created, handed, resourceBytes };
}

test("provider-issued receipts recover exact bytes after one provider fails and B continues", async () => {
  const fixture = await transferred();
  const providers = [1, 2, 3].map((index) => new MemoryPossessionProvider(index));
  const providerTopology = topology(providers);
  const stored = await storeContinuityCopiesWithProviders({
    copies: fixture.handed.copies,
    providers,
    topology: providerTopology
  });
  assert.equal(stored.receipts.length, 3);
  for (const receipt of stored.receipts) assert.equal(verifyProviderPossessionReceipt(receipt).status, "verified");

  fixture.authorityA.destroy();
  providers[0].setOffline(true);
  const providerRecovery = await recoverContinuityProviderQuorum({
    providers,
    quorum: 2,
    receipts: stored.receipts,
    topology: providerTopology
  });
  assert.equal(providerRecovery.valid_copies, 2);
  assert.equal(providerRecovery.rejected_providers.length, 1);
  const recovered = recoverContinuity({
    authority: fixture.authorityB,
    copies: providerRecovery.provider_copies,
    expectedHeadHash: fixture.handed.head_hash,
    expectedOrganismId: fixture.handed.organism_id,
    quorum: 2
  });
  assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
  const continued = await continueContinuity({
    authority: fixture.authorityB,
    capsuleBytes: recovered.capsule_bytes,
    expectedHeadHash: recovered.head_hash,
    resourceBytes: recovered.resource_bytes,
    transitionId: "provider-continue"
  });
  assert.equal(continued.sequence, "3");
  assert.equal(continued.organism_id, fixture.created.organism_id);
  assert.ok(providers.every((provider) =>
    provider.public_fetch_calls === 0 && provider.public_store_calls === 0));
  assert.doesNotMatch(
    JSON.stringify(stored),
    /private|seed|pkcs8|BEGIN PRIVATE KEY/iu
  );
});

test("corrupt readback, receipt substitution, forged receipt, and below quorum fail closed", async () => {
  const fixture = await transferred();
  const providers = [1, 2, 3].map((index) => new MemoryPossessionProvider(index));
  const providerTopology = topology(providers);
  const stored = await storeContinuityCopiesWithProviders({
    copies: fixture.handed.copies,
    providers,
    topology: providerTopology
  });

  providers[0].setCorrupt(true);
  const oneCorrupt = await recoverContinuityProviderQuorum({
    providers,
    quorum: 2,
    receipts: stored.receipts,
    topology: providerTopology
  });
  assert.equal(oneCorrupt.rejected_providers.length, 1);
  assert.equal(oneCorrupt.valid_copies, 2);

  const substituted = [...stored.receipts];
  substituted[1] = substituted[0];
  await assert.rejects(
    recoverContinuityProviderQuorum({
      providers,
      quorum: 2,
      receipts: substituted,
      topology: providerTopology
    }),
    /receipt-1-identity-mismatch/
  );

  const forged = new Uint8Array(stored.receipts[2]);
  forged[forged.byteLength - 2] ^= 1;
  await assert.rejects(
    recoverContinuityProviderQuorum({
      providers,
      quorum: 2,
      receipts: [stored.receipts[0], stored.receipts[1], forged],
      topology: providerTopology
    })
  );

  providers[0].setOffline(true);
  providers[1].setOffline(true);
  await assert.rejects(
    recoverContinuityProviderQuorum({
      providers,
      quorum: 2,
      receipts: stored.receipts,
      topology: providerTopology
    }),
    (error) => error?.code === "E_PROVIDER_QUORUM_UNAVAILABLE"
  );
});

test("topology requires distinct account, region, credential, admin, provider, key, and failure domains", () => {
  const providers = [1, 2, 3].map((index) => new MemoryPossessionProvider(index));
  const accepted = assertIndependentProviderTopology(topology(providers));
  assert.equal(accepted.providers.length, 3);
  for (const field of [
    "account_domain",
    "admin_domain",
    "credential_domain",
    "failure_domain",
    "provider_id",
    "provider_kind",
    "public_key",
    "region"
  ]) {
    const duplicated = structuredClone(topology(providers));
    duplicated.providers[1][field] = duplicated.providers[0][field];
    assert.throws(
      () => assertIndependentProviderTopology(duplicated),
      new RegExp(`${field} values must be independent`)
    );
  }
});
