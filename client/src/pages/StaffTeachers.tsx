import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { StaffTeacher, EducationalLevel, FacultyLoadEntry } from "@shared/schema";
import { STAFF_STATUSES, EMPLOYMENT_STATUSES, BASIC_ED_LEVELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { addPdfHeader, getImgFormat } from "@/lib/pdf-header";
import autoTable from "jspdf-autotable";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Printer,
  Loader2,
  Search,
  Edit,
  Users,
  Upload,
  Camera,
  SwitchCamera,
  X,
  ArrowLeft,
  FileText,
  UserPlus,
  RotateCcw,
} from "lucide-react";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};


const EMPTY_FORM: Omit<StaffTeacher, "id" | "createdAt"> = {
  schoolId: 0,
  employeeId: "",
  lastName: "",
  firstName: "",
  middleName: "",
  gender: "Male",
  contactNumber: "",
  email: "",
  employmentStatus: "Regular",
  dateOfHire: "",
  highestEducationalAttainment: "",
  status: "Active",
  photoUrl: "",
  designatedGradeLevel: "",
  sectionAssigned: "",
  isClassAdviser: false,
  subjectSpecialization: "",
  roomAssignment: "",
  department: "",
  academicRank: "",
  prcLicenseNo: "",
  facultyLoad: [],
  researchSpecialization: "",
};

