import {
  getAssessmentAssignmentModel,
  AssessmentAssignmentAttributes,
} from "../models/AssessmentAssignment";

export const getAssignments = async (
  assessmentId: string,
  contextId: string,
) => {
  const AssessmentAssignment = await getAssessmentAssignmentModel();
  return await AssessmentAssignment.findAll({
    where: { assessmentId, contextId },
    order: [["createdAt", "DESC"]],
  });
};

export const createAssignments = async (
  assignments: AssessmentAssignmentAttributes[],
) => {
  const AssessmentAssignment = await getAssessmentAssignmentModel();
  if (assignments.length === 0) return;

  // Assuming assignments belong to same assessment/context, clear old ones first?
  // Logic from previous implementation: destroy where assessmentId & contextId match typical usage
  const first = assignments[0];
  if (first.assessmentId && first.contextId) {
    await AssessmentAssignment.destroy({
      where: {
        assessmentId: first.assessmentId,
        contextId: first.contextId,
      },
    });
  }

  return await AssessmentAssignment.bulkCreate(assignments);
};
