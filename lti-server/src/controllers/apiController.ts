import { Request, Response } from "express";
import AssessmentAssignment from "../models/AssessmentAssignment";
import AssessmentLineItem from "../models/AssessmentLineItem";

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

interface ScoreRequest {
  assessmentId: string;
  studentEmail: string;
  score: number;
  maxScore: number;
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
export const createAssignment =
  (lti: any) =>
  async (
    req: Request<{}, {}, AssignmentRequest>,
    res: Response,
  ): Promise<Response> => {
    if (!(res.locals as any).token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const token = (res.locals as any).token;
      const contextId = token.platformContext.context.id;
      const platformId = token.platformContext.guid; // Note: guid might not be iss
      const iss = token.iss;
      const clientId = token.clientId;
      const deploymentId = token.deploymentId;

      const { assessmentId, assessmentTitle, students } = req.body;

      if (!assessmentId || !students || !Array.isArray(students)) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      console.log(
        `📝 Assigning ${students.length} students to assessment ${assessmentId}`,
      );

      // 1. Ensure LineItem exists
      let lineItem = await AssessmentLineItem.findOne({
        where: { assessmentId, contextId },
      });

      if (!lineItem) {
        console.log("Creating new LineItem for assessment");
        try {
          const newLineItem = {
            scoreMaximum: 100,
            label: assessmentTitle || "Testlify Assessment",
            tag: "grade",
            resourceId: assessmentId,
          };

          const ltiLineItem = await lti.Grade.createLineItem(
            token,
            newLineItem,
          );
          console.log("✅ Created LTI LineItem:", ltiLineItem.id);

          lineItem = await AssessmentLineItem.create({
            assessmentId,
            contextId,
            lineItemId: ltiLineItem.id,
            lineItemUrl: ltiLineItem.id, // Usually ID is the URL
            iss,
            clientId,
            deploymentId,
          });
        } catch (liError: any) {
          console.error("Failed to create LineItem:", liError);
          // Continue without LineItem? No, we need it for scoring.
          // But maybe we can proceed with assignment anyway.
        }
      }

      // 2. Clear old assignments logic
      await AssessmentAssignment.destroy({
        where: {
          assessmentId,
          contextId,
        },
      });

      // 3. Create new assignments
      const assignments = students.map((student) => ({
        assessmentId,
        assessmentTitle,
        studentId: student.user_id,
        studentName: student.name,
        studentEmail: student.email,
        contextId,
        platformId, // keeping guid for reference
      }));

      await AssessmentAssignment.bulkCreate(assignments);

      console.log(`✅ Successfully assigned ${students.length} students`);

      return res.json({
        success: true,
        count: students.length,
        lineItemId: lineItem?.lineItemId,
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

// Get candidates and scores from LTI
export const getCandidates =
  (lti: any) =>
  async (
    req: Request<{ assessmentId: string }>,
    res: Response,
  ): Promise<Response> => {
    if (!(res.locals as any).token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { assessmentId } = req.params;
      const token = (res.locals as any).token;
      const contextId = token.platformContext.context.id;

      if (!assessmentId) {
        return res.status(400).json({ error: "Assessment ID is required" });
      }

      console.log(`Fetching LTI candidates for ${assessmentId}`);

      // 1. Get assigned students from DB
      const assignments = await AssessmentAssignment.findAll({
        where: { assessmentId, contextId },
      });

      // 2. Get LineItem
      const lineItem = await AssessmentLineItem.findOne({
        where: { assessmentId, contextId },
      });

      let ltiScores: any[] = [];
      if (lineItem) {
        try {
          // Fetch scores from LTI Gradebook
          const scoresResult = await lti.Grade.getScores(
            token,
            lineItem.lineItemId,
          );
          ltiScores = scoresResult.id ? [] : scoresResult; // Handle weird return, typically it's array
          if (scoresResult && Array.isArray(scoresResult.scores)) {
            ltiScores = scoresResult.scores;
          } else if (Array.isArray(scoresResult)) {
            ltiScores = scoresResult;
          }
          console.log(`Found ${ltiScores.length} scores in LTI`);
        } catch (scoreErr) {
          console.error("Failed to fetch LTI scores:", scoreErr);
        }
      }

      // 3. Merge data
      // We want to return Candidate[] format:
      // { _id, email, firstName, lastName, candidateStatus, grade, score }

      // Map DB assignments to candidates
      const candidates = assignments.map((a) => {
        // Find score for this student
        const scoreEntry = ltiScores.find((s: any) => s.userId === a.studentId);
        const hasScore = !!scoreEntry;

        // Determine status based on score existence
        // (Rough approximation: if score exists, it's completed or started)
        let status = "Invited";
        let grade = undefined;

        if (hasScore) {
          status =
            scoreEntry.activityProgress === "Completed"
              ? "Completed"
              : "Started";
          // LTI stores resultScore / resultMaximum
          // Convert to percentage or keep raw
          if (scoreEntry.resultScore != null && scoreEntry.resultMaximum > 0) {
            grade = (scoreEntry.resultScore / scoreEntry.resultMaximum) * 100;
          }
        }

        return {
          _id: a.studentId, // Use LMS ID as ID
          email: a.studentEmail || "",
          firstName: a.studentName?.split(" ")[0] || "Unknown",
          lastName: a.studentName?.split(" ").slice(1).join(" ") || "",
          candidateStatus: status,
          grade: grade ? Math.round(grade) : undefined,
          score: scoreEntry?.resultScore,
        };
      });

      return res.json({ data: candidates });
    } catch (err: any) {
      console.error("❌ Get Candidates Error:", err);
      return res
        .status(500)
        .json({ error: "Failed to fetch candidates", details: err.message });
    }
  };

// External endpoint to receive score from Testlify and push to LTI
export const submitScore =
  (lti: any) =>
  async (
    req: Request<{}, {}, ScoreRequest>,
    res: Response,
  ): Promise<Response> => {
    try {
      // 0. Verify Authorization Header
      const authHeader = req.headers["authorization"];
      const apiSecret = process.env.LTI_WEBHOOK_SECRET;

      if (!apiSecret) {
        console.error("LTI_WEBHOOK_SECRET is not configured on server.");
        return res.status(500).json({ error: "Server configuration error" });
      }

      if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
        console.warn("Unauthorized score submission attempt");
        return res
          .status(401)
          .json({ error: "Unauthorized: Invalid or missing API key" });
      }

      const { assessmentId, studentEmail, score, maxScore } = req.body;

      if (!assessmentId || !studentEmail || score === undefined) {
        return res
          .status(400)
          .json({ error: "Missing assessmentId, studentEmail, or score" });
      }

      console.log(
        `🚀 Received score submission: ${score}/${maxScore} for ${studentEmail} on ${assessmentId}`,
      );

      // 1. Find the assignment to identify the student (LMS User ID) and Context
      // We search by assessmentId and studentEmail.
      // NOTE: studentEmail must match what we stored during assignment.
      const assignment = await AssessmentAssignment.findOne({
        where: { assessmentId, studentEmail },
      });

      if (!assignment) {
        console.error("Student assignment not found for email:", studentEmail);
        return res
          .status(404)
          .json({ error: "Student not assigned to this assessment" });
      }

      const { studentId, contextId } = assignment;

      // 2. Find the LineItem
      const lineItem = await AssessmentLineItem.findOne({
        where: { assessmentId, contextId },
      });

      if (!lineItem) {
        console.error("LineItem not found for assessment:", assessmentId);
        return res
          .status(404)
          .json({ error: "LTI LineItem not found for this assessment" });
      }

      // 3. Connect to LTI Platform
      console.log(
        `Connecting to platform ${lineItem.iss} for deployment ${lineItem.deploymentId}`,
      );

      const Platform = await lti.getPlatform(
        lineItem.iss,
        lineItem.clientId,
        lineItem.deploymentId,
      );

      if (!Platform) {
        return res.status(500).json({ error: "Platform not found" });
      }

      // 4. Submit Score
      const scoreObj = {
        userId: studentId,
        scoreGiven: score,
        scoreMaximum: maxScore || 100,
        activityProgress: "Completed",
        gradingProgress: "FullyGraded",
        timestamp: new Date().toISOString(),
      };

      console.log("Submitting score to LTI:", scoreObj);

      // Only attempt to publish if we have a line item ID
      // Platform.Grade.scorePublish(lineItemId, scoreObj) ??
      // Check if ltijs Platform has utility
      // Standard way varies, but assuming we can use lti.Grade with a constructed token if Platform methods aren't direct.
      // Actually, Platform.platformAccessToken() gets the token.

      // We can use the lti.Grade service if we mock the idtoken
      const idToken = {
        iss: lineItem.iss,
        user: studentId,
        platformId: lineItem.iss, // Usually works
        clientId: lineItem.clientId,
        deploymentId: lineItem.deploymentId,
      };

      // Wait, lti.Grade.scorePublish expects the idtoken to have specific fields.
      // Trying to use Platform.scorePublish? No.
      // Just try standard Grade service.

      await lti.Grade.scorePublish(idToken, lineItem.lineItemId, scoreObj);

      console.log("✅ Score submitted successfully");

      return res.json({ success: true });
    } catch (err: any) {
      console.error("❌ Submit Score Error:", err);
      // Detailed error
      if (err.message && err.message.includes("Manage grades")) {
        return res.status(403).json({ error: "Scope permission error on LMS" });
      }
      return res
        .status(500)
        .json({ error: "Failed to submit score", details: err.message });
    }
  };
