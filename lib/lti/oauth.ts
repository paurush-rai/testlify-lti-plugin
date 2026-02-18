/**
 * OAuth2 client_credentials grant — JWT assertion flow.
 *
 * Used to obtain access tokens from the platform's token endpoint
 * for NRPS and AGS service calls.
 */

import crypto from "crypto";
import { signJwt, getKid } from "./crypto";
import { findPlatformById } from "./platform-store";
import type { TokenResponse } from "./types";

/**
 * Get an OAuth2 access token from a platform using client_credentials grant
 * with a private_key_jwt assertion.
 */
export async function getAccessToken(
  platformId: string,
  scopes: string[],
): Promise<string> {
  const platform = await findPlatformById(platformId);
  if (!platform) throw new Error(`Platform ${platformId} not found`);

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: platform.client_id,
      sub: platform.client_id,
      aud: platform.auth_token_url,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 300, // 5 minute validity
    },
    { kid: getKid(), expiresIn: 300 },
  );

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: scopes.join(" "),
  });

  const res = await fetch(platform.auth_token_url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token request failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}
