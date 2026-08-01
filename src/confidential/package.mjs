import {
  concatBytes,
  decodeBase64Url,
  encodeBase64Url
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import {
  copyOwnDataArray,
  snapshotNamedOwnDataValues
} from "../primordials.mjs";
import {
  CONFIDENTIAL_DOMAINS,
  CONFIDENTIAL_FORMATS,
  CONFIDENTIAL_LIMITS,
  CONFIDENTIAL_SUITE,
  assertCustodianId,
  assertDigest,
  assertExactIv,
  assertOrganismId,
  assertResourceId,
  canonicalDomainHash,
  confidentialFail,
  counterToIv,
  domainHash,
  exactObjectKeys,
  parseCanonicalDocument,
  parseCounter,
  parseDecimalString,
  parseEpoch,
  plaintextCommitment
} from "./format.mjs";
import {
  generateStagingEpochKey,
  unwrapEpochKey,
  wrapEpochKey,
  assertWebCrypto
} from "./keys.mjs";
import {
  counterAuthorityDescriptor,
  deriveConfidentialEpochId,
  reserveCounterAuthority,
  verifyCounterReservationReceipt
} from "./counter.mjs";

const MANIFEST_KEYS = [
  "authority_id",
  "chunks",
  "confidential_root",
  "count",
  "epoch",
  "epoch_id",
  "format",
  "interval_end_exclusive",
  "interval_start",
  "membership_head",
  "organism_id",
  "prior_confidential_root",
  "reservation_receipt_digest",
  "resource_id",
  "suite",
  "transition_id",
  "wraps"
];
const CHUNK_KEYS = [
  "aad",
  "aad_digest",
  "ciphertext_base64url",
  "ciphertext_bytes",
  "ciphertext_digest",
  "index",
  "invocation_counter",
  "iv_base64url",
  "tag_bits"
];
const AAD_KEYS = [
  "chunk_count",
  "chunk_index",
  "epoch",
  "epoch_id",
  "format",
  "invocation_counter",
  "membership_head",
  "organism_id",
  "plaintext_bytes",
  "prior_confidential_root",
  "resource_id",
  "suite"
];
const WRAP_KEYS = [
  "custodian_encryption_key",
  "custodian_id",
  "epoch",
  "epoch_id",
  "format",
  "label_digest",
  "suite",
  "wrapped_epoch_key_base64url",
  "wrapped_epoch_key_digest"
];

function manifestBasis(manifest) {
  return {
    authority_id: manifest.authority_id,
    chunks: manifest.chunks,
    count: manifest.count,
    epoch: manifest.epoch,
    epoch_id: manifest.epoch_id,
    format: CONFIDENTIAL_FORMATS.manifest,
    interval_end_exclusive: manifest.interval_end_exclusive,
    interval_start: manifest.interval_start,
    membership_head: manifest.membership_head,
    organism_id: manifest.organism_id,
    prior_confidential_root: manifest.prior_confidential_root,
    reservation_receipt_digest: manifest.reservation_receipt_digest,
    resource_id: manifest.resource_id,
    suite: manifest.suite,
    transition_id: manifest.transition_id,
    wraps: manifest.wraps
  };
}

function confidentialRoot(manifest) {
  return canonicalDomainHash(CONFIDENTIAL_DOMAINS.package, manifestBasis(manifest));
}

function transitionReceipt(manifest) {
  return {
    confidential_root: manifest.confidential_root,
    epoch: manifest.epoch,
    epoch_id: manifest.epoch_id,
    format: CONFIDENTIAL_FORMATS.receipt,
    reservation_receipt_digest: manifest.reservation_receipt_digest,
    suite: CONFIDENTIAL_SUITE
  };
}

function createAad({
  chunkCount,
  chunkIndex,
  epoch,
  epochId,
  invocationCounter,
  membershipHead,
  organismId,
  plaintextBytes,
  priorConfidentialRoot,
  resourceId
}) {
  return Object.freeze({
    chunk_count: chunkCount,
    chunk_index: chunkIndex,
    epoch,
    epoch_id: epochId,
    format: CONFIDENTIAL_FORMATS.aad,
    invocation_counter: invocationCounter,
    membership_head: membershipHead,
    organism_id: organismId,
    plaintext_bytes: plaintextBytes,
    prior_confidential_root: priorConfidentialRoot,
    resource_id: resourceId,
    suite: CONFIDENTIAL_SUITE
  });
}

function resourcePlaintextParts(resourceBytes) {
  let resource;
  try {
    resource = new Uint8Array(resourceBytes);
  } catch {
    confidentialFail("E_CONFIDENTIAL_FORMAT", "/resource", "bytes-required");
  }
  if (
    resource.byteLength < 1 ||
    resource.byteLength > CONFIDENTIAL_LIMITS.resource_bytes
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_LIMIT",
      "/resource",
      `1..${CONFIDENTIAL_LIMITS.resource_bytes}`
    );
  }
  const metadata = canonicalBytes({
    format: CONFIDENTIAL_FORMATS.encrypted_resource,
    resource_commitment: plaintextCommitment(resource),
    resource_size: resource.byteLength,
    suite: CONFIDENTIAL_SUITE
  });
  const parts = [metadata];
  for (
    let offset = 0;
    offset < resource.byteLength;
    offset += CONFIDENTIAL_LIMITS.chunk_plaintext_bytes
  ) {
    parts.push(
      resource.slice(
        offset,
        offset + CONFIDENTIAL_LIMITS.chunk_plaintext_bytes
      )
    );
  }
  if (parts.length > CONFIDENTIAL_LIMITS.max_chunks) {
    confidentialFail("E_CONFIDENTIAL_LIMIT", "/chunks", "64");
  }
  return { parts, resource };
}

