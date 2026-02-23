import type { User, Assessment, AssessmentGroup, Student } from "@/types/lti";

export async function fetchUserData(headers: HeadersInit): Promise<User> {
  const response = await fetch("/api/me", { headers });
  if (!response.ok) throw new Error("Unauthorized or session expired");
  return response.json();
}

export class TokenError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "TokenError";
  }
}

export async function fetchAssessments(
  headers: HeadersInit,
  group?: string,
): Promise<Assessment[]> {
  const url = group
    ? `/api/assessments?group=${encodeURIComponent(group)}`
    : "/api/assessments";
  const response = await fetch(url, { headers });
  if (!response.ok) {
    // Propagate token errors so the dashboard can react (show setup card)
    if (response.status === 422) {
      const data = await response.json().catch(() => ({}));
      if (data.code === "TOKEN_MISSING" || data.code === "TOKEN_INVALID") {
        throw new TokenError(data.code, data.error);
      }
    }
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
}

export async function fetchGroups(
  headers: HeadersInit,
): Promise<AssessmentGroup[]> {
  const response = await fetch("/api/groups", { headers });
  if (!response.ok) {
    if (response.status === 422) {
      const data = await response.json().catch(() => ({}));
      if (data.code === "TOKEN_MISSING" || data.code === "TOKEN_INVALID") {
        throw new TokenError(data.code, data.error);
      }
    }
    return [];
  }

  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.groups)) return data.groups;
  if (data.data && Array.isArray(data.data.groups)) return data.data.groups;
  return [];
}

export async function fetchMembers(
  headers: HeadersInit,
  role?: string,
): Promise<Student[]> {
  const url = role
    ? `/api/members?role=${encodeURIComponent(role)}`
    : "/api/members";
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.members || [];
}

export async function assignStudents(
  assessmentId: string,
  assessmentTitle: string,
  students: Student[],
  headers: HeadersInit,
): Promise<{ success: boolean; count: number }> {
  const response = await fetch("/api/assignments", {
    method: "POST",
    headers,
    body: JSON.stringify({
      assessmentId,
      assessmentTitle,
      students,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to assign students");
  }

  return response.json();
}

export async function fetchAssignedStudents(
  assessmentId: string,
  headers: HeadersInit,
): Promise<Student[]> {
  const response = await fetch(`/api/assignments/${assessmentId}`, { headers });

  if (!response.ok) {
    throw new Error("Failed to fetch assigned students");
  }

  const data = await response.json();
  return data.students || [];
}

export async function inviteCandidates(
  assessmentId: string,
  headers: HeadersInit,
): Promise<{ success: boolean; invitedCount: number }> {
  const response = await fetch("/api/invite-candidates", {
    method: "POST",
    headers,
    body: JSON.stringify({ assessmentId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to send invites");
  }

  return response.json();
}

export function getAssessmentId(assessment: Assessment): string | null {
  return assessment._id || assessment.id || assessment.assessmentId || null;
}
