import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { ArrowRight, FileEdit, Send, CheckCircle, Lock } from 'lucide-react';
const submissionStates = [{
  state: 'Draft',
  description: 'Your work-in-progress. Edit and save your answers until you\'re ready to submit.',
  icon: FileEdit
}, {
  state: 'Submitted',
  description: 'Your module has been submitted for grading. No further edits are allowed.',
  icon: Send
}, {
  state: 'Graded',
  description: 'Your instructor has reviewed your submission. Awaiting grade release.',
  icon: CheckCircle
}, {
  state: 'Finalised',
  description: 'Grades are released. View your scores and detailed feedback.',
  icon: Lock
}];
export default function LandingPage() {
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <Button asChild>
            <Link to="/login">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">Cybersecurity Capstone </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            A comprehensive platform for managing educational assessments, from module creation 
            to grading and feedback. Designed for students, instructors, and administrators.
          </p>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link to="/login">
                Access Platform
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Submission States Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Assessment Workflow</h2>
            <p className="mt-4 text-muted-foreground">
              Understanding the four states of your module submissions
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {submissionStates.map((item, index) => <Card key={item.state} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 h-1 w-full bg-primary/20" />
                <div className="absolute left-0 top-0 h-1 bg-primary transition-all" style={{
              width: `${(index + 1) / 4 * 100}%`
            }} />
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <item.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-lg">{item.state}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} metana. All rights reserved.</p>
        </div>
      </footer>
    </div>;
}