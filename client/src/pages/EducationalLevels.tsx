import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { EducationalLevel } from "@shared/schema";
import { EDUCATIONAL_HIERARCHY, generateSchoolYears, getCurrentSchoolYear, isSchoolYearLocked, type LevelOption } from "@/lib/educational-levels-data";
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
import { 
  Plus, 
  Trash2, 
  X, 
  Printer, 
  GraduationCap, 
  Users, 
  School, 
  BookOpen, 
  Loader2, 
  FileText, 
  History, 
  ArrowLeft, 
  Edit, 
  Lock,
  GripVertical
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

function SortableRow({
  entry,
  handleRemoveSection,
  setEditingLevelId,
  setSectionDialogOpen,
  deleteMutation,
  syLocked
}: {
  entry: LevelWithCount;
  handleRemoveSection: (id: number, idx: number) => void;
  setEditingLevelId: (id: number) => void;
  setSectionDialogOpen: (open: boolean) => void;
  deleteMutation: any;
  syLocked: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.level.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  const sections = (entry.level.sections as string[]) || [];

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-testid={`row-level-${entry.level.id}`}
      className={isDragging ? "bg-accent/50" : ""}
    >
      <TableCell className="w-[40px]">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{entry.level.parentLevel}</TableCell>
      <TableCell>{entry.level.childLevel}</TableCell>
      <TableCell>{entry.level.grandchildLevel || "-"}</TableCell>
      <TableCell>{entry.level.yearLevel || "-"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5 items-center">
          {sections.map((sec, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="text-xs"
              data-testid={`badge-section-${entry.level.id}-${idx}`}
            >
              {sec}
              <button
                onClick={() => handleRemoveSection(entry.level.id, idx)}
                className="ml-1 opacity-60 hover:opacity-100"
                data-testid={`button-remove-section-${entry.level.id}-${idx}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => {
              setEditingLevelId(entry.level.id);
              setSectionDialogOpen(true);
            }}
            data-testid={`button-add-section-${entry.level.id}`}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant={entry.studentCount > 0 ? "default" : "secondary"}
          data-testid={`badge-enrolled-${entry.level.id}`}
        >
          {entry.studentCount}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditingLevelId(entry.level.id);
              setSectionDialogOpen(true);
            }}
            data-testid={`button-edit-level-${entry.level.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            disabled={entry.studentCount >= 1 || syLocked}
            onClick={() => {
              if (confirm("Are you sure you want to remove this educational level? This cannot be undone.")) {
                deleteMutation.mutate(entry.level.id);
              }
            }}
            data-testid={`button-delete-level-${entry.level.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function EducationalLevelsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const [viewMode, setViewMode] = useState<"form" | "registry">("form");
  const [isSectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [newSectionName, setNewSectionName] = useState("");

  const [selectedParent, setSelectedParent] = useState("");
  const [selectedChild, setSelectedChild] = useState("");
  const [selectedGrandchild, setSelectedGrandchild] = useState("");
  const [selectedYearLevel, setSelectedYearLevel] = useState("");
  const [parentOther, setParentOther] = useState("");
  const [childOther, setChildOther] = useState("");
  const [grandchildOther, setGrandchildOther] = useState("");

  const schoolYears = useMemo(() => generateSchoolYears(), []);

  const { data: levelsData, isLoading } = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch levels");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.academic.createLevel.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Level registered successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const url = buildUrl(api.academic.updateLevel.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Level updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.academic.deleteLevel.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Level removed" });
    },
    onError: (err: any) => {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      const res = await apiRequest("PATCH", api.academic.reorderLevels.path, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && levelsData) {
      const oldIndex = levelsData.findIndex((l) => l.level.id === active.id);
      const newIndex = levelsData.findIndex((l) => l.level.id === over.id);

      const newItems = arrayMove(levelsData, oldIndex, newIndex);
      // Update local cache immediately for UI responsiveness
      queryClient.setQueryData([api.academic.listLevels.path, selectedSY], newItems);

      // Persist to server
      const updates = newItems.map((item, index) => ({
        id: item.level.id,
        order: index,
      }));
      reorderMutation.mutate(updates);
    }
  };

  const resetForm = () => {
    setSelectedParent("");
    setSelectedChild("");
    setSelectedGrandchild("");
    setSelectedYearLevel("");
    setParentOther("");
    setChildOther("");
    setGrandchildOther("");
  };

  const parentOptions = EDUCATIONAL_HIERARCHY;
  const childOptions = useMemo(() => {
    if (!selectedParent) return [];
    const parent = EDUCATIONAL_HIERARCHY.find((h) => h.value === selectedParent);
    return parent?.children || [];
  }, [selectedParent]);

  const grandchildOptions = useMemo(() => {
    if (!selectedChild || !selectedParent) return [];
    const parent = EDUCATIONAL_HIERARCHY.find((h) => h.value === selectedParent);
    const child = parent?.children?.find((c) => c.value === selectedChild);
    return child?.children || [];
  }, [selectedParent, selectedChild]);

  const handleSubmit = () => {
    const parentLevel = selectedParent === "Others" ? parentOther : selectedParent;
    const childLevel = selectedChild === "Others" ? childOther : selectedChild;
    const grandchild = selectedGrandchild === "Others" ? grandchildOther : selectedGrandchild;

    if (!parentLevel || !childLevel) {
      toast({ title: "Please fill required fields (Level & Sub-Level)", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      schoolYear: selectedSY,
      parentLevel,
      childLevel,
      grandchildLevel: grandchild || null,
      yearLevel: selectedYearLevel || null,
      parentLevelOther: selectedParent === "Others" ? parentOther : null,
      childLevelOther: selectedChild === "Others" ? childOther : null,
      grandchildLevelOther: selectedGrandchild === "Others" ? grandchildOther : null,
      sections: [],
      isActive: true,
    });
  };

  const handleAddSection = () => {
    if (!editingLevelId || !newSectionName.trim()) return;
    const levelEntry = levelsData?.find((l) => l.level.id === editingLevelId);
    if (!levelEntry) return;

    const currentSections = (levelEntry.level.sections as string[]) || [];
    const updatedSections = [...currentSections, newSectionName.trim()];

    updateMutation.mutate({
      id: editingLevelId,
      data: { sections: updatedSections },
    });
    setNewSectionName("");
  };

  const handleRemoveSection = (levelId: number, sectionIndex: number) => {
    const levelEntry = levelsData?.find((l) => l.level.id === levelId);
    if (!levelEntry) return;
    const currentSections = (levelEntry.level.sections as string[]) || [];
    const updatedSections = currentSections.filter((_, i) => i !== sectionIndex);
    updateMutation.mutate({ id: levelId, data: { sections: updatedSections } });
  };

  const totalEnrolled = useMemo(() => {
    return levelsData?.reduce((sum, l) => sum + l.studentCount, 0) || 0;
  }, [levelsData]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { count: number; students: number }> = {};
    levelsData?.forEach((l) => {
      const parent = l.level.parentLevel;
      if (!counts[parent]) counts[parent] = { count: 0, students: 0 };
      counts[parent].count += 1;
      counts[parent].students += l.studentCount;
    });
    return counts;
  }, [levelsData]);

  const categoryIcons: Record<string, any> = {
    "Pre-School": School,
    "Primary": BookOpen,
    "Junior High": GraduationCap,
    "Senior High": GraduationCap,
    "TVET": FileText,
    "Tertiary": GraduationCap,
    "Professional Degree": FileText,
    "Graduate Education": GraduationCap,
  };

  const handlePrintReport = () => {
    if (!user || !levelsData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let startY = addPdfHeader(doc, user);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Educational Levels Report - SY ${selectedSY}`, pageWidth / 2, startY, { align: "center" });
    startY += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Students Enrolled: ${totalEnrolled}`, pageWidth / 2, startY, { align: "center" });
    startY += 6;

    const tableData = levelsData.map((l) => [
      l.level.parentLevel,
      l.level.childLevel,
      l.level.grandchildLevel || "-",
      l.level.yearLevel || "-",
      ((l.level.sections as string[]) || []).join(", ") || "No sections",
      l.studentCount.toString(),
    ]);

    autoTable(doc, {
      startY: startY,
      head: [["Level", "Sub-Level", "Category", "Year Level", "Sections", "Enrolled"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [44, 62, 80],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 14, right: 14 },
      styles: {
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.25,
      },
    });

    const getTableEndY = (fallback: number) => (doc as any).lastAutoTable?.finalY ?? (doc as any).previousAutoTable?.finalY ?? fallback;
    const finalY = getTableEndY(startY + 60);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      finalY + 12,
      { align: "center" }
    );

    doc.save(`Educational_Levels_${selectedSY}.pdf`);
    toast({ title: "PDF report downloaded" });
  };

  const isHigherEd = ["TVET", "Tertiary", "Professional Degree", "Graduate Education"].includes(selectedParent);

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="educational-levels-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">
            Educational Levels
          </h1>
          <p className="text-muted-foreground text-sm">Academic Programs Management</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selectedSY} onValueChange={setSelectedSY}>
            <SelectTrigger className="w-[150px]" data-testid="select-school-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((sy) => (
                <SelectItem key={sy} value={sy} data-testid={`option-sy-${sy}`}>
                  SY {sy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode === "form" ? (
            <Button variant="outline" onClick={() => setViewMode("registry")} data-testid="button-view-registry">
              <History className="w-4 h-4 mr-2" />
              Levels Registry
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setViewMode("form")} data-testid="button-view-form">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Register Level
            </Button>
          )}
          <Button variant="outline" onClick={handlePrintReport} disabled={!levelsData?.length} data-testid="button-print-report">
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {syLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-2 flex items-center gap-2 text-amber-400 text-sm">
          <Lock className="w-4 h-4" />
          <span>SY {selectedSY} is locked. You are viewing read-only data from a past school year.</span>
        </div>
      )}

      {viewMode === "form" ? (
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              Register Educational Level
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Educational Level *</Label>
                <Select
                  value={selectedParent}
                  onValueChange={(v) => {
                    setSelectedParent(v);
                    setSelectedChild("");
                    setSelectedGrandchild("");
                    setChildOther("");
                    setGrandchildOther("");
                  }}
                >
                  <SelectTrigger data-testid="select-parent-level">
                    <SelectValue placeholder="Select level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedParent === "Others" && (
                  <Input
                    placeholder="Specify level..."
                    value={parentOther}
                    onChange={(e) => setParentOther(e.target.value)}
                    data-testid="input-parent-other"
                  />
                )}
              </div>

              {(childOptions.length > 0 || selectedParent === "Others") && selectedParent !== "Others" && (
                <div className="space-y-2">
                  <Label>Sub-Level / Program *</Label>
                  <Select
                    value={selectedChild}
                    onValueChange={(v) => {
                      setSelectedChild(v);
                      setSelectedGrandchild("");
                      setGrandchildOther("");
                    }}
                  >
                    <SelectTrigger data-testid="select-child-level">
                      <SelectValue placeholder="Select sub-level..." />
                    </SelectTrigger>
                    <SelectContent>
                      {childOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedChild === "Others" && (
                    <Input
                      placeholder="Specify sub-level..."
                      value={childOther}
                      onChange={(e) => setChildOther(e.target.value)}
                      data-testid="input-child-other"
                    />
                  )}
                </div>
              )}

              {selectedParent === "Others" && (
                <div className="space-y-2">
                  <Label>Sub-Level / Program *</Label>
                  <Input
                    placeholder="Enter sub-level..."
                    value={selectedChild || childOther}
                    onChange={(e) => {
                      setSelectedChild("");
                      setChildOther(e.target.value);
                    }}
                    data-testid="input-child-freeform"
                  />
                </div>
              )}

              {grandchildOptions.length > 0 && selectedChild && selectedChild !== "Others" && (
                <div className="space-y-2">
                  <Label>Qualification / Course / Specialization</Label>
                  <Select
                    value={selectedGrandchild}
                    onValueChange={setSelectedGrandchild}
                  >
                    <SelectTrigger data-testid="select-grandchild-level">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {grandchildOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGrandchild === "Others" && (
                    <Input
                      placeholder="Specify..."
                      value={grandchildOther}
                      onChange={(e) => setGrandchildOther(e.target.value)}
                      data-testid="input-grandchild-other"
                    />
                  )}
                </div>
              )}

              {isHigherEd && (
                <div className="space-y-2">
                  <Label>Year Level</Label>
                  <Select
                    value={selectedYearLevel}
                    onValueChange={setSelectedYearLevel}
                  >
                    <SelectTrigger data-testid="select-year-level">
                      <SelectValue placeholder="Select Year Level..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Others (Please specify)"].map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || syLocked}
                className="bg-emerald-600 text-white"
                data-testid="button-confirm-add"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Plus className="w-4 h-4 mr-2" />
                Register Level
              </Button>
              <Button variant="outline" onClick={resetForm} data-testid="button-reset-form">
                Clear Form
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30" data-testid="card-total-enrolled">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Overall Total Enrolled
                </CardTitle>
                <Users className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary" data-testid="text-total-enrolled-count">
                  {totalEnrolled}
                </div>
                <p className="text-xs text-muted-foreground mt-1">SY {selectedSY}</p>
              </CardContent>
            </Card>

            {Object.entries(categoryCounts).map(([category, data]) => {
              const Icon = categoryIcons[category] || GraduationCap;
              return (
                <Card key={category} className="border-border bg-card" data-testid={`card-category-${category}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                      {category}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-accent" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data.students}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data.count} level{data.count !== 1 ? "s" : ""} registered
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-border bg-card" data-testid="card-levels-table">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg">Registered Educational Levels</CardTitle>
              <Badge variant="secondary" data-testid="badge-level-count">
                {levelsData?.length || 0} Levels
              </Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !levelsData?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="p-4 rounded-full bg-secondary/50">
                    <School className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">No levels registered</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Switch to "Register Level" to add educational programs for SY {selectedSY}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Sub-Level</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Year Level</TableHead>
                          <TableHead>Sections</TableHead>
                          <TableHead className="text-center">Students Enrolled</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext
                          items={levelsData.map((l) => l.level.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {levelsData.map((entry) => (
                            <SortableRow
                              key={entry.level.id}
                              entry={entry}
                              handleRemoveSection={handleRemoveSection}
                              setEditingLevelId={setEditingLevelId}
                              setSectionDialogOpen={setSectionDialogOpen}
                              deleteMutation={deleteMutation}
                              syLocked={syLocked}
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isSectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-section">
          <DialogHeader>
            <DialogTitle>Manage Sections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingLevelId && (() => {
              const entry = levelsData?.find((l) => l.level.id === editingLevelId);
              if (!entry) return null;
              const sections = (entry.level.sections as string[]) || [];
              return (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {entry.level.parentLevel} &rarr; {entry.level.childLevel}
                    {entry.level.grandchildLevel ? ` &rarr; ${entry.level.grandchildLevel}` : ""}
                  </p>
                  {sections.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sections.map((sec, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {sec}
                          <button
                            onClick={() => handleRemoveSection(entry.level.id, idx)}
                            className="ml-1 opacity-60 hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Section name (e.g., Section A)"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); }}
                      data-testid="input-section-name"
                    />
                    <Button onClick={handleAddSection} disabled={!newSectionName.trim() || syLocked} data-testid="button-save-section">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSectionDialogOpen(false);
                setEditingLevelId(null);
                setNewSectionName("");
              }}
              data-testid="button-close-section-dialog"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
