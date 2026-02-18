import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAssessmentAssignment extends Document {
  assessmentId: string;
  assessmentTitle?: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  contextId: string;
  platformId: string; // Reference to Platform._id
  lineItemUrl?: string; // Stored AGS line item URL
  created_at: Date;
  updated_at: Date;
}

const AssessmentAssignmentSchema: Schema = new Schema(
  {
    assessmentId: { type: String, required: true },
    assessmentTitle: { type: String },
    studentId: { type: String, required: true },
    studentName: { type: String },
    studentEmail: { type: String },
    contextId: { type: String, required: true },
    platformId: {
      type: Schema.Types.ObjectId,
      ref: "Platform",
      required: true,
    },
    lineItemUrl: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

// Index to find assignments by assessmentId and contextId efficiently
AssessmentAssignmentSchema.index({ assessmentId: 1, contextId: 1 });
// Index to find assignments by studentEmail and assessmentId (for webhook)
AssessmentAssignmentSchema.index({ studentEmail: 1, assessmentId: 1 });

const AssessmentAssignment: Model<IAssessmentAssignment> =
  mongoose.models.AssessmentAssignment ||
  mongoose.model<IAssessmentAssignment>(
    "AssessmentAssignment",
    AssessmentAssignmentSchema,
  );

export default AssessmentAssignment;
