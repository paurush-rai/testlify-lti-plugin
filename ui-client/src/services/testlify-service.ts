const TESTLIFY_API_URL =
  process.env.TESTLIFY_API_URL || "https://api.testlify.com";

export const fetchAssessments = async (apiToken: string) => {
  // Build query parameters matching Testlify API
  const params = new URLSearchParams({
    limit: "50",
    skip: "0",
    query: "",
    colName: "created",
    inOrder: "desc",
    isArchived: "false",
    isEditable: "false",
    isActive: "false",
    isDraft: "false",
    workspaceLabelTitle: "",
    groupName: "",
    questionType: "",
    testLibraryId: "",
    from: "",
    to: "",
    interviewAssessmentId: "",
  });

  const res = await fetch(
    `${TESTLIFY_API_URL}/v1/assessment?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "production-testing": "false",
      },
    },
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(
      `Failed to fetch assessments (${res.status}): ${errorText}`,
    );
  }

  return res.json();
};

export const inviteCandidates = async (
  apiToken: string,
  assessmentId: string,
  candidates: any[],
) => {
  const res = await fetch(
    `${TESTLIFY_API_URL}/assessments/${assessmentId}/invite`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ candidates }),
    },
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(
      `Failed to invite candidates (${res.status}): ${errorText}`,
    );
  }

  return res.json();
};
