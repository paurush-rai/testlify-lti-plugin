import { Sequelize } from "sequelize";

// Database configuration
interface DbOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  pass: string;
  dialect: "postgres";
  logging: boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const dbOptions: DbOptions = {
  host: getEnvVar("DB_HOST"),
  // Parse port safely, default to 5432 if missing
  port: Number.parseInt(process.env.DB_PORT || "5432", 10),
  database: getEnvVar("DB_NAME"),
  user: getEnvVar("DB_USER"),
  pass: getEnvVar("DB_PASS"),
  dialect: "postgres",
  logging: false,
};

// Create Sequelize instance for custom tables
export const sequelize = new Sequelize(
  dbOptions.database,
  dbOptions.user,
  dbOptions.pass,
  {
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
  },
);
