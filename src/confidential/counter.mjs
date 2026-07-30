import {
  decodeBase64Url,
  encodeBase64Url
} from "../bytes.mjs";
import { canonicalBytes } from "../codec.mjs";
import {
  isStrictEd25519PublicKey,
  verifyEd25519
} from "../crypto.mjs";
import {
  CONFIDENTIAL_DOMAINS,
  CONFIDENTIAL_FORMATS,
  CONFIDENTIAL_LIMITS,
  CONFIDENTIAL_SUITE,
  assertDigest,
  canonicalDomainHash,
  confidentialFail,
  counterToIv,
  domainHash,
  exactObjectKeys,
  parseCounter,
  parseDecimalString,
  parseEpoch,
  randomTagged,
  taggedBytes
} from "./format.mjs";
import { assertWebCrypto } from "./keys.mjs";

const BASIS_KEYS = [
  "authority_id",
  "authority_public_key",
  "count",
  "epoch",
  "epoch_id",
  "format",
  "interval_end_exclusive",
  "interval_start",
  "next_counter",
  "prior_next_counter",
  "prior_receipt_digest",
  "request_id",
  "suite"
];

const OBSERVED_EQUIVOCATIONS = new WeakSet();
const COUNTER_AUTHORITY_RECORDS = new WeakMap();
const COUNTER_AUTHORITY_FACADES = new WeakMap();
const COUNTER_AUTHORITY_STORE_RECORDS = new WeakMap();

export function registerCounterAuthorityStore(
  store,
  { inspect, transact }
) {
  if (
    !store ||
    (typeof store !== "object" && typeof store !== "function") ||
    typeof inspect !== "function" ||
    typeof transact !== "function" ||
    COUNTER_AUTHORITY_STORE_RECORDS.has(store)
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority",
      "store-capability"
    );
  }
  COUNTER_AUTHORITY_STORE_RECORDS.set(
    store,
    Object.freeze({ inspect, transact })
  );
  return store;
}

function requireCounterAuthorityRecord(authority) {
  const record =
    COUNTER_AUTHORITY_RECORDS.get(authority) ??
    COUNTER_AUTHORITY_FACADES.get(authority);
  if (!record) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority",
      "exact-instance"
    );
  }
  return record;
}

export function isLinearizableCounterAuthority(authority) {
  return (
    COUNTER_AUTHORITY_RECORDS.has(authority) ||
    COUNTER_AUTHORITY_FACADES.has(authority)
  );
}

export function counterAuthorityDescriptor(authority) {
  const record = requireCounterAuthorityRecord(authority);
  return Object.freeze({
    authority_id: record.authorityId,
    authority_public_key: record.authorityPublicKey
  });
}

export async function inspectCounterAuthority(authority, epochId) {
  return requireCounterAuthorityRecord(authority).inspect(epochId);
}

export async function retireCounterAuthority(authority, epochId) {
  const record = requireCounterAuthorityRecord(authority);
  return record.transact(epochId, async (active) => {
    if (!active) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "lost"
      );
    }
    return { next: { ...active, retired: true }, value: true };
  });
}

export function reserveCounterAuthority(authority, input) {
  return requireCounterAuthorityRecord(authority).reserveRange(input);
}

export function createCounterAuthorityFacade({
  authority,
  close = () => {},
  keyPolicy = null
}) {
  const record = requireCounterAuthorityRecord(authority);
  if (typeof close !== "function") {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_AUTHORITY",
      "/counter_authority",
      "close"
    );
  }
  const facade = {
    get descriptor() {
      return counterAuthorityDescriptor(facade);
    },
    get keyPolicy() {
      return keyPolicy;
    },
    reserveRange(input) {
      return reserveCounterAuthority(facade, input);
    },
    inspect(epochId) {
      return inspectCounterAuthority(facade, epochId);
    },
    retire(epochId) {
      return retireCounterAuthority(facade, epochId);
    },
    close() {
      return close();
    }
  };
  COUNTER_AUTHORITY_FACADES.set(facade, record);
  return Object.freeze(facade);
}

