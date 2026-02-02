import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Assessment } from "@/types/lti";
import { inviteCandidates, getAssessmentId } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AssessmentsTableProps {
  readonly assessments: Assessment[];
  readonly ltik: string | null;
  readonly onAssignClick: (assessment: Assessment) => void;
  readonly onViewAssigned: (assessment: Assessment) => void;
  readonly onViewScores: (assessment: Assessment) => void;
}

export default function AssessmentsTable({
  assessments,
  ltik,
  onAssignClick,
  onViewAssigned,
  onViewScores,
}: AssessmentsTableProps) {
  const { toast } = useToast();
  const [assessmentToInvite, setAssessmentToInvite] =
    useState<Assessment | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleInviteClick = (assessment: Assessment) => {
    setAssessmentToInvite(assessment);
  };

  const confirmInvite = async () => {
    if (!assessmentToInvite) return;

    try {
      const assessmentId = getAssessmentId(assessmentToInvite);

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

      const result = await inviteCandidates(assessmentId, headers);
      toast({
        title: "Success",
        description: `Successfully sent invites to ${result.invitedCount} students!`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: `Failed to send invites: ${err.message}`,
        variant: "destructive",
      });
    } finally {
      setAssessmentToInvite(null);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-medium text-gray-700">NAME</TableHead>
              <TableHead className="font-medium text-gray-700">
                TOTAL INVITED
              </TableHead>
              <TableHead className="font-medium text-gray-700">
                CREATED ON
              </TableHead>
              <TableHead className="font-medium text-gray-700">
                CREATED BY
              </TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assessments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <svg
                      className="h-12 w-12 text-gray-400 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="font-medium text-gray-900">
                      No assessments found
                    </p>
                    <p className="text-sm mt-1">
                      Create a new assessment on Testlify platform to get
                      started.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assessments.map((assessment, index) => (
                <TableRow
                  key={getAssessmentId(assessment) || index}
                  className="hover:bg-gray-50"
                >
                  <TableCell className="font-medium text-gray-900">
                    {assessment.assessmentTitle || "Untitled Assessment"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {assessment.totalInvited || 0}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {assessment.created ? formatDate(assessment.created) : "-"}
                  </TableCell>
                  <TableCell className="text-gray-900">
                    {assessment.createdBy || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <svg
                              className="h-5 w-5 text-gray-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleInviteClick(assessment)}
                          >
                            Invite candidates
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onAssignClick(assessment)}
                          >
                            Assign candidates
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onViewAssigned(assessment)}
                          >
                            View assigned students
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onViewScores(assessment)}
                          >
                            View student scores
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog
        open={!!assessmentToInvite}
        onOpenChange={(open) => !open && setAssessmentToInvite(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send invite emails to all assigned students for "
              {assessmentToInvite?.assessmentTitle || "this assessment"}". This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmInvite}>
              Yes, send invites
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
