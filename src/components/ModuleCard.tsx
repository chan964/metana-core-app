import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { StudentModule } from '@/types';
import { FileText, ArrowRight } from 'lucide-react';

interface ModuleCardProps {
  studentModule: StudentModule;
}

export function ModuleCard({ studentModule }: ModuleCardProps) {
  const { module, submission } = studentModule;
  const state = submission?.state || 'draft';

  const getActionLabel = () => {
    switch (state) {
      case 'draft':
        return 'Continue Module';
      case 'submitted':
        return 'View Submission';
      case 'graded':
        return 'View Submission';
      case 'finalised':
        return 'View Results';
      default:
        return 'Open Module';
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{module.title}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {module.description}
              </CardDescription>
            </div>
          </div>
          <StatusBadge state={state} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {module.partA.length + module.partB.length} questions
          </div>
          <Button asChild variant={state === 'draft' ? 'default' : 'outline'} size="sm">
            <Link to={`/student/module/${module.id}`}>
              {getActionLabel()}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        {state === 'finalised' && submission?.totalScore !== undefined && (
          <div className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium">
            Total Score: {submission.totalScore}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
