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

// Receive score from Testlify and post to LMS
export const submitScore = async (
  req: Request<{}, {}, SubmissionRequest>,
  res: Response,
): Promise<Response> => {
  try {
    // 1. Verify Secret
    const secret = process.env.LTI_WEBHOOK_SECRET;
    const providedSecret = req.headers["x-webhook-secret"];

    if (!secret || secret !== providedSecret) {
      console.log("❌ Unauthorized webhook attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { studentEmail, assessmentId, score, maxScore } = req.body;

    if (!studentEmail || !assessmentId || score === undefined || !maxScore) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(
      `📥 Received score submission: ${studentEmail} - ${assessmentId} - ${score}/${maxScore}`,
    );

    // 2. Find Assignment(s)
    // We search by email and assessmentId. One student could be in multiple courses (contexts),
    // so we might find multiple assignments. We should update all of them.
    const assignments = await AssessmentAssignment.findAll({
      where: {
        studentEmail,
        assessmentId,
      },
    });

    if (assignments.length === 0) {
      console.log("⚠️ No assignment found for this student/assessment.");
      return res.status(404).json({ error: "Assignment not found" });
    }

    const results = [];

    // 3. Process each assignment (usually just one, but handling multiples for robustness)
    for (const assignment of assignments) {
      try {
        if (!assignment.platformId || !assignment.lineItemUrl) {
          console.log(
            `⚠️ Missing platformId or lineItemUrl for assignment ${assignment.id}. Skipping.`,
          );
          results.push({
            id: assignment.id,
            status: "skipped",
            reason: "Missing config",
          });
          continue;
        }

        // Get Platform Instance
        // We use getPlatformById because we stored the internal platformId (hash)
        const platform = await lti.getPlatformById(assignment.platformId);
        if (!platform) {
          console.log(`⚠️ Platform ${assignment.platformId} not found`);
          results.push({
            id: assignment.id,
            status: "failed",
            reason: "Platform not found",
          });
          continue;
        }

        // Construct Line Item Object
        // We use the assessmentId as the 'tag' to find/create the specific column
        const lineItem = {
          scoreMaximum: maxScore,
          label: assignment.assessmentTitle || "Assessment Score",
          tag: assessmentId,
          resourceId: assessmentId,
        };

        // Get Access Token for AGS
        // Scopes: LineItem and Score
        // Note: ltijs 'platform.platformAccessToken' returns a token string.
        let accessToken;
        let scopes = [
          "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
          "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
          "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
          "https://purl.imsglobal.org/spec/lti-ags/scope/score",
        ];

        try {
          // Attempt 1: Full Scopes
          accessToken = await platform.platformAccessToken(scopes.join(" "));
        } catch (tokenErr: any) {
          console.log(
            "⚠️ Failed to get full scopes. Retrying with Score-only scope...",
          );
          // Attempt 2: Score Only
          try {
            // Pass as single string
            const scoreScope =
              "https://purl.imsglobal.org/spec/lti-ags/scope/score";
            accessToken = await platform.platformAccessToken(scoreScope);
            console.log(
              "⚠️ Acquired reduced permission token (Score only). LineItem creation main fail.",
            );
          } catch (retryErr: any) {
            console.error(
              `❌ Failed to get access token (Retry): ${retryErr.message}`,
            );
            if (retryErr.response) {
              console.error(
                `Response body: ${JSON.stringify(retryErr.response.body)}`,
              );
            }
            results.push({
              id: assignment.id,
              status: "failed",
              reason: "Auth Token Failed",
              error: retryErr.message,
            });
            continue;
          }
        }

        if (!accessToken) {
          console.log(
            `⚠️ Failed to get access token for platform ${assignment.platformId}`,
          );
          results.push({
            id: assignment.id,
            status: "failed",
            reason: "Auth failed",
          });
          continue;
        }

        // 4. Find or Create Line Item

        let lineItemId: string | null = null;

        // Verify if `lineItemUrl` already has query params
        const queryChar = assignment.lineItemUrl.includes("?") ? "&" : "?";
        const getLineItemUrl = `${assignment.lineItemUrl}${queryChar}tag=${assessmentId}`;

        console.log(`🔎 Searching Line Item at: ${getLineItemUrl}`);

        const getLiRes = await fetch(getLineItemUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (getLiRes.ok) {
          const liData = await getLiRes.json();
          // LTI 1.3 standard: response is array of line items (or paginated object, but usually array)
          const items = Array.isArray(liData)
            ? liData
            : (liData as any).lineItems || []; // Handle some LMS variations

          if (items.length > 0) {
            lineItemId = items[0].id;
            console.log(`✅ Found existing Line Item: ${lineItemId}`);
          }
        }

        // Fallback: Fetch ALL items if tag search didn't yield a result
        if (!lineItemId) {
          console.log(
            "⚠️ No tagged item found (or search failed). Fetching all items (Fallback)...",
          );
          // Check if url contains '?'
          // Try stripping query parameters completely for the fallback
          const cleanUrl = assignment.lineItemUrl.split("?")[0];
          console.log(`🔎 Fallback Search at Clean URL: ${cleanUrl}`);

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
                console.log(
                  `✅ Found default Line Item (First available): ${lineItemId}`,
                );
              }
            } else {
              console.log(`⚠️ Fallback fetch failed: ${getAllRes.status}`);
            }
          } catch (fbErr) {
            console.log("⚠️ Fallback fetch error:", fbErr);
          }
        }

        // Create if not found AND we didn't find a fallback
        if (!lineItemId) {
          console.log("➕ Creating new Line Item...");
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
            console.error(
              `❌ Failed to create Line Item (${createLiRes.status}):`,
              errText,
            );
            results.push({
              id: assignment.id,
              status: "error",
              error: `LineItem creation failed: ${createLiRes.status} - ${errText}`,
            });
            continue;
          }

          const newLineItem = (await createLiRes.json()) as any;
          lineItemId = newLineItem.id;
          console.log(`✅ Created Line Item: ${lineItemId}`);
        }

        // 5. Publish Score (Normal Flow)
        if (lineItemId) {
          const scoreUrl = `${lineItemId}/scores`;
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
            console.error(
              `❌ Failed to submit score (${scoreRes.status} ${scoreUrl}):`,
              errText,
            );
            results.push({
              id: assignment.id,
              status: "error",
              error: `Score submission failed: ${scoreRes.status} - ${errText}`,
            });
          } else {
            console.log(
              `✅ Score submitted for student ${assignment.studentId}`,
            );
            results.push({ id: assignment.id, status: "success" });
          }
        }
      } catch (innerErr: any) {
        console.error(
          `❌ Error processing assignment ${assignment.id}:`,
          innerErr,
        );
        results.push({
          id: assignment.id,
          status: "error",
          error: innerErr.message,
        });
      }
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error("❌ Webhook Error:", err);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
};
