export const RELAY_RATE_POLICY = Object.freeze({
  active_endpoints: 2,
  burst_operations_per_minute: 48,
  message_poll_interval_ms: 1_000,
  presence_poll_interval_ms: 3_000,
  presence_touch_interval_ms: 3_000,
  room_requests_per_minute: 300
});

function intervalOperationsPerMinute(intervalMs, { immediate = false } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) throw new TypeError("positive interval required");
  return Math.ceil(60_000 / intervalMs) + (immediate ? 1 : 0);
}

export function relayTwoBrowserRequestBudget(policy = RELAY_RATE_POLICY) {
  const perEndpoint =
    intervalOperationsPerMinute(policy.message_poll_interval_ms, { immediate: true }) +
    intervalOperationsPerMinute(policy.presence_touch_interval_ms, { immediate: true }) +
    intervalOperationsPerMinute(policy.presence_poll_interval_ms);
  const steadyState = perEndpoint * policy.active_endpoints;
  return Object.freeze({
    burst: policy.burst_operations_per_minute,
    ceiling: policy.room_requests_per_minute,
    per_endpoint: perEndpoint,
    steady_state: steadyState,
    worst_case: steadyState + policy.burst_operations_per_minute
  });
}
