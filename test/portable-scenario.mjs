import {
  canonicalBytes,
  createLineage
} from "../src/index.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function runPortableScenario(singleton) {
  const missingPayloadLineage = createLineage(canonicalBytes(singleton.birth));
  const missingHeartbeatPayload = missingPayloadLineage.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: true,
    pendingSuccessors: [{ envelopeBytes: canonicalBytes(singleton.heartbeat) }],
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });
  const opened = createLineage(canonicalBytes(singleton.birth));
  if (opened.status !== "accept") throw new Error(`singleton Genesis rejected: ${opened.code}`);
  const pulse = opened.lineage.append({
    envelopeBytes: canonicalBytes(singleton.heartbeat),
    eventPayloadBytes: canonicalBytes(singleton.payload)
  });
  if (pulse.status !== "accept") throw new Error(`singleton Pulse rejected: ${pulse.code}`);

  const unsigned = clone(singleton.heartbeat);
  unsigned.approvals = [];
  const unsignedResult = opened.lineage.verifyCandidate({
    envelopeBytes: canonicalBytes(unsigned),
    eventPayloadBytes: canonicalBytes(singleton.payload)
  });
  const alive = opened.lineage.evaluateMortality({
    usableKeyIds: [singleton.actor.key_id],
    stateAvailable: true
  });
  const incomplete = opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    authorityLossIrreversible: true
  });
  const dead = opened.lineage.evaluateMortality({
    usableKeyIds: [],
    stateAvailable: false,
    authorityLossIrreversible: true,
    latentEvidenceComplete: true
  });

  return {
    birth_status: opened.status,
    pulse_status: pulse.status,
    organism_id: opened.lineage.genesis.organism_id,
    genesis_hash: opened.lineage.genesis.object_hash,
    pulse_hash: pulse.object_hash,
    unsigned_code: unsignedResult.code,
    missing_heartbeat_payload_status: missingHeartbeatPayload.status,
    alive_status: alive.status,
    incomplete_status: incomplete.status,
    incomplete_latent_evidence_complete: incomplete.latent_evidence_complete,
    dead_status: dead.status,
    dead_latent_evidence_complete: dead.latent_evidence_complete
  };
}
