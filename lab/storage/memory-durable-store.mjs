import {
  assertDurableDocumentStructure,
  durableError
} from "./durable-document.mjs";

function clone(value) {
  return value === null ? null : structuredClone(value);
}

export class MemoryDurableStore {
  #document = null;
  #fault = null;
  #writes = [];

  constructor({ document = null, fault = null, unsafeSkipValidation = false } = {}) {
    if (document !== null && !unsafeSkipValidation) assertDurableDocumentStructure(document);
    this.#document = clone(document);
    this.#fault = fault;
  }

  get writeTrace() {
    return [...this.#writes];
  }

  setFault(fault) {
    this.#fault = fault;
  }

  clearFault() {
    this.#fault = null;
  }

  async read() {
    return clone(this.#document);
  }

  async write(operation, document, { expectedRevision } = {}) {
    assertDurableDocumentStructure(document);
    if (
      expectedRevision !== null &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    ) {
      throw new TypeError("expected durable revision is required");
    }
    const wantedRevision = expectedRevision === null ? 0 : expectedRevision + 1;
    if (document.revision !== wantedRevision) {
      throw durableError("E_DURABLE_CONFLICT", "next durable revision is not consecutive");
    }
    await this.#boundary(`${operation}:before`);
    const currentRevision = this.#document?.revision ?? null;
    if (currentRevision !== expectedRevision) {
      throw durableError("E_DURABLE_CONFLICT", "durable revision changed before commit");
    }
    this.#document = clone(document);
    this.#writes.push(operation);
    await this.#boundary(`${operation}:after`);
  }

  async #boundary(name) {
    if (!this.#fault) return;
    await this.#fault(name);
  }
}
