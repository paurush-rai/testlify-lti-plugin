import { Request, Response } from "express";
import {
  getMe,
  getAssessments,
  getMembers,
  createAssignment,
  getAssignments,
  inviteCandidates,
  getScores,
} from "../controllers/apiController";
import { submitScore } from "../controllers/webhookController";

const setupRoutes = (lti: any): void => {
  // API Endpoints for UI
  lti.app.get("/api/me", getMe);
  lti.app.get("/api/assessments", getAssessments);
  lti.app.get("/api/members", getMembers(lti));
  lti.app.post("/api/assignments", createAssignment);
  lti.app.get("/api/assignments/:assessmentId", getAssignments);
  lti.app.post("/api/invite-candidates", inviteCandidates);
  lti.app.get("/api/scores/:assessmentId", getScores(lti));
  // Webhook for score submission
  lti.app.post("/api/webhook/score", submitScore);

  // Deep Linking Route
  lti.app.post("/lti/deeplink", async (_req: Request, res: Response) => {
    return res.sendStatus(200);
  });
};

export default setupRoutes;
