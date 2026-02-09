import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, FileText, ArrowRight, AlertCircle } from 'lucide-react';
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
        </div>
      )}
    </div>
  );
}