export function deriveCounterAuthorityId(authorityPublicKey) {
  const raw = taggedBytes(
    authorityPublicKey,
    "ed25519:",
    32,
    "/authority_public_key"
  );
  if (!isStrictEd25519PublicKey(authorityPublicKey)) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_RECEIPT",
      "/authority_public_key",
      "strict-ed25519"
    );
  }
  return domainHash(CONFIDENTIAL_DOMAINS.authority, raw);
}

export function deriveConfidentialEpochId({
  authorityId,
  authorityPublicKey,
  custodianEncryptionKeys,
  epoch,
  membershipHead,
  organismId,
  transitionId
}) {
  assertDigest(authorityId, "/counter_authority_id");
  if (deriveCounterAuthorityId(authorityPublicKey) !== authorityId) {
    confidentialFail(
      "E_CONFIDENTIAL_EPOCH",
      "/counter_authority_id",
      "authority-binding"
    );
  }
  parseEpoch(epoch);
  assertDigest(membershipHead, "/membership_head");
  if (
    !Array.isArray(custodianEncryptionKeys) ||
    custodianEncryptionKeys.length < 1
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_EPOCH",
      "/custodian_encryption_keys",
      "nonempty"
    );
  }
  const sorted = [...custodianEncryptionKeys].sort();
  if (
    sorted.some((digest, index) => {
      assertDigest(digest, `/custodian_encryption_keys/${index}`);
      return digest !== custodianEncryptionKeys[index] ||
        (index > 0 && digest === sorted[index - 1]);
    })
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_EPOCH",
      "/custodian_encryption_keys",
      "sorted-unique"
    );
  }
  if (
    typeof organismId !== "string" ||
    !/^mortalos:[A-Za-z0-9_-]{43}$/u.test(organismId) ||
    typeof transitionId !== "string" ||
    !/^[A-Za-z0-9._-]{1,64}$/u.test(transitionId)
  ) {
    confidentialFail("E_CONFIDENTIAL_EPOCH", "", "identifier");
  }
  return canonicalDomainHash(CONFIDENTIAL_DOMAINS.epoch, {
    counter_authority_id: authorityId,
    counter_authority_public_key: authorityPublicKey,
    custodian_encryption_keys: sorted,
    epoch,
    format: CONFIDENTIAL_FORMATS.epoch_id,
    membership_head: membershipHead,
    organism_id: organismId,
    suite: CONFIDENTIAL_SUITE,
    transition_id: transitionId
  });
}

export function counterReservationMessage(basis) {
  return taggedBytes(
    domainHash(CONFIDENTIAL_DOMAINS.reservation, canonicalBytes(basis)),
    "sha256:",
    32,
    "/reservation"
  );
}

export function counterReceiptDigest(receipt) {
  return canonicalDomainHash(
    CONFIDENTIAL_DOMAINS.reservation_receipt,
    receipt
  );
}

