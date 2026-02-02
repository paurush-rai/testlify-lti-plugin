import { Request, Response } from "express";
import {
  getMe,
  getAssessments,
  getMembers,
  createAssignment,
  getAssignments,
  inviteCandidates,
  getCandidates,
  submitScore,
} from "../controllers/apiController";

const setupRoutes = (lti: any): void => {
  lti.app.get("/api/me", getMe);
  lti.app.get("/api/assessments", getAssessments);
  lti.app.get("/api/members", getMembers(lti));
  lti.app.post("/api/assignments", createAssignment(lti));
  lti.app.get("/api/assignments/:assessmentId", getAssignments);
  lti.app.post("/api/invite-candidates", inviteCandidates);
  lti.app.get("/api/assessments/:assessmentId/candidates", getCandidates(lti));

  lti.app.post("/api/score", submitScore(lti));

  lti.app.post("/lti/deeplink", async (_req: Request, res: Response) => {
    return res.sendStatus(200);
  });
};

export default setupRoutes;