export default function StaffTeachersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [view, setView] = useState<"form" | "registry">("form");
  const [formData, setFormData] = useState<any>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [activeFormTab, setActiveFormTab] = useState("common");

  const staffQuery = useQuery<StaffTeacher[]>({
    queryKey: [api.staff.list.path],
  });

  const levelsQuery = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.staff.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.staff.list.path] });
      toast({ title: "Staff member added successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", buildUrl(api.staff.update.path, { id }), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.staff.list.path] });
      toast({ title: "Staff member updated successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", buildUrl(api.staff.delete.path, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.staff.list.path] });
      toast({ title: "Staff member deleted" });
      setDeleteConfirmId(null);
    },
  });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setActiveFormTab("common");
  };

  const handleEdit = (staff: StaffTeacher) => {
    setFormData({ ...staff });
    setEditingId(staff.id);
    setView("form");
    setActiveFormTab("common");
  };

  const handleSubmit = () => {
    if (!formData.lastName || !formData.firstName || !formData.gender) {
      toast({ title: "Please fill in required fields (Last Name, First Name, Gender)", variant: "destructive" });
      return;
    }
    const payload = { ...formData, schoolId: user!.id };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append("photo", file);
    try {
      const res = await apiRequest("POST", "/api/upload/photo", formDataUpload);
      const data = await res.json();
      setFormData((prev: any) => ({ ...prev, photoUrl: data.url }));
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    }
  };

  const startCamera = useCallback(async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast({ title: "Camera access denied", variant: "destructive" });
      setShowCamera(false);
    }
  }, [facingMode, toast]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    try {
      const res = await apiRequest("POST", "/api/upload/photo-base64", { image: dataUrl });
      const data = await res.json();
      setFormData((prev: any) => ({ ...prev, photoUrl: data.url }));
    } catch {
      toast({ title: "Failed to save photo", variant: "destructive" });
    }
  }, [stopCamera, toast]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const addFacultyLoad = () => {
    const current = formData.facultyLoad || [];
    setFormData((prev: any) => ({
      ...prev,
      facultyLoad: [...current, { subjectCode: "", subjectName: "", units: 0 }],
    }));
  };

  const updateFacultyLoad = (index: number, field: string, value: any) => {
    const updated = [...(formData.facultyLoad || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, facultyLoad: updated }));
  };

  const removeFacultyLoad = (index: number) => {
    const updated = (formData.facultyLoad || []).filter((_: any, i: number) => i !== index);
    setFormData((prev: any) => ({ ...prev, facultyLoad: updated }));
  };

  const staffList = staffQuery.data || [];

  const basicEdGradeLevels = useMemo(() => {
    const levels = levelsQuery.data || [];
    const basicEdParents = ["Pre-School", "Primary", "Junior High", "Senior High"];
    const uniqueLevels: string[] = [];
    levels.forEach(({ level }) => {
      if (basicEdParents.includes(level.parentLevel)) {
        const name = level.childLevel === "Other" ? (level.childLevelOther || level.childLevel) : level.childLevel;
        if (name && !uniqueLevels.includes(name)) {
          uniqueLevels.push(name);
        }
      }
    });
    return uniqueLevels;
  }, [levelsQuery.data]);

  const sectionsForSelectedLevel = useMemo(() => {
    const levels = levelsQuery.data || [];
    const selected = formData.designatedGradeLevel;
    if (!selected) return [];
    const allSections: string[] = [];
    levels.forEach(({ level }) => {
      const childName = level.childLevel === "Other" ? (level.childLevelOther || level.childLevel) : level.childLevel;
      if (childName === selected && level.sections) {
        (level.sections as string[]).forEach(s => {
          if (s && !allSections.includes(s)) allSections.push(s);
        });
      }
    });
    return allSections;
  }, [levelsQuery.data, formData.designatedGradeLevel]);

  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staffList;
    const term = searchTerm.toLowerCase();
    return staffList.filter(s =>
      `${s.lastName} ${s.firstName} ${s.middleName || ""}`.toLowerCase().includes(term) ||
      (s.employeeId || "").toLowerCase().includes(term) ||
      (s.email || "").toLowerCase().includes(term)
    );
  }, [staffList, searchTerm]);

  const statusColor = (status: string | null) => {
    switch (status) {
      case "Active": return "bg-emerald-500/20 text-emerald-400";
      case "On Leave": return "bg-yellow-500/20 text-yellow-400";
      case "AWOL": return "bg-red-500/20 text-red-400";
      case "Retired": return "bg-blue-500/20 text-blue-400";
      case "Resigned": return "bg-orange-500/20 text-orange-400";
      case "Fired": return "bg-red-700/20 text-red-500";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const handlePrintIndividual = (staff: StaffTeacher) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let y = addPdfHeader(doc, user!);

    if (staff.photoUrl) {
      try { doc.addImage(staff.photoUrl, getImgFormat(staff.photoUrl), pageWidth - 14 - 25, y, 25, 30); } catch {}
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("STAFF / TEACHER INFORMATION FORM", pageWidth / 2, y, { align: "center" });
    y += 10;

    const addField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(label + ":", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value || "N/A", 70, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    };

    addField("Employee ID", staff.employeeId || "");
    addField("Name", `${staff.lastName}, ${staff.firstName} ${staff.middleName || ""}`);
    addField("Gender", staff.gender);
    addField("Contact Number", staff.contactNumber || "");
    addField("Email", staff.email || "");
    addField("Employment Status", staff.employmentStatus || "");
    addField("Date of Hire", staff.dateOfHire || "");
    addField("Highest Educ. Attainment", staff.highestEducationalAttainment || "");
    addField("Status", staff.status || "");
    y += 4;
    addField("Grade Level (Basic Ed)", staff.designatedGradeLevel || "");
    addField("Section Assigned", staff.sectionAssigned || "");
    addField("Class Adviser", staff.isClassAdviser ? "Yes" : "No");
    addField("Subject Specialization", staff.subjectSpecialization || "");
    addField("Room Assignment", staff.roomAssignment || "");
    y += 4;
    addField("Department/College", staff.department || "");
    addField("Academic Rank", staff.academicRank || "");
    addField("PRC License No.", staff.prcLicenseNo || "");
    addField("Research Specialization", staff.researchSpecialization || "");

    if (staff.facultyLoad && (staff.facultyLoad as FacultyLoadEntry[]).length > 0) {
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.text("Faculty Load:", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Subject Code", "Subject Name", "Units"]],
        body: (staff.facultyLoad as FacultyLoadEntry[]).map(f => [f.subjectCode, f.subjectName || "", String(f.units || 0)]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`Staff_${staff.lastName}_${staff.firstName}.pdf`);
  };

  const handlePrintSummary = () => {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();

    let y = addPdfHeader(doc, user!, { orientation: "landscape" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("STAFF AND TEACHERS REGISTRY", pageWidth / 2, y, { align: "center" });
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["#", "Employee ID", "Name", "Gender", "Contact", "Employment", "Grade Level", "Department", "Status"]],
      body: filteredStaff.map((s, i) => [
        String(i + 1),
        s.employeeId || "",
        `${s.lastName}, ${s.firstName} ${s.middleName || ""}`.trim(),
        s.gender,
        s.contactNumber || "",
        s.employmentStatus || "",
        s.designatedGradeLevel || "",
        s.department || "",
        s.status || "",
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14, right: 14 },
    });

    doc.save("Staff_Teachers_Summary.pdf");
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Staff and Teachers Registry
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage staff and teacher records
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={view === "form" ? "default" : "outline"}
            size="sm"
            onClick={() => { setView("form"); resetForm(); }}
            data-testid="button-form-view"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Entry Form
          </Button>
          <Button
            variant={view === "registry" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("registry")}
            data-testid="button-registry-view"
          >
            <Users className="w-4 h-4 mr-1" />
            Registry
          </Button>
        </div>
      </div>

      {view === "form" && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {editingId ? (
                <>
                  <Edit className="w-5 h-5 text-primary" />
                  Edit Staff / Teacher
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-primary" />
                  New Staff / Teacher
                </>
              )}
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm} className="ml-auto">
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex flex-col items-center gap-3 lg:w-48 shrink-0">
                <div className="w-36 h-44 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Staff photo" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-12 h-12 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-photo"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Upload
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startCamera}
                    data-testid="button-take-photo"
                  >
                    <Camera className="w-3 h-3 mr-1" />
                    Camera
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                />
                {formData.photoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateField("photoUrl", "")}
                    className="text-xs text-destructive"
                    data-testid="button-remove-photo"
                  >
                    <X className="w-3 h-3 mr-1" /> Remove
                  </Button>
                )}
              </div>

              <div className="flex-1">
                <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="common" data-testid="tab-common">Common Info</TabsTrigger>
                    <TabsTrigger value="basic-ed" data-testid="tab-basic-ed">Basic Education</TabsTrigger>
                    <TabsTrigger value="higher-ed" data-testid="tab-higher-ed">Higher Education</TabsTrigger>
                  </TabsList>

                  <TabsContent value="common" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Employee ID</Label>
                        <Input
                          value={formData.employeeId || ""}
                          onChange={e => updateField("employeeId", e.target.value)}
                          placeholder="System tracking ID"
                          data-testid="input-employee-id"
                        />
                      </div>
                      <div>
                        <Label>Last Name <span className="text-destructive">*</span></Label>
                        <Input
                          value={formData.lastName || ""}
                          onChange={e => updateField("lastName", e.target.value)}
                          data-testid="input-last-name"
                        />
                      </div>
                      <div>
                        <Label>First Name <span className="text-destructive">*</span></Label>
                        <Input
                          value={formData.firstName || ""}
                          onChange={e => updateField("firstName", e.target.value)}
                          data-testid="input-first-name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Middle Name</Label>
                        <Input
                          value={formData.middleName || ""}
                          onChange={e => updateField("middleName", e.target.value)}
                          data-testid="input-middle-name"
                        />
                      </div>
                      <div>
                        <Label>Gender <span className="text-destructive">*</span></Label>
                        <Select value={formData.gender} onValueChange={v => updateField("gender", v)}>
                          <SelectTrigger data-testid="select-gender"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Contact Number</Label>
                        <Input
                          value={formData.contactNumber || ""}
                          onChange={e => updateField("contactNumber", e.target.value)}
                          data-testid="input-contact-number"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Email</Label>
                        <Input
                          value={formData.email || ""}
                          onChange={e => updateField("email", e.target.value)}
                          type="email"
                          data-testid="input-email"
                        />
                      </div>
                      <div>
                        <Label>Employment Status</Label>
                        <Select value={formData.employmentStatus || ""} onValueChange={v => updateField("employmentStatus", v)}>
                          <SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EMPLOYMENT_STATUSES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Date of Hire (MM/DD/YYYY)</Label>
                        <Input
                          value={formData.dateOfHire || ""}
                          onChange={e => updateField("dateOfHire", e.target.value)}
                          placeholder="01/15/2020"
                          data-testid="input-date-of-hire"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Highest Educational Attainment</Label>
                        <Input
                          value={formData.highestEducationalAttainment || ""}
                          onChange={e => updateField("highestEducationalAttainment", e.target.value)}
                          data-testid="input-education"
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={formData.status || "Active"} onValueChange={v => updateField("status", v)}>
                          <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAFF_STATUSES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="basic-ed" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Designated Grade Level</Label>
                        <Select value={formData.designatedGradeLevel || ""} onValueChange={v => { updateField("designatedGradeLevel", v); updateField("sectionAssigned", ""); }}>
                          <SelectTrigger data-testid="select-grade-level"><SelectValue placeholder="Select grade level" /></SelectTrigger>
                          <SelectContent>
                            {basicEdGradeLevels.length > 0 ? basicEdGradeLevels.map(g => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            )) : (
                              <SelectItem value="__none" disabled>No levels registered</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Section Assigned</Label>
                        <Select value={formData.sectionAssigned || ""} onValueChange={v => updateField("sectionAssigned", v)} disabled={!formData.designatedGradeLevel}>
                          <SelectTrigger data-testid="select-section-assigned"><SelectValue placeholder={formData.designatedGradeLevel ? "Select section" : "Select grade level first"} /></SelectTrigger>
                          <SelectContent>
                            {sectionsForSelectedLevel.length > 0 ? sectionsForSelectedLevel.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            )) : (
                              <SelectItem value="__none" disabled>No sections registered</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Subject Specialization</Label>
                        <Input
                          value={formData.subjectSpecialization || ""}
                          onChange={e => updateField("subjectSpecialization", e.target.value)}
                          data-testid="input-subject-spec"
                        />
                      </div>
                      <div>
                        <Label>Room Assignment</Label>
                        <Input
                          value={formData.roomAssignment || ""}
                          onChange={e => updateField("roomAssignment", e.target.value)}
                          data-testid="input-room-assignment"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!formData.isClassAdviser}
                        onCheckedChange={v => updateField("isClassAdviser", !!v)}
                        data-testid="checkbox-class-adviser"
                      />
                      <Label>Class Adviser</Label>
                    </div>
                  </TabsContent>

                  <TabsContent value="higher-ed" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Department / College</Label>
                        <Input
                          value={formData.department || ""}
                          onChange={e => updateField("department", e.target.value)}
                          data-testid="input-department"
                        />
                      </div>
                      <div>
                        <Label>Academic Rank</Label>
                        <Input
                          value={formData.academicRank || ""}
                          onChange={e => updateField("academicRank", e.target.value)}
                          data-testid="input-academic-rank"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Professional License No. (PRC)</Label>
                        <Input
                          value={formData.prcLicenseNo || ""}
                          onChange={e => updateField("prcLicenseNo", e.target.value)}
                          data-testid="input-prc-license"
                        />
                      </div>
                      <div>
                        <Label>Research Specialization</Label>
                        <Input
                          value={formData.researchSpecialization || ""}
                          onChange={e => updateField("researchSpecialization", e.target.value)}
                          data-testid="input-research-spec"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Faculty Load (Current Semester Subjects)</Label>
                        <Button variant="outline" size="sm" onClick={addFacultyLoad} data-testid="button-add-faculty-load">
                          <Plus className="w-3 h-3 mr-1" /> Add Subject
                        </Button>
                      </div>
                      {(formData.facultyLoad || []).length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject Code</TableHead>
                              <TableHead>Subject Name</TableHead>
                              <TableHead>Units</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(formData.facultyLoad as FacultyLoadEntry[]).map((entry, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Input
                                    value={entry.subjectCode}
                                    onChange={e => updateFacultyLoad(idx, "subjectCode", e.target.value)}
                                    data-testid={`input-faculty-code-${idx}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={entry.subjectName || ""}
                                    onChange={e => updateFacultyLoad(idx, "subjectName", e.target.value)}
                                    data-testid={`input-faculty-name-${idx}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={entry.units || 0}
                                    onChange={e => updateFacultyLoad(idx, "units", parseFloat(e.target.value) || 0)}
                                    data-testid={`input-faculty-units-${idx}`}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => removeFacultyLoad(idx)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
                  {editingId && (
                    <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
                      Cancel
                    </Button>
                  )}
                  <Button onClick={handleSubmit} disabled={isSaving} data-testid="button-save">
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingId ? "Update" : "Save"} Staff / Teacher
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "registry" && (
        <Card className="border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Registry ({filteredStaff.length})
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    className="pl-9 w-64"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    data-testid="input-search-staff"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handlePrintSummary} data-testid="button-print-summary">
                  <Printer className="w-4 h-4 mr-1" /> Print Summary
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {staffQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No staff/teachers registered yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Photo</TableHead>
                      <TableHead>Emp. ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Employment</TableHead>
                      <TableHead>Grade Level</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((staff, idx) => (
                      <TableRow key={staff.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          {staff.photoUrl ? (
                            <img src={staff.photoUrl} alt="" className="w-8 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-10 rounded bg-muted flex items-center justify-center">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{staff.employeeId || "-"}</TableCell>
                        <TableCell className="font-medium">
                          {staff.lastName}, {staff.firstName} {staff.middleName || ""}
                        </TableCell>
                        <TableCell>{staff.gender}</TableCell>
                        <TableCell className="text-sm">{staff.contactNumber || "-"}</TableCell>
                        <TableCell className="text-sm">{staff.employmentStatus || "-"}</TableCell>
                        <TableCell className="text-sm">{staff.designatedGradeLevel || "-"}</TableCell>
                        <TableCell className="text-sm">{staff.department || "-"}</TableCell>
                        <TableCell>
                          <Badge className={`${statusColor(staff.status)} border-0 text-xs`}>
                            {staff.status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handlePrintIndividual(staff)} data-testid={`button-print-${staff.id}`}>
                              <FileText className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(staff)} data-testid={`button-edit-${staff.id}`}>
                              <Edit className="w-4 h-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(staff.id)} data-testid={`button-delete-${staff.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this staff/teacher record? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCamera} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take Photo</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <video ref={videoRef} className="w-full rounded-lg" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              stopCamera();
              setFacingMode(prev => prev === "user" ? "environment" : "user");
              setTimeout(startCamera, 300);
            }}>
              <SwitchCamera className="w-4 h-4 mr-1" /> Flip
            </Button>
            <Button onClick={capturePhoto} data-testid="button-capture">
              <Camera className="w-4 h-4 mr-1" /> Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

