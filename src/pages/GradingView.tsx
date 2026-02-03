import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModuleById } from '@/api/modules';
import { getSubmissionById, saveGrades, finaliseGrades } from '@/api/submissions';
import { Module, ModuleSubmission, SubQuestionGrade } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Save, Lock, AlertTriangle } from 'lucide-react';

export default function GradingView() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [submission, setSubmission] = useState<ModuleSubmission | null>(null);
  const [grades, setGrades] = useState<Record<string, { score: number; feedback: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (submissionId) {
      fetchData();
    }
  }, [submissionId]);

  async function fetchData() {
    if (!submissionId) return;
    try {
      const submissionResponse = await getSubmissionById(submissionId);
      
      if (submissionResponse.data) {
        setSubmission(submissionResponse.data);
        
        // Fetch module
        const moduleResponse = await getModuleById(submissionResponse.data.moduleId);
        if (moduleResponse.data) {
          setModule(moduleResponse.data);
        }
        
        // Initialize grades from submission
        const gradeMap: Record<string, { score: number; feedback: string }> = {};
        submissionResponse.data.grades.forEach((g) => {
          gradeMap[g.subQuestionId] = { score: g.score, feedback: g.feedback };
        });
        
        // Initialize empty grades for sub-questions without grades
        if (moduleResponse.data) {
          [...moduleResponse.data.partA, ...moduleResponse.data.partB].forEach((subQ) => {
            if (!gradeMap[subQ.id]) {
              gradeMap[subQ.id] = { score: 0, feedback: '' };
            }
          });
        }
        
        setGrades(gradeMap);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveGrades() {
    if (!submissionId) return;
    setIsSaving(true);
    try {
      const gradeArray: SubQuestionGrade[] = Object.entries(grades).map(
        ([subQuestionId, grade]) => ({
          subQuestionId,
          score: grade.score,
          feedback: grade.feedback,
        })
      );
      const response = await saveGrades(submissionId, gradeArray);
      if (response.data) {
        setSubmission(response.data);
      }
    } catch (error) {
      console.error('Failed to save grades:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinalise() {
    if (!submissionId) return;
    try {
      // Save grades first
      await handleSaveGrades();
      // Then finalise
      const response = await finaliseGrades(submissionId);
      if (response.data) {
        setSubmission(response.data);
      }
    } catch (error) {
      console.error('Failed to finalise:', error);
    }
  }

  const updateGrade = (subQuestionId: string, field: 'score' | 'feedback', value: string | number) => {
    setGrades((prev) => ({
      ...prev,
      [subQuestionId]: {
        ...prev[subQuestionId],
        [field]: value,
      },
    }));
  };

  const getAnswer = (subQuestionId: string) => {
    return submission?.answers.find((a) => a.subQuestionId === subQuestionId)?.answer || '';
  };

  const calculateTotalScore = () => {
    return Object.values(grades).reduce((sum, g) => sum + (g.score || 0), 0);
  };

  const getMaxScore = () => {
    if (!module) return 0;
    return [...module.partA, ...module.partB].reduce((sum, q) => sum + q.maxScore, 0);
  };

  const state = submission?.state || 'submitted';
  const isEditable = state === 'submitted' || state === 'graded';
  const isFinalised = state === 'finalised';

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-8 h-10 w-64" />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!module || !submission) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertDescription>Submission not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const renderSubQuestionGrading = (subQ: typeof module.partA[0], part: string) => (
    <div key={subQ.id} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <Label className="text-base font-medium">
          {subQ.label}. {subQ.text}
        </Label>
        <span className="text-sm text-muted-foreground">Max: {subQ.maxScore}</span>
      </div>
      
      {/* Student Answer (read-only) */}
      <div className="rounded-md bg-muted p-3">
        <Label className="mb-2 block text-sm text-muted-foreground">Student Answer</Label>
        <p className="whitespace-pre-wrap text-sm">
          {getAnswer(subQ.id) || <span className="italic text-muted-foreground">No answer provided</span>}
        </p>
      </div>
      
      {/* Grading inputs */}
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="space-y-2">
          <Label htmlFor={`score-${subQ.id}`}>Score</Label>
          <Input
            id={`score-${subQ.id}`}
            type="number"
            min={0}
            max={subQ.maxScore}
            value={grades[subQ.id]?.score || 0}
            onChange={(e) => updateGrade(subQ.id, 'score', Number(e.target.value))}
            disabled={!isEditable}
            className="w-24"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`feedback-${subQ.id}`}>Feedback</Label>
          <Textarea
            id={`feedback-${subQ.id}`}
            value={grades[subQ.id]?.feedback || ''}
            onChange={(e) => updateGrade(subQ.id, 'feedback', e.target.value)}
            disabled={!isEditable}
            placeholder="Provide feedback for the student..."
            className="min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/instructor/module/${module.id}/submissions`)}
            className="mb-2 -ml-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Submissions
          </Button>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          <p className="mt-2 text-muted-foreground">
            Grading submission by <strong>{submission.studentName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge state={state} />
        </div>
      </div>

      {/* Score Summary */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Score Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span>{calculateTotalScore()}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{getMaxScore()}</span>
          </div>
          {isFinalised && (
            <p className="mt-2 text-sm text-muted-foreground">
              This grade has been finalised and cannot be changed.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Part A */}
      {module.partA.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Part A</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {module.partA.map((subQ) => renderSubQuestionGrading(subQ, 'A'))}
          </CardContent>
        </Card>
      )}

      {/* Part B */}
      {module.partB.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Part B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {module.partB.map((subQ) => renderSubQuestionGrading(subQ, 'B'))}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {isEditable && (
        <div className="sticky bottom-4 flex justify-end gap-3">
          <Button variant="outline" onClick={handleSaveGrades} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Grades'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Lock className="mr-2 h-4 w-4" />
                Finalise Grade
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Finalise Grade
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action is <strong>irreversible</strong>. Once finalised:
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>The grade will be locked permanently</li>
                    <li>The student will be able to see their score and feedback</li>
                    <li>No further changes can be made</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalise}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Finalise
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