export function snapshotConfidentialCustodians(custodians) {
  let entries;
  try {
    entries = copyOwnDataArray(custodians, "confidential custodians");
  } catch {
    confidentialFail("E_CONFIDENTIAL_MEMBERSHIP", "/custodians", "own-data-array");
  }
  if (
    entries.length < 1 ||
    entries.length > CONFIDENTIAL_LIMITS.max_custodians
  ) {
    confidentialFail("E_CONFIDENTIAL_MEMBERSHIP", "/custodians", "1..16");
  }
  const owned = entries.map((custodian, index) => {
    exactObjectKeys(
      custodian,
      ["custodian_id", "encryption_key_digest", "encryption_public_key"],
      `/custodians/${index}`
    );
    let values;
    try {
      values = snapshotNamedOwnDataValues(
        custodian,
        ["custodian_id", "encryption_key_digest", "encryption_public_key"],
        `confidential custodian ${index}`
      );
    } catch {
      confidentialFail(
        "E_CONFIDENTIAL_MEMBERSHIP",
        `/custodians/${index}`,
        "own-data-record"
      );
    }
    return Object.freeze({
      custodian_id: values[0],
      encryption_key_digest: values[1],
      encryption_public_key: values[2]
    });
  });
  const sorted = owned.sort((left, right) =>
    left.custodian_id < right.custodian_id
      ? -1
      : left.custodian_id > right.custodian_id
        ? 1
        : 0
  );
  const recipientIds = new Set();
  const encryptionDigests = new Set();
  for (const [index, custodian] of sorted.entries()) {
    assertCustodianId(custodian.custodian_id, `/custodians/${index}/custodian_id`);
    assertDigest(
      custodian.encryption_key_digest,
      `/custodians/${index}/encryption_key_digest`
    );
    if (
      recipientIds.has(custodian.custodian_id) ||
      encryptionDigests.has(custodian.encryption_key_digest)
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_MEMBERSHIP",
        `/custodians/${index}`,
        "duplicate"
      );
    }
    recipientIds.add(custodian.custodian_id);
    encryptionDigests.add(custodian.encryption_key_digest);
  }
  return Object.freeze(sorted);
}

