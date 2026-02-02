import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface AssessmentLineItemAttributes {
  id: number;
  assessmentId: string;
  contextId: string;
  lineItemId: string;
  lineItemUrl: string;
  iss: string;
  clientId: string;
  deploymentId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AssessmentLineItemCreationAttributes extends Optional<
  AssessmentLineItemAttributes,
  "id"
> {}

class AssessmentLineItem
  extends Model<
    AssessmentLineItemAttributes,
    AssessmentLineItemCreationAttributes
  >
  implements AssessmentLineItemAttributes
{
  public id!: number;
  public assessmentId!: string;
  public contextId!: string;
  public lineItemId!: string;
  public lineItemUrl!: string;
  public iss!: string;
  public clientId!: string;
  public deploymentId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssessmentLineItem.init(
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
    contextId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lineItemId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lineItemUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    iss: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deploymentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "assessment_line_items",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["assessmentId", "contextId"],
      },
    ],
  },
);

export default AssessmentLineItem;
