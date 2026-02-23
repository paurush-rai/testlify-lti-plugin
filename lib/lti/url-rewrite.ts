/**
 * URL rewriting utilities for server-to-server LMS calls.
 *
 * In Docker dev environments the LMS public hostname (embedded in LTI tokens
 * and id_token claims) differs from its internal Docker container hostname.
 * DEV_LTI_REWRITES maps public → internal so that Next.js (running inside
 * Docker) can reach the LMS when processing NRPS, AGS, and OAuth calls.
 *
 * Format (env var):
 *   "publicOrigin1,internalOrigin1;publicOrigin2,internalOrigin2"
 *
 * Example:
 *   DEV_LTI_REWRITES=http://localhost:8000,http://moodle-docker-webserver-1
 *
 * When a URL is rewritten we also spoof the Host header back to the original
 * public hostname. Without this, Apache / Nginx on the LMS side performs a
 * canonical-hostname redirect which strips the Authorization header and causes
 * 401 errors on NRPS / token endpoint calls.
 */

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Rewrite a URL's origin using DEV_LTI_REWRITES rules.
 * Returns the original URL unchanged if no rule matches or env var is unset.
 */
export function applyUrlRewrites(url: string): string {
  const rewrites = process.env.DEV_LTI_REWRITES;
  if (!rewrites || !url) return url;

  for (const rule of rewrites.split(";")) {
    const commaIdx = rule.indexOf(",");
    if (commaIdx === -1) continue;
    const source = rule.slice(0, commaIdx).trim();
    const target = rule.slice(commaIdx + 1).trim();
    if (source && target && url.startsWith(source)) {
      return target + url.slice(source.length);
    }
  }
  return url;
}

/**
 * Build fetch options for a server-to-server call to the LMS.
 *
 * Applies URL rewriting and, when the URL was rewritten, injects a Host header
 * matching the original public hostname so the LMS web server does not
 * redirect the request.
 *
 * @param originalUrl  URL as it appears in the LTI token / OpenID config
 * @param extra        Additional RequestInit options (headers, method, body…)
 */
export function buildLmsFetchOptions(
  originalUrl: string,
  extra: RequestInit = {},
): { fetchUrl: string; fetchInit: RequestInit } {
  const fetchUrl = applyUrlRewrites(originalUrl);
  const wasRewritten = fetchUrl !== originalUrl;

  const callerHeaders = (extra.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = { ...callerHeaders };

  if (wasRewritten) {
    // Spoof Host so the LMS recognises its own public hostname
    headers["Host"] = new URL(originalUrl).host;
    if (IS_DEV) {
      console.log(
        `[LTI] URL rewritten: ${originalUrl} → ${fetchUrl} (Host: ${headers["Host"]})`,
      );
    }
  }

  const fetchInit: RequestInit = {
    ...extra,
    headers,
    redirect: "follow",
  };

  return { fetchUrl, fetchInit };
}
