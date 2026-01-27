/* eslint-disable no-console */
require("dotenv").config();
const lti = require("ltijs").Provider;
const Database = require("ltijs-sequelize");

// Database configuration
const dbOptions = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "ltidb",
  user: process.env.DB_USER || "ltiuser",
  pass: process.env.DB_PASS || "ltipassword",
  dialect: "postgres",
  logging: false,
};

// Initialize Ltijs Provider
lti.setup(
  process.env.LTI_KEY,
  {
    plugin: new Database(dbOptions.database, dbOptions.user, dbOptions.pass, {
      host: dbOptions.host,
      dialect: dbOptions.dialect,
      logging: dbOptions.logging,
      port: dbOptions.port,
    }),
  },
  {
    appUrl: "/lti/launch", // Endpoint where LMS POSTs the launch data
    loginUrl: "/lti/login",
    keysetUrl: "/lti/keys",
    dynRegRoute: "/lti/register", // Enable Dynamic Registration Endpoint
    dynReg: {
      url: process.env.SERVER_URL || "http://localhost:4000",
      name: "First LTI Plugin",
      description: "A demo LTI 1.3 tool",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Node.js_logo_2015.svg/2560px-Node.js_logo_2015.svg.png",
      redirectUris: [], // Optional: add extra redirect URIs if needed
      customParameters: {}, // Optional
      autoActivate: true, // Automatically activate the platform
    },
    cookies: {
      secure: true, // Always secure in production (and validated check-host)
      sameSite: "None", // Required for iframe
      partitioned: true,
    },
    cors: false,
    ltiaas: true, // Enable LTIaaS mode (allows token-only auth, bypassing strict cookie checks)
    devMode: true, // Enable dev mode to bypass strict state cookie validation (Fixes MISSING_VALIDATION_COOKIE)
  },
);

// Middleware: Extract Bearer Token for LTIaaS mode
lti.app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    req.token = token; // Make it available where ltijs expects it
    req.query.ltik = token; // Also put in query just in case
  }
  next();
});

const setup = async () => {
  // LTI Launch Callback
  lti.onConnect(async (token, req, res) => {
    console.log("----------------------------------------");
    console.log("✅ LTI Launch successful!");
    console.log("User:", token.user);
    console.log("Context:", token.context);
    console.log("Redirecting to /app...");
    console.log("----------------------------------------");

    // Redirect to the Next.js UI
    const uiUrl = process.env.UI_URL || "";
    return res.redirect(`${uiUrl}/app?ltik=${res.locals.ltik}`);
  });

  // Handle Dynamic Registration (Optional: just logging)
  lti.onDynamicRegistration(async (req, res, next) => {
    try {
      if (!req.query.openid_configuration) {
        return res.status(400).send({ error: "Missing openid_configuration" });
      }
      console.log("Registering Platform:", req.query.openid_configuration);
      const message = await lti.DynamicRegistration.register(
        req.query.openid_configuration,
        req.query.registration_token,
      );
      res.setHeader("Content-type", "text/html");
      res.send(message);
    } catch (err) {
      console.log("Dynamic Registration Error:", err);
      if (err.message === "PLATFORM_ALREADY_REGISTERED") {
        return res.status(403).send("Platform already registered");
      }
      return res.status(500).send({ error: err.message });
    }
  });

  // API Endpoints for UI
  lti.app.get("/api/me", (req, res) => {
    if (!res.locals.token) {
      console.log("❌ /api/me Unauthorized. Cookies:", req.headers.cookie);
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({
      name: res.locals.token.userInfo.name,
      email: res.locals.token.userInfo.email,
      roles: res.locals.token.platformContext.roles,
      context: res.locals.context,
    });
  });

  // Deep Linking Route
  lti.app.post("/lti/deeplink", async (req, res) => {
    return res.sendStatus(200);
  });

  // Deploy
  const port = process.env.PORT || 4000;
  // Enable trust proxy to handle X-Forwarded-Proto headers from Next.js/Ngrok
  lti.app.enable("trust proxy");

  await lti.deploy({ port, serverless: false });

  // Register Platforms (Manual Config)
  const issuerUrl = process.env.LMS_ISSUER_URL;
  const clientId = process.env.LMS_CLIENT_ID;
  const authUrl = process.env.LMS_AUTH_URL;
  const tokenUrl = process.env.LMS_TOKEN_URL;
  const keysetUrl = process.env.LMS_KEYSET_URL;

  if (issuerUrl && clientId) {
    try {
      await lti.registerPlatform({
        url: issuerUrl,
        name: "LMS Platform",
        clientId: clientId,
        authenticationEndpoint: authUrl,
        accesstokenEndpoint: tokenUrl,
        authConfig: { method: "JWK_SET", key: keysetUrl },
      });
      console.log(`Registered platform: ${issuerUrl}`);
    } catch (err) {
      console.log("Platform already registered or error:", err.message);
    }
  }

  console.log(`LTI Provider listening on port ${port}`);
};

setup();
