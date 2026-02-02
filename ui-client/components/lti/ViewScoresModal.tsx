import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Assessment, Candidate } from "@/types/lti";
import { Badge } from "@/components/ui/badge";

interface ViewScoresModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly assessment: Assessment | null;
  readonly candidates: Candidate[];
  readonly loading: boolean;
}

export default function ViewScoresModal({
  isOpen,
  onClose,
  assessment,
  candidates,
  loading,
}: ViewScoresModalProps) {
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "invited":
        return <Badge className="bg-blue-100 text-blue-800">Invited</Badge>;
      case "started":
        return <Badge className="bg-yellow-100 text-yellow-800">Started</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
        </div>
      );
    }

    if (candidates.length === 0) {
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="font-medium text-gray-900">No candidates found</p>
          <p className="text-sm text-gray-500 mt-1">
            Scores will appear here once students take the assessment.
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate, index) => (
              <TableRow key={candidate._id || index}>
                <TableCell className="font-medium">
                  {candidate.firstName} {candidate.lastName}
                </TableCell>
                <TableCell>{candidate.email}</TableCell>
                <TableCell>
                  {getStatusBadge(candidate.candidateStatus)}
                </TableCell>
                <TableCell className="text-right">
                  {candidate.grade !== undefined && candidate.grade !== null
                    ? `${candidate.grade}%`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Student Scores</DialogTitle>
          <DialogDescription>
            Scores for "{assessment?.assessmentTitle || "this assessment"}"
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[500px] overflow-y-auto py-4">
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
