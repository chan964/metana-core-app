import { Link } from 'react-router-dom';

export default function GradingView() {
  return (
    <div className="container py-8">
      <h1 className="mb-4 text-2xl font-bold">Legacy grading page</h1>
      <p className="mb-2">
        This grading page is deprecated and no longer supported.
      </p>
      <p className="mb-4">
        Please open submissions via the instructor modules view and use the supported grading
        interface.
      </p>
      <p>
        <Link className="text-primary underline" to="/instructor">
          Go to instructor dashboard
        </Link>
      </p>
    </div>
  );
}
