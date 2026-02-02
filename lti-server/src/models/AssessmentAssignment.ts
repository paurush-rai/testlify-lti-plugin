import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

// Define attributes interface
interface AssessmentAssignmentAttributes {
  id: number;
  assessmentId: string;
  assessmentTitle: string | null;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  contextId: string;
  platformId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define creation attributes (id is auto-generated)
interface AssessmentAssignmentCreationAttributes extends Optional<
  AssessmentAssignmentAttributes,
  "id"
> {}

// Define model class
class AssessmentAssignment
  extends Model<
    AssessmentAssignmentAttributes,
    AssessmentAssignmentCreationAttributes
  >
  implements AssessmentAssignmentAttributes
{
  public id!: number;
  public assessmentId!: string;
  public assessmentTitle!: string | null;
  public studentId!: string;
  public studentName!: string | null;
  public studentEmail!: string | null;
  public contextId!: string;
  public platformId!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize model
AssessmentAssignment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    assessmentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    assessmentTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    studentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    studentName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    studentEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contextId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    platformId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "assessment_assignments",
    timestamps: true,
  },
);

export default AssessmentAssignment;