export async function createConfidentialPackage({
  authority,
  custodians,
  epoch,
  epochId,
  expectedNextCounter = "0",
  expectedPriorReceiptDigest = null,
  fault = null,
  membershipHead,
  organismId,
  priorConfidentialRoot,
  resourceBytes,
  resourceId,
  transitionId
}) {
  parseEpoch(epoch);
  assertDigest(epochId, "/epoch_id");
  assertDigest(membershipHead, "/membership_head");
  assertOrganismId(organismId);
  assertDigest(priorConfidentialRoot, "/prior_confidential_root");
  assertResourceId(resourceId);
  const membership = snapshotConfidentialCustodians(custodians);
  const descriptor = counterAuthorityDescriptor(authority);
  const derivedEpochId = deriveConfidentialEpochId({
    authorityId: descriptor?.authority_id,
    authorityPublicKey: descriptor?.authority_public_key,
    custodianEncryptionKeys: membership
      .map(({ encryption_key_digest: digest }) => digest)
      .sort(),
    epoch,
    membershipHead,
    organismId,
    transitionId
  });
  if (derivedEpochId !== epochId) {
    confidentialFail("E_CONFIDENTIAL_EPOCH", "/epoch_id", "basis");
  }
  const { parts, resource } = resourcePlaintextParts(resourceBytes);
  const reservation = await reserveCounterAuthority(authority, {
    count: String(parts.length),
    epoch,
    epochId,
    expectedNextCounter,
    expectedPriorReceiptDigest
  });
  const independentlyVerified = verifyCounterReservationReceipt({
    expectedEpochId: epochId,
    expectedPriorNextCounter: expectedNextCounter,
    expectedPriorReceiptDigest,
    receipt: reservation.receipt
  });
  await fault?.("counter:committed");
  const stagingKey = await generateStagingEpochKey();
  const wraps = [];
  for (let index = 0; index < membership.length; index += 1) {
    const custodian = membership[index];
    wraps.push(
      await wrapEpochKey({
        custodian,
        epoch,
        epochId,
        membershipHead,
        organismId,
        stagingKey
      })
    );
    await fault?.(`wrap:${index}:complete`);
  }
  const chunks = [];
  for (let index = 0; index < parts.length; index += 1) {
    const invocationCounter = String(
      independentlyVerified.intervalStart + BigInt(index)
    );
    const aad = createAad({
      chunkCount: parts.length,
      chunkIndex: index,
      epoch,
      epochId,
      invocationCounter,
      membershipHead,
      organismId,
      plaintextBytes: parts[index].byteLength,
      priorConfidentialRoot,
      resourceId
    });
    const aadBytes = canonicalBytes(aad);
    if (aadBytes.byteLength > CONFIDENTIAL_LIMITS.aad_bytes) {
      confidentialFail("E_CONFIDENTIAL_LIMIT", `/chunks/${index}/aad`, "4096");
    }
    const iv = counterToIv(invocationCounter);
    const ciphertext = new Uint8Array(
      await assertWebCrypto().encrypt(
        {
          additionalData: aadBytes,
          iv,
          name: "AES-GCM",
          tagLength: 128
        },
        stagingKey,
        parts[index]
      )
    );
    if (ciphertext.byteLength !== parts[index].byteLength + 16) {
      confidentialFail(
        "E_CONFIDENTIAL_CRYPTO",
        `/chunks/${index}`,
        "tag-length"
      );
    }
    chunks.push(
      Object.freeze({
        aad,
        aad_digest: canonicalDomainHash(CONFIDENTIAL_DOMAINS.aad, aad),
        ciphertext_base64url: encodeBase64Url(ciphertext),
        ciphertext_bytes: ciphertext.byteLength,
        ciphertext_digest: domainHash(
          CONFIDENTIAL_DOMAINS.ciphertext,
          ciphertext
        ),
        index,
        invocation_counter: invocationCounter,
        iv_base64url: encodeBase64Url(iv),
        tag_bits: 128
      })
    );
    await fault?.(`chunk:${index}:complete`);
  }
  const manifest = {
    authority_id: reservation.basis.authority_id,
    chunks,
    confidential_root: "",
    count: reservation.basis.count,
    epoch,
    epoch_id: epochId,
    format: CONFIDENTIAL_FORMATS.manifest,
    interval_end_exclusive: reservation.basis.interval_end_exclusive,
    interval_start: reservation.basis.interval_start,
    membership_head: membershipHead,
    organism_id: organismId,
    prior_confidential_root: priorConfidentialRoot,
    reservation_receipt_digest: independentlyVerified.digest,
    resource_id: resourceId,
    suite: CONFIDENTIAL_SUITE,
    transition_id: transitionId,
    wraps
  };
  manifest.confidential_root = confidentialRoot(manifest);
  const receipt = transitionReceipt(manifest);
  const packageValue = {
    format: CONFIDENTIAL_FORMATS.package,
    manifest,
    receipt,
    reservation_receipt: reservation.receipt
  };
  const packageBytes = canonicalBytes(packageValue);
  if (packageBytes.byteLength > CONFIDENTIAL_LIMITS.package_bytes) {
    confidentialFail(
      "E_CONFIDENTIAL_LIMIT",
      "/package",
      String(CONFIDENTIAL_LIMITS.package_bytes)
    );
  }
  verifyConfidentialPackage({
    expectedCustodians: membership,
    expectedEpochId: epochId,
    expectedMembershipHead: membershipHead,
    expectedOrganismId: organismId,
    expectedPriorConfidentialRoot: priorConfidentialRoot,
    expectedResourceId: resourceId,
    packageBytes
  });
  await fault?.("package:verified");
  return Object.freeze({
    confidentialRoot: manifest.confidential_root,
    counterReceiptDigest: independentlyVerified.digest,
    manifest: Object.freeze(manifest),
    package: Object.freeze(packageValue),
    packageBytes,
    resourceBytes: resource
  });
}

