import type { User, Assessment, Student, Candidate } from "@/types/lti";

export async function fetchUserData(headers: HeadersInit): Promise<User> {
  const response = await fetch("/api/me", { headers });
  if (!response.ok) throw new Error("Unauthorized or session expired");
  return response.json();
}

export async function fetchAssessments(
  headers: HeadersInit,
): Promise<Assessment[]> {
  const response = await fetch("/api/assessments", { headers });
  if (!response.ok) {
    console.warn("Failed to fetch assessments");
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
}

export async function fetchMembers(headers: HeadersInit): Promise<Student[]> {
  const response = await fetch("/api/members", { headers });
  if (!response.ok) {
    console.warn("Failed to fetch members");
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

export async function fetchCandidates(
  assessmentId: string,
  headers: HeadersInit,
): Promise<Candidate[]> {
  const response = await fetch(`/api/assessments/${assessmentId}/candidates`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch candidates");
  }

  const data = await response.json();
  // The API returns data in a 'data' array
  return Array.isArray(data.data) ? data.data : [];
}

export function getAssessmentId(assessment: Assessment): string | null {
  return assessment._id || assessment.id || assessment.assessmentId || null;
}
