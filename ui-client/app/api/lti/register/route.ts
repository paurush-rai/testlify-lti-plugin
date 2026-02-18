/**
 * Dynamic Registration — register tool with LMS, store platform.
 * GET /api/lti/register?openid_configuration=...&registration_token=...
 *
 * Flow:
 * 1. Fetch OpenID config from the LMS
 * 2. POST tool registration to the registration endpoint
 * 3. Store platform in DB
 * 4. Return HTML that closes the registration window via postMessage
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertPlatform } from "@/lib/lti/platform-store";
import type { OpenIdConfig, ToolRegistration, RegistrationResponse } from "@/lib/lti/types";

export async function GET(request: NextRequest) {
  try {
    const openidConfigUrl = request.nextUrl.searchParams.get("openid_configuration");
    const registrationToken = request.nextUrl.searchParams.get("registration_token");

    if (!openidConfigUrl) {
      return NextResponse.json(
        { error: "Missing openid_configuration parameter" },
        { status: 400 },
      );
    }

    // TOOL_URL = URL reachable by Moodle Docker (server-to-server, e.g. host.docker.internal)
    // UI_URL   = URL reachable by the browser (e.g. localhost:3000)
    const toolUrl = process.env.TOOL_URL || process.env.SERVER_URL || "http://localhost:3000";
    const uiUrl = process.env.UI_URL || process.env.SERVER_URL || "http://localhost:3000";
    const uiDomain = new URL(uiUrl).host;

    // 1. Fetch OpenID configuration from the LMS
    const configRes = await fetch(openidConfigUrl);
    if (!configRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch OpenID config: ${configRes.status}` },
        { status: 502 },
      );
    }
    const config: OpenIdConfig = await configRes.json();

    // 2. Build tool registration payload
    // Browser-facing URLs use uiUrl (localhost); server-to-server uses toolUrl (host.docker.internal)
    const registration: ToolRegistration = {
      application_type: "web",
      response_types: ["id_token"],
      grant_types: ["implicit", "client_credentials"],
      initiate_login_uri: `${uiUrl}/api/lti/login`,
      redirect_uris: [`${uiUrl}/api/lti/launch`],
      client_name: "Testlify",
      jwks_uri: `${toolUrl}/api/lti/keys`,
      logo_uri:
        "https://testlify.com/wp-content/uploads/2022/11/Testlify-Logo-Main_1-1-1-1.svg",
      token_endpoint_auth_method: "private_key_jwt",
      scope: "openid https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
      "https://purl.imsglobal.org/spec/lti-tool-configuration": {
        domain: uiDomain,
        description:
          "Testlify LTI Plugin to manage assessments created on testlify platform",
        target_link_uri: `${uiUrl}/api/lti/launch`,
        claims: ["iss", "sub", "name", "email", "given_name", "family_name"],
        messages: [
          {
            type: "LtiResourceLinkRequest",
            target_link_uri: `${uiUrl}/api/lti/launch`,
            label: "Testlify",
          },
        ],
      },
    };

    // 3. POST registration to the platform
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (registrationToken) {
      headers["Authorization"] = `Bearer ${registrationToken}`;
    }

    const regRes = await fetch(config.registration_endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(registration),
    });

    if (!regRes.ok) {
      const errText = await regRes.text();
      return NextResponse.json(
        { error: `Registration failed: ${regRes.status} - ${errText}` },
        { status: regRes.status },
      );
    }

    const regData: RegistrationResponse = await regRes.json();

    // 4. Store the platform in the database
    const deploymentId =
      regData["https://purl.imsglobal.org/spec/lti-tool-configuration"]
        ?.deployment_id || null;

    await upsertPlatform({
      issuer: config.issuer,
      client_id: regData.client_id,
      deployment_id: deploymentId,
      auth_login_url: config.authorization_endpoint,
      auth_token_url: config.token_endpoint,
      keyset_url: config.jwks_uri,
    });

    // 5. Return HTML that closes the registration window/iframe
    // Moodle listens for postMessage({subject:'org.imsglobal.lti.close'}) on the
    // parent window. It then removes the iframe and reloads the tool list to show
    // the newly registered tool card.
    const html = `<!DOCTYPE html>
<html>
<head><title>Registration Complete</title></head>
<body>
<p>Registration complete. Closing...</p>
<script>
(function() {
  // Try every target — parent (iframe), opener (popup), top (nested iframe)
  var targets = [window.parent, window.opener, window.top];
  var msg = {subject: 'org.imsglobal.lti.close'};
  for (var i = 0; i < targets.length; i++) {
    try {
      if (targets[i] && targets[i] !== window) {
        targets[i].postMessage(msg, '*');
      }
    } catch(e) {}
  }
  // Fallback: try to close the window after a short delay
  setTimeout(function() { window.close(); }, 1000);
})();
</script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors *;",
        "X-Frame-Options": "ALLOWALL",
      },
    });
  } catch (err: any) {
    console.error("Dynamic Registration error:", err);
    return NextResponse.json(
      { error: `Registration failed: ${err.message}` },
      { status: 500 },
    );
  }
}
