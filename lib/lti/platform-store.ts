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
