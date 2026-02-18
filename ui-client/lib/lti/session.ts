/**
 * Session JWT (ltik) — stateless session management.
 *
 * After a successful LTI launch, we create a signed JWT containing all
 * needed LTI claims. Every business API route just verifies this JWT
 * signature — no session table needed.
 */

import { signJwt, verifyJwt } from "./crypto";
import type { SessionPayload, StatePayload } from "./types";

const SESSION_EXPIRY = 86400; // 24 hours
const STATE_EXPIRY = 600; // 10 minutes

/** Create a session JWT (ltik) after successful launch */
export function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
): string {
  return signJwt(payload as Record<string, unknown>, {
    expiresIn: SESSION_EXPIRY,
  });
}

/** Verify and decode a session JWT */
export function verifySessionToken(token: string): SessionPayload {
  return verifyJwt<SessionPayload>(token);
}

/** Create a state JWT for the OIDC login redirect */
export function createStateToken(nonce: string, platformId: string): string {
  return signJwt({ nonce, platformId } as unknown as Record<string, unknown>, {
    expiresIn: STATE_EXPIRY,
  });
}

/** Verify and decode a state JWT */
export function verifyStateToken(token: string): StatePayload {
  return verifyJwt<StatePayload>(token);
}