export function verifyCounterReservationReceipt({
  expectedEpochId,
  expectedPriorNextCounter,
  expectedPriorReceiptDigest,
  receipt
}) {
  try {
    exactObjectKeys(receipt, ["basis", "format", "signature"], "/receipt");
    if (receipt.format !== CONFIDENTIAL_FORMATS.counter_receipt) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/format",
        "version"
      );
    }
    exactObjectKeys(receipt.basis, BASIS_KEYS, "/receipt/basis");
    const basis = receipt.basis;
    if (
      basis.format !== CONFIDENTIAL_FORMATS.counter_basis ||
      basis.suite !== CONFIDENTIAL_SUITE
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/basis",
        "version"
      );
    }
    parseEpoch(basis.epoch, "/receipt/basis/epoch");
    assertDigest(basis.epoch_id, "/receipt/basis/epoch_id");
    if (expectedEpochId !== undefined && basis.epoch_id !== expectedEpochId) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/basis/epoch_id",
        "binding"
      );
    }
    if (
      deriveCounterAuthorityId(basis.authority_public_key) !==
      basis.authority_id
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/basis/authority_id",
        "binding"
      );
    }
    const requestBytes =
      typeof basis.request_id === "string" &&
      basis.request_id.startsWith("reservation:")
        ? decodeBase64Url(basis.request_id.slice(12))
        : null;
    if (!requestBytes || requestBytes.byteLength !== 32) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/basis/request_id",
        "grammar"
      );
    }
    const count = parseDecimalString(
      basis.count,
      CONFIDENTIAL_LIMITS.reservation_count_max,
      "/receipt/basis/count",
      { minimum: 1n }
    );
    const prior = parseCounter(
      basis.prior_next_counter,
      "/receipt/basis/prior_next_counter",
      { exclusive: true }
    );
    const start = parseCounter(
      basis.interval_start,
      "/receipt/basis/interval_start"
    );
    const end = parseCounter(
      basis.interval_end_exclusive,
      "/receipt/basis/interval_end_exclusive",
      { exclusive: true, minimum: 1n }
    );
    const next = parseCounter(
      basis.next_counter,
      "/receipt/basis/next_counter",
      { exclusive: true, minimum: 1n }
    );
    if (
      prior !== start ||
      start + count !== end ||
      next !== end
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/basis",
        "arithmetic"
      );
    }
    if (prior === 0n) {
      if (basis.prior_receipt_digest !== null) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_RECEIPT",
          "/receipt/basis/prior_receipt_digest",
          "first-null"
        );
      }
    } else {
      assertDigest(
        basis.prior_receipt_digest,
        "/receipt/basis/prior_receipt_digest"
      );
    }
    if (
      expectedPriorNextCounter !== undefined &&
      basis.prior_next_counter !== expectedPriorNextCounter
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_STALE",
        "/receipt/basis/prior_next_counter",
        "active-mismatch"
      );
    }
    if (
      expectedPriorReceiptDigest !== undefined &&
      basis.prior_receipt_digest !== expectedPriorReceiptDigest
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_STALE",
        "/receipt/basis/prior_receipt_digest",
        "active-mismatch"
      );
    }
    if (
      !verifyEd25519(
        basis.authority_public_key,
        counterReservationMessage(basis),
        receipt.signature
      )
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_RECEIPT",
        "/receipt/signature",
        "invalid"
      );
    }
    return Object.freeze({
      basis: Object.freeze(basis),
      digest: counterReceiptDigest(receipt),
      intervalEndExclusive: end,
      intervalStart: start,
      receipt: Object.freeze(receipt)
    });
  } catch (error) {
    if (error?.code) throw error;
    confidentialFail("E_CONFIDENTIAL_COUNTER_RECEIPT", "/receipt", "invalid");
  }
}

export class MemoryCounterAuthorityStore {
  #lost = new Set();
  #records = new Map();
  #tail = Promise.resolve();

  constructor() {
    const inspect = (epochId) => this.#inspect(epochId);
    const transact = (epochId, operation) =>
      this.#transact(epochId, operation);
    registerCounterAuthorityStore(this, { inspect, transact });
    Object.defineProperties(this, {
      inspect: {
        configurable: false,
        value: inspect,
        writable: false
      },
      lose: {
        configurable: false,
        value: (epochId) => this.#lose(epochId),
        writable: false
      },
      transact: {
        configurable: false,
        value: transact,
        writable: false
      }
    });
    Object.freeze(this);
  }

  async #transact(epochId, operation) {
    let release;
    const prior = this.#tail;
    this.#tail = new Promise((resolve) => {
      release = resolve;
    });
    await prior;
    try {
      if (this.#lost.has(epochId)) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "lost"
        );
      }
      const current = this.#records.has(epochId)
        ? structuredClone(this.#records.get(epochId))
        : null;
      const outcome = await operation(current);
      if (!outcome || !Object.hasOwn(outcome, "next")) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          "transaction-result"
        );
      }
      if (outcome.next !== null) {
        this.#records.set(epochId, structuredClone(outcome.next));
      }
      return outcome.value;
    } finally {
      release();
    }
  }

  async #inspect(epochId) {
    if (this.#lost.has(epochId)) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "lost"
      );
    }
    return this.#records.has(epochId)
      ? structuredClone(this.#records.get(epochId))
      : null;
  }

  async #lose(epochId) {
    this.#records.delete(epochId);
    this.#lost.add(epochId);
  }

  async transact(epochId, operation) {
    return this.#transact(epochId, operation);
  }

  async inspect(epochId) {
    return this.#inspect(epochId);
  }

  async lose(epochId) {
    return this.#lose(epochId);
  }
}

