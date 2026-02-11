import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, FileText, Download, AlertCircle, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface SubQuestion {
  id: string;
  prompt: string;
  max_marks: number;
  order_index: number;
  part_id: string;
}

interface Part {
  id: string;
  label: string;
  sub_questions: SubQuestion[];
}

interface Artefact {
  id: string;
  filename: string;
  file_type: string;
}

interface QuestionDetail {
  id: string;
  title: string;
  scenario_text: string;
  parts: Part[];
  artefacts: Artefact[];
}

export default function StudentQuestionView() {
  const { moduleId, questionId } = useParams<{ moduleId: string; questionId: string }>();
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, { marks_awarded: number | null; feedback: string | null }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted' | 'finalised' | 'graded' | null>(null);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!moduleId || !questionId) return;

      try {
        const questionResponse = await fetch(`/api/student/modules/${moduleId}/questions/${questionId}`, {
          credentials: 'include',
        });

        if (!questionResponse.ok) {
          if (questionResponse.status === 403) throw new Error('You do not have access to this question');
          if (questionResponse.status === 404) throw new Error('Question not found');
          throw new Error('Failed to load question');
        }

        const questionData = await questionResponse.json();
        setQuestion(questionData);

        const answersResponse = await fetch(`/api/answers?questionId=${questionId}`, {
          credentials: 'include',
        });

        if (answersResponse.ok) {
          const answersData = await answersResponse.json();
          const answerMap: Record<string, string> = {};
          const gradesMap: Record<string, { marks_awarded: number | null; feedback: string | null }> = {};
          (answersData.answers || []).forEach((answer: {
            sub_question_id: string;
            answer_text: string;
            grade?: { marks_awarded: number | null; feedback: string | null };
          }) => {
            answerMap[answer.sub_question_id] = answer.answer_text;
            if (answer.grade !== undefined) {
              gradesMap[answer.sub_question_id] = answer.grade;
            }
          });
          setAnswers(answerMap);
          setGrades(gradesMap);
        } else {
          const errBody = await answersResponse.json().catch(() => ({}));
          const detail = (errBody as { detail?: string }).detail;
          throw new Error(detail || `Failed to load answers (${answersResponse.status})`);
        }

        const submissionResponse = await fetch(`/api/submissions/status?moduleId=${moduleId}`, {
          credentials: 'include',
        });

        if (submissionResponse.ok) {
          const submissionData = await submissionResponse.json();
          setSubmissionStatus(submissionData.status);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load question';
        setError(message);
        toast(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [moduleId, questionId]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const saveAnswer = async (subQuestionId: string, answerText: string) => {
    if (isReadOnly) return;
    try {
      setSaveStatus('saving');
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sub_question_id: subQuestionId, answer_text: answerText }),
      });
      if (!response.ok) throw new Error('Failed to save answer');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      toast('Failed to save answer');
      setSaveStatus('idle');
    }
  };

  const handleAnswerChange = (subQuestionId: string, value: string) => {
    if (isReadOnly) return;
    setAnswers(prev => ({ ...prev, [subQuestionId]: value }));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveAnswer(subQuestionId, value), 800);
  };

  const handleManualSave = async () => {
    if (isReadOnly) return;
    setIsManuallySaving(true);
    try {
      await Promise.all(
        Object.entries(answers).map(([subQuestionId, answer]) => saveAnswer(subQuestionId, answer))
      );
      toast.success('All answers saved successfully');
    } catch {
      toast.error('Failed to save answers');
    } finally {
      setIsManuallySaving(false);
    }
  };

  const isReadOnly = submissionStatus !== null && submissionStatus !== 'draft';
  const showGrades = submissionStatus === 'finalised';

  // 6A-3 Read-only enforcement: when submitted/finalised — no autosave, no POST, answers/grades display-only; page stable on refresh (data refetched on mount).

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-8 h-12 w-full max-w-3xl" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="container py-8">
        <Link
          to={`/student/modules/${moduleId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Module
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Question not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const parts = (question.parts || []).map((p: Part) => ({
    ...p,
    sub_questions: (p.sub_questions || []).filter(Boolean).sort((a: SubQuestion, b: SubQuestion) => a.order_index - b.order_index),
  }));

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <Link
          to={`/student/modules/${moduleId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Module
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold break-words sm:text-3xl">{question.title}</h1>
          {isReadOnly ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-500">
              <Check className="h-4 w-4" />
              Submitted
            </div>
          ) : saveStatus !== 'idle' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {saveStatus === 'saving' && <> <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" /> Saving... </>}
              {saveStatus === 'saved' && <> <Check className="h-4 w-4 text-green-500" /> Saved </>}
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-foreground uppercase tracking-wide">Scenario</h2>
        <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{question.scenario_text}</p>
      </div>

      {question.artefacts && question.artefacts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-foreground uppercase tracking-wide">Artefacts</h2>
          <div className="rounded-lg border bg-card p-4">
            <div className="space-y-2">
              {question.artefacts.map((artefact: Artefact) => (
                <div
                  key={artefact.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{artefact.filename}</p>
                      <p className="text-xs text-muted-foreground">{artefact.file_type}</p>
                    </div>
                  </div>
                  <a
                    href={`/api/artefacts/${artefact.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-[#d9f56b] transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {parts.map((part: Part) => (
        part.sub_questions.length > 0 && (
          <div key={part.id} className="mb-8">
            <h2 className="text-lg font-semibold mb-3 text-foreground uppercase tracking-wide">Part {part.label}</h2>
            <div className="space-y-6">
              {part.sub_questions.map((subQuestion: SubQuestion, index: number) => (
                <div key={subQuestion.id}>
                  {index > 0 && <Separator className="my-6" />}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <label className="text-sm font-medium leading-relaxed text-foreground/80">
                        {subQuestion.prompt}
                      </label>
                      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                        {subQuestion.max_marks} marks
                      </span>
                    </div>
                    <Textarea
                      value={answers[subQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(subQuestion.id, e.target.value)}
                      placeholder={isReadOnly ? '' : 'Enter your answer here...'}
                      disabled={isReadOnly}
                      className="min-h-[150px] resize-none bg-white dark:bg-white text-black border-border focus:border-[#d9f56b] transition-colors"
                    />
                    {isReadOnly && !showGrades && (
                      <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Submitted. Waiting for instructor grading.
                        </p>
                      </div>
                    )}
                    {showGrades && (
                      <div className="mt-2 p-3 rounded-md bg-[#d9f56b]/30 border border-[#d9f56b]/40">
                        <span className="font-semibold text-foreground">
                          {grades[subQuestion.id]?.marks_awarded != null
                            ? `${grades[subQuestion.id].marks_awarded} / ${subQuestion.max_marks} marks`
                            : 'Awaiting grading'}
                        </span>
                        {grades[subQuestion.id]?.feedback && (
                          <p className="mt-2 text-foreground/90 font-medium whitespace-pre-wrap break-words">{grades[subQuestion.id].feedback}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {!isReadOnly && (
        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleManualSave}
            disabled={isManuallySaving}
            className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90 px-8"
            size="lg"
          >
            {isManuallySaving ? 'Saving...' : 'Save Answers'}
          </Button>
        </div>
      )}
    </div>
  );
}
