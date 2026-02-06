import "dotenv/config";
import { Provider } from "ltijs";
import express, { Request, Response } from "express";
import { sequelize } from "./config/database";
import { getLtiConfig } from "./config/lti";
import { extractBearerToken } from "./middleware/auth";
import setupRoutes from "./routes/api";

import "./models/AssessmentAssignment";

const lti = Provider;

const ltiConfig = getLtiConfig();

lti.setup(
  process.env.LTI_KEY as string,
  { plugin: ltiConfig.plugin },
  ltiConfig.options,
);

(lti as any).whitelist({ route: "/api/webhook/score", method: "POST" });

lti.app.use(extractBearerToken);
lti.app.use(express.json());

const setup = async (): Promise<void> => {
  lti.onConnect(async (_token: any, _req: Request, res: Response) => {
    const uiUrl = process.env.UI_URL || "";
    return res.redirect(`${uiUrl}/app?ltik=${(res.locals as any).ltik}`);
  });

  lti.onDynamicRegistration(async (req: Request, res: Response, _next: any) => {
    try {
      if (!req.query.openid_configuration) {
        return res.status(400).send({ error: "Missing openid_configuration" });
      }
      const message = await lti.DynamicRegistration.register(
        req.query.openid_configuration as string,
        req.query.registration_token as string,
      );
      res.setHeader("Content-type", "text/html");
      return res.send(message);
    } catch (err: any) {
      if (err.message === "PLATFORM_ALREADY_REGISTERED") {
        return res.status(403).send("Platform already registered");
      }
      return res.status(500).send({ error: err.message });
    }
  });

  setupRoutes(lti);

  const port = Number.parseInt(process.env.PORT || "4000", 10);
  lti.app.enable("trust proxy");

  try {
    await sequelize.sync({ alter: true });
  } catch (err) {
    console.error("Database sync error:", err);
  }

  await lti.deploy({ port, serverless: false });
};

setup();
