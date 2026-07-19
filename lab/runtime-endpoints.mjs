export const MORTALOS_PRIMARY_ORIGIN = "https://mortal-os.com";
export const MORTALOS_SAFE_API_ORIGIN = "https://mortalos-lab-yonghwan2161.pages.dev";
export const MORTALOS_RELAY_ORIGIN = "https://relay.mortal-os.com";
export const MORTALOS_SCENARIO_PATH = "/api/scenarios";

export function scenarioApiUrl(pageUrl) {
  const pageOrigin = new URL(pageUrl).origin;
  const apiOrigin = pageOrigin === MORTALOS_PRIMARY_ORIGIN
    ? MORTALOS_SAFE_API_ORIGIN
    : pageOrigin;
  return new URL(MORTALOS_SCENARIO_PATH, apiOrigin);
}

export function scenarioCorsOrigin(requestUrl, origin) {
  const requestOrigin = new URL(requestUrl).origin;
  if (origin === requestOrigin) return null;
  if (requestOrigin === MORTALOS_SAFE_API_ORIGIN && origin === MORTALOS_PRIMARY_ORIGIN) {
    return MORTALOS_PRIMARY_ORIGIN;
  }
  return false;
}
