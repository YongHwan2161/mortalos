import {
  confidentialEpochStoreCapabilityInternal
} from "../src/confidential/recovery-internal.mjs";
import {
  contentStoreCapabilityInternal
} from "../src/state/recovery-internal.mjs";

export function commitConfidentialActiveForTest(store, options) {
  return confidentialEpochStoreCapabilityInternal(store).commitActive(options);
}

export function commitStateActiveForTest(store, record, options = {}) {
  return contentStoreCapabilityInternal(store).commitActive(record, options);
}
