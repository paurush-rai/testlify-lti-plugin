import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Assessment } from "@/types/lti";
import { getAssessmentId } from "@/lib/api";

interface Score {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  timestamp: string;
  activityProgress: string;
  gradingProgress: string;
}

interface ViewScoresModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly assessment: Assessment | null;
  readonly ltik: string | null;
}

export default function ViewScoresModal({
  isOpen,
  onClose,
  assessment,
  ltik,
}: ViewScoresModalProps) {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assessment && ltik) {
      fetchScores();
    } else {
      setScores([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, assessment, ltik]);

  const fetchScores = async () => {
    setLoading(true);
    setError(null);
    try {
      const assessmentId = getAssessmentId(assessment!);
      if (!assessmentId) throw new Error("Assessment ID not found");

      const res = await fetch(`/api/scores/${assessmentId}`, {
        headers: {
          Authorization: `Bearer ${ltik}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch scores: ${res.statusText}`);
      }

      const data = await res.json();
      setScores(data.scores || []);
    } catch (err: any) {
      setError(err.message || "Failed to load scores");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
        </div>
      );
    }

    if (scores.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="bg-gray-100 rounded-full h-12 w-12 mx-auto mb-3 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-gray-500"
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
          </div>
          <p className="font-medium text-gray-900">No scores found</p>
          <p className="text-sm text-gray-500 mt-1">
            Scores will appear here once students complete the assessment.
          </p>
        </div>
      );
    }

    return (
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>User ID</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Max</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scores.map((score, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{score.userId}</TableCell>
                <TableCell>
                  <span className="font-bold text-gray-900">
                    {score.scoreGiven}
                  </span>
                </TableCell>
                <TableCell>{score.scoreMaximum}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      score.activityProgress === "Completed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {score.activityProgress}
                  </span>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(score.timestamp).toLocaleDateString()}
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
          <DialogTitle>Assessment Scores</DialogTitle>
          <DialogDescription>
            Scores for "{assessment?.assessmentTitle || "Assessment"}" fetched
            from LMS.
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
