// @ts-ignore

// Use a global variable to store the Provider instance during development
// to prevent multiple instances from being created during hot reloads.
declare global {
  var ltiProvider: any;
}

export const getLtiProvider = async () => {
  // @ts-ignore
  const { Provider: provider } = require("ltijs");
  // @ts-ignore
  const Database = require("ltijs-sequelize");

  // Setup provider only once
  if (!globalThis.ltiProvider) {
    try {
      const db = new Database(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          dialect: "postgres",
          logging: false,
        },
      );

      provider.setup(
        process.env.LTI_KEY || "LTIKEY",
        {
          plugin: db,
        },
        {
          // LTI routes are relative to /api/lti
          appRoute: "/launch",
          loginRoute: "/login",
          keysetRoute: "/keys",
          dynRegRoute: "/register",
          dynReg: {
            url: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
            name: "Testlify",
            logo: "https://testlify.com/wp-content/uploads/2022/11/Testlify-Logo-Main_1-1-1-1.svg",
            description:
              "Testlify LTI Plugin to manage assessments created on testlify platform",
            redirectUris: [],
            autoActivate: true,
          },
          cookies: {
            secure: (process.env.NEXT_PUBLIC_URL || "").startsWith("https"),
            sameSite: (process.env.NEXT_PUBLIC_URL || "").startsWith("https")
              ? "None"
              : "Lax",
          },
          cors: false,
          devMode: process.env.NODE_ENV === "development",
          serverless: true,
        },
      );

      await provider.deploy({ serverless: true });

      globalThis.ltiProvider = provider;
    } catch (err: any) {
      if (err.message === "PROVIDER_ALREADY_SETUP") {
        globalThis.ltiProvider = provider;
      } else {
        console.error("[LTI] Provider setup error:", err);
        throw err;
      }
    }
  }

  // Register onConnect handler (backup for route-level redirect handling)
  provider.onConnect(async (token: any, req: any, res: any) => {
    const ltik = res.locals?.ltik || token;
    res.redirect(`/dashboard?ltik=${ltik}`);
  });

  return globalThis.ltiProvider;
};
