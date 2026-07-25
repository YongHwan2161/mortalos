import {
  assertDurableDocumentStructure
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

  async write(operation, document) {
    assertDurableDocumentStructure(document);
    await this.#boundary(`${operation}:before`);
    this.#document = clone(document);
    this.#writes.push(operation);
    await this.#boundary(`${operation}:after`);
  }

  async #boundary(name) {
    if (!this.#fault) return;
    await this.#fault(name);
  }
}
