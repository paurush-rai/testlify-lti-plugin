/**
 * LTI 1.3 cryptographic utilities — zero external dependencies.
 * Uses Node.js built-in `crypto` module for all JWT/RSA/JWKS operations.
 */

import crypto from "crypto";
import type { JwkRsa } from "./types";

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

export function base64urlEncode(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

export function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

// ---------------------------------------------------------------------------
// PEM helpers
// ---------------------------------------------------------------------------

/** Read the RSA private key from env (handles escaped newlines) */
export function getPrivateKeyPem(): string {
  const raw = process.env.LTI_KEY;
  if (!raw) throw new Error("LTI_KEY environment variable is not set");
  return raw.replace(/\\n/g, "\n");
}

/** Derive the public key PEM from the private key */
export function getPublicKeyPem(): string {
  const privateKey = crypto.createPrivateKey(getPrivateKeyPem());
  const publicKey = crypto.createPublicKey(privateKey);
  return publicKey.export({ type: "spki", format: "pem" }) as string;
}

// ---------------------------------------------------------------------------
// JWK conversion
// ---------------------------------------------------------------------------

/** Deterministic kid derived from the public key */
export function getKid(): string {
  const pub = getPublicKeyPem();
  return crypto.createHash("sha256").update(pub).digest("hex").slice(0, 16);
}

/** Export the tool's public key as a JWK (for the /api/lti/keys JWKS endpoint) */
export function publicKeyToJwk(): JwkRsa {
  const privateKey = crypto.createPrivateKey(getPrivateKeyPem());
  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
  return {
    kty: "RSA",
    kid: getKid(),
    n: jwk.n,
    e: jwk.e,
    alg: "RS256",
    use: "sig",
  };
}

/** Convert a JWK (from a platform's JWKS) to a PEM public key */
export function jwkToPem(jwk: { n: string; e: string; kty: string }): string {
  const keyObject = crypto.createPublicKey({
    key: jwk as crypto.JsonWebKey,
    format: "jwk",
  });
  return keyObject.export({ type: "spki", format: "pem" }) as string;
}

// ---------------------------------------------------------------------------
// JWT sign / verify (RS256)
// ---------------------------------------------------------------------------

interface JwtHeader {
  alg: string;
  typ: string;
  kid?: string;
}

/** Sign a JWT with our private key (RS256) */
export function signJwt(
  payload: Record<string, unknown>,
  options?: { expiresIn?: number; kid?: string },
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: payload.iat ?? now,
    exp: payload.exp ?? now + (options?.expiresIn ?? 86400), // default 24h
  };

  const header: JwtHeader = { alg: "RS256", typ: "JWT" };
  if (options?.kid) header.kid = options.kid;

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(getPrivateKeyPem(), "base64url");

  return `${signingInput}.${signature}`;
}

/** Decode a JWT without verification (to read header/payload) */
export function decodeJwt(token: string): {
  header: JwtHeader;
  payload: Record<string, unknown>;
} {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return {
    header: JSON.parse(base64urlDecode(parts[0]).toString()),
    payload: JSON.parse(base64urlDecode(parts[1]).toString()),
  };
}

/** Verify a JWT signed with our own private key (i.e. session/state JWTs) */
export function verifyJwt<T = Record<string, unknown>>(token: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(signingInput);
  const pubPem = getPublicKeyPem();
  if (!verify.verify(pubPem, signature, "base64url")) {
    throw new Error("JWT signature verification failed");
  }

  const payload = JSON.parse(base64urlDecode(parts[1]).toString()) as T & {
    exp?: number;
  };
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("JWT has expired");
  }
  return payload as T;
}

/** Verify a JWT signed by an external platform (using their public key PEM) */
export function verifyJwtWithKey<T = Record<string, unknown>>(
  token: string,
  publicKeyPem: string,
): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(signingInput);
  if (!verify.verify(publicKeyPem, signature, "base64url")) {
    throw new Error("JWT signature verification failed");
  }

  const payload = JSON.parse(base64urlDecode(parts[1]).toString()) as T & {
    exp?: number;
  };
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("JWT has expired");
  }
  return payload as T;
}

// ---------------------------------------------------------------------------
// JWKS fetch helper
// ---------------------------------------------------------------------------

/** Fetch a platform's JWKS and find the key matching the given kid */
export async function fetchPlatformKey(
  jwksUrl: string,
  kid: string,
): Promise<string> {
  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${res.status}`);
  }
  const jwks = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string; kty: string }> };
  const key = jwks.keys.find((k) => k.kid === kid);
  if (!key) {
    throw new Error(`Key with kid "${kid}" not found in JWKS`);
  }
  return jwkToPem(key);
}

/** Generate a cryptographically secure random string */
export function randomString(length = 32): string {
  return crypto.randomBytes(length).toString("hex").slice(0, length);
}
