import React, { useState, useEffect } from 'react';
import {
  getAllModules,
  deleteModule,
  assignInstructor,
  enrollStudent,
  createAdminModule,
  markModuleReady,
  publishModule,
  archiveModule, 
} from '@/api/modules';
import { getAllUsers } from '@/api/users';
import { Module, User } from '@/types';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, UserPlus, GraduationCap, Plus, ChevronDown, ChevronUp, Check, BookOpen, Archive } from 'lucide-react';

export function ModuleManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newModule, setNewModule] = useState({
    title: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [modulesRes, usersRes] = await Promise.all([
        getAllModules(),
        getAllUsers(),
      ]);

      setModules(modulesRes?.data ?? []);
      setUsers(usersRes?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch modules/users:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const instructors = users.filter((u) => u.role === 'instructor');
  const students = users.filter((u) => u.role === 'student');

  const renderInstructors = (
    instructors: Module["instructors"]
  ) => {
    if (!instructors || instructors.length === 0) {
      return "Unassigned";
    }

    return instructors
      .map((i) => i.full_name ?? i.email)
      .join(", ");
  };


  const handleCreateModule = async () => {
    const res = await createAdminModule({
      title: newModule.title,
      description: newModule.description || undefined,
    });

    setModules((prev) => [res.data, ...prev]);
    setCreateDialogOpen(false);
    setNewModule({ title: '', description: '' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Module Management</CardTitle>
          <CardDescription>
            Create modules, assign instructors, and enroll students
          </CardDescription>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Module
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Module</DialogTitle>
              <DialogDescription>
                Create a new empty module shell.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newModule.title}
                  onChange={(e) =>
                    setNewModule({ ...newModule, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newModule.description}
                  onChange={(e) =>
                    setNewModule({
                      ...newModule,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCreateModule}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No modules found.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Enrolled Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {modules.map((module) => (
                <React.Fragment key={module.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setExpandedModuleId(
                            expandedModuleId === module.id ? null : module.id
                          )
                        }
                      >
                        {expandedModuleId === module.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{module.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {module.description || 'No description'}
                      </div>
                    </TableCell>

                    <TableCell>
                      {renderInstructors(module.instructors)}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">
                        {module.students?.length || 0}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{module.status}</Badge>
                    </TableCell>

                    <TableCell className="flex gap-2">
                    {/* ASSIGN INSTRUCTOR */}
                    <Dialog
                      open={
                        assignDialogOpen &&
                        selectedModule?.id === module.id
                      }
                      onOpenChange={setAssignDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedModule(module)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Instructor</DialogTitle>
                        </DialogHeader>

                        <Select onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select instructor" />
                          </SelectTrigger>
                          <SelectContent>
                            {instructors.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.full_name ?? i.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <DialogFooter>
                          <Button
                            onClick={async () => {
                              try {
                                const response = await assignInstructor(
                                  module.id,
                                  selectedUserId
                                );
                                if (response.data) {
                                  setAssignDialogOpen(false);
                                  setSelectedUserId('');
                                  fetchData();
                                  toast.success('Instructor assigned successfully');
                                }
                              } catch (error: any) {
                                const errorMessage = error.message || '';
                                if (errorMessage.includes('already assigned')) {
                                  toast.error('Instructor is already assigned to this module');
                                } else {
                                  toast.error('Failed to assign instructor');
                                }
                                console.error('Failed to assign instructor:', error);
                              }
                            }}
                          >
                            Assign
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* ENROLL STUDENT */}
                    <Dialog
                      open={
                        enrollDialogOpen &&
                        selectedModule?.id === module.id
                      }
                      onOpenChange={setEnrollDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedModule(module)}
                        >
                          <GraduationCap className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>

                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enroll Student</DialogTitle>
                        </DialogHeader>

                        <Select onValueChange={setSelectedUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name ?? s.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <DialogFooter>
                          <Button
                            onClick={async () => {
                              try {
                                const response = await enrollStudent(
                                  module.id,
                                  selectedUserId
                                );
                                if (response.data) {
                                  // Update modules list with new enrollment
                                  setModules(modules.map((m) => 
                                    m.id === module.id ? response.data : m
                                  ));
                                  setEnrollDialogOpen(false);
                                  setSelectedUserId('');
                                  toast.success('Student enrolled successfully');
                                }
                              } catch (error: any) {
                                if (error.message.includes('already enrolled')) {
                                  toast.error('Student is already enrolled in this module');
                                } else {
                                  toast.error('Failed to enroll student');
                                }
                                console.error('Failed to enroll student:', error);
                              }
                            }}
                          >
                            Enroll
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* PUBLISH (Admin Only, Draft Only, Ready Required) */}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={module.status !== 'draft' || !module.ready_for_publish}
                      className={
                        module.status === 'draft' && module.ready_for_publish
                          ? 'animate-pulse-subtle'
                          : ''
                      }
                      title={
                        module.status !== 'draft'
                          ? 'Only available for draft modules'
                          : !module.ready_for_publish
                          ? 'Waiting for instructor to mark as ready'
                          : 'Publish module - ready for students'
                      }
                      onClick={async () => {
                        try {
                          const response = await publishModule(module.id);
                          if (response.data) {
                            await fetchData();
                            toast.success('Module published successfully');
                          }
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to publish module');
                          console.error('Failed to publish module:', error);
                        }
                      }}
                    >
                      <BookOpen 
                        className={`h-4 w-4 ${
                          module.status === 'draft' && module.ready_for_publish
                            ? 'text-[#d9f56b]'
                            : ''
                        }`}
                      />
                    </Button>

                    {/* ARCHIVE (Admin Only, Published Only) */}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={module.status !== 'published'}
                      title={
                        module.status !== 'published'
                          ? 'Only published modules can be archived'
                          : 'Archive module'
                      }
                      onClick={async () => {
                        try {
                          const response = await archiveModule(module.id);
                          if (response.data) {
                            await fetchData();
                            toast.success('Module archived successfully');
                          }
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to archive module');
                          console.error('Failed to archive module:', error);
                        }
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>

                    {/* DELETE MODULE */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Module</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{module.title}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                await deleteModule(module.id);
                                setModules((prev) =>
                                  prev.filter((m) => m.id !== module.id)
                                );
                                toast.success('Module deleted successfully');
                              } catch (error) {
                                toast.error('Failed to delete module');
                                console.error('Failed to delete module:', error);
                              }
                            }}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>

                {/* EXPANDED ROW: Enrolled Students */}
                {expandedModuleId === module.id && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="p-4">
                      <div>
                        <h4 className="mb-3 font-semibold">Enrolled Students</h4>
                        {module.students && module.students.length > 0 ? (
                          <div className="space-y-2">
                            {module.students.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center justify-between rounded-md bg-background p-2 text-sm"
                              >
                                <div>
                                  <div className="font-medium">
                                    {student.full_name || 'No name'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {student.email}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No students enrolled yet.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
            </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
