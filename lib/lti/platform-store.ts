/**
 * CRUD operations for the lti_platforms collection (MongoDB).
 */

import connectToDatabase from "@/lib/db";
import PlatformModel, { IPlatform } from "@/lib/models/Platform";
import type { Platform } from "./types";

// Helper to map Mongoose doc to Platform interface
function mapDoc(doc: any): Platform {
  return {
    id: doc._id.toString(),
    issuer: doc.issuer,
    client_id: doc.client_id,
    deployment_id: doc.deployment_id,
    auth_login_url: doc.auth_login_url,
    auth_token_url: doc.auth_token_url,
    keyset_url: doc.keyset_url,
    testlify_token: doc.testlify_token ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

/** Find a platform by issuer and (optionally) client_id */
export async function findPlatform(
  issuer: string,
  clientId?: string,
): Promise<Platform | null> {
  await connectToDatabase();
  const query: any = { issuer };
  if (clientId) {
    query.client_id = clientId;
  }
  const doc = await PlatformModel.findOne(query);
  return doc ? mapDoc(doc) : null;
}

/** Find a platform by its primary key (ObectId) */
export async function findPlatformById(id: string): Promise<Platform | null> {
  await connectToDatabase();
  try {
    const doc = await PlatformModel.findById(id);
    return doc ? mapDoc(doc) : null;
  } catch (e) {
    return null; // Handle invalid ObjectId
  }
}

/** Insert or update a platform record (upsert on issuer+client_id) */
export async function upsertPlatform(platform: {
  issuer: string;
  client_id: string;
  deployment_id?: string | null;
  auth_login_url: string;
  auth_token_url: string;
  keyset_url: string;
}): Promise<Platform> {
  await connectToDatabase();
  const filter = { issuer: platform.issuer, client_id: platform.client_id };
  const update = {
    ...platform,
    deployment_id: platform.deployment_id ?? null, // ensure null if undefined
    updated_at: new Date(),
  };

  const doc = await PlatformModel.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return mapDoc(doc);
}

/** Save (or update) the Testlify API token for a specific platform */
export async function updatePlatformToken(
  platformId: string,
  testlifyToken: string,
): Promise<boolean> {
  await connectToDatabase();
  try {
    // $set + strict:false bypasses Mongoose schema-caching issues in dev (HMR)
    // so the field is written to MongoDB even if the cached model predates the schema change.
    const result = await PlatformModel.findByIdAndUpdate(
      platformId,
      { $set: { testlify_token: testlifyToken, updated_at: new Date() } },
      { new: true, strict: false },
    );
    return result !== null;
  } catch {
    return false;
  }
}

/** Retrieve the Testlify token for a platform (stored in MongoDB). */
export async function getTestlifyToken(platformId: string): Promise<string | null> {
  await connectToDatabase();
  try {
    // .lean() returns the raw MongoDB document, bypassing Mongoose schema
    // restrictions — safe even when the model is a cached pre-migration version.
    const doc = await PlatformModel.findById(platformId)
      .select("testlify_token")
      .lean<{ testlify_token?: string }>();
    return doc?.testlify_token ?? null;
  } catch {
    return null;
  }
}