function validateWraps(wraps, manifest, expectedCustodians) {
  if (!Array.isArray(wraps) || wraps.length < 1) {
    confidentialFail("E_CONFIDENTIAL_WRAP", "/manifest/wraps", "nonempty");
  }
  const ids = new Set();
  const digests = new Set();
  let prior = "";
  for (const [index, wrap] of wraps.entries()) {
    exactObjectKeys(wrap, WRAP_KEYS, `/manifest/wraps/${index}`);
    if (
      wrap.format !== CONFIDENTIAL_FORMATS.wrap ||
      wrap.suite !== CONFIDENTIAL_SUITE ||
      wrap.epoch !== manifest.epoch ||
      wrap.epoch_id !== manifest.epoch_id
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", `/manifest/wraps/${index}`, "binding");
    }
    assertCustodianId(wrap.custodian_id, `/manifest/wraps/${index}/custodian_id`);
    assertDigest(
      wrap.custodian_encryption_key,
      `/manifest/wraps/${index}/custodian_encryption_key`
    );
    assertDigest(wrap.label_digest, `/manifest/wraps/${index}/label_digest`);
    assertDigest(
      wrap.wrapped_epoch_key_digest,
      `/manifest/wraps/${index}/wrapped_epoch_key_digest`
    );
    const wrapped = decodeBase64Url(wrap.wrapped_epoch_key_base64url);
    if (
      !wrapped ||
      wrapped.byteLength !== CONFIDENTIAL_LIMITS.rsa_wrapped_bytes ||
      domainHash(CONFIDENTIAL_DOMAINS.wrap, wrapped) !==
        wrap.wrapped_epoch_key_digest ||
      wrap.custodian_id <= prior ||
      ids.has(wrap.custodian_id) ||
      digests.has(wrap.custodian_encryption_key)
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", `/manifest/wraps/${index}`, "set");
    }
    prior = wrap.custodian_id;
    ids.add(wrap.custodian_id);
    digests.add(wrap.custodian_encryption_key);
  }
  if (expectedCustodians !== undefined) {
    const expected = snapshotConfidentialCustodians(expectedCustodians);
    if (
      expected.length !== wraps.length ||
      expected.some(
        (custodian, index) =>
          custodian.custodian_id !== wraps[index].custodian_id ||
          custodian.encryption_key_digest !==
            wraps[index].custodian_encryption_key
      )
    ) {
      confidentialFail("E_CONFIDENTIAL_WRAP", "/manifest/wraps", "membership");
    }
  }
}

