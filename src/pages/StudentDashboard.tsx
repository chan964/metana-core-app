import { useState, useEffect } from 'react';
import { ModuleCard } from '@/components/ModuleCard';
import { getStudentModules } from '@/api/modules';
import { StudentModule } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentDashboard() {
  const [modules, setModules] = useState<StudentModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchModules() {
      try {
        const response = await getStudentModules();
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
          <p className="text-muted-foreground">No modules assigned yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((studentModule) => (
            <ModuleCard key={studentModule.module.id} studentModule={studentModule} />
          ))}
        </div>
      )}
    </div>
  );
}
