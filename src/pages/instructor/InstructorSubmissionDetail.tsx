import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface InstructorSubmissionSummary {
  submission_id: string;
  student_id: string;
  student_name: string | null;
  status: 'submitted' | 'finalised';
  submitted_at: string | null;
}

interface SubmissionQuestion {
  id: string;
  title: string;
  scenario_text: string;
  order_index: number;
  parts: Array<{
    id: string;
    label: string;
    sub_questions: Array<{
      id: string;
      prompt: string;
      max_marks: number;
      order_index: number;
      submission_answer_id: string | null;
      answer_text: string;
      grade: {
        marks_awarded: number | null;
        feedback: string | null;
      };
    }>;
  }>;
  artefacts: Array<{
    id: string;
    filename: string;
    file_type: string;
  }>;
}

interface InstructorSubmissionDetailResponse {
  submission_id: string;
  module_id: string;
  module_title: string;
  student_id: string;
  student_name: string | null;
  status: 'submitted' | 'finalised';
  submitted_at: string | null;
  questions: SubmissionQuestion[];
}

export default function InstructorSubmissionDetail() {
  const { moduleId, submissionId } = useParams<{ moduleId: string; submissionId: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<InstructorSubmissionDetailResponse | null>(null);
  const [submissions, setSubmissions] = useState<InstructorSubmissionSummary[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, { score: string; feedback: string; submission_answer_id: string | null; max_marks: number }>>({});
  const [gradeStatus, setGradeStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinalising, setIsFinalising] = useState(false);
  const saveTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const fetchSubmission = async () => {
    if (!moduleId || !submissionId) return;
    try {
      const [detailRes, listRes] = await Promise.all([
        fetch(`/api/instructor/modules/${moduleId}/submissions/${submissionId}`, {
          credentials: 'include',
        }),
        fetch(`/api/instructor/modules/${moduleId}/submissions`, {
          credentials: 'include',
        }),
      ]);

      if (!detailRes.ok) {
        const err = await detailRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load submission');
      }

      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load submissions list');
      }

      const detailData: InstructorSubmissionDetailResponse = await detailRes.json();
      const listData: InstructorSubmissionSummary[] = await listRes.json();

      setSubmission(detailData);
      setSubmissions(listData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchSubmission();
  }, [moduleId, submissionId]);

  const handleFinaliseGrades = async () => {
    if (!submission?.submission_id) return;
    setIsFinalising(true);
    try {
      const res = await fetch('/api/grades/finalise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ submission_id: submission.submission_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to finalise grades');
      }
      toast.success('Grades finalised');
      await fetchSubmission();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalise grades');
    } finally {
      setIsFinalising(false);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const gradesReadOnly = submission?.status === 'finalised';

  const scheduleSave = (subQuestionId: string) => {
    if (gradesReadOnly) return;
    if (saveTimeoutsRef.current[subQuestionId]) {
      clearTimeout(saveTimeoutsRef.current[subQuestionId]);
    }
    saveTimeoutsRef.current[subQuestionId] = setTimeout(() => {
      void saveGrade(subQuestionId);
    }, 800);
  };

  const saveGrade = async (subQuestionId: string) => {
    if (gradesReadOnly) return;
    const entry = gradeInputs[subQuestionId];
    if (!entry || !entry.submission_answer_id) return;
    if (entry.score === '') return;

    const scoreValue = Number(entry.score);
    if (Number.isNaN(scoreValue)) return;

    setGradeStatus((prev) => ({ ...prev, [subQuestionId]: 'saving' }));
    try {
      // API expects submission_answer_id / score; backend maps to DB answer_id / marks_awarded.
      const response = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          submission_answer_id: entry.submission_answer_id,
          score: scoreValue,
          feedback: entry.feedback || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save grade');
      }

      setGradeStatus((prev) => ({ ...prev, [subQuestionId]: 'saved' }));
      setTimeout(() => {
        setGradeStatus((prev) => ({ ...prev, [subQuestionId]: 'idle' }));
      }, 1500);
    } catch {
      setGradeStatus((prev) => ({ ...prev, [subQuestionId]: 'idle' }));
    }
  };

  useEffect(() => {
    if (!submission) return;
    const nextInputs: Record<string, { score: string; feedback: string; submission_answer_id: string | null; max_marks: number }> = {};
    submission.questions.forEach((q) => {
      q.parts.forEach((p) => {
        p.sub_questions.forEach((sq) => {
          nextInputs[sq.id] = {
            score: sq.grade.marks_awarded !== null ? String(sq.grade.marks_awarded) : '',
            feedback: sq.grade.feedback ?? '',
            submission_answer_id: sq.submission_answer_id ?? null,
            max_marks: sq.max_marks,
          };
        });
      });
    });
    setGradeInputs(nextInputs);
  }, [submission]);

  const orderedSubmissions = useMemo(() => submissions, [submissions]);
  const currentIndex = orderedSubmissions.findIndex((s) => s.submission_id === submissionId);
  const prevSubmission = currentIndex > 0 ? orderedSubmissions[currentIndex - 1] : null;
  const nextSubmission =
    currentIndex >= 0 && currentIndex < orderedSubmissions.length - 1
      ? orderedSubmissions[currentIndex + 1]
      : null;

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" asChild className="-ml-4 self-start">
            <Link to={`/instructor/modules/${moduleId}/submissions`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              disabled={!prevSubmission}
              onClick={() =>
                prevSubmission &&
                navigate(`/instructor/modules/${moduleId}/submissions/${prevSubmission.submission_id}`)
              }
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!nextSubmission}
              onClick={() =>
                nextSubmission &&
                navigate(`/instructor/modules/${moduleId}/submissions/${nextSubmission.submission_id}`)
              }
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Submission Review</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Read-only view of student submission</p>
      </div>

      {error ? (
        <div className="py-6 text-center text-muted-foreground">{error}</div>
      ) : !submission ? (
        <div className="py-6 text-center text-muted-foreground">Submission not found.</div>
      ) : (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Submission Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Student</div>
                  <div className="text-base font-medium">
                    {submission.student_name || submission.student_id}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="text-base font-medium capitalize">
                    {submission.status === 'finalised' ? 'Finalised' : submission.status}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="text-base font-medium">{formatDate(submission.submitted_at)}</div>
                </div>
              </div>
              {submission.status === 'submitted' && (
                <div className="mt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                        disabled={isFinalising}
                      >
                        {isFinalising ? 'Finalising...' : 'Finalize Grades'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Finalize grades</AlertDialogTitle>
                        <AlertDialogDescription>
                          Grades cannot be changed after finalisation. This action is irreversible.
                          Are you sure you want to finalise grades for this submission?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isFinalising}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleFinaliseGrades}
                          disabled={isFinalising}
                          className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                        >
                          {isFinalising ? 'Finalising...' : 'Finalize'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CardContent>
          </Card>

          {submission.questions.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-xl">{question.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-black dark:text-white uppercase tracking-wide">
                    Scenario
                  </h2>
                  <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {question.scenario_text}
                  </p>
                </div>

                {question.artefacts.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 text-black dark:text-white uppercase tracking-wide">
                      Artefacts
                    </h2>
                    <div className="space-y-2">
                      {question.artefacts.map((artefact) => (
                        <div
                          key={artefact.id}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <div className="text-sm font-medium">{artefact.filename}</div>
                            <div className="text-xs text-muted-foreground">{artefact.file_type}</div>
                          </div>
                          <a
                            href={`/api/artefacts/${artefact.id}/download`}
                            className="text-sm font-medium text-foreground hover:text-[#d9f56b]"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['A', 'B'].map((label) => {
                  const part = question.parts.find((p) => p.label === label);
                  if (!part || part.sub_questions.length === 0) return null;

                  return (
                    <div key={label} className="space-y-4">
                      <h2 className="text-lg font-semibold text-black dark:text-white uppercase tracking-wide">
                        Part {label}
                      </h2>
                      {part.sub_questions
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((sq) => (
                          <div key={sq.id} className="space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="text-sm font-medium text-foreground/80">
                                {sq.prompt}
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {sq.max_marks} marks
                              </div>
                            </div>
                            <div className="rounded-md border bg-muted/20 p-4 text-sm text-foreground whitespace-pre-wrap">
                              {sq.answer_text || '-'}
                            </div>
                            <div className="flex gap-4 pt-2 items-start">
                              <div className="space-y-2 w-[30%]">
                                <div className="text-sm font-medium text-muted-foreground">Marks</div>
                                <input
                                  type="number"
                                  min={0}
                                  max={sq.max_marks}
                                  value={gradeInputs[sq.id]?.score ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setGradeInputs((prev) => ({
                                      ...prev,
                                      [sq.id]: {
                                        ...(prev[sq.id] || {
                                          submission_answer_id: sq.submission_answer_id ?? null,
                                          feedback: '',
                                          max_marks: sq.max_marks,
                                        }),
                                        score: value,
                                      },
                                    }));
                                    scheduleSave(sq.id);
                                  }}
                                  disabled={
                                    !gradeInputs[sq.id]?.submission_answer_id ||
                                    gradeStatus[sq.id] === 'saving' ||
                                    gradesReadOnly
                                  }
                                  className="w-full h-[45px] rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-[#d9f56b]/20"
                                />
                                <div className="text-xs text-muted-foreground">
                                  Max {sq.max_marks}
                                </div>
                              </div>
                              <div className="space-y-2 w-[70%]">
                                <div className="text-sm font-medium text-muted-foreground">Feedback</div>
                                <textarea
                                  value={gradeInputs[sq.id]?.feedback ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setGradeInputs((prev) => ({
                                      ...prev,
                                      [sq.id]: {
                                        ...(prev[sq.id] || {
                                          submission_answer_id: sq.submission_answer_id ?? null,
                                          score: '',
                                          max_marks: sq.max_marks,
                                        }),
                                        feedback: value,
                                      },
                                    }));
                                    scheduleSave(sq.id);
                                  }}
                                  disabled={
                                    !gradeInputs[sq.id]?.submission_answer_id ||
                                    gradeStatus[sq.id] === 'saving' ||
                                    gradesReadOnly
                                  }
                                  className="h-[45px] w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-[#d9f56b]/20 resize-y"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {gradeStatus[sq.id] === 'saving'
                                ? 'Saving...'
                                : gradeStatus[sq.id] === 'saved'
                                ? 'Saved'
                                : ''}
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