export function verifyConfidentialPackage({
  expectedCustodians,
  expectedEpochId,
  expectedMembershipHead,
  expectedOrganismId,
  expectedPriorConfidentialRoot,
  expectedResourceId,
  packageBytes
}) {
  const parsedPackage = parseCanonicalDocument(
    packageBytes,
    CONFIDENTIAL_LIMITS.package_bytes,
    "/package"
  );
  exactObjectKeys(
    parsedPackage.value,
    ["format", "manifest", "receipt", "reservation_receipt"],
    "/package"
  );
  if (parsedPackage.value.format !== CONFIDENTIAL_FORMATS.package) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", "/package/format", "version");
  }
  const { manifest, receipt, reservation_receipt: reservationReceipt } =
    parsedPackage.value;
  exactObjectKeys(manifest, MANIFEST_KEYS, "/manifest");
  if (
    manifest.format !== CONFIDENTIAL_FORMATS.manifest ||
    manifest.suite !== CONFIDENTIAL_SUITE
  ) {
    confidentialFail("E_CONFIDENTIAL_FORMAT", "/manifest", "version");
  }
  parseEpoch(manifest.epoch, "/manifest/epoch");
  assertDigest(manifest.epoch_id, "/manifest/epoch_id");
  assertDigest(manifest.membership_head, "/manifest/membership_head");
  assertOrganismId(manifest.organism_id, "/manifest/organism_id");
  assertDigest(
    manifest.prior_confidential_root,
    "/manifest/prior_confidential_root"
  );
  assertResourceId(manifest.resource_id, "/manifest/resource_id");
  if (
    typeof manifest.transition_id !== "string" ||
    !/^[A-Za-z0-9._-]{1,64}$/u.test(manifest.transition_id)
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_EPOCH",
      "/manifest/transition_id",
      "identifier"
    );
  }
  assertDigest(manifest.authority_id, "/manifest/authority_id");
  assertDigest(
    manifest.reservation_receipt_digest,
    "/manifest/reservation_receipt_digest"
  );
  assertDigest(manifest.confidential_root, "/manifest/confidential_root");
  if (
    (expectedEpochId !== undefined && manifest.epoch_id !== expectedEpochId) ||
    (expectedMembershipHead !== undefined &&
      manifest.membership_head !== expectedMembershipHead) ||
    (expectedOrganismId !== undefined &&
      manifest.organism_id !== expectedOrganismId) ||
    (expectedPriorConfidentialRoot !== undefined &&
      manifest.prior_confidential_root !== expectedPriorConfidentialRoot) ||
    (expectedResourceId !== undefined &&
      manifest.resource_id !== expectedResourceId)
  ) {
    confidentialFail("E_CONFIDENTIAL_BINDING", "/manifest", "expected");
  }
  const count = parseDecimalString(
    manifest.count,
    CONFIDENTIAL_LIMITS.reservation_count_max,
    "/manifest/count",
    { minimum: 1n }
  );
  const start = parseCounter(
    manifest.interval_start,
    "/manifest/interval_start"
  );
  const end = parseCounter(
    manifest.interval_end_exclusive,
    "/manifest/interval_end_exclusive",
    { exclusive: true, minimum: 1n }
  );
  if (
    start + count !== end ||
    !Array.isArray(manifest.chunks) ||
    BigInt(manifest.chunks.length) !== count
  ) {
    confidentialFail("E_CONFIDENTIAL_COUNTER_RECEIPT", "/manifest", "interval");
  }
  const verifiedReservation = verifyCounterReservationReceipt({
    expectedEpochId: manifest.epoch_id,
    receipt: reservationReceipt
  });
  if (
    verifiedReservation.digest !== manifest.reservation_receipt_digest ||
    verifiedReservation.basis.authority_id !== manifest.authority_id ||
    verifiedReservation.basis.epoch !== manifest.epoch ||
    verifiedReservation.basis.count !== manifest.count ||
    verifiedReservation.basis.interval_start !== manifest.interval_start ||
    verifiedReservation.basis.interval_end_exclusive !==
      manifest.interval_end_exclusive
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_RECEIPT",
      "/manifest",
      "reservation-binding"
    );
  }
  const ivs = new Set();
  for (const [index, chunk] of manifest.chunks.entries()) {
    exactObjectKeys(chunk, CHUNK_KEYS, `/manifest/chunks/${index}`);
    if (
      chunk.index !== index ||
      chunk.invocation_counter !== String(start + BigInt(index)) ||
      chunk.tag_bits !== 128
    ) {
      confidentialFail("E_CONFIDENTIAL_CHUNK", `/manifest/chunks/${index}`, "order");
    }
    parseCounter(
      chunk.invocation_counter,
      `/manifest/chunks/${index}/invocation_counter`
    );
    const iv = assertExactIv(
      chunk.iv_base64url,
      chunk.invocation_counter,
      `/manifest/chunks/${index}/iv_base64url`
    );
    const ivKey = encodeBase64Url(iv);
    if (ivs.has(ivKey)) {
      confidentialFail("E_CONFIDENTIAL_IV", `/manifest/chunks/${index}`, "duplicate");
    }
    ivs.add(ivKey);
    exactObjectKeys(chunk.aad, AAD_KEYS, `/manifest/chunks/${index}/aad`);
    if (
      chunk.aad.format !== CONFIDENTIAL_FORMATS.aad ||
      chunk.aad.suite !== CONFIDENTIAL_SUITE ||
      chunk.aad.chunk_count !== manifest.chunks.length ||
      chunk.aad.chunk_index !== index ||
      chunk.aad.epoch !== manifest.epoch ||
      chunk.aad.epoch_id !== manifest.epoch_id ||
      chunk.aad.invocation_counter !== chunk.invocation_counter ||
      chunk.aad.membership_head !== manifest.membership_head ||
      chunk.aad.organism_id !== manifest.organism_id ||
      chunk.aad.prior_confidential_root !== manifest.prior_confidential_root ||
      chunk.aad.resource_id !== manifest.resource_id ||
      !Number.isSafeInteger(chunk.aad.plaintext_bytes) ||
      chunk.aad.plaintext_bytes < 1 ||
      chunk.aad.plaintext_bytes >
        CONFIDENTIAL_LIMITS.chunk_plaintext_bytes
    ) {
      confidentialFail("E_CONFIDENTIAL_AAD", `/manifest/chunks/${index}/aad`, "binding");
    }
    const aadBytes = canonicalBytes(chunk.aad);
    if (
      aadBytes.byteLength > CONFIDENTIAL_LIMITS.aad_bytes ||
      chunk.aad_digest !==
        canonicalDomainHash(CONFIDENTIAL_DOMAINS.aad, chunk.aad)
    ) {
      confidentialFail("E_CONFIDENTIAL_AAD", `/manifest/chunks/${index}`, "digest");
    }
    const ciphertext = decodeBase64Url(chunk.ciphertext_base64url);
    if (
      !ciphertext ||
      ciphertext.byteLength !== chunk.aad.plaintext_bytes + 16 ||
      chunk.ciphertext_bytes !== ciphertext.byteLength ||
      chunk.ciphertext_digest !==
        domainHash(CONFIDENTIAL_DOMAINS.ciphertext, ciphertext)
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_CHUNK",
        `/manifest/chunks/${index}`,
        "ciphertext"
      );
    }
  }
  validateWraps(manifest.wraps, manifest, expectedCustodians);
  const recomputedEpochId = deriveConfidentialEpochId({
    authorityId: verifiedReservation.basis.authority_id,
    authorityPublicKey: verifiedReservation.basis.authority_public_key,
    custodianEncryptionKeys: manifest.wraps
      .map(({ custodian_encryption_key: digest }) => digest)
      .sort(),
    epoch: manifest.epoch,
    membershipHead: manifest.membership_head,
    organismId: manifest.organism_id,
    transitionId: manifest.transition_id
  });
  if (recomputedEpochId !== manifest.epoch_id) {
    confidentialFail("E_CONFIDENTIAL_EPOCH", "/manifest/epoch_id", "basis");
  }
  if (confidentialRoot(manifest) !== manifest.confidential_root) {
    confidentialFail(
      "E_CONFIDENTIAL_PACKAGE_ROOT",
      "/manifest/confidential_root",
      "digest"
    );
  }
  exactObjectKeys(
    receipt,
    [
      "confidential_root",
      "epoch",
      "epoch_id",
      "format",
      "reservation_receipt_digest",
      "suite"
    ],
    "/receipt"
  );
  const expectedReceipt = transitionReceipt(manifest);
  if (
    encodeBase64Url(canonicalBytes(receipt)) !==
    encodeBase64Url(canonicalBytes(expectedReceipt))
  ) {
    confidentialFail("E_CONFIDENTIAL_RECEIPT", "/receipt", "binding");
  }
  return Object.freeze({
    bytes: parsedPackage.bytes,
    confidentialRoot: manifest.confidential_root,
    manifest: Object.freeze(manifest),
    package: Object.freeze(parsedPackage.value),
    receipt: Object.freeze(receipt),
    receiptDigest: canonicalDomainHash(CONFIDENTIAL_DOMAINS.receipt, receipt),
    reservation: verifiedReservation
  });
}

