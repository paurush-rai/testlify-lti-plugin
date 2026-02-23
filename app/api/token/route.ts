/**
 * GET  /api/token  — Check whether a Testlify token is configured for this platform.
 * POST /api/token  — Save the Testlify token for this platform (instructors only).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/lti/session";
import { findPlatformById, updatePlatformToken, getTestlifyToken } from "@/lib/lti/platform-store";

const INSTRUCTOR_ROLES = [
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
  "http://purl.imsglobal.org/vocab/lis/v2/system/person#Administrator",
];

function isInstructor(roles: string[]): boolean {
  return roles.some((r) => INSTRUCTOR_ROLES.some((ir) => r.includes(ir.split("#")[1])));
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = verifySessionToken(auth.slice(7));
    const token = await getTestlifyToken(session.platformId);

    return NextResponse.json({ configured: Boolean(token) });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to check token", details: err.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = verifySessionToken(auth.slice(7));

    if (!isInstructor(session.roles)) {
      return NextResponse.json(
        { error: "Only instructors can configure the Testlify token" },
        { status: 403 },
      );
    }

    const { token } = await request.json();
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const platform = await findPlatformById(session.platformId);
    if (!platform) {
      return NextResponse.json({ error: "Platform not found" }, { status: 404 });
    }

    // Validate the token against Testlify before persisting it
    const validationRes = await fetch(
      "https://api.testlify.com/v1/workspace/assessment/group?limit=1",
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/json",
        },
      },
    );
    if (!validationRes.ok) {
      return NextResponse.json(
        { error: "Token rejected by Testlify — please check your API token and try again." },
        { status: 400 },
      );
    }

    const saved = await updatePlatformToken(session.platformId, token.trim());
    if (!saved) {
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to save token", details: err.message },
      { status: 500 },
    );
  }
}
