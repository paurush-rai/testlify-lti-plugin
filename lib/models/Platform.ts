import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPlatform extends Document {
  issuer: string;
  client_id: string;
  deployment_id: string | null;
  auth_login_url: string;
  auth_token_url: string;
  keyset_url: string;
  created_at: Date;
  updated_at: Date;
}

const PlatformSchema: Schema = new Schema(
  {
    issuer: { type: String, required: true },
    client_id: { type: String, required: true },
    deployment_id: { type: String, default: null },
    auth_login_url: { type: String, required: true },
    auth_token_url: { type: String, required: true },
    keyset_url: { type: String, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// Compound unique index is important for LTI
PlatformSchema.index({ issuer: 1, client_id: 1 }, { unique: true });

// Check if model already exists to prevent overwrite in development HMR
const Platform: Model<IPlatform> =
  mongoose.models.Platform ||
  mongoose.model<IPlatform>("Platform", PlatformSchema);

export default Platform;
