import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Create CSP Header
  // We need to allow frame-ancestors to be any (*) or specific domains for LTI to work in iframe.
  // Script-src needs 'unsafe-inline' or nonce for Next.js in some modes, but 'unsafe-inline' common for simpler setups.
  // Ideally use nonce for scripts.

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors *;
    upgrade-insecure-requests;
  `;
  // Replace newlines with spaces
  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, " ")
    .trim();

  const response = NextResponse.next();

  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicyHeaderValue,
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
