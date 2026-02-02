import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table } from 'lucide-react';

/**
 * DownloadDropdown Component
 * Shows a dropdown menu with PDF and CSV download options
 * 
 * @param {Function} onDownloadPDF - Callback when PDF option is selected
 * @param {Function} onDownloadCSV - Callback when CSV option is selected
 * @param {String} className - Additional CSS classes
 */
export function DownloadDropdown({ onDownloadPDF, onDownloadCSV, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePDFClick = () => {
    setIsOpen(false);
    onDownloadPDF();
  };

  const handleCSVClick = () => {
    setIsOpen(false);
    onDownloadCSV();
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-teal-400 hover:bg-teal-500 text-white font-medium rounded-lg py-2 px-4 text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-50">
          <button
            onClick={handlePDFClick}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <FileText className="w-4 h-4 text-red-500" />
            <span className="font-medium">Download as PDF</span>
          </button>
          <button
            onClick={handleCSVClick}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors border-t border-gray-100"
          >
            <Table className="w-4 h-4 text-green-600" />
            <span className="font-medium">Download as CSV</span>
          </button>
        </div>
      )}
    </div>
  );
}
