import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getInstructorModules } from '@/api/modules';
import { InstructorModule } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Users, ArrowRight } from 'lucide-react';

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<InstructorModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchModules() {
      try {
        const response = await getInstructorModules();
        if (response.data) {
          setModules(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch modules:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchModules();
  }, []);

  const getTotalSubmissions = (counts: InstructorModule['submissionCounts']) => {
    return counts.submitted + counts.graded + counts.finalised;
  };

  const getPendingCount = (counts: InstructorModule['submissionCounts']) => {
    return counts.submitted;
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Instructor Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage and grade student submissions for your assigned modules
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No modules assigned yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ module, submissionCounts }) => (
            <Card 
              key={module.id} 
              className="group transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => navigate(`/instructor/modules/${module.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                      <FileText className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-lg truncate">{module.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{module.students?.length || 0}</span>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 ml-11">
                  {module.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 min-h-[24px]">
                  {getPendingCount(submissionCounts) > 0 && (
                    <Badge variant="secondary" className="bg-primary/10">
                      {getPendingCount(submissionCounts)} pending review
                    </Badge>
                  )}
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  <div className="rounded bg-muted p-2">
                    <div className="font-medium">{submissionCounts.draft}</div>
                    <div className="text-muted-foreground">Draft</div>
                  </div>
                  <div className="rounded bg-muted p-2">
                    <div className="font-medium">{submissionCounts.submitted}</div>
                    <div className="text-muted-foreground">Submitted</div>
                  </div>
                  <div className="rounded bg-muted p-2">
                    <div className="font-medium">{submissionCounts.graded}</div>
                    <div className="text-muted-foreground">Graded</div>
                  </div>
                  <div className="rounded bg-muted p-2">
                    <div className="font-medium">{submissionCounts.finalised}</div>
                    <div className="text-muted-foreground">Final</div>
                  </div>
                </div>

                <Button 
                  asChild 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/instructor/module/${module.id}/submissions`}>
                    View Submissions
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
