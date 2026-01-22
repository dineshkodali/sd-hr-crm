// Enhanced Comparison Table Component for CRUD Operations
import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Plus, 
  Minus, 
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

const ComparisonTable = ({ 
  beforeData, 
  afterData, 
  changes, 
  title = "Changes Made",
  compact = false,
  showOnlyChanges = true 
}) => {
  const [expandedFields, setExpandedFields] = useState(new Set());
  const [showAllFields, setShowAllFields] = useState(!showOnlyChanges);

  if (!changes || Object.keys(changes).length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <Edit className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No changes detected</p>
      </div>
    );
  }

  const toggleFieldExpansion = (field) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(field)) {
      newExpanded.delete(field);
    } else {
      newExpanded.add(field);
    }
    setExpandedFields(newExpanded);
  };

  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const formatValue = (value, isExpanded = false) => {
    if (value === null || value === undefined) {
      return <span className="italic text-gray-400">Empty</span>;
    }
    
    const stringValue = String(value);
    
    // Handle long values
    if (!isExpanded && stringValue.length > 100) {
      return (
        <span>
          {stringValue.substring(0, 100)}
          <span className="text-gray-400">... (truncated)</span>
        </span>
      );
    }
    
    return stringValue;
  };

  const getChangeIcon = (changeType) => {
    switch (changeType) {
      case 'added': return <Plus className="w-3 h-3 text-green-600" />;
      case 'removed': return <Minus className="w-3 h-3 text-red-600" />;
      default: return <Edit className="w-3 h-3 text-blue-600" />;
    }
  };

  const getChangeColor = (changeType) => {
    switch (changeType) {
      case 'added': return 'border-l-green-500 bg-green-50';
      case 'removed': return 'border-l-red-500 bg-red-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const changedFields = Object.keys(changes);
  const allFields = showAllFields ? 
    [...new Set([...Object.keys(beforeData || {}), ...Object.keys(afterData || {})])] :
    changedFields;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit className="w-4 h-4 text-indigo-600" />
          <h4 className="font-semibold text-gray-900">
            {title} ({changedFields.length} field{changedFields.length > 1 ? 's' : ''})
          </h4>
        </div>
        
        {beforeData && afterData && (
          <button
            onClick={() => setShowAllFields(!showAllFields)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            {showAllFields ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showAllFields ? 'Show only changes' : 'Show all fields'}
          </button>
        )}
      </div>

      {/* Comparison Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-1/4">
                Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-5/12">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Before
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-5/12">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  After
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                Change
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {allFields.map((field) => {
              const change = changes[field];
              const isChanged = !!change;
              const isExpanded = expandedFields.has(field);
              const beforeValue = beforeData?.[field];
              const afterValue = afterData?.[field];
              
              // Skip unchanged fields if showing only changes
              if (!showAllFields && !isChanged) return null;

              const beforeString = String(beforeValue || '');
              const afterString = String(afterValue || '');
              const hasLongContent = beforeString.length > 100 || afterString.length > 100;

              return (
                <tr 
                  key={field} 
                  className={`hover:bg-gray-50 transition-colors ${
                    isChanged ? getChangeColor(change?.type) + ' border-l-4' : ''
                  }`}
                >
                  {/* Field Name */}
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {isChanged && getChangeIcon(change.type)}
                      <span>{formatFieldName(field)}</span>
                      {hasLongContent && (
                        <button
                          onClick={() => toggleFieldExpansion(field)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Before Value */}
                  <td className="px-4 py-3 text-sm">
                    <div className={`p-2 rounded font-mono text-xs ${
                      isChanged ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-gray-50 border border-gray-200 text-gray-700'
                    }`}>
                      {formatValue(beforeValue, isExpanded)}
                    </div>
                  </td>

                  {/* After Value */}
                  <td className="px-4 py-3 text-sm">
                    <div className={`p-2 rounded font-mono text-xs ${
                      isChanged ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-gray-50 border border-gray-200 text-gray-700'
                    }`}>
                      {formatValue(afterValue, isExpanded)}
                    </div>
                  </td>

                  {/* Change Type */}
                  <td className="px-4 py-3 text-center">
                    {isChanged ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        change.type === 'added' ? 'bg-green-100 text-green-700' :
                        change.type === 'removed' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {change.type === 'added' ? '+ Added' :
                         change.type === 'removed' ? '- Removed' :
                         '~ Modified'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">No change</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {changedFields.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-indigo-800">
            <Edit className="w-4 h-4" />
            <span className="font-medium">Summary:</span>
            <span>
              {changedFields.length} field{changedFields.length > 1 ? 's' : ''} modified
              {changes && Object.values(changes).filter(c => c.type === 'added').length > 0 && 
                ` • ${Object.values(changes).filter(c => c.type === 'added').length} added`}
              {changes && Object.values(changes).filter(c => c.type === 'removed').length > 0 && 
                ` • ${Object.values(changes).filter(c => c.type === 'removed').length} removed`}
              {changes && Object.values(changes).filter(c => c.type === 'modified').length > 0 && 
                ` • ${Object.values(changes).filter(c => c.type === 'modified').length} updated`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonTable;