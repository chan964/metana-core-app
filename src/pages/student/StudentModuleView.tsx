import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ArrowLeft, FileText, ArrowRight, AlertCircle, Send, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface Question {
  id: string;
  title: string;
  scenario_text: string;
  order_index: number;
}

interface StudentModuleDetail {
  id: string;
  title: string;
  description: string;
  status: 'published';
  questions: Question[];
}

export default function StudentModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<StudentModuleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted' | 'finalised' | 'graded' | null>(null);

  useEffect(() => {
    async function fetchModule() {
      if (!moduleId) return;

      try {
        const response = await fetch(`/api/student/modules/${moduleId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('You do not have access to this module');
          }
          if (response.status === 404) {
            throw new Error('Module not found');
          }
          throw new Error('Failed to load module');
        }

        const data = await response.json();
        setModule(data);

        // Fetch submission status
        const statusResponse = await fetch(`/api/submissions/status?moduleId=${moduleId}`, {
          credentials: 'include',
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setSubmissionStatus(statusData.status);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load module';
        setError(message);
        toast(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchModule();
  }, [moduleId]);

  const handleSubmitModule = async () => {
    if (!moduleId) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/submissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ moduleId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit module');
      }

      toast.success('Module submitted successfully!');
      navigate('/student/modules');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit module';
      toast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-8 h-10 w-full max-w-2xl" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="container py-8">
        <Link
          to="/student/modules"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Modules
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Module not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/student/modules"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Modules
        </Link>

        <div>
          <h1 className="text-3xl font-bold">{module.title}</h1>
          {module.description && (
            <p className="mt-2 text-muted-foreground">{module.description}</p>
          )}
        </div>
      </div>

      {/* Questions List */}
      {module.questions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">No questions available yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Questions will appear here once they are added to this module
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {module.questions.map((question) => (
            <Card
              key={question.id}
              className="group transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => navigate(`/student/modules/${moduleId}/questions/${question.id}`)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg mb-2">{question.title}</CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {question.scenario_text}
                </p>
              </CardHeader>
              <CardContent>
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-[#d9f56b] px-4 py-2 text-sm font-medium text-black hover:bg-[#d9f56b]/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/student/modules/${moduleId}/questions/${question.id}`);
                  }}
                >
                  Open Question
                  <ArrowRight className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}

          {/* Submit Module Button */}
          <div className="mt-8 flex justify-end">
            {submissionStatus !== null && submissionStatus !== 'draft' ? (
              <Button
                className="bg-muted text-muted-foreground cursor-not-allowed"
                disabled
              >
                <Check className="mr-2 h-4 w-4" />
                Completed
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                    disabled={isSubmitting}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Complete Module
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Module</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to submit this module? You will not be able to make any
                      further changes after submission. Please ensure all questions are answered.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleSubmitModule}
                      disabled={isSubmitting}
                      className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
