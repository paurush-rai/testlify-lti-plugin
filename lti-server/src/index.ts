import "dotenv/config";
import { Provider } from "ltijs";
import crypto from "crypto";
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
      const openidConfiguration = req.query.openid_configuration as string;
      const registrationToken = req.query.registration_token as string;

      // Custom Dynamic Registration Flow to fix Authorization Header issue
      console.log("Fetching configuration from:", openidConfiguration);

      // @ts-ignore
      const configReq = await fetch(openidConfiguration, {
        headers: registrationToken
          ? { Authorization: `Bearer ${registrationToken}` }
          : {},
      });

      if (!configReq.ok) {
        throw new Error(
          `Failed to fetch configuration: ${configReq.status} ${configReq.statusText}`,
        );
      }
      const configuration = (await configReq.json()) as any;

      const messages = [
        { type: "LtiResourceLinkRequest" },
        { type: "LtiDeepLinkingRequest" },
      ];

      const registration = {
        application_type: "web",
        response_types: ["id_token"],
        grant_types: ["implicit", "client_credentials"],
        initiate_login_uri: `${ltiConfig.options.dynReg.url}${ltiConfig.options.loginUrl}`,
        redirect_uris: [
          `${ltiConfig.options.dynReg.url}${ltiConfig.options.appUrl}`,
        ],
        client_name: ltiConfig.options.dynReg.name,
        jwks_uri: `${ltiConfig.options.dynReg.url}${ltiConfig.options.keysetUrl}`,
        logo_uri: ltiConfig.options.dynReg.logo,
        token_endpoint_auth_method: "private_key_jwt",
        scope:
          "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem https://purl.imsglobal.org/spec/lti-ags/scope/score https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
        "https://purl.imsglobal.org/spec/lti-tool-configuration": {
          domain: new URL(ltiConfig.options.dynReg.url).host,
          description: ltiConfig.options.dynReg.description,
          target_link_uri: `${ltiConfig.options.dynReg.url}${ltiConfig.options.appUrl}`,
          custom_parameters: ltiConfig.options.dynReg.customParameters,
          claims: configuration.claims_supported,
          messages,
        },
      };

      // @ts-ignore
      const regReq = await fetch(configuration.registration_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(registrationToken
            ? { Authorization: `Bearer ${registrationToken}` }
            : {}),
        },
        body: JSON.stringify(registration),
      });

      if (!regReq.ok) {
        const errText = await regReq.text();
        throw new Error(`Registration failed: ${regReq.status} ${errText}`);
      }
      const registrationResponse = (await regReq.json()) as any;

      const platformName =
        (configuration[
          "https://purl.imsglobal.org/spec/lti-platform-configuration"
        ]?.product_family_code || "Platform") +
        "_DynReg_" +
        crypto.randomBytes(16).toString("hex");

      const platform = {
        url: configuration.issuer,
        name: platformName,
        clientId: registrationResponse.client_id,
        authenticationEndpoint: configuration.authorization_endpoint,
        accesstokenEndpoint: configuration.token_endpoint,
        authorizationServer:
          configuration.authorization_server || configuration.token_endpoint,
        authConfig: {
          method: "JWK_SET",
          key: configuration.jwks_uri,
        },
      };

      // @ts-ignore
      await lti.registerPlatform(platform);

      const message =
        '<script>(window.opener || window.parent).postMessage({subject:"org.imsglobal.lti.close"}, "*");</script>';

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