export async function generateCounterAuthorityKeyMaterial() {
  const subtle = assertWebCrypto();
  const keyPair = await subtle.generateKey(
    { name: "Ed25519" },
    false,
    ["sign", "verify"]
  );
  const raw = new Uint8Array(await subtle.exportKey("raw", keyPair.publicKey));
  const authorityPublicKey = `ed25519:${encodeBase64Url(raw)}`;
  return Object.freeze({
    authorityId: deriveCounterAuthorityId(authorityPublicKey),
    authorityPublicKey,
    privateKey: keyPair.privateKey
  });
}

export class LinearizableCounterAuthority {
  #authorityId;
  #inspect;
  #privateKey;
  #publicKey;
  #transact;

  constructor({ authorityId, authorityPublicKey, privateKey, store }) {
    if (new.target !== LinearizableCounterAuthority) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "exact-constructor"
      );
    }
    if (deriveCounterAuthorityId(authorityPublicKey) !== authorityId) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/authority_id",
        "binding"
      );
    }
    if (
      privateKey?.type !== "private" ||
      privateKey.extractable ||
      !privateKey.usages.includes("sign")
    ) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/private_key",
        "nonextractable-sign-only"
      );
    }
    const storeRecord = COUNTER_AUTHORITY_STORE_RECORDS.get(store);
    if (!storeRecord) {
      confidentialFail(
        "E_CONFIDENTIAL_COUNTER_AUTHORITY",
        "/counter_authority",
        "store"
      );
    }
    const { inspect, transact } = storeRecord;
    this.#authorityId = authorityId;
    this.#publicKey = authorityPublicKey;
    this.#privateKey = privateKey;
    this.#inspect = inspect;
    this.#transact = transact;
    COUNTER_AUTHORITY_RECORDS.set(
      this,
      Object.freeze({
        authorityId,
        authorityPublicKey,
        inspect,
        reserveRange: (input) => this.#reserveRange(input),
        transact
      })
    );
    Object.freeze(this);
  }

  static async create({ store = new MemoryCounterAuthorityStore() } = {}) {
    const keyMaterial = await generateCounterAuthorityKeyMaterial();
    return new LinearizableCounterAuthority({
      authorityId: keyMaterial.authorityId,
      authorityPublicKey: keyMaterial.authorityPublicKey,
      privateKey: keyMaterial.privateKey,
      store
    });
  }

  get descriptor() {
    return Object.freeze({
      authority_id: this.#authorityId,
      authority_public_key: this.#publicKey
    });
  }

  async #reserveRange({
    count,
    epoch,
    epochId,
    expectedNextCounter,
    expectedPriorReceiptDigest,
    requestId = randomTagged("reservation:")
  }) {
    parseEpoch(epoch);
    assertDigest(epochId, "/epoch_id");
    const parsedCount = parseDecimalString(
      count,
      CONFIDENTIAL_LIMITS.reservation_count_max,
      "/count",
      { minimum: 1n }
    );
    parseCounter(expectedNextCounter, "/expected_next_counter", {
      exclusive: true
    });
    if (expectedNextCounter === "0") {
      if (expectedPriorReceiptDigest !== null) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_STALE",
          "/expected_prior_receipt_digest",
          "first-null"
        );
      }
    } else {
      assertDigest(
        expectedPriorReceiptDigest,
        "/expected_prior_receipt_digest"
      );
    }
    return this.#transact(epochId, async (record) => {
      const active =
        record ??
        {
          epoch,
          epoch_id: epochId,
          last_counter_receipt_digest: null,
          next_counter: "0",
          retired: false
        };
      if (
        active.retired ||
        active.epoch !== epoch ||
        active.epoch_id !== epochId
      ) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_AUTHORITY",
          "/counter_authority",
          active.retired ? "retired" : "epoch-binding"
        );
      }
      if (
        active.next_counter !== expectedNextCounter ||
        active.last_counter_receipt_digest !== expectedPriorReceiptDigest
      ) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_STALE",
          "/counter_authority",
          "compare-and-swap"
        );
      }
      const start = BigInt(active.next_counter);
      const end = start + parsedCount;
      if (end > CONFIDENTIAL_LIMITS.counter_max_exclusive) {
        confidentialFail(
          "E_CONFIDENTIAL_COUNTER_EXHAUSTED",
          "/count",
          "epoch-cap"
        );
      }
      const basis = Object.freeze({
        authority_id: this.#authorityId,
        authority_public_key: this.#publicKey,
        count,
        epoch,
        epoch_id: epochId,
        format: CONFIDENTIAL_FORMATS.counter_basis,
        interval_end_exclusive: String(end),
        interval_start: String(start),
        next_counter: String(end),
        prior_next_counter: String(start),
        prior_receipt_digest: active.last_counter_receipt_digest,
        request_id: requestId,
        suite: CONFIDENTIAL_SUITE
      });
      const rawSignature = new Uint8Array(
        await assertWebCrypto().sign(
          { name: "Ed25519" },
          this.#privateKey,
          counterReservationMessage(basis)
        )
      );
      const receipt = Object.freeze({
        basis,
        format: CONFIDENTIAL_FORMATS.counter_receipt,
        signature: `ed25519:${encodeBase64Url(rawSignature)}`
      });
      const verified = verifyCounterReservationReceipt({
        expectedEpochId: epochId,
        expectedPriorNextCounter: active.next_counter,
        expectedPriorReceiptDigest: active.last_counter_receipt_digest,
        receipt
      });
      return {
        next: {
          ...active,
          last_counter_receipt_digest: verified.digest,
          next_counter: String(end)
        },
        value: verified
      };
    });
  }

  async reserveRange(input) {
    return this.#reserveRange(input);
  }

  async inspect(epochId) {
    return this.#inspect(epochId);
  }

  async retire(epochId) {
    return retireCounterAuthority(this, epochId);
  }
}

