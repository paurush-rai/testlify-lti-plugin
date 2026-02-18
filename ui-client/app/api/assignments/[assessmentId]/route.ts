/**
 * GET /api/assignments/:assessmentId — Fetch assigned students.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import connectToDatabase from "@/lib/db";
import AssessmentAssignment from "@/lib/models/AssessmentAssignment";

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

    const contextId = session.context.id;
    const { assessmentId } = params;

    await connectToDatabase();

    const assignments = await AssessmentAssignment.find({
      assessmentId,
      contextId,
    })
      .sort({ created_at: -1 })
      .select("studentId studentName studentEmail");

    const students = assignments.map((doc) => ({
      user_id: doc.studentId,
      name: doc.studentName,
      email: doc.studentEmail,
    }));

    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch assignments", details: err.message },
      { status: 500 },
    );
  }
}
