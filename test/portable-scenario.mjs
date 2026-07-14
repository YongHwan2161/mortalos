import {
  canonicalBytes,
  createLineage,
  evaluateMortality
} from "../src/index.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function runPortableScenario(singleton) {
  const opened = createLineage(canonicalBytes(singleton.birth));
  if (opened.status !== "accept") throw new Error(`singleton Genesis rejected: ${opened.code}`);
  const pulse = opened.lineage.append({
    envelopeBytes: canonicalBytes(singleton.heartbeat),
    eventPayloadBytes: canonicalBytes(singleton.payload)
  });
  if (pulse.status !== "accept") throw new Error(`singleton Pulse rejected: ${pulse.code}`);

  const unsigned = clone(singleton.heartbeat);
  unsigned.approvals = [];
  const unsignedResult = opened.lineage.validateCandidate({
    envelopeBytes: canonicalBytes(unsigned),
    eventPayloadBytes: canonicalBytes(singleton.payload)
  });
  const alive = evaluateMortality({
    head: pulse,
    usableKeyIds: [singleton.actor.key_id],
    stateAvailable: true
  });
  const dead = evaluateMortality({
    head: pulse,
    usableKeyIds: [],
    stateAvailable: false,
    authorityLossIrreversible: true
  });

  return {
    birth_status: opened.status,
    pulse_status: pulse.status,
    organism_id: opened.lineage.genesis.organism_id,
    genesis_hash: opened.lineage.genesis.object_hash,
    pulse_hash: pulse.object_hash,
    unsigned_code: unsignedResult.code,
    alive_status: alive.status,
    dead_status: dead.status
  };
}
