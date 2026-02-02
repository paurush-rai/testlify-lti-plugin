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

const lti = Provider;

// Initialize Ltijs Provider
const ltiConfig = getLtiConfig();

lti.setup(
  process.env.LTI_KEY as string,
  { plugin: ltiConfig.plugin },
  ltiConfig.options,
);

// Middleware: Extract Bearer Token for LTIaaS mode
lti.app.use(extractBearerToken);

// Middleware: Parse JSON bodies
lti.app.use(express.json());

const setup = async (): Promise<void> => {
  // LTI Launch Callback
  lti.onConnect(async (token: any, _req: Request, res: Response) => {
    console.log("----------------------------------------");
    console.log("✅ LTI Launch successful!");
    console.log("User:", token.user);
    console.log("Context:", token.context);
    console.log("PlatformId:", token.platformId);
    console.log("Redirecting to /app...");
    console.log("----------------------------------------");

    // Redirect to the Next.js UI
    const uiUrl = process.env.UI_URL || "";
    return res.redirect(`${uiUrl}/app?ltik=${(res.locals as any).ltik}`);
  });

  // Handle Dynamic Registration
  lti.onDynamicRegistration(async (req: Request, res: Response, _next: any) => {
    try {
      if (!req.query.openid_configuration) {
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

  // Deploy
  const port = Number.parseInt(process.env.PORT || "4000", 10);
  // Enable trust proxy to handle X-Forwarded-Proto headers from Next.js/Ngrok
  lti.app.enable("trust proxy");

  // Sync database (create tables if they don't exist)
  try {
    await sequelize.sync();
    console.log("✅ Database synced successfully");
  } catch (err) {
    console.error("❌ Database sync error:", err);
  }

  await lti.deploy({ port, serverless: false });

  console.log(`LTI Provider listening on port ${port}`);
};

setup();