async function decryptConfidentialPackageWithEpochKey({
  custodian,
  expectedCustodians,
  expectedEpochId,
  expectedMembershipHead,
  expectedOrganismId,
  expectedPriorConfidentialRoot,
  expectedResourceId,
  packageBytes,
  privateKey
}) {
  let verified;
  try {
    verified = verifyConfidentialPackage({
      expectedCustodians,
      expectedEpochId,
      expectedMembershipHead,
      expectedOrganismId,
      expectedPriorConfidentialRoot,
      expectedResourceId,
      packageBytes
    });
  } catch (error) {
    if (error instanceof Error && error.code) throw error;
    confidentialFail("E_CONFIDENTIAL_REJECTED", "/package", "invalid");
  }
  const wrap = verified.manifest.wraps.find(
    (entry) =>
      entry.custodian_id === custodian?.custodian_id &&
      entry.custodian_encryption_key === custodian?.encryption_key_digest
  );
  if (!wrap) {
    confidentialFail("E_CONFIDENTIAL_KEY_UNAVAILABLE", "/wrap", "recipient");
  }
  let epochKey;
  try {
    epochKey = await unwrapEpochKey({
      custodian,
      epoch: verified.manifest.epoch,
      epochId: verified.manifest.epoch_id,
      membershipHead: verified.manifest.membership_head,
      organismId: verified.manifest.organism_id,
      privateKey,
      wrap
    });
  } catch {
    confidentialFail("E_CONFIDENTIAL_KEY_UNAVAILABLE", "/wrap", "unavailable");
  }
  const plaintextParts = [];
  try {
    for (const chunk of verified.manifest.chunks) {
      const plaintext = new Uint8Array(
        await assertWebCrypto().decrypt(
          {
            additionalData: canonicalBytes(chunk.aad),
            iv: assertExactIv(
              chunk.iv_base64url,
              chunk.invocation_counter
            ),
            name: "AES-GCM",
            tagLength: 128
          },
          epochKey,
          decodeBase64Url(chunk.ciphertext_base64url)
        )
      );
      if (plaintext.byteLength !== chunk.aad.plaintext_bytes) {
        confidentialFail("E_CONFIDENTIAL_REJECTED", "/chunks", "length");
      }
      plaintextParts.push(plaintext);
    }
  } catch {
    confidentialFail("E_CONFIDENTIAL_REJECTED", "/chunks", "authentication");
  }
  let metadata;
  try {
    metadata = parseCanonicalDocument(
      plaintextParts[0],
      CONFIDENTIAL_LIMITS.chunk_plaintext_bytes,
      "/encrypted_resource"
    ).value;
    exactObjectKeys(
      metadata,
      ["format", "resource_commitment", "resource_size", "suite"],
      "/encrypted_resource"
    );
    if (
      metadata.format !== CONFIDENTIAL_FORMATS.encrypted_resource ||
      metadata.suite !== CONFIDENTIAL_SUITE ||
      !Number.isSafeInteger(metadata.resource_size) ||
      metadata.resource_size < 1 ||
      metadata.resource_size > CONFIDENTIAL_LIMITS.resource_bytes
    ) {
      throw new Error("metadata");
    }
    assertDigest(
      metadata.resource_commitment,
      "/encrypted_resource/resource_commitment"
    );
  } catch {
    confidentialFail("E_CONFIDENTIAL_REJECTED", "/encrypted_resource", "semantic");
  }
  const resource = concatBytes(...plaintextParts.slice(1));
  if (
    resource.byteLength !== metadata.resource_size ||
    plaintextCommitment(resource) !== metadata.resource_commitment
  ) {
    confidentialFail("E_CONFIDENTIAL_REJECTED", "/resource", "commitment");
  }
  return Object.freeze({
    confidential_root: verified.confidentialRoot,
    epoch_key: epochKey,
    resource_bytes: resource,
    resource_id: verified.manifest.resource_id,
    status: "available"
  });
}

