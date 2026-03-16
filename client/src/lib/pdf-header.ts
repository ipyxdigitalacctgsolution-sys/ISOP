import jsPDF from "jspdf";
import type { User } from "@shared/schema";

export function getImgFormat(url: string): string {
  if (url.startsWith("data:image/png")) return "PNG";
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return "JPEG";
  return url.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
}

export interface PdfHeaderOptions {
  orientation?: "portrait" | "landscape";
  margin?: number;
}

export function addPdfHeader(
  doc: jsPDF,
  user: User,
  options: PdfHeaderOptions = {}
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = options.margin ?? 14;
  const logoSize = 22;
  const headerY = 10;

  if (user.logoUrl) {
    try {
      doc.addImage(user.logoUrl, getImgFormat(user.logoUrl), margin, headerY, logoSize, logoSize);
    } catch {}
  }

  const hasLogo = !!user.logoUrl;
  const textLeftX = hasLogo ? margin + logoSize + 5 : margin;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(user.schoolName || "School Name", textLeftX, headerY + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  let lineY = headerY + 10;

  if (user.address) {
    doc.text(user.address, textLeftX, lineY);
    lineY += 4;
  }

  const regItems: string[] = [];
  if (user.secRegNo) regItems.push(`SEC Reg. No.: ${user.secRegNo}`);
  if (user.tin) regItems.push(`TIN: ${user.tin}`);
  if (regItems.length) {
    doc.text(regItems.join("  |  "), textLeftX, lineY);
    lineY += 4;
  }

  const contactItems: string[] = [];
  if (user.email) contactItems.push(`Email: ${user.email}`);
  if (user.website) contactItems.push(user.website);
  if (user.contactNo) contactItems.push(`Tel: ${user.contactNo}`);
  if (contactItems.length) {
    doc.text(contactItems.join("  |  "), textLeftX, lineY);
    lineY += 4;
  }

  const headerBottom = Math.max(lineY, headerY + logoSize + 2);

  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.7);
  doc.line(margin, headerBottom, pageWidth - margin, headerBottom);

  return headerBottom + 6;
}
