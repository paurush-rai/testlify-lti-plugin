/**
 * Names & Roles Provisioning Service (NRPS)
 *
 * Fetches course roster from any LTI 1.3 Advantage–compliant LMS
 * (Moodle, Canvas, Blackboard, D2L Brightspace, Sakai, etc.).
 *
 * Features:
 *  - Optional role filtering via the NRPS `role` URL parameter
 *  - Client-side role matching as a fallback (for LMS platforms that ignore the param)
 *  - Full pagination support via Link rel="next" headers
 *  - Normalises short role names to full LTI 1.3 URNs
 *  - URL rewriting for Docker dev environments (DEV_LTI_REWRITES)
 *  - Host header spoofing to prevent Apache/Nginx from stripping Authorization
 */

import { getAccessToken } from "./oauth";
import { buildLmsFetchOptions } from "./url-rewrite";
import type { NrpsMember, SessionPayload } from "./types";

const NRPS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

const NRPS_ACCEPT =
  "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";

/**
 * Maps common short role names (case-insensitive) to their full LTI 1.3 URNs.
 * The NRPS spec expects the full URN when filtering by role in the query string.
 */
const ROLE_URN_MAP: Record<string, string> = {
  learner: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
  student: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
  instructor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  teacher: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  administrator:
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator",
  admin: "http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator",
  contentdeveloper:
    "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper",
  "content developer":
    "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper",
  mentor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Mentor",
  manager: "http://purl.imsglobal.org/vocab/lis/v2/membership#Manager",
  officer: "http://purl.imsglobal.org/vocab/lis/v2/membership#Officer",
  member: "http://purl.imsglobal.org/vocab/lis/v2/membership#Member",
  observer: "http://purl.imsglobal.org/vocab/lis/v2/membership#Observer",
  teachingassistant:
    "http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant",
  "teaching assistant":
    "http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant",
  ta: "http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant",
};

/**
 * Normalise a role string to its canonical LTI 1.3 URN.
 * If the input is already a full URN it is returned as-is.
 */
function normalizeRoleToUrn(role: string): string {
  const key = role.toLowerCase().trim();
  return ROLE_URN_MAP[key] ?? role;
}

/**
 * Return true if the member has (at least) the given role URN.
 * Matches both full URNs and the short name after the # or last /.
 *
 * Works across LMS platforms that may return roles in different formats:
 *   "Learner"
 *   "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"
 *   "http://purl.imsglobal.org/vocab/lis/v2/membership/Learner#GuestLearner"
 */
function memberHasRole(member: NrpsMember, roleUrn: string): boolean {
  const roles = member.roles ?? [];
  const shortName = (roleUrn.split("#")[1] ?? roleUrn.split("/").pop() ?? "")
    .toLowerCase();

  return roles.some((r) => {
    if (r === roleUrn) return true;
    // Full URN prefix match catches sub-roles (e.g. Instructor#TeachingAssistant)
    if (r.startsWith(roleUrn)) return true;
    // Short name fallback for LMS platforms that use abbreviated roles
    const rShort = (r.split("#")[1] ?? r.split("/").pop() ?? "").toLowerCase();
    return rShort === shortName;
  });
}

/**
 * Parse a HTTP `Link` response header and return the `rel="next"` URL, or null.
 * Example: Link: <https://lms.example.com/nrps?page=2>; rel="next"
 */
function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Fetch a single page from the NRPS endpoint and return the members plus
 * the URL of the next page (if any).
 *
 * Applies URL rewriting and Host header spoofing for Docker dev environments.
 */
async function fetchMembersPage(
  originalUrl: string,
  accessToken: string,
): Promise<{ members: NrpsMember[]; nextUrl: string | null }> {
  const { fetchUrl, fetchInit } = buildLmsFetchOptions(originalUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: NRPS_ACCEPT,
    },
  });

  const res = await fetch(fetchUrl, fetchInit);

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`NRPS request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const members: NrpsMember[] = data.members ?? [];
  const nextUrl = parseNextLink(res.headers.get("link"));

  return { members, nextUrl };
}

/**
 * Fetch the course roster from the LMS via the NRPS service.
 *
 * @param session - LTI session payload (must contain `nrps.context_memberships_url`)
 * @param role    - Role to filter by. Accepts short names ("Learner", "Instructor",
 *                  "Student", "Teacher", "Administrator", "TeachingAssistant", …)
 *                  or full LTI URNs.
 *                  Pass `"all"` to return every active member regardless of role.
 *                  Defaults to `"Learner"`.
 *
 * Cross-LMS notes:
 *  - The role filter is sent as a URL parameter per the NRPS spec.
 *    Most modern LMS platforms (Canvas, Moodle 4+, D2L, Blackboard) honour it.
 *  - A client-side filter is always applied afterwards as a safety net for
 *    platforms that return all members regardless of the role parameter.
 *  - All pages are fetched automatically (pagination via Link rel="next").
 *  - In Docker dev environments, URLs are rewritten via DEV_LTI_REWRITES so
 *    the Next.js server can reach the LMS container.
 */
export async function getMembers(
  session: SessionPayload,
  role: string = "Learner",
): Promise<NrpsMember[]> {
  if (!session.nrps?.context_memberships_url) {
    throw new Error(
      "NRPS endpoint not available in this context. " +
        "Ensure the LMS has granted Names & Roles Provisioning Service permissions.",
    );
  }

  const accessToken = await getAccessToken(session.platformId, [NRPS_SCOPE]);

  const fetchAll = role.toLowerCase().trim() === "all";
  const roleUrn = fetchAll ? null : normalizeRoleToUrn(role);

  // Build the initial URL, appending the role filter when applicable.
  // The NRPS URL comes from the LTI id_token; some LMS URLs already contain
  // query parameters so we check before adding a separator.
  let startUrl = session.nrps.context_memberships_url;
  if (roleUrn) {
    const separator = startUrl.includes("?") ? "&" : "?";
    startUrl = `${startUrl}${separator}role=${encodeURIComponent(roleUrn)}`;
  }

  // Collect all pages — each call applies DEV_LTI_REWRITES internally
  const allMembers: NrpsMember[] = [];
  let currentUrl: string | null = startUrl;

  while (currentUrl) {
    const { members, nextUrl } = await fetchMembersPage(
      currentUrl,
      accessToken,
    );
    allMembers.push(...members);
    currentUrl = nextUrl;
  }

  // Client-side filtering — acts as a fallback for LMS platforms that ignore
  // the role URL parameter, and removes inactive memberships.
  if (fetchAll) {
    return allMembers.filter((m) => !m.status || m.status === "Active");
  }

  return allMembers.filter(
    (m) =>
      (!m.status || m.status === "Active") &&
      memberHasRole(m, roleUrn as string),
  );
}
