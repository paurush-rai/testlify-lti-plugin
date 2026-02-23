/**
 * GET /api/assessments — Proxy to Testlify API.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { getTestlifyToken } from "@/lib/lti/platform-store";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const session = verifySessionToken(token);

    const testlifyToken = await getTestlifyToken(session.platformId);
    if (!testlifyToken) {
      return NextResponse.json(
        { error: "Testlify token not configured for this platform", code: "TOKEN_MISSING" },
        { status: 422 },
      );
    }

    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group");

    const apiUrl = new URL("https://api.testlify.com/v1/assessment");
    apiUrl.searchParams.set("limit", "50");
    apiUrl.searchParams.set("skip", "0");
    apiUrl.searchParams.set("colName", "created");
    apiUrl.searchParams.set("inOrder", "desc");
    apiUrl.searchParams.set("isArchived", "false");
    apiUrl.searchParams.set("isEditable", "false");
    apiUrl.searchParams.set("isActive", "false");
    apiUrl.searchParams.set("isDraft", "false");
    if (group) {
      apiUrl.searchParams.set("groupName", group);
    }

    const response = await fetch(apiUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${testlifyToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Testlify token is invalid or expired", code: "TOKEN_INVALID" },
          { status: 422 },
        );
      }
      throw new Error(`Testlify API responded with ${response.status}: ${response.statusText}`);
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
