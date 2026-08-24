import { canonicalBytes, createLineage } from "../src/index.mjs";

export class ProductContinuityEvidenceView {
  #lineage;
  #localKeyId;

  constructor(endpointId, records, localKeyId) {
    if (!Array.isArray(records) || records.length < 1) {
      throw new Error("FILE_CONTINUITY_EVIDENCE: canonical records required");
    }
    const opened = createLineage(canonicalBytes(records[0].envelope));
    if (opened.status !== "accept") throw new Error(`FILE_CONTINUITY_EVIDENCE: ${opened.code}`);
    this.endpointId = endpointId;
    this.#lineage = opened.lineage;
    this.#localKeyId = localKeyId;
    for (const record of records.slice(1)) this.appendEvidence(record);
  }

  get publicState() {
    const head = this.#lineage.head;
    if (!head) throw new Error("FILE_CONTINUITY_EVIDENCE: forked lineage");
    return {
      endpoint_id: this.endpointId,
      head_hash: head.object_hash,
      organism_id: this.#lineage.genesis.organism_id,
      pulse_count: Number(head.sequence),
      sequence: head.sequence,
      signing_authority: head.next_custody_descriptor.custodians
        .some((entry) => entry.key_id === this.#localKeyId),
      state_root: head.next_state_root,
      status: "accepted"
    };
  }

  appendEvidence(record) {
    const appended = this.#lineage.append({
      envelopeBytes: canonicalBytes(record.envelope),
      eventPayloadBytes: canonicalBytes(record.payload)
    });
    if (appended.status !== "accept") {
      throw new Error(`FILE_CONTINUITY_EVIDENCE: ${appended.code ?? appended.status}`);
    }
    return this.publicState;
  }

  removeAuthority() {
    this.#localKeyId = null;
    return this.publicState;
  }
}
