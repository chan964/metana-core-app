import { Navigate, useParams } from 'react-router-dom';

export default function InstructorSubmissions() {
  const { moduleId } = useParams<{ moduleId: string }>();

  // Legacy route: /instructor/module/:moduleId/submissions
  // Redirect to the supported route: /instructor/modules/:moduleId/submissions
  if (!moduleId) {
    return (
      <div className="container py-8">
        <p>This legacy instructor submissions page is no longer supported.</p>
      </div>
    );
  }

  return <Navigate to={`/instructor/modules/${moduleId}/submissions`} replace />;
}
