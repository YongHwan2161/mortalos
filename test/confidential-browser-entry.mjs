import { runConfidentialVectors } from "./confidential-vector-runner.mjs";
import {
  IndexedDbCounterAuthority,
  deleteIndexedDbCounterAuthorityStore
} from "../lab/storage/confidential-counter-authority-store.mjs";

globalThis.__MORTALOS_S4_VECTORS__ = runConfidentialVectors;

async function withAuthority(databaseName, operation) {
  const authority = await IndexedDbCounterAuthority.open({ databaseName });
  try {
    return await operation(authority);
  } finally {
    authority.close();
  }
}

globalThis.__MORTALOS_S4_COUNTER_AUTHORITY__ = Object.freeze({
  async descriptor(databaseName) {
    return withAuthority(databaseName, (authority) => ({
      ...authority.descriptor
    }));
  },
  async inspect(databaseName, epochId) {
    return withAuthority(databaseName, (authority) =>
      authority.inspect(epochId)
    );
  },
  async keyPolicy(databaseName) {
    return withAuthority(databaseName, (authority) => authority.keyPolicy);
  },
  async reserve(databaseName, input) {
    try {
      const value = await withAuthority(databaseName, (authority) =>
        authority.reserveRange(input)
      );
      return {
        code: null,
        ok: true,
        receipt: value.receipt
      };
    } catch (error) {
      return {
        code: error?.code ?? "unexpected",
        ok: false
      };
    }
  },
  async wipe(databaseName) {
    await deleteIndexedDbCounterAuthorityStore(databaseName);
    return true;
  }
});
