/**
 * LTI 1.3 Dynamic Registration
 * GET /api/lti/register?openid_configuration=<url>[&registration_token=<token>]
 *
 * IMS Global LTI 1.3 Dynamic Registration spec:
 * https://www.imsglobal.org/spec/lti-dr/v1p0
 *
 * Flow:
 * 1. LMS opens this URL in a browser iframe/popup
 * 2. We (server-side) fetch the OpenID configuration from the LMS
 * 3. We POST our tool registration to the LMS registration_endpoint
 * 4. We store the resulting platform credentials in MongoDB
 * 5. We return an HTML page that sends postMessage to close the LMS iframe
 *
 * Environment variables:
 *   NEXT_PUBLIC_APP_URL  – Public/browser-facing URL of this tool (preferred)
 *   UI_URL               – Alias for NEXT_PUBLIC_APP_URL (legacy)
 *   SERVER_URL           – Fallback URL
 *   TOOL_URL             – URL reachable by the LMS server (may differ in Docker dev)
 *   DEV_LTI_REWRITES     – (dev only) "origin1,target1;origin2,target2" URL rewrite rules
 *   LMS_ORIGINS          – (optional) Comma-separated allowed LMS origins for CSP
 */

import { NextRequest, NextResponse } from "next/server";
import { upsertPlatform } from "@/lib/lti/platform-store";
import { applyUrlRewrites, buildLmsFetchOptions } from "@/lib/lti/url-rewrite";
import type {
  OpenIdConfig,
  ToolRegistration,
  RegistrationResponse,
} from "@/lib/lti/types";

// ─── Environment ──────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * The public, browser-facing URL of this tool.
 * Used for: redirect_uris, initiate_login_uri, target_link_uri, domain.
 */
function getPublicUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.UI_URL ||
    process.env.SERVER_URL ||
    "http://localhost:3000"
  );
}

/**
 * The URL the LMS server can reach this tool at.
 * In production: same as getPublicUrl().
 * In Docker dev: may be host.docker.internal:3000 or similar.
 * Used for: jwks_uri (LMS fetches our public key server-side).
 */
function getToolUrl(): string {
  return (
    process.env.TOOL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.UI_URL ||
    process.env.SERVER_URL ||
    "http://localhost:3000"
  );
}


// ─── OpenID config validation ─────────────────────────────────────────────────

const REQUIRED_OPENID_FIELDS: (keyof OpenIdConfig)[] = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
  "registration_endpoint",
];

function validateOpenIdConfig(config: Partial<OpenIdConfig>): string | null {
  for (const field of REQUIRED_OPENID_FIELDS) {
    if (!config[field]) {
      return `OpenID configuration missing required field: "${field}"`;
    }
  }
  return null;
}

// ─── Tool registration payload ────────────────────────────────────────────────

/**
 * Builds the LTI tool registration payload per the IMS Dynamic Registration spec.
 *
 * publicUrl  – browser-facing base URL (used for redirect_uris, login, launch)
 * toolUrl    – LMS-reachable base URL (used for jwks_uri)
 */
function buildRegistrationPayload(
  publicUrl: string,
  toolUrl: string,
): ToolRegistration {
  const publicDomain = new URL(publicUrl).host;

  return {
    application_type: "web",
    response_types: ["id_token"],
    grant_types: ["implicit", "client_credentials"],

    // OIDC login initiation — browser navigates here from the LMS
    initiate_login_uri: `${publicUrl}/api/lti/login`,

    // Redirect URIs — must exactly match what we registered; browser-facing
    redirect_uris: [`${publicUrl}/api/lti/launch`],

    client_name: "Testlify",

    // JWKS endpoint — the LMS fetches our public key server-side, so use toolUrl
    jwks_uri: `${toolUrl}/api/lti/keys`,

    logo_uri:
      "https://testlify.com/wp-content/uploads/2022/11/Testlify-Logo-Main_1-1-1-1.svg",

    // We authenticate to the LMS token endpoint with a signed JWT assertion
    token_endpoint_auth_method: "private_key_jwt",

    // Request all LTI Advantage scopes; LMS will grant only what it supports
    scope: [
      "openid",
      "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
      "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
      "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
      "https://purl.imsglobal.org/spec/lti-ags/scope/score",
      "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
    ].join(" "),

    "https://purl.imsglobal.org/spec/lti-tool-configuration": {
      domain: publicDomain,
      description:
        "Testlify LTI Plugin — manage assessments from the Testlify platform",
      target_link_uri: `${publicUrl}/api/lti/launch`,
      claims: ["iss", "sub", "name", "email", "given_name", "family_name"],
      messages: [
        {
          type: "LtiResourceLinkRequest",
          target_link_uri: `${publicUrl}/api/lti/launch`,
          label: "Testlify",
        },
        {
          type: "LtiDeepLinkingRequest",
          target_link_uri: `${publicUrl}/api/lti/launch`,
          label: "Testlify — Select Assessment",
        },
      ],
    },
  };
}

