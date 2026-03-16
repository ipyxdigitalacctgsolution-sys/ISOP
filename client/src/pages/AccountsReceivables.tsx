import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import type { EducationalLevel, SchoolFee, Enrollee, MiscFeeItem, Collection } from "@shared/schema";
import { HIGHER_ED_LEVELS, BASIC_ED_LEVELS } from "@shared/schema";
import { generateSchoolYears, getCurrentSchoolYear, isSchoolYearLocked } from "@/lib/educational-levels-data";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { addPdfHeader, getImgFormat } from "@/lib/pdf-header";
import autoTable from "jspdf-autotable";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  FileText,
  Mail,
  Filter,
  X,
  Lock,
  Printer,
  SendHorizonal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type LevelWithCount = {
  level: EducationalLevel;
  studentCount: number;
};

type PaymentSummaryItem = {
  enrolleeId: number;
  totalPaid: string;
};

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

function getLevelDisplayName(level: EducationalLevel): string {
  const child = level.childLevelOther || level.childLevel;
  return `${level.parentLevel} - ${child}`;
}

export default function AccountsReceivablesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const schoolYears = generateSchoolYears();
  const [selectedSY, setSelectedSY] = useState(getCurrentSchoolYear(user?.fiscalPeriod));
  const syLocked = isSchoolYearLocked(selectedSY, user?.fiscalPeriod);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevelFilters, setSelectedLevelFilters] = useState<number[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [soaEnrollee, setSoaEnrollee] = useState<Enrollee | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<{ sent: number; failed: number; skipped: number }>({ sent: 0, failed: 0, skipped: 0 });
  const bulkCancelRef = useRef(false);
  const [emailDialogEnrollee, setEmailDialogEnrollee] = useState<Enrollee | null>(null);
  const [emailList, setEmailList] = useState<string[]>([]);

  const openEmailDialog = useCallback((enrollee: Enrollee) => {
    setEmailDialogEnrollee(enrollee);
    const existing = (enrollee.studentEmail || "").split(",").map(e => e.trim()).filter(Boolean);
    setEmailList(existing.length > 0 ? existing : [""]);
  }, []);

  const handleAddEmailRow = useCallback(() => {
    setEmailList(prev => [...prev, ""]);
  }, []);

  const handleRemoveEmailRow = useCallback((index: number) => {
    setEmailList(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleEmailRowChange = useCallback((index: number, value: string) => {
    setEmailList(prev => prev.map((e, i) => i === index ? value : e));
  }, []);

  const levelsQuery = useQuery<LevelWithCount[]>({
    queryKey: [api.academic.listLevels.path, { schoolYear: selectedSY }],
    queryFn: async () => {
      const res = await fetch(`${api.academic.listLevels.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const enrolleesQuery = useQuery<Enrollee[]>({
    queryKey: [api.enrollees.list.path, { schoolYear: selectedSY }],
    queryFn: async () => {
      const res = await fetch(`${api.enrollees.list.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const feesQuery = useQuery<SchoolFee[]>({
    queryKey: [api.fees.listFees.path, { schoolYear: selectedSY }],
    queryFn: async () => {
      const res = await fetch(`${api.fees.listFees.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const paymentSummaryQuery = useQuery<PaymentSummaryItem[]>({
    queryKey: [api.collections.paymentSummary.path, { schoolYear: selectedSY }],
    queryFn: async () => {
      const res = await fetch(`${api.collections.paymentSummary.path}?schoolYear=${selectedSY}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const levelsById = useMemo(() => {
    const map: Record<number, EducationalLevel> = {};
    (levelsQuery.data || []).forEach(({ level }) => { map[level.id] = level; });
    return map;
  }, [levelsQuery.data]);

  const feesByLevelId = useMemo(() => {
    const map: Record<number, SchoolFee> = {};
    (feesQuery.data || []).forEach(f => { map[f.educationalLevelId] = f; });
    return map;
  }, [feesQuery.data]);

  const paidByEnrollee = useMemo(() => {
    const map: Record<number, number> = {};
    (paymentSummaryQuery.data || []).forEach(p => { map[p.enrolleeId] = parseFloat(p.totalPaid) || 0; });
    return map;
  }, [paymentSummaryQuery.data]);

  const computeTotalApplicable = useCallback((enrollee: Enrollee): number => {
    const fee = feesByLevelId[enrollee.educationalLevelId];
    const schoolFees = fee ? parseFloat(fee.totalSchoolFees || "0") : 0;
    const back = parseFloat(String(enrollee.backAccounts) || "0") || 0;
    const other = (enrollee.otherFees as MiscFeeItem[] || []).reduce((s, i) => s + i.amount, 0);
    const disc = (enrollee.discounts as MiscFeeItem[] || []).reduce((s, i) => s + i.amount, 0);
    const schol = (enrollee.scholarships as MiscFeeItem[] || []).reduce((s, i) => s + i.amount, 0);
    return schoolFees + back + other - disc - schol;
  }, [feesByLevelId]);

  const emailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: number; email: string }) => {
      const res = await apiRequest("PATCH", buildUrl(api.enrollees.update.path, { id }), { studentEmail: email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path] });
      toast({ title: "Email addresses saved" });
      setEmailDialogEnrollee(null);
    },
    onError: (err: any) => {
      toast({ title: "Error updating email", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveEmails = useCallback(() => {
    if (!emailDialogEnrollee) return;
    const validEmails = emailList.map(e => e.trim()).filter(Boolean);
    const combined = validEmails.join(", ");
    emailMutation.mutate({ id: emailDialogEnrollee.id, email: combined });
  }, [emailDialogEnrollee, emailList, emailMutation]);

  const registeredLevelOptions = useMemo(() => {
    return (levelsQuery.data || []).map(({ level }) => ({
      id: level.id,
      name: getLevelDisplayName(level),
      parentLevel: level.parentLevel,
      childLevel: level.childLevelOther || level.childLevel,
    }));
  }, [levelsQuery.data]);

  const sortedFilteredEnrollees = useMemo(() => {
    let list = enrolleesQuery.data || [];

    if (selectedLevelFilters.length > 0) {
      list = list.filter(e => selectedLevelFilters.includes(e.educationalLevelId));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(e =>
        `${e.lastName}, ${e.firstName} ${e.middleName || ""}`.toLowerCase().includes(term)
      );
    }

    const levelOrder = [...BASIC_ED_LEVELS, ...HIGHER_ED_LEVELS];

    return [...list].sort((a, b) => {
      const la = levelsById[a.educationalLevelId];
      const lb = levelsById[b.educationalLevelId];
      if (!la || !lb) return 0;

      const parentIdxA = levelOrder.indexOf(la.parentLevel);
      const parentIdxB = levelOrder.indexOf(lb.parentLevel);
      if (parentIdxA !== parentIdxB) return parentIdxA - parentIdxB;

      const catA = (a.enrollmentStatus || "").localeCompare(b.enrollmentStatus || "");
      if (catA !== 0) return catA;

      const childA = (la.childLevelOther || la.childLevel || "");
      const childB = (lb.childLevelOther || lb.childLevel || "");
      const childCmp = childA.localeCompare(childB);
      if (childCmp !== 0) return childCmp;

      const secA = (a.section || "").localeCompare(b.section || "");
      if (secA !== 0) return secA;

      const nameA = `${a.lastName}, ${a.firstName}`;
      const nameB = `${b.lastName}, ${b.firstName}`;
      return nameA.localeCompare(nameB);
    });
  }, [enrolleesQuery.data, selectedLevelFilters, searchTerm, levelsById]);

  const grandTotalOutstanding = useMemo(() => {
    return sortedFilteredEnrollees.reduce((sum, e) => {
      const totalApplicable = computeTotalApplicable(e);
      const paid = paidByEnrollee[e.id] || 0;
      return sum + (totalApplicable - paid);
    }, 0);
  }, [sortedFilteredEnrollees, computeTotalApplicable, paidByEnrollee]);

  const toggleLevelFilter = (id: number) => {
    setSelectedLevelFilters(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const { data: soaPaymentHistory } = useQuery<Collection[]>({
    queryKey: [api.collections.byEnrollee.path, soaEnrollee?.id],
    queryFn: async () => {
      if (!soaEnrollee) return [];
      const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: soaEnrollee.id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!soaEnrollee,
  });

  const handlePreviewSOA = (enrollee: Enrollee) => {
    setSoaEnrollee(enrollee);
  };

  const generateSOAPdf = useCallback((enrollee: Enrollee, payments: Collection[]): jsPDF => {
    if (!user) throw new Error("Not authenticated");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const level = levelsById[enrollee.educationalLevelId];
    const studentName = `${enrollee.lastName}, ${enrollee.firstName} ${enrollee.middleName || ""}`.trim();

    let y = addPdfHeader(doc, user);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 62, 80);
    doc.text("STATEMENT OF ACCOUNT", pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 8;

    const photoSize = 38;
    const photoX = pageWidth - margin - photoSize;
    const photoY = y;

    if (enrollee.photoUrl) {
      try {
        const fmt = getImgFormat(enrollee.photoUrl);
        doc.addImage(enrollee.photoUrl, fmt, photoX, photoY, photoSize, photoSize);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(photoX, photoY, photoSize, photoSize);
      } catch {}
    }

    const infoLeftCol = margin;
    doc.setFontSize(9);

    doc.setFont("helvetica", "bold");
    doc.text("Student:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(studentName, infoLeftCol + 20, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("ID No:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(enrollee.idNo || "N/A", infoLeftCol + 16, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Level:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(level ? getLevelDisplayName(level) : "N/A", infoLeftCol + 16, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.text("School Year:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(selectedSY, infoLeftCol + 28, y);
    y += 5;

    if (enrollee.section) {
      doc.setFont("helvetica", "bold");
      doc.text("Section:", infoLeftCol, y);
      doc.setFont("helvetica", "normal");
      doc.text(enrollee.section, infoLeftCol + 20, y);
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.text("Date:", infoLeftCol, y);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), infoLeftCol + 14, y);

    y = Math.max(y + 8, photoY + photoSize + 4);

    const accountFee = feesByLevelId[enrollee.educationalLevelId] || null;
    const accBackAccounts = String(enrollee.backAccounts || "0");
    const accOtherFees = (enrollee.otherFees as MiscFeeItem[]) || [];
    const accDiscounts = (enrollee.discounts as MiscFeeItem[]) || [];
    const accScholarships = (enrollee.scholarships as MiscFeeItem[]) || [];

    const rowPad = { top: 1, bottom: 1, left: 3, right: 3 };
    const headPad = { top: 1.5, bottom: 1.5, left: 3, right: 3 };
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

    const accTotalSchoolFees = accountFee ? parseFloat(accountFee.totalSchoolFees || "0") : 0;
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

    const accGrandTotal = computeTotalApplicable(enrollee);

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

    const totalAmountPaid = payments.reduce((s, c) => s + parseFloat(String(c.amount) || "0"), 0);

    if (payments.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(44, 62, 80);
      doc.text("Payment History", margin, y);
      doc.setTextColor(0);
      y += 3;

      const payBody = payments.map((p) => [
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

    const outstandingBalance = accGrandTotal - totalAmountPaid;
    const balColor: [number, number, number] = outstandingBalance > 0 ? [220, 38, 38] : [16, 185, 129];

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
    doc.setTextColor(...balColor);
    doc.text("Outstanding Balance", margin + 3, y + 1);
    doc.text(fmtAcct(Math.abs(outstandingBalance)), pageWidth - margin - 3, y + 1, { align: "right" });
    doc.setTextColor(0);
    y += 6;

    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 10;
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "normal");
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    doc.text("Generated by IPYX Digital Accounting Solution", pageWidth / 2, footerY, { align: "center" });
    doc.text(timestamp, pageWidth / 2, footerY + 3, { align: "center" });

    return doc;
  }, [user, levelsById, feesByLevelId, selectedSY, computeTotalApplicable]);

  const handleGenerateSOA = useCallback(() => {
    if (!user || !soaEnrollee) return;
    const payments = soaPaymentHistory || [];
    const doc = generateSOAPdf(soaEnrollee, payments);
    doc.save(`SOA_${soaEnrollee.lastName}_${soaEnrollee.firstName}_${selectedSY}.pdf`);
    toast({ title: "Statement of Account downloaded" });
    setSoaEnrollee(null);
  }, [user, soaEnrollee, soaPaymentHistory, selectedSY, toast, generateSOAPdf]);

  const handlePrintRow = useCallback(async (enrollee: Enrollee) => {
    try {
      const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: enrollee.id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      const payments: Collection[] = await res.json();
      const doc = generateSOAPdf(enrollee, payments);
      doc.save(`SOA_${enrollee.lastName}_${enrollee.firstName}_${selectedSY}.pdf`);
      toast({ title: "SOA PDF downloaded" });
    } catch (err: any) {
      toast({ title: "Error generating SOA", description: err.message, variant: "destructive" });
    }
  }, [generateSOAPdf, selectedSY, toast]);

  const handleSendEmail = useCallback(async (enrollee: Enrollee) => {
    const rawEmail = enrollee.studentEmail;
    if (!rawEmail) {
      toast({ title: "No email address", description: "Please add an email address for this student first.", variant: "destructive" });
      return;
    }
    const email = rawEmail.split(",")[0].trim();
    try {
      const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: enrollee.id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      const payments: Collection[] = await res.json();
      const doc = generateSOAPdf(enrollee, payments);
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const studentName = `${enrollee.lastName}, ${enrollee.firstName} ${enrollee.middleName || ""}`.trim();

      const sendRes = await apiRequest("POST", api.soa.sendEmail.path, {
        enrolleeId: enrollee.id,
        email,
        pdfBase64,
        studentName,
        schoolYear: selectedSY,
      });
      const result = await sendRes.json();
      if (result.success) {
        toast({ title: "SOA Sent Successfully", description: `Email delivered to ${email}` });
        queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.collections.paymentSummary.path] });
      } else {
        toast({ title: "Failed to send SOA", description: result.message || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed to send SOA", description: err.message, variant: "destructive" });
    }
  }, [generateSOAPdf, selectedSY, toast, queryClient]);

  const handleBulkSend = useCallback(async () => {
    const studentsWithEmail = sortedFilteredEnrollees.filter(e => e.studentEmail);
    if (studentsWithEmail.length === 0) {
      toast({ title: "No emails found", description: "No students have email addresses set.", variant: "destructive" });
      return;
    }

    setBulkSending(true);
    setBulkProgress(0);
    setBulkTotal(studentsWithEmail.length);
    setBulkResults({ sent: 0, failed: 0, skipped: 0 });
    bulkCancelRef.current = false;

    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < studentsWithEmail.length; i++) {
      if (bulkCancelRef.current) break;
      const enrollee = studentsWithEmail[i];
      try {
        const url = buildUrl(api.collections.byEnrollee.path, { enrolleeId: enrollee.id });
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) { failed++; continue; }
        const payments: Collection[] = await res.json();
        const doc = generateSOAPdf(enrollee, payments);
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const studentName = `${enrollee.lastName}, ${enrollee.firstName} ${enrollee.middleName || ""}`.trim();

        const sendRes = await apiRequest("POST", api.soa.sendEmail.path, {
          enrolleeId: enrollee.id,
          email: (enrollee.studentEmail || "").split(",")[0].trim(),
          pdfBase64,
          studentName,
          schoolYear: selectedSY,
        });
        const result = await sendRes.json();
        if (result.success) { sent++; } else { failed++; }
      } catch {
        failed++;
      }
      setBulkProgress(i + 1);
      setBulkResults({ sent, failed, skipped });
    }

    setBulkResults({ sent, failed, skipped });
    setBulkSending(false);
    queryClient.invalidateQueries({ queryKey: [api.enrollees.list.path] });
    queryClient.invalidateQueries({ queryKey: [api.collections.paymentSummary.path] });

    toast({
      title: "Bulk SOA sending complete",
      description: `Sent: ${sent}, Failed: ${failed}, Skipped: ${skipped}`,
    });
  }, [sortedFilteredEnrollees, generateSOAPdf, selectedSY, toast, queryClient]);

  const isLoading = levelsQuery.isLoading || enrolleesQuery.isLoading || feesQuery.isLoading || paymentSummaryQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Accounts Receivables</h1>
          <p className="text-muted-foreground">Outstanding student account balances</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={handleBulkSend}
            disabled={bulkSending || syLocked}
            data-testid="button-bulk-send-soa"
          >
            <SendHorizonal className="w-4 h-4 mr-2" />
            Send All Monthly SOAs
          </Button>
          <Select value={selectedSY} onValueChange={setSelectedSY}>
            <SelectTrigger className="w-44" data-testid="select-school-year">
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

      {bulkSending && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Sending SOA emails... ({bulkProgress}/{bulkTotal})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { bulkCancelRef.current = true; }}
                data-testid="button-cancel-bulk-send"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
            <Progress value={(bulkProgress / bulkTotal) * 100} className="h-2" />
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Sent: {bulkResults.sent}</span>
              <span>Failed: {bulkResults.failed}</span>
              <span>Skipped: {bulkResults.skipped}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search student name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-student"
              />
            </div>

            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                data-testid="button-filter-levels"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter Levels
                {selectedLevelFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{selectedLevelFilters.length}</Badge>
                )}
              </Button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-card border border-border rounded-md shadow-lg p-3 space-y-1 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Educational Levels</span>
                    {selectedLevelFilters.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLevelFilters([])} data-testid="button-clear-filters">
                        <X className="w-3 h-3 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                  {registeredLevelOptions.map(opt => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover-elevate cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedLevelFilters.includes(opt.id)}
                        onChange={() => toggleLevelFilter(opt.id)}
                        className="rounded border-border"
                      />
                      {opt.name}
                    </label>
                  ))}
                  {registeredLevelOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No levels registered for this school year.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]" data-testid="th-student-name">Name of Students</TableHead>
                  <TableHead data-testid="th-level">Level</TableHead>
                  <TableHead data-testid="th-category">Category</TableHead>
                  <TableHead data-testid="th-year-level">Year Level</TableHead>
                  <TableHead data-testid="th-section">Section</TableHead>
                  <TableHead className="text-right" data-testid="th-total-fees">Total Fees</TableHead>
                  <TableHead className="text-right" data-testid="th-paid">Paid</TableHead>
                  <TableHead className="text-right" data-testid="th-balance">Balance</TableHead>
                  <TableHead className="w-[200px]" data-testid="th-email">Email Address</TableHead>
                  <TableHead data-testid="th-last-sent">Last Sent</TableHead>
                  <TableHead className="w-[120px] text-center" data-testid="th-actions">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredEnrollees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No students found for the selected criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedFilteredEnrollees.map(enrollee => {
                    const level = levelsById[enrollee.educationalLevelId];
                    const totalApplicable = computeTotalApplicable(enrollee);
                    const paid = paidByEnrollee[enrollee.id] || 0;
                    const balance = totalApplicable - paid;
                    const studentName = `${enrollee.lastName}, ${enrollee.firstName} ${enrollee.middleName || ""}`.trim();
                    const levelName = level ? getLevelDisplayName(level) : "N/A";
                    const yearLevel = enrollee.yearLevel || (level ? (level.childLevelOther || level.childLevel) : "-");
                    const lastSent = enrollee.lastSoaSentDate
                      ? new Date(enrollee.lastSoaSentDate).toLocaleDateString()
                      : "-";

                    return (
                      <TableRow key={enrollee.id} data-testid={`row-student-${enrollee.id}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${enrollee.id}`}>{studentName}</TableCell>
                        <TableCell data-testid={`text-level-${enrollee.id}`}>{levelName}</TableCell>
                        <TableCell data-testid={`text-category-${enrollee.id}`}>
                          <Badge variant="outline">{enrollee.enrollmentStatus || "New"}</Badge>
                        </TableCell>
                        <TableCell data-testid={`text-yearlevel-${enrollee.id}`}>{yearLevel}</TableCell>
                        <TableCell data-testid={`text-section-${enrollee.id}`}>{enrollee.section || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums" data-testid={`text-fees-${enrollee.id}`}>
                          {formatCurrency(totalApplicable)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-500" data-testid={`text-paid-${enrollee.id}`}>
                          {formatCurrency(paid)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums" data-testid={`text-balance-${enrollee.id}`}>
                          <span className={balance > 0 ? "text-red-500" : "text-emerald-500"}>
                            {formatCurrency(balance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {enrollee.studentEmail ? (
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={enrollee.studentEmail}>
                                {enrollee.studentEmail.split(",")[0].trim()}
                                {enrollee.studentEmail.includes(",") && (
                                  <span className="text-muted-foreground/60"> +{enrollee.studentEmail.split(",").length - 1}</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">No email</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEmailDialog(enrollee)}
                              disabled={syLocked}
                              title={enrollee.studentEmail ? "Edit email addresses" : "Add email address"}
                              data-testid={`button-edit-email-${enrollee.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-last-sent-${enrollee.id}`}>
                          {lastSent}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintRow(enrollee)}
                              title="Download SOA PDF"
                              data-testid={`button-print-${enrollee.id}`}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSendEmail(enrollee)}
                              title="Send SOA via Email"
                              disabled={!enrollee.studentEmail || syLocked}
                              data-testid={`button-send-email-${enrollee.id}`}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreviewSOA(enrollee)}
                              title="Preview SOA"
                              data-testid={`button-soa-${enrollee.id}`}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground" data-testid="text-student-count">
              Showing {sortedFilteredEnrollees.length} student{sortedFilteredEnrollees.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Grand Total Outstanding:</span>
              <span className="text-lg font-bold text-primary" data-testid="text-grand-total">
                {formatCurrency(grandTotalOutstanding)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!emailDialogEnrollee} onOpenChange={open => { if (!open) setEmailDialogEnrollee(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Addresses</DialogTitle>
            <DialogDescription>
              {emailDialogEnrollee && `Manage email addresses for ${emailDialogEnrollee.lastName}, ${emailDialogEnrollee.firstName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {emailList.map((email, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="sr-only">Email {idx + 1}</Label>
                  <Input
                    type="email"
                    placeholder={idx === 0 ? "Primary email address" : "Additional email address"}
                    value={email}
                    onChange={e => handleEmailRowChange(idx, e.target.value)}
                    data-testid={`input-dialog-email-${idx}`}
                  />
                </div>
                {emailList.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEmailRow(idx)}
                    data-testid={`button-remove-email-${idx}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddEmailRow}
              data-testid="button-add-email-row"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add another email
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogEnrollee(null)} data-testid="button-cancel-email">
              Cancel
            </Button>
            <Button onClick={handleSaveEmails} disabled={emailMutation.isPending} data-testid="button-save-emails">
              {emailMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Save Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!soaEnrollee} onOpenChange={open => { if (!open) setSoaEnrollee(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Statement of Account
            </DialogTitle>
          </DialogHeader>
          {soaEnrollee && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Student:</span> {soaEnrollee.lastName}, {soaEnrollee.firstName} {soaEnrollee.middleName || ""}</p>
                <p><span className="font-semibold">Level:</span> {levelsById[soaEnrollee.educationalLevelId] ? getLevelDisplayName(levelsById[soaEnrollee.educationalLevelId]) : "N/A"}</p>
                <p><span className="font-semibold">Section:</span> {soaEnrollee.section || "N/A"}</p>
                <p><span className="font-semibold">School Year:</span> {selectedSY}</p>
              </div>

              {(() => {
                const totalApplicable = computeTotalApplicable(soaEnrollee);
                const paid = (soaPaymentHistory || []).reduce((s, c) => s + parseFloat(String(c.amount) || "0"), 0);
                const outstanding = totalApplicable - paid;
                return (
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex justify-between text-sm">
                      <span>Total Applicable Fees:</span>
                      <span className="font-semibold">{formatCurrency(totalApplicable)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Paid:</span>
                      <span className="font-semibold text-emerald-500">{formatCurrency(paid)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold border-t border-border pt-2">
                      <span>Outstanding Balance:</span>
                      <span className={outstanding > 0 ? "text-red-500" : "text-emerald-500"}>
                        {formatCurrency(Math.abs(outstanding))}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <Button className="w-full" onClick={handleGenerateSOA} data-testid="button-download-soa">
                <FileText className="w-4 h-4 mr-2" />
                Download SOA PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
