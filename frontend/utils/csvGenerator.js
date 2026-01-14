/**
 * CSV Generator Utility
 * Generates CSV from table data
 */

/**
 * Format date for CSV display
 */
function formatDateForCSV(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field) {
  if (field === null || field === undefined) return '';
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Generate CSV from table data
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Column definitions [{ header: 'Name', key: 'name' }]
 * @param {String} filename - Output filename (without .csv extension)
 */
export function generateCSV(data, columns, filename = 'download') {
  try {
    console.log('generateCSV called with:', { dataLength: data?.length, columns: columns?.length, filename });
    
    if (!data || !Array.isArray(data)) {
      console.error('Invalid data provided to generateCSV:', data);
      alert('No data available to export');
      return;
    }
    
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      console.error('Invalid columns provided to generateCSV:', columns);
      alert('Invalid CSV configuration');
      return;
    }
    
    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Create header row
    const headers = columns.map(col => escapeCSVField(col.header));
    const csvRows = [headers.join(',')];
    
    // Create data rows
    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col.key];
        return escapeCSVField(value);
      });
      csvRows.push(values.join(','));
    });
    
    // Combine all rows
    const csvContent = csvRows.join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('CSV generated successfully');
  } catch (error) {
    console.error('Error generating CSV:', error);
    alert('Failed to generate CSV. Please try again.');
  }
}
