/**
 * LTI Launch callback — verify id_token JWT, create session, redirect to /app.
 * POST /api/lti/launch
 *
 * The LMS POSTs a form with id_token and state.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  decodeJwt,
  fetchPlatformKey,
  verifyJwtWithKey,
} from "@/lib/lti/crypto";
import { verifyStateToken, createSessionToken } from "@/lib/lti/session";
import { findPlatformById } from "@/lib/lti/platform-store";
import type {
  SessionPayload,
  AgsEndpoint,
  NrpsEndpoint,
} from "@/lib/lti/types";

// LTI 1.3 claim URIs
const CLAIMS = {
  MESSAGE_TYPE: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  ROLES: "https://purl.imsglobal.org/spec/lti/claim/roles",
  CONTEXT: "https://purl.imsglobal.org/spec/lti/claim/context",
  RESOURCE_LINK: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  DEPLOYMENT_ID: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  TARGET_LINK_URI: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
  AGS: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
  NRPS: "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const idToken = formData.get("id_token") as string | null;
    const state = formData.get("state") as string | null;

    if (!idToken || !state) {
      return NextResponse.json(
        { error: "Missing id_token or state" },
        { status: 400 },
      );
    }

    // 1. Verify state JWT (our own signature) — extract nonce and platformId
    let statePayload;
    try {
      statePayload = verifyStateToken(state);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Invalid state: ${err.message}` },
        { status: 400 },
      );
    }

    // 2. Look up the platform
    const platform = await findPlatformById(statePayload.platformId);
    if (!platform) {
      return NextResponse.json(
        { error: "Platform not found" },
        { status: 404 },
      );
    }

    // 3. Decode id_token header to get kid
    const { header, payload: unverifiedPayload } = decodeJwt(idToken);
    const kid = header.kid;
    if (!kid) {
      return NextResponse.json(
        { error: "id_token missing kid in header" },
        { status: 400 },
      );
    }

    // 4. Fetch platform's JWKS and find the key
    const platformPubKey = await fetchPlatformKey(platform.keyset_url, kid);

    // 5. Verify id_token signature
    const claims = verifyJwtWithKey<Record<string, any>>(
      idToken,
      platformPubKey,
    );

    // 6. Validate standard claims
    if (claims.iss !== platform.issuer) {
      return NextResponse.json(
        {
          error: `Issuer mismatch: expected ${platform.issuer}, got ${claims.iss}`,
        },
        { status: 400 },
      );
    }

    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(platform.client_id)) {
      return NextResponse.json({ error: "Audience mismatch" }, { status: 400 });
    }

    if (claims.nonce !== statePayload.nonce) {
      return NextResponse.json({ error: "Nonce mismatch" }, { status: 400 });
    }

    // 7. Extract LTI claims
    const context = claims[CLAIMS.CONTEXT] || {
      id: "unknown",
      title: "Unknown",
    };
    const roles: string[] = claims[CLAIMS.ROLES] || [];
    const deploymentId = claims[CLAIMS.DEPLOYMENT_ID];

    // AGS endpoint
    let ags: AgsEndpoint | undefined;
    const agsData = claims[CLAIMS.AGS];
    if (agsData) {
      ags = {
        lineitems: agsData.lineitems || agsData.lineitem,
        lineitem: agsData.lineitem,
        scope: agsData.scope || [],
      };
    }

    // NRPS endpoint
    let nrps: NrpsEndpoint | undefined;
    const nrpsData = claims[CLAIMS.NRPS];
    if (nrpsData) {
      nrps = {
        context_memberships_url: nrpsData.context_memberships_url,
        service_versions: nrpsData.service_versions || ["2.0"],
      };
    }

    // 8. Create session JWT with all claims
    const sessionPayload: Omit<SessionPayload, "iat" | "exp"> = {
      sub: claims.sub,
      name: claims.name || claims.given_name || "Unknown",
      email: claims.email || "",
      roles,
      context: {
        id: context.id,
        title: context.title || context.label,
        label: context.label,
        type: context.type,
      },
      issuer: platform.issuer,
      clientId: platform.client_id,
      deploymentId,
      platformId: platform.id,
      ags,
      nrps,
    };

    const ltik = createSessionToken(sessionPayload);

    // 9. Redirect to /dashboard with the session token
    // UI_URL is the browser-facing URL (localhost), not TOOL_URL (host.docker.internal)
    const uiUrl =
      process.env.UI_URL || process.env.SERVER_URL || "http://localhost:3000";
    return NextResponse.redirect(`${uiUrl}/dashboard?ltik=${ltik}`, 302);
  } catch (err: any) {
    console.error("LTI Launch error:", err);
    return NextResponse.json(
      { error: `Launch failed: ${err.message}` },
      { status: 500 },
    );
  }
}
