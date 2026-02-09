import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

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
      answer_text: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubmission() {
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
    }

    fetchSubmission();
  }, [moduleId, submissionId]);

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
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" asChild className="-ml-4">
            <Link to={`/instructor/modules/${moduleId}/submissions`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Submissions
            </Link>
          </Button>
          <div className="flex items-center gap-2">
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
        <h1 className="mt-4 text-3xl font-bold">Submission Review</h1>
        <p className="mt-2 text-muted-foreground">Read-only view of student submission</p>
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
                  <div className="text-base font-medium capitalize">{submission.status}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="text-base font-medium">{formatDate(submission.submitted_at)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {submission.questions.map((question) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-xl">{question.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-[#d9f56b] uppercase tracking-wide">
                    Scenario
                  </h2>
                  <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {question.scenario_text}
                  </p>
                </div>

                {question.artefacts.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold mb-3 text-[#d9f56b] uppercase tracking-wide">
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
                      <h2 className="text-lg font-semibold text-[#d9f56b] uppercase tracking-wide">
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
