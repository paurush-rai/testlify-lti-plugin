/**
 * Database migration script.
 * Creates lti_platforms and ensures assessment_assignments exists.
 *
 * Run: npx ts-node scripts/migrate.ts
 */

import "dotenv/config";
import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    console.log("Running migrations...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lti_platforms (
        id              SERIAL PRIMARY KEY,
        issuer          TEXT NOT NULL,
        client_id       TEXT NOT NULL,
        deployment_id   TEXT,
        auth_login_url  TEXT NOT NULL,
        auth_token_url  TEXT NOT NULL,
        keyset_url      TEXT NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(issuer, client_id)
      );
    `);
    console.log("  lti_platforms table ready.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS assessment_assignments (
        id                SERIAL PRIMARY KEY,
        "assessmentId"    TEXT NOT NULL,
        "assessmentTitle" TEXT,
        "studentId"       TEXT NOT NULL,
        "studentName"     TEXT,
        "studentEmail"    TEXT,
        "contextId"       TEXT NOT NULL,
        "platformId"      TEXT,
        "lineItemUrl"     TEXT,
        "createdAt"       TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("  assessment_assignments table ready.");

    console.log("Migrations complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
