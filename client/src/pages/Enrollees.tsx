import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { EducationalLevel, SchoolFee, Enrollee, MiscFeeItem, Collection, SubjectEntry } from "@shared/schema";
import { HIGHER_ED_LEVELS, BASIC_ED_LEVELS } from "@shared/schema";
import { generateSchoolYears, getCurrentSchoolYear, isSchoolYearLocked } from "@/lib/educational-levels-data";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { addPdfHeader } from "@/lib/pdf-header";
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
  UserPlus,
  Users,
  UserCheck,
  ArrowRightLeft,
  Wallet,
  GraduationCap,
  Upload,
  ImageIcon,
  RefreshCw,
  Camera,
  SwitchCamera,
  X,
  RotateCcw,
  History,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  BookOpen,
  FileDown,
  CreditCard,
  Lock,
} from "lucide-react";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

type PSGCItem = {
  code: string;
  name: string;
};

const NCR_CODE = "130000000";

const SHS_STRANDS: Record<string, string[]> = {
  Academic: ["STEM", "HUMSS", "ABM", "GAS"],
  TVL: ["Home Economics", "ICT", "Industrial Arts", "Agri-Fishery Arts"],
  Sports: [],
  "Arts & Design": [],
};

const DOCUMENT_CHECKLIST_OPTIONS = [
  "Form 137",
  "Form 138",
  "Good Moral Certificate",
  "Birth Certificate",
  "ID Photos",
  "Others",
];

