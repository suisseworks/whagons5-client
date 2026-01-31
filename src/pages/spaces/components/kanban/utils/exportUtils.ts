import type { Task, Status } from '@/store/types';
import * as XLSX from 'xlsx';

export function exportToExcel(
  tasks: Task[],
  statuses: Status[],
  filename: string
) {
  // Prepare data for Excel
  const data = tasks.map((task) => {
    const status = statuses.find((s) => s.id === task.status_id);
    
    return {
      ID: task.id,
      Name: task.name,
      Description: task.description || '',
      Status: status?.name || '',
      'Due Date': task.due_date || '',
      'Start Date': task.start_date || '',
      'Created At': task.created_at,
      'Updated At': task.updated_at,
    };
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

  // Save file
  XLSX.writeFile(wb, filename);
}

export async function exportToPNG(element: HTMLElement, filename: string) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Failed to export to PNG:', error);
    throw error;
  }
}

export async function exportToPDF(element: HTMLElement, filename: string) {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to export to PDF:', error);
    throw error;
  }
}
