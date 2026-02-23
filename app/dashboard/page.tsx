"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/lti/Header";
import AssessmentsTable from "@/components/lti/AssessmentsTable";
import AssignModal from "@/components/lti/AssignModal";
import ViewAssignedModal from "@/components/lti/ViewAssignedModal";
import TokenSetupCard from "@/components/lti/TokenSetupCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchUserData,
  fetchAssessments,
  fetchGroups,
  fetchAssignedStudents,
  getAssessmentId,
  TokenError,
} from "@/lib/api";
import type { User, Assessment, AssessmentGroup, Student } from "@/types/lti";

const INSTRUCTOR_ROLES = ["Instructor", "Administrator"];

function userIsInstructor(roles: string[]): boolean {
  return roles.some((r) =>
    INSTRUCTOR_ROLES.some((ir) => r.includes(ir)),
  );
}

export default function LtiApp() {
  const [user, setUser] = useState<User | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [groups, setGroups] = useState<AssessmentGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");
  const [members, setMembers] = useState<Student[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [error, setError] = useState("");

  // Token setup state
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isViewAssignedModalOpen, setIsViewAssignedModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] =
    useState<Assessment | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Student[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const searchParams = useSearchParams();
  const ltik = searchParams.get("ltik");

  const loadAssessments = useCallback(
    async (group: string, headers: HeadersInit) => {
      setAssessmentsLoading(true);
      try {
        const groupFilter =
          group && group !== "__all__" ? group : undefined;
        const data = await fetchAssessments(headers, groupFilter);
        setAssessments(data);
      } finally {
        setAssessmentsLoading(false);
      }
    },
    [],
  );

  // Fetch members separately so a NRPS failure doesn't break the whole page.
  const loadMembers = useCallback(
    async (role?: string) => {
      if (!ltik) return;
      setMembersLoading(true);
      setMembersError(null);
      try {
        const url = role
          ? `/api/members?role=${encodeURIComponent(role)}`
          : "/api/members";
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ltik}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details || data.error || `HTTP ${res.status}`);
        }
        setMembers(data.members || []);
      } catch (err: any) {
        setMembersError(err.message || "Failed to load course members.");
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [ltik],
  );

  useEffect(() => {
    if (!ltik) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ltik}`,
        };

        // Check token status first so we know whether to fetch the full data
        const tokenRes = await fetch("/api/token", { headers });
        const tokenData = await tokenRes.json();
        const hasToken = tokenData.configured === true;
        setTokenConfigured(hasToken);

        if (!hasToken) {
          // Token not set — fetch only user data so we know the role
          const userData = await fetchUserData(headers);
          setUser(userData);
          return;
        }

        const [userData, assessmentsData, groupsData] = await Promise.all([
          fetchUserData(headers),
          fetchAssessments(headers),
          fetchGroups(headers),
        ]);
        setUser(userData);
        setAssessments(assessmentsData);
        setGroups(groupsData);
        setGroupsLoading(false);
      } catch (err: any) {
        if (err instanceof TokenError) {
          // Token missing or rejected by Testlify — fall back to setup card
          setTokenConfigured(false);
        } else {
          setError(err.message || "Failed to load LTI session.");
        }
        setGroupsLoading(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Members are non-critical; load them in parallel without blocking the page
    loadMembers();
  }, [ltik, loadMembers, loadAssessments]);

  // Refetch assessments when selected group changes (skip on initial mount)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    if (!ltik || !tokenConfigured) return;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ltik}`,
    };
    loadAssessments(selectedGroup, headers);
  }, [selectedGroup, ltik, loadAssessments, tokenConfigured]);

  // Called after instructor saves the token — reload full data
  const handleTokenSaved = async () => {
    if (!ltik) return;
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ltik}`,
      };
      const [assessmentsData, groupsData] = await Promise.all([
        fetchAssessments(headers),
        fetchGroups(headers),
      ]);
      setAssessments(assessmentsData);
      setGroups(groupsData);
      setGroupsLoading(false);
      setTokenConfigured(true);
    } catch (err: any) {
      if (err instanceof TokenError) {
        // Token was rejected by Testlify — keep setup card open so user can retry
        setTokenConfigured(false);
      } else {
        setError(err.message || "Failed to load assessments.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-red-200 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Connection Error
          </h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const isInstructor = userIsInstructor(user?.roles ?? []);

  // Token not yet configured — show setup card instead of the table
  if (tokenConfigured === false) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header user={user} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TokenSetupCard
            ltik={ltik!}
            onTokenSaved={handleTokenSaved}
            isInstructor={isInstructor}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Assessments{" "}
            <span className="text-lg font-normal text-gray-500">
              ({assessments.length} assessments)
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Select
              value={selectedGroup}
              onValueChange={setSelectedGroup}
              disabled={groupsLoading || assessmentsLoading}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group.groupName}>
                    {group.groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AssessmentsTable
          assessments={assessments}
          loading={assessmentsLoading}
          ltik={ltik}
          onAssignClick={(assessment) => {
            setSelectedAssessment(assessment);
            setSelectedStudents([]);
            setIsAssignModalOpen(true);
            // Re-fetch members every time the modal opens to get fresh data
            if (members.length === 0 || membersError) {
              loadMembers();
            }
          }}
          onViewAssigned={async (assessment) => {
            setSelectedAssessment(assessment);
            setIsViewAssignedModalOpen(true);
            setAssignedStudents([]);
            setLoadingAssigned(true);

            try {
              const assessmentId = getAssessmentId(assessment);
              if (assessmentId && ltik) {
                const headers = {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${ltik}`,
                };
                const students = await fetchAssignedStudents(
                  assessmentId,
                  headers,
                );
                setAssignedStudents(students);
              }
            } catch (err) {
            } finally {
              setLoadingAssigned(false);
            }
          }}
        />
      </main>

      <AssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        assessment={selectedAssessment}
        members={members}
        membersLoading={membersLoading}
        membersError={membersError}
        onRetryMembers={() => loadMembers()}
        selectedStudents={selectedStudents}
        onStudentToggle={(userId) => {
          setSelectedStudents((prev) =>
            prev.includes(userId)
              ? prev.filter((id) => id !== userId)
              : [...prev, userId],
          );
        }}
        onSelectAll={() => {
          setSelectedStudents(
            selectedStudents.length === members.length
              ? []
              : members.map((m) => m.user_id),
          );
        }}
        onSubmit={() => {
          setIsAssignModalOpen(false);
          setSelectedStudents([]);
          setSelectedAssessment(null);
        }}
        ltik={ltik}
      />

      <ViewAssignedModal
        isOpen={isViewAssignedModalOpen}
        onClose={() => setIsViewAssignedModalOpen(false)}
        assessment={selectedAssessment}
        students={assignedStudents}
        loading={loadingAssigned}
      />
    </div>
  );
}
