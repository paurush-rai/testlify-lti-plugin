/**
 * GET /api/members — Fetch course roster from the LMS via NRPS.
 *
 * Query parameters:
 *   role  (optional) — Role to filter members by.
 *                      Accepted values (case-insensitive):
 *                        "Learner" | "Student"            → LTI Learner role  (default)
 *                        "Instructor" | "Teacher"         → LTI Instructor role
 *                        "Administrator" | "Admin"        → LTI Administrator role
 *                        "TeachingAssistant" | "TA"       → LTI TeachingAssistant sub-role
 *                        "ContentDeveloper"               → LTI ContentDeveloper role
 *                        "all"                            → All active members
 *
 * Response:
 *   200 { members: Member[], contextId: string, role: string, total: number }
 *   401 { error: string }
 *   500 { error: string, details: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { getMembers } from "@/lib/lti/nrps";

export async function GET(request: NextRequest) {
  // ── 1. Auth: verify Bearer token ─────────────────────────────────────────
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = auth.slice(7);
  let session;
  try {
    session = verifySessionToken(token);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Invalid or expired session", details: err.message },
      { status: 401 },
    );
  }

  // ── 2. Extract role query param (default: "Learner") ─────────────────────
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim() || "Learner";

  // ── 3. Guard: NRPS must be available in this LTI launch context ──────────
  if (!session.nrps?.context_memberships_url) {
    // Return an empty list instead of a 5xx so the UI can degrade gracefully.
    // NRPS is an optional LTI Advantage service — not every deployment enables it.
    return NextResponse.json(
      {
        members: [],
        contextId: session.context.id,
        role,
        total: 0,
        warning:
          "Names & Roles Provisioning Service (NRPS) is not available for " +
          "this LMS context. Ask your LMS administrator to enable the service " +
          "and grant access to this tool.",
      },
      { status: 200 },
    );
  }

  // ── 4. Fetch members from the LMS ─────────────────────────────────────────
  try {
    const members = await getMembers(session, role);

    return NextResponse.json({
      members: members.map((m) => ({
        user_id: m.user_id,
        name: m.name ?? null,
        email: m.email ?? null,
        roles: m.roles,
        status: m.status ?? "Active",
      })),
      contextId: session.context.id,
      role,
      total: members.length,
    });
  } catch (err: any) {
    console.error("[/api/members] NRPS error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch members",
        details: err.message,
      },
      { status: 500 },
    );
  }
}
