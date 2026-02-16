import { DataTypes, Model, Sequelize } from "sequelize";
import { getLtiProvider } from "../lib/lti-provider";

export interface AssessmentAssignmentAttributes {
  id?: number;
  studentEmail: string;
  assessmentId: string;
  studentId?: string;
  studentName?: string;
  platformId?: string;
  lineItemUrl?: string;
  assessmentTitle?: string;
  contextId?: string;
  resourceLinkId?: string;
  status?: string;
  score?: number;
  maxScore?: number;
}

export class AssessmentAssignment
  extends Model<AssessmentAssignmentAttributes>
  implements AssessmentAssignmentAttributes
{
  public id!: number;
  public studentEmail!: string;
  public assessmentId!: string;
  public studentId!: string;
  public studentName!: string;
  public platformId!: string;
  public lineItemUrl!: string;
  public assessmentTitle!: string;
  public contextId!: string;
  public resourceLinkId!: string;
  public status!: string;
  public score!: number;
  public maxScore!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

let initialized = false;

export const getAssessmentAssignmentModel = async () => {
  const provider = await getLtiProvider();
  // Access the Sequelize instance from ltijs-sequelize plugin
  // @ts-ignore
  const sequelize = provider.Database.plugin.sequelize as Sequelize;

  if (!initialized) {
    AssessmentAssignment.init(
      {
        studentEmail: { type: DataTypes.STRING, allowNull: false },
        assessmentId: { type: DataTypes.STRING, allowNull: false },
        studentId: { type: DataTypes.STRING },
        studentName: { type: DataTypes.STRING },
        platformId: { type: DataTypes.STRING },
        lineItemUrl: { type: DataTypes.STRING },
        assessmentTitle: { type: DataTypes.STRING },
        contextId: { type: DataTypes.STRING },
        resourceLinkId: { type: DataTypes.STRING },
        status: { type: DataTypes.STRING, defaultValue: "pending" },
        score: { type: DataTypes.FLOAT },
        maxScore: { type: DataTypes.FLOAT },
      },
      {
        sequelize,
        modelName: "AssessmentAssignment",
        tableName: "assessment_assignments",
        timestamps: true,
      },
    );

    // await AssessmentAssignment.sync({ alter: true }); // Sync in dev?
    initialized = true;
  }

  return AssessmentAssignment;
};
