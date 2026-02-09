import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download } from 'lucide-react';
import { storage } from '@/lib/firebase';

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
  url?: string;
  uploaded_by?: string;
  uploaded_at?: string;
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

export default function QuestionEditor() {
  const { moduleId, questionId } = useParams<{ moduleId: string; questionId?: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [scenarioText, setScenarioText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [questionData, setQuestionData] = useState<Question | null>(null);
  const [partIds, setPartIds] = useState<{ A?: string; B?: string }>({});

  const [isAddingPartA, setIsAddingPartA] = useState(false);
  const [isAddingPartB, setIsAddingPartB] = useState(false);
  const [partAPrompt, setPartAPrompt] = useState('');
  const [partAMaxMarks, setPartAMaxMarks] = useState('');
  const [partBPrompt, setPartBPrompt] = useState('');
  const [partBMaxMarks, setPartBMaxMarks] = useState('');
  const [partAError, setPartAError] = useState<string | null>(null);
  const [partBError, setPartBError] = useState<string | null>(null);
  const [isSavingPartA, setIsSavingPartA] = useState(false);
  const [isSavingPartB, setIsSavingPartB] = useState(false);
  const [isAddingArtefact, setIsAddingArtefact] = useState(false);
  const [artefactError, setArtefactError] = useState<string | null>(null);
  const [isUploadingArtefact, setIsUploadingArtefact] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isExistingQuestion = Boolean(questionId);
  const isSaveDisabled = isExistingQuestion || !title.trim() || !scenarioText.trim() || isSaving;

  const fetchQuestionData = async () => {
    if (!moduleId || !questionId) return;
    setIsLoadingQuestion(true);
    setError(null);

    try {
      const response = await fetch(`/api/modules/${moduleId}/questions`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question data');
      }

      const result: ModuleQuestionsData = await response.json();
      const found = result.questions.find((q) => q.id === questionId) || null;
      setQuestionData(found);
      if (found) {
        setTitle(found.title || '');
        setScenarioText(found.scenario_text || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch question');
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const ensureParts = async (qid: string) => {
    const createPart = async (label: 'A' | 'B') => {
      const response = await fetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question_id: qid, label })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create part ${label}`);
      }

      return response.json();
    };

    const [partA, partB] = await Promise.all([createPart('A'), createPart('B')]);
    setPartIds({ A: partA.id, B: partB.id });
  };

  useEffect(() => {
    if (!questionId) return;
    fetchQuestionData();
    ensureParts(questionId).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to prepare parts');
    });
  }, [moduleId, questionId]);

  useEffect(() => {
    if (!questionData?.sub_questions?.length) return;
    const minOrderByPart = new Map<string, number>();
    questionData.sub_questions.forEach((sq) => {
      const current = minOrderByPart.get(sq.part_id);
      if (current === undefined || sq.order_index < current) {
        minOrderByPart.set(sq.part_id, sq.order_index);
      }
    });
    const sorted = [...minOrderByPart.entries()].sort((a, b) => a[1] - b[1]);
    const nextPartIds = { ...partIds };
    if (sorted[0]?.[0]) nextPartIds.A = nextPartIds.A || sorted[0][0];
    if (sorted[1]?.[0]) nextPartIds.B = nextPartIds.B || sorted[1][0];
    if (nextPartIds.A !== partIds.A || nextPartIds.B !== partIds.B) {
      setPartIds(nextPartIds);
    }
  }, [questionData]);

  const handleSave = async () => {
    if (!moduleId || isSaveDisabled) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          module_id: moduleId,
          title: title.trim(),
          scenario_text: scenarioText.trim()
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save question');
      }

      const result = await response.json();
      const questionId = result?.id;
      if (questionId) {
        await ensureParts(questionId);
        navigate(`/instructor/modules/${moduleId}/questions/${questionId}`);
      } else {
        navigate(`/instructor/modules/${moduleId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const partASubQuestions = useMemo(() => {
    if (!questionData || !partIds.A) return [];
    return questionData.sub_questions.filter((sq) => sq.part_id === partIds.A);
  }, [questionData, partIds.A]);

  const partBSubQuestions = useMemo(() => {
    if (!questionData || !partIds.B) return [];
    return questionData.sub_questions.filter((sq) => sq.part_id === partIds.B);
  }, [questionData, partIds.B]);

  const getNextOrderIndex = (isPartB: boolean) => {
    const maxA = partASubQuestions.reduce((max, sq) => Math.max(max, sq.order_index), 0);
    const maxB = partBSubQuestions.reduce((max, sq) => Math.max(max, sq.order_index), 0);
    if (!isPartB) {
      return maxA + 1;
    }
    return Math.max(maxB + 1, maxA + 1);
  };

  const saveSubQuestion = async (isPartB: boolean) => {
    if (!questionId) return;
    const prompt = isPartB ? partBPrompt.trim() : partAPrompt.trim();
    const maxMarksValue = isPartB ? partBMaxMarks.trim() : partAMaxMarks.trim();
    const partId = isPartB ? partIds.B : partIds.A;

    if (!partId) {
      const setter = isPartB ? setPartBError : setPartAError;
      setter('Part ID is missing');
      return;
    }

    const maxMarks = Number(maxMarksValue);
    if (!prompt || !maxMarksValue || Number.isNaN(maxMarks) || maxMarks <= 0) {
      const setter = isPartB ? setPartBError : setPartAError;
      setter('Prompt and max marks are required');
      return;
    }

    const setSaving = isPartB ? setIsSavingPartB : setIsSavingPartA;
    const setErrorState = isPartB ? setPartBError : setPartAError;
    setSaving(true);
    setErrorState(null);

    try {
      const response = await fetch('/api/sub-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          part_id: partId,
          prompt,
          max_marks: maxMarks,
          order_index: getNextOrderIndex(isPartB)
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create sub-question');
      }

      if (isPartB) {
        setPartBPrompt('');
        setPartBMaxMarks('');
        setIsAddingPartB(false);
      } else {
        setPartAPrompt('');
        setPartAMaxMarks('');
        setIsAddingPartA(false);
      }

      await fetchQuestionData();
    } catch (err) {
      setErrorState(err instanceof Error ? err.message : 'Failed to create sub-question');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!questionId) return;
    setIsUploadingArtefact(true);
    setUploadError(null);

    try {
      const sanitizedName = file.name.replace(/[^\w.\-]/g, '_');
      const storagePath = `artefacts/${questionId}/${uuidv4()}-${sanitizedName}`;
      const storageRef = ref(storage, storagePath);
      const contentType = file.type || 'application/octet-stream';

      await uploadBytes(storageRef, file, { contentType });
      const downloadUrl = await getDownloadURL(storageRef);

      const metaRes = await fetch('/api/artefacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question_id: questionId,
          filename: file.name,
          file_type: contentType,
          url: downloadUrl,
          storage_key: storagePath
        })
      });

      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save artefact metadata');
      }

      const result = await metaRes.json();
      setQuestionData((prev) => {
        if (!prev) return prev;
        const nextArtefacts = [...(prev.artefacts || []), result];
        return { ...prev, artefacts: nextArtefacts };
      });
      setIsAddingArtefact(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload artefact');
    } finally {
      setIsUploadingArtefact(false);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to={`/instructor/modules/${moduleId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to module
          </Link>
          <h1 className="text-3xl font-bold">Question Editor</h1>
          <p className="mt-2 text-muted-foreground">
            Create a new question for this module.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaveDisabled}
          className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
        >
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Question title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              readOnly={isExistingQuestion}
              placeholder="Enter question title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Scenario text</label>
            <Textarea
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
              readOnly={isExistingQuestion}
              placeholder="Enter scenario text"
              className="min-h-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {questionId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Artefacts</CardTitle>
            <Button
              className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
              onClick={() => {
                setArtefactError(null);
                setIsAddingArtefact(true);
              }}
            >
              Add artefact
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionData?.artefacts?.length ? (
              <div className="space-y-2">
                {questionData.artefacts.map((artefact) => (
                  <div
                    key={artefact.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{artefact.filename}</p>
                      <p className="text-xs text-muted-foreground">{artefact.file_type}</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              !isAddingArtefact && (
                <p className="text-sm text-muted-foreground">No artefacts added yet.</p>
              )
            )}

            {isAddingArtefact && (
              <div className="rounded-lg border border-[#d9f56b]/40 bg-muted/30 px-4 pb-4 pt-5 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload file</label>
                  <Input
                    type="file"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (selected) {
                        handleFileUpload(selected);
                        e.currentTarget.value = '';
                      }
                    }}
                    disabled={isUploadingArtefact}
                    className="h-16 border-[#d9f56b]/40 focus-visible:ring-[#d9f56b] px-3 py-3 leading-10 file:h-10 file:my-0 file:bg-[#d9f56b] file:text-black file:border-0 file:rounded-md file:px-4 file:mr-4 file:cursor-pointer file:font-medium file:leading-10 hover:file:bg-[#d9f56b]/90"
                  />
                </div>

                {isUploadingArtefact && (
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                )}
                {uploadError && (
                  <Alert variant="destructive">
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
                {artefactError && (
                  <Alert variant="destructive">
                    <AlertDescription>{artefactError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingArtefact(false);
                      setArtefactError(null);
                    }}
                    disabled={isUploadingArtefact}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoadingQuestion && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading question content...
          </CardContent>
        </Card>
      )}

      {questionId && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Part A</CardTitle>
              <Button
                className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                onClick={() => {
                  setPartAError(null);
                  setIsAddingPartA(true);
                }}
              >
                Add sub-question
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {partASubQuestions.length === 0 && !isAddingPartA && (
                <p className="text-sm text-muted-foreground">No sub-questions added yet.</p>
              )}

              {partASubQuestions.map((sq) => (
                <div
                  key={sq.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <p className="text-sm font-medium">{sq.prompt}</p>
                  <p className="text-xs text-muted-foreground">Max marks: {sq.max_marks}</p>
                </div>
              ))}

              {isAddingPartA && (
                <div className="rounded-lg border border-[#d9f56b]/40 bg-muted/30 p-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prompt</label>
                    <Textarea
                      value={partAPrompt}
                      onChange={(e) => setPartAPrompt(e.target.value)}
                      placeholder="Enter prompt for Part A"
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max marks</label>
                    <Input
                      type="number"
                      min="1"
                      value={partAMaxMarks}
                      onChange={(e) => setPartAMaxMarks(e.target.value)}
                      placeholder="e.g. 10"
                    />
                  </div>

                  {partAError && (
                    <Alert variant="destructive">
                      <AlertDescription>{partAError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddingPartA(false);
                        setPartAPrompt('');
                        setPartAMaxMarks('');
                        setPartAError(null);
                      }}
                      disabled={isSavingPartA}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                      onClick={() => saveSubQuestion(false)}
                      disabled={isSavingPartA || !partAPrompt.trim() || !partAMaxMarks.trim()}
                    >
                      {isSavingPartA ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Part B</CardTitle>
              <Button
                className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                onClick={() => {
                  setPartBError(null);
                  setIsAddingPartB(true);
                }}
              >
                Add sub-question
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {partBSubQuestions.length === 0 && !isAddingPartB && (
                <p className="text-sm text-muted-foreground">No sub-questions added yet.</p>
              )}

              {partBSubQuestions.map((sq) => (
                <div
                  key={sq.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <p className="text-sm font-medium">{sq.prompt}</p>
                  <p className="text-xs text-muted-foreground">Max marks: {sq.max_marks}</p>
                </div>
              ))}

              {isAddingPartB && (
                <div className="rounded-lg border border-[#d9f56b]/40 bg-muted/30 p-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prompt</label>
                    <Textarea
                      value={partBPrompt}
                      onChange={(e) => setPartBPrompt(e.target.value)}
                      placeholder="Enter prompt for Part B"
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max marks</label>
                    <Input
                      type="number"
                      min="1"
                      value={partBMaxMarks}
                      onChange={(e) => setPartBMaxMarks(e.target.value)}
                      placeholder="e.g. 10"
                    />
                  </div>

                  {partBError && (
                    <Alert variant="destructive">
                      <AlertDescription>{partBError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddingPartB(false);
                        setPartBPrompt('');
                        setPartBMaxMarks('');
                        setPartBError(null);
                      }}
                      disabled={isSavingPartB}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#d9f56b] text-black hover:bg-[#d9f56b]/90"
                      onClick={() => saveSubQuestion(true)}
                      disabled={isSavingPartB || !partBPrompt.trim() || !partBMaxMarks.trim()}
                    >
                      {isSavingPartB ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
