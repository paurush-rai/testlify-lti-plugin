/**
 * Assignment & Grade Services (AGS) — line items and score submission.
 *
 * All LMS URLs (lineitems, lineitem, scores, results) come from the LTI
 * id_token and may use the LMS public hostname. In Docker dev environments
 * they are rewritten via DEV_LTI_REWRITES so the Next.js server can reach
 * the LMS container.
 */

import { getAccessToken } from "./oauth";
import { buildLmsFetchOptions } from "./url-rewrite";
import type { LineItem, Score } from "./types";

const AGS_SCOPES = [
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  "https://purl.imsglobal.org/spec/lti-ags/scope/score",
];

const SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";

const LINEITEM_CONTAINER_TYPE =
  "application/vnd.ims.lis.v2.lineitemcontainer+json";
const LINEITEM_TYPE = "application/vnd.ims.lis.v2.lineitem+json";
const SCORE_TYPE = "application/vnd.ims.lis.v1.score+json";
const RESULT_CONTAINER_TYPE = "application/vnd.ims.lis.v2.resultcontainer+json";

/**
 * Get an access token with AGS scopes, with fallback to score-only scope.
 */
async function getAgsToken(platformId: string): Promise<string> {
  try {
    return await getAccessToken(platformId, AGS_SCOPES);
  } catch {
    return await getAccessToken(platformId, [SCORE_SCOPE]);
  }
}

/**
 * Fetch line items from a lineitems URL, optionally filtered by tag.
 */
export async function getLineItems(
  platformId: string,
  lineitemsUrl: string,
  tag?: string,
): Promise<LineItem[]> {
  const accessToken = await getAgsToken(platformId);

  let url = lineitemsUrl;
  if (tag) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}tag=${encodeURIComponent(tag)}`;
  }

  const { fetchUrl, fetchInit } = buildLmsFetchOptions(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: LINEITEM_CONTAINER_TYPE,
    },
  });

  const res = await fetch(fetchUrl, fetchInit);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Get line items failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.lineItems || [];
}

/**
 * Create a new line item.
 */
export async function createLineItem(
  platformId: string,
  lineitemsUrl: string,
  lineItem: Omit<LineItem, "id">,
): Promise<LineItem> {
  const accessToken = await getAgsToken(platformId);

  const cleanUrl = lineitemsUrl.split("?")[0];

  const { fetchUrl, fetchInit } = buildLmsFetchOptions(cleanUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": LINEITEM_TYPE,
    },
    body: JSON.stringify(lineItem),
  });

  const res = await fetch(fetchUrl, fetchInit);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Create line item failed (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Fetch scores/results for a specific line item.
 */
export async function getScores(
  platformId: string,
  lineItemId: string,
): Promise<any[]> {
  const accessToken = await getAgsToken(platformId);

  let resultsUrl: string;
  if (lineItemId.includes("?")) {
    const [urlPart, queryPart] = lineItemId.split("?");
    resultsUrl = `${urlPart}/results?${queryPart}`;
  } else {
    resultsUrl = `${lineItemId}/results`;
  }

  const { fetchUrl, fetchInit } = buildLmsFetchOptions(resultsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: RESULT_CONTAINER_TYPE,
    },
  });

  const res = await fetch(fetchUrl, fetchInit);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Get scores failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

/**
 * Submit a score for a specific line item.
 */
export async function submitScore(
  platformId: string,
  lineItemId: string,
  score: Score,
): Promise<void> {
  const accessToken = await getAgsToken(platformId);

  let scoreUrl: string;
  if (lineItemId.includes("?")) {
    const [urlPart, queryPart] = lineItemId.split("?");
    scoreUrl = `${urlPart}/scores?${queryPart}`;
  } else {
    scoreUrl = `${lineItemId}/scores`;
  }

  const { fetchUrl, fetchInit } = buildLmsFetchOptions(scoreUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": SCORE_TYPE,
    },
    body: JSON.stringify(score),
  });

  const res = await fetch(fetchUrl, fetchInit);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Score submission failed (${res.status}): ${errText}`);
  }
}

/**
 * Find or create a line item by tag, then submit a score.
 * Used by the webhook handler.
 */
export async function findOrCreateLineItemAndSubmitScore(
  platformId: string,
  lineitemsUrl: string,
  assessmentId: string,
  assessmentTitle: string,
  studentId: string,
  score: number,
  maxScore: number,
): Promise<void> {
  let lineItems: LineItem[] = [];
  try {
    lineItems = await getLineItems(platformId, lineitemsUrl, assessmentId);
  } catch {
    try {
      const cleanUrl = lineitemsUrl.split("?")[0];
      lineItems = await getLineItems(platformId, cleanUrl);
    } catch {
      // ignore — we'll create one
    }
  }

  let lineItemId: string | null = lineItems.length > 0 ? lineItems[0].id : null;

  if (!lineItemId) {
    const newItem = await createLineItem(platformId, lineitemsUrl, {
      scoreMaximum: maxScore,
      label: assessmentTitle || "Assessment Score",
      tag: assessmentId,
      resourceId: assessmentId,
    });
    lineItemId = newItem.id;
  }

  await submitScore(platformId, lineItemId, {
    userId: studentId,
    scoreGiven: score,
    scoreMaximum: maxScore,
    comment: "Graded via Testlify",
    timestamp: new Date().toISOString(),
    activityProgress: "Completed",
    gradingProgress: "FullyGraded",
  });
}
