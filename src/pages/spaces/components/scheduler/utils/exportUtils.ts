import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import type { SchedulerEvent, SchedulerResource } from "../types/scheduler";

export async function exportToPDF(
  element: HTMLElement,
  filename: string = "scheduler.pdf"
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("landscape", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const imgScaledWidth = imgWidth * ratio;
  const imgScaledHeight = imgHeight * ratio;
  const xOffset = (pdfWidth - imgScaledWidth) / 2;
  const yOffset = (pdfHeight - imgScaledHeight) / 2;

  pdf.addImage(imgData, "PNG", xOffset, yOffset, imgScaledWidth, imgScaledHeight);
  pdf.save(filename);
}

export async function exportToPNG(
  element: HTMLElement,
  filename: string = "scheduler.png"
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export function exportToExcel(
  events: SchedulerEvent[],
  resources: SchedulerResource[],
  filename: string = "scheduler.xlsx"
): void {
  // Create resource map for lookup
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  // Transform events to Excel rows
  const rows = events.map((event) => {
    const resource = resourceMap.get(event.resourceId);
    return {
      "Task Name": event.name,
      "Resource": resource?.name || `User ${event.resourceId}`,
      "Team": resource?.teamName || "",
      "Start Date": event.startDate.toLocaleString(),
      "End Date": event.endDate.toLocaleString(),
      "Duration (hours)": (
        (event.endDate.getTime() - event.startDate.getTime()) /
        (1000 * 60 * 60)
      ).toFixed(2),
    };
  });

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");

  // Auto-size columns
  const maxWidth = 50;
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(
      Math.max(
        key.length,
        ...rows.map((row) => String(row[key as keyof typeof row]).length)
      ),
      maxWidth
    ),
  }));
  worksheet["!cols"] = colWidths;

  // Save file
  XLSX.writeFile(workbook, filename);
}
