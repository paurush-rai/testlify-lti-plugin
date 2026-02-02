/* eslint-disable no-console */
import "dotenv/config";
import { Provider } from "ltijs";
import express, { Request, Response } from "express";
import { sequelize } from "./config/database";
import { getLtiConfig } from "./config/lti";
import { extractBearerToken } from "./middleware/auth";
import setupRoutes from "./routes/api";

// Import models to ensure they're registered
import "./models/AssessmentAssignment";
import "./models/AssessmentLineItem";

const lti = Provider;

// Initialize Ltijs Provider
const ltiConfig = getLtiConfig();

lti.setup(
  process.env.LTI_KEY as string,
  { plugin: ltiConfig.plugin },
  ltiConfig.options,
);

// Create a parent Express app to intercept /api/score BEFORE ltijs
const parentApp: express.Express = express();
parentApp.use(express.json());
parentApp.use(express.urlencoded({ extended: true }));

// Debug Middleware: Log LTI Launch attempts
parentApp.use((req, _res_unused, next) => {
  if (req.method === "POST" && req.path === ltiConfig.options.appUrl) {
    try {
      if (req.body && req.body.id_token) {
        const parts = req.body.id_token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64").toString(),
          );
          console.log("\n--- Incoming LTI Launch ---");
          console.log("Issuer (iss):", payload.iss);
          console.log("Client ID (aud):", payload.aud);
          console.log("Platform must be registered with this Issuer URL.");
          console.log("---------------------------\n");
        }
      }
    } catch (err) {
      console.log("Failed to parse LTI launch token for debugging:", err);
    }
  }
  next();
});

// Middleware: Extract Bearer Token for LTIaaS mode (for lti routes only)
lti.app.use(extractBearerToken);
lti.app.use(express.json());

const setup = async (): Promise<void> => {
  // LTI Launch Callback
  lti.onConnect(async (_token: any, _req: Request, res: Response) => {
    const uiUrl = process.env.UI_URL || "";
    return res.redirect(`${uiUrl}/app?ltik=${(res.locals as any).ltik}`);
  });

  // Handle Dynamic Registration
  lti.onDynamicRegistration(async (req: Request, res: Response, _next: any) => {
    try {
      if (!req.query.openid_configuration) {
        // If query param is missing, check if it's a browser visit
        const accept = req.headers.accept || "";
        if (accept.includes("text/html")) {
          return res.status(400).send(`
             <h1>Dynamic Registration Endpoint</h1>
             <p>This URL is meant to be used by an LMS (like Moodle, Canvas) to automatically configure the tool.</p>
             <p><strong>Do not visit this URL directly.</strong></p>
             <p>Copy this URL and paste it into your LMS "Tool URL" configuration field.</p>
           `);
        }
        return res.status(400).send({ error: "Missing openid_configuration" });
      }
      console.log("Registering Platform:", req.query.openid_configuration);
      const message = await lti.DynamicRegistration.register(
        req.query.openid_configuration as string,
        req.query.registration_token as string,
      );
      res.setHeader("Content-type", "text/html");
      return res.send(message);
    } catch (err: any) {
      console.log("Dynamic Registration Error:", err);
      if (err.message === "PLATFORM_ALREADY_REGISTERED") {
        return res.status(403).send("Platform already registered");
      }
      return res.status(500).send({ error: err.message });
    }
  });

  // Setup API routes
  setupRoutes(lti);

  // Deploy (but serverless: true so we can use parentApp)
  const port = Number.parseInt(process.env.PORT || "4000", 10);
  lti.app.enable("trust proxy");
  parentApp.enable("trust proxy");

  // Sync database (create tables if they don't exist)
  try {
    await sequelize.sync();
    console.log("✅ Database synced successfully");
  } catch (err) {
    console.error("❌ Database sync error:", err);
  }

  // Connect to DB and setup internal express app
  await lti.deploy({ serverless: true });

  // Mount ltijs app for all routes
  // We mount it broadly, but since we use serverless: true, we control the listen
  parentApp.use(lti.app);

  // Start the parent Express server
  parentApp.listen(port, () => {
    console.log(`🚀 LTI Provider listening on port ${port}`);

    const dynRegUrl = `${process.env.SERVER_URL || "http://localhost:4000"}${ltiConfig.options.dynRegRoute}`;
    console.log(`Example Dynamic Registration URL: ${dynRegUrl}`);
  });

  // Register Platforms (Manual Config)
  /* ... (rest of the file) */

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
    } catch (err: any) {
      console.log("Platform already registered or error:", err.message);
    }
  }

  console.log(`LTI Provider listening on port ${port}`);

  const dynRegUrl = `${process.env.SERVER_URL || "http://localhost:4000"}${ltiConfig.options.dynRegRoute}`;
  console.log(`Example Dynamic Registration URL: ${dynRegUrl}`);
};

setup();
