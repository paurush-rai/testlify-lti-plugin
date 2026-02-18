/**
 * GET /api/assessments — Proxy to Testlify API.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    verifySessionToken(token); // validates session

    const testlifyToken = process.env.TESTLIFY_TOKEN;
    if (!testlifyToken) {
      return NextResponse.json(
        { error: "TESTLIFY_TOKEN not configured" },
        { status: 500 },
      );
    }

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
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch assessments", details: err.message },
      { status: 500 },
    );
  }
}
