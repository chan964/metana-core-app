import { useState, useEffect } from 'react';
import { getAllModules, deleteModule, assignInstructor, enrollStudent } from '@/api/modules';
import { getAllUsers } from '@/api/users';
import { Module, User } from '@/types';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Trash2, UserPlus, GraduationCap } from 'lucide-react';

export function ModuleManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [modulesResponse, usersResponse] = await Promise.all([
        getAllModules(),
        getAllUsers(),
      ]);
      if (modulesResponse.data) setModules(modulesResponse.data);
      if (usersResponse.data) setUsers(usersResponse.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteModule(id: string) {
    try {
      await deleteModule(id);
      setModules(modules.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Failed to delete module:', error);
    }
  }

  async function handleAssignInstructor() {
    if (!selectedModule || !selectedUserId) return;
    try {
      await assignInstructor(selectedModule.id, selectedUserId);
      setAssignDialogOpen(false);
      setSelectedUserId('');
      fetchData();
    } catch (error) {
      console.error('Failed to assign instructor:', error);
    }
  }

  async function handleEnrollStudent() {
    if (!selectedModule || !selectedUserId) return;
    try {
      await enrollStudent(selectedModule.id, selectedUserId);
      setEnrollDialogOpen(false);
      setSelectedUserId('');
    } catch (error) {
      console.error('Failed to enroll student:', error);
    }
  }

  const instructors = users.filter((u) => u.role === 'instructor');
  const students = users.filter((u) => u.role === 'student');

  const getInstructorName = (instructorId?: string) => {
    if (!instructorId) return 'Unassigned';
    const instructor = users.find((u) => u.id === instructorId);
    return instructor?.name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Module Management</CardTitle>
        <CardDescription>
          Manage modules, assign instructors, and enroll students
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No modules found. Modules are created via the backend API.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <TableRow key={module.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{module.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {module.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getInstructorName(module.instructorId)}</TableCell>
                  <TableCell>{module.partA.length + module.partB.length}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Dialog
                        open={assignDialogOpen && selectedModule?.id === module.id}
                        onOpenChange={(open) => {
                          setAssignDialogOpen(open);
                          if (open) setSelectedModule(module);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Assign Instructor">
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Assign Instructor</DialogTitle>
                            <DialogDescription>
                              Select an instructor for "{module.title}"
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label>Instructor</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select instructor" />
                              </SelectTrigger>
                              <SelectContent>
                                {instructors.map((instructor) => (
                                  <SelectItem key={instructor.id} value={instructor.id}>
                                    {instructor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAssignInstructor}>Assign</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog
                        open={enrollDialogOpen && selectedModule?.id === module.id}
                        onOpenChange={(open) => {
                          setEnrollDialogOpen(open);
                          if (open) setSelectedModule(module);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Enroll Student">
                            <GraduationCap className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Enroll Student</DialogTitle>
                            <DialogDescription>
                              Enroll a student in "{module.title}"
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label>Student</Label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select student" />
                              </SelectTrigger>
                              <SelectContent>
                                {students.map((student) => (
                                  <SelectItem key={student.id} value={student.id}>
                                    {student.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleEnrollStudent}>Enroll</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Module</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{module.title}"? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteModule(module.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
