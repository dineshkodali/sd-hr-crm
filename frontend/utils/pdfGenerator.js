/**
 * PDF Generator Utility
 * Generates PDF from table data using jsPDF
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Format date for PDF display
 */
function formatDateForPDF(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

/**
 * Generate PDF from table data
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Column definitions [{ header: 'Name', key: 'name' }]
 * @param {String} title - PDF document title
 * @param {String} filename - Output filename (without .pdf extension)
 */
export function generatePDF(data, columns, title, filename = 'download') {
  try {
    
    if (!data || !Array.isArray(data)) {
      console.error('Invalid data provided to generatePDF:', data);
      alert('No data available to export');
      return;
    }
    
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      console.error('Invalid columns provided to generatePDF:', columns);
      alert('Invalid PDF configuration');
      return;
    }
    
    const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(title, 14, 20);
  
  // Add generation date
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  
  // Prepare table data
  const tableColumn = columns.map(col => col.header);
  const tableRows = data.map(item => {
    return columns.map(col => {
      const value = item[col.key];
      // Handle date formatting
      if (col.key.includes('date') || col.key.includes('Date')) {
        return formatDateForPDF(value);
      }
      // Handle null/undefined
      if (value === null || value === undefined) return 'N/A';
      // Convert to string
      return String(value);
    });
  });
  
  // Add table
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [45, 212, 191], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { top: 35 },
  });
  
  // Add footer with page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save the PDF
  doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Check console for details.');
  }
}
