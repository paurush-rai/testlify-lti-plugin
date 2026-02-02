import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Assessment, Student } from "@/types/lti";

interface ViewAssignedModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly assessment: Assessment | null;
  readonly students: Student[];
  readonly loading: boolean;
}

export default function ViewAssignedModal({
  isOpen,
  onClose,
  assessment,
  students,
  loading,
}: ViewAssignedModalProps) {
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        </div>
      );
    }

    if (students.length === 0) {
      return (
        <div className="text-center py-8">
          <svg
            className="h-12 w-12 text-gray-400 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="font-medium text-gray-900">No students assigned</p>
          <p className="text-sm text-gray-500 mt-1">
            Use "Assign candidates" to assign students to this assessment.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {students.map((student, index) => (
          <div
            key={student.user_id || index}
            className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200"
          >
            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
              {student.name?.charAt(0).toUpperCase() || "S"}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{student.name}</div>
              <div className="text-sm text-gray-500">{student.email}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assigned Students</DialogTitle>
          <DialogDescription>
            Students assigned to "
            {assessment?.assessmentTitle || "this assessment"}"
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto py-4">
          {renderContent()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
