import { NextRequest, NextResponse } from "next/server";
import { verifyLtiToken, extractBearerToken } from "@/src/lib/auth-utils";
import {
  fetchCourseMembers,
  filterStudents,
} from "@/src/services/nrps-service";

export async function GET(req: NextRequest) {
  const ltik = extractBearerToken(req);

  // Auth check
  const decoded = verifyLtiToken(ltik);
  if (!ltik || !decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[Members API] Fetching course members via NRPS");

    // Use generic NRPS service to fetch members
    const allMembers = await fetchCourseMembers(ltik);

    // Filter to get only students
    const students = filterStudents(allMembers);

    // Transform to match Student interface
    const formattedStudents = students.map((member) => ({
      user_id: member.user_id,
      name:
        member.name ||
        `${member.given_name || ""} ${member.family_name || ""}`.trim() ||
        "Unknown",
      email: member.email || "",
      roles: member.roles || [],
    }));

    console.log(`[Members API] Returning ${formattedStudents.length} students`);

    return NextResponse.json({ members: formattedStudents });
  } catch (error: any) {
    console.error("[Members API] NRPS failed:", error.message);

    // Fallback: Return current user from token
    console.log("[Members API] Falling back to current user");

    const userId = decoded.user || decoded.sub || "unknown";
    const userName =
      decoded.name ||
      (decoded.given_name && decoded.family_name
        ? `${decoded.given_name} ${decoded.family_name}`.trim()
        : `User ${userId}`);

    const currentUser = {
      user_id: userId,
      name: userName,
      email: decoded.email || "",
      roles: decoded.roles || [
        "http://purl.imsglobal.org/spec/lti/claim/roles#Learner",
      ],
    };

    return NextResponse.json({
      members: [currentUser],
      _note:
        "NRPS unavailable - showing current user only. Error: " + error.message,
    });
  }
}
