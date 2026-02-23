"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/lti/Header";
import AssessmentsTable from "@/components/lti/AssessmentsTable";
import AssignModal from "@/components/lti/AssignModal";
import ViewAssignedModal from "@/components/lti/ViewAssignedModal";
import {
  fetchUserData,
  fetchAssessments,
  fetchAssignedStudents,
  getAssessmentId,
} from "@/lib/api";
import type { User, Assessment, Student } from "@/types/lti";

export default function LtiApp() {
  const [user, setUser] = useState<User | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [members, setMembers] = useState<Student[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isViewAssignedModalOpen, setIsViewAssignedModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] =
    useState<Assessment | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [assignedStudents, setAssignedStudents] = useState<Student[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const searchParams = useSearchParams();
  const ltik = searchParams.get("ltik");

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

        const [userData, assessmentsData] = await Promise.all([
          fetchUserData(headers),
          fetchAssessments(headers),
        ]);

        setUser(userData);
        setAssessments(assessmentsData);
      } catch (err: any) {
        setError(err.message || "Failed to load LTI session.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
    // Members are non-critical; load them in parallel without blocking the page
    loadMembers();
  }, [ltik, loadMembers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">
            Assessments{" "}
            <span className="text-lg font-normal text-gray-500">
              ({assessments.length} assessments)
            </span>
          </h2>
        </div>

        <AssessmentsTable
          assessments={assessments}
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
