import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { EducationalLevel, SchoolFee, MiscFeeItem } from "@shared/schema";
import { HIGHER_ED_LEVELS } from "@shared/schema";
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
  Printer,
  Wallet,
  Loader2,
  FileText,
  Edit,
  History,
  ArrowLeft,
  Lock,
} from "lucide-react";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "Others"];
const SEMESTERS = ["1st Semester", "2nd Semester", "Summer Class", "Others"];

export default function SchoolFeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const [viewMode, setViewMode] = useState<"form" | "registry">("form");

  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [entranceFee, setEntranceFee] = useState("");
  const [tuitionFee, setTuitionFee] = useState("");
  const [miscItems, setMiscItems] = useState<MiscFeeItem[]>([]);
  const [newMiscName, setNewMiscName] = useState("");
  const [newMiscAmount, setNewMiscAmount] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [yearLevelOther, setYearLevelOther] = useState("");
  const [semester, setSemester] = useState("");
  const [semesterOther, setSemesterOther] = useState("");

  const schoolYears = useMemo(() => generateSchoolYears(), []);

  const { data: levelsData, isLoading: levelsLoading } = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch levels");
      return res.json();
    },
  });

  const { data: feesData, isLoading: feesLoading } = useQuery<SchoolFee[]>({
    queryKey: [api.fees.listFees.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.fees.listFees.path}?schoolYear=${selectedSY}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch fees");
      return res.json();
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.fees.upsertFee.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fees.listFees.path, selectedSY] });
      toast({ title: "School fees saved successfully" });
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const feesByLevelId = useMemo(() => {
    const map: Record<number, SchoolFee[]> = {};
    feesData?.forEach((f) => {
      if (!map[f.educationalLevelId]) map[f.educationalLevelId] = [];
      map[f.educationalLevelId].push(f);
    });
    return map;
  }, [feesData]);

  const editingLevel = useMemo(() => {
    if (!editingLevelId || !levelsData) return null;
    return levelsData.find((l) => l.level.id === editingLevelId)?.level || null;
  }, [editingLevelId, levelsData]);

  const isHigherEd = useMemo(() => {
    return editingLevel ? HIGHER_ED_LEVELS.includes(editingLevel.parentLevel) : false;
  }, [editingLevel]);

  const resetForm = () => {
    setEditingLevelId(null);
    setEntranceFee("");
    setTuitionFee("");
    setMiscItems([]);
    setNewMiscName("");
    setNewMiscAmount("");
    setYearLevel("");
    setYearLevelOther("");
    setSemester("");
    setSemesterOther("");
  };

  const openFeeForEdit = (fee: SchoolFee) => {
    setEditingLevelId(fee.educationalLevelId);
    setEntranceFee(fee.entranceFee || "0");
    setTuitionFee(fee.tuitionFee || "0");
    setMiscItems((fee.miscellaneousFees as MiscFeeItem[]) || []);
    setYearLevel(fee.yearLevel || "");
    setYearLevelOther("");
    setSemester(fee.semester || "");
    setSemesterOther("");
    if (fee.yearLevel && !YEAR_LEVELS.includes(fee.yearLevel)) {
      setYearLevel("Others");
      setYearLevelOther(fee.yearLevel);
    }
    if (fee.semester && !SEMESTERS.includes(fee.semester)) {
      setSemester("Others");
      setSemesterOther(fee.semester);
    }
    setViewMode("form");
  };

  const openLevelForEdit = (levelId: number) => {
    setEditingLevelId(levelId);
    const level = levelsData?.find((l) => l.level.id === levelId)?.level;
    const isHE = level ? HIGHER_ED_LEVELS.includes(level.parentLevel) : false;
    const fees = feesByLevelId[levelId];
    if (fees && fees.length > 0) {
      const fee = fees[0];
      setEntranceFee(fee.entranceFee || "0");
      setTuitionFee(fee.tuitionFee || "0");
      setMiscItems((fee.miscellaneousFees as MiscFeeItem[]) || []);
      if (isHE) {
        setYearLevel(fee.yearLevel || "");
        setSemester(fee.semester || "");
      }
    } else {
      setEntranceFee("");
      setTuitionFee("");
      setMiscItems([]);
    }
    if (!isHE) {
      setYearLevel("");
      setSemester("");
    }
    setViewMode("form");
  };

  const addMiscItem = () => {
    if (!newMiscName.trim() || !newMiscAmount.trim()) return;
    const amount = parseFloat(newMiscAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setMiscItems([...miscItems, { name: newMiscName.trim(), amount }]);
    setNewMiscName("");
    setNewMiscAmount("");
  };

  const removeMiscItem = (index: number) => {
    setMiscItems(miscItems.filter((_, i) => i !== index));
  };

  const totalMisc = useMemo(() => {
    return miscItems.reduce((sum, item) => sum + item.amount, 0);
  }, [miscItems]);

  const totalSchoolFees = useMemo(() => {
    const entrance = parseFloat(entranceFee) || 0;
    const tuition = parseFloat(tuitionFee) || 0;
    return entrance + tuition + totalMisc;
  }, [entranceFee, tuitionFee, totalMisc]);

  const handleSaveFees = () => {
    if (editingLevelId === null) {
      toast({ title: "Please select an educational level first", variant: "destructive" });
      return;
    }
    const entrance = parseFloat(entranceFee) || 0;
    const tuition = parseFloat(tuitionFee) || 0;

    const resolvedYearLevel = yearLevel === "Others" ? yearLevelOther : yearLevel;
    const resolvedSemester = semester === "Others" ? semesterOther : semester;

    upsertMutation.mutate({
      educationalLevelId: editingLevelId,
      entranceFee: entrance.toFixed(2),
      tuitionFee: tuition.toFixed(2),
      miscellaneousFees: miscItems,
      totalMiscFees: totalMisc.toFixed(2),
      totalSchoolFees: totalSchoolFees.toFixed(2),
      yearLevel: isHigherEd ? resolvedYearLevel || null : null,
      semester: isHigherEd ? resolvedSemester || null : null,
    });
  };

  const grandTotal = useMemo(() => {
    if (!feesData) return 0;
    return feesData.reduce((sum, f) => sum + parseFloat(f.totalSchoolFees || "0"), 0);
  }, [feesData]);

  const levelsWithFees = useMemo(() => {
    if (!levelsData) return 0;
    return levelsData.filter((l) => feesByLevelId[l.level.id]?.length).length;
  }, [levelsData, feesByLevelId]);

  const handlePrintFees = () => {
    if (!user || !feesData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let startY = addPdfHeader(doc, user);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`School Fees Schedule - SY ${selectedSY}`, pageWidth / 2, startY, { align: "center" });
    startY += 6;

    const levelsById: Record<number, EducationalLevel> = {};
    levelsData?.forEach((l) => { levelsById[l.level.id] = l.level; });

    const tableData = feesData.map((fee) => {
      const level = levelsById[fee.educationalLevelId];
      const levelLabel = level
        ? (level.grandchildLevel
          ? `${level.parentLevel} > ${level.childLevel} > ${level.grandchildLevel}`
          : `${level.parentLevel} > ${level.childLevel}`)
        : "Unknown";
      return [
        levelLabel,
        fee.yearLevel || "-",
        fee.semester || "-",
        `₱ ${formatCurrency(fee.entranceFee)}`,
        `₱ ${formatCurrency(fee.tuitionFee)}`,
        `₱ ${formatCurrency(fee.totalMiscFees)}`,
        `₱ ${formatCurrency(fee.totalSchoolFees)}`,
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [["Educational Level", "Year Level", "Semester", "Entrance Fee", "Tuition Fee", "Misc. Fees", "Total Fees"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.25 },
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

    doc.save(`School_Fees_${selectedSY}.pdf`);
    toast({ title: "PDF report downloaded" });
  };

  const isLoading = levelsLoading || feesLoading;

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="school-fees-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">
            School Fees
          </h1>
          <p className="text-muted-foreground text-sm">Academic Fee Structure Management</p>
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
              Fee Schedule
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setViewMode("form"); resetForm(); }} data-testid="button-view-form">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Fee Entry
            </Button>
          )}
          <Button variant="outline" onClick={handlePrintFees} disabled={!feesData?.length} data-testid="button-print-fees">
            <Printer className="w-4 h-4 mr-2" />
            Print Fees
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
              <Wallet className="w-5 h-5 text-emerald-400" />
              {editingLevel ? `Set Fees: ${editingLevel.parentLevel} - ${editingLevel.childLevel}${editingLevel.grandchildLevel ? ` - ${editingLevel.grandchildLevel}` : ""}` : "Fee Entry Form"}
            </h2>

            <div className="space-y-2">
              <Label>Educational Level *</Label>
              <Select
                value={editingLevelId ? String(editingLevelId) : "_none_"}
                onValueChange={(v) => {
                  if (v === "_none_") {
                    resetForm();
                    return;
                  }
                  openLevelForEdit(parseInt(v));
                }}
              >
                <SelectTrigger data-testid="select-fee-level">
                  <SelectValue placeholder="Select educational level..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Select educational level...</SelectItem>
                  {levelsData?.map((entry) => (
                    <SelectItem key={entry.level.id} value={String(entry.level.id)}>
                      {entry.level.parentLevel} - {entry.level.childLevel}
                      {entry.level.grandchildLevel ? ` - ${entry.level.grandchildLevel}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isHigherEd && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border border-sky-500/30 bg-sky-500/5">
                <div className="space-y-2">
                  <Label>Year Level</Label>
                  <Select value={yearLevel || "_none_"} onValueChange={(v) => { setYearLevel(v === "_none_" ? "" : v); if (v !== "Others") setYearLevelOther(""); }}>
                    <SelectTrigger data-testid="select-year-level">
                      <SelectValue placeholder="Select year level..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Select year level...</SelectItem>
                      {YEAR_LEVELS.map((yl) => (
                        <SelectItem key={yl} value={yl}>{yl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {yearLevel === "Others" && (
                    <Input placeholder="Specify year level..." value={yearLevelOther} onChange={(e) => setYearLevelOther(e.target.value)} data-testid="input-year-level-other" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Semester / Term</Label>
                  <Select value={semester || "_none_"} onValueChange={(v) => { setSemester(v === "_none_" ? "" : v); if (v !== "Others") setSemesterOther(""); }}>
                    <SelectTrigger data-testid="select-semester">
                      <SelectValue placeholder="Select semester..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Select semester...</SelectItem>
                      {SEMESTERS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {semester === "Others" && (
                    <Input placeholder="Specify term..." value={semesterOther} onChange={(e) => setSemesterOther(e.target.value)} data-testid="input-semester-other" />
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrance Fee (₱)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={entranceFee} onChange={(e) => setEntranceFee(e.target.value)} data-testid="input-entrance-fee" />
              </div>
              <div className="space-y-2">
                <Label>Tuition Fee (₱)</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00" value={tuitionFee} onChange={(e) => setTuitionFee(e.target.value)} data-testid="input-tuition-fee" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Miscellaneous Fees</Label>
              <div className="space-y-2">
                {miscItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30" data-testid={`misc-item-${idx}`}>
                    <span className="flex-1 text-sm">{item.name}</span>
                    <span className="text-sm font-semibold">₱ {formatCurrency(item.amount)}</span>
                    <Button size="icon" variant="ghost" onClick={() => removeMiscItem(idx)} className="text-destructive" data-testid={`button-remove-misc-${idx}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Item Name</Label>
                  <Input placeholder="e.g., Laboratory Fee" value={newMiscName} onChange={(e) => setNewMiscName(e.target.value)} data-testid="input-misc-name" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMiscItem(); } }} />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-xs text-muted-foreground">Amount (₱)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0.00" value={newMiscAmount} onChange={(e) => setNewMiscAmount(e.target.value)} data-testid="input-misc-amount" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMiscItem(); } }} />
                </div>
                <Button size="sm" variant="outline" onClick={addMiscItem} data-testid="button-add-misc">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-accent/10 border border-accent/20">
                <span className="text-sm font-medium">Total Miscellaneous Fees</span>
                <span className="text-sm font-bold text-accent" data-testid="text-total-misc">₱ {formatCurrency(totalMisc)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-semibold">Total School Fees</span>
              <span className="text-xl font-bold text-primary" data-testid="text-total-school-fees">₱ {formatCurrency(totalSchoolFees)}</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveFees} disabled={upsertMutation.isPending || editingLevelId === null || syLocked} className="bg-emerald-600 text-white" data-testid="button-save-fees">
                {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Wallet className="w-4 h-4 mr-2" />
                Save Fees
              </Button>
              <Button variant="outline" onClick={resetForm} data-testid="button-reset-form">
                Clear Form
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30" data-testid="card-total-levels">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Registered Levels</CardTitle>
                <FileText className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary" data-testid="text-total-levels">{levelsData?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">SY {selectedSY}</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card" data-testid="card-with-fees">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Levels with Fees</CardTitle>
                <Wallet className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="text-levels-with-fees">{levelsWithFees}</div>
                <p className="text-xs text-muted-foreground mt-1">of {levelsData?.length || 0} levels configured</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card" data-testid="card-grand-total">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Grand Total (All Levels)</CardTitle>
                <Wallet className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-grand-total">₱ {formatCurrency(grandTotal)}</div>
                <p className="text-xs text-muted-foreground mt-1">Combined fees across all levels</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card" data-testid="card-fees-table">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-lg">Fee Structure by Level</CardTitle>
              <Badge variant="secondary" data-testid="badge-fee-count">{feesData?.length || 0} Fee Entries</Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !feesData?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <div className="p-4 rounded-full bg-secondary/50">
                    <Wallet className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold">No fees configured</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Switch to "Fee Entry" to configure fees for SY {selectedSY}.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Level</TableHead>
                        <TableHead>Sub-Level</TableHead>
                        <TableHead>Year Level</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead className="text-right">Entrance</TableHead>
                        <TableHead className="text-right">Tuition</TableHead>
                        <TableHead className="text-right">Misc.</TableHead>
                        <TableHead className="text-right">Total Fees</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feesData.map((fee) => {
                        const level = levelsData?.find((l) => l.level.id === fee.educationalLevelId)?.level;
                        return (
                          <TableRow key={fee.id} data-testid={`row-fee-${fee.id}`}>
                            <TableCell className="font-medium">{level?.parentLevel || "-"}</TableCell>
                            <TableCell>{level ? `${level.childLevel}${level.grandchildLevel ? ` - ${level.grandchildLevel}` : ""}` : "-"}</TableCell>
                            <TableCell>{fee.yearLevel || "-"}</TableCell>
                            <TableCell>{fee.semester || "-"}</TableCell>
                            <TableCell className="text-right text-sm">₱ {formatCurrency(fee.entranceFee)}</TableCell>
                            <TableCell className="text-right text-sm">₱ {formatCurrency(fee.tuitionFee)}</TableCell>
                            <TableCell className="text-right text-sm">₱ {formatCurrency(fee.totalMiscFees)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              <span className="text-primary">₱ {formatCurrency(fee.totalSchoolFees)}</span>
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => openFeeForEdit(fee)} data-testid={`button-edit-fee-${fee.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span className="text-lg font-semibold text-white">Grand Total</span>
              </div>
              <span className="text-2xl font-bold text-emerald-400" data-testid="text-grand-total-bottom">₱ {formatCurrency(grandTotal)}</span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
