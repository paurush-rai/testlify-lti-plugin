/**
 * GET /api/scores/:assessmentId — Fetch scores from LMS via AGS.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { getLineItems, getScores } from "@/lib/lti/ags";

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

    const mappedScores = rawScores.map((s: any) => ({
      ...s,
      scoreGiven: s.resultScore ?? s.scoreGiven,
      scoreMaximum: s.resultMaximum ?? s.scoreMaximum,
      activityProgress: s.resultScore ? "Completed" : "Initialized",
      gradingProgress: s.gradingProgress || "FullyGraded",
    }));

    return NextResponse.json({ scores: mappedScores });
  } catch (err: any) {
    return NextResponse.json(
      { scores: [], error: err.message },
      { status: 200 },
    );
  }
}