// ─── Registration close page ──────────────────────────────────────────────────

/**
 * Builds the Content-Security-Policy for the close page.
 * If LMS_ORIGINS is set, restricts frame-ancestors to those origins.
 * Otherwise allows all (required because the LMS origin is dynamic at registration time).
 */
function buildCsp(): string {
  const lmsOrigins = (process.env.LMS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const frameAncestors = lmsOrigins.length ? lmsOrigins.join(" ") : "*";
  return `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors ${frameAncestors};`;
}

function buildCloseHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registration Complete</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 2rem; color: #333; }
    p { margin: 0; font-size: 1rem; }
  </style>
</head>
<body>
  <p>Registration complete. This window will close automatically.</p>
  <script>
  (function () {
    // IMS LTI spec: send org.imsglobal.lti.close to every possible parent context
    var msg = { subject: 'org.imsglobal.lti.close' };
    var targets = [window.parent, window.opener, window.top];
    for (var i = 0; i < targets.length; i++) {
      try {
        if (targets[i] && targets[i] !== window) {
          targets[i].postMessage(msg, '*');
        }
      } catch (e) { /* cross-origin guard — safe to ignore */ }
    }
    // Fallback: attempt to close the window if postMessage had no effect
    setTimeout(function () { window.close(); }, 2000);
  })();
  </script>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const TAG = "[LTI Register]";

  try {
    // ── 0. Parse & validate query parameters ─────────────────────────────────

    const rawConfigUrl = request.nextUrl.searchParams.get(
      "openid_configuration",
    );
    const registrationToken = (
      request.nextUrl.searchParams.get("registration_token") ?? ""
    ).trim();

    if (!rawConfigUrl) {
      return NextResponse.json(
        {
          error:
            'Missing required query parameter: "openid_configuration". ' +
            "Ensure this URL is opened by the LMS dynamic registration flow.",
        },
        { status: 400 },
      );
    }

    // Parse and validate the openid_configuration URL
    let configUrlObj: URL;
    try {
      configUrlObj = new URL(rawConfigUrl);
    } catch {
      return NextResponse.json(
        { error: `Invalid openid_configuration URL: "${rawConfigUrl}"` },
        { status: 400 },
      );
    }

    // In production enforce HTTPS to prevent MITM / SSRF via plaintext
    if (!IS_DEV && configUrlObj.protocol !== "https:") {
      return NextResponse.json(
        {
          error:
            "openid_configuration must use HTTPS in production environments.",
        },
        { status: 400 },
      );
    }

    const publicUrl = getPublicUrl();
    const toolUrl = getToolUrl();

    console.log(
      `${TAG} Registration started — IS_DEV=${IS_DEV}, publicUrl=${publicUrl}, toolUrl=${toolUrl}`,
    );
    console.log(`${TAG} openid_configuration=${rawConfigUrl}`);
    if (registrationToken) {
      console.log(`${TAG} registration_token present (length=${registrationToken.length})`);
    }

    // ── 1. Fetch OpenID configuration from the LMS (server-to-server) ─────────

    const { fetchUrl: configFetchUrl, fetchInit: configFetchInit } =
      buildLmsFetchOptions(rawConfigUrl, { headers: { Accept: "application/json" } });

    let configRes: Response;
    try {
      configRes = await fetch(configFetchUrl, configFetchInit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} Network error fetching OpenID config:`, err);
      return NextResponse.json(
        {
          error: `Network error fetching OpenID configuration from LMS: ${msg}. ` +
            (IS_DEV
              ? "Check DEV_LTI_REWRITES if using Docker networking."
              : "Verify the LMS is reachable from this server."),
        },
        { status: 502 },
      );
    }

    if (!configRes.ok) {
      const body = await configRes.text().catch(() => "");
      console.error(
        `${TAG} OpenID config fetch failed: HTTP ${configRes.status}`,
        body,
      );
      return NextResponse.json(
        {
          error: `LMS returned HTTP ${configRes.status} when fetching OpenID configuration.`,
        },
        { status: 502 },
      );
    }

    let config: OpenIdConfig;
    try {
      config = (await configRes.json()) as OpenIdConfig;
    } catch {
      return NextResponse.json(
        { error: "LMS OpenID configuration response is not valid JSON." },
        { status: 502 },
      );
    }

    // ── 2. Validate the OpenID configuration ──────────────────────────────────

    const configError = validateOpenIdConfig(config);
    if (configError) {
      console.error(`${TAG} Invalid OpenID config:`, configError, config);
      return NextResponse.json({ error: configError }, { status: 502 });
    }

    console.log(
      `${TAG} OpenID config OK — issuer=${config.issuer}, registration_endpoint=${config.registration_endpoint}`,
    );

    // ── 3. Build tool registration payload ────────────────────────────────────

    const registration = buildRegistrationPayload(publicUrl, toolUrl);

    // ── 4. POST tool registration to the LMS ──────────────────────────────────

    const regRequestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // IMS spec: send registration_token as Bearer if provided
    if (registrationToken) {
      regRequestHeaders["Authorization"] = `Bearer ${registrationToken}`;
    }

    // CRITICAL: pass the *original* registration_endpoint so buildLmsFetchOptions
    // can derive the correct Host for the spoofed header, then rewrite the URL.
    const { fetchUrl: regFetchUrl, fetchInit: regFetchInit } =
      buildLmsFetchOptions(config.registration_endpoint, {
        method: "POST",
        headers: regRequestHeaders,
        body: JSON.stringify(registration),
      });

    console.log(
      `${TAG} POSTing registration: ${config.registration_endpoint} → ${regFetchUrl}`,
    );

    let regRes: Response;
    try {
      regRes = await fetch(regFetchUrl, regFetchInit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${TAG} Network error posting registration:`, err);
      return NextResponse.json(
        {
          error: `Network error posting registration to LMS: ${msg}. ` +
            (IS_DEV
              ? "Check DEV_LTI_REWRITES if using Docker networking."
              : "Verify the LMS registration endpoint is reachable."),
        },
        { status: 502 },
      );
    }

    console.log(
      `${TAG} Registration response: HTTP ${regRes.status} ` +
        `(redirected=${regRes.redirected}, final_url=${regRes.url})`,
    );

    if (!regRes.ok) {
      const errText = await regRes.text().catch(() => "");
      console.error(
        `${TAG} Registration POST failed: HTTP ${regRes.status} — ${errText}`,
      );

      let errorMsg: string;
      if (regRes.status === 401) {
        errorMsg =
          "LMS rejected the registration with 401 Unauthorized. " +
          "This is typically caused by a web server (Apache/Nginx) stripping the Authorization header " +
          "before it reaches the LMS application.\n\n" +
          "Fix for Apache — add to your LMS vhost or .htaccess:\n" +
          "  SetEnvIf Authorization '(.*)' HTTP_AUTHORIZATION=$1\n" +
          "  # or:\n" +
          "  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\n\n" +
          "Fix for Nginx — ensure the Authorization header is proxied:\n" +
          "  proxy_pass_header Authorization;\n" +
          "  # or:\n" +
          "  proxy_set_header Authorization $http_authorization;";
      } else if (regRes.status === 400) {
        errorMsg = `LMS rejected the registration payload (HTTP 400): ${errText}. ` +
          "Check that the tool URLs are reachable by the LMS.";
      } else {
        errorMsg =
          `Registration failed with HTTP ${regRes.status}` +
          (errText ? `: ${errText}` : ".");
      }

      return NextResponse.json({ error: errorMsg }, { status: regRes.status });
    }

    let regData: RegistrationResponse;
    try {
      regData = (await regRes.json()) as RegistrationResponse;
    } catch {
      return NextResponse.json(
        { error: "LMS registration response is not valid JSON." },
        { status: 502 },
      );
    }

    // ── 5. Validate registration response ─────────────────────────────────────

    if (!regData.client_id) {
      console.error(
        `${TAG} Registration response missing client_id:`,
        regData,
      );
      return NextResponse.json(
        {
          error:
            "LMS registration response is missing client_id. " +
            "The LMS may not support LTI 1.3 dynamic registration.",
        },
        { status: 502 },
      );
    }

    // ── 6. Store platform credentials in the database ─────────────────────────

    const deploymentId =
      regData["https://purl.imsglobal.org/spec/lti-tool-configuration"]
        ?.deployment_id ?? null;

    // URL storage strategy:
    //   auth_login_url — browser-facing; never rewrite (LMS redirects the user's browser here)
    //   auth_token_url — server-to-server; rewrite for dev Docker
    //   keyset_url     — server-to-server; rewrite for dev Docker
    await upsertPlatform({
      issuer: config.issuer,
      client_id: regData.client_id,
      deployment_id: deploymentId,
      auth_login_url: config.authorization_endpoint,
      auth_token_url: applyUrlRewrites(config.token_endpoint),
      keyset_url: applyUrlRewrites(config.jwks_uri),
    });

    console.log(
      `${TAG} Platform stored — issuer=${config.issuer}, client_id=${regData.client_id}, deployment_id=${deploymentId}`,
    );

    // ── 7. Return HTML page that closes the LMS iframe/popup ──────────────────

    return new NextResponse(buildCloseHtml(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": buildCsp(),
        // X-Frame-Options kept for legacy browsers that don't honour CSP frame-ancestors
        "X-Frame-Options": "ALLOWALL",
        // Never cache the registration response
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[LTI Register] Unexpected error:`, err);
    return NextResponse.json(
      { error: `Registration failed unexpectedly: ${msg}` },
      { status: 500 },
    );
  }
}
