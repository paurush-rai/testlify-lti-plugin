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

export const dbOptions: DbOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "ltidb",
  user: process.env.DB_USER || "ltiuser",
  pass: process.env.DB_PASS || "ltipassword",
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
  },
);
