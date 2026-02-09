import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';

interface InstructorSubmissionItem {
  submission_id: string;
  student_id: string;
  student_name: string | null;
  status: 'submitted' | 'finalised';
  submitted_at: string | null;
}

export default function InstructorModuleSubmissions() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<InstructorSubmissionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubmissions() {
      if (!moduleId) return;
      try {
        const response = await fetch(`/api/instructor/modules/${moduleId}/submissions`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load submissions');
        }

        const data = await response.json();
        setSubmissions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submissions');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSubmissions();
  }, [moduleId]);

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

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-2 -ml-4">
          <Link to={`/instructor/modules/${moduleId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Module
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Submissions</h1>
        <p className="mt-2 text-muted-foreground">Review student submissions for this module</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Submissions</CardTitle>
          <CardDescription>
            {submissions.length} submission{submissions.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-8 text-center text-muted-foreground">{error}</div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No submissions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow
                    key={submission.submission_id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/instructor/modules/${moduleId}/submissions/${submission.submission_id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {submission.student_name || submission.student_id}
                    </TableCell>
                    <TableCell className="capitalize">{submission.status}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(submission.submitted_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
