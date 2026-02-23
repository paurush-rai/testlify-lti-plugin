/**
 * GET /api/groups — Proxy to Testlify assessment group API.
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
    verifySessionToken(token);

    const testlifyToken = process.env.TESTLIFY_TOKEN;
    if (!testlifyToken) {
      return NextResponse.json(
        { error: "TESTLIFY_TOKEN not configured" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") ?? "";
    const skip = searchParams.get("skip") ?? "0";
    const limit = searchParams.get("limit") ?? "50";
    const inOrder = searchParams.get("inOrder") ?? "asc";

    const url = new URL(
      "https://api.testlify.com/v1/workspace/assessment/group",
    );
    url.searchParams.set("query", query);
    url.searchParams.set("skip", skip);
    url.searchParams.set("limit", limit);
    url.searchParams.set("inOrder", inOrder);

    const response = await fetch(url.toString(), {
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
    return NextResponse.json(data.groupList);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch groups", details: err.message },
      { status: 500 },
    );
  }
}
