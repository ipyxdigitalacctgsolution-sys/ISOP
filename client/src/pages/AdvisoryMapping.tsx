import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { EducationalLevel, StaffTeacher, Enrollee, AdvisoryMapping } from "@shared/schema";
import { BASIC_ED_LEVELS } from "@shared/schema";
import { generateSchoolYears, getCurrentSchoolYear, isSchoolYearLocked } from "@/lib/educational-levels-data";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { addPdfHeader } from "@/lib/pdf-header";
import autoTable from "jspdf-autotable";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Search,
  Users,
  Printer,
  UserPlus,
  X,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Lock,
} from "lucide-react";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

export default function AdvisoryMappingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const schoolYears = generateSchoolYears();

  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classDialogLevelId, setClassDialogLevelId] = useState<number | null>(null);
  const [classDialogSection, setClassDialogSection] = useState("");
  const [classDialogLevel, setClassDialogLevel] = useState<EducationalLevel | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});

  const levelsQuery = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      return res.json();
    },
  });

  const staffQuery = useQuery<StaffTeacher[]>({
    queryKey: [api.staff.list.path],
  });

  const enrolleesQuery = useQuery<Enrollee[]>({
    queryKey: [api.enrollees.list.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.enrollees.list.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      return res.json();
    },
  });

  const advisoryQuery = useQuery<AdvisoryMapping[]>({
    queryKey: [api.advisory.list.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.advisory.list.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      return res.json();
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.advisory.upsert.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.advisory.list.path, selectedSY] });
    },
  });

  const levels = levelsQuery.data || [];
  const allStaff = staffQuery.data || [];
  const allEnrollees = enrolleesQuery.data || [];
  const advisoryMappings = advisoryQuery.data || [];

  const advisoryByKey = useMemo(() => {
    const map: Record<string, AdvisoryMapping> = {};
    advisoryMappings.forEach(m => {
      map[`${m.educationalLevelId}_${m.section}`] = m;
    });
    return map;
  }, [advisoryMappings]);

  const basicEdLevels = useMemo(() => {
    return levels.filter(l => BASIC_ED_LEVELS.includes(l.level.parentLevel));
  }, [levels]);

  const levelGroups = useMemo(() => {
    const groups: Record<string, LevelWithCount[]> = {};
    basicEdLevels.forEach(l => {
      const parent = l.level.parentLevel;
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(l);
    });
    return groups;
  }, [basicEdLevels]);

  const allAssignedStudentIds = useMemo(() => {
    const ids = new Set<number>();
    advisoryMappings.forEach(m => {
      (m.studentIds as number[] || []).forEach(id => ids.add(id));
    });
    return ids;
  }, [advisoryMappings]);

  const getAdvisersForLevel = (childLevel: string) => {
    return allStaff.filter(s =>
      s.status === "Active" &&
      s.designatedGradeLevel === childLevel
    );
  };

  const getStudentsForLevel = (levelId: number) => {
    return allEnrollees.filter(e => e.educationalLevelId === levelId);
  };

  const handleAdviserChange = (levelId: number, section: string, adviserId: string) => {
    const existing = advisoryByKey[`${levelId}_${section}`];
    upsertMutation.mutate({
      schoolYear: selectedSY,
      educationalLevelId: levelId,
      section,
      adviserId: adviserId && adviserId !== "none" ? parseInt(adviserId) : null,
      studentIds: existing?.studentIds || [],
    });
  };

  const openClassDialog = (levelId: number, section: string, level: EducationalLevel) => {
    setClassDialogLevelId(levelId);
    setClassDialogSection(section);
    setClassDialogLevel(level);
    const existing = advisoryByKey[`${levelId}_${section}`];
    setSelectedStudentIds((existing?.studentIds as number[]) || []);
    setStudentSearchTerm("");
    setClassDialogOpen(true);
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const saveClassAssignment = () => {
    if (!classDialogLevelId) return;
    const existing = advisoryByKey[`${classDialogLevelId}_${classDialogSection}`];
    upsertMutation.mutate({
      schoolYear: selectedSY,
      educationalLevelId: classDialogLevelId,
      section: classDialogSection,
      adviserId: existing?.adviserId || null,
      studentIds: selectedStudentIds,
    }, {
      onSuccess: () => {
        toast({ title: "Class assignment saved" });
        setClassDialogOpen(false);
      },
    });
  };

  const availableStudentsForDialog = useMemo(() => {
    if (!classDialogLevelId) return [];
    const levelStudents = getStudentsForLevel(classDialogLevelId);
    const currentKey = `${classDialogLevelId}_${classDialogSection}`;

    const otherAssignedIds = new Set<number>();
    advisoryMappings.forEach(m => {
      const key = `${m.educationalLevelId}_${m.section}`;
      if (key !== currentKey) {
        (m.studentIds as number[] || []).forEach(id => otherAssignedIds.add(id));
      }
    });

    return levelStudents.filter(s => {
      if (otherAssignedIds.has(s.id) && !selectedStudentIds.includes(s.id)) return false;
      if (studentSearchTerm) {
        const term = studentSearchTerm.toLowerCase();
        const name = `${s.lastName} ${s.firstName} ${s.middleName || ""}`.toLowerCase();
        return name.includes(term);
      }
      return true;
    });
  }, [classDialogLevelId, classDialogSection, allEnrollees, advisoryMappings, selectedStudentIds, studentSearchTerm]);

  const enrolleesById = useMemo(() => {
    const map: Record<number, Enrollee> = {};
    allEnrollees.forEach(e => { map[e.id] = e; });
    return map;
  }, [allEnrollees]);

  const staffById = useMemo(() => {
    const map: Record<number, StaffTeacher> = {};
    allStaff.forEach(s => { map[s.id] = s; });
    return map;
  }, [allStaff]);

  const toggleLevel = (parent: string) => {
    setExpandedLevels(prev => ({ ...prev, [parent]: !prev[parent] }));
  };

  const calculateAge = (dob: string) => {
    if (!dob) return "";
    const parts = dob.split(/[\/\-]/);
    let birthDate: Date;
    if (parts.length === 3) {
      if (parts[0].length === 4) birthDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      else birthDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else return "";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return String(age);
  };

  const handlePrintClassList = (levelId: number, section: string, level: EducationalLevel) => {
    const mapping = advisoryByKey[`${levelId}_${section}`];
    if (!mapping || !(mapping.studentIds as number[]).length) {
      toast({ title: "No students assigned to this section", variant: "destructive" });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let y = addPdfHeader(doc, user!);


    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ADVISORY CLASS LIST", pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`School Year: ${selectedSY}`, 14, y);

    const adviser = mapping.adviserId ? staffById[mapping.adviserId] : null;
    doc.text(`Adviser: ${adviser ? `${adviser.lastName}, ${adviser.firstName}` : "N/A"}`, pageWidth / 2, y);
    y += 5;

    const levelLabel = level.grandchildLevel
      ? `${level.parentLevel} - ${level.childLevel} - ${level.grandchildLevel}`
      : `${level.parentLevel} - ${level.childLevel}`;
    doc.text(`Grade Level: ${levelLabel}`, 14, y);
    doc.text(`Section: ${section}`, pageWidth / 2, y);
    y += 5;

    const studentIds = mapping.studentIds as number[];
    const students = studentIds.map(id => enrolleesById[id]).filter(Boolean);
    const males = students.filter(s => s.sex === "Male").sort((a, b) => a.lastName.localeCompare(b.lastName));
    const females = students.filter(s => s.sex === "Female").sort((a, b) => a.lastName.localeCompare(b.lastName));

    doc.text(`Total: ${students.length}  |  Male: ${males.length}  |  Female: ${females.length}`, 14, y);
    y += 8;

    if (males.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("MALE", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["#", "Name of Student", "Birthdate", "Age", "Sex"]],
        body: males.map((s, i) => [
          String(i + 1),
          `${s.lastName}, ${s.firstName} ${s.middleName || ""}`.trim(),
          s.dateOfBirth || "",
          calculateAge(s.dateOfBirth),
          s.sex,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (females.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text("FEMALE", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["#", "Name of Student", "Birthdate", "Age", "Sex"]],
        body: females.map((s, i) => [
          String(i + 1),
          `${s.lastName}, ${s.firstName} ${s.middleName || ""}`.trim(),
          s.dateOfBirth || "",
          calculateAge(s.dateOfBirth),
          s.sex,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`Advisory_Class_${levelLabel.replace(/\s+/g, "_")}_${section}.pdf`);
  };

  const isLoading = levelsQuery.isLoading || staffQuery.isLoading || enrolleesQuery.isLoading || advisoryQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Advisory Mapping
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign advisers and create class sections for Basic Education
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">School Year</Label>
          <Select value={selectedSY} onValueChange={setSelectedSY}>
            <SelectTrigger className="w-40" data-testid="select-school-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map(sy => (
                <SelectItem key={sy} value={sy}>{sy}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {syLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-2 flex items-center gap-2 text-amber-400 text-sm">
          <Lock className="w-4 h-4" />
          <span>SY {selectedSY} is locked. You are viewing read-only data from a past school year.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : basicEdLevels.length === 0 ? (
        <Card className="border-border">
          <CardContent className="text-center py-16">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">No Basic Education levels configured for this school year.</p>
            <p className="text-muted-foreground text-sm mt-1">Add levels in Educational Levels first.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(levelGroups).map(([parentLevel, groupLevels]) => (
            <Card key={parentLevel} className="border-border">
              <CardHeader className="pb-2">
                <button
                  onClick={() => toggleLevel(parentLevel)}
                  className="flex items-center justify-between w-full text-left"
                  data-testid={`button-toggle-${parentLevel}`}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    {parentLevel}
                  </CardTitle>
                  {expandedLevels[parentLevel] === false ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CardHeader>
              {expandedLevels[parentLevel] !== false && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Level</TableHead>
                          <TableHead>Sub-Level</TableHead>
                          <TableHead>Section</TableHead>
                          <TableHead>Adviser</TableHead>
                          <TableHead>Students</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupLevels.flatMap(({ level }) => {
                          const sections = (level.sections as string[]) || [];
                          if (sections.length === 0) {
                            return [(
                              <TableRow key={level.id}>
                                <TableCell>{level.parentLevel}</TableCell>
                                <TableCell>{level.childLevel}{level.grandchildLevel ? ` - ${level.grandchildLevel}` : ""}</TableCell>
                                <TableCell className="text-muted-foreground italic">No sections</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>-</TableCell>
                                <TableCell>-</TableCell>
                              </TableRow>
                            )];
                          }
                          return sections.map((section, sIdx) => {
                            const key = `${level.id}_${section}`;
                            const mapping = advisoryByKey[key];
                            const assignedCount = (mapping?.studentIds as number[] || []).length;
                            const possibleAdvisers = getAdvisersForLevel(level.childLevel);

                            return (
                              <TableRow key={`${level.id}-${section}`}>
                                {sIdx === 0 && (
                                  <>
                                    <TableCell rowSpan={sections.length} className="align-top font-medium">
                                      {level.parentLevel}
                                    </TableCell>
                                    <TableCell rowSpan={sections.length} className="align-top">
                                      {level.childLevel}{level.grandchildLevel ? ` - ${level.grandchildLevel}` : ""}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {section}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={mapping?.adviserId ? String(mapping.adviserId) : "none"}
                                    onValueChange={v => handleAdviserChange(level.id, section, v)}
                                  >
                                    <SelectTrigger className="w-48" data-testid={`select-adviser-${level.id}-${sIdx}`}>
                                      <SelectValue placeholder="Select Adviser" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">-- None --</SelectItem>
                                      {possibleAdvisers.map(a => (
                                        <SelectItem key={a.id} value={String(a.id)}>
                                          {a.lastName}, {a.firstName}
                                        </SelectItem>
                                      ))}
                                      {possibleAdvisers.length === 0 && (
                                        <div className="px-2 py-1 text-xs text-muted-foreground">
                                          No staff assigned to {level.childLevel}
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">
                                    {assignedCount} student{assignedCount !== 1 ? "s" : ""}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openClassDialog(level.id, section, level)}
                                      data-testid={`button-create-class-${level.id}-${sIdx}`}
                                    >
                                      <UserPlus className="w-3 h-3 mr-1" />
                                      Create Class
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handlePrintClassList(level.id, section, level)}
                                      data-testid={`button-print-class-${level.id}-${sIdx}`}
                                    >
                                      <Printer className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Create Class - {classDialogLevel?.childLevel} / {classDialogSection}
            </DialogTitle>
          </DialogHeader>

          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                className="pl-9"
                value={studentSearchTerm}
                onChange={e => setStudentSearchTerm(e.target.value)}
                data-testid="input-search-students"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selected: {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? "s" : ""}
              {" | "}Click a student name to assign/unassign
            </p>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-md">
            {availableStudentsForDialog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No students enrolled in this level</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Date of Birth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableStudentsForDialog.map(student => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <TableRow
                        key={student.id}
                        className={`cursor-pointer ${isSelected ? "bg-primary/10" : ""}`}
                        onClick={() => toggleStudent(student.id)}
                        data-testid={`row-student-${student.id}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.lastName}, {student.firstName} {student.middleName || ""}
                        </TableCell>
                        <TableCell>{student.sex}</TableCell>
                        <TableCell>{student.dateOfBirth}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setClassDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveClassAssignment}
              disabled={upsertMutation.isPending || syLocked}
              data-testid="button-save-class"
            >
              {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Class Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
