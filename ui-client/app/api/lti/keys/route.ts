/**
 * JWKS endpoint — serves the tool's public key.
 * GET /api/lti/keys
 */

import { NextResponse } from "next/server";
import { publicKeyToJwk } from "@/lib/lti/crypto";

export async function GET() {
  const jwk = publicKeyToJwk();
  return NextResponse.json({ keys: [jwk] }, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
