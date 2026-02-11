import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ArrowRight } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface StudentModuleItem {
  id: string;
  title: string;
  status: 'published';
  created_at: string;
}

interface ModuleWithProgress extends StudentModuleItem {
  progress: number;
}

export default function StudentModules() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchModules() {
      try {
        const response = await fetch('/api/student/modules', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch modules');
        }

        const data: StudentModuleItem[] = await response.json();

        // Fetch progress for each module
        const modulesWithProgress = await Promise.all(
          data.map(async (module) => {
            try {
              const progressResponse = await fetch(`/api/student/modules/${module.id}/progress`, {
                credentials: 'include',
              });
              
              if (progressResponse.ok) {
                const progressData = await progressResponse.json();
                return { ...module, progress: progressData.percentage };
              }
              return { ...module, progress: 0 };
            } catch {
              return { ...module, progress: 0 };
            }
          })
        );

        setModules(modulesWithProgress);
      } catch (error) {
        console.error('Failed to fetch modules:', error);
        toast('Failed to load modules');
      } finally {
        setIsLoading(false);
      }
    }

    fetchModules();
  }, []);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">My Modules</h1>
        <p className="mt-2 text-muted-foreground">
          View and complete your assigned assessment modules
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">No modules assigned yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check back later for available modules
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <Card
              key={module.id}
              className="group transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => navigate(`/student/modules/${module.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-lg bg-[#d9f56b]/10 p-2 shrink-0">
                      <FileText className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-lg truncate">{module.title}</CardTitle>
                  </div>
                </div>
                <div className="ml-11">
                  <Badge variant="outline" className="text-xs">
                    {module.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{module.progress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background overflow-hidden">
                    <div 
                      className="h-full bg-[#d9f56b] transition-all"
                      style={{ width: `${module.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-[#d9f56b] px-4 py-2 text-sm font-medium text-black hover:bg-[#d9f56b]/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/student/modules/${module.id}`);
                  }}
                >
                  Open Module
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
