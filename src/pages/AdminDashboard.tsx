import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/UserManagement';
import { ModuleManagement } from '@/components/admin/ModuleManagement';
import { Users, BookOpen } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Manage users, modules, and system configuration
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Modules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent value="modules">
          <ModuleManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
