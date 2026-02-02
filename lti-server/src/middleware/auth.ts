import { Request, Response, NextFunction } from "express";

// Middleware: Extract Bearer Token for LTIaaS mode
export const extractBearerToken = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    (req as any).token = token; // Make it available where ltijs expects it
    req.query.ltik = token; // Also put in query just in case
  }
  next();
};