export function detectCounterAuthorityEquivocation(left, right) {
  const first = verifyCounterReservationReceipt({ receipt: left });
  const second = verifyCounterReservationReceipt({ receipt: right });
  const samePrior =
    first.basis.authority_id === second.basis.authority_id &&
    first.basis.epoch_id === second.basis.epoch_id &&
    first.basis.prior_next_counter === second.basis.prior_next_counter &&
    first.basis.prior_receipt_digest === second.basis.prior_receipt_digest;
  if (samePrior && first.digest !== second.digest) {
    return Object.freeze({
      authority_id: first.basis.authority_id,
      epoch_id: first.basis.epoch_id,
      receipt_digests: Object.freeze([first.digest, second.digest].sort()),
      status: "counter_authority_equivocation"
    });
  }
  return Object.freeze({ status: "no_joint_equivocation" });
}

export async function observeCounterAuthorityEquivocation({
  authority,
  left,
  right
}) {
  const descriptor = counterAuthorityDescriptor(authority);
  const evidence = detectCounterAuthorityEquivocation(left, right);
  if (
    evidence.status !== "counter_authority_equivocation" ||
    descriptor.authority_id !== evidence.authority_id
  ) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_EQUIVOCATION",
      "/counter_authority",
      "evidence-binding"
    );
  }
  await retireCounterAuthority(authority, evidence.epoch_id);
  const retired = await inspectCounterAuthority(authority, evidence.epoch_id);
  if (!retired?.retired) {
    confidentialFail(
      "E_CONFIDENTIAL_COUNTER_EQUIVOCATION",
      "/counter_authority",
      "retirement"
    );
  }
  OBSERVED_EQUIVOCATIONS.add(evidence);
  return evidence;
}

export function isObservedCounterAuthorityEquivocation(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    OBSERVED_EQUIVOCATIONS.has(value)
  );
}

export function reservationIvs(receipt) {
  const verified = verifyCounterReservationReceipt({ receipt });
  const ivs = [];
  for (
    let counter = verified.intervalStart;
    counter < verified.intervalEndExclusive;
    counter += 1n
  ) {
    ivs.push(counterToIv(counter));
  }
  return Object.freeze(ivs);
}
