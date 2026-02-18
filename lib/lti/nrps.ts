/**
 * Names & Roles Provisioning Service (NRPS) — fetch course roster from LMS.
 */

import { getAccessToken } from "./oauth";
import type { NrpsMember, SessionPayload } from "./types";

const NRPS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

const NRPS_ACCEPT =
  "application/vnd.ims.lti-nrps.v2.membershipcontainer+json";

/**
 * Fetch the course roster from the platform via NRPS.
 * Filters to only Learner/Student roles.
 */
export async function getMembers(
  session: SessionPayload,
): Promise<NrpsMember[]> {
  if (!session.nrps?.context_memberships_url) {
    throw new Error("NRPS endpoint not available in this context");
  }

  const accessToken = await getAccessToken(session.platformId, [NRPS_SCOPE]);

  const res = await fetch(session.nrps.context_memberships_url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: NRPS_ACCEPT,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NRPS request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const members: NrpsMember[] = data.members || [];

  // Filter for learners/students
  return members.filter((member) => {
    const roles = member.roles || [];
    return roles.some(
      (role) =>
        role.includes("Learner") ||
        role.includes("Student") ||
        role.includes(
          "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
        ),
    );
  });
}
