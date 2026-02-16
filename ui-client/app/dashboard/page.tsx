"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/lti/Header";
import AssessmentsTable from "@/components/lti/AssessmentsTable";
import AssignModal from "@/components/lti/AssignModal";
import ViewAssignedModal from "@/components/lti/ViewAssignedModal";
import {
  fetchUserData,
  fetchAssessments,
  fetchMembers,
  fetchAssignedStudents,
  getAssessmentId,
} from "@/lib/api";
import type { User, Assessment, Student } from "@/types/lti";

export default function LtiApp() {
  const [user, setUser] = useState<User | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [members, setMembers] = useState<Student[]>([]);
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

        const [userData, assessmentsData, membersData] = await Promise.all([
          fetchUserData(headers),
          fetchAssessments(headers),
          fetchMembers(headers),
        ]);

        setUser(userData);
        setAssessments(assessmentsData);
        setMembers(membersData);
      } catch (err: any) {
        setError(err.message || "Failed to load LTI session.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [ltik]);

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
              console.error("Failed to fetch assigned students:", err);
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
