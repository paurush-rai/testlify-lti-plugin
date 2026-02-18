/**
 * POST /api/invite-candidates — Send invites via Testlify API.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import connectToDatabase from "@/lib/db";
import AssessmentAssignment from "@/lib/models/AssessmentAssignment";

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const session = verifySessionToken(token);

    const body = await request.json();
    const { assessmentId } = body;

    if (!assessmentId) {
      return NextResponse.json(
        { error: "Assessment ID is required" },
        { status: 400 },
      );
    }

    const contextId = session.context.id;
    await connectToDatabase();

    // Fetch assigned students
    const assignments = await AssessmentAssignment.find({
      assessmentId,
      contextId,
    }).select("studentName studentEmail");

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "No students assigned to this assessment" },
        { status: 400 },
      );
    }

    const candidateInvites = assignments.map((row) => ({
      firstName: row.studentName?.split(" ")[0] || "",
      lastName: row.studentName?.split(" ").slice(1).join(" ") || "",
      email: row.studentEmail || "",
      phoneExt: null,
      phone: null,
      candidateGroupId: null,
    }));

    const testlifyToken = process.env.TESTLIFY_TOKEN;
    if (!testlifyToken) {
      return NextResponse.json(
        { error: "TESTLIFY_TOKEN not configured" },
        { status: 500 },
      );
    }

    const inviteUrl =
      "https://api.testlify.com/v1/assessment/candidate/invites";

    const response = await fetch(inviteUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testlifyToken}`,
        "Content-Type": "application/json",
        Accept: "*/*",
        "production-testing": "false",
      },
      body: JSON.stringify({
        candidateInvites,
        assessmentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Testlify API responded with ${response.status}: ${errorText}`,
      );
    }

    const responseData = await response.json();

    return NextResponse.json({
      success: true,
      invitedCount: assignments.length,
      result: responseData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to invite candidates", details: err.message },
      { status: 500 },
    );
  }
}
