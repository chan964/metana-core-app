import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getModuleById } from '@/api/modules';
import { getModuleSubmissions } from '@/api/submissions';
import { Module, ModuleSubmission } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function InstructorSubmissions() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [module, setModule] = useState<Module | null>(null);
  const [submissions, setSubmissions] = useState<ModuleSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (moduleId) {
      fetchData();
    }
  }, [moduleId]);

  async function fetchData() {
    if (!moduleId) return;
    try {
      const [moduleResponse, submissionsResponse] = await Promise.all([
        getModuleById(moduleId),
        getModuleSubmissions(moduleId),
      ]);
      
      if (moduleResponse.data) {
        setModule(moduleResponse.data);
      }
      
      if (submissionsResponse.data) {
        // Filter out draft submissions - instructor only sees submitted, graded, finalised
        const visibleSubmissions = submissionsResponse.data.filter(
          (s) => s.state !== 'draft'
        );
        setSubmissions(visibleSubmissions);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatDate = (dateString?: string) => {
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
        <Skeleton className="mb-8 h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-2 -ml-4">
          <Link to="/instructor">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">{module?.title || 'Module'}</h1>
        <p className="mt-2 text-muted-foreground">View and grade student submissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} to review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No submissions to review yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.studentName}</TableCell>
                    <TableCell>
                      <StatusBadge state={submission.state} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(submission.submittedAt)}
                    </TableCell>
                    <TableCell>
                      {submission.state === 'finalised' && submission.totalScore !== undefined
                        ? submission.totalScore
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/instructor/submission/${submission.id}`}>
                          {submission.state === 'submitted' ? 'Grade' : 'View'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
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
