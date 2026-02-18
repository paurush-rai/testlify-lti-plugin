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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Candidates</DialogTitle>
          <DialogDescription>
            Select students to assign to "
            {assessment?.assessmentTitle || "this assessment"}"
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto py-4">
          {members.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No students found in this course.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-100 border border-gray-300">
                <Checkbox
                  id="select-all"
                  checked={
                    selectedStudents.length === members.length &&
                    members.length > 0
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
                    <div className="font-medium text-gray-900">
                      {member.name}
                    </div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0}
          >
            Assign ({selectedStudents.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
