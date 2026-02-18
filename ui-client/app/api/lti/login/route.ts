/**
 * OIDC Login Initiation — redirect to LMS auth endpoint.
 * GET/POST /api/lti/login
 *
 * The LMS sends: iss, login_hint, target_link_uri, client_id, lti_message_hint
 * We look up the platform, create a signed state JWT, and redirect.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomString } from "@/lib/lti/crypto";
import { createStateToken } from "@/lib/lti/session";
import { findPlatform } from "@/lib/lti/platform-store";

async function handleLogin(params: URLSearchParams) {
  const iss = params.get("iss");
  const loginHint = params.get("login_hint");
  const targetLinkUri = params.get("target_link_uri");
  const clientId = params.get("client_id");
  const ltiMessageHint = params.get("lti_message_hint");

  if (!iss || !loginHint) {
    return NextResponse.json(
      { error: "Missing required parameters: iss, login_hint" },
      { status: 400 },
    );
  }

  const platform = await findPlatform(iss, clientId || undefined);
  if (!platform) {
    return NextResponse.json(
      { error: `Platform not found for issuer: ${iss}` },
      { status: 404 },
    );
  }

  const nonce = randomString(32);
  const state = createStateToken(nonce, platform.id);

  // redirect_uri must match what was registered with Moodle (browser-facing URL)
  const uiUrl = process.env.UI_URL || process.env.SERVER_URL || "http://localhost:3000";
  const redirectUri = `${uiUrl}/api/lti/launch`;

  const authParams = new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    client_id: platform.client_id,
    redirect_uri: redirectUri,
    login_hint: loginHint,
    state,
    nonce,
    response_mode: "form_post",
    prompt: "none",
  });

  if (targetLinkUri) authParams.set("lti_message_hint", targetLinkUri);
  if (ltiMessageHint) authParams.set("lti_message_hint", ltiMessageHint);

  const authUrl = `${platform.auth_login_url}?${authParams.toString()}`;
  return NextResponse.redirect(authUrl, 302);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const urlSearchParams = new URLSearchParams();
  params.forEach((value, key) => urlSearchParams.set(key, value));
  return handleLogin(urlSearchParams);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = new URLSearchParams();
  formData.forEach((value, key) => params.set(key, value.toString()));
  return handleLogin(params);
}
