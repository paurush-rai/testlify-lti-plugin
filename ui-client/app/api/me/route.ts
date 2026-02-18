/**
 * GET /api/me — Return user info from session JWT.
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
    const session = verifySessionToken(token);

    return NextResponse.json({
      name: session.name,
      email: session.email,
      roles: session.roles,
      context: {
        context: {
          id: session.context.id,
          title: session.context.title,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unauthorized", details: err.message },
      { status: 401 },
    );
  }
}
