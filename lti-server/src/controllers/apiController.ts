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

export const getMe = (_req: Request, res: Response): Response => {
  if (!(res.locals as any).token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.json({
    name: (res.locals as any).token.userInfo.name,
    email: (res.locals as any).token.userInfo.email,
    roles: (res.locals as any).token.platformContext.roles,
    context: res.locals.context,
  });
};

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
    return res
      .status(500)
      .json({ error: "Failed to fetch assessments", details: err.message });
  }
};

export const getMembers =
  (lti: any) =>
  async (_req: Request, res: Response): Promise<Response> => {
    if (!(res.locals as any).token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const token = (res.locals as any).token;
      const contextId = token.platformContext.context.id;

      const members = await lti.NamesAndRoles.getMembers(token);

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
      return res
        .status(500)
        .json({ error: "Failed to fetch members", details: err.message });
    }
  };

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
    const platformId = token.platformId;

    const lineItemUrl =
      token.platformContext.endpoint?.lineitem ||
      token.platformContext.endpoint?.lineitems ||
      null;

    const { assessmentId, assessmentTitle, students } = req.body;

    if (!assessmentId || !students || !Array.isArray(students)) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    await AssessmentAssignment.destroy({
      where: {
        assessmentId,
        contextId,
      },
    });

    const assignments = students.map((student) => ({
      assessmentId,
      assessmentTitle,
      studentId: student.user_id,
      studentName: student.name,
      studentEmail: student.email,
      contextId,
      platformId,
      lineItemUrl,
    }));

    await AssessmentAssignment.bulkCreate(assignments);

    return res.json({
      success: true,
      count: students.length,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to create assignments", details: err.message });
  }
};

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

    const assignments = await AssessmentAssignment.findAll({
      where: {
        assessmentId,
        contextId,
      },
      order: [["createdAt", "DESC"]],
    });

    const students = assignments.map((a) => ({
      user_id: a.studentId,
      name: a.studentName,
      email: a.studentEmail,
    }));

    return res.json({ students });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch assignments", details: err.message });
  }
};

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

    const candidateInvites = assignments.map((a) => ({
      firstName: a.studentName?.split(" ")[0] || "",
      lastName: a.studentName?.split(" ").slice(1).join(" ") || "",
      email: a.studentEmail,
      phoneExt: null,
      phone: null,
      candidateGroupId: null,
    }));

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
      throw new Error(
        `Testlify API responded with ${response.status}: ${errorText}`,
      );
    }

    const result = await response.json();

    return res.json({
      success: true,
      invitedCount: assignments.length,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to invite candidates",
      details: err.message,
    });
  }
};

export const getScores =
  (lti: any) =>
  async (
    req: Request<{ assessmentId: string }>,
    res: Response,
  ): Promise<Response> => {
    if (!(res.locals as any).token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const token = (res.locals as any).token;
      const { assessmentId } = req.params;

      const lineItemsResponse = await lti.Grade.getLineItems(token, {
        tag: assessmentId,
      });

      const lineItems = lineItemsResponse.lineItems || [];

      if (lineItems.length === 0) {
        return res.json({ scores: [] });
      }

      const lineItemId = lineItems[0].id;

      const scoresResponse = await lti.Grade.getScores(token, lineItemId);

      return res.json({ scores: scoresResponse.scores || [] });
    } catch (err: any) {
      return res.json({ scores: [], error: err.message });
    }
  };
