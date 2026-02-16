/**
 * Generic LTI 1.3 Names and Role Provisioning Service (NRPS) Implementation
 *
 * This is a simplified version that relies on ltijs's built-in NRPS service.
 * It attempts to use the service and falls back gracefully if it fails.
 *
 * Works with ANY LMS that supports LTI 1.3 NRPS (Moodle, Canvas, Blackboard, etc.)
 */

import { getLtiProvider } from "../lib/lti-provider";

interface NRPSMember {
  user_id: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  roles: string[];
  status?: string;
}

/**
 * Fetch course members using NRPS
 * Uses ltijs built-in service which handles all the OAuth and HTTP complexity
 */
export async function fetchCourseMembers(ltik: string): Promise<NRPSMember[]> {
  try {
    const lti = await getLtiProvider();

    console.log(
      "[NRPS] Attempting to fetch members using ltijs NamesAndRoles service",
    );

    // Use ltijs built-in NRPS service
    // This should work if:
    // 1. The LMS supports NRPS
    // 2. NRPS was requested during platform registration
    // 3. The ID token contains the NRPS claim
    const result = await lti.NamesAndRoles.getMembers(ltik);

    if (!result || !result.members) {
      console.log("[NRPS] No members returned");
      return [];
    }

    console.log(`[NRPS] Success! Found ${result.members.length} members`);
    return result.members;
  } catch (error: any) {
    console.error("[NRPS] ltijs NamesAndRoles service failed:", error.message);

    // Provide helpful error message
    if (error.message.includes("MISSING_PLATFORM_URL")) {
      throw new Error(
        "NRPS service unavailable in serverless mode. " +
          "The ltijs NamesAndRoles service requires stateful Express.js middleware. " +
          "To use NRPS, you need to either: " +
          "1) Use Express.js backend (restore lti-server), or " +
          "2) Implement manual NRPS HTTP calls with OAuth token exchange",
      );
    }

    throw error;
  }
}

/**
 * Filter members to get only students/learners
 */
export function filterStudents(members: NRPSMember[]): NRPSMember[] {
  return members.filter((member) =>
    member.roles?.some(
      (role) =>
        role.includes("Learner") ||
        role.includes("Student") ||
        role.includes("learner") ||
        role.includes("student"),
    ),
  );
}
