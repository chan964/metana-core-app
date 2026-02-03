import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModuleById } from '@/api/modules';
import { getSubmission, saveDraft, submitModule } from '@/api/submissions';
import { Module, ModuleSubmission, SubQuestionAnswer } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ArtefactList } from '@/components/ArtefactList';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { ArrowLeft, Save, Send, CheckCircle, Info } from 'lucide-react';

export default function StudentModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [submission, setSubmission] = useState<ModuleSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (moduleId) {
      fetchData();
    }
  }, [moduleId]);

  async function fetchData() {
    if (!moduleId) return;
    try {
      const [moduleResponse, submissionResponse] = await Promise.all([
        getModuleById(moduleId),
        getSubmission(moduleId),
      ]);
      
      if (moduleResponse.data) {
        setModule(moduleResponse.data);
      }
      
      if (submissionResponse.data) {
        setSubmission(submissionResponse.data);
        // Initialize answers from submission
        const answerMap: Record<string, string> = {};
        submissionResponse.data.answers.forEach((a) => {
          answerMap[a.subQuestionId] = a.answer;
        });
        setAnswers(answerMap);
      }
    } catch (error) {
      console.error('Failed to fetch module:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!moduleId) return;
    setIsSaving(true);
    try {
      const answerArray: SubQuestionAnswer[] = Object.entries(answers).map(([subQuestionId, answer]) => ({
        subQuestionId,
        answer,
      }));
      const response = await saveDraft(moduleId, answerArray);
      if (response.data) {
        setSubmission(response.data);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!moduleId) return;
    try {
      // Save draft first
      await handleSaveDraft();
      // Then submit
      const response = await submitModule(moduleId);
      if (response.data) {
        setSubmission(response.data);
      }
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  }

  const updateAnswer = (subQuestionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [subQuestionId]: value }));
  };

  const state = submission?.state || 'draft';
  const isEditable = state === 'draft';
  const isSubmitted = state === 'submitted';
  const isGraded = state === 'graded';
  const isFinalised = state === 'finalised';

  const getGradeForSubQuestion = (subQuestionId: string) => {
    return submission?.grades.find((g) => g.subQuestionId === subQuestionId);
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-8 h-10 w-48" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>Module not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/student')} className="mb-2 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          <p className="mt-2 text-muted-foreground">{module.description}</p>
        </div>
        <StatusBadge state={state} className="text-sm" />
      </div>

      {/* Status Alert */}
      {isSubmitted && (
        <Alert className="mb-6">
          <Send className="h-4 w-4" />
          <AlertDescription>
            Your submission has been received and is awaiting grading.
          </AlertDescription>
        </Alert>
      )}
      {isGraded && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your submission has been graded. Grades will be released once finalised by your instructor.
          </AlertDescription>
        </Alert>
      )}
      {isFinalised && submission?.totalScore !== undefined && (
        <Alert className="mb-6 border-primary/50 bg-primary/10">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Total Score: {submission.totalScore}</strong> — View detailed feedback below.
          </AlertDescription>
        </Alert>
      )}

      {/* Questions Overview */}
      {module.questions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5">
              {module.questions.map((q) => (
                <li key={q.id} className="text-foreground">
                  {q.text}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Scenario */}
      {module.scenario && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-foreground">{module.scenario}</p>
          </CardContent>
        </Card>
      )}

      {/* Artefacts */}
      {module.artefacts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Artefacts</CardTitle>
            <CardDescription>Supporting materials for this module</CardDescription>
          </CardHeader>
          <CardContent>
            <ArtefactList artefacts={module.artefacts} canManage={false} />
          </CardContent>
        </Card>
      )}

      {/* Part A */}
      {module.partA.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Part A</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {module.partA.map((subQ, index) => {
              const grade = getGradeForSubQuestion(subQ.id);
              return (
                <div key={subQ.id}>
                  {index > 0 && <Separator className="mb-6" />}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <label className="font-medium">
                        {subQ.label}. {subQ.text}
                      </label>
                      {isFinalised && grade && (
                        <span className="text-sm font-medium">
                          {grade.score}/{subQ.maxScore}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={answers[subQ.id] || ''}
                      onChange={(e) => updateAnswer(subQ.id, e.target.value)}
                      disabled={!isEditable}
                      placeholder={isEditable ? 'Enter your answer...' : ''}
                      className="min-h-[120px]"
                    />
                    {isFinalised && grade?.feedback && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <div className="mb-1 flex items-center gap-1.5 font-medium">
                          <Info className="h-4 w-4" />
                          Instructor Feedback
                        </div>
                        <p className="text-muted-foreground">{grade.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Part B */}
      {module.partB.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Part B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {module.partB.map((subQ, index) => {
              const grade = getGradeForSubQuestion(subQ.id);
              return (
                <div key={subQ.id}>
                  {index > 0 && <Separator className="mb-6" />}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <label className="font-medium">
                        {subQ.label}. {subQ.text}
                      </label>
                      {isFinalised && grade && (
                        <span className="text-sm font-medium">
                          {grade.score}/{subQ.maxScore}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={answers[subQ.id] || ''}
                      onChange={(e) => updateAnswer(subQ.id, e.target.value)}
                      disabled={!isEditable}
                      placeholder={isEditable ? 'Enter your answer...' : ''}
                      className="min-h-[120px]"
                    />
                    {isFinalised && grade?.feedback && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <div className="mb-1 flex items-center gap-1.5 font-medium">
                          <Info className="h-4 w-4" />
                          Instructor Feedback
                        </div>
                        <p className="text-muted-foreground">{grade.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {isEditable && (
        <div className="sticky bottom-4 flex justify-end gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Complete Module
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit Module</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit this module? You will not be able to make any
                  further changes after submission.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
