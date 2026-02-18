/**
 * POST /api/webhook/score — Receive Testlify webhook, submit score to LMS via AGS.
 */

import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import AssessmentAssignment from "@/lib/models/AssessmentAssignment";
import { findPlatformById } from "@/lib/lti/platform-store";
import { findOrCreateLineItemAndSubmitScore } from "@/lib/lti/ags";

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LTI_WEBHOOK_SECRET;
    const providedSecret = request.headers.get("x-webhook-secret");

    if (!secret || secret !== providedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { studentEmail, assessmentId, score, maxScore } = body;

    if (!studentEmail || !assessmentId || score === undefined || !maxScore) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Find assignments matching this email + assessmentId
    // Using Mongoose find
    const assignments = await AssessmentAssignment.find({
      studentEmail,
      assessmentId,
    });

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 },
      );
    }

    const results = [];

    for (const assignment of assignments) {
      try {
        if (!assignment.platformId || !assignment.lineItemUrl) {
          results.push({
            id: assignment._id.toString(),
            status: "skipped",
            reason: "Missing config",
          });
          continue;
        }

        const platformId = assignment.platformId; // String now
        const platform = await findPlatformById(platformId);
        if (!platform) {
          results.push({
            id: assignment._id.toString(),
            status: "failed",
            reason: "Platform not found",
          });
          continue;
        }

        await findOrCreateLineItemAndSubmitScore(
          platformId,
          assignment.lineItemUrl,
          assessmentId,
          assignment.assessmentTitle || "Assessment Score",
          assignment.studentId,
          score,
          maxScore,
        );

        results.push({ id: assignment._id.toString(), status: "success" });
      } catch (innerErr: any) {
        results.push({
          id: assignment._id.toString(),
          status: "error",
          error: innerErr.message,
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 },
    );
  }
}
