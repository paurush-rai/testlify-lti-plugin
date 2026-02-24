/**
 * GET /api/scores/:assessmentId — Fetch scores from LMS via AGS,
 * enriched with member name/email via NRPS.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { getLineItems, getScores } from "@/lib/lti/ags";
import { getMembers } from "@/lib/lti/nrps";

export async function GET(
  request: NextRequest,
  { params }: { params: { assessmentId: string } },
) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const session = verifySessionToken(token);

    const { assessmentId } = params;

    if (!session.ags?.lineitems) {
      return NextResponse.json({ scores: [] });
    }

    // Fetch line items filtered by assessmentId tag
    const lineItems = await getLineItems(
      session.platformId,
      session.ags.lineitems,
      assessmentId,
    );

    if (lineItems.length === 0) {
      return NextResponse.json({ scores: [] });
    }

    const lineItemId = lineItems[0].id;

    // Fetch scores/results from the line item
    const rawScores = await getScores(session.platformId, lineItemId);

    // Enrich with name/email from NRPS — non-fatal if NRPS is unavailable
    let memberMap: Record<string, { name: string; email: string }> = {};
    try {
      if (session.nrps?.context_memberships_url) {
        const members = await getMembers(session, "all");
        for (const m of members) {
          memberMap[m.user_id] = {
            name: m.name || "",
            email: m.email || "",
          };
        }
      }
    } catch {
      // NRPS failure is non-fatal — scores still shown without name/email
    }

    const mappedScores = rawScores.map((s: any) => {
      const member = memberMap[s.userId] ?? {};
      return {
        userId: s.userId,
        userName: member.name || null,
        userEmail: member.email || null,
        scoreGiven: s.resultScore ?? s.scoreGiven,
        scoreMaximum: s.resultMaximum ?? s.scoreMaximum,
        comment: s.comment || null,
        timestamp: s.timestamp,
        activityProgress:
          s.resultScore !== undefined
            ? "Completed"
            : s.activityProgress || "Initialized",
        gradingProgress: s.gradingProgress || "FullyGraded",
      };
    });

    return NextResponse.json({ scores: mappedScores });
  } catch (err: any) {
    return NextResponse.json(
      { scores: [], error: err.message },
      { status: 200 },
    );
  }
}
