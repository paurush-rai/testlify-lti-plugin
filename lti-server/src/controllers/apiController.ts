import { Request, Response } from "express";
import AssessmentAssignment from "../models/AssessmentAssignment";

interface Student {
  user_id: string;
  name: string;
  email: string;
  roles?: string[];
}

interface AssignmentRequest {
  assessmentId: string;
  assessmentTitle: string;
  students: Student[];
}

interface InviteRequest {
  assessmentId: string;
}

// Get user info
export const getMe = (req: Request, res: Response): Response => {
  if (!(res.locals as any).token) {
    console.log("❌ /api/me Unauthorized. Cookies:", req.headers.cookie);
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({
    name: (res.locals as any).token.userInfo.name,
    email: (res.locals as any).token.userInfo.email,
    roles: (res.locals as any).token.platformContext.roles,
    context: res.locals.context,
  });
};

// Get assessments from Testlify
export const getAssessments = async (
  _req: Request,
  res: Response,
): Promise<Response> => {
  if (!(res.locals as any).token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const testlifyToken = process.env.TESTLIFY_TOKEN;
    const url =
      "https://api.testlify.com/v1/assessment?limit=50&skip=0&colName=created&inOrder=desc&isArchived=false&isEditable=false&isActive=false&isDraft=false";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${testlifyToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `API responded with ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return res.json(data);
  } catch (err: any) {
    console.error("Testlify API Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch assessments", details: err.message });
  }
};

// Get course members (students)
export const getMembers =
  (lti: any) =>
  async (_req: Request, res: Response): Promise<Response> => {
    if (!(res.locals as any).token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const token = (res.locals as any).token;
      const contextId = token.platformContext.context.id;

      console.log("📋 Fetching members for context:", contextId);

      // Use LTI Names and Roles Provisioning Service to get actual members
      const members = await lti.NamesAndRoles.getMembers(token);

      console.log("✅ Found", members?.members?.length || 0, "members");

      // Filter to only include learners/students
      const students = (members?.members || []).filter((member: any) => {
        const roles = member.roles || [];
        return roles.some(
          (role: string) =>
            role.includes("Learner") ||
            role.includes("Student") ||
            role.includes(
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
            ),
        );
      });

      console.log("👥 Filtered to", students.length, "students");

      return res.json({
        members: students.map((student: any) => ({
          user_id: student.user_id,
          name: student.name,
          email: student.email,
          roles: student.roles,
        })),
        contextId,
      });
    } catch (err: any) {
      console.error("Members API Error:", err);
      return res
        .status(500)
        .json({ error: "Failed to fetch members", details: err.message });
    }
  };

// Create assignment (assign students to assessment)
export const createAssignment = async (
  req: Request<{}, {}, AssignmentRequest>,
  res: Response,
): Promise<Response> => {
  if (!(res.locals as any).token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = (res.locals as any).token;
    const contextId = token.platformContext.context.id;
    const platformId = token.platformContext.guid;

    const { assessmentId, assessmentTitle, students } = req.body;

    if (!assessmentId || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    console.log(
      `📝 Assigning ${students.length} students to assessment ${assessmentId}`,
    );

    // Delete existing assignments for this assessment in this context
    await AssessmentAssignment.destroy({
      where: {
        assessmentId,
        contextId,
      },
    });

    // Create new assignments
    const assignments = students.map((student) => ({
      assessmentId,
      assessmentTitle,
      studentId: student.user_id,
      studentName: student.name,
      studentEmail: student.email,
      contextId,
      platformId,
    }));

    await AssessmentAssignment.bulkCreate(assignments);

    console.log(`✅ Successfully assigned ${students.length} students`);

    return res.json({
      success: true,
      count: students.length,
    });
  } catch (err: any) {
    console.error("❌ Assignment Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to create assignments", details: err.message });
  }
};

// Get assigned students for an assessment
export const getAssignments = async (
  req: Request<{ assessmentId: string }>,
  res: Response,
): Promise<Response> => {
  if (!(res.locals as any).token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = (res.locals as any).token;
    const contextId = token.platformContext.context.id;
    const { assessmentId } = req.params;

    console.log(
      `📋 Fetching assignments for assessment ${assessmentId} in context ${contextId}`,
    );

    const assignments = await AssessmentAssignment.findAll({
      where: {
        assessmentId,
        contextId,
      },
      order: [["createdAt", "DESC"]],
    });

    console.log(`✅ Found ${assignments.length} assigned students`);

    const students = assignments.map((a) => ({
      user_id: a.studentId,
      name: a.studentName,
      email: a.studentEmail,
    }));

    return res.json({ students });
  } catch (err: any) {
    console.error("❌ Get Assignments Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch assignments", details: err.message });
  }
};

// Invite candidates to assessment
export const inviteCandidates = async (
  req: Request<{}, {}, InviteRequest>,
  res: Response,
): Promise<Response> => {
  if (!(res.locals as any).token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = (res.locals as any).token;
    const contextId = token.platformContext.context.id;
    const { assessmentId } = req.body;

    if (!assessmentId) {
      return res.status(400).json({ error: "Assessment ID is required" });
    }

    console.log(
      `📧 Inviting candidates for assessment ${assessmentId} in context ${contextId}`,
    );

    // Get assigned students for this assessment
    const assignments = await AssessmentAssignment.findAll({
      where: {
        assessmentId,
        contextId,
      },
    });

    if (assignments.length === 0) {
      return res.status(400).json({
        error: "No students assigned to this assessment",
      });
    }

    console.log(`📋 Found ${assignments.length} assigned students`);

    // Format candidates for Testlify API
    const candidateInvites = assignments.map((a) => ({
      firstName: a.studentName?.split(" ")[0] || "",
      lastName: a.studentName?.split(" ").slice(1).join(" ") || "",
      email: a.studentEmail,
      phoneExt: null,
      phone: null,
      candidateGroupId: null,
    }));

    // Call Testlify API
    const testlifyToken = process.env.TESTLIFY_TOKEN;
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
      console.error("❌ Testlify invite API error:", errorText);
      throw new Error(
        `Testlify API responded with ${response.status}: ${errorText}`,
      );
    }

    const result = await response.json();
    console.log(`✅ Successfully invited ${assignments.length} candidates`);

    return res.json({
      success: true,
      invitedCount: assignments.length,
      result,
    });
  } catch (err: any) {
    console.error("❌ Invite Candidates Error:", err);
    return res.status(500).json({
      error: "Failed to invite candidates",
      details: err.message,
    });
  }
};
