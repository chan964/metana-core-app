import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/sonner';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  ListOrdered, 
  Paperclip,
  AlertCircle,
  Pencil,
  CheckCircle2
} from 'lucide-react';

interface SubQuestion {
  id: string;
  prompt: string;
  max_marks: number;
  order_index: number;
  part_id: string;
  created_at: string;
}

interface Artefact {
  id: string;
  filename: string;
  file_type: string;
  url: string;
  uploaded_by: string;
  uploaded_at: string;
}

interface Question {
  id: string;
  module_id: string;
  title: string;
  scenario_text: string;
  order_index: number;
  created_at: string;
  sub_questions: SubQuestion[];
  artefacts: Artefact[];
}

interface ModuleQuestionsData {
  module_id: string;
  questions: Question[];
}

interface ModuleInfo {
  id: string;
  title: string;
  description?: string;
  status: string;
  ready_for_publish?: boolean;
}

export default function ModuleEditor() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ModuleQuestionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [moduleInfo, setModuleInfo] = useState<ModuleInfo | null>(null);
  const [isMarkingReady, setIsMarkingReady] = useState(false);

  const fetchModuleQuestions = async () => {
    if (!moduleId) return;
    try {
      const response = await fetch(`/api/modules/${moduleId}/questions`, {
        credentials: 'include',
      });

      if (response.status === 403) {
        setIsForbidden(true);
        setError('You do not have permission to edit this module');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch module questions');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleQuestions();
  }, [moduleId]);

  useEffect(() => {
    async function fetchModuleInfo() {
      if (!moduleId) return;
      try {
        const response = await fetch(`/api/instructor/modules/${moduleId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (result?.module) {
          setModuleInfo(result.module);
        }
      } catch {
        // Ignore module info errors to avoid blocking the editor
      }
    }

    fetchModuleInfo();
  }, [moduleId]);

  // Group sub-questions by pairs (Part A / Part B)
  const groupSubQuestions = (subQuestions: SubQuestion[]) => {
    const sorted = [...subQuestions].sort((a, b) => a.order_index - b.order_index);
    const groups: SubQuestion[][] = [];
    
    for (let i = 0; i < sorted.length; i += 2) {
      groups.push(sorted.slice(i, i + 2));
    }
    
    return groups;
  };

  const getPartLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D...
  };

  const handleOpenAddQuestion = () => {
    if (!moduleId) return;
    navigate(`/instructor/modules/${moduleId}/questions/new`);
  };

  const hasQuestions = Boolean(data?.questions?.length);
  const allQuestionsHaveSubQuestions = Boolean(
    data?.questions?.length &&
    data.questions.every((question) => question.sub_questions.length > 0)
  );
  const canMarkReady =
    hasQuestions &&
    allQuestionsHaveSubQuestions &&
    !moduleInfo?.ready_for_publish;

  const handleMarkReady = async () => {
    if (!moduleId || !canMarkReady) return;
    setIsMarkingReady(true);
    try {
      const response = await fetch(`/api/modules/${moduleId}/ready`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to mark module as ready');
      }

      const result = await response.json();
      if (result?.data) {
        setModuleInfo((prev) => ({
          ...(prev || {}),
          ...result.data
        }));
      }

      toast('Module marked ready for publish');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to mark module as ready');
    } finally {
      setIsMarkingReady(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const confirmed = window.confirm('Delete this question? This will remove its parts, sub-questions, and artefacts.');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete question');
      }

      toast('Question deleted');
      await fetchModuleQuestions();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete question');
    }
  };

  const handleEditQuestion = (questionId: string) => {
    if (!moduleId) return;
    navigate(`/instructor/modules/${moduleId}/questions/${questionId}`);
  };

  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="container py-8">
        <Link to="/instructor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You cannot edit this module. You may not be assigned as an instructor for this module.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <Link to="/instructor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/instructor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Module Content Editor</h1>
              {moduleInfo && (
                <Badge variant="outline" className="text-xs">
                  {moduleInfo.ready_for_publish ? 'Ready' : moduleInfo.status || 'Draft'}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-muted-foreground">
              Manage questions, sub-questions, and artefacts for this module
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
              onClick={handleMarkReady}
              disabled={!canMarkReady || isMarkingReady}
            >
              {moduleInfo?.ready_for_publish ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Ready for Publish
                </>
              ) : isMarkingReady ? (
                'Marking...'
              ) : (
                'Mark Ready for Publish'
              )}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleOpenAddQuestion}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>
      </div>

      {/* Questions List */}
      {!data || data.questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No questions yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by adding your first question
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleOpenAddQuestion}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.questions.map((question, qIndex) => (
            <Card key={question.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ListOrdered className="h-5 w-5 text-muted-foreground" />
                      {question.title}
                    </CardTitle>
                    <CardDescription className="mt-2 text-base text-foreground">
                      {question.scenario_text || 'No scenario provided'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="shrink-0 border-[#d9f56b]/60 text-foreground hover:bg-[#d9f56b]/10"
                      onClick={() => handleEditQuestion(question.id)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6 space-y-6">
                {/* Artefacts */}
                {question.artefacts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <Paperclip className="h-4 w-4" />
                      Artefacts ({question.artefacts.length})
                    </h4>
                    <div className="space-y-2">
                      {question.artefacts.map((artefact) => (
                        <div 
                          key={artefact.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{artefact.filename}</p>
                            <p className="text-xs text-muted-foreground">{artefact.file_type}</p>
                          </div>
                          <a 
                            href={`/api/artefacts/${artefact.id}/download`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-questions grouped by pairs (Part A / Part B) */}
                {question.sub_questions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">
                      Sub-Questions ({question.sub_questions.length})
                    </h4>
                    <div className="space-y-4">
                      {groupSubQuestions(question.sub_questions).map((group, groupIndex) => (
                        <div key={groupIndex} className="border rounded-lg p-4 bg-muted/30 space-y-3">
                          {group.map((subQ, idx) => (
                            <div key={subQ.id} className="flex gap-3">
                              <div className="shrink-0">
                                <Badge variant="secondary" className="font-mono">
                                  Part {getPartLabel(idx)}
                                </Badge>
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-sm">{subQ.prompt}</p>
                                <p className="text-xs text-muted-foreground">
                                  Max marks: {subQ.max_marks}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {question.artefacts.length === 0 && question.sub_questions.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No artefacts or sub-questions added yet
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
