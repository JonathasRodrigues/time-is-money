/** Major version in the URL path (`/api/v1`). */
export const API_MAJOR = 1 as const;

/** Semver of the v1 wire contract (additive-only within major). */
export const API_CONTRACT_VERSION = '1.3.2' as const;

export const API_BASE_PATH = `/api/v${API_MAJOR}` as const;

/** Response/debug header echoed by handlers. */
export const API_VERSION_HEADER = 'X-Tim-Api-Version' as const;
