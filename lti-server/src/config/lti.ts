const Database = require("ltijs-sequelize");
import { dbOptions } from "./database";

interface LtiConfig {
  plugin: any;
  options: {
    appUrl: string;
    loginUrl: string;
    keysetUrl: string;
    dynRegRoute: string;
    dynReg: {
      url: string;
      name: string;
      description: string;
      logo: string;
      redirectUris: string[];
      customParameters: Record<string, any>;
      autoActivate: boolean;
    };
    cookies: {
      secure: boolean;
      sameSite: string;
      partitioned: boolean;
    };
    cors: boolean;
    ltiaas: boolean;
    devMode: boolean;
  };
}

export const getLtiConfig = (): LtiConfig => {
  return {
    plugin: new Database(dbOptions.database, dbOptions.user, dbOptions.pass, {
      host: dbOptions.host,
      dialect: dbOptions.dialect,
      logging: dbOptions.logging,
      port: dbOptions.port,
      dialectOptions:
        process.env.NODE_ENV === "production"
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {},
    }),
    options: {
      appUrl: "/lti/launch", // Endpoint where LMS POSTs the launch data
      loginUrl: "/lti/login",
      keysetUrl: "/lti/keys",
      dynRegRoute: "/lti/register", // Enable Dynamic Registration Endpoint
      dynReg: {
        url: process.env.SERVER_URL || "http://localhost:4000",
        name: "Testlify",
        description:
          "Testlify LTI Plugin to manage assessments created on testlify platform",
        logo: "https://testlify.com/wp-content/uploads/2022/11/Testlify-Logo-Main_1-1-1-1.svg",
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
  };
};