function getTableEndY(doc: jsPDF, fallback: number): number {
  return (doc as any).lastAutoTable?.finalY ?? (doc as any).previousAutoTable?.finalY ?? fallback;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAcct(value: string | number, negative = false): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "PHP  0.00";
  const formatted = Math.abs(num).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return negative || num < 0 ? `(PHP  ${formatted})` : `PHP  ${formatted}`;
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getLevelDisplayName(level: EducationalLevel): string {
  const child = level.childLevelOther || level.childLevel;
  return `${level.parentLevel} - ${child}`;
}

const emptyForm = {
  idNo: "",
  psaBirthCertNo: "",
  lrn: "",
  lastName: "",
  firstName: "",
  middleName: "",
  nameExtension: "",
  sex: "",
  dateOfBirth: "",
  age: 0,
  isIndigenous: false,
  indigenousGroup: "",
  photoUrl: "",
  regionCode: "",
  regionName: "",
  provinceCode: "",
  provinceName: "",
  cityCode: "",
  cityName: "",
  barangayCode: "",
  barangayName: "",
  zipCode: "",
  fatherName: "",
  motherMaidenName: "",
  guardianName: "",
  parentGuardianTel: "",
  educationalLevelId: 0,
  section: "",
  enrollmentStatus: "New",
  lastGradeLevel: "",
  lastSchoolYear: "",
  lastSchoolName: "",
  lastSchoolId: "",
  lastSchoolAddress: "",
  shsTrack: "",
  shsStrand: "",
  yearLevel: "",
  semester: "",
  courseProgram: "",
  major: "",
  civilStatus: "",
  nationality: "Filipino",
  studentEmail: "",
  mobileNo: "",
  emergencyContact: "",
  emergencyContactNo: "",
  documentChecklist: [] as string[],
  subjectCodes: [] as SubjectEntry[],
  totalUnits: 0,
  pdfAttachments: [] as string[],
};

export default function EnrolleesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const [viewMode, setViewMode] = useState<"form" | "registry">("form");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isAccountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingEnrollee, setEditingEnrollee] = useState<Enrollee | null>(null);
  const [accountEnrollee, setAccountEnrollee] = useState<Enrollee | null>(null);
  const [activeTab, setActiveTab] = useState("personal");
  const [heActiveTab, setHeActiveTab] = useState("classification");

  const [form, setForm] = useState({ ...emptyForm });

  const [regions, setRegions] = useState<PSGCItem[]>([]);
  const [provinces, setProvinces] = useState<PSGCItem[]>([]);
  const [cities, setCities] = useState<PSGCItem[]>([]);
  const [barangays, setBarangays] = useState<PSGCItem[]>([]);
  const [psgcLoading, setPsgcLoading] = useState(false);

  const [accBackAccounts, setAccBackAccounts] = useState("0");
  const [accOtherFees, setAccOtherFees] = useState<MiscFeeItem[]>([]);
  const [accDiscounts, setAccDiscounts] = useState<MiscFeeItem[]>([]);
  const [accScholarships, setAccScholarships] = useState<MiscFeeItem[]>([]);
  const [newItemName, setNewItemName] = useState("");

  const [cameraMode, setCameraMode] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [savingCapture, setSavingCapture] = useState(false);
  const [newItemAmount, setNewItemAmount] = useState("");
  const [addingTo, setAddingTo] = useState<"otherFees" | "discounts" | "scholarships">("otherFees");

  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());

  const schoolYears = useMemo(() => generateSchoolYears(), []);

  const { data: enrolleesData, isLoading: enrolleesLoading } = useQuery<Enrollee[]>({
    queryKey: [api.enrollees.list.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.enrollees.list.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch enrollees");
      return res.json();
    },
  });

  const { data: levelsData } = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch levels");
      return res.json();
    },
  });

  const { data: feesData } = useQuery<SchoolFee[]>({
    queryKey: [api.fees.listFees.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.fees.listFees.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch fees");
      return res.json();
    },
  });

  const feesByLevelId = useMemo(() => {
    const map: Record<number, SchoolFee> = {};
    feesData?.forEach((f) => { map[f.educationalLevelId] = f; });
    return map;
  }, [feesData]);

  const levelsById = useMemo(() => {
    const map: Record<number, EducationalLevel> = {};
    levelsData?.forEach((l) => { map[l.level.id] = l.level; });
    return map;
  }, [levelsData]);

  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions.json")
      .then((r) => r.json())
      .then((data: PSGCItem[]) => setRegions(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.regionCode) { setProvinces([]); setCities([]); setBarangays([]); return; }
    setPsgcLoading(true);
    const url = form.regionCode === NCR_CODE
      ? `https://psgc.gitlab.io/api/regions/${NCR_CODE}/districts.json`
      : `https://psgc.gitlab.io/api/regions/${form.regionCode}/provinces.json`;
    fetch(url)
      .then((r) => r.json())
      .then((data: PSGCItem[]) => {
        setProvinces(data.sort((a, b) => a.name.localeCompare(b.name)));
        setCities([]);
        setBarangays([]);
      })
      .catch(() => {})
      .finally(() => setPsgcLoading(false));
  }, [form.regionCode]);

  useEffect(() => {
    if (!form.provinceCode) { setCities([]); setBarangays([]); return; }
    setPsgcLoading(true);
    const isDistrict = form.regionCode === NCR_CODE;
    const url = isDistrict
      ? `https://psgc.gitlab.io/api/districts/${form.provinceCode}/cities-municipalities.json`
      : `https://psgc.gitlab.io/api/provinces/${form.provinceCode}/cities-municipalities.json`;
    fetch(url)
      .then((r) => r.json())
      .then((data: PSGCItem[]) => {
        setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
        setBarangays([]);
      })
      .catch(() => {})
      .finally(() => setPsgcLoading(false));
  }, [form.provinceCode, form.regionCode]);

  useEffect(() => {
    if (!form.cityCode) { setBarangays([]); return; }
    setPsgcLoading(true);
    fetch(`https://psgc.gitlab.io/api/cities-municipalities/${form.cityCode}/barangays.json`)
      .then((r) => r.json())
      .then((data: PSGCItem[]) => setBarangays(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
      .finally(() => setPsgcLoading(false));
  }, [form.cityCode]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.enrollees.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path, selectedSY] });
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Student added successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const url = buildUrl(api.enrollees.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path, selectedSY] });
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Student updated successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.enrollees.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path, selectedSY] });
      queryClient.invalidateQueries({ queryKey: [api.academic.listLevels.path, selectedSY] });
      toast({ title: "Student deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const accountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const url = buildUrl(api.enrollees.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path, selectedSY] });
      toast({ title: "Account updated successfully" });
      setAccountDialogOpen(false);
      setAccountEnrollee(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    stopCamera();
    setCameraMode(false);
    setCapturedImage(null);
    setCameraError(null);
    setEditingEnrollee(null);
    setForm({ ...emptyForm });
    setActiveTab("personal");
    setHeActiveTab("classification");
  };

  const openEditInForm = (enrollee: Enrollee) => {
    setEditingEnrollee(enrollee);
    setForm({
      idNo: enrollee.idNo || "",
      psaBirthCertNo: enrollee.psaBirthCertNo || "",
      lrn: enrollee.lrn || "",
      lastName: enrollee.lastName,
      firstName: enrollee.firstName,
      middleName: enrollee.middleName || "",
      nameExtension: enrollee.nameExtension || "",
      sex: enrollee.sex,
      dateOfBirth: enrollee.dateOfBirth,
      age: enrollee.age || 0,
      isIndigenous: enrollee.isIndigenous || false,
      indigenousGroup: enrollee.indigenousGroup || "",
      photoUrl: enrollee.photoUrl || "",
      regionCode: enrollee.regionCode || "",
      regionName: enrollee.regionName || "",
      provinceCode: enrollee.provinceCode || "",
      provinceName: enrollee.provinceName || "",
      cityCode: enrollee.cityCode || "",
      cityName: enrollee.cityName || "",
      barangayCode: enrollee.barangayCode || "",
      barangayName: enrollee.barangayName || "",
      zipCode: enrollee.zipCode || "",
      fatherName: enrollee.fatherName || "",
      motherMaidenName: enrollee.motherMaidenName || "",
      guardianName: enrollee.guardianName || "",
      parentGuardianTel: enrollee.parentGuardianTel || "",
      educationalLevelId: enrollee.educationalLevelId,
      section: enrollee.section || "",
      enrollmentStatus: enrollee.enrollmentStatus || "New",
      lastGradeLevel: enrollee.lastGradeLevel || "",
      lastSchoolYear: enrollee.lastSchoolYear || "",
      lastSchoolName: enrollee.lastSchoolName || "",
      lastSchoolId: enrollee.lastSchoolId || "",
      lastSchoolAddress: enrollee.lastSchoolAddress || "",
      shsTrack: enrollee.shsTrack || "",
      shsStrand: enrollee.shsStrand || "",
      yearLevel: enrollee.yearLevel || "",
      semester: enrollee.semester || "",
      courseProgram: enrollee.courseProgram || "",
      major: enrollee.major || "",
      civilStatus: enrollee.civilStatus || "",
      nationality: enrollee.nationality || "Filipino",
      studentEmail: enrollee.studentEmail || "",
      mobileNo: enrollee.mobileNo || "",
      emergencyContact: enrollee.emergencyContact || "",
      emergencyContactNo: enrollee.emergencyContactNo || "",
      documentChecklist: (enrollee.documentChecklist as string[]) || [],
      subjectCodes: (enrollee.subjectCodes as SubjectEntry[]) || [],
      totalUnits: enrollee.totalUnits || 0,
      pdfAttachments: (enrollee.pdfAttachments as string[]) || [],
    });
    const level = levelsById[enrollee.educationalLevelId];
    if (level && HIGHER_ED_LEVELS.includes(level.parentLevel)) {
      setHeActiveTab("classification");
    } else {
      setActiveTab("personal");
    }
    setViewMode("form");
  };

  const openAccountDialog = (enrollee: Enrollee) => {
    setAccountEnrollee(enrollee);
    setAccBackAccounts(enrollee.backAccounts || "0");
    setAccOtherFees((enrollee.otherFees as MiscFeeItem[]) || []);
    setAccDiscounts((enrollee.discounts as MiscFeeItem[]) || []);
    setAccScholarships((enrollee.scholarships as MiscFeeItem[]) || []);
    setAccountDialogOpen(true);
  };

  const handleSubmitEnrollee = () => {
    if (!form.lastName || !form.firstName || !form.sex || !form.dateOfBirth || !form.educationalLevelId) {
      toast({ title: "Please fill required fields (Name, Sex, DOB, Level)", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      schoolYear: selectedSY,
      age: form.dateOfBirth ? calculateAge(form.dateOfBirth) : 0,
      educationalLevelId: form.educationalLevelId,
      isIndigenous: form.isIndigenous,
      indigenousGroup: form.isIndigenous ? form.indigenousGroup : null,
      nameExtension: form.nameExtension || null,
      middleName: form.middleName || null,
      section: form.section || null,
      shsTrack: form.shsTrack || null,
      shsStrand: form.shsStrand || null,
      lastGradeLevel: form.enrollmentStatus !== "New" ? form.lastGradeLevel || null : null,
      lastSchoolYear: form.enrollmentStatus !== "New" ? form.lastSchoolYear || null : null,
      lastSchoolName: form.enrollmentStatus !== "New" ? form.lastSchoolName || null : null,
      lastSchoolId: form.enrollmentStatus !== "New" ? form.lastSchoolId || null : null,
      lastSchoolAddress: form.enrollmentStatus !== "New" ? form.lastSchoolAddress || null : null,
      photoUrl: form.photoUrl || null,
      psaBirthCertNo: form.psaBirthCertNo || null,
      lrn: form.lrn || null,
      idNo: form.idNo || null,
      regionCode: form.regionCode || null,
      regionName: form.regionName || null,
      provinceCode: form.provinceCode || null,
      provinceName: form.provinceName || null,
      cityCode: form.cityCode || null,
      cityName: form.cityName || null,
      barangayCode: form.barangayCode || null,
      barangayName: form.barangayName || null,
      zipCode: form.zipCode || null,
      fatherName: form.fatherName || null,
      motherMaidenName: form.motherMaidenName || null,
      guardianName: form.guardianName || null,
      parentGuardianTel: form.parentGuardianTel || null,
      yearLevel: form.yearLevel || null,
      semester: form.semester || null,
      courseProgram: form.courseProgram || null,
      major: form.major || null,
      civilStatus: form.civilStatus || null,
      nationality: form.nationality || null,
      studentEmail: form.studentEmail || null,
      mobileNo: form.mobileNo || null,
      emergencyContact: form.emergencyContact || null,
      emergencyContactNo: form.emergencyContactNo || null,
      documentChecklist: form.documentChecklist,
      subjectCodes: form.subjectCodes,
      totalUnits: form.subjectCodes.reduce((sum, s) => sum + (s.units || 0), 0),
      pdfAttachments: form.pdfAttachments,
    };

    if (editingEnrollee) {
      updateMutation.mutate({ id: editingEnrollee.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const res = await fetch("/api/upload/photo", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateField("photoUrl", data.url);
      toast({ title: "Photo uploaded successfully" });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `File "${file.name}" exceeds 10MB limit`, variant: "destructive" });
        continue;
      }
      const formData = new FormData();
      formData.append("pdf", file);
      try {
        const res = await fetch("/api/upload/pdf", {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setForm((prev) => ({
          ...prev,
          pdfAttachments: [...prev.pdfAttachments, data.url],
        }));
        toast({ title: `"${file.name}" uploaded` });
      } catch {
        toast({ title: `Failed to upload "${file.name}"`, variant: "destructive" });
      }
    }
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const startCamera = useCallback(async (facing: "user" | "environment") => {
    setCameraError(null);
    setCapturedImage(null);
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setCameraStream(stream);
      setCameraMode(true);
      setFacingMode(facing);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      let msg = "Could not access camera";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No camera found on this device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Camera is in use by another application.";
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
      setCameraMode(true);
    }
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const saveCapturedPhoto = useCallback(async () => {
    if (!capturedImage) return;
    setSavingCapture(true);
    try {
      const res = await fetch("/api/upload/photo-base64", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateField("photoUrl", data.url);
      setCapturedImage(null);
      setCameraMode(false);
      toast({ title: "Photo captured and saved" });
    } catch {
      toast({ title: "Failed to save captured photo", variant: "destructive" });
    } finally {
      setSavingCapture(false);
    }
  }, [capturedImage, toast]);

  const switchCamera = useCallback(() => {
    const next = facingMode === "user" ? "environment" : "user";
    startCamera(next);
  }, [facingMode, startCamera]);

  const closeCameraMode = useCallback(() => {
    stopCamera();
    setCameraMode(false);
    setCapturedImage(null);
    setCameraError(null);
  }, [stopCamera]);

  const selectedLevel = useMemo(() => {
    if (!form.educationalLevelId || !levelsData) return null;
    return levelsData.find((l) => l.level.id === form.educationalLevelId)?.level || null;
  }, [form.educationalLevelId, levelsData]);

  const isHigherEd = useMemo(() => {
    return selectedLevel ? HIGHER_ED_LEVELS.includes(selectedLevel.parentLevel) : false;
  }, [selectedLevel]);

  const isSeniorHigh = useMemo(() => {
    return selectedLevel?.parentLevel === "Senior High";
  }, [selectedLevel]);

  const levelSections = useMemo(() => {
    if (!selectedLevel) return [];
    return (selectedLevel.sections as string[]) || [];
  }, [selectedLevel]);

  const filteredEnrollees = useMemo(() => {
    let list = enrolleesData || [];
    if (statusFilter) {
      list = list.filter((e) => e.enrollmentStatus === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const fullName = `${e.lastName} ${e.firstName} ${e.middleName || ""}`.toLowerCase();
        return fullName.includes(q) || (e.idNo && e.idNo.toLowerCase().includes(q)) || (e.lrn && e.lrn.toLowerCase().includes(q));
      });
    }
    list = [...list];
    list.sort((a, b) => {
      const levelA = levelsById[a.educationalLevelId];
      const levelB = levelsById[b.educationalLevelId];
      const parentComp = (levelA?.parentLevel || "").localeCompare(levelB?.parentLevel || "");
      if (parentComp !== 0) return parentComp;
      const childComp = (levelA?.childLevel || "").localeCompare(levelB?.childLevel || "");
      if (childComp !== 0) return childComp;
      const nameComp = (a.lastName || "").localeCompare(b.lastName || "");
      if (nameComp !== 0) return nameComp;
      return (a.firstName || "").localeCompare(b.firstName || "");
    });
    return list;
  }, [enrolleesData, searchQuery, statusFilter, levelsById]);

  const analytics = useMemo(() => {
    const total = enrolleesData?.length || 0;
    const newCount = enrolleesData?.filter((e) => e.enrollmentStatus === "New").length || 0;
    const returning = enrolleesData?.filter((e) => e.enrollmentStatus === "Returning").length || 0;
    const reenrolled = enrolleesData?.filter((e) => e.enrollmentStatus === "Re-enrolled").length || 0;
    const transferees = enrolleesData?.filter((e) => e.enrollmentStatus === "Transferee").length || 0;
    return { total, newCount, returning, reenrolled, transferees };
  }, [enrolleesData]);

  const groupedBySection = useMemo(() => {
    const basicEd: Record<string, Enrollee[]> = {};
    const higherEd: Record<string, Enrollee[]> = {};

    (filteredEnrollees || []).forEach((e) => {
      const level = levelsById[e.educationalLevelId];
      if (!level) return;
      const key = `${level.id}`;
      if (BASIC_ED_LEVELS.includes(level.parentLevel)) {
        if (!basicEd[key]) basicEd[key] = [];
        basicEd[key].push(e);
      } else if (HIGHER_ED_LEVELS.includes(level.parentLevel)) {
        if (!higherEd[key]) higherEd[key] = [];
        higherEd[key].push(e);
      } else {
        if (!basicEd[key]) basicEd[key] = [];
        basicEd[key].push(e);
      }
    });

    const sortEnrollees = (list: Enrollee[]) =>
      [...list].sort((a, b) => {
        const ln = (a.lastName || "").localeCompare(b.lastName || "");
        if (ln !== 0) return ln;
        return (a.firstName || "").localeCompare(b.firstName || "");
      });

    Object.keys(basicEd).forEach((k) => { basicEd[k] = sortEnrollees(basicEd[k]); });
    Object.keys(higherEd).forEach((k) => { higherEd[k] = sortEnrollees(higherEd[k]); });

    return { basicEd, higherEd };
  }, [filteredEnrollees, levelsById]);

  const basicEdTotal = useMemo(() => {
    return Object.values(groupedBySection.basicEd).reduce((s, arr) => s + arr.length, 0);
  }, [groupedBySection.basicEd]);

  const higherEdTotal = useMemo(() => {
    return Object.values(groupedBySection.higherEd).reduce((s, arr) => s + arr.length, 0);
  }, [groupedBySection.higherEd]);

  const toggleLevel = (key: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: paymentHistory } = useQuery<Collection[]>({
    queryKey: [api.collections.byEnrollee.path, accountEnrollee?.id],
    queryFn: async () => {
      if (!accountEnrollee) return [];
      const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: accountEnrollee.id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!accountEnrollee,
  });

  const totalAmountPaid = useMemo(() => {
    if (!paymentHistory) return 0;
    return paymentHistory.reduce((s, c) => s + parseFloat(String(c.amount) || "0"), 0);
  }, [paymentHistory]);

  const accountFee = useMemo(() => {
    if (!accountEnrollee) return null;
    return feesByLevelId[accountEnrollee.educationalLevelId] || null;
  }, [accountEnrollee, feesByLevelId]);

  const accTotalSchoolFees = useMemo(() => {
    if (!accountFee) return 0;
    return parseFloat(accountFee.totalSchoolFees || "0");
  }, [accountFee]);

  const accGrandTotal = useMemo(() => {
    const schoolFees = accTotalSchoolFees;
    const back = parseFloat(accBackAccounts) || 0;
    const other = accOtherFees.reduce((s, i) => s + i.amount, 0);
    const disc = accDiscounts.reduce((s, i) => s + i.amount, 0);
    const schol = accScholarships.reduce((s, i) => s + i.amount, 0);
    return schoolFees + back + other - disc - schol;
  }, [accTotalSchoolFees, accBackAccounts, accOtherFees, accDiscounts, accScholarships]);

  const outstandingBalance = useMemo(() => {
    return accGrandTotal - totalAmountPaid;
  }, [accGrandTotal, totalAmountPaid]);

  const addDynamicItem = (section: "otherFees" | "discounts" | "scholarships") => {
    if (!newItemName.trim() || !newItemAmount.trim()) return;
    const amount = parseFloat(newItemAmount);
    if (isNaN(amount) || amount < 0) return;
    const item: MiscFeeItem = { name: newItemName.trim(), amount };
    if (section === "otherFees") setAccOtherFees([...accOtherFees, item]);
    else if (section === "discounts") setAccDiscounts([...accDiscounts, item]);
    else setAccScholarships([...accScholarships, item]);
    setNewItemName("");
    setNewItemAmount("");
  };

  const removeDynamicItem = (section: "otherFees" | "discounts" | "scholarships", idx: number) => {
    if (section === "otherFees") setAccOtherFees(accOtherFees.filter((_, i) => i !== idx));
    else if (section === "discounts") setAccDiscounts(accDiscounts.filter((_, i) => i !== idx));
    else setAccScholarships(accScholarships.filter((_, i) => i !== idx));
  };

  const handleSaveAccount = () => {
    if (!accountEnrollee) return;
    accountMutation.mutate({
      id: accountEnrollee.id,
      data: {
        backAccounts: (parseFloat(accBackAccounts) || 0).toFixed(2),
        otherFees: accOtherFees,
        discounts: accDiscounts,
        scholarships: accScholarships,
        totalApplicableFees: accGrandTotal.toFixed(2),
      },
    });
  };

  const handleExportPdf = () => {
    if (!user || !filteredEnrollees.length) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let startY = addPdfHeader(doc, user);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Student Directory - SY ${selectedSY}`, pageWidth / 2, startY, { align: "center" });
    startY += 4;

    const tableData = filteredEnrollees.map((e) => {
      const level = levelsById[e.educationalLevelId];
      return [
        e.idNo || "-",
        `${e.lastName}, ${e.firstName} ${e.middleName || ""}`.trim(),
        level ? getLevelDisplayName(level) : "-",
        e.section || "-",
        e.enrollmentStatus || "-",
        e.sex,
      ];
    });

    autoTable(doc, {
      startY: startY + 2,
      head: [["ID No", "Name", "Level", "Section", "Status", "Sex"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.25 },
    });

    const finalY = getTableEndY(doc, startY + 60);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      pageWidth / 2,
      finalY + 12,
      { align: "center" }
    );

    doc.save(`Student_Directory_${selectedSY}.pdf`);
    toast({ title: "PDF report downloaded" });
  };

  const handleGenerateSOA = () => {
    if (!user || !accountEnrollee) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const level = levelsById[accountEnrollee.educationalLevelId];
    const studentName = `${accountEnrollee.lastName}, ${accountEnrollee.firstName} ${accountEnrollee.middleName || ""}`.trim();

    let y = addPdfHeader(doc, user);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text("STATEMENT OF ACCOUNT", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 8;

    const infoLeftCol = margin;
    const infoRightCol = pageWidth / 2 + 10;
    doc.setFontSize(9);

    doc.setFont("helvetica", "bold");
    doc.text("Student:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(studentName, infoLeftCol + 20, y);

    doc.setFont("helvetica", "bold");
    doc.text("ID No:", infoRightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(accountEnrollee.idNo || "N/A", infoRightCol + 16, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Level:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(level ? getLevelDisplayName(level) : "N/A", infoLeftCol + 16, y);

    doc.setFont("helvetica", "bold");
    doc.text("School Year:", infoRightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(selectedSY, infoRightCol + 28, y);
    y += 5;

    if (accountEnrollee.section) {
      doc.setFont("helvetica", "bold");
      doc.text("Section:", infoLeftCol, y);
      doc.setFont("helvetica", "normal");
      doc.text(accountEnrollee.section, infoLeftCol + 20, y);
    }
    doc.setFont("helvetica", "bold");
    doc.text("Date:", infoRightCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), infoRightCol + 14, y);
    y += 8;

    const rowPad = { top: 1.5, bottom: 1.5, left: 3, right: 3 };
    const headPad = { top: 2, bottom: 2, left: 3, right: 3 };
    const feeBody: (string | { content: string; styles?: Record<string, unknown> })[][] = [];
    if (accountFee) {
      feeBody.push(["Entrance Fee", { content: fmtAcct(accountFee.entranceFee), styles: { halign: "right" as const } }]);
      feeBody.push(["Tuition Fee", { content: fmtAcct(accountFee.tuitionFee), styles: { halign: "right" as const } }]);
      (accountFee.miscellaneousFees as MiscFeeItem[])?.forEach((m) => {
        feeBody.push([`   ${m.name}`, { content: fmtAcct(m.amount), styles: { halign: "right" as const } }]);
      });
    }
    const back = parseFloat(accBackAccounts) || 0;
    if (back > 0) feeBody.push(["Back Accounts", { content: fmtAcct(back), styles: { halign: "right" as const } }]);
    accOtherFees.forEach((f) => feeBody.push([`Other: ${f.name}`, { content: fmtAcct(f.amount), styles: { halign: "right" as const } }]));

    feeBody.push([
      { content: "Total School Fees", styles: { fontStyle: "bold" as const } },
      { content: fmtAcct(accTotalSchoolFees), styles: { halign: "right" as const, fontStyle: "bold" as const } },
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Description", { content: "Amount (PHP)", styles: { halign: "right" as const } }]],
      body: feeBody,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: headPad },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: rowPad, font: "helvetica" },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.65, halign: "left" },
        1: { cellWidth: contentWidth * 0.35, halign: "right" },
      },
      margin: { left: margin, right: margin },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.18, overflow: "linebreak" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    y = getTableEndY(doc, y + 36) + 4;

    if (accDiscounts.length || accScholarships.length) {
      const deductBody: (string | { content: string; styles?: Record<string, unknown> })[][] = [];
      accDiscounts.forEach((d) => deductBody.push([`Discount: ${d.name}`, { content: fmtAcct(d.amount, true), styles: { halign: "right" as const } }]));
      accScholarships.forEach((s) => deductBody.push([`Scholarship: ${s.name}`, { content: fmtAcct(s.amount, true), styles: { halign: "right" as const } }]));

      const totalDeductions = accDiscounts.reduce((s, i) => s + i.amount, 0) + accScholarships.reduce((s, i) => s + i.amount, 0);

      autoTable(doc, {
        startY: y,
        head: [["Deductions", { content: "Amount (PHP)", styles: { halign: "right" as const } }]],
        body: deductBody,
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: headPad },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: rowPad, font: "helvetica" },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.65, halign: "left" },
          1: { cellWidth: contentWidth * 0.35, halign: "right" },
        },
        margin: { left: margin, right: margin },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.18 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
      });
      y = getTableEndY(doc, y + 16) + 4;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("Total Deductions", margin + 3, y + 1);
      doc.text(fmtAcct(totalDeductions, true), pageWidth - margin - 3, y + 1, { align: "right" });
      doc.setTextColor(0);
      y += 6;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text("Total Applicable Fees", margin + 3, y + 1);
    doc.text(fmtAcct(accGrandTotal), pageWidth - margin - 3, y + 1, { align: "right" });
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    if (paymentHistory && paymentHistory.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(44, 62, 80);
      doc.text("Payment History", margin, y);
      doc.setTextColor(0);
      y += 3;

      const payBody = paymentHistory.map((p) => [
        p.date ? (() => { const pts = p.date.split("-"); return pts.length === 3 ? `${pts[1]}/${pts[2]}/${pts[0]}` : p.date; })() : "-",
        p.siNo,
        p.description || p.collectionCategory,
        { content: fmtAcct(p.amount), styles: { halign: "right" as const } },
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Date", "S.I. No.", "Description", { content: "Amount (PHP)", styles: { halign: "right" as const } }]],
        body: payBody,
        theme: "grid",
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, cellPadding: headPad },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40], cellPadding: rowPad, font: "helvetica" },
        columnStyles: {
          0: { cellWidth: contentWidth * 0.16 },
          1: { cellWidth: contentWidth * 0.16 },
          2: { cellWidth: contentWidth * 0.38, halign: "left" },
          3: { cellWidth: contentWidth * 0.30, halign: "right" },
        },
        margin: { left: margin, right: margin },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.18 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      y = getTableEndY(doc, y + 16) + 4;
    }

    const balColor = outstandingBalance > 0 ? [220, 38, 38] : [16, 185, 129];

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text("Total Paid", margin + 3, y + 1);
    doc.text(fmtAcct(totalAmountPaid), pageWidth - margin - 3, y + 1, { align: "right" });
    y += 6;

    doc.setDrawColor(44, 62, 80);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(balColor[0], balColor[1], balColor[2]);
    doc.text("Outstanding Balance", margin + 3, y + 1);
    doc.text(fmtAcct(Math.abs(outstandingBalance)), pageWidth - margin - 3, y + 1, { align: "right" });
    doc.setTextColor(0);

    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 10;
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "normal");
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    doc.text("Generated by IPYX Digital Accounting Solution", pageWidth / 2, footerY, { align: "center" });
    doc.text(timestamp, pageWidth / 2, footerY + 3, { align: "center" });

    doc.save(`SOA_${accountEnrollee.lastName}_${accountEnrollee.firstName}_${selectedSY}.pdf`);
    toast({ title: "Statement of Account downloaded" });
  };

  const handlePrintForm = async (enrollee: Enrollee) => {
    const level = levelsById[enrollee.educationalLevelId];

    if (level && HIGHER_ED_LEVELS.includes(level.parentLevel)) {
      toast({ title: "Print form is available for Basic Education enrollment forms only.", variant: "default" });
      return;
    }

    const age = enrollee.age || (enrollee.dateOfBirth ? calculateAge(enrollee.dateOfBirth) : 0);

    if (!user) {
      toast({ title: "User profile not loaded", variant: "destructive" });
      return;
    }

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const M = 12;
      const R = pageWidth - M;
      const W = R - M;
      const photoMM = 38.1;
      const rh = 5.5;
      const boxS = 4.8;
      const barH = 5.5;

      const drawBar = (title: string, yp: number): number => {
        doc.setFillColor(207, 226, 243);
        doc.setDrawColor(164, 194, 244);
        doc.rect(M, yp, W, barH, "FD");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(title, pageWidth / 2, yp + barH * 0.72, { align: "center" });
        return yp + barH + 1;
      };

      const field = (lbl: string, val: string, x: number, yp: number, endX: number) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        const lw = doc.getTextWidth(lbl) + 1.5;
        doc.text(lbl, x, yp + rh * 0.6);
        doc.setFont("helvetica", "normal");
        const avail = endX - x - lw - 1;
        let v = val || "";
        if (avail > 0 && doc.getTextWidth(v) > avail) {
          while (v.length > 0 && doc.getTextWidth(v + "...") > avail) v = v.slice(0, -1);
          v += "...";
        }
        doc.text(v, x + lw + 0.5, yp + rh * 0.6);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.line(x + lw, yp + rh * 0.75, endX, yp + rh * 0.75);
      };

      const chk = (lbl: string, on: boolean, x: number, yp: number): number => {
        const sz = 2.8;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(x, yp, sz, sz);
        if (on) { doc.setFont("helvetica", "bold"); doc.text("X", x + 0.5, yp + sz * 0.78); }
        doc.setFont("helvetica", "normal");
        doc.text(lbl, x + sz + 1.2, yp + sz * 0.72);
        return x + sz + 1.2 + doc.getTextWidth(lbl) + 3;
      };

      const boxes = (txt: string, cnt: number, x: number, yp: number) => {
        const chars = (txt || "").toUpperCase().split("");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        for (let i = 0; i < cnt; i++) {
          doc.setFillColor(250, 250, 250);
          doc.setDrawColor(120, 120, 120);
          doc.setLineWidth(0.15);
          doc.rect(x + i * boxS, yp, boxS, boxS, "FD");
          if (chars[i]) doc.text(chars[i], x + i * boxS + boxS / 2, yp + boxS * 0.7, { align: "center" });
        }
      };

      let y = addPdfHeader(doc, user, { margin: M });

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("BASIC EDUCATION ENROLLMENT FORM", pageWidth / 2, y, { align: "center" });
      y += 5;

      const col2 = M + W * 0.35;
      const col3 = M + W * 0.75;
      field("School Year:", selectedSY, M, y, col2 - 2);
      field("School Name:", user.schoolName || "", col2, y, col3 - 2);
      field("School ID:", user.secRegNo || "", col3, y, R);
      y += rh;

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text("Enrollment Status:", M, y + rh * 0.55);
      let cx = M + doc.getTextWidth("Enrollment Status:") + 2;
      for (const s of ["New", "Returning", "Transferee", "Re-enrolled"]) {
        cx = chk(s, enrollee.enrollmentStatus === s, cx, y + 0.8);
      }
      y += rh + 1;

      y = drawBar("STUDENT INFORMATION", y);

      const photoX = R - photoMM;
      const photoY = y;
      const photoEnd = photoY + photoMM;
      if (enrollee.photoUrl) {
        try {
          const fmt = enrollee.photoUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(enrollee.photoUrl, fmt, photoX, photoY, photoMM, photoMM);
        } catch {}
      }
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.18);
      doc.rect(photoX, photoY, photoMM, photoMM);
      if (!enrollee.photoUrl) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(160, 160, 160);
        doc.text("1.5 x 1.5", photoX + photoMM / 2, photoY + photoMM / 2 - 1.5, { align: "center" });
        doc.text("ID Photo", photoX + photoMM / 2, photoY + photoMM / 2 + 1.5, { align: "center" });
        doc.setTextColor(0, 0, 0);
      }

      const fR = photoX - 3;

      field("PSA Birth Cert No.:", enrollee.psaBirthCertNo || "", M, y, fR);
      y += rh;

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text("LRN:", M, y + boxS * 0.65);
      boxes(enrollee.lrn || "", 12, M + 11, y);
      y += boxS + 1.5;

      doc.setFont("helvetica", "bold");
      doc.text("LAST NAME:", M, y + boxS * 0.65);
      boxes(enrollee.lastName || "", 22, M + 22, y);
      y += boxS + 1.5;

      doc.setFont("helvetica", "bold");
      doc.text("FIRST NAME:", M, y + boxS * 0.65);
      boxes(enrollee.firstName || "", 22, M + 22, y);
      y += boxS + 1.5;

      doc.setFont("helvetica", "bold");
      doc.text("MIDDLE NAME:", M, y + boxS * 0.65);
      boxes(enrollee.middleName || "", 22, M + 25, y);
      y += boxS + 1.5;

      y = Math.max(y, photoEnd + 1);

      const q = W / 4;
      field("Name Ext.:", enrollee.nameExtension || "", M, y, M + q);
      field("Date of Birth:", enrollee.dateOfBirth || "", M + q + 1, y, M + q * 2);
      field("Sex:", enrollee.sex || "", M + q * 2 + 1, y, M + q * 3);
      field("Age:", String(age), M + q * 3 + 1, y, R);
      y += rh;

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text("IP Community?", M, y + rh * 0.55);
      let ipX = M + doc.getTextWidth("IP Community?") + 2;
      ipX = chk("Yes", !!enrollee.isIndigenous, ipX, y + 0.8);
      ipX = chk("No", !enrollee.isIndigenous, ipX, y + 0.8);
      if (enrollee.isIndigenous) field("Specify:", enrollee.indigenousGroup || "", ipX + 1, y, ipX + 55);
      y += rh + 1;

      y = drawBar("ADDRESS", y);

      const addr = [enrollee.barangayName, enrollee.cityName, enrollee.provinceName, enrollee.regionName, enrollee.zipCode ? `ZIP: ${enrollee.zipCode}` : ""].filter(Boolean).join(", ");
      field("Full Address:", addr, M, y, R);
      y += rh;

      const half = M + W / 2;
      field("Barangay:", enrollee.barangayName || "", M, y, half - 1);
      field("City/Municipality:", enrollee.cityName || "", half + 1, y, R);
      y += rh;

      const t1 = M + W / 3;
      const t2 = M + (W * 2) / 3;
      field("Province:", enrollee.provinceName || "", M, y, t1 - 1);
      field("Region:", enrollee.regionName || "", t1 + 1, y, t2 - 1);
      field("Zip Code:", enrollee.zipCode || "", t2 + 1, y, R);
      y += rh + 1;

      y = drawBar("PARENT'S / GUARDIAN'S INFORMATION", y);

      field("Father's Name:", enrollee.fatherName || "", M, y, R);
      y += rh;
      field("Mother's Maiden Name:", enrollee.motherMaidenName || "", M, y, R);
      y += rh;
      field("Guardian's Name:", enrollee.guardianName || "", M, y, R);
      y += rh;
      field("Contact No.:", enrollee.parentGuardianTel || "", M, y, half - 1);
      y += rh + 1;

      y = drawBar("FOR RETURNING LEARNER AND TRANSFEREE", y);

      field("Last Grade Level:", enrollee.lastGradeLevel || "", M, y, half - 1);
      field("Last SY Completed:", enrollee.lastSchoolYear || "", half + 1, y, R);
      y += rh;
      const col60 = M + W * 0.6;
      field("Last School Attended:", enrollee.lastSchoolName || "", M, y, col60 - 1);
      field("School ID:", enrollee.lastSchoolId || "", col60 + 1, y, R);
      y += rh + 1;

      if (level?.parentLevel === "Senior High") {
        y = drawBar("FOR SENIOR HIGH SCHOOL", y);
        field("Track:", enrollee.shsTrack || "", M, y, half - 1);
        field("Strand:", enrollee.shsStrand || "", half + 1, y, R);
        y += rh + 1;
      }

      y = drawBar("ENROLLMENT DETAILS", y);

      field("Grade Level:", level ? getLevelDisplayName(level) : "", M, y, col60 - 1);
      field("Section:", enrollee.section || "", col60 + 1, y, R);
      y += rh + 3;

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(M, y, R, y);
      doc.setLineDashPattern([], 0);
      y += 3;
      doc.text("I hereby certify that the above information given are true and correct to the best of my knowledge.", M, y);
      y += 14;

      doc.setDrawColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + 65, y);
      doc.text("Signature Over Printed Name of Parent/Guardian", M, y + 3.5);

      doc.line(R - 35, y, R, y);
      doc.text("Date", R - 17.5, y + 3.5, { align: "center" });

      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(130, 130, 130);
      doc.text("Generated by IPYX Digital Accounting Solution", pageWidth / 2, pageHeight - 6, { align: "center" });
      doc.setTextColor(0, 0, 0);

      doc.save(`Enrollment_Form_${enrollee.lastName}_${enrollee.firstName}.pdf`);
      toast({ title: "Enrollment form PDF downloaded" });
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const addSubjectRow = () => {
    setForm((prev) => ({
      ...prev,
      subjectCodes: [...prev.subjectCodes, { code: "", description: "", units: 0 }],
    }));
  };

  const updateSubjectRow = (idx: number, field: keyof SubjectEntry, value: any) => {
    setForm((prev) => {
      const updated = [...prev.subjectCodes];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, subjectCodes: updated };
    });
  };

  const removeSubjectRow = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      subjectCodes: prev.subjectCodes.filter((_, i) => i !== idx),
    }));
  };

  const computedTotalUnits = useMemo(() => {
    return form.subjectCodes.reduce((sum, s) => sum + (s.units || 0), 0);
  }, [form.subjectCodes]);

  const toggleDocumentChecklist = (item: string) => {
    setForm((prev) => {
      const list = prev.documentChecklist.includes(item)
        ? prev.documentChecklist.filter((d) => d !== item)
        : [...prev.documentChecklist, item];
      return { ...prev, documentChecklist: list };
    });
  };

  const removePdfAttachment = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      pdfAttachments: prev.pdfAttachments.filter((_, i) => i !== idx),
    }));
  };

  const renderPhotoSection = () => (
    <div className="space-y-2 flex flex-col items-center min-w-[140px]">
      <Label>Student Photo</Label>
      <canvas ref={canvasRef} className="hidden" />
      {cameraMode ? (
        <div className="flex flex-col items-center gap-2">
          {capturedImage ? (
            <div className="w-32 h-32 rounded-lg border-2 border-emerald-500 overflow-hidden">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" data-testid="img-captured-photo" />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-lg border-2 border-sky-500 overflow-hidden bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                data-testid="video-camera-preview"
              />
            </div>
          )}
          {cameraError && (
            <p className="text-xs text-destructive text-center max-w-[140px]" data-testid="text-camera-error">{cameraError}</p>
          )}
          {capturedImage ? (
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={() => { setCapturedImage(null); startCamera(facingMode); }} data-testid="button-retake-photo">
                <RotateCcw className="w-3 h-3 mr-1" />
                Retake
              </Button>
              <Button type="button" size="sm" onClick={saveCapturedPhoto} disabled={savingCapture} className="bg-emerald-600 text-white" data-testid="button-save-capture">
                {savingCapture ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                Save
              </Button>
            </div>
          ) : !cameraError ? (
            <div className="flex gap-1">
              <Button type="button" size="sm" onClick={capturePhoto} className="bg-sky-600 text-white" data-testid="button-capture-photo">
                <Camera className="w-3 h-3 mr-1" />
                Capture
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={switchCamera} title="Switch camera" data-testid="button-switch-camera">
                <SwitchCamera className="w-3 h-3" />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={closeCameraMode} data-testid="button-close-camera">
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary/20">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt="Student" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} data-testid="input-photo-file" />
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-upload-photo">
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => startCamera(facingMode)} data-testid="button-take-photo">
              <Camera className="w-3 h-3 mr-1" />
              Camera
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderPsgcAddress = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Region</Label>
          <Select
            value={form.regionCode || "_none_"}
            onValueChange={(v) => {
              const code = v === "_none_" ? "" : v;
              const name = regions.find((r) => r.code === code)?.name || "";
              updateField("regionCode", code);
              updateField("regionName", name);
              updateField("provinceCode", "");
              updateField("provinceName", "");
              updateField("cityCode", "");
              updateField("cityName", "");
              updateField("barangayCode", "");
              updateField("barangayName", "");
            }}
          >
            <SelectTrigger data-testid="select-region">
              <SelectValue placeholder="Select region..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Select region...</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{form.regionCode === NCR_CODE ? "District" : "Province"}</Label>
          <Select
            value={form.provinceCode || "_none_"}
            onValueChange={(v) => {
              const code = v === "_none_" ? "" : v;
              const name = provinces.find((p) => p.code === code)?.name || "";
              updateField("provinceCode", code);
              updateField("provinceName", name);
              updateField("cityCode", "");
              updateField("cityName", "");
              updateField("barangayCode", "");
              updateField("barangayName", "");
            }}
            disabled={!provinces.length}
          >
            <SelectTrigger data-testid="select-province">
              <SelectValue placeholder={psgcLoading ? "Loading..." : "Select..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Select...</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>City / Municipality</Label>
          <Select
            value={form.cityCode || "_none_"}
            onValueChange={(v) => {
              const code = v === "_none_" ? "" : v;
              const name = cities.find((c) => c.code === code)?.name || "";
              updateField("cityCode", code);
              updateField("cityName", name);
              updateField("barangayCode", "");
              updateField("barangayName", "");
            }}
            disabled={!cities.length}
          >
            <SelectTrigger data-testid="select-city">
              <SelectValue placeholder={psgcLoading ? "Loading..." : "Select..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Select...</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Barangay</Label>
          <Select
            value={form.barangayCode || "_none_"}
            onValueChange={(v) => {
              const code = v === "_none_" ? "" : v;
              const name = barangays.find((b) => b.code === code)?.name || "";
              updateField("barangayCode", code);
              updateField("barangayName", name);
            }}
            disabled={!barangays.length}
          >
            <SelectTrigger data-testid="select-barangay">
              <SelectValue placeholder={psgcLoading ? "Loading..." : "Select..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none_">Select...</SelectItem>
              {barangays.map((b) => (
                <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2 max-w-xs">
        <Label>ZIP Code</Label>
        <Input value={form.zipCode} onChange={(e) => updateField("zipCode", e.target.value)} placeholder="e.g., 1000" data-testid="input-zip-code" />
      </div>
    </>
  );

  const renderHigherEdForm = () => (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
          {editingEnrollee ? `Edit: ${editingEnrollee.lastName}, ${editingEnrollee.firstName}` : "Higher Education Enrollment Form"}
        </h2>

        <Tabs value={heActiveTab} onValueChange={setHeActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5" data-testid="tabs-he-enrollment">
            <TabsTrigger value="classification" data-testid="tab-he-classification">Classification</TabsTrigger>
            <TabsTrigger value="personal" data-testid="tab-he-personal">Personal</TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-he-contact">Contact</TabsTrigger>
            <TabsTrigger value="academic" data-testid="tab-he-academic">Academic</TabsTrigger>
            <TabsTrigger value="load" data-testid="tab-he-load">Load & Units</TabsTrigger>
          </TabsList>

          <TabsContent value="classification" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Educational Level *</Label>
                <Select
                  value={form.educationalLevelId ? String(form.educationalLevelId) : "_none_"}
                  onValueChange={(v) => {
                    const id = v === "_none_" ? 0 : parseInt(v);
                    updateField("educationalLevelId", id);
                    updateField("section", "");
                  }}
                >
                  <SelectTrigger data-testid="select-level">
                    <SelectValue placeholder="Select level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select level...</SelectItem>
                    {levelsData?.map((l) => (
                      <SelectItem key={l.level.id} value={String(l.level.id)}>
                        {getLevelDisplayName(l.level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enrollment Status *</Label>
                <Select value={form.enrollmentStatus} onValueChange={(v) => updateField("enrollmentStatus", v)}>
                  <SelectTrigger data-testid="select-enrollment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Returning">Returning</SelectItem>
                    <SelectItem value="Transferee">Transferee</SelectItem>
                    <SelectItem value="Re-enrolled">Re-enrolled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year Level</Label>
                <Select value={form.yearLevel || "_none_"} onValueChange={(v) => updateField("yearLevel", v === "_none_" ? "" : v)}>
                  <SelectTrigger data-testid="select-year-level">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select...</SelectItem>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="5th Year">5th Year</SelectItem>
                    <SelectItem value="Others">Others (Specify)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select value={form.semester || "_none_"} onValueChange={(v) => updateField("semester", v === "_none_" ? "" : v)}>
                  <SelectTrigger data-testid="select-semester">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select...</SelectItem>
                    <SelectItem value="1st Semester">1st Semester</SelectItem>
                    <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                    <SelectItem value="Summer Class">Summer Class</SelectItem>
                    <SelectItem value="Others">Others (Specify)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course / Program</Label>
                <Input value={form.courseProgram} onChange={(e) => updateField("courseProgram", e.target.value)} placeholder="e.g., BS Computer Science" data-testid="input-course-program" />
              </div>
              <div className="space-y-2">
                <Label>Major</Label>
                <Input value={form.major} onChange={(e) => updateField("major", e.target.value)} placeholder="e.g., Software Engineering" data-testid="input-major" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={form.section || "_none_"}
                  onValueChange={(v) => updateField("section", v === "_none_" ? "" : v)}
                  disabled={!levelSections.length}
                >
                  <SelectTrigger data-testid="select-section">
                    <SelectValue placeholder={levelSections.length ? "Select section..." : "No sections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select section...</SelectItem>
                    {levelSections.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>School Year</Label>
                <Input value={`SY ${selectedSY}`} readOnly className="bg-secondary/30" data-testid="input-school-year" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>ID No</Label>
                    <Input value={form.idNo} onChange={(e) => updateField("idNo", e.target.value)} placeholder="Auto or manual" data-testid="input-id-no" />
                  </div>
                  <div className="space-y-2">
                    <Label>LRN</Label>
                    <Input value={form.lrn} onChange={(e) => updateField("lrn", e.target.value)} data-testid="input-lrn" />
                  </div>
                  <div className="space-y-2">
                    <Label>PSA Birth Cert No</Label>
                    <Input value={form.psaBirthCertNo} onChange={(e) => updateField("psaBirthCertNo", e.target.value)} data-testid="input-psa" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} data-testid="input-last-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input value={form.middleName} onChange={(e) => updateField("middleName", e.target.value)} data-testid="input-middle-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Extension</Label>
                    <Select value={form.nameExtension || "_none_"} onValueChange={(v) => updateField("nameExtension", v === "_none_" ? "" : v)}>
                      <SelectTrigger data-testid="select-name-ext">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">None</SelectItem>
                        <SelectItem value="Jr">Jr</SelectItem>
                        <SelectItem value="Sr">Sr</SelectItem>
                        <SelectItem value="III">III</SelectItem>
                        <SelectItem value="IV">IV</SelectItem>
                        <SelectItem value="V">V</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {renderPhotoSection()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Sex *</Label>
                <Select value={form.sex || "_none_"} onValueChange={(v) => updateField("sex", v === "_none_" ? "" : v)}>
                  <SelectTrigger data-testid="select-sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select...</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => {
                    updateField("dateOfBirth", e.target.value);
                    if (e.target.value) updateField("age", calculateAge(e.target.value));
                  }}
                  data-testid="input-dob"
                />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input value={form.dateOfBirth ? calculateAge(form.dateOfBirth) : ""} readOnly className="bg-secondary/30" data-testid="input-age" />
              </div>
              <div className="space-y-2">
                <Label>Civil Status</Label>
                <Select value={form.civilStatus || "_none_"} onValueChange={(v) => updateField("civilStatus", v === "_none_" ? "" : v)}>
                  <SelectTrigger data-testid="select-civil-status">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select...</SelectItem>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                    <SelectItem value="Separated">Separated</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => updateField("nationality", e.target.value)} data-testid="input-nationality" />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="indigenous-he"
                    checked={form.isIndigenous}
                    onCheckedChange={(checked) => updateField("isIndigenous", !!checked)}
                    data-testid="checkbox-indigenous"
                  />
                  <Label htmlFor="indigenous-he" className="text-sm">Indigenous People</Label>
                </div>
                {form.isIndigenous && (
                  <Input
                    placeholder="Specify indigenous group..."
                    value={form.indigenousGroup}
                    onChange={(e) => updateField("indigenousGroup", e.target.value)}
                    className="flex-1"
                    data-testid="input-indigenous-group"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Student Email</Label>
                <Input type="email" value={form.studentEmail} onChange={(e) => updateField("studentEmail", e.target.value)} placeholder="student@email.com" data-testid="input-student-email" />
              </div>
              <div className="space-y-2">
                <Label>Mobile No.</Label>
                <Input value={form.mobileNo} onChange={(e) => updateField("mobileNo", e.target.value)} placeholder="09XX-XXX-XXXX" data-testid="input-mobile-no" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emergency Contact Name</Label>
                <Input value={form.emergencyContact} onChange={(e) => updateField("emergencyContact", e.target.value)} data-testid="input-emergency-contact" />
              </div>
              <div className="space-y-2">
                <Label>Emergency Contact No.</Label>
                <Input value={form.emergencyContactNo} onChange={(e) => updateField("emergencyContactNo", e.target.value)} data-testid="input-emergency-contact-no" />
              </div>
            </div>
            <div className="border-t border-border pt-4 mt-2">
              <p className="text-sm font-medium text-muted-foreground mb-3">PSGC Address</p>
              {renderPsgcAddress()}
            </div>
          </TabsContent>

          <TabsContent value="academic" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Previous school information (for returning, transferee, or re-enrolled students)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last Grade / Year Level</Label>
                <Input value={form.lastGradeLevel} onChange={(e) => updateField("lastGradeLevel", e.target.value)} data-testid="input-last-grade" />
              </div>
              <div className="space-y-2">
                <Label>Last School Year</Label>
                <Input value={form.lastSchoolYear} onChange={(e) => updateField("lastSchoolYear", e.target.value)} placeholder="e.g., 2024-2025" data-testid="input-last-sy" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last School Name</Label>
                <Input value={form.lastSchoolName} onChange={(e) => updateField("lastSchoolName", e.target.value)} data-testid="input-last-school-name" />
              </div>
              <div className="space-y-2">
                <Label>Last School ID</Label>
                <Input value={form.lastSchoolId} onChange={(e) => updateField("lastSchoolId", e.target.value)} data-testid="input-last-school-id" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Last School Address</Label>
              <Input value={form.lastSchoolAddress} onChange={(e) => updateField("lastSchoolAddress", e.target.value)} data-testid="input-last-school-address" />
            </div>
          </TabsContent>

          <TabsContent value="load" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-medium">Subject Codes</p>
                <Button size="sm" variant="outline" onClick={addSubjectRow} data-testid="button-add-subject">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Subject
                </Button>
              </div>
              {form.subjectCodes.length > 0 && (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Code</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs w-24">Units</TableHead>
                        <TableHead className="text-xs w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.subjectCodes.map((sub, idx) => (
                        <TableRow key={idx} data-testid={`row-subject-${idx}`}>
                          <TableCell>
                            <Input
                              value={sub.code}
                              onChange={(e) => updateSubjectRow(idx, "code", e.target.value)}
                              placeholder="Code"
                              data-testid={`input-subject-code-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={sub.description || ""}
                              onChange={(e) => updateSubjectRow(idx, "description", e.target.value)}
                              placeholder="Description"
                              data-testid={`input-subject-desc-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={sub.units || ""}
                              onChange={(e) => updateSubjectRow(idx, "units", parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              data-testid={`input-subject-units-${idx}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeSubjectRow(idx)} data-testid={`button-remove-subject-${idx}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center justify-between p-2 rounded-md bg-accent/10 border border-accent/20">
                <span className="text-sm font-medium">Total Units</span>
                <span className="text-sm font-bold text-accent" data-testid="text-total-units">{computedTotalUnits}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">Document Checklist</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {DOCUMENT_CHECKLIST_OPTIONS.map((doc) => (
                  <div key={doc} className="flex items-center gap-2">
                    <Checkbox
                      id={`doc-${doc}`}
                      checked={form.documentChecklist.includes(doc)}
                      onCheckedChange={() => toggleDocumentChecklist(doc)}
                      data-testid={`checkbox-doc-${doc.replace(/\s+/g, "-").toLowerCase()}`}
                    />
                    <Label htmlFor={`doc-${doc}`} className="text-sm">{doc}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium">PDF Attachments</p>
              <input ref={pdfInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handlePdfUpload} data-testid="input-pdf-file" />
              <Button variant="outline" size="sm" onClick={() => pdfInputRef.current?.click()} data-testid="button-upload-pdf">
                <Upload className="w-4 h-4 mr-1" />
                Upload PDF (max 10MB each)
              </Button>
              {form.pdfAttachments.length > 0 && (
                <div className="space-y-2">
                  {form.pdfAttachments.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30" data-testid={`pdf-attachment-${idx}`}>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex-1 truncate">{url.split("/").pop()}</a>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removePdfAttachment(idx)} data-testid={`button-remove-pdf-${idx}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 pt-4 mt-4 border-t border-border">
          {editingEnrollee && (
            <Button variant="outline" onClick={() => handlePrintForm(editingEnrollee)} data-testid="button-print-form">
              <Printer className="w-4 h-4 mr-2" />
              Print Form
            </Button>
          )}
          <Button
            onClick={handleSubmitEnrollee}
            disabled={createMutation.isPending || updateMutation.isPending || syLocked}
            className="bg-emerald-600 text-white"
            data-testid="button-save-enrollee"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {editingEnrollee ? "Update Student" : "Save Student"}
          </Button>
          <Button variant="outline" onClick={resetForm} data-testid="button-reset-form">
            {editingEnrollee ? "Cancel Edit" : "Clear Form"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderBasicEdForm = () => (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-emerald-400" />
          {editingEnrollee ? `Edit: ${editingEnrollee.lastName}, ${editingEnrollee.firstName}` : "Enrollment Form"}
        </h2>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-enrollment">
            <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
            <TabsTrigger value="address" data-testid="tab-address">Address</TabsTrigger>
            <TabsTrigger value="parents" data-testid="tab-parents">Parents</TabsTrigger>
            <TabsTrigger value="enrollment" data-testid="tab-enrollment">Enrollment</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>ID No</Label>
                    <Input value={form.idNo} onChange={(e) => updateField("idNo", e.target.value)} placeholder="Auto or manual" data-testid="input-id-no" />
                  </div>
                  <div className="space-y-2">
                    <Label>PSA Birth Cert No</Label>
                    <Input value={form.psaBirthCertNo} onChange={(e) => updateField("psaBirthCertNo", e.target.value)} data-testid="input-psa" />
                  </div>
                  <div className="space-y-2">
                    <Label>LRN</Label>
                    <Input value={form.lrn} onChange={(e) => updateField("lrn", e.target.value)} data-testid="input-lrn" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} data-testid="input-last-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input value={form.middleName} onChange={(e) => updateField("middleName", e.target.value)} data-testid="input-middle-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Extension</Label>
                    <Select value={form.nameExtension || "_none_"} onValueChange={(v) => updateField("nameExtension", v === "_none_" ? "" : v)}>
                      <SelectTrigger data-testid="select-name-ext">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none_">None</SelectItem>
                        <SelectItem value="Jr">Jr</SelectItem>
                        <SelectItem value="Sr">Sr</SelectItem>
                        <SelectItem value="III">III</SelectItem>
                        <SelectItem value="IV">IV</SelectItem>
                        <SelectItem value="V">V</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {renderPhotoSection()}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sex *</Label>
                <Select value={form.sex || "_none_"} onValueChange={(v) => updateField("sex", v === "_none_" ? "" : v)}>
                  <SelectTrigger data-testid="select-sex">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select...</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth *</Label>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => {
                    updateField("dateOfBirth", e.target.value);
                    if (e.target.value) updateField("age", calculateAge(e.target.value));
                  }}
                  data-testid="input-dob"
                />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <Input value={form.dateOfBirth ? calculateAge(form.dateOfBirth) : ""} readOnly className="bg-secondary/30" data-testid="input-age" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="indigenous"
                  checked={form.isIndigenous}
                  onCheckedChange={(checked) => updateField("isIndigenous", !!checked)}
                  data-testid="checkbox-indigenous"
                />
                <Label htmlFor="indigenous" className="text-sm">Indigenous People</Label>
              </div>
              {form.isIndigenous && (
                <Input
                  placeholder="Specify indigenous group..."
                  value={form.indigenousGroup}
                  onChange={(e) => updateField("indigenousGroup", e.target.value)}
                  className="flex-1"
                  data-testid="input-indigenous-group"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="address" className="space-y-4 mt-4">
            {renderPsgcAddress()}
          </TabsContent>

          <TabsContent value="parents" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Father's Name</Label>
                <Input value={form.fatherName} onChange={(e) => updateField("fatherName", e.target.value)} data-testid="input-father-name" />
              </div>
              <div className="space-y-2">
                <Label>Mother's Maiden Name</Label>
                <Input value={form.motherMaidenName} onChange={(e) => updateField("motherMaidenName", e.target.value)} data-testid="input-mother-name" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guardian Name</Label>
                <Input value={form.guardianName} onChange={(e) => updateField("guardianName", e.target.value)} data-testid="input-guardian-name" />
              </div>
              <div className="space-y-2">
                <Label>Parent/Guardian Tel No.</Label>
                <Input value={form.parentGuardianTel} onChange={(e) => updateField("parentGuardianTel", e.target.value)} data-testid="input-guardian-tel" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="enrollment" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>School Year</Label>
                <Input value={`SY ${selectedSY}`} readOnly className="bg-secondary/30" data-testid="input-school-year" />
              </div>
              <div className="space-y-2">
                <Label>Enrollment Status *</Label>
                <Select value={form.enrollmentStatus} onValueChange={(v) => updateField("enrollmentStatus", v)}>
                  <SelectTrigger data-testid="select-enrollment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Returning">Returning</SelectItem>
                    <SelectItem value="Transferee">Transferee</SelectItem>
                    <SelectItem value="Re-enrolled">Re-enrolled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Educational Level *</Label>
                <Select
                  value={form.educationalLevelId ? String(form.educationalLevelId) : "_none_"}
                  onValueChange={(v) => {
                    const id = v === "_none_" ? 0 : parseInt(v);
                    updateField("educationalLevelId", id);
                    updateField("section", "");
                    updateField("shsTrack", "");
                    updateField("shsStrand", "");
                  }}
                >
                  <SelectTrigger data-testid="select-level">
                    <SelectValue placeholder="Select level..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select level...</SelectItem>
                    {levelsData?.map((l) => (
                      <SelectItem key={l.level.id} value={String(l.level.id)}>
                        {getLevelDisplayName(l.level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={form.section || "_none_"}
                  onValueChange={(v) => updateField("section", v === "_none_" ? "" : v)}
                  disabled={!levelSections.length}
                >
                  <SelectTrigger data-testid="select-section">
                    <SelectValue placeholder={levelSections.length ? "Select section..." : "No sections"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select section...</SelectItem>
                    {levelSections.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isSeniorHigh && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SHS Track</Label>
                  <Select
                    value={form.shsTrack || "_none_"}
                    onValueChange={(v) => {
                      updateField("shsTrack", v === "_none_" ? "" : v);
                      updateField("shsStrand", "");
                    }}
                  >
                    <SelectTrigger data-testid="select-shs-track">
                      <SelectValue placeholder="Select track..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Select track...</SelectItem>
                      {Object.keys(SHS_STRANDS).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SHS Strand</Label>
                  <Select
                    value={form.shsStrand || "_none_"}
                    onValueChange={(v) => updateField("shsStrand", v === "_none_" ? "" : v)}
                    disabled={!form.shsTrack || !(SHS_STRANDS[form.shsTrack]?.length)}
                  >
                    <SelectTrigger data-testid="select-shs-strand">
                      <SelectValue placeholder={form.shsTrack && !SHS_STRANDS[form.shsTrack]?.length ? "N/A" : "Select strand..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Select strand...</SelectItem>
                      {(SHS_STRANDS[form.shsTrack] || []).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(form.enrollmentStatus === "Returning" || form.enrollmentStatus === "Transferee" || form.enrollmentStatus === "Re-enrolled") && (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-secondary/10">
                <p className="text-sm font-medium text-muted-foreground">Previous School Information</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Last Grade Level</Label>
                    <Input value={form.lastGradeLevel} onChange={(e) => updateField("lastGradeLevel", e.target.value)} data-testid="input-last-grade" />
                  </div>
                  <div className="space-y-2">
                    <Label>Last School Year</Label>
                    <Input value={form.lastSchoolYear} onChange={(e) => updateField("lastSchoolYear", e.target.value)} placeholder="e.g., 2024-2025" data-testid="input-last-sy" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Last School Name</Label>
                    <Input value={form.lastSchoolName} onChange={(e) => updateField("lastSchoolName", e.target.value)} data-testid="input-last-school-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Last School ID</Label>
                    <Input value={form.lastSchoolId} onChange={(e) => updateField("lastSchoolId", e.target.value)} data-testid="input-last-school-id" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Last School Address</Label>
                  <Input value={form.lastSchoolAddress} onChange={(e) => updateField("lastSchoolAddress", e.target.value)} data-testid="input-last-school-address" />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3 pt-4 mt-4 border-t border-border">
          {editingEnrollee && (
            <Button variant="outline" onClick={() => handlePrintForm(editingEnrollee)} data-testid="button-print-form">
              <Printer className="w-4 h-4 mr-2" />
              Print Form
            </Button>
          )}
          <Button
            onClick={handleSubmitEnrollee}
            disabled={createMutation.isPending || updateMutation.isPending || syLocked}
            className="bg-emerald-600 text-white"
            data-testid="button-save-enrollee"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {editingEnrollee ? "Update Student" : "Save Student"}
          </Button>
          <Button variant="outline" onClick={resetForm} data-testid="button-reset-form">
            {editingEnrollee ? "Cancel Edit" : "Clear Form"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderEnrollmentForm = () => {
    if (isHigherEd) return renderHigherEdForm();
    return renderBasicEdForm();
  };

  const renderLevelGroupTable = (levelId: string, enrollees: Enrollee[]) => {
    const level = levelsById[parseInt(levelId)];
    if (!level) return null;
    const name = getLevelDisplayName(level);
    const maleCount = enrollees.filter((e) => e.sex === "Male").length;
    const femaleCount = enrollees.filter((e) => e.sex === "Female").length;
    const isExpanded = expandedLevels.has(levelId);

    return (
      <div key={levelId} className="border border-border rounded-md overflow-hidden" data-testid={`level-group-${levelId}`}>
        <button
          className="w-full flex items-center justify-between gap-3 p-3 hover-elevate text-left"
          onClick={() => toggleLevel(levelId)}
          data-testid={`button-toggle-level-${levelId}`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-medium truncate">{name}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="secondary" data-testid={`badge-level-count-${levelId}`}>{enrollees.length}</Badge>
            <span className="text-xs text-muted-foreground">M: {maleCount}</span>
            <span className="text-xs text-muted-foreground">F: {femaleCount}</span>
          </div>
        </button>
        {isExpanded && (
          <div className="border-t border-border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>ID No.</TableHead>
                    <TableHead>Date Enrolled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sex</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollees.map((enrollee) => (
                    <TableRow key={enrollee.id} data-testid={`row-enrollee-${enrollee.id}`}>
                      <TableCell>
                        <button
                          className="font-medium text-left hover:text-primary transition-colors cursor-pointer"
                          onClick={() => openEditInForm(enrollee)}
                          data-testid={`text-name-${enrollee.id}`}
                        >
                          {enrollee.lastName}, {enrollee.firstName} {enrollee.middleName || ""} {enrollee.nameExtension || ""}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-id-${enrollee.id}`}>
                        {enrollee.idNo || "-"}
                      </TableCell>
                      <TableCell data-testid={`text-date-${enrollee.id}`}>
                        {enrollee.enrollmentDate ? new Date(enrollee.enrollmentDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={enrollee.enrollmentStatus === "New" ? "default" : "secondary"}
                          data-testid={`badge-status-${enrollee.id}`}
                        >
                          {enrollee.enrollmentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-sex-${enrollee.id}`}>{enrollee.sex}</TableCell>
                      <TableCell data-testid={`text-age-${enrollee.id}`}>
                        {enrollee.age || (enrollee.dateOfBirth ? calculateAge(enrollee.dateOfBirth) : "-")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditInForm(enrollee)}
                            data-testid={`button-edit-enrollee-${enrollee.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openAccountDialog(enrollee)}
                            data-testid={`button-account-enrollee-${enrollee.id}`}
                          >
                            <Wallet className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            disabled={syLocked}
                            onClick={() => deleteMutation.mutate(enrollee.id)}
                            data-testid={`button-delete-enrollee-${enrollee.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRegistry = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className={`border-border bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 cursor-pointer transition-all ${statusFilter === null ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter(null)}
          data-testid="card-total-enrollees"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary" data-testid="text-total-enrollees">{analytics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">SY {selectedSY}</p>
          </CardContent>
        </Card>
        <Card
          className={`border-border bg-card cursor-pointer transition-all ${statusFilter === "New" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "New" ? null : "New")}
          data-testid="card-new-enrollees"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New</CardTitle>
            <UserPlus className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-new-enrollees">{analytics.newCount}</div>
            <p className="text-xs text-muted-foreground mt-1">First-time students</p>
          </CardContent>
        </Card>
        <Card
          className={`border-border bg-card cursor-pointer transition-all ${statusFilter === "Returning" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "Returning" ? null : "Returning")}
          data-testid="card-returning-enrollees"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Returning</CardTitle>
            <UserCheck className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-returning-enrollees">{analytics.returning}</div>
            <p className="text-xs text-muted-foreground mt-1">Previous students</p>
          </CardContent>
        </Card>
        <Card
          className={`border-border bg-card cursor-pointer transition-all ${statusFilter === "Re-enrolled" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "Re-enrolled" ? null : "Re-enrolled")}
          data-testid="card-reenrolled-enrollees"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Re-enrolled</CardTitle>
            <RefreshCw className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-reenrolled-enrollees">{analytics.reenrolled}</div>
            <p className="text-xs text-muted-foreground mt-1">Re-enrolled students</p>
          </CardContent>
        </Card>
        <Card
          className={`border-border bg-card cursor-pointer transition-all ${statusFilter === "Transferee" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "Transferee" ? null : "Transferee")}
          data-testid="card-transferee-enrollees"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transferees</CardTitle>
            <ArrowRightLeft className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-transferee-enrollees">{analytics.transferees}</div>
            <p className="text-xs text-muted-foreground mt-1">From other schools</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, ID, LRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-[250px]"
            data-testid="input-search-enrollees"
          />
        </div>
      </div>

      {enrolleesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !filteredEnrollees.length ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 rounded-full bg-secondary/50">
                <GraduationCap className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No students found</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {searchQuery ? "No results match your search." : `Switch to "Enrollment Form" to register students for SY ${selectedSY}.`}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border bg-card" data-testid="card-basic-ed-section">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-lg">Basic Education</CardTitle>
              </div>
              <Badge variant="secondary" data-testid="badge-basic-ed-count">
                {basicEdTotal} Student{basicEdTotal !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(groupedBySection.basicEd).length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">No Basic Education students found.</p>
              ) : (
                Object.entries(groupedBySection.basicEd).map(([levelId, enrollees]) =>
                  renderLevelGroupTable(levelId, enrollees)
                )
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card" data-testid="card-higher-ed-section">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <CardTitle className="text-lg">Higher Education</CardTitle>
              </div>
              <Badge variant="secondary" data-testid="badge-higher-ed-count">
                {higherEdTotal} Student{higherEdTotal !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(groupedBySection.higherEd).length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">No Higher Education students found.</p>
              ) : (
                Object.entries(groupedBySection.higherEd).map(([levelId, enrollees]) =>
                  renderLevelGroupTable(levelId, enrollees)
                )
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="enrollees-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">
            Student Directory
          </h1>
          <p className="text-muted-foreground text-sm">Student Enrollment Management</p>
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
              Student Registry
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setViewMode("form"); resetForm(); }} data-testid="button-view-form">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Enrollment Form
            </Button>
          )}
          <Button variant="outline" onClick={handleExportPdf} disabled={!filteredEnrollees.length} data-testid="button-export-pdf">
            <Printer className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {syLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-2 flex items-center gap-2 text-amber-400 text-sm">
          <Lock className="w-4 h-4" />
          <span>SY {selectedSY} is locked. You are viewing read-only data from a past school year.</span>
        </div>
      )}

      {viewMode === "form" ? renderEnrollmentForm() : renderRegistry()}

      <Dialog open={isAccountDialogOpen} onOpenChange={(open) => { if (!open) { setAccountDialogOpen(false); setAccountEnrollee(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-account">
          <DialogHeader>
            <DialogTitle>
              Financial Account: {accountEnrollee ? `${accountEnrollee.lastName}, ${accountEnrollee.firstName}` : ""}
            </DialogTitle>
          </DialogHeader>

          {accountEnrollee && (
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">School Fees Breakdown</p>
                {accountFee ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                      <span className="text-sm">Entrance Fee</span>
                      <span className="text-sm font-semibold" data-testid="text-acc-entrance-fee">₱ {formatCurrency(accountFee.entranceFee)}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                      <span className="text-sm">Tuition Fee</span>
                      <span className="text-sm font-semibold" data-testid="text-acc-tuition-fee">₱ {formatCurrency(accountFee.tuitionFee)}</span>
                    </div>
                    {(accountFee.miscellaneousFees as MiscFeeItem[])?.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-md bg-secondary/20">
                        <span className="text-sm text-muted-foreground">{m.name}</span>
                        <span className="text-sm">₱ {formatCurrency(m.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-2 rounded-md bg-accent/10 border border-accent/20">
                      <span className="text-sm font-medium">Total School Fees</span>
                      <span className="text-sm font-bold text-accent" data-testid="text-acc-total-school-fees">₱ {formatCurrency(accTotalSchoolFees)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No fees configured for this level.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Back Accounts (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={accBackAccounts}
                  onChange={(e) => setAccBackAccounts(e.target.value)}
                  data-testid="input-back-accounts"
                />
              </div>

              {(["otherFees", "discounts", "scholarships"] as const).map((section) => {
                const items = section === "otherFees" ? accOtherFees : section === "discounts" ? accDiscounts : accScholarships;
                const label = section === "otherFees" ? "Other Fees" : section === "discounts" ? "Discounts" : "Scholarships";
                return (
                  <div key={section} className="space-y-2">
                    <Label>{label}</Label>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30" data-testid={`${section}-item-${idx}`}>
                        <span className="flex-1 text-sm">{item.name}</span>
                        <span className="text-sm font-semibold">₱ {formatCurrency(item.amount)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeDynamicItem(section, idx)}
                          className="text-destructive"
                          data-testid={`button-remove-${section}-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Item name"
                          value={addingTo === section ? newItemName : ""}
                          onFocus={() => setAddingTo(section)}
                          onChange={(e) => { setAddingTo(section); setNewItemName(e.target.value); }}
                          data-testid={`input-${section}-name`}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDynamicItem(section); } }}
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={addingTo === section ? newItemAmount : ""}
                          onFocus={() => setAddingTo(section)}
                          onChange={(e) => { setAddingTo(section); setNewItemAmount(e.target.value); }}
                          data-testid={`input-${section}-amount`}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDynamicItem(section); } }}
                        />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addDynamicItem(section)} data-testid={`button-add-${section}`}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="font-semibold">Total Applicable Fees</span>
                <span className="text-xl font-bold text-primary" data-testid="text-acc-grand-total">
                  ₱ {formatCurrency(accGrandTotal)}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Payment History</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAccountDialogOpen(false);
                      setAccountEnrollee(null);
                      navigate("/dashboard/finance/collection");
                    }}
                    data-testid="button-go-to-payment"
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Record Payment
                  </Button>
                </div>
                {paymentHistory && paymentHistory.length > 0 ? (
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">S.I. No.</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentHistory.map((p) => (
                          <TableRow key={p.id} data-testid={`row-payment-${p.id}`}>
                            <TableCell className="text-xs">
                              {p.date ? (() => { const pts = p.date.split("-"); return pts.length === 3 ? `${pts[1]}/${pts[2]}/${pts[0]}` : p.date; })() : "-"}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{p.siNo}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.description || p.collectionCategory}</TableCell>
                            <TableCell className="text-xs text-right font-medium">₱ {formatCurrency(p.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No payments recorded yet.</p>
                )}
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-secondary/30">
                <span className="text-sm font-medium">Total Amount Paid</span>
                <span className="text-sm font-bold text-emerald-400" data-testid="text-acc-total-paid">
                  ₱ {formatCurrency(totalAmountPaid)}
                </span>
              </div>

              <div className={`flex items-center justify-between p-3 rounded-lg border ${outstandingBalance > 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                <span className="font-semibold">Outstanding Account Balance</span>
                <span className={`text-xl font-bold ${outstandingBalance > 0 ? "text-red-400" : "text-emerald-400"}`} data-testid="text-acc-outstanding">
                  ₱ {formatCurrency(outstandingBalance)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={handleGenerateSOA} data-testid="button-generate-soa">
              <FileDown className="w-4 h-4 mr-2" />
              Generate SOA
            </Button>
            <Button variant="outline" onClick={() => { setAccountDialogOpen(false); setAccountEnrollee(null); }} data-testid="button-cancel-account">
              Cancel
            </Button>
            <Button onClick={handleSaveAccount} disabled={accountMutation.isPending || syLocked} data-testid="button-save-account">
              {accountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Wallet className="w-4 h-4 mr-2" />
              Save Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