export async function decryptConfidentialPackage(options) {
  const decrypted = await decryptConfidentialPackageWithEpochKey(options);
  return Object.freeze({
    confidential_root: decrypted.confidential_root,
    resource_bytes: decrypted.resource_bytes,
    resource_id: decrypted.resource_id,
    status: decrypted.status
  });
}

// Internal protocol composition only. This symbol is intentionally omitted from
// src/index.mjs and the packaged SDK so the epoch-key handle cannot cross a
// supported public API boundary.
export function decryptConfidentialPackageForRecovery(options) {
  return decryptConfidentialPackageWithEpochKey(options);
}

export async function aesGcmKnownAnswer({
  additionalData = new Uint8Array(),
  ciphertext,
  iv,
  key,
  plaintext
}) {
  const subtle = assertWebCrypto();
  const cryptoKey = await subtle.importKey(
    "raw",
    key,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  const encrypted = new Uint8Array(
    await subtle.encrypt(
      {
        additionalData,
        iv,
        name: "AES-GCM",
        tagLength: 128
      },
      cryptoKey,
      plaintext
    )
  );
  if (ciphertext !== undefined) {
    const expected = new Uint8Array(ciphertext);
    if (
      expected.byteLength !== encrypted.byteLength ||
      expected.some((byte, index) => byte !== encrypted[index])
    ) {
      confidentialFail("E_CONFIDENTIAL_CRYPTO", "/vector", "ciphertext");
    }
  }
  const recovered = new Uint8Array(
    await subtle.decrypt(
      {
        additionalData,
        iv,
        name: "AES-GCM",
        tagLength: 128
      },
      cryptoKey,
      encrypted
    )
  );
  return Object.freeze({ ciphertext: encrypted, plaintext: recovered });
}
