import { Navigate, useParams } from 'react-router-dom';

export default function StudentModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();

  // Legacy route: /student/module/:moduleId
  // Redirect to the supported route: /student/modules/:moduleId
  if (!moduleId) {
    return (
      <div className="container py-8">
        <p>This legacy student module page is no longer supported.</p>
      </div>
    );
  }

  return <Navigate to={`/student/modules/${moduleId}`} replace />;
}
