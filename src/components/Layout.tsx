import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
