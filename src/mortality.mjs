export function evaluateMortality({
  custodyDescriptor,
  usableKeyIds,
  stateAvailable,
  latentSuccessorCount = 0,
  authorityLossIrreversible = false
}) {
  const declared = new Set(custodyDescriptor.custodians.map((entry) => entry.key_id));
  const usable = new Set(usableKeyIds.filter((keyId) => declared.has(keyId)));
  const threshold = custodyDescriptor.quorum.threshold;
  const authorityViable = usable.size >= threshold;

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
