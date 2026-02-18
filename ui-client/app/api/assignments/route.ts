/**
 * POST /api/assignments — Create assignment records.
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
    const { assessmentId, assessmentTitle, students } = body;

    if (!assessmentId || !students || !Array.isArray(students)) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 },
      );
    }

    const contextId = session.context.id;
    const platformId = session.platformId; // Now string
    const lineItemUrl = session.ags?.lineitem || session.ags?.lineitems || null;

    await connectToDatabase();

    // Delete existing assignments for this assessment in this context
    await AssessmentAssignment.deleteMany({ assessmentId, contextId });

    // Bulk insert new assignments
    if (students.length > 0) {
      const docs = students.map((student: any) => ({
        assessmentId,
        assessmentTitle: assessmentTitle || null,
        studentId: student.user_id,
        studentName: student.name || null,
        studentEmail: student.email || null,
        contextId,
        platformId,
        lineItemUrl,
      }));

      await AssessmentAssignment.insertMany(docs);
    }

    return NextResponse.json({
      success: true,
      count: students.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to create assignments", details: err.message },
      { status: 500 },
    );
  }
}
