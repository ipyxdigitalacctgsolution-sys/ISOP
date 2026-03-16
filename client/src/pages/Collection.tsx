import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { Collection, Enrollee, SchoolFee, EducationalLevel } from "@shared/schema";
import { generateSchoolYears, getCurrentSchoolYear, isSchoolYearLocked } from "@/lib/educational-levels-data";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { addPdfHeader } from "@/lib/pdf-header";
import autoTable from "jspdf-autotable";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Printer,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Wallet,
  Calendar,
  FileText,
  History,
  Edit,
  ArrowLeft,
  Lock,
} from "lucide-react";

const COLLECTION_CATEGORIES = [
  "School Fees",
  "Other School Fees",
  "Back Accounts",
  "Other Miscellaneous Income",
  "Other Income Generating Income",
  "Subsidy Income",
  "Scholarship Income",
];

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function getLastDayOfMonth(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function todayFormatted(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

type GroupedCollections = {
  date: string;
  items: Collection[];
  total: number;
};

export default function CollectionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const [viewMode, setViewMode] = useState<"form" | "history">("form");
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth());
  const [dateTo, setDateTo] = useState(getLastDayOfMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const [entryForm, setEntryForm] = useState({
    date: todayFormatted(),
    name: "",
    siNo: "",
    collectionCategory: "",
    description: "",
    amount: "",
    enrolleeId: null as number | null,
  });

  const [selectedEnrolleeInfo, setSelectedEnrolleeInfo] = useState<{
    level: string;
    idNo: string;
    outstandingBalance: number;
  } | null>(null);

  const [nameSearch, setNameSearch] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    date: "",
    name: "",
    siNo: "",
    collectionCategory: "",
    description: "",
    amount: "",
    enrolleeId: null as number | null,
  });

  const schoolYears = useMemo(() => generateSchoolYears(), []);

  const { data: collectionsData, isLoading } = useQuery<Collection[]>({
    queryKey: [api.collections.list.path, selectedSY, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ schoolYear: selectedSY });
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      const res = await fetch(`${api.collections.list.path}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: enrolleesData } = useQuery<Enrollee[]>({
    queryKey: [api.enrollees.list.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.enrollees.list.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: levelsData } = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: feesData } = useQuery<SchoolFee[]>({
    queryKey: [api.fees.listFees.path, selectedSY],
    queryFn: async () => {
      const res = await fetch(`${api.fees.listFees.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const levelsById = useMemo(() => {
    const map: Record<number, EducationalLevel> = {};
    levelsData?.forEach((l) => { map[l.level.id] = l.level; });
    return map;
  }, [levelsData]);

  const feesByLevelId = useMemo(() => {
    const map: Record<number, SchoolFee> = {};
    feesData?.forEach((f) => { map[f.educationalLevelId] = f; });
    return map;
  }, [feesData]);

  const fetchNextSiNo = async () => {
    try {
      const res = await fetch(`${api.collections.nextSiNo.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      const data = await res.json();
      setEntryForm((p) => ({ ...p, siNo: data.siNo || "0001" }));
    } catch {
      setEntryForm((p) => ({ ...p, siNo: "0001" }));
    }
  };

  useEffect(() => {
    if (viewMode === "form") {
      fetchNextSiNo();
    }
  }, [viewMode, selectedSY]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", api.collections.create.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.collections.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.collections.byEnrollee.path] });
      toast({ title: "Collection entry saved successfully" });
      resetEntryForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const url = buildUrl(api.collections.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.collections.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.collections.byEnrollee.path] });
      toast({ title: "Collection entry updated" });
      setEditDialogOpen(false);
      setEditingCollection(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.collections.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.collections.list.path] });
      toast({ title: "Collection entry deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const enrolleeNames = useMemo(() => {
    if (!enrolleesData) return [];
    return enrolleesData.map((e) => ({
      id: e.id,
      name: `${e.lastName}, ${e.firstName}${e.middleName ? ` ${e.middleName}` : ""}`,
      enrollee: e,
    }));
  }, [enrolleesData]);

  const filteredNames = useMemo(() => {
    if (!nameSearch) return enrolleeNames.slice(0, 20);
    const q = nameSearch.toLowerCase();
    return enrolleeNames.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 20);
  }, [enrolleeNames, nameSearch]);

  const computeEnrolleeInfo = async (enrollee: Enrollee) => {
    const level = levelsById[enrollee.educationalLevelId];
    const levelName = level
      ? `${level.parentLevel} - ${level.childLevelOther || level.childLevel}`
      : "N/A";
    const fee = feesByLevelId[enrollee.educationalLevelId];
    const totalFees = fee ? parseFloat(fee.totalSchoolFees || "0") : 0;
    const backAccounts = parseFloat(enrollee.backAccounts || "0");
    const otherFees = (enrollee.otherFees as any[] || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const discounts = (enrollee.discounts as any[] || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const scholarships = (enrollee.scholarships as any[] || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
    const totalApplicable = totalFees + backAccounts + otherFees - discounts - scholarships;

    let totalPaid = 0;
    try {
      const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: enrollee.id });
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const payments: Collection[] = await res.json();
        totalPaid = payments.reduce((s, c) => s + parseFloat(String(c.amount) || "0"), 0);
      }
    } catch {}

    return {
      level: levelName,
      idNo: enrollee.idNo || "N/A",
      outstandingBalance: totalApplicable - totalPaid,
    };
  };

  const handleNameSelect = async (item: { id: number; name: string; enrollee: Enrollee }) => {
    setEntryForm((p) => ({ ...p, name: item.name, enrolleeId: item.id }));
    setNameSearch("");
    setShowNameDropdown(false);
    const info = await computeEnrolleeInfo(item.enrollee);
    setSelectedEnrolleeInfo(info);
  };

  const resetEntryForm = () => {
    setEntryForm({
      date: todayFormatted(),
      name: "",
      siNo: "",
      collectionCategory: "",
      description: "",
      amount: "",
      enrolleeId: null,
    });
    setNameSearch("");
    setSelectedEnrolleeInfo(null);
    fetchNextSiNo();
  };

  const filteredCollections = useMemo(() => {
    if (!collectionsData) return [];
    if (!searchQuery) return collectionsData;
    const q = searchQuery.toLowerCase();
    return collectionsData.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.siNo.toLowerCase().includes(q) ||
        c.collectionCategory.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [collectionsData, searchQuery]);

  const groupedData = useMemo<GroupedCollections[]>(() => {
    const groups: Record<string, Collection[]> = {};
    filteredCollections.forEach((c) => {
      if (!groups[c.date]) groups[c.date] = [];
      groups[c.date].push(c);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => {
          const siComp = b.siNo.localeCompare(a.siNo);
          return siComp;
        }),
        total: items.reduce((sum, i) => sum + parseFloat(String(i.amount) || "0"), 0),
      }));
  }, [filteredCollections]);

  const grandTotal = useMemo(() => {
    return filteredCollections.reduce((sum, c) => sum + parseFloat(String(c.amount) || "0"), 0);
  }, [filteredCollections]);

  const toggleCollapse = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleSaveEntry = () => {
    if (!entryForm.name || !entryForm.collectionCategory || !entryForm.amount || !entryForm.date) {
      toast({ title: "Please fill in required fields (Date, Name, Category, Amount)", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      schoolYear: selectedSY,
      date: entryForm.date,
      siNo: entryForm.siNo,
      name: entryForm.name,
      enrolleeId: entryForm.enrolleeId,
      collectionCategory: entryForm.collectionCategory,
      description: entryForm.description || null,
      amount: entryForm.amount,
    });
  };

  const openEditDialog = (item: Collection) => {
    setEditingCollection(item);
    setEditForm({
      date: item.date,
      name: item.name,
      siNo: item.siNo,
      collectionCategory: item.collectionCategory,
      description: item.description || "",
      amount: String(item.amount),
      enrolleeId: item.enrolleeId,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingCollection) return;
    if (!editForm.name || !editForm.collectionCategory || !editForm.amount || !editForm.date) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingCollection.id,
      data: {
        date: editForm.date,
        siNo: editForm.siNo,
        name: editForm.name,
        enrolleeId: editForm.enrolleeId,
        collectionCategory: editForm.collectionCategory,
        description: editForm.description || null,
        amount: editForm.amount,
      },
    });
  };

  const handlePrintSummary = () => {
    if (!user) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let y = addPdfHeader(doc, user);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Collection Summary", pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`School Year: ${selectedSY}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Period: ${formatDateDisplay(dateFrom)} - ${formatDateDisplay(dateTo)}`, pageWidth / 2, y, { align: "center" });
    y += 5;

    const tableData: any[] = [];
    groupedData.forEach((group) => {
      group.items.forEach((item) => {
        tableData.push([
          formatDateDisplay(item.date),
          item.siNo,
          item.name,
          item.collectionCategory,
          item.description || "",
          formatCurrency(item.amount),
        ]);
      });
    });

    autoTable(doc, {
      startY: y,
      head: [["Date", "S.I. No.", "Name", "Category", "Description", "Amount"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        5: { halign: "right" },
      },
      foot: [["", "", "", "", "Grand Total:", `₱ ${formatCurrency(grandTotal)}`]],
      footStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    doc.save(`Collection_Summary_${selectedSY}_${dateFrom}_${dateTo}.pdf`);
    toast({ title: "Collection Summary PDF downloaded" });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">Collection</h1>
          <p className="text-muted-foreground text-sm">Finance & Billing</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="space-y-0">
            <Select value={selectedSY} onValueChange={setSelectedSY}>
              <SelectTrigger className="w-[150px]" data-testid="select-school-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schoolYears.map((sy) => (
                  <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {viewMode === "form" ? (
            <Button variant="outline" onClick={() => setViewMode("history")} data-testid="button-view-history">
              <History className="w-4 h-4 mr-2" />
              Collection History
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setViewMode("form")} data-testid="button-view-form">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Collection Entry
            </Button>
          )}
          <Button onClick={handlePrintSummary} variant="outline" data-testid="button-print-summary">
            <Printer className="w-4 h-4 mr-2" />
            Print Summary
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
              <FileText className="w-5 h-5 text-emerald-400" />
              Collection Entry Form
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={entryForm.date}
                  onChange={(e) => setEntryForm((p) => ({ ...p, date: e.target.value }))}
                  data-testid="input-entry-date"
                />
              </div>
              <div className="space-y-2">
                <Label>S.I. No.</Label>
                <Input
                  value={entryForm.siNo}
                  onChange={(e) => setEntryForm((p) => ({ ...p, siNo: e.target.value }))}
                  data-testid="input-entry-sino"
                />
              </div>
              <div className="space-y-2">
                <Label>Collection Category *</Label>
                <Select
                  value={entryForm.collectionCategory || "_none_"}
                  onValueChange={(v) => setEntryForm((p) => ({ ...p, collectionCategory: v === "_none_" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-entry-category">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">Select category...</SelectItem>
                    {COLLECTION_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label>Name *</Label>
              <Input
                value={nameSearch || entryForm.name}
                onChange={(e) => {
                  setNameSearch(e.target.value);
                  setEntryForm((p) => ({ ...p, name: e.target.value, enrolleeId: null }));
                  setSelectedEnrolleeInfo(null);
                  setShowNameDropdown(true);
                }}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                placeholder="Search enrollee name..."
                data-testid="input-entry-name"
              />
              {showNameDropdown && filteredNames.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {filteredNames.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleNameSelect(n)}
                      data-testid={`option-name-${n.id}`}
                    >
                      {n.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedEnrolleeInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-secondary/30 border border-border" data-testid="section-enrollee-info">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Educational Level</p>
                  <p className="text-sm font-medium" data-testid="text-enrollee-level">{selectedEnrolleeInfo.level}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ID No.</p>
                  <p className="text-sm font-medium" data-testid="text-enrollee-idno">{selectedEnrolleeInfo.idNo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Outstanding Account Balance</p>
                  <p className={`text-sm font-bold ${selectedEnrolleeInfo.outstandingBalance > 0 ? "text-red-400" : "text-emerald-400"}`} data-testid="text-enrollee-balance">
                    ₱ {formatCurrency(selectedEnrolleeInfo.outstandingBalance)}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={entryForm.description}
                onChange={(e) => setEntryForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Enter description..."
                rows={2}
                data-testid="input-entry-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount (₱) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={entryForm.amount}
                onChange={(e) => setEntryForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-entry-amount"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSaveEntry}
                disabled={createMutation.isPending || syLocked}
                className="bg-emerald-600 text-white"
                data-testid="button-save-entry"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Plus className="w-4 h-4 mr-2" />
                Save Entry
              </Button>
              <Button variant="outline" onClick={resetEntryForm} data-testid="button-reset-form">
                Clear Form
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[160px]"
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[160px]"
                    data-testid="input-date-to"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Name, S.I. No., Category, Description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : groupedData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No collection entries found</p>
                  <p className="text-sm">Switch to Collection Entry to add a new transaction</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>S.I. No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedData.map((group) => {
                      const isCollapsed = collapsedDates.has(group.date);
                      return (
                        <CollectionDateGroup
                          key={group.date}
                          group={group}
                          isCollapsed={isCollapsed}
                          onToggle={() => toggleCollapse(group.date)}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onEdit={(item) => openEditDialog(item)}
                          syLocked={syLocked}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span className="text-lg font-semibold text-white">Grand Total</span>
              </div>
              <span className="text-2xl font-bold text-emerald-400" data-testid="text-grand-total">
                ₱ {formatCurrency(grandTotal)}
              </span>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditingCollection(null); } }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Edit Collection Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                  data-testid="input-edit-date"
                />
              </div>
              <div className="space-y-2">
                <Label>S.I. No.</Label>
                <Input
                  value={editForm.siNo}
                  onChange={(e) => setEditForm((p) => ({ ...p, siNo: e.target.value }))}
                  data-testid="input-edit-sino"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                data-testid="input-edit-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Collection Category *</Label>
              <Select
                value={editForm.collectionCategory || "_none_"}
                onValueChange={(v) => setEditForm((p) => ({ ...p, collectionCategory: v === "_none_" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Select category...</SelectItem>
                  {COLLECTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Enter description..."
                rows={2}
                data-testid="input-edit-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount (₱) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.amount}
                onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-edit-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingCollection(null); }} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending || syLocked}
              className="bg-emerald-600 text-white"
              data-testid="button-save-edit"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollectionDateGroup({
  group,
  isCollapsed,
  onToggle,
  onDelete,
  onEdit,
  syLocked,
}: {
  group: GroupedCollections;
  isCollapsed: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
  onEdit: (item: Collection) => void;
  syLocked: boolean;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover-elevate"
        onClick={onToggle}
        data-testid={`row-date-group-${group.date}`}
      >
        <TableCell>
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium text-white">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            {formatDateDisplay(group.date)}
          </div>
        </TableCell>
        <TableCell colSpan={4}>
          <Badge variant="secondary" className="text-xs">
            {group.items.length} transaction{group.items.length !== 1 ? "s" : ""}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-semibold text-emerald-400">
          ₱ {formatCurrency(group.total)}
        </TableCell>
        <TableCell></TableCell>
      </TableRow>

      {!isCollapsed &&
        group.items.map((item) => (
          <TableRow key={item.id} className="bg-secondary/10" data-testid={`row-collection-${item.id}`}>
            <TableCell></TableCell>
            <TableCell className="text-muted-foreground text-sm">{formatDateDisplay(item.date)}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs font-mono">{item.siNo}</Badge>
            </TableCell>
            <TableCell className="text-sm">{item.name}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">{item.collectionCategory}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
              {item.description || "-"}
            </TableCell>
            <TableCell className="text-right font-medium">
              ₱ {formatCurrency(item.amount)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={syLocked}
                  onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                  data-testid={`button-edit-${item.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  disabled={syLocked}
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                  data-testid={`button-delete-${item.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
