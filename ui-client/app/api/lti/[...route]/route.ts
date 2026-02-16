import { NextRequest, NextResponse } from "next/server";
import { getLtiProvider } from "@/src/lib/lti-provider";
import { createMocks } from "node-mocks-http";
import * as EventEmitter from "events";

// Helper to convert NextRequest to (Mock)ExpressRequest
async function getExpressReqRes(req: NextRequest) {
  let body: any = {};
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    body = await req.json().catch(() => ({}));
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } catch (e) {
      throw new Error("Failed to parse form data", { cause: e });
    }
  }

  // Convert Headers to plain object
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  // Ensure cookie header is present for ltijs (which uses cookie-parser)
  // NextRequest might have cookies but not in header if they were modified? No, typically in header.
  // But let's be safe and ensure it reflects req.cookies just in case.
  if (!headers["cookie"]) {
    headers["cookie"] = req.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }

  // Parse cookies from header manually if needed, or rely on mock
  const cookies: Record<string, string> = {};
  req.cookies.getAll().forEach((c) => (cookies[c.name] = c.value));

  // Strip /api/lti prefix from pathname for ltijs
  // ltijs expects routes like /login, /launch, not /api/lti/login, /api/lti/launch
  const ltiPath = req.nextUrl.pathname.replace(/^\/api\/lti/, "") || "/";
  const ltiUrl = ltiPath + req.nextUrl.search;

  // Create Mocks
  const { req: expressReq, res: expressRes } = createMocks(
    {
      method: req.method as any,
      url: ltiUrl,
      headers,
      body: body || {},
      cookies,
      query: Object.fromEntries(req.nextUrl.searchParams),
    },
    {
      eventEmitter: EventEmitter,
    },
  );

  // Patch required properties for ltijs
  // ltijs expects protocol, secure, ip
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isHttps =
    (process.env.NEXT_PUBLIC_URL || "").startsWith("https") ||
    forwardedProto === "https";
  expressReq.protocol = isHttps ? "https" : "http";
  expressReq.secure = isHttps;
  expressReq.ip = (req.headers.get("x-forwarded-for") || "127.0.0.1").split(
    ",",
  )[0];
  expressReq.connection = { remoteAddress: expressReq.ip } as any;

  // IMPORTANT: Set _body to true so ltijs (body-parser) doesn't try to parse the body again.
  // We already parsed it from NextRequest and passed it to createMocks.
  (expressReq as any)._body = true;

  // Ensure content-type is set correctly if it was missing or partial
  if (!expressReq.headers["content-type"]) {
    expressReq.headers["content-type"] = "application/x-www-form-urlencoded";
  }

  // Initialize cookies/signedCookies if missing to prevent "Cannot read properties of undefined"
  if (!expressReq.cookies) {
    (expressReq as any).cookies = {};
  }
  if (!(expressReq as any).signedCookies) {
    (expressReq as any).signedCookies = {};
  }

  // Patch removeListener to prevent "TypeError: Cannot read properties of undefined (reading 'Symbol(kState)')"
  // This happens because raw-body tries to remove listeners from a mock stream that isn't fully initialized as a real stream.
  if (!expressReq.removeListener) {
    (expressReq as any).removeListener = () => {};
  }
  const originalRemoveListener = expressReq.removeListener;
  (expressReq as any).removeListener = (...args: any[]) => {
    try {
      // @ts-ignore
      return originalRemoveListener.apply(expressReq, args);
    } catch (e) {
      throw new Error("Failed to remove listener", { cause: e });
    }
  };

  // Patch unpipe to prevent "TypeError: Cannot read properties of undefined (reading 'pipes')"
  (expressReq as any).unpipe = (...args: any[]) => {
    return expressReq;
  };

  // Patch destroy to prevent similar errors during cleanup
  (expressReq as any).destroy = (...args: any[]) => {
    return expressReq;
  };

  // Patch pause and resume to prevent "TypeError: Cannot read properties of undefined (reading 'Symbol(kState)')"
  (expressReq as any).pause = (...args: any[]) => {
    return expressReq;
  };
  (expressReq as any).resume = (...args: any[]) => {
    return expressReq;
  };

  return { expressReq, expressRes };
}

async function handleLtiRequest(req: NextRequest) {
  const lti = await getLtiProvider();
  const { expressReq, expressRes } = await getExpressReqRes(req);

  // Wait for express response to finish
  await new Promise<void>((resolve, reject) => {
    expressRes.on("finish", () => {
      resolve();
    });

    // Pass to ltijs express app
    lti.app(expressReq, expressRes, (err: any) => {
      if (err) {
        console.error("[LTI] Error processing request:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  // Convert Mock Response back to NextResponse
  const statusCode = expressRes.statusCode || 200;
  const resHeaders = new Headers();
  const mockHeaders = expressRes.getHeaders();

  Object.keys(mockHeaders).forEach((key) => {
    const val = mockHeaders[key];
    if (Array.isArray(val)) {
      val.forEach((v) => resHeaders.append(key, String(v)));
    } else if (val) {
      resHeaders.set(key, String(val));
    }
  });

  // Manually ensure cookies set via res.cookie() are added to headers if node-mocks-http didn't serialize them
  // expressRes.cookies is an object { name: { value: '...', options: ... } }
  // We need to serialize this to Set-Cookie header strings
  const cookies = (expressRes as any).cookies || {};
  Object.keys(cookies).forEach((name) => {
    const cookie = cookies[name];
    const options = cookie.options || {};
    let cookieString = `${name}=${cookie.value}`;

    if (options.maxAge) {
      cookieString += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
    }
    if (options.domain) {
      cookieString += `; Domain=${options.domain}`;
    }
    if (options.path) {
      cookieString += `; Path=${options.path}`;
    }
    if (options.expires) {
      if (options.expires instanceof Date) {
        cookieString += `; Expires=${options.expires.toUTCString()}`;
      } else {
        cookieString += `; Expires=${options.expires}`;
      }
    }
    if (options.httpOnly) {
      cookieString += `; HttpOnly`;
    }
    if (options.secure) {
      cookieString += `; Secure`;
    }
    if (options.sameSite) {
      // sameSite can be boolean or string
      if (options.sameSite === true) cookieString += `; SameSite=Strict`;
      else if (options.sameSite === false) {
        /* no-op */
      } else cookieString += `; SameSite=${options.sameSite}`;
    }

    resHeaders.append("set-cookie", cookieString);
  });

  // Handle redirects from ltijs
  const redirectUrl = expressRes._getRedirectUrl();
  if (redirectUrl) {
    // Intercept ltijs default redirect to /launch and redirect to /dashboard instead
    // This is needed because onConnect handler doesn't work reliably in serverless mode
    const url = new URL(redirectUrl, req.url);

    // Check if this is a launch redirect with ltik token
    if (
      (url.pathname.includes("/launch") || url.pathname === "/launch") &&
      url.searchParams.has("ltik")
    ) {
      const ltik = url.searchParams.get("ltik");
      return NextResponse.redirect(
        new URL(`/dashboard?ltik=${ltik}`, req.url),
        {
          status: 302,
          headers: resHeaders,
        },
      );
    }

    return NextResponse.redirect(new URL(redirectUrl, req.url), {
      status: 302,
      headers: resHeaders,
    });
  }

  let body = expressRes._getData();

  // If json() was called, body might be an object, but NextResponse expects string/Buffer/etc or it coerces improperly.
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
  }

  return new NextResponse(body, {
    status: statusCode,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest) {
  return handleLtiRequest(req);
}

export async function POST(req: NextRequest) {
  return handleLtiRequest(req);
}
