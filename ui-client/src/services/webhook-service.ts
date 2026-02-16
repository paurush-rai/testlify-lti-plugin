import { getLtiProvider } from "../lib/lti-provider";
import { getAssessmentAssignmentModel } from "../models/AssessmentAssignment";

interface SubmissionRequest {
  studentEmail: string;
  assessmentId: string;
  score: number;
  maxScore: number;
}

export const processScoreWebhook = async (
  body: SubmissionRequest,
  receivedSecret: string | null,
) => {
  const secret = process.env.LTI_WEBHOOK_SECRET;

  if (!secret || secret !== receivedSecret) {
    throw new Error("Unauthorized: Invalid secret");
  }

  const { studentEmail, assessmentId, score, maxScore } = body;

  if (!studentEmail || !assessmentId || score === undefined || !maxScore) {
    throw new Error("Missing required fields");
  }

  const AssessmentAssignment = await getAssessmentAssignmentModel();
  const assignments = await AssessmentAssignment.findAll({
    where: {
      studentEmail,
      assessmentId,
    },
  });

  if (assignments.length === 0) {
    throw new Error("Assignment not found");
  }

  const results = [];
  const lti = await getLtiProvider();

  for (const assignment of assignments) {
    try {
      if (!assignment.platformId || !assignment.lineItemUrl) {
        results.push({
          id: assignment.id,
          status: "skipped",
          reason: "Missing config",
        });
        continue;
      }

      const platform = await lti.getPlatformById(assignment.platformId);
      if (!platform) {
        results.push({
          id: assignment.id,
          status: "failed",
          reason: "Platform not found",
        });
        continue;
      }

      const lineItem = {
        scoreMaximum: maxScore,
        label: assignment.assessmentTitle || "Assessment Score",
        tag: assessmentId,
        resourceId: assessmentId,
      };

      let accessToken;
      let scopes = [
        "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
        "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
        "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
        "https://purl.imsglobal.org/spec/lti-ags/scope/score",
      ];

      try {
        accessToken = await platform.platformAccessToken(scopes.join(" "));
      } catch (tokenErr: any) {
        console.warn("Initial LTI token request failed:", tokenErr.message);
        try {
          const scoreScope =
            "https://purl.imsglobal.org/spec/lti-ags/scope/score";
          accessToken = await platform.platformAccessToken(scoreScope);
        } catch (retryErr: any) {
          results.push({
            id: assignment.id,
            status: "failed",
            reason: "Auth Token Failed",
            error: retryErr.message,
          });
          continue;
        }
      }

      // Extract token string if it's an object
      if (
        accessToken &&
        typeof accessToken === "object" &&
        (accessToken as any).access_token
      ) {
        accessToken = (accessToken as any).access_token;
      }

      if (!accessToken) {
        results.push({
          id: assignment.id,
          status: "failed",
          reason: "Auth failed",
        });
        continue;
      }

      let lineItemId: string | null = null;
      const queryChar = assignment.lineItemUrl.includes("?") ? "&" : "?";
      const getLineItemUrl = `${assignment.lineItemUrl}${queryChar}tag=${assessmentId}`;

      try {
        const getLiRes = await fetch(getLineItemUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json",
          },
        });

        if (getLiRes.ok) {
          const liData = await getLiRes.json();
          const items = Array.isArray(liData)
            ? liData
            : (liData as any).lineItems || [];
          if (items.length > 0) {
            lineItemId = items[0].id; // Type assertion needed?
          }
        }
      } catch (err) {}

      if (!lineItemId) {
        const createLiRes = await fetch(assignment.lineItemUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/vnd.ims.lis.v2.lineitem+json",
          },
          body: JSON.stringify(lineItem),
        });

        if (createLiRes.ok) {
          const newLineItem: any = await createLiRes.json();
          lineItemId = newLineItem.id;
        } else {
          const errText = await createLiRes.text();
          results.push({
            id: assignment.id,
            status: "error",
            error: `LineItem creation failed: ${createLiRes.status} ${errText}`,
          });
          continue;
        }
      }

      if (lineItemId) {
        const scoreUrl = lineItemId.includes("?")
          ? `${lineItemId.split("?")[0]}/scores?${lineItemId.split("?")[1]}`
          : `${lineItemId}/scores`;

        const scoreData = {
          userId: assignment.studentId,
          scoreGiven: score,
          scoreMaximum: maxScore,
          comment: "Graded via Testlify",
          timestamp: new Date().toISOString(),
          activityProgress: "Completed",
          gradingProgress: "FullyGraded",
        };

        const scoreRes = await fetch(scoreUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/vnd.ims.lis.v1.score+json",
          },
          body: JSON.stringify(scoreData),
        });

        if (scoreRes.ok) {
          results.push({ id: assignment.id, status: "success" });
        } else {
          const errText = await scoreRes.text();
          results.push({
            id: assignment.id,
            status: "error",
            error: `Score submission failed: ${scoreRes.status} ${errText}`,
          });
        }
      }
    } catch (innerErr: any) {
      results.push({
        id: assignment.id,
        status: "error",
        error: innerErr.message,
      });
    }
  }

  return { success: true, results };
};
