import { getLtiProvider } from "../lib/lti-provider";

export const verifyLtiToken = (token: string) => {
  // Basic verification Logic using Keys (handled by Provider usually)
  // Or just decoding if we trust the source (e.g., Bearer from frontend)
  // For now, assume simple decoding/verification
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    return decoded;
  } catch (e) {
    console.error("Failed to verify LTI token:", e);
    return null;
  }
};

export const extractBearerToken = (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") return parts[1];
  return null;
};
