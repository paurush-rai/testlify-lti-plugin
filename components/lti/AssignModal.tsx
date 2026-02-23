import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Assessment, Student } from "@/types/lti";
import { assignStudents, getAssessmentId } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AssignModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly assessment: Assessment | null;
  readonly members: Student[];
  readonly membersLoading: boolean;
  readonly membersError: string | null;
  readonly onRetryMembers: () => void;
  readonly selectedStudents: string[];
  readonly onStudentToggle: (userId: string) => void;
  readonly onSelectAll: () => void;
  readonly onSubmit: () => void;
  readonly ltik: string | null;
}

export default function AssignModal({
  isOpen,
  onClose,
  assessment,
  members,
  membersLoading,
  membersError,
  onRetryMembers,
  selectedStudents,
  onStudentToggle,
  onSelectAll,
  onSubmit,
  ltik,
}: AssignModalProps) {
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!assessment) return;

    try {
      const selectedStudentObjects = members.filter((m) =>
        selectedStudents.includes(m.user_id),
      );

      const assessmentId = getAssessmentId(assessment);
      if (!assessmentId) {
        toast({
          title: "Error",
          description: "Assessment ID not found.",
          variant: "destructive",
        });
        return;
      }

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ltik}`,
      };

      const result = await assignStudents(
        assessmentId,
        assessment.assessmentTitle,
        selectedStudentObjects,
        headers,
      );

      toast({
        title: "Success",
        description: `Successfully assigned ${result.count} students!`,
      });
      onSubmit();
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to assign students: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const renderMembersList = () => {
    if (membersLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <p className="text-sm text-gray-500">Loading course members…</p>
        </div>
      );
    }

    if (membersError) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="h-5 w-5 text-red-500"
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
          <p className="text-sm font-medium text-gray-800">
            Could not load members
          </p>
          <p className="text-xs text-gray-500 max-w-xs">{membersError}</p>
          <Button variant="outline" size="sm" onClick={onRetryMembers}>
            Retry
          </Button>
        </div>
      );
    }

    if (members.length === 0) {
      return (
        <p className="text-center text-gray-500 py-8">
          No students found in this course.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-100 border border-gray-300">
          <Checkbox
            id="select-all"
            checked={
              selectedStudents.length === members.length && members.length > 0
            }
            onCheckedChange={onSelectAll}
          />
          <label
            htmlFor="select-all"
            className="flex-1 cursor-pointer font-medium text-gray-900"
          >
            Select All ({members.length} students)
          </label>
        </div>

        {members.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200"
          >
            <Checkbox
              id={`student-${member.user_id}`}
              checked={selectedStudents.includes(member.user_id)}
              onCheckedChange={() => onStudentToggle(member.user_id)}
            />
            <label
              htmlFor={`student-${member.user_id}`}
              className="flex-1 cursor-pointer"
            >
              <div className="font-medium text-gray-900">{member.name}</div>
              <div className="text-sm text-gray-500">{member.email}</div>
            </label>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Candidates</DialogTitle>
          <DialogDescription>
            Select students to assign to &quot;
            {assessment?.assessmentTitle || "this assessment"}&quot;
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto py-4">
          {renderMembersList()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0 || membersLoading}
          >
            Assign ({selectedStudents.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
