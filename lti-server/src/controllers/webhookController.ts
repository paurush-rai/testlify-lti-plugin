import { Request, Response } from "express";
import { Provider } from "ltijs"; // We use the singleton instance, but referencing type or importing if needed.
import AssessmentAssignment from "../models/AssessmentAssignment";

const lti = Provider as any;

interface SubmissionRequest {
  studentEmail: string;
  assessmentId: string;
  score: number;
  maxScore: number;
}

export const submitScore = async (
  req: Request<{}, {}, SubmissionRequest>,
  res: Response,
): Promise<Response> => {
  try {
    const secret = process.env.LTI_WEBHOOK_SECRET;
    const providedSecret = req.headers["x-webhook-secret"];

    if (!secret || secret !== providedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { studentEmail, assessmentId, score, maxScore } = req.body;

    if (!studentEmail || !assessmentId || score === undefined || !maxScore) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const assignments = await AssessmentAssignment.findAll({
      where: {
        studentEmail,
        assessmentId,
      },
    });

    if (assignments.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const results = [];

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
          console.log("Access Token:", accessToken);
        } catch (tokenErr: any) {
          console.warn(
            "Initial LTI token request failed (likely missing scopes):",
            tokenErr.message,
          );
          try {
            const scoreScope =
              "https://purl.imsglobal.org/spec/lti-ags/scope/score";
            accessToken = await platform.platformAccessToken(scoreScope);
            console.log("Access Token (Score Scope):", accessToken);
          } catch (retryErr: any) {
            console.log("Access Token (Score Scope):", accessToken);
            results.push({
              id: assignment.id,
              status: "failed",
              reason: "Auth Token Failed",
              error: retryErr.message,
            });
            continue;
          }
        }

        // Extract token string if it's an object (ltijs v5+ often returns object)
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
        console.log("Line Item URL:", assignment.lineItemUrl);
        console.log("Query Char:", queryChar);
        const getLineItemUrl = `${assignment.lineItemUrl}${queryChar}tag=${assessmentId}`;
        console.log("Get Line Item URL:", getLineItemUrl);

        const getLiRes = await fetch(getLineItemUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json",
          },
        });
        console.log("Get Line Item Response:", getLiRes);

        if (getLiRes.ok) {
          const liData = await getLiRes.json();
          const items = Array.isArray(liData)
            ? liData
            : (liData as any).lineItems || [];

          if (items.length > 0) {
            lineItemId = items[0].id;
          }
        }

        if (!lineItemId) {
          const cleanUrl = assignment.lineItemUrl.split("?")[0];

          try {
            const getAllRes = await fetch(cleanUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.ims.lis.v2.lineitemcontainer+json",
                "Content-Type":
                  "application/vnd.ims.lis.v2.lineitemcontainer+json",
              },
            });

            if (getAllRes.ok) {
              const allData = await getAllRes.json();
              const allItems = Array.isArray(allData)
                ? allData
                : (allData as any).lineItems || [];
              if (allItems.length > 0) {
                lineItemId = allItems[0].id;
              }
            }
          } catch (fbErr) {}
        }

        if (!lineItemId) {
          const createLiRes = await fetch(assignment.lineItemUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/vnd.ims.lis.v2.lineitem+json",
            },
            body: JSON.stringify(lineItem),
          });

          if (!createLiRes.ok) {
            const errText = await createLiRes.text();
            results.push({
              id: assignment.id,
              status: "error",
              error: `LineItem creation failed: ${createLiRes.status} - ${errText}`,
            });
            continue;
          }

          const newLineItem = (await createLiRes.json()) as any;
          lineItemId = newLineItem.id;
        }

        if (lineItemId) {
          let scoreUrl = lineItemId;
          if (lineItemId.includes("?")) {
            const [urlPart, queryPart] = lineItemId.split("?");
            scoreUrl = `${urlPart}/scores?${queryPart}`;
          } else {
            scoreUrl = `${lineItemId}/scores`;
          }
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

          if (!scoreRes.ok) {
            const errText = await scoreRes.text();
            results.push({
              id: assignment.id,
              status: "error",
              error: `Score submission failed: ${scoreRes.status} - ${errText}`,
            });
          } else {
            results.push({ id: assignment.id, status: "success" });
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

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
};
