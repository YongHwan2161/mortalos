import {
  isValidatedAcceptance,
  isValidatedLatentSuccessor
} from "./validator.mjs";

function requireCondition(condition, message) {
  if (!condition) throw new TypeError(message);
}

export function evaluateMortality({
  head,
  usableKeyIds,
  stateAvailable,
  latentSuccessors = [],
  authorityLossIrreversible = false
}) {
  requireCondition(isValidatedAcceptance(head), "head must be a validated acceptance");
  requireCondition(Array.isArray(usableKeyIds), "usableKeyIds must be an array");
  requireCondition(typeof stateAvailable === "boolean", "stateAvailable must be boolean");
  requireCondition(Array.isArray(latentSuccessors), "latentSuccessors must be an array");
  requireCondition(
    typeof authorityLossIrreversible === "boolean",
    "authorityLossIrreversible must be boolean"
  );

  const latentHashes = new Set();
  for (const candidate of latentSuccessors) {
    const trustedSuccessionEvidence =
      (isValidatedAcceptance(candidate) && candidate.kind === "pulse") ||
      isValidatedLatentSuccessor(candidate);
    requireCondition(
      trustedSuccessionEvidence &&
        candidate.organism_id === head.organism_id &&
        candidate.parent_hash === head.object_hash,
      "latent successors must be validated direct children of head"
    );
    latentHashes.add(candidate.object_hash);
  }

  const custodyDescriptor = head.next_custody_descriptor;
  const declared = new Set(custodyDescriptor.custodians.map((entry) => entry.key_id));
  const usable = new Set(usableKeyIds.filter((keyId) => declared.has(keyId)));
  const threshold = custodyDescriptor.quorum.threshold;
  const authorityViable = usable.size >= threshold;
  const latentSuccessorCount = latentHashes.size;

  if (authorityViable && stateAvailable) {
    return {
      status: "operationally_alive",
      authority_viable: true,
      state_viable: true,
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    };
  }
  if (authorityViable) {
    return {
      status: "state_stalled",
      authority_viable: true,
      state_viable: false,
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    };
  }
  if (latentSuccessorCount > 0) {
    return {
      status: "latent_successor_not_dead",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      usable_keys: usable.size,
      threshold,
      latent_successors: latentSuccessorCount
    };
  }
  if (authorityLossIrreversible) {
    return {
      status: "dead_under_v0_assumptions",
      authority_viable: false,
      state_viable: Boolean(stateAvailable),
      usable_keys: usable.size,
      threshold,
      latent_successors: 0
    };
  }
  return {
    status: "authority_unavailable_not_proven_dead",
    authority_viable: false,
    state_viable: Boolean(stateAvailable),
    usable_keys: usable.size,
    threshold,
    latent_successors: 0
  };
}
