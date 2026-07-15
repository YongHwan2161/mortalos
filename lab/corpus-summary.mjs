export function summarizePortableCorpus(result, expected) {
  const boundaryOutcomes = Object.entries(result.boundary_cases);
  return {
    exact: JSON.stringify(result) === JSON.stringify(expected),
    format: result.format,
    named_passed: result.negative_cases.filter((entry) => entry.pass).length,
    named_total: result.negative_cases.length,
    boundary_passed: boundaryOutcomes.filter(
      ([id, outcome]) => JSON.stringify(outcome) === JSON.stringify(expected.boundary_cases[id])
    ).length,
    boundary_total: boundaryOutcomes.length,
    adversarial_cases: result.adversarial.cases,
    adversarial_rejected: result.adversarial.rejected,
    replay: result.fork_cases.replay,
    fork: result.fork_cases.sibling,
    post_fork: result.fork_cases.post_fork
  };
}
