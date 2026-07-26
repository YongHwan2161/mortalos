import {
  LinearizableCounterAuthority,
  deriveConfidentialEpochId
} from "../src/confidential/counter.mjs";
import {
  randomTagged
} from "../src/confidential/format.mjs";
import {
  generateCustodianEncryptionKeyPair
} from "../src/confidential/keys.mjs";
import {
  createConfidentialPackage
} from "../src/confidential/package.mjs";

export function deterministicSecret(size = 1_048_576) {
  const bytes = new Uint8Array(size);
  const marker = new TextEncoder().encode(
    "MORTALOS-S4-PLAINTEXT-MARKER-DO-NOT-LEAK:"
  );
  bytes.set(marker);
  for (let index = marker.byteLength; index < bytes.byteLength; index += 1) {
    bytes[index] =
      (index * 97 + (index >>> 8) * 31 + (index >>> 16) * 13 + 19) & 0xff;
  }
  return bytes;
}

export async function createConfidentialFixture({
  epoch = "0",
  priorConfidentialRoot = randomTagged("sha256:"),
  resourceBytes = deterministicSecret(131_072),
  transitionId = "s4-reference"
} = {}) {
  const authority = await LinearizableCounterAuthority.create();
  const keyPairs = [];
  for (let index = 0; index < 3; index += 1) {
    keyPairs.push(
      await generateCustodianEncryptionKeyPair(randomTagged("mortalos-key:"))
    );
  }
  const custodians = keyPairs
    .map(({ descriptor }) => descriptor)
    .sort((left, right) =>
      left.custodian_id.localeCompare(right.custodian_id)
    );
  const organismId = randomTagged("mortalos:");
  const membershipHead = randomTagged("sha256:");
  const resourceId = randomTagged("mortalos-resource:");
  const epochId = deriveConfidentialEpochId({
    authorityId: authority.descriptor.authority_id,
    authorityPublicKey: authority.descriptor.authority_public_key,
    custodianEncryptionKeys: custodians
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch,
    membershipHead,
    organismId,
    transitionId
  });
  const confidentialPackage = await createConfidentialPackage({
    authority,
    custodians,
    epoch,
    epochId,
    membershipHead,
    organismId,
    priorConfidentialRoot,
    resourceBytes,
    resourceId,
    transitionId
  });
  return Object.freeze({
    authority,
    confidentialPackage,
    custodians,
    epoch,
    epochId,
    keyPairs,
    membershipHead,
    organismId,
    priorConfidentialRoot,
    resourceBytes,
    resourceId,
    transitionId
  });
}

export function keyPairFor(fixture, custodian) {
  return fixture.keyPairs.find(
    ({ descriptor }) => descriptor.custodian_id === custodian.custodian_id
  );
}
